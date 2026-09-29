"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  BUILDING_TYPE_PL,
  isTriageFieldVisible,
  PROPERTY_AREA_BAND_IDS,
  START_STATE,
  type BuildingTypeId,
  type TriageAnswers,
} from "@klikklima/contracts";
import { createCalendarEvent } from "./calendar";
import { prisma, Prisma } from "@repo/database";
import { prepareBookingCandidates, writeBookingCandidate, findPoolSlots, type BookingCandidate } from "@repo/scheduling";

/**
 * WO: docs/workorders/B2C-LEAD-ATOMIC.md — P-1/P-2/P-3/P-4/P-5.
 *
 * `saveLead` jest JEDYNĄ Server Action tworzącą leada z B2C (AC6). Zapis klienta, adresu,
 * leada i rezerwacji terminu audytu odbywa się w JEDNEJ `prisma.$transaction` — ponawianej
 * PER KANDYDAT (P-2: "ustal kandydatów przed transakcją"), bo pierwszy nieudany `INSERT`
 * na `bookings` zatruwa transakcję Prismy (brak savepointów). `prepareBookingCandidates`
 * (odczyty, POZA transakcją) wyznacza uporządkowanych kandydatów; każda iteracja pętli
 * poniżej to OSOBNA, PEŁNA `prisma.$transaction`: klient -> adres -> lead (ze
 * `status: START_STATE` i `data_rezerwacji`) -> `writeBookingCandidate(tx, ...)`. Błąd
 * 23P01/40P01 z `writeBookingCandidate` wydostaje się jako wyjątek z tx-callbacku, cała
 * transakcja jest wycofana przez Prismę, próbujemy następnego kandydata w NOWEJ transakcji.
 * Każdy inny błąd (w tym błąd domenowy POOL_MISMATCH/SUBJECT_ALREADY_BOOKED zwrócony przez
 * `writeBookingCandidate` jako `{ok:false}`) przerywa pętlę bez ponowienia (D-3).
 *
 * `createCalendarEvent` (P-5) jest wołany WYŁĄCZNIE po zatwierdzonej transakcji, poza nią,
 * best-effort — awaria integracji nie wycofuje zapisu (AC4).
 */

const BUILDING_TYPE_ID_BY_PL: Record<string, BuildingTypeId> = Object.fromEntries(
  (Object.entries(BUILDING_TYPE_PL) as [BuildingTypeId, string][]).map(([id, pl]) => [pl, id])
);

// Horyzont alternatyw przy wyczerpaniu puli kandydatów — ten sam co domyślny w
// `@repo/scheduling/create-booking.ts` (DEFAULT_ALTERNATIVES_HORIZON_DAYS), rozbity na dwie
// nazwane stałe (dni, ms/dzień) — ADR-011: bez jednego literału przeliczającego dni na ms.
const ALTERNATIVES_HORIZON_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// AC9: pusty string i sam biały znak liczą się jako brak — `.trim().min(1)`.
const requiredContactField = z.string().trim().min(1);

// AC9: odpowiedzi Triage — brak pola jest odrzucany. `z.record` odrzuca `undefined`/`null`
// (nie jest to obiekt), w przeciwieństwie do `z.unknown()`, które przepuściłoby brak pola.
const triageDataSchema = z.record(z.string(), z.unknown());

// AC8: pole `status` (dowolna wartość) w żądaniu odrzuca całe żądanie, zero zapisów —
// `z.never().optional()` akceptuje WYŁĄCZNIE brak pola, każda wartość (nawet `null`) pada.
// Pozostałe nadmiarowe pola (visitBasketId, bookedBy, resource_id, auditorId, leadId, ...)
// nie są częścią kontraktu wejścia i są po prostu nieodczytywane niżej — nigdy nie trafiają
// do `prepareBookingCandidates`/`writeBookingCandidate` (te wołania budują własne argumenty
// wyłącznie z serwerowych wartości, B2C-BOOKING-SLOT AC5/AC7).
// B2C-CONSENT-RODO, AC1/AC2: zgoda jest zagnieżdżonym obiektem DWÓCH wskazań wersji
// (polityka prywatności + regulamin), oba UUID, wymagane. `.strict()` NA TYM obiekcie
// (nie na całym `saveLeadSchema`) — odrzuca nadmiarowy klucz w polu zgody bez włączania
// globalnej `.strict()`.
const consentSchema = z
  .object({
    privacyPolicyConsentVersionId: z.string().uuid(),
    termsConsentVersionId: z.string().uuid(),
  })
  .strict();

