import { prisma } from "@repo/database"
import { formatInTimeZone } from "date-fns-tz"
import { SLA } from "@klikklima/contracts"
import { getEffectiveAvailability } from "./effective-availability"

/**
 * CAL-SLOT-ENGINE (docs/workorders/CAL-SLOT-ENGINE.md). Silnik wolnych terminów — odejmowanie
 * nieobecności, rezerwacji, bufora dojazdu i dziennego limitu wizyt od okna dnia dostarczonego
 * przez `getEffectiveAvailability` (FLD-AVAIL-WEEKLY-RULES). Czysta funkcja, BEZ sprawdzania
 * uprawnień i BEZ zapisu — dokładnie jak `getEffectiveAvailability`.
 *
 * Rozstrzygnięcia Michała 2026-09-10, wpisane do WO jako ostateczne:
 *   D1 = wariant (a): siatka slotów wyprowadzona z długości wizyty i bufora dojazdu. Sloty
 *   startują o godzinie startu okna dnia i powtarzają się co (długość wizyty + bufor), a dodatkowo
 *   startuje slot bezpośrednio po zakończeniu każdej rezerwacji tego pracownika (plus bufor) oraz
 *   po zakończeniu każdej nieobecności (bez bufora — AC-A5), jeśli taki slot mieści się w oknie.
 *   D2 = wariant (a): dzienny limit z kontraktu SLA dotyczy WYŁĄCZNIE puli AUDITOR.
 *
 * `resourceKind` NIE jest parametrem wejściowym — pula wynika z `visit_duration_baskets.pool`
 * dla podanego koszyka (WO, "Proponowana sygnatura").
 */

const TIME_ZONE = "Europe/Warsaw"
const MS_PER_MINUTE = 60000

const ACTIVE_BOOKING_STATUSES = ["RESERVED", "CONFIRMED"]

export type AvailableSlot = {
  start_at: Date
  end_at: Date
  date: string
}

export type ResourceSlots = {
  resource_id: string
  resource_kind: 'AUDITOR' | 'CREW'
  slots: AvailableSlot[]
}

export type AvailableSlotsResult = {
  resources: ResourceSlots[]
  duration_minutes: number
  travel_buffer_minutes: number
  error: string | null
}

type BookingLike = {
  auditorId: string | null
  crewId: string | null
  scheduledStart: Date
  scheduledEnd: Date
  status: string
}

type AbsenceLike = {
  auditorId: string | null
  crewId: string | null
  startsAt: Date
  endsAt: Date
}

function emptyResult(error: string, durationMinutes = 0, travelBufferMinutes = 0): AvailableSlotsResult {
  return { resources: [], duration_minutes: durationMinutes, travel_buffer_minutes: travelBufferMinutes, error }
}

/**
 * AC-E1: fail-CLOSED. Bufor brakujący albo niepoprawny NIE dostaje wartości domyślnej — to
 * odwrotność fail-open z `getEffectiveAvailability` dla braku reguł dostępności, i jest świadomą
 * asymetrią wpisaną do WO.
 */
function parseTravelBufferMinutes(konfiguracja: unknown): number | null {
  if (!konfiguracja || typeof konfiguracja !== 'object') {
    return null
  }
  const value = (konfiguracja as Record<string, unknown>).travel_buffer_minutes
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return value
}

function localDateKey(date: Date): string {
  return formatInTimeZone(date, TIME_ZONE, 'yyyy-MM-dd')
}

function employeeKey(resourceKind: 'AUDITOR' | 'CREW', row: { auditorId: string | null; crewId: string | null }): string | null {
  return resourceKind === 'AUDITOR' ? row.auditorId : row.crewId
}

/**
 * Sloty wolnych terminów dla jednego dnia jednego pracownika: siatka (D1a) filtrowana przez
 * nieobecności, rezerwacje (z buforem dojazdu) i — dla puli AUDITOR — dzienny limit (D2a).
 */
