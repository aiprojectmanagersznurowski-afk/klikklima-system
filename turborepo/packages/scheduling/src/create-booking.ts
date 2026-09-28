import { prisma } from "@repo/database"
import { formatInTimeZone } from "date-fns-tz"
import { findAvailableSlots, type AvailableSlot, type ResourceSlots } from "./available-slots"
import { findPoolSlots } from "./pool-slots"

/**
 * FLD-BOOKING-ATOMIC-ASSIGN (docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md), Faza A
 * (automat, `assignment_mode = 'AUTO'`). Warstwa domenowa: atomowa rezerwacja slotu
 * proponowanego przez `findAvailableSlots` z NATYCHMIASTOWYM przypisaniem wykonawcy.
 * Czysta funkcja — BEZ `can()`, BEZ `revalidatePath`, BEZ sesji — dokładnie jak
 * `findAvailableSlots`. Nie przyjmuje klienta transakcyjnego (R-4: nieudany `INSERT`
 * zatruwa transakcję Prismy, nie ma savepointów — pętla po kandydatach musi działać
 * POZA transakcją).
 *
 * Rozstrzygnięcia Michała 2026-09-10, wpisane do WO jako ostateczne:
 *   D-1 = wariant (a): przy >1 wolnym kandydacie wygrywa NAJMNIEJSZA liczba rezerwacji
 *   w danej dobie LOKALNEJ (Europe/Warsaw), remis rozstrzygany po `id` rosnąco.
 *   D-3 = wariant (b): ograniczenie w bazie (`bookings_one_active_per_subject`,
 *   migracja `20260910110000_fld_booking_one_active_per_subject.sql`). Naruszenie —
 *   SQLSTATE 23505, INNY kod niż 23P01 (`bookings_no_overlap_per_resource`) — MUSI
 *   przerwać pętlę po kandydatach: ponowienie na innym kandydacie nie ma sensu, bo
 *   podmiot już ma aktywną rezerwację niezależnie od tego, KTO ją wykonuje.
 *   D-4 = `createBooking` NIE dotyka `leady.data_rezerwacji`.
 *
 * WO B2C-LEAD-ATOMIC (docs/workorders/B2C-LEAD-ATOMIC.md, P-2, "Transakcja ponawiana per
 * kandydat"): funkcja rozbita na dwie części o wspólnej logice, żeby `saveLead` (B2C) mogła
 * otworzyć WŁASNĄ transakcję per kandydat (klient+adres+lead+rezerwacja) bez duplikowania
 * silnika rezerwacji (B2C-BOOKING-SLOT kryt. 7: "jedna implementacja rezerwacji"):
 *   - `prepareBookingCandidates` — część PRZYGOTOWAWCZA, wyłącznie odczyty (koszyk,
 *     konfiguracja, `findAvailableSlots`, D-1, `preferredResourceId`), BEZ zapisu i BEZ
 *     transakcji.
 *   - `writeBookingCandidate` — część ZAPISUJĄCA, przyjmuje klienta transakcyjnego `tx`,
 *     wykonuje DOKŁADNIE jeden `tx.booking.create`. Łapie 23514 (POOL_MISMATCH) i 23505
 *     (SUBJECT_ALREADY_BOOKED) — kody, które NIE wymagają ponowienia na innym kandydacie.
 *     NIE łapie 23P01/40P01 — oddaje błąd wołającemu, bo po nim (u B2C: cała
 *     `prisma.$transaction`) transakcja i tak jest martwa.
 * `createBooking` (używany przez panel B2B) jest teraz ZŁOŻONY z tych dwóch części na
 * globalnym `prisma` — zachowuje dokładnie dzisiejszy kontrakt zachowania.
 */

const TIME_ZONE = "Europe/Warsaw"
const MS_PER_MINUTE = 60000
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_ALTERNATIVES_HORIZON_DAYS = 14
const MAX_ALTERNATIVES = 5
const ACTIVE_BOOKING_STATUSES = ["RESERVED", "CONFIRMED"]

export type BookingSubject =
  | { kind: "LEAD"; leadId: string }
  | { kind: "SERVICE"; serviceId: string }
  | { kind: "INCIDENT"; incidentId: string }

