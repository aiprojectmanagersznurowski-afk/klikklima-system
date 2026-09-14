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
  | { ok: false; booking: null; error: { code: CreateBookingErrorCode; message: string; alternatives: AvailableSlot[] } }

function fail(
  code: CreateBookingErrorCode,
  message: string,
  alternatives: AvailableSlot[] = [],
): CreateBookingResult {
  return { ok: false, booking: null, error: { code, message, alternatives } }
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
 * R-3: rozpoznanie SQLSTATE z wyjątku Prismy. Dwa plauzybilne kształty (WO, "Ryzyka
 * i nieznane" #3): `PrismaClientKnownRequestError`-podobny z `meta.code` (raw query,
 * P2010) albo błąd bez mapowania z surowym SQLSTATE w treści komunikatu. `P2002` NIE
 * jest poprawnym mapowaniem dla żadnego z ograniczeń tego WO (ani exclusion, ani
 * unique-na-kolumnie-generowanej) — nie sprawdzamy go.
 */
export function extractSqlState(err: unknown): string | null {
  if (err && typeof err === "object") {
    const meta = (err as { meta?: unknown }).meta
    if (meta && typeof meta === "object") {
      const code = (meta as Record<string, unknown>).code
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
        return code
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

/**
 * AC-A9/AC-A10: alternatywy to `AvailableSlot[]` — CAL-POOL-AGGREGATE, BEZ `resource_id`,
 * klient nie poznaje tożsamości ani obłożenia pracownika. Obcięte do 5 pozycji,
 * zdeduplikowane po momencie startu (wielu pracowników może oferować ten sam start).
 */
async function findAlternatives(params: CreateBookingParams): Promise<AvailableSlot[]> {
  const range = params.alternativesRange ?? {
    from: params.startAt,
    to: new Date(params.startAt.getTime() + DEFAULT_ALTERNATIVES_HORIZON_DAYS * MS_PER_DAY),
  }

  const result = await findPoolSlots(params.visitBasketId, range, { limit: MAX_ALTERNATIVES })
  return result.slots
}

export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const basket = await prisma.visitDurationBasket.findUnique({ where: { id: params.visitBasketId } })

  if (!basket) {
    return fail("BASKET_NOT_FOUND", `Koszyk wizyty o identyfikatorze "${params.visitBasketId}" nie istnieje.`)
  }
  if (!basket.isActive) {
    return fail("BASKET_INACTIVE", `Koszyk wizyty "${basket.code}" jest wycofany ze słownika i nie może być rezerwowany.`)
  }

  const configRow = await prisma.system_config.findUnique({ where: { typ_konfiguracji: "scheduling_config" } })
  const travelBufferMinutes = parseTravelBufferMinutes(configRow?.konfiguracja)
  if (travelBufferMinutes === null) {
    return fail(
      "CONFIG_MISSING",
      "Brak poprawnej konfiguracji bufora dojazdu (scheduling_config.travel_buffer_minutes) — nie można bezpiecznie zarezerwować terminu.",
    )
  }

  const resourceKind: "AUDITOR" | "CREW" = basket.pool === "CREW" ? "CREW" : "AUDITOR"

  const slotsResult = await findAvailableSlots(params.visitBasketId, { from: params.startAt, to: params.startAt })

  const startAtMs = params.startAt.getTime()
  const candidates = slotsResult.resources.filter((resource) =>
    resource.slots.some((slot) => slot.start_at.getTime() === startAtMs),
  )

  if (candidates.length === 0) {
    const alternatives = await findAlternatives(params)
    return fail(
      "SLOT_NOT_OFFERED",
      "Wybrany termin nie jest dostępny — silnik nie oferuje go żadnemu kandydatowi.",
      alternatives,
    )
  }

  const orderedCandidates = await orderCandidates(resourceKind, candidates, params.startAt)
  const scheduledEnd = new Date(startAtMs + basket.durationMinutes * MS_PER_MINUTE)

  for (const candidate of orderedCandidates) {
    const data = {
      ...subjectFields(params.subject),
      resourceKind,
      visitBasketId: params.visitBasketId,
      scheduledStart: params.startAt,
      scheduledEnd,
      status: "RESERVED",
      bookedBy: params.bookedBy,
      assignmentMode: "AUTO",
      auditorId: resourceKind === "AUDITOR" ? candidate.resource_id : null,
      crewId: resourceKind === "CREW" ? candidate.resource_id : null,
    }

    try {
      // eslint-disable-next-line no-await-in-loop -- R-4: KAŻDY INSERT osobno, poza transakcją.
      const booking = await prisma.booking.create({ data })
      return { ok: true, booking: booking as BookingRow, error: null }
    } catch (err) {
      const sqlState = extractSqlState(err)

      if (sqlState === "23514") {
        // Wyzwalacz bookings_pool_matches_basket_trg — pula nie zgadza się z koszykiem.
        return fail("POOL_MISMATCH", "Wykonawca nie należy do puli wymaganej przez koszyk wizyty.")
      }
      if (sqlState === "23505") {
        // D-3: bookings_one_active_per_subject — podmiot ma już aktywną rezerwację.
        // PRZERWIJ pętlę: próba na innym kandydacie skończy się identycznie.
        return fail("SUBJECT_ALREADY_BOOKED", "Ten podmiot (lead/serwis/usterka) ma już aktywną rezerwację.")
      }
      if (sqlState === "23P01") {
        // bookings_no_overlap_per_resource — ten kandydat przegrał wyścig, następny.
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