function computeDaySlots(params: {
  dayStartMs: number
  dayEndMs: number
  dateLabel: string
  durationMs: number
  bufferMs: number
  dayBookings: BookingLike[]
  dayAbsences: AbsenceLike[]
  nowMs: number
}): AvailableSlot[] {
  const { dayStartMs, dayEndMs, dateLabel, durationMs, bufferMs, dayBookings, dayAbsences, nowMs } = params
  const step = durationMs + bufferMs

  const candidateStarts = new Set<number>()

  for (let t = dayStartMs; t + durationMs <= dayEndMs; t += step) {
    candidateStarts.add(t)
  }

  for (const booking of dayBookings) {
    // AC-T1: slot domykający zaraz PO rezerwacji (plus bufor).
    const forwardAnchor = booking.scheduledEnd.getTime() + bufferMs
    if (forwardAnchor >= dayStartMs && forwardAnchor + durationMs <= dayEndMs) {
      candidateStarts.add(forwardAnchor)
    }

    // AC-T2: symetrycznie, slot domykający się dokładnie bufor PRZED następną rezerwacją.
    const backwardAnchor = booking.scheduledStart.getTime() - bufferMs - durationMs
    if (backwardAnchor >= dayStartMs && backwardAnchor + durationMs <= dayEndMs) {
      candidateStarts.add(backwardAnchor)
    }
  }

  // AC-A5: bufor NIE jest doliczany wokół nieobecności — anchor bez bufora.
  for (const absence of dayAbsences) {
    const anchor = absence.endsAt.getTime()
    if (anchor >= dayStartMs && anchor + durationMs <= dayEndMs) {
      candidateStarts.add(anchor)
    }
  }

  const slots: AvailableSlot[] = []

  for (const start of Array.from(candidateStarts).sort((a, b) => a - b)) {
    const end = start + durationMs
    if (start < dayStartMs || end > dayEndMs) {
      continue
    }

    // CAL-SLOT-ENGINE-PAST-REJECTION (contracts/requirements.contract.mjs): slot, którego
    // start jest wcześniejszy niż moment bieżący, nie jest oferowany.
    if (start < nowMs) {
      continue
    }

    // AC-A1/AC-A3/AC-A4: przedział domknięty z lewej, otwarty z prawej — styk nie jest kolizją.
    const overlapsAbsence = dayAbsences.some(
      (absence) => start < absence.endsAt.getTime() && end > absence.startsAt.getTime(),
    )
    if (overlapsAbsence) continue

    // AC-B1/AC-B3/AC-B5: analogiczne domknięcie dla rezerwacji.
    const overlapsBooking = dayBookings.some(
      (booking) => start < booking.scheduledEnd.getTime() && end > booking.scheduledStart.getTime(),
    )
    if (overlapsBooking) continue

    // AC-T1: bufor po poprzedniej rezerwacji tej samej osoby (granica: równo bufor dopuszczone).
    const violatesForwardBuffer = dayBookings.some((booking) => {
      const bookingEnd = booking.scheduledEnd.getTime()
      return bookingEnd <= start && start - bookingEnd < bufferMs
    })
    if (violatesForwardBuffer) continue

    // AC-T2: bufor przed następną rezerwacją tej samej osoby.
    const violatesBackwardBuffer = dayBookings.some((booking) => {
      const bookingStart = booking.scheduledStart.getTime()
      return bookingStart >= end && bookingStart - end < bufferMs
    })
    if (violatesBackwardBuffer) continue

    slots.push({ start_at: new Date(start), end_at: new Date(end), date: dateLabel })
  }

  return slots
}

