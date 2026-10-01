import { prisma } from "@repo/database"

/**
 * CRM-ZESP-AC3 / ADR-012: warstwa 2 dostępności — rejestracja absencji ekipy (urlop,
 * zwolnienie lekarskie, awaria pojazdu).
 *
 * Kryteria:
 * 1. Wpis w absences nakładający się na slot usuwa go z widoku klienta (realizowane przez findAvailableSlots)
 * 2. Blokada z reason VEHICLE_FAILURE działa tak samo jak urlop
 * 3. Istniejące bookings w oknie absencji są raportowane dyspozytorowi, a nie kasowane po cichu
 */

export type AbsenceReason = "VACATION" | "SICK_LEAVE" | "VEHICLE_FAILURE" | "OTHER"

export const VALID_ABSENCE_REASONS: readonly AbsenceReason[] = [
  "VACATION",
  "SICK_LEAVE",
  "VEHICLE_FAILURE",
  "OTHER",
] as const

export type CreateCrewAbsenceParams = {
  crewId: string
  startsAt: Date
  endsAt: Date
  reason: AbsenceReason | string
  note?: string | null
  createdBy?: string | null
}

export type ConflictingBookingReport = {
  id: string
  booking_number: string
  scheduledStart: Date
  scheduledEnd: Date
  status: string
  leadId: string | null
  serviceId: string | null
  incidentId: string | null
}

export type CreateCrewAbsenceResult = {
  ok: boolean
  absence?: {
    id: string
    crewId: string | null
    auditorId: string | null
    startsAt: Date
    endsAt: Date
    reason: string
    note: string | null
    createdBy: string | null
    createdAt: Date
  }
  conflictingBookings: ConflictingBookingReport[]
  error?: string
}

export async function createCrewAbsence(
  params: CreateCrewAbsenceParams,
): Promise<CreateCrewAbsenceResult> {
  if (params.endsAt.getTime() <= params.startsAt.getTime()) {
    return {
      ok: false,
      conflictingBookings: [],
      error: "Data zakończenia musi być późniejsza niż data rozpoczęcia.",
    }
  }

  if (!VALID_ABSENCE_REASONS.includes(params.reason as AbsenceReason)) {
    return {
      ok: false,
      conflictingBookings: [],
      error: `Niepoprawny powód absencji: "${params.reason}". Dozwolone wartości: ${VALID_ABSENCE_REASONS.join(", ")}.`,
    }
  }

  // CRM-ZESP-AC3 (Kryterium 3): Istniejące aktywne rezerwacje w oknie czasowym absencji
  // są raportowane dyspozytorowi, a NIE kasowane po cichu (brak booking.delete / deleteMany).
  const conflicting = await prisma.booking.findMany({
    where: {
      crewId: params.crewId,
      status: { in: ["RESERVED", "CONFIRMED"] },
      scheduledStart: { lt: params.endsAt },
      scheduledEnd: { gt: params.startsAt },
    },
    select: {
      id: true,
      booking_number: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
      leadId: true,
      serviceId: true,
      incidentId: true,
    },
    orderBy: { scheduledStart: "asc" },
  })

  try {
    const absence = await prisma.absence.create({
      data: {
        crewId: params.crewId,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        reason: params.reason,
        note: params.note ?? null,
        createdBy: params.createdBy ?? null,
      },
    })

    return {
      ok: true,
      absence,
      conflictingBookings: conflicting,
    }
  } catch (error: unknown) {
    const prismaError = error as { code?: string }
    if (prismaError?.code === "P2003") {
      return {
        ok: false,
        conflictingBookings: [],
        error: `Ekipa monterska o identyfikatorze "${params.crewId}" nie istnieje.`,
      }
    }
    throw error
  }
}
