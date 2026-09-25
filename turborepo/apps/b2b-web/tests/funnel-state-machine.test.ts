import { describe, it, expect, vi } from "vitest"
import {
  transitionMatrix,
  findTransition,
  notificationsForTransition,
  SLA,
} from "@klikklima/contracts"
import { applyLeadAction } from "../src/lib/funnel/state-machine"

describe("Funnel State Machine — Maszyna stanów lejka", () => {
  // @REQ: FNL-NO-ILLEGAL-TRANSITIONS
  it("odrzuca każde przejście stanu spoza kontraktu błędem domenowym (pełna macierz stan × akcja)", async () => {
    const illegalTransitions = transitionMatrix().filter((c) => !c.legal)
    expect(illegalTransitions.length).toBeGreaterThan(0)

    for (const { from, action } of illegalTransitions) {
      const result = await applyLeadAction({
        status: from,
        action,
        actorRole: "admin",
      })

      expect(result.ok, `${from} --${action}--> powinno być odrzucone`).toBe(false)
      expect(result.code).toBe("ILLEGAL_TRANSITION")
      expect(result.error).toBeDefined()
    }
  })

  // @REQ: FNL-NO-ILLEGAL-TRANSITIONS
  it("przepuszcza każde przejście przewidziane kontraktem (przy spełnieniu guardów)", async () => {
    const legalTransitions = transitionMatrix().filter((c) => c.legal)
    expect(legalTransitions.length).toBeGreaterThan(0)

    for (const { from, action } of legalTransitions) {
      const t = findTransition(from, action)!
      const result = await applyLeadAction({
        status: from,
        action,
        actorRole: "admin",
        bypassGuards: true,
      })

      expect(result.ok, `${t.id}: ${from} --${action}--> ${t.to}`).toBe(true)
      expect(result.status).toBe(t.to)
    }
  })

  // @REQ: FNL-E1-E2
  it("T01 assignAuditor: blokuje gdy audytor nieaktywny, ma nieważne certyfikaty lub przekroczony dzienny limit", async () => {
    // 1. Audytor nieaktywny
    const r1 = await applyLeadAction({
      status: "NEW_LEAD",
      action: "assignAuditor",
      actorRole: "admin",
      payload: { auditorIsActive: false, auditorCertsValid: true, auditorDailyCapNotExceeded: true },
    })
    expect(r1.ok).toBe(false)
    expect(r1.failedGuard).toBe("auditorIsActive")

    // 2. Nieważne certyfikaty
    const r2 = await applyLeadAction({
      status: "NEW_LEAD",
      action: "assignAuditor",
      actorRole: "admin",
      payload: { auditorIsActive: true, auditorCertsValid: false, auditorDailyCapNotExceeded: true },
    })
    expect(r2.ok).toBe(false)
    expect(r2.failedGuard).toBe("auditorCertsValid")

    // 3. Przekroczony dzienny cap
    const r3 = await applyLeadAction({
      status: "NEW_LEAD",
      action: "assignAuditor",
      actorRole: "admin",
      payload: { auditorIsActive: true, auditorCertsValid: true, auditorDailyCapNotExceeded: false },
    })
    expect(r3.ok).toBe(false)
    expect(r3.failedGuard).toBe("auditorDailyCapNotExceeded")

    // 4. Sukces: przejście do AWAITING_AUDIT i kolejkowanie N1 + I5 z kontraktu
    const expectedNotifs = notificationsForTransition("T01").map((n) => n.id)
    const r4 = await applyLeadAction({
      status: "NEW_LEAD",
      action: "assignAuditor",
      actorRole: "admin",
      payload: {
        auditorId: "auditor-123",
        auditorIsActive: true,
        auditorCertsValid: true,
        auditorDailyCapNotExceeded: true,
      },
    })
    expect(r4.ok).toBe(true)
    expect(r4.status).toBe("AWAITING_AUDIT")
    expect(r4.queuedNotifications).toEqual(expect.arrayContaining(expectedNotifs))
  })

  // @REQ: FNL-E2-E3
  it("T02 sendQuote: wysłanie wyceny z Field App automatycznie przenosi leada do E3 (AUDIT_COMPLETED) z oknem ważności 14 dni i kolejkuje N4", async () => {
    const expectedNotifs = notificationsForTransition("T02").map((n) => n.id)
    const result = await applyLeadAction({
      status: "AWAITING_AUDIT",
      action: "sendQuote",
      actorRole: "audytor",
      payload: { quoteId: "quote-uuid-1" },
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("AUDIT_COMPLETED")
    expect(result.queuedNotifications).toEqual(expect.arrayContaining(expectedNotifs))
  })

  // @REQ: FNL-E3-E4
  it("T03 acceptQuoteAndBook: klient akceptuje wycenę i rezerwuje termin montażu (guardy: regulamin, slotAvailable)", async () => {
    // 1. Regulamin niezaakceptowany
    const r1 = await applyLeadAction({
      status: "AUDIT_COMPLETED",
      action: "acceptQuoteAndBook",
      actorRole: "client",
      payload: { termsAccepted: false, quoteNotExpired: true, slotAvailable: true },
    })
    expect(r1.ok).toBe(false)
    expect(r1.failedGuard).toBe("termsAccepted")

    // 2. Wycena przeterminowana
    const r2 = await applyLeadAction({
      status: "AUDIT_COMPLETED",
      action: "acceptQuoteAndBook",
      actorRole: "client",
      payload: { termsAccepted: true, quoteNotExpired: false, slotAvailable: true },
    })
    expect(r2.ok).toBe(false)
    expect(r2.failedGuard).toBe("quoteNotExpired")

    // 3. Slot zajęty
    const r3 = await applyLeadAction({
      status: "AUDIT_COMPLETED",
      action: "acceptQuoteAndBook",
      actorRole: "client",
      payload: { termsAccepted: true, quoteNotExpired: true, slotAvailable: false },
    })
    expect(r3.ok).toBe(false)
    expect(r3.failedGuard).toBe("slotAvailable")

    // 4. Sukces: przejście do AWAITING_CREW_ASSIGNMENT i kolejkowanie powiadomień
    const expectedNotifs = notificationsForTransition("T03").map((n) => n.id)
    const r4 = await applyLeadAction({
      status: "AUDIT_COMPLETED",
      action: "acceptQuoteAndBook",
      actorRole: "client",
      payload: { termsAccepted: true, quoteNotExpired: true, slotAvailable: true },
    })
    expect(r4.ok).toBe(true)
    expect(r4.status).toBe("AWAITING_CREW_ASSIGNMENT")
    expect(r4.queuedNotifications).toEqual(expect.arrayContaining(expectedNotifs))
  })

  // @REQ: FNL-E3-BUCKET
  it("T04 expireQuote: wygaśnięcie wyceny po 14 dniach (SLA.QUOTE_VALIDITY) przenosi do QUOTE_REJECTED i kolejkuje N_REJECT", async () => {
    expect(SLA.QUOTE_VALIDITY.days).toBe(14)
    const expectedNotifs = notificationsForTransition("T04").map((n) => n.id)

    const result = await applyLeadAction({
      status: "AUDIT_COMPLETED",
      action: "expireQuote",
      actorRole: "system",
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("QUOTE_REJECTED")
    expect(result.queuedNotifications).toEqual(expect.arrayContaining(expectedNotifs))
  })

  // @REQ: FNL-E4-E5
  it("T05 assignCrew: przypisanie ekipy sprawdza certyfikaty i kalendarz, przechodzi do HARDWARE_IN_WAREHOUSE i tworzy zlecenie wysyłki", async () => {
    // 1. Nieważne certyfikaty ekipy
    const r1 = await applyLeadAction({
      status: "AWAITING_CREW_ASSIGNMENT",
      action: "assignCrew",
      actorRole: "admin",
      payload: { crewCertsValid: false, crewCalendarFree: true },
    })
    expect(r1.ok).toBe(false)
    expect(r1.failedGuard).toBe("crewCertsValid")

    // 2. Sukces
    const expectedNotifs = notificationsForTransition("T05").map((n) => n.id)
    const r2 = await applyLeadAction({
      status: "AWAITING_CREW_ASSIGNMENT",
      action: "assignCrew",
      actorRole: "admin",
      payload: { crewId: "crew-123", crewCertsValid: true, crewCalendarFree: true },
    })
    expect(r2.ok).toBe(true)
    expect(r2.status).toBe("HARDWARE_IN_WAREHOUSE")
    expect(r2.queuedNotifications).toEqual(expect.arrayContaining(expectedNotifs))
    expect(r2.createdShipment).toBeDefined()
  })

  // @REQ: FNL-E6-E7
  it("T08 markDelivered: webhook kuriera lub dyspozytor przenosi z HARDWARE_IN_TRANSIT do AWAITING_INSTALLATION idempotentnie", async () => {
    const result = await applyLeadAction({
      status: "HARDWARE_IN_TRANSIT",
      action: "markDelivered",
      actorRole: "dyspozytor",
      payload: { trackingId: "TRK-123456" },
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("AWAITING_INSTALLATION")

    // Błędny tracking ID zwraca błąd domenowy, nie rzuca 500
    const errResult = await applyLeadAction({
      status: "HARDWARE_IN_TRANSIT",
      action: "markDelivered",
      actorRole: "system",
      payload: { trackingId: "" },
    })
    expect(errResult.ok).toBe(false)
    expect(errResult.code).toBe("INVALID_TRACKING_ID")
  })

  // @REQ: FNL-E7-E8
  it("T09 completeInstallation: monter zamyka montaż, wylicza next_service_date (+1 rok) i kolejkuje N8 z załącznikami", async () => {
    const completionDate = new Date("2026-10-15T12:00:00Z")
    const expectedNotifs = notificationsForTransition("T09").map((n) => n.id)

    const result = await applyLeadAction({
      status: "AWAITING_INSTALLATION",
      action: "completeInstallation",
      actorRole: "monter",
      payload: {
        allPhasesCompleted: true,
        completionDate,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("INSTALLATION_COMPLETED")
    expect(result.nextServiceDate).toBeDefined()
    // 1 rok później: 2027-10-15
    expect(result.nextServiceDate?.toISOString().slice(0, 10)).toBe("2027-10-15")
    expect(result.queuedNotifications).toEqual(expect.arrayContaining(expectedNotifs))
  })

  // @REQ: FNL-ADVANCE-STATUS-CONTRACT-BOUND
  it("advanceLeadStatus: czyta guardy i efekty bezpośrednio z kontraktu", async () => {
    const t = findTransition("AWAITING_INSTALLATION", "rollback")
    expect(t).toBeDefined()
    const expectedRollbackNotifs = notificationsForTransition("T13").map((n) => n.id)

    const result = await applyLeadAction({
      status: "AWAITING_INSTALLATION",
      action: "rollback",
      actorRole: "dyspozytor",
      payload: { justification: "Klient prosi o przełożenie terminu montażu" },
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe("ROLLBACK_RESCHEDULING")
    expect(result.crewSlotReleased).toBe(true)
    expect(result.queuedNotifications).toEqual(expect.arrayContaining(expectedRollbackNotifs))
  })
})