const saveLeadSchema = z.object({
  name: requiredContactField,
  email: requiredContactField,
  phone: requiredContactField,
  address: requiredContactField,
  startAtIso: z.string().trim().min(1),
  triageData: triageDataSchema,
  lat: z.union([z.number(), z.string()]).optional(),
  lng: z.union([z.number(), z.string()]).optional(),
  status: z.never().optional(),
  consent: consentSchema,
});

// Typ publiczny WOLNY od `zod` — `triageData: any` zachowuje kompatybilność z wołającymi
// (np. `Step8Booking.tsx`, `TriageStateData` bez indeksu string), walidacja RUNTIME i tak
// jest jawna i bezwarunkowa (`saveLeadSchema.safeParse`) poniżej, niezależnie od typu TS.
export interface SaveLeadData {
  name: string;
  email: string;
  phone: string;
  address: string;
  startAtIso: string;
  triageData: any;
  lat?: number | string;
  lng?: number | string;
  consent: {
    privacyPolicyConsentVersionId: string;
    termsConsentVersionId: string;
  };
}

// FLD-GEO-COORDS: normalizuje współrzędne do number|null przed insertem na `adresy`.
// `??` (nie `||`), żeby 0 (poprawna wartość) nie stał się `null`; `Number(...)`, żeby
// wejście typu string (np. z ręcznie sklejonego żądania) trafiło do kolumny
// `double precision` jako liczba, nie jako tekst.
function toNullableCoordinate(value: number | string | undefined): number | null {
  return value === undefined ? null : Number(value);
}

/**
 * Sentinel wewnętrzny — niesie błąd domenowy zwrócony przez `writeBookingCandidate` (nie
 * SQLSTATE-owy wyjątek) z powrotem z tx-callbacku do pętli po kandydatach, BEZ ponowienia
 * na innym kandydacie (D-3: POOL_MISMATCH/SUBJECT_ALREADY_BOOKED nie mają sensu ponowione).
 */
class BookingWriteRejected extends Error {
  constructor(
    public readonly code: string,
    public readonly domainMessage: string,
    public readonly alternatives: unknown[],
  ) {
    super(`BOOKING_WRITE_REJECTED:${code}`);
  }
}

/**
 * Duplikat minimalnej logiki z `packages/scheduling/src/create-booking.ts` (nie wolno
 * importować `extractSqlState` z `@repo/scheduling` tutaj — ten pakiet jest mockowany w
 * całości w testach jednostkowych tego pliku, więc realny import z niego rozjeżdżałby się
 * z mockiem). Rozpoznaje WYŁĄCZNIE 23P01 (przegrany wyścig) i 40P01 (deadlock, równoważny
 * 23P01 w tym kontekście — patrz `create-booking.ts`).
 */