export type CreateBookingParams = {
  visitBasketId: string
  startAt: Date
  subject: BookingSubject
  bookedBy: "CLIENT" | "DISPATCHER"
  alternativesRange?: { from: Date; to: Date }
  now?: Date
  // FNL-2PHASE-BOOKING kryt. 6 (AC7, WO FNL-2PHASE-BOOKING-MECHANICS): PREFERENCJA,
  // nie warunek. Po `orderCandidates` (reguła D-1, NIETKNIĘTA), kandydat o
  // `resource_id === preferredResourceId` jest przesuwany na start listy WYNIKOWEJ,
  // jeśli w niej istnieje (czyli jest wolny w żądanym terminie) — kolejność D-1
  // pozostałych kandydatów zostaje zachowana. Gdy preferowany kandydat NIE występuje
  // w wyniku D-1 (niedostępny), lista wraca niezmieniona — rezerwacja i tak się udaje.
  preferredResourceId?: string
}

export type CreateBookingErrorCode =
  | "BASKET_NOT_FOUND"
  | "BASKET_INACTIVE"
  | "CONFIG_MISSING"
  | "SLOT_NOT_OFFERED"
  | "SLOT_TAKEN"
  | "POOL_MISMATCH"
  // D-3: 23505 z `bookings_one_active_per_subject` — podmiot ma już aktywną
  // rezerwację (RESERVED/CONFIRMED). Ponowienie na innym kandydacie nie ma sensu.
  | "SUBJECT_ALREADY_BOOKED"

export type BookingRow = {
  id: string
  leadId: string | null
  serviceId: string | null
  incidentId: string | null
  auditorId: string | null
  crewId: string | null
  resourceKind: string
  visitBasketId: string
  scheduledStart: Date
  scheduledEnd: Date
  status: string
  bookedBy: string
  assignmentMode: string
} & Record<string, unknown>

export type CreateBookingResult =
  | { ok: true; booking: BookingRow; error: null }
  | {
      ok: false
      booking: null
      error: {
        code: CreateBookingErrorCode
        message: string
        alternatives: AvailableSlot[]
        // AC6 FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT: przy SUBJECT_ALREADY_BOOKED niesie
        // odesłanie do rezerwacji, z którą podmiot już koliduje. Puste dla innych kodów.
        existingBooking?: BookingRow | null
      }
    }

function fail(
  code: CreateBookingErrorCode,
  message: string,
  alternatives: AvailableSlot[] = [],
  existingBooking?: BookingRow | null,
): CreateBookingResult {
  return {
    ok: false,
    booking: null,
    error: {
      code,
      message,
      alternatives,
      ...(existingBooking !== undefined ? { existingBooking } : {}),
    },
  }
}

/**
 * Duplikat minimalnej logiki z `available-slots.ts` (funkcja tam nie jest eksportowana,
 * a ten plik jest testów `implementer-server` nie wolno modyfikować). AC-E1: fail-CLOSED,
 * bufor 0 NIE jest wartością domyślną.
 */
function parseTravelBufferMinutes(konfiguracja: unknown): number | null {
  if (!konfiguracja || typeof konfiguracja !== "object") {
    return null
  }
  const value = (konfiguracja as Record<string, unknown>).travel_buffer_minutes
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return value
}

function localDateKey(date: Date): string {
  return formatInTimeZone(date, TIME_ZONE, "yyyy-MM-dd")
}

function subjectFields(subject: BookingSubject): { leadId: string | null; serviceId: string | null; incidentId: string | null } {
  switch (subject.kind) {
    case "LEAD":
      return { leadId: subject.leadId, serviceId: null, incidentId: null }
    case "SERVICE":
      return { leadId: null, serviceId: subject.serviceId, incidentId: null }
    case "INCIDENT":
      return { leadId: null, serviceId: null, incidentId: subject.incidentId }
  }
}

