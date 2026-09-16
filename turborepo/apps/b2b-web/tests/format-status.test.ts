import { describe, it, expect } from "vitest"
import {
  formatLeadStatus,
  getLeadStatusTone,
  formatInstallationStatus,
  getInstallationStatusTone,
  formatIncidentStatus,
  getIncidentStatusTone,
  formatServiceStatus,
  formatShippingStatus,
  formatLostReason,
  formatAnyStatus,
} from "../src/lib/format-status"
import { STATE_META, LOST_REASON_PL } from "@klikklima/contracts"

describe("format-status — Centralne etykiety biznesowe", () => {
  it("formatLeadStatus zwraca intuicyjne polskie nazwy ze STATE_META dla wszystkich statusów", () => {
    expect(formatLeadStatus("AWAITING_AUDIT")).toBe("Oczekiwanie na audyt")
    expect(formatLeadStatus("AWAITING_CREW_ASSIGNMENT")).toBe("Oczekuje na przydzielenie ekipy")
    expect(formatLeadStatus("NEW_LEAD")).toBe("Nowy lead")
    expect(formatLeadStatus("AUDIT_COMPLETED")).toBe("Wykonany audyt")
    expect(formatLeadStatus("HARDWARE_IN_WAREHOUSE")).toBe("Wysyłka sprzętu (hurtownia)")
    expect(formatLeadStatus("HARDWARE_IN_TRANSIT")).toBe("Wysyłka w drodze (kurier)")
    expect(formatLeadStatus("AWAITING_INSTALLATION")).toBe("Oczekuje instalacji")
    expect(formatLeadStatus("INSTALLATION_COMPLETED")).toBe("Instalacja zakończona")
    expect(formatLeadStatus("QUOTE_REJECTED")).toBe(STATE_META.QUOTE_REJECTED.pl)
    expect(formatLeadStatus("ROLLBACK_RESCHEDULING")).toBe("Anulowane / Do przełożenia")
    expect(formatLeadStatus("ARCHIVED_LOST")).toBe("Zarchiwizowany (Lost)")
    expect(formatLeadStatus(null)).toBe("Brak statusu")
  })

  it("getLeadStatusTone nie używa zakazanych zielonych barw dla SLA", () => {
    const statuses = Object.keys(STATE_META)
    for (const st of statuses) {
      const tone = getLeadStatusTone(st)
      expect(["neutral", "info", "warning", "danger"]).toContain(tone)
    }
  })

  it("formatInstallationStatus mapuje stany montażu na czytelne nazwy", () => {
    expect(formatInstallationStatus("PLANNED")).toBe("Zaplanowane")
    expect(formatInstallationStatus("IN_PROGRESS")).toBe("W trakcie montażu")
    expect(formatInstallationStatus("COMPLETED")).toBe("Zakończone")
    expect(formatInstallationStatus("CANCELLED")).toBe("Anulowane")
    expect(getInstallationStatusTone("PLANNED")).toBe("info")
    expect(getInstallationStatusTone("CANCELLED")).toBe("danger")
  })

  it("formatIncidentStatus mapuje stany usterek na czytelne nazwy", () => {
    expect(formatIncidentStatus("NOWE")).toBe("Nowe zgłoszenie")
    expect(formatIncidentStatus("W_TRAKCIE")).toBe("W trakcie realizacji")
    expect(formatIncidentStatus("OCZEKUJE_NA_CZESCI")).toBe("Oczekuje na części")
    expect(formatIncidentStatus("ZAKONCZONE")).toBe("Zakończone")
    expect(formatIncidentStatus("ANULOWANE")).toBe("Anulowane")
    expect(getIncidentStatusTone("NOWE")).toBe("warning")
    expect(getIncidentStatusTone("ANULOWANE")).toBe("danger")
  })

  it("formatServiceStatus i formatShippingStatus formatują statusy serwisu i kuriera", () => {
    expect(formatServiceStatus("PLANNED")).toBe("Zaplanowany")
    expect(formatServiceStatus("SCHEDULED")).toBe("Umówiony")
    expect(formatShippingStatus("SHIPPED")).toBe("Wysłano kurierem")
    expect(formatShippingStatus("DELIVERED")).toBe("Doręczono")
  })

  it("formatLostReason tłumaczy kody odrzuceń ze słownika LOST_REASON_PL", () => {
    expect(formatLostReason("COMPETITOR")).toBe(LOST_REASON_PL.COMPETITOR)
    expect(formatLostReason("PRICE_TOO_HIGH")).toBe(LOST_REASON_PL.PRICE_TOO_HIGH)
    expect(formatLostReason("NO_CONTACT")).toBe(LOST_REASON_PL.NO_CONTACT)
    expect(formatLostReason("TECHNICAL_BLOCKER")).toBe(LOST_REASON_PL.TECHNICAL_BLOCKER)
  })

  it("formatAnyStatus inteligentnie rozpoznaje status i powód", () => {
    expect(formatAnyStatus("AWAITING_AUDIT")).toBe("Oczekiwanie na audyt")
    expect(formatAnyStatus("COMPETITOR")).toBe(LOST_REASON_PL.COMPETITOR)
    expect(formatAnyStatus("PLANNED")).toBe("Zaplanowane")
    expect(formatAnyStatus("NOWE")).toBe("Nowe zgłoszenie")
  })
})
