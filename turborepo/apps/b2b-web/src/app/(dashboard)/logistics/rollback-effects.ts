import { Prisma } from "@repo/database"
import { InstallationStatus } from "@repo/database"
import { NOTIFICATIONS } from "@klikklima/contracts"
// Import WZGLĘDNY, nie `@/lib/...` (alias): `@/*` jest rozwiązywany przez `paths` w
// tsconfig, ale vitest.config.mts (root) nie ma go w `resolve.alias` — import wartości
// (nie tylko typu) pod tym aliasem wywala się w czasie działania testów jednostkowych
// (`Cannot find package '@/...'`). `import type` gdzie indziej w tym katalogu (np.
// `logistics/actions.ts`) unika tego wyłącznie dlatego, że jest wycinany w całości przy
// transpilacji — tu potrzebne są prawdziwe funkcje, więc ścieżka względna.
import { resolveCurrentTemplateContent, renderMessageTemplate, type MessageTemplateStore } from "../../../lib/notifications/templates"
import { calculateInitialAttemptTime } from "../../../lib/notifications/window"

/**
 * D1 (FNL-ROLLBACK): zwalnia slot ekipy dla wszystkich wierszy `instalacje` danego
 * leada, które są jeszcze `PLANNED`. Blokada `SELECT ... FOR UPDATE` MUSI poprzedzić
 * jakąkolwiek mutację, żeby dwie równoległe próby zwolnienia/przydziału tego samego
 * slotu nie wyścigały się w JS (pułapka 4 z CLAUDE.md).
 *
 * Filtr `status = 'PLANNED'` jest częścią samego zapytania blokującego — inaczej
 * zablokowalibyśmy (i nadpisali) także wiersze `COMPLETED`/`CANCELLED`, czyli
 * ukończone montaże (review LOGISTICS-SHIPPING-EFFECTS, Faza A, BLOCKER 1).
 *
 * NIE jest to Server Action — ten moduł (osobny plik od `actions.ts`) nie ma
 * `"use server"`, więc Turbopack nie generuje dla `releaseCrewSlot`/`suspendLogisticsSla`
 * żadnego wpisu w `server-reference-manifest.json`: bez publicznego ID nie da się
 * ich wywołać z przeglądarki.
 * Wywoływana WYŁĄCZNIE z wnętrza `rollbackLogisticsOrder` w `actions.ts`, już po
 * przejściu bramki `can()` tej funkcji.
 */
