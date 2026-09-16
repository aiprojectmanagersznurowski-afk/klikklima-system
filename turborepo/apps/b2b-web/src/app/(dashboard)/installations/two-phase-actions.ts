"use server"

import { z } from "zod"
import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can, TRANSITIONS } from "@klikklima/contracts"
import {
  createBooking,
  type CreateBookingResult,
  type CreateBookingErrorCode,
} from "@repo/scheduling"
import { getCurrentActorRole } from "../../../utils/supabase/server"
import { enqueueNotification } from "../logistics/rollback-effects"

/**
 * WO: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md (D1/D2/D3 rozstrzygnięte
 * 2026-09-16). Mechanika rezerwacji montażu dwuetapowego w panelu B2B — WYŁĄCZNIE
 * dyspozytor/administrator (D3). Field App, zdjęcia, protokoły i faktury są poza
 * zakresem w całości.
 *
 * Prisma omija RLS — autoryzacja jest sprawdzona jawnie w obu akcjach, PRZED
 * jakimkolwiek zapytaniem do bazy (pułapka 1 z CLAUDE.md).
 */

const ACTIVE_BOOKING_STATUSES = ["RESERVED", "CONFIRMED"]

function isP2002(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === "P2002")
}

/**
 * completePhaseOneAction — T17 (funnel.contract.mjs), wykonywane przez operatora
 * panelu (manualEquivalent: true, C.4 WO — anuluje K1, ZERO wpisu audit_log, AC4b).
 *
 * Kolejność (nagłówek testu `fnl-2phase-complete-phase-one.test.ts`):
 *  1. rola -> can(rola, 'installations', 'update') — odmowa przed jakimkolwiek zapytaniem.
 *  2. blokada wiersza instalacji (`FOR UPDATE`) — pułapka 4 z CLAUDE.md.
 *  3. guard installationIsTwoPhase.
 *  4. leniwe, idempotentne tworzenie obu wierszy installation_phases (jeśli jeszcze
 *     nie istnieją) — nośnikiem idempotencji jest UNIQUE(installation_id, phase_number),
 *     nie sprawdzenie w JS.
 *  5. guard phaseOneNotCompleted.
 *  6. rezerwacja etapu I (INSTALL_PHASE_1) -> COMPLETED, w TEJ SAMEJ transakcji.
 *  7. installation_phases(phaseNumber=1): completedAt + bookingId.
 *  8. kolejkowanie efektów T17 (filtr `do:`) — identyfikator powiadomienia z kontraktu,
 *     nigdy literał (zakaz adr003-notif-literal).
 */
export async function completePhaseOneAction(
  installationId: string,
): Promise<{ success: boolean; error?: string }> {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>>
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Nie udało się zamknąć etapu I." }
  }
  if (!actorRole || can(actorRole, "installations", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zamknięcia etapu I." }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Pułapka 4 (CLAUDE.md): blokada PRZED odczytem installation_type, serializuje
      // dwa równoległe zamknięcia etapu I na TEJ SAMEJ instalacji (brzeg 3 WO).
      await tx.$queryRaw`SELECT id FROM instalacje WHERE id = ${installationId}::uuid FOR UPDATE`

      const installation = await tx.instalacje.findUnique({ where: { id: installationId } })
      if (!installation || installation.installation_type !== "TWO_PHASE") {
        return { success: false, error: "Instalacja nie jest w trybie dwuetapowym." }
      }

      let phase1 = await tx.installationPhase.findUnique({
        where: { installationId_phaseNumber: { installationId, phaseNumber: 1 } },
      })

      if (!phase1) {
        // Leniwe tworzenie obu wierszy etapów (brzeg 2 WO — współbieżność tworzenia).
        for (const phaseNumber of [1, 2]) {
          try {
            await tx.installationPhase.create({ data: { installationId, phaseNumber } })
          } catch (err) {
            if (!isP2002(err)) throw err
            if (phaseNumber === 1) {
              // Przegrany wyścig tworzenia: inne wywołanie już utworzyło fazę 1 —
              // odczytaj JEJ rzeczywisty stan (mogła już zostać zamknięta).
              phase1 = await tx.installationPhase.findUnique({
                where: { installationId_phaseNumber: { installationId, phaseNumber: 1 } },
              })
            }
          }
        }
      }

      // Guard phaseOneNotCompleted — idempotencja pętli własnej T17 (brzeg 1 WO).
      if (phase1?.completedAt != null) {
        return { success: false, error: "Etap I jest już zamknięty." }
      }

      const phaseOneBooking = await tx.booking.findFirst({
        where: {
          leadId: installation.lead_id,
          status: { in: ACTIVE_BOOKING_STATUSES },
          visitBasket: { code: "INSTALL_PHASE_1" },
        },
      })
      if (!phaseOneBooking) {
        return { success: false, error: "Brak aktywnej rezerwacji etapu I do zamknięcia." }
      }

      // R3: rezerwacja etapu I MUSI zejść z RESERVED/CONFIRMED, inaczej
      // bookings_one_active_per_subject blokuje rezerwację etapu II.
      await tx.booking.update({
        where: { id: phaseOneBooking.id },
        data: { status: "COMPLETED" },
      })

      await tx.installationPhase.update({
        where: { installationId_phaseNumber: { installationId, phaseNumber: 1 } },
        data: { completedAt: new Date(), bookingId: phaseOneBooking.id },
      })

      // AC4b: T17.manualEquivalent === true anuluje K1 — ZERO wpisu audit_log tutaj.
      const t17 = TRANSITIONS.find((t) => t.id === "T17")
      const notificationIds = (t17?.effects ?? []).filter((effect) => !effect.startsWith("do:"))
      for (const notificationId of notificationIds) {
        await enqueueNotification(tx, {
          notificationId,
          idempotencyKey: `phase1:${installationId}`,
          installationId,
          payload: { link: `/installations/${installationId}/book-phase-two` },
        })
      }

      return { success: true }
    })
  } catch (error) {
    console.error("Failed to complete phase one:", error)
    return { success: false, error: "Nie udało się zamknąć etapu I." }
  } finally {
    revalidatePath("/installations")
  }
}

