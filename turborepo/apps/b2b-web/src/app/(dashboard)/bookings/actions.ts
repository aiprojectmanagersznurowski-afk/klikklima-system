"use server"

import { z } from "zod"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"
import {
  createBooking,
  type CreateBookingResult,
  type CreateBookingErrorCode,
} from "../../../lib/schedule/create-booking"
import {
  reassignBooking,
  type ReassignBookingResult,
  type ReassignBookingErrorCode,
} from "../../../lib/schedule/reassign-booking"

/**
 * FLD-BOOKING-ATOMIC-ASSIGN (docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md), Faza A.
 * Cienka Server Action z bramką — cała logika domenowa żyje w `create-booking.ts`
 * (WO, "Proponowana sygnatura"). Kolejność: rola z sesji -> `can()` -> Zod -> warstwa
 * domenowa. Odmowa PRZED jakimkolwiek zapytaniem do bazy (AC-A12).
 *
 * Prisma omija RLS — to jedyne miejsce, gdzie autoryzacja jest jawnie sprawdzona.
 */

const bookingSubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("LEAD"), leadId: z.string().min(1) }),
  z.object({ kind: z.literal("SERVICE"), serviceId: z.string().min(1) }),
  z.object({ kind: z.literal("INCIDENT"), incidentId: z.string().min(1) }),
])

const createBookingInputSchema = z.object({
  visitBasketId: z.string().min(1),
  startAt: z.coerce.date(),
  subject: bookingSubjectSchema,
  bookedBy: z.enum(["CLIENT", "DISPATCHER"]),
  alternativesRange: z
    .object({ from: z.coerce.date(), to: z.coerce.date() })
    .optional(),
})

function denied(code: CreateBookingErrorCode | "FORBIDDEN" | "VALIDATION_ERROR", message: string): CreateBookingResult {
  return { ok: false, booking: null, error: { code: code as CreateBookingErrorCode, message, alternatives: [] } }
}

export async function createBookingAction(input: unknown): Promise<CreateBookingResult> {
  const actorRole = await getCurrentActorRole()

  if (!actorRole || can(actorRole, "bookings", "create") === "no") {
    return denied("FORBIDDEN", "Brak uprawnień do utworzenia rezerwacji.")
  }

  const parsed = createBookingInputSchema.safeParse(input)
  if (!parsed.success) {
    return denied("VALIDATION_ERROR", "Niepoprawne dane wejściowe rezerwacji.")
  }

  return createBooking(parsed.data)
}

/**
 * Faza B (`docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md`) — nadpisanie przypisania
 * wykonawcy przez dyspozytora. Bramka RBAC: `bookings.assign`, NIE `bookings.update` —
 * to osobna operacja w `contracts/rbac.contract.mjs` (patrz nagłówek testu).
 */

const reassignBookingInputSchema = z.object({
  bookingId: z.string().min(1),
  newResourceId: z.string().min(1),
})

function reassignDenied(code: ReassignBookingErrorCode | "FORBIDDEN" | "VALIDATION_ERROR", message: string): ReassignBookingResult {
  return { ok: false, booking: null, error: { code: code as ReassignBookingErrorCode, message } }
}

export async function reassignBookingAction(input: unknown): Promise<ReassignBookingResult> {
  const actorRole = await getCurrentActorRole()

  if (!actorRole || can(actorRole, "bookings", "assign") === "no") {
    return reassignDenied("FORBIDDEN", "Brak uprawnień do przepięcia wykonawcy rezerwacji.")
  }

  const parsed = reassignBookingInputSchema.safeParse(input)
  if (!parsed.success) {
    return reassignDenied("VALIDATION_ERROR", "Niepoprawne dane wejściowe przepięcia rezerwacji.")
  }

  return reassignBooking(parsed.data)
}