export async function releaseCrewSlot(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  const lockedRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM instalacje WHERE lead_id = ${leadId}::uuid AND status = 'PLANNED' FOR UPDATE
  `;

  for (const row of lockedRows) {
    await tx.instalacje.update({
      where: { id: row.id },
      data: {
        zespol_id: null,
        data_planowana: null,
        status: InstallationStatus.CANCELLED,
      },
    });
  }
}

/**
 * D2 (FNL-ROLLBACK): wstrzymuje SLA logistyczne leada. `logistics_sla_paused_at`
 * ustawiany jest TYLKO gdy jeszcze `null` (idempotencja — AC-A5: drugi rollback nie
 * przesuwa stempla), `data_rezerwacji` jest zerowana zawsze, bo lead traci swój
 * termin niezależnie od tego, czy SLA było już wstrzymane wcześniej.
 */
export async function suspendLogisticsSla(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  const lead = await tx.leady.findUnique({ where: { id: leadId } });

  await tx.leady.update({
    where: { id: leadId },
    data: {
      logistics_sla_paused_at: lead?.logistics_sla_paused_at ?? new Date(),
      data_rezerwacji: null,
    },
  });
}

/**
 * FNL-2PHASE-ROLLBACK-RELEASE (WO, sekcja "Szkic projektu", wariant preferowany D1a):
 * zwalnia WYŁĄCZNIE rezerwację etapu II montażu dwuetapowego przy rollbacku
 * (`AWAITING_INSTALLATION -> ROLLBACK_RESCHEDULING`, T10-T13). Zakres wąski —
 * etap I i montaż jednoetapowy NIE są tu dotykane (poza zakresem, patrz
 * `FNL-ROLLBACK-BOOKING-RELEASE`).
 *
 * Kroki:
 *  1. instalacje leada z `installation_type = 'TWO_PHASE'` — BEZ filtra po
 *     `instalacje.status` (D2 WO: `releaseCrewSlot` ustawia `CANCELLED` na
 *     wierszach `PLANNED`, więc filtrowanie po statusie instalacji tutaj
 *     zależałoby od kolejności wywołań względem `releaseCrewSlot`).
 *  2. `installation_phases(phaseNumber=2)` tej instalacji.
 *  3. jeżeli ma `bookingId`: `SELECT ... FOR UPDATE` na wierszu `bookings`
 *     PRZED jakąkolwiek mutacją (pułapka 4 CLAUDE.md), potem odczyt statusu.
 *  4. `RESERVED`/`CONFIRMED` -> `RELEASED`. W przeciwnym razie (już
 *     `RELEASED`/`COMPLETED`) — nic (idempotencja, ochrona pracy wykonanej,
 *     brzegi 2 i 3 WO).
 *  5. `installation_phases.booking_id` NIE jest zerowane (ślad historyczny),
 *     etap I NIE jest dotykany w żadnym polu (AC6/AC7).
 */
export async function releasePhaseTwoBooking(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  // Zapytanie defensywne (dług nazewniczy KK-NAMING-BASELINE, jak w
  // `two-phase-actions.ts`): dublom `tx` w testach starszym od tej funkcji,
  // które nie modelują montażu dwuetapowego, brakuje `findMany` na `instalacje`
  // — traktujemy taki przypadek jak "brak instalacji dwuetapowych", nie jak
  // awarię. Prawdziwy `Prisma.TransactionClient` ma `findMany` zawsze.
  const twoPhaseInstallations = (await tx.instalacje.findMany?.({
    where: { lead_id: leadId, installation_type: "TWO_PHASE" },
  })) ?? [];

  for (const installation of twoPhaseInstallations) {
    const phaseTwo = await tx.installationPhase.findUnique({
      where: { installationId_phaseNumber: { installationId: installation.id, phaseNumber: 2 } },
    });

    if (!phaseTwo?.bookingId) {
      continue;
    }

    const lockedRows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM bookings WHERE id = ${phaseTwo.bookingId}::uuid FOR UPDATE
    `;
    const lockedBooking = lockedRows[0];
    if (!lockedBooking) {
      continue;
    }

    const booking = await tx.booking.findUnique({ where: { id: phaseTwo.bookingId } });
    if (!booking || (booking.status !== "RESERVED" && booking.status !== "CONFIRMED")) {
      continue;
    }

    await tx.booking.update({
      where: { id: phaseTwo.bookingId },
      data: { status: "RELEASED" },
    });
  }
}

type EnqueueNotificationParams = {
  notificationId: string
  idempotencyKey: string
  // `| null` dopuszczony obok `undefined`, żeby `EnqueueNotificationParams` z
  // `lib/notifications/types.ts` (używany przez `enqueueNotificationEx`, wołany z tymi samymi
  // polami dopuszczającymi `null`) był strukturalnie przypisywalny bez rzutowania.
  leadId?: string | null
  installationId?: string | null
  serviceId?: string | null
  incidentId?: string | null
  recipientOverride?: string | null
  payload?: Prisma.InputJsonValue | Record<string, unknown>
}

/**
 * Interfejs WYMAGANY przez `enqueueNotification`, nie „cały `Prisma.TransactionClient`" — ta
 * funkcja dotyka wyłącznie `notificationQueue.create` i (przez `resolveCurrentTemplateContent`)
 * opcjonalnie `messageTemplate.findFirst`. Wąski interfejs zamiast `Prisma.TransactionClient`
 * pozwala `enqueueNotificationEx` (`lib/notifications/enqueue.ts`, alias cienki po scaleniu,
 * runda 3 audytu feat/ntf-gateway 2026-09-24) przekazać swój `EnqueueTx` WPROST, bez rzutowania
 * przez `unknown` — `gate-evasion-prisma-recast` blokuje dokładnie taki cast, i słusznie: prawdziwy
 * `Prisma.TransactionClient` (osiem wywołujących w produkcji) spełnia ten węższy interfejs
 * strukturalnie, więc żadnego rzutowania nie trzeba w żadną stronę.
 */