/**
 * R-3: rozpoznanie SQLSTATE z wyjątku Prismy. Trzy plauzybilne kształty, potwierdzone
 * na żywym Postgresie: (1) `PrismaClientKnownRequestError` z `code: 'P2002'` dla
 * naruszenia zwykłego indeksu unikalnego/częściowego (np. `bookings_one_active_per_subject`)
 * — mapowane bezwarunkowo na 23505; (2) `PrismaClientKnownRequestError`-podobny z
 * `meta.code` (raw query, P2010); (3) `PrismaClientUnknownRequestError` bez mapowania,
 * z surowym SQLSTATE w treści komunikatu (np. `EXCLUDE`/wyzwalacz, 23P01).
 */
export function extractSqlState(err: unknown): string | null {
  if (err && typeof err === "object") {
    // Prawdziwy `PrismaClientKnownRequestError` dla ZWYKŁEGO indeksu unikalnego
    // (w tym częściowego, np. `bookings_one_active_per_subject`) — Prisma mapuje
    // naruszenie na `code: 'P2002'` z ustrukturyzowanym `meta`, NIE osadza
    // surowego SQLSTATE w treści. P2002 jest bezwarunkowym, bezpośrednim
    // mapowaniem na 23505 (naruszenie unikalności) — zmierzone na żywym
    // Postgresie 2026-09-14/15.
    const code = (err as { code?: unknown }).code
    if (code === "P2002") {
      return "23505"
    }

    const meta = (err as { meta?: unknown }).meta
    if (meta && typeof meta === "object") {
      const metaCode = (meta as Record<string, unknown>).code
      if (typeof metaCode === "string" && /^[0-9A-Z]{5}$/.test(metaCode)) {
        return metaCode
      }
    }
  }
  const message = err instanceof Error ? err.message : String(err)
  const backtickMatch = message.match(/Code:\s*`([0-9A-Z]{5})`/)
  if (backtickMatch) return backtickMatch[1]
  const sqlstateMatch = message.match(/SQLSTATE\s+([0-9A-Z]{5})/)
  if (sqlstateMatch) return sqlstateMatch[1]
  // Prawdziwy `PrismaClientUnknownRequestError` (błąd $queryRaw-mniej znany silnikowi
  // zapytań, np. z EXCLUDE/wyzwalacza) osadza surowy SQLSTATE w treści zagnieżdżonego
  // `PostgresError { code: "23P01", ... }` — zmierzone na żywym Postgresie 2026-09-10.
  // Ten sam wzorzec tekstowy niesie też `code: "40P01"` (deadlock detected) —
  // potwierdzone realnym przebiegiem CI (run 34944442379, PR #1): pod prawdziwą
  // równoczesnością na `EXCLUDE USING gist` silnik detekcji deadlocków bywa szybszy
  // niż walidacja ograniczenia, więc ten sam wyścig o zasób czasem kończy się 40P01
  // zamiast czystym 23P01. Regex ogólny (nie tylko 23P01) — obsługa kodu w
  // `createBooking` decyduje o znaczeniu.
  const postgresErrorCodeMatch = message.match(/code:\s*"([0-9A-Z]{5})"/)
  if (postgresErrorCodeMatch) return postgresErrorCodeMatch[1]
  return null
}

/**
 * D-1: liczba rezerwacji AKTYWNYCH (RESERVED/CONFIRMED) każdego kandydata w dobie
 * LOKALNEJ (Europe/Warsaw) `startAt`. Doba jest tą, w której LĄDUJE nowa rezerwacja —
 * nie dobą UTC (patrz testy zmiany czasu w `create-booking.test.ts`).
 */
