import { prisma } from "@repo/database"
import { extractSqlState, type BookingRow } from "./create-booking"

/**
 * FLD-BOOKING-ATOMIC-ASSIGN (docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md), Faza B
 * (nadpisanie przypisania przez dyspozytora, `assignment_mode = 'MANUAL'`). Sygnatura i
 * algorytm ustalone w nagłówku `apps/b2b-web/tests/reassign-booking.test.ts` — patrz tam
 * po uzasadnienie. Czysta funkcja domenowa — BEZ `can()`, BEZ sesji (bramka żyje w
 * `reassignBookingAction`, `bookings/actions.ts`).
 */

export type ReassignBookingParams = { bookingId: string; newResourceId: string }

export type ReassignBookingErrorCode =
  | "BOOKING_NOT_FOUND"
  | "ALREADY_RELEASED"
  | "RESOURCE_TAKEN"
  | "POOL_MISMATCH"

export type ReassignBookingResult =
  | { ok: true; booking: BookingRow; error: null }
  | { ok: false; booking: null; error: { code: ReassignBookingErrorCode; message: string } }

const INACTIVE_BOOKING_STATUSES = ["RELEASED", "COMPLETED"]

function fail(code: ReassignBookingErrorCode, message: string): ReassignBookingResult {
  return { ok: false, booking: null, error: { code, message } }
}

export async function reassignBooking(params: ReassignBookingParams): Promise<ReassignBookingResult> {
  const existing = await prisma.booking.findUnique({ where: { id: params.bookingId } })

  if (!existing) {
    return fail("BOOKING_NOT_FOUND", `Rezerwacja o identyfikatorze "${params.bookingId}" nie istnieje.`)
  }

  if (INACTIVE_BOOKING_STATUSES.includes(existing.status)) {
    return fail("ALREADY_RELEASED", "Rezerwacja nie jest już aktywna — przepięcie wykonawcy nie ma zastosowania.")
  }

  const resourceKind = existing.resourceKind
  const data =
    resourceKind === "CREW"
      ? { crewId: params.newResourceId, assignmentMode: "MANUAL" }
      : { auditorId: params.newResourceId, assignmentMode: "MANUAL" }

  try {
    const booking = await prisma.booking.update({ where: { id: params.bookingId }, data })
    return { ok: true, booking: booking as BookingRow, error: null }
  } catch (err) {
    const sqlState = extractSqlState(err)

    if (sqlState === "23P01") {
      return fail("RESOURCE_TAKEN", "Wybrany wykonawca ma już rezerwację nakładającą się na to okno czasowe.")
    }
    if (sqlState === "23514") {
      return fail("POOL_MISMATCH", "Wykonawca nie należy do puli wymaganej przez koszyk wizyty.")
    }

    throw err
  }
}