function isRetryableBookingRace(err: unknown): boolean {
  if (err && typeof err === "object") {
    const meta = (err as { meta?: unknown }).meta;
    if (meta && typeof meta === "object") {
      const metaCode = (meta as Record<string, unknown>).code;
      if (metaCode === "23P01" || metaCode === "40P01") return true;
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/Code:\s*`(23P01|40P01)`/.test(message)) return true;
  if (/SQLSTATE\s+(23P01|40P01)/.test(message)) return true;
  if (/code:\s*"(23P01|40P01)"/.test(message)) return true;
  return false;
}

// Prawdziwy `Prisma.TransactionClient` (przekazywany przez `prisma.$transaction`) — ten sam
// typ, który przyjmuje `writeBookingCandidate` z `@repo/scheduling` (precedens:
// `apps/b2b-web/src/app/(dashboard)/logistics/rollback-effects.ts`).
type TransactionClient = Prisma.TransactionClient;

export async function saveLead(data: SaveLeadData) {
  try {
    const parsed = saveLeadSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.message,
      };
    }
    const input = parsed.data;

    // 0. Walidacja Triage (B2C-PROPERTY-AREA-BAND, AC4, AC6)
    // Sprawdzamy typ budynku oraz widoczność pola PROPERTY_AREA_BAND wg kontraktu PRZED
    // jakimkolwiek zapisem.
    const rawTriage = { ...input.triageData };
    const rawLocation = rawTriage.location as string | undefined;
    const buildingType =
      (rawLocation && BUILDING_TYPE_ID_BY_PL[rawLocation]) || rawLocation || (rawTriage.buildingType as string | undefined);
    const answers: TriageAnswers = {};
    if (buildingType) {
      answers.BUILDING_TYPE = buildingType as BuildingTypeId;
    }

    if (isTriageFieldVisible("PROPERTY_AREA_BAND", answers)) {
      const band = rawTriage.propertyAreaBand;
      if (!band || !PROPERTY_AREA_BAND_IDS.includes(band as (typeof PROPERTY_AREA_BAND_IDS)[number])) {
        return {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Wymagane określenie przedziału powierzchni lokalu (wartość ze słownika PROPERTY_AREA_BANDS).",
        };
      }
    } else {
      // Dla nieruchomości, dla których pytanie nie jest widoczne (np. COMMERCIAL),
      // wartość przysłana przez klienta nie może trafić do odpowiedzi_triage (AC6).
      delete rawTriage.propertyAreaBand;
    }

    let estimatedQuote: string | null = null;
    const priceDevices = rawTriage.priceDevices as number | undefined;
    const priceInstallation = rawTriage.priceInstallation as number | undefined;
    if (priceDevices || priceInstallation) {
      const total = (priceDevices || 0) + (priceInstallation || 0);
      if (total > 0) {
        estimatedQuote = `${total} PLN netto`;
      }
    }

    // 0b. B2C-CONSENT-RODO, AC5: obie wersje zgody muszą istnieć, być OBOWIĄZUJĄCE
    // (isCurrent: true — nie szkic, nie zastąpiona) i właściwego rodzaju dokumentu.
    // Zgodność rodzaju NIE jest wymuszona przez FK (kolumna wskazuje dowolny wiersz
    // `legal_document_versions`) — sprawdza ją WYŁĄCZNIE ta Server Action. Odczyt PRZED
    // `prepareBookingCandidates`/transakcją (AC2: zero zapisów, rezerwacja niewołana).
    // Kolejność (privacy, potem terms) jest częścią kontraktu z testem jednostkowym.
    const privacyVersion = await prisma.legalDocumentVersion.findUnique({
      where: { id: input.consent.privacyPolicyConsentVersionId },
    });
    if (!privacyVersion || privacyVersion.isCurrent !== true || privacyVersion.documentKind !== "B2C_PRIVACY_POLICY") {
      return {
        success: false,
        code: "CONSENT_VERSION_INVALID",
        message: "Wskazana wersja polityki prywatności nie jest obowiązującą wersją tego dokumentu.",
      };
    }

    const termsVersion = await prisma.legalDocumentVersion.findUnique({
      where: { id: input.consent.termsConsentVersionId },
    });
    if (!termsVersion || termsVersion.isCurrent !== true || termsVersion.documentKind !== "B2C_TERMS") {
      return {
        success: false,
        code: "CONSENT_VERSION_INVALID",
        message: "Wskazana wersja regulaminu nie jest obowiązującą wersją tego dokumentu.",
      };
    }

    // 1. Rozwiąż koszyk AUDIT (kod -> UUID) po stronie serwera — klient nie przysyła ani
    // koszyka, ani `bookedBy` (D-3, AC5). Jawnie POZA transakcją (część przygotowawcza).
    const auditBasket = await prisma.visitDurationBasket.findFirst({
      where: { code: "AUDIT", isActive: true },
    });

    if (!auditBasket) {
      return {
        success: false,
        code: "BASKET_NOT_FOUND",
        message: "Koszyk audytu jest chwilowo niedostępny — spróbuj ponownie później.",
      };
    }

    const startAtDate = new Date(input.startAtIso);

    // 2. Kandydaci na rezerwację — WYŁĄCZNIE odczyty, POZA transakcją (P-2). `visitBasketId`
    // i `bookedBy` pochodzą WYŁĄCZNIE z serwera; jakiekolwiek dodatkowe pola dołączone do
    // żądania klienta (visitBasketId, bookedBy, resource_id, leadId, status, ...) NIE są
    // honorowane — nie istnieją w obiekcie przekazanym niżej.
    const prepared = await prepareBookingCandidates({
      visitBasketId: auditBasket.id,
      startAt: startAtDate,
    });

    if (!prepared.ok) {
      return {
        success: false,
        code: prepared.error.code,
        message: prepared.error.message,
        alternatives: prepared.error.alternatives,
      };
    }

    // 3. Transakcja ponawiana PER KANDYDAT (P-2): każda iteracja to osobna, pełna
    // `prisma.$transaction`. 23P01/40P01 -> cała transakcja wycofana -> następny kandydat.
    for (const candidate of prepared.candidates as BookingCandidate[]) {
      const klientId = randomUUID();
      const adresId = randomUUID();
      const leadId = randomUUID();

      try {
        const txResult = await prisma.$transaction(async (tx: TransactionClient) => {
          // 3a. Klient. SEC-RLS-BASELINE: `id` generowany tu, nie odczytywany przez
          // `.select()` — ta ścieżka idzie teraz przez Prismę (P-3), ale zasada zostaje.
          await tx.klienci.create({
            data: {
              id: klientId,
              imie_i_nazwisko: input.name,
              email: input.email,
              telefon: input.phone,
            },
          });

          // 3b. Adres powiązany z klientem (FLD-GEO-COORDS: latitude/longitude w TYM
          // SAMYM insercie co reszta adresu).
          await tx.adresy.create({
            data: {
              id: adresId,
              klient_id: klientId,
              ulica_miasto: input.address,
              latitude: toNullableCoordinate(input.lat),
              longitude: toNullableCoordinate(input.lng),
            },
          });

          // 3c. Lead — powiązanie klient_id/adres_id WEWNĄTRZ tej samej transakcji (AC3),
          // status z kontraktu lejka (AC7, nie literał), data_rezerwacji w TYM SAMYM
          // create() (P-4) — wartość to żądany startAt, dokładnie scheduled_start rezerwacji.
          // B2C-CONSENT-RODO, AC1/AC3: wskazania wersji DOKŁADNIE takie, jak przysłane w
          // żądaniu (zwalidowane w kroku 0b); moment zgody ustawiany przez SERWER (`new
          // Date()`), nigdy z żądania — dla obu dokumentów osobno, w TEJ SAMEJ transakcji
          // co reszta leada.
          const { leady } = tx;
          await leady.create({
            data: {
              id: leadId,
              klient_id: klientId,
              adres_id: adresId,
              odpowiedzi_triage: rawTriage as Prisma.InputJsonValue,
              estymowana_wycena: estimatedQuote,
              status: START_STATE,
              data_rezerwacji: startAtDate,
              privacyPolicyConsentVersionId: input.consent.privacyPolicyConsentVersionId,
              privacyPolicyConsentGrantedAt: new Date(),
              termsConsentVersionId: input.consent.termsConsentVersionId,
              termsConsentGrantedAt: new Date(),
            },
          });

          // 3d. Rezerwacja terminu — jedna implementacja domenowa (@repo/scheduling, AC6).
          // leadId jest wygenerowany SERWEROWO w tej samej transakcji — żadna wartość z
          // żądania klienta nie może adresować rezerwacji na cudzym leadzie (B2C-BOOKING-SLOT
          // AC7).
          const writeResult = await writeBookingCandidate(tx, {
            visitBasketId: prepared.visitBasketId,
            scheduledStart: startAtDate,
            scheduledEnd: prepared.scheduledEnd,
            resourceKind: prepared.resourceKind,
            candidate,
            subject: { kind: "LEAD", leadId },
            bookedBy: "CLIENT",
          });

          if (!writeResult.ok) {
            // Błąd domenowy (POOL_MISMATCH/SUBJECT_ALREADY_BOOKED) — NIE ponawiamy na innym
            // kandydacie (D-3). Rzucenie wewnątrz tx-callbacku wycofuje CAŁĄ transakcję.
            throw new BookingWriteRejected(
              writeResult.error.code,
              writeResult.error.message,
              writeResult.error.alternatives,
            );
          }

          return { booking: writeResult.booking };
        });

        // Sukces — transakcja zatwierdzona, klient+adres+lead+rezerwacja istnieją.
        // 4. Kopia informacyjna w Google Calendar (P-5) — WYŁĄCZNIE PO zatwierdzeniu, POZA
        // transakcją, best-effort; awaria integracji nie przerywa flow klienta.
        try {
          const calendarResult = await createCalendarEvent(
            input.name,
            input.phone,
            input.address,
            txResult.booking.scheduledStart,
            txResult.booking.scheduledEnd,
          );
          if (!calendarResult.success) {
            console.warn("Rezerwacja zapisana, ale wystąpił błąd z Google Calendar:", calendarResult.error);
          }
        } catch (calendarErr: unknown) {
          console.warn(
            "Rezerwacja zapisana, ale integracja z Google Calendar rzuciła wyjątek:",
            calendarErr instanceof Error ? calendarErr.message : String(calendarErr),
          );
        }

        return { success: true };
      } catch (err) {
        if (err instanceof BookingWriteRejected) {
          return {
            success: false,
            code: err.code,
            message: err.domainMessage,
            alternatives: err.alternatives,
          };
        }

        if (isRetryableBookingRace(err)) {
          // Ten kandydat przegrał wyścig o zasób (23P01) albo silnik wykrył deadlock
          // (40P01, równoważny w tym kontekście) — następny kandydat, w NOWEJ transakcji.
          continue;
        }

        // Błąd nierozpoznany (w tym kolizje PK na klient/adres/lead) — cała transakcja jest
        // już wycofana przez Prismę; nie ma sensu próbować dalej, propagujemy jako porażkę
        // domenową, nie 500.
        throw err;
      }
    }

    // Wyczerpanie CAŁEJ puli kandydatów na 23P01/40P01 — zero sukcesów, zero śladu (AC5).
    // Alternatywy liczone PO wycofaniu, POZA transakcją; błąd tego (best-effort) obliczenia
    // nie może przykryć wyniku SLOT_TAKEN.
    let alternatives: unknown[] = [];
    try {
      const poolResult = await findPoolSlots(
        prepared.visitBasketId,
        { from: startAtDate, to: new Date(startAtDate.getTime() + ALTERNATIVES_HORIZON_DAYS * MS_PER_DAY) },
        { limit: 5 },
      );
      alternatives = poolResult.slots;
    } catch {
      alternatives = [];
    }

    return {
      success: false,
      code: "SLOT_TAKEN",
      message: "Wszyscy dostępni kandydaci przegrali wyścig o ten termin.",
      alternatives,
    };
  } catch (err: any) {
    console.error("saveLead Error:", err);
    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.",
    };
  }
}