async function countActiveBookingsOnLocalDay(
  resourceKind: "AUDITOR" | "CREW",
  employeeIds: string[],
  startAt: Date,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const id of employeeIds) counts.set(id, 0)

  const rows = await prisma.booking.findMany({
    where: resourceKind === "AUDITOR" ? { auditorId: { in: employeeIds } } : { crewId: { in: employeeIds } },
  })

  const targetDayKey = localDateKey(startAt)
  const employeeIdSet = new Set(employeeIds)

  for (const row of rows) {
    if (!ACTIVE_BOOKING_STATUSES.includes(row.status)) continue
    const key = resourceKind === "AUDITOR" ? row.auditorId : row.crewId
    if (!key || !employeeIdSet.has(key)) continue
    if (localDateKey(row.scheduledStart) !== targetDayKey) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

/**
 * Kandydaci uporządkowani regułą D-1: najmniej rezerwacji w dobie lokalnej wygrywa,
 * remis po `resource_id` rosnąco.
 */
async function orderCandidates(
  resourceKind: "AUDITOR" | "CREW",
  candidates: ResourceSlots[],
  startAt: Date,
): Promise<ResourceSlots[]> {
  const counts = await countActiveBookingsOnLocalDay(resourceKind, candidates.map((c) => c.resource_id), startAt)
  return [...candidates].sort((a, b) => {
    const countA = counts.get(a.resource_id) ?? 0
    const countB = counts.get(b.resource_id) ?? 0
    if (countA !== countB) return countA - countB
    if (a.resource_id < b.resource_id) return -1
    if (a.resource_id > b.resource_id) return 1
    return 0
  })
}

type AlternativesParams = {
  visitBasketId: string
  startAt: Date
  alternativesRange?: { from: Date; to: Date }
  now?: Date
}

/**
 * AC-A9/AC-A10: alternatywy to `AvailableSlot[]` — CAL-POOL-AGGREGATE, BEZ `resource_id`,
 * klient nie poznaje tożsamości ani obłożenia pracownika. Obcięte do 5 pozycji,
 * zdeduplikowane po momencie startu (wielu pracowników może oferować ten sam start).
 */
async function findAlternatives(params: AlternativesParams): Promise<AvailableSlot[]> {
  const range = params.alternativesRange ?? {
    from: params.startAt,
    to: new Date(params.startAt.getTime() + DEFAULT_ALTERNATIVES_HORIZON_DAYS * MS_PER_DAY),
  }

  const result = await findPoolSlots(params.visitBasketId, range, { limit: MAX_ALTERNATIVES }, params.now)
  return result.slots
}

export type BookingCandidate = { resource_id: string; resource_kind: "AUDITOR" | "CREW" }

export type PrepareBookingCandidatesParams = {
  visitBasketId: string
  startAt: Date
  now?: Date
  alternativesRange?: { from: Date; to: Date }
  preferredResourceId?: string
}

export type PrepareBookingCandidatesResult =
  | {
      ok: true
      candidates: BookingCandidate[]
      resourceKind: "AUDITOR" | "CREW"
      scheduledEnd: Date
      visitBasketId: string
    }
  | {
      ok: false
      error: {
        code: CreateBookingErrorCode
        message: string
        alternatives: AvailableSlot[]
      }
    }

/**
 * WO B2C-LEAD-ATOMIC, P-2 — część PRZYGOTOWAWCZA: wyłącznie odczyty (koszyk, konfiguracja,
 * `findAvailableSlots`, D-1, `preferredResourceId`). BEZ zapisu, BEZ transakcji. Woła się
 * PRZED otwarciem jakiejkolwiek transakcji przez wołającego (`saveLead`/`createBooking`).
 */
export async function prepareBookingCandidates(
  params: PrepareBookingCandidatesParams,
): Promise<PrepareBookingCandidatesResult> {
  const basket = await prisma.visitDurationBasket.findUnique({ where: { id: params.visitBasketId } })

  if (!basket) {
    return { ok: false, error: { code: "BASKET_NOT_FOUND", message: `Koszyk wizyty o identyfikatorze "${params.visitBasketId}" nie istnieje.`, alternatives: [] } }
  }
  if (!basket.isActive) {
    return {
      ok: false,
      error: {
        code: "BASKET_INACTIVE",
        message: `Koszyk wizyty "${basket.code}" jest wycofany ze słownika i nie może być rezerwowany.`,
        alternatives: [],
      },
    }
  }

  const configRow = await prisma.system_config.findUnique({ where: { typ_konfiguracji: "scheduling_config" } })
  const travelBufferMinutes = parseTravelBufferMinutes(configRow?.konfiguracja)
  if (travelBufferMinutes === null) {
    return {
      ok: false,
      error: {
        code: "CONFIG_MISSING",
        message:
          "Brak poprawnej konfiguracji bufora dojazdu (scheduling_config.travel_buffer_minutes) — nie można bezpiecznie zarezerwować terminu.",
        alternatives: [],
      },
    }
  }

  const resourceKind: "AUDITOR" | "CREW" = basket.pool === "CREW" ? "CREW" : "AUDITOR"

  const slotsResult = await findAvailableSlots(
    params.visitBasketId,
    { from: params.startAt, to: params.startAt },
    params.now,
  )

  const startAtMs = params.startAt.getTime()
  const rawCandidates = slotsResult.resources.filter((resource) =>
    resource.slots.some((slot) => slot.start_at.getTime() === startAtMs),
  )

  if (rawCandidates.length === 0) {
    const alternatives = await findAlternatives(params)
    return {
      ok: false,
      error: {
        code: "SLOT_NOT_OFFERED",
        message: "Wybrany termin nie jest dostępny — silnik nie oferuje go żadnemu kandydatowi.",
        alternatives,
      },
    }
  }

  let orderedCandidates = await orderCandidates(resourceKind, rawCandidates, params.startAt)

  // AC7/kryt. 6: preselekcja, nie filtr. Jeśli kandydat preferowany jest w wyniku D-1
  // (czyli wolny w tym terminie), przesuwamy go na start listy bez zmiany względnej
  // kolejności pozostałych. Jeśli nie jest w wyniku (niedostępny/poza pulą), lista
  // wraca niezmieniona — pętla wołającego i tak spróbuje innych kandydatów.
  if (params.preferredResourceId) {
    const preferredIndex = orderedCandidates.findIndex((c) => c.resource_id === params.preferredResourceId)
    if (preferredIndex > 0) {
      const [preferred] = orderedCandidates.splice(preferredIndex, 1)
      orderedCandidates = [preferred, ...orderedCandidates]
    }
  }

  const scheduledEnd = new Date(startAtMs + basket.durationMinutes * MS_PER_MINUTE)

  const candidates: BookingCandidate[] = orderedCandidates.map((c) => ({
    resource_id: c.resource_id,
    resource_kind: c.resource_kind,
  }))

  return { ok: true, candidates, resourceKind, scheduledEnd, visitBasketId: params.visitBasketId }
}

type BookingCreateClient = { booking: { create: typeof prisma.booking.create; findFirst: typeof prisma.booking.findFirst } }

export type WriteBookingCandidateParams = {
  visitBasketId: string
  scheduledStart: Date
  scheduledEnd: Date
  resourceKind: "AUDITOR" | "CREW"
  candidate: BookingCandidate
  subject: BookingSubject
  bookedBy: "CLIENT" | "DISPATCHER"
}

export type WriteBookingCandidateResult =
  | { ok: true; booking: BookingRow }
  | {
      ok: false
      error: {
        code: "POOL_MISMATCH" | "SUBJECT_ALREADY_BOOKED"
        message: string
        alternatives: AvailableSlot[]
        existingBooking?: BookingRow | null
      }
    }

/**
 * WO B2C-LEAD-ATOMIC, P-2 — część ZAPISUJĄCA: przyjmuje klienta transakcyjnego `tx`
 * (`Prisma.TransactionClient` albo globalny `prisma` — oba mają identyczny kształt
 * `.booking.create`/`.booking.findFirst`). Wykonuje DOKŁADNIE jeden `tx.booking.create`.
 * Łapie 23514 (POOL_MISMATCH) i 23505 (SUBJECT_ALREADY_BOOKED) — te dwa kody NIE wymagają
 * ponowienia na innym kandydacie (R-4, zachowanie 1:1 z dawnym `createBooking`). NIE ŁAPIE
 * 23P01/40P01 — oddaje błąd wołającemu, bo po nim transakcja i tak jest martwa. Błąd
 * nierozpoznany — rzuca dalej (zachowanie 1:1 z dawnym `createBooking`).
 */
export async function writeBookingCandidate(
  tx: BookingCreateClient,
  params: WriteBookingCandidateParams,
): Promise<WriteBookingCandidateResult> {
  const data = {
    ...subjectFields(params.subject),
    resourceKind: params.resourceKind,
    visitBasketId: params.visitBasketId,
    scheduledStart: params.scheduledStart,
    scheduledEnd: params.scheduledEnd,
    status: "RESERVED",
    bookedBy: params.bookedBy,
    assignmentMode: "AUTO",
    auditorId: params.resourceKind === "AUDITOR" ? params.candidate.resource_id : null,
    crewId: params.resourceKind === "CREW" ? params.candidate.resource_id : null,
  }

  try {
    const booking = await tx.booking.create({ data })
    return { ok: true, booking: booking as BookingRow }
  } catch (err) {
    const sqlState = extractSqlState(err)

    if (sqlState === "23514") {
      // Wyzwalacz bookings_pool_matches_basket_trg — pula nie zgadza się z koszykiem.
      return {
        ok: false,
        error: { code: "POOL_MISMATCH", message: "Wykonawca nie należy do puli wymaganej przez koszyk wizyty.", alternatives: [] },
      }
    }
    if (sqlState === "23505") {
      // D-3: bookings_one_active_per_subject — podmiot ma już aktywną rezerwację.
      // AC6: błąd musi nieść odesłanie do rezerwacji, z którą podmiot koliduje. Szukamy
      // po ID podmiotu z `params.subject` (nie przez kolumnę generowaną subject_id — ta
      // jest niewidoczna dla modelu Prisma), więc bez $queryRaw.
      const existingBooking = (await tx.booking.findFirst({
        where: {
          ...subjectFields(params.subject),
          status: { in: ACTIVE_BOOKING_STATUSES },
        },
      })) as BookingRow | null
      return {
        ok: false,
        error: {
          code: "SUBJECT_ALREADY_BOOKED",
          message: "Ten podmiot (lead/serwis/usterka) ma już aktywną rezerwację.",
          alternatives: [],
          existingBooking,
        },
      }
    }

    // 23P01/40P01 (przegrany wyścig/deadlock) i błędy nierozpoznane wydostają się jako
    // wyjątek — to WOŁAJĄCY (pętla po kandydatach, ewentualnie w NOWEJ transakcji)
    // decyduje o ponowieniu na innym kandydacie.
    throw err
  }
}

export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const prepared = await prepareBookingCandidates(params)

  if (!prepared.ok) {
    return fail(prepared.error.code, prepared.error.message, prepared.error.alternatives)
  }

  for (const candidate of prepared.candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop -- R-4: KAŻDY INSERT osobno, poza transakcją.
      const writeResult = await writeBookingCandidate(prisma, {
        visitBasketId: prepared.visitBasketId,
        scheduledStart: params.startAt,
        scheduledEnd: prepared.scheduledEnd,
        resourceKind: prepared.resourceKind,
        candidate,
        subject: params.subject,
        bookedBy: params.bookedBy,
      })

      if (writeResult.ok) {
        return { ok: true, booking: writeResult.booking, error: null }
      }

      // POOL_MISMATCH/SUBJECT_ALREADY_BOOKED — PRZERWIJ pętlę: próba na innym kandydacie
      // skończyłaby się identycznie (D-3).
      return fail(writeResult.error.code, writeResult.error.message, writeResult.error.alternatives, writeResult.error.existingBooking)
    } catch (err) {
      const sqlState = extractSqlState(err)

      if (sqlState === "23P01" || sqlState === "40P01") {
        // bookings_no_overlap_per_resource — ten kandydat przegrał wyścig, następny.
        // 40P01 (deadlock detected) jest RÓWNOWAŻNY 23P01 w tym kontekście — patrz
        // uzasadnienie pełne w poprzedniej wersji tego pliku / historii repo.
        continue
      }

      // Błąd nierozpoznany — nie mamy prawa go przykryć błędem domenowym, który
      // sugerowałby coś nieprawdziwego. Propagacja jako wyjątek (500) jest jedynym
      // uczciwym zachowaniem dla nieznanego kształtu błędu.
      throw err
    }
  }

  // AC-A11: wyczerpanie CAŁEJ puli na 23P01 — zero sukcesów, zero śladu.
  const alternatives = await findAlternatives(params)
  return fail("SLOT_TAKEN", "Wszyscy dostępni kandydaci przegrali wyścig o ten termin.", alternatives)
}
