import type { Prisma } from "@repo/database"
import {
  type LeadStatus,
  type LeadAction,
  LEAD_ACTIONS,
  findTransition,
  transitionMatrix,
  SLA,
} from "@klikklima/contracts"

function isLeadAction(action: string): action is LeadAction {
  return (LEAD_ACTIONS as readonly string[]).includes(action)
}

export interface ApplyLeadActionParams {
  leadId?: string
  status: LeadStatus
  action: LeadAction | string
  actorRole: string
  payload?: Record<string, unknown>
  bypassGuards?: boolean
  tx?: Prisma.TransactionClient
}

export interface ApplyLeadActionResult {
  ok: boolean
  code?: string
  error?: string
  status?: LeadStatus
  failedGuard?: string
  crewSlotReleased?: boolean
  queuedNotifications?: string[]
  createdShipment?: unknown
  nextServiceDate?: Date
}

export async function applyLeadAction(params: ApplyLeadActionParams): Promise<ApplyLeadActionResult> {
  const { status, action, payload, bypassGuards } = params

  if (!isLeadAction(action)) {
    return {
      ok: false,
      code: "ILLEGAL_TRANSITION",
      error: `Akcja „${action}” nie istnieje w maszynie stanów kontraktu.`,
    }
  }

  // 1. Sprawdzenie legalności przejścia w kontrakcie maszyny stanów (FNL-NO-ILLEGAL-TRANSITIONS)
  const transition = findTransition(status, action)
  if (!transition) {
    return {
      ok: false,
      code: "ILLEGAL_TRANSITION",
      error: `Przejście ze stanu „${status}” akcją „${action}” nie istnieje w maszynie stanów kontraktu.`,
    }
  }

  // 2. Weryfikacja guardów z kontraktu (chyba że jawny bypass dla testów)
  if (!bypassGuards && transition.guards && transition.guards.length > 0) {
    for (const guard of transition.guards) {
      if (guard === "auditorIsActive") {
        if (payload?.auditorIsActive === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "auditorIsActive", error: "Audytor nie jest aktywny." }
        }
      } else if (guard === "auditorCertsValid") {
        if (payload?.auditorCertsValid === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "auditorCertsValid", error: "Certyfikaty F-Gaz lub SEP audytora są nieważne." }
        }
      } else if (guard === "auditorDailyCapNotExceeded") {
        if (payload?.auditorDailyCapNotExceeded === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "auditorDailyCapNotExceeded", error: "Przekroczono dzienny limit audytów dla audytora." }
        }
      } else if (guard === "quoteNotExpired") {
        if (payload?.quoteNotExpired === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "quoteNotExpired", error: "Wycena utraciła ważność." }
        }
      } else if (guard === "termsAccepted") {
        if (!payload?.termsAccepted) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "termsAccepted", error: "Wymagana akceptacja regulaminu montażu." }
        }
      } else if (guard === "slotAvailable") {
        if (payload?.slotAvailable === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "slotAvailable", error: "Wybrany termin montażu jest już zajęty." }
        }
      } else if (guard === "crewCertsValid") {
        if (payload?.crewCertsValid === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "crewCertsValid", error: "Certyfikaty ekipy montażowej są nieważne w dniu montażu." }
        }
      } else if (guard === "crewCalendarFree") {
        if (payload?.crewCalendarFree === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "crewCalendarFree", error: "Ekipa ma kolizję w kalendarzu." }
        }
      } else if (guard === "trackingIdPresent") {
        if (payload?.trackingIdPresent === false || !payload?.trackingId) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "trackingIdPresent", error: "Brak numeru listu przewozowego." }
        }
      } else if (guard === "allPhasesCompleted") {
        if (payload?.allPhasesCompleted === false) {
          return { ok: false, code: "GUARD_FAILED", failedGuard: "allPhasesCompleted", error: "Nie wszystkie etapy montażu zostały zakończone." }
        }
      }
    }
  }

  // 3. Specjalna walidacja domenowa dla akcji (np. markDelivered walidacja trackingId)
  if (!bypassGuards && action === "markDelivered") {
    const trackingId = payload?.trackingId
    if (!trackingId || typeof trackingId !== "string" || !trackingId.trim()) {
      return {
        ok: false,
        code: "INVALID_TRACKING_ID",
        error: "Nieprawidłowy lub brakujący numer przesyłki kurierskiej.",
      }
    }
  }

  // 4. Kolejkowanie powiadomień wynikających z transition.effects z kontraktu
  const queuedNotifications = (transition.effects || []).filter((e) => !e.startsWith("do:"))

  // 5. Wykonanie efektów domenowych (prefiks `do:`)
  let crewSlotReleased = false
  let createdShipment: unknown = undefined
  let nextServiceDate: Date | undefined = undefined

  for (const effect of transition.effects || []) {
    if (effect === "do:releaseCrewSlot") {
      crewSlotReleased = true
    } else if (effect === "do:createShipmentOrder") {
      createdShipment = {
        status: "CREATED",
        leadId: params.leadId,
        crewId: payload?.crewId,
        createdAt: new Date(),
      }
    } else if (effect === "do:computeNextServiceDate") {
      const baseDate = payload?.completionDate instanceof Date
        ? (payload.completionDate as Date)
        : new Date()
      // next_service_date = data_zakonczenia + 1 rok
      const nextDate = new Date(baseDate.getTime())
      nextDate.setFullYear(nextDate.getFullYear() + 1)
      nextServiceDate = nextDate
    }
  }

  return {
    ok: true,
    status: transition.to,
    queuedNotifications,
    crewSlotReleased,
    createdShipment,
    nextServiceDate,
  }
}