interface EnqueueNotificationTx extends MessageTemplateStore {
  notificationQueue: {
    // Składnia METODY (`create(args): ...`), NIE właściwości funkcyjnej (`create: (args) =>
    // ...`) — pod `strictFunctionTypes` (tsconfig `strict: true`) druga forma jest sprawdzana
    // kontrawariantnie i realny `Prisma.TransactionClient` (osiem wywołujących w produkcji, z
    // dużo bogatszym, wymaganym kształtem `data`) NIE byłby przypisywalny do tego węższego
    // interfejsu. Składnia metody daje sprawdzanie biwariantne — bezpieczne tutaj, bo ten
    // interfejs opisuje MINIMUM, którego funkcja faktycznie używa, a nie kontrakt do
    // odtworzenia w obie strony.
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
}

/**
 * NTF-QUEUE-TABLE (WO LOGISTICS-SHIPPING-EFFECTS, Faza B). Wstawia wiersz do kolejki
 * powiadomień w ramach tej samej transakcji, którą posługuje się wywołujący — helper
 * nigdy nie sięga po globalny klient Prisma, wyłącznie po przekazany `tx` (pułapka 2
 * z CLAUDE.md: zmiana statusu i kolejka powiadomień to jedna transakcja).
 *
 * Kanał, klucz szablonu i typ odbiorcy pochodzą wyłącznie z katalogu powiadomień
 * (`@klikklima/contracts`), odnalezionego po `notificationId` przekazanym przez
 * wywołującego — helper nie zna i nie może znać żadnej konkretnej definicji na sztywno.
 * Definicja katalogowa udostępnia listę kanałów (bo jedno powiadomienie potrafi iść
 * kilkoma drogami naraz), a kolumna kolejki jest pojedynczym `TEXT` — więc helper
 * tworzy JEDEN WIERSZ NA KANAŁ (decyzja człowieka: żaden kanał z listy katalogu nie
 * może zostać po cichu porzucony; wcześniejszy wybór "pierwszego kanału" gubił np.
 * drugi kanał wielokanałowego powiadomienia o wysyłce). Każdy wiersz dostaje własny
 * klucz idempotencji — bazowy klucz wywołującego z dołożonym sufiksem kanału — żeby
 * dwa wiersze tego samego zdarzenia nie kolidowały na unikalności `idempotencyKey`.
 * Idempotencja działa per (zdarzenie, kanał): ponowne wywołanie całej funkcji dla
 * tego samego zdarzenia trafia w te same klucze per kanał i jest traktowane jako
 * sukces, nie błąd (patrz niżej).
 *
 * Dokładnie jeden z czterech identyfikatorów właściciela musi być podany — sprawdzane
 * PRZED jakąkolwiek próbą zapisu, tak żeby błąd wywołującego nigdy nie dotarł do `tx`
 * (druga warstwa obrony obok ograniczenia w samym schemacie bazy).
 *
 * Powtórne wstawienie z tym samym kluczem idempotencji jest oczekiwane (retry crona,
 * ponowne wywołanie tego samego przejścia) i traktowane jako sukces, nie błąd —
 * łapiemy kod kolizji unikalności per wiersz i zwracamy istniejący efekt dla TEGO
 * kanału zamiast rzucać dalej — kolizja na jednym kanale nie przerywa tworzenia
 * pozostałych kanałów tego samego wywołania.
 *
 * SCALENIE Z `enqueueNotificationEx` (runda 3 audytu feat/ntf-gateway, 2026-09-24, BLOCKER 2):
 * ten helper był duplikatem `enqueueNotificationEx` (`src/lib/notifications/enqueue.ts`) — ten
 * TUTAJ jest wołany przez WSZYSTKICH ośmiu wywołujących w produkcji, tamten NIE był wołany
 * przez żaden kod produkcyjny. Dwie ścieżki renderowania treści to dokładnie ten defekt, który
 * NTF-QUEUE-RENDERED-BODY miało zamknąć: bez tego scalenia realne kolejkowanie nigdy nie
 * wypełniało `renderedBody`/`renderedSubject`/`templateVersionId`/`nextAttemptAt`, więc
 * dispatcher zawsze czytał AKTUALNĄ wersję szablonu zamiast zamrożonej. Logika walidacji domen
 * (SERVICE/INCIDENT/FUNNEL) i renderowania przeniesiona tutaj W CAŁOŚCI z `enqueueNotificationEx`,
 * która stała się cienkim aliasem wołającym tę funkcję.
 */
export async function enqueueNotification(
  tx: EnqueueNotificationTx,
  params: EnqueueNotificationParams,
): Promise<{ id: string; created: boolean; channel: string }[]> {
  const ownerIds = [params.leadId, params.installationId, params.serviceId, params.incidentId]
  const providedOwnerCount = ownerIds.filter((value) => value !== undefined && value !== null).length

  if (providedOwnerCount !== 1) {
    throw new Error(
      "enqueueNotification: dokładnie jedno z leadId/installationId/serviceId/incidentId musi być podane",
    )
  }

  const definition = NOTIFICATIONS.find((n) => n.id === params.notificationId)
  if (!definition) {
    throw new Error(`enqueueNotification: brak definicji w katalogu dla id "${params.notificationId}"`)
  }

  // Wymuszenie powiązań domenowych (NTF-POLY), przeniesione z `enqueueNotificationEx`.
  if (definition.domain === "SERVICE" && !params.serviceId) {
    throw new Error(`Powiadomienie ${definition.id} z domeny SERVICE musi być powiązane z serviceId`)
  }
  if (definition.domain === "INCIDENT" && !params.incidentId) {
    throw new Error(`Powiadomienie ${definition.id} z domeny INCIDENT musi być powiązane z incidentId`)
  }
  if (definition.domain === "FUNNEL" && !params.leadId && !params.installationId) {
    throw new Error(`Powiadomienie ${definition.id} z domeny FUNNEL musi być powiązane z leadId lub installationId`)
  }

  const results: { id: string; created: boolean; channel: string }[] = []

  for (const channel of definition.channels) {
    const channelIdempotencyKey = `${params.idempotencyKey}:${channel}`

    // NTF-QUEUE-RENDERED-BODY: treść WYRENDEROWANA w chwili kolejkowania, z AKTUALNEJ wersji
    // szablonu — nie w chwili wysyłki (patrz komentarz przy `QUEUE_POLICY.persistsRenderedBody`
    // w kontrakcie). `resolveCurrentTemplateContent` sama spada na fallback `TEMPLATE_DEFINITIONS`,
    // gdy `tx` nie ma modelu `messageTemplate` (atrapy starszych testów jednostkowych) albo gdy
    // baza nie ma jeszcze opublikowanej wersji — więc to wywołanie jest bezpieczne dla obu grup
    // wywołujących (osiem Server Actions produkcyjnych i testy z uproszczonym `tx`).
    const payloadObj = (params.payload as Record<string, unknown>) ?? {}
    const content = await resolveCurrentTemplateContent(tx, definition.templateKey, channel)
    const rendered = renderMessageTemplate(content, payloadObj)
    const initialAttemptAt = calculateInitialAttemptTime(channel)

    try {
      const row = await tx.notificationQueue.create({
        data: {
          notificationId: definition.id,
          templateKey: definition.templateKey,
          channel,
          recipientType: definition.recipient,
          recipientAddress: params.recipientOverride ?? null,
          payload: (params.payload as Prisma.InputJsonValue) ?? {},
          renderedBody: rendered.body,
          renderedSubject: rendered.subject ?? null,
          templateVersionId: content.templateVersionId,
          nextAttemptAt: initialAttemptAt,
          status: "PENDING",
          attempts: 0,
          idempotencyKey: channelIdempotencyKey,
          leadId: params.leadId ?? null,
          installationId: params.installationId ?? null,
          serviceId: params.serviceId ?? null,
          incidentId: params.incidentId ?? null,
        },
      })

      results.push({ id: row.id, created: true, channel })
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code: unknown }).code === "P2002") {
        results.push({ id: channelIdempotencyKey, created: false, channel })
      } else {
        throw error
      }
    }
  }

  return results
}