const bookPhaseTwoInputSchema = z.object({
  installationId: z.string().min(1),
  visitBasketId: z.string().min(1),
  // AC5 (WO FNL-2PHASE-BOOKING-MECHANICS): `startAt` przekazany do `createBooking`
  // musi być TOŻSAMOŚCIOWO (===) tym z wejścia — `z.coerce.date()` konstruuje NOWY
  // obiekt `Date` nawet gdy wejście już jest datą, co łamie tę tożsamość. `z.date()`
  // przepuszcza instancję `Date` bez kopiowania.
  startAt: z.date(),
})

export type BookPhaseTwoInput = z.infer<typeof bookPhaseTwoInputSchema>

function bookPhaseTwoDenied(code: CreateBookingErrorCode | "FORBIDDEN" | "VALIDATION_ERROR" | "PHASE_ONE_NOT_COMPLETED", message: string): CreateBookingResult {
  return { ok: false, booking: null, error: { code: code as CreateBookingErrorCode, message, alternatives: [] } }
}

/**
 * bookPhaseTwoAction — rezerwacja etapu II. AC3 (sedno WO): niemożliwa przed
 * zamknięciem etapu I. AC7/kryt. 6: ekipa etapu I jest PRESELEKCJĄ (preferredResourceId),
 * NIE warunkiem — `orderCandidates` w `create-booking.ts` zostaje nietknięte.
 *
 * Nagłówek testu `fnl-2phase-book-phase-two.test.ts` — kolejność:
 *  1. rola -> can(rola, 'bookings', 'create').
 *  2. walidacja Zod.
 *  3. odczyt installation_phases (phaseNumber=1) — brak wiersza albo completedAt
 *     null -> odmowa PHASE_ONE_NOT_COMPLETED, ZERO wywołania createBooking.
 *  4. leadId podmiotu z instalacji (Booking.leadId — bookings nie ma installation_id, R2).
 *  5. preselekcja ekipy etapu I (preferredResourceId), NIE filtr.
 *  6. createBooking(...).
 *  7. na sukces: installation_phases (phaseNumber=2).bookingId = booking.id.
 */
export async function bookPhaseTwoAction(input: unknown): Promise<CreateBookingResult> {
  const actorRole = await getCurrentActorRole()
  if (!actorRole || can(actorRole, "bookings", "create") !== "yes") {
    return bookPhaseTwoDenied("FORBIDDEN", "Brak uprawnień do zarezerwowania etapu II.")
  }

  const parsed = bookPhaseTwoInputSchema.safeParse(input)
  if (!parsed.success) {
    return bookPhaseTwoDenied("VALIDATION_ERROR", "Niepoprawne dane wejściowe rezerwacji etapu II.")
  }
  const { installationId, visitBasketId } = parsed.data
  // AC5: `startAt` przekazany do `createBooking` musi być TOŻSAMOŚCIOWO (===) tym z
  // wejścia — Zod (nawet `z.date()`, bez `coerce`) tworzy przy walidacji NOWĄ
  // instancję `Date`, więc bierzemy wartość z ORYGINALNEGO `input` (już potwierdzoną
  // poprawną przez `parsed.success`), nie z wyniku `safeParse`.
  const startAt = (input as { startAt: Date }).startAt

  // Rzutowanie przez `unknown` (jedyny dozwolony wariant w tym repo — patrz
  // `fnl-2phase-create-booking-preference.test.ts`): pole `installation.leadId` w
  // kontrakcie testu jest camelCase, podczas gdy prawdziwy model Prisma `instalacje`
  // (dług nazewniczy KK-NAMING-BASELINE) eksponuje `lead_id`. Odczyt obu wariantów
  // jest defensywny i nie wymaga dotykania testu.
  type Phase1WithRelations = {
    completedAt: Date | null
    booking: { crewId: string | null } | null
    installation: { leadId?: string; lead_id?: string } | null
  } | null

  const phase1 = (await prisma.installationPhase.findUnique({
    where: { installationId_phaseNumber: { installationId, phaseNumber: 1 } },
    include: { booking: true, installation: true },
  })) as unknown as Phase1WithRelations

  if (!phase1 || phase1.completedAt == null) {
    return bookPhaseTwoDenied(
      "PHASE_ONE_NOT_COMPLETED",
      "Etap I musi być zamknięty przed rezerwacją etapu II.",
    )
  }

  const leadId = phase1.installation?.leadId ?? phase1.installation?.lead_id
  if (!leadId) {
    return bookPhaseTwoDenied("PHASE_ONE_NOT_COMPLETED", "Nie znaleziono leada powiązanego z instalacją.")
  }

  const preferredResourceId = phase1.booking?.crewId ?? undefined

  const result = await createBooking({
    visitBasketId,
    startAt,
    subject: { kind: "LEAD", leadId },
    bookedBy: "DISPATCHER",
    ...(preferredResourceId ? { preferredResourceId } : {}),
  } as unknown as Parameters<typeof createBooking>[0])

  if (result.ok) {
    await prisma.installationPhase.update({
      where: { installationId_phaseNumber: { installationId, phaseNumber: 2 } },
      data: { bookingId: result.booking.id },
    })
  }

  return result
}