export async function findAvailableSlots(
  visitBasketId: string,
  dateRange: { from: Date; to: Date },
  now: Date = new Date(),
): Promise<AvailableSlotsResult> {
  // AC-E3: zakres odwrócony — kontrolowany błąd, zero pętli.
  if (dateRange.to.getTime() < dateRange.from.getTime()) {
    return emptyResult("Zakres dat jest odwrócony (data końcowa wcześniejsza niż początkowa) — nie można wyliczyć terminów.")
  }

  const basket = await prisma.visitDurationBasket.findUnique({ where: { id: visitBasketId } })

  // AC-D5: koszyk nieistniejący.
  if (!basket) {
    return emptyResult(`Koszyk wizyty o identyfikatorze "${visitBasketId}" nie istnieje.`)
  }

  // AC-D4: koszyk wycofany ze słownika.
  if (!basket.isActive) {
    return emptyResult(`Koszyk wizyty "${basket.code}" jest wycofany ze słownika i nie może być rezerwowany.`)
  }

  const resourceKind: 'AUDITOR' | 'CREW' = basket.pool === 'CREW' ? 'CREW' : 'AUDITOR'
  const durationMinutes = basket.durationMinutes
  const durationMs = durationMinutes * MS_PER_MINUTE

  const configRow = await prisma.system_config.findUnique({
    where: { typ_konfiguracji: 'scheduling_config' },
  })
  const travelBufferMinutes = parseTravelBufferMinutes(configRow?.konfiguracja)

  // AC-E1: brak/niepoprawny bufor dojazdu — fail-CLOSED, bufor 0 NIE jest domyślną wartością.
  if (travelBufferMinutes === null) {
    return emptyResult(
      "Brak poprawnej konfiguracji bufora dojazdu (scheduling_config.travel_buffer_minutes) — nie można bezpiecznie wyliczyć terminów.",
      durationMinutes,
    )
  }
  const bufferMs = travelBufferMinutes * MS_PER_MINUTE

  // AC-P2/AC-P3: pula i kwalifikacja pracowników.
  let candidateEmployeeIds: string[]
  if (resourceKind === 'AUDITOR') {
    const rows = await prisma.audytorzy.findMany()
    candidateEmployeeIds = rows
      .filter((row) => row.is_active && row.leave_status === 'ACTIVE')
      .map((row) => row.id)
  } else {
    const rows = await prisma.zespoly_monterskie.findMany()
    candidateEmployeeIds = rows
      .filter((row) => row.aktywny && row.leave_status === 'ACTIVE')
      .map((row) => row.id)
  }

  // AC-P3(c): brak wiersza deklaracji znaczy dostępny (fail-open); jedno zapytanie na całą pulę.
  const declarations = await prisma.availabilityDeclaration.findMany()
  const declinedEmployeeIds = new Set(
    declarations
      .filter((declaration) => declaration.isAvailable === false)
      .map((declaration) => employeeKey(resourceKind, declaration))
      .filter((id): id is string => id !== null),
  )
  const employeeIds = candidateEmployeeIds.filter((id) => !declinedEmployeeIds.has(id))

  if (employeeIds.length === 0) {
    return { resources: [], duration_minutes: durationMinutes, travel_buffer_minutes: travelBufferMinutes, error: null }
  }

  // AC-P4: jedno zapytanie na całą pulę i cały zakres dat, brak N+1.
  const [allBookings, allAbsences] = await Promise.all([
    prisma.booking.findMany({
      where: resourceKind === 'AUDITOR' ? { auditorId: { in: employeeIds } } : { crewId: { in: employeeIds } },
    }),
    prisma.absence.findMany({
      where: resourceKind === 'AUDITOR' ? { auditorId: { in: employeeIds } } : { crewId: { in: employeeIds } },
    }),
  ])

  // AC-B2/AC-C6: mocki testowe ignorują `where`, filtrowanie odbywa się w kodzie silnika.
  const employeeIdSet = new Set(employeeIds)
  const bookingsByEmployee = new Map<string, BookingLike[]>()
  for (const booking of allBookings) {
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) continue
    const key = employeeKey(resourceKind, booking)
    if (!key || !employeeIdSet.has(key)) continue
    const list = bookingsByEmployee.get(key) ?? []
    list.push(booking)
    bookingsByEmployee.set(key, list)
  }

  const absencesByEmployee = new Map<string, AbsenceLike[]>()
  for (const absence of allAbsences) {
    const key = employeeKey(resourceKind, absence)
    if (!key || !employeeIdSet.has(key)) continue
    const list = absencesByEmployee.get(key) ?? []
    list.push(absence)
    absencesByEmployee.set(key, list)
  }

  let error: string | null = null
  const resources: ResourceSlots[] = []

  for (const employeeId of employeeIds) {
    // Konfiguracja przekazana z góry — bez tego wywołanie w pętli po puli dawałoby N zbędnych
    // zapytań `system_config.findUnique` (WO, "Ryzyka i nieznane" #1, AC-P4).
    const availability = await getEffectiveAvailability(employeeId, resourceKind, dateRange, configRow)

    // AC-E2: błąd materializacji dostępności dla jednego pracownika jest propagowany na szczyt
    // wyniku, a ten konkretny pracownik nie wnosi slotów — nie jest cicho pomijany.
    if (availability.error) {
      error = availability.error
      resources.push({ resource_id: employeeId, resource_kind: resourceKind, slots: [] })
      continue
    }

    const employeeBookings = bookingsByEmployee.get(employeeId) ?? []
    const employeeAbsences = absencesByEmployee.get(employeeId) ?? []

    // AC-C2..AC-C7: dzienny limit wizyt liczony na dobę LOKALNĄ, wyłącznie dla puli AUDITOR.
    const bookingCountByLocalDate = new Map<string, number>()
    if (resourceKind === 'AUDITOR') {
      for (const booking of employeeBookings) {
        const dayKey = localDateKey(booking.scheduledStart)
        bookingCountByLocalDate.set(dayKey, (bookingCountByLocalDate.get(dayKey) ?? 0) + 1)
      }
    }

    const slots: AvailableSlot[] = []

    for (const day of availability.days) {
      if (!day.available || !day.start_at || !day.end_at) continue

      if (resourceKind === 'AUDITOR') {
        const dayBookingCount = bookingCountByLocalDate.get(day.date) ?? 0
        if (dayBookingCount >= SLA.AUDITOR_DAILY_CAP.count) continue
      }

      const dayStartMs = day.start_at.getTime()
      const dayEndMs = day.end_at.getTime()

      const dayBookings = employeeBookings.filter(
        (booking) => booking.scheduledStart.getTime() < dayEndMs && booking.scheduledEnd.getTime() > dayStartMs,
      )
      const dayAbsences = employeeAbsences.filter(
        (absence) => absence.startsAt.getTime() < dayEndMs && absence.endsAt.getTime() > dayStartMs,
      )

      slots.push(
        ...computeDaySlots({
          dayStartMs,
          dayEndMs,
          dateLabel: day.date,
          durationMs,
          bufferMs,
          dayBookings,
          dayAbsences,
          nowMs: now.getTime(),
        }),
      )
    }

    slots.sort((a, b) => a.start_at.getTime() - b.start_at.getTime())
    resources.push({ resource_id: employeeId, resource_kind: resourceKind, slots })
  }

  return {
    resources,
    duration_minutes: durationMinutes,
    travel_buffer_minutes: travelBufferMinutes,
    error,
  }
}
