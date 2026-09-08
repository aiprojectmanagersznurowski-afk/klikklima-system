import { Prisma } from "@repo/database"
import { InstallationStatus } from "@repo/database"
import { NOTIFICATIONS } from "@klikklima/contracts"

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

type EnqueueNotificationParams = {
  notificationId: string
  idempotencyKey: string
  leadId?: string
  installationId?: string
  serviceId?: string
  incidentId?: string
  recipientOverride?: string
  payload?: Prisma.InputJsonValue
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
 */
export async function enqueueNotification(
  tx: Prisma.TransactionClient,
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

  const results: { id: string; created: boolean; channel: string }[] = []

  for (const channel of definition.channels) {
    const channelIdempotencyKey = `${params.idempotencyKey}:${channel}`

    try {
      const row = await tx.notificationQueue.create({
        data: {
          notificationId: definition.id,
          templateKey: definition.templateKey,
          channel,
          recipientType: definition.recipient,
          recipientAddress: params.recipientOverride ?? null,
          payload: params.payload ?? {},
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
