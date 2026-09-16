import { STATE_META, type LeadStatus, LOST_REASON_PL, type LostReason } from "@klikklima/contracts"
import type { StatusPillTone } from "@/components/ui/status-pill"

/**
 * Zwraca czytelną, biznesową etykietę dla statusu leada / etapu lejka sprzedaży.
 * Źródłem prawdy jest kontrakt maszyny stanów (@klikklima/contracts).
 */
export function formatLeadStatus(status?: string | null): string {
  if (!status) return "Brak statusu"
  const meta = STATE_META[status as LeadStatus]
  if (meta?.pl) {
    return meta.pl
  }
  // Fallback dla ewentualnych niestandardowych wartości
  return status.replace(/_/g, " ")
}

/**
 * Zwraca ton wizualny (kolorystyczny) dla StatusPill leada.
 * Zgodnie z ADR i ui_ux_guidelines §8.7 zakazane są zielone barwy w kontekście SLA.
 */
export function getLeadStatusTone(status?: string | null): StatusPillTone {
  switch (status) {
    case "NEW_LEAD":
    case "AUDIT_COMPLETED":
    case "HARDWARE_IN_WAREHOUSE":
    case "HARDWARE_IN_TRANSIT":
      return "info"
    case "AWAITING_AUDIT":
    case "AWAITING_CREW_ASSIGNMENT":
    case "AWAITING_INSTALLATION":
      return "warning"
    case "QUOTE_REJECTED":
    case "ROLLBACK_RESCHEDULING":
      return "danger"
    case "INSTALLATION_COMPLETED":
    case "ARCHIVED_LOST":
    default:
      return "neutral"
  }
}

/**
 * Zwraca czytelną, biznesową etykietę dla statusu instalacji (InstallationStatus).
 */
export function formatInstallationStatus(status?: string | null): string {
  switch (status) {
    case "PLANNED":
      return "Zaplanowane"
    case "IN_PROGRESS":
      return "W trakcie montażu"
    case "COMPLETED":
      return "Zakończone"
    case "CANCELLED":
      return "Anulowane"
    default:
      return status ? status.replace(/_/g, " ") : "Brak statusu"
  }
}

/**
 * Zwraca ton wizualny dla StatusPill instalacji.
 */
export function getInstallationStatusTone(status?: string | null): StatusPillTone {
  switch (status) {
    case "PLANNED":
      return "info"
    case "IN_PROGRESS":
      return "warning"
    case "COMPLETED":
      return "neutral"
    case "CANCELLED":
      return "danger"
    default:
      return "neutral"
  }
}

/**
 * Zwraca czytelną, biznesową etykietę dla statusu zgłoszenia usterki (IncidentStatus).
 */
export function formatIncidentStatus(status?: string | null): string {
  switch (status) {
    case "NOWE":
      return "Nowe zgłoszenie"
    case "W_TRAKCIE":
      return "W trakcie realizacji"
    case "OCZEKUJE_NA_CZESCI":
      return "Oczekuje na części"
    case "ZAKONCZONE":
      return "Zakończone"
    case "ANULOWANE":
      return "Anulowane"
    default:
      return status ? status.replace(/_/g, " ") : "Brak statusu"
  }
}

/**
 * Zwraca ton wizualny dla StatusPill usterki.
 */
export function getIncidentStatusTone(status?: string | null): StatusPillTone {
  switch (status) {
    case "NOWE":
      return "warning"
    case "W_TRAKCIE":
      return "info"
    case "OCZEKUJE_NA_CZESCI":
      return "warning"
    case "ZAKONCZONE":
      return "neutral"
    case "ANULOWANE":
      return "danger"
    default:
      return "neutral"
  }
}

/**
 * Zwraca czytelną, biznesową etykietę dla statusu serwisu (ServiceStatus).
 */
export function formatServiceStatus(status?: string | null): string {
  switch (status) {
    case "PLANNED":
      return "Zaplanowany"
    case "SCHEDULED":
      return "Umówiony"
    case "COMPLETED":
      return "Zakończony"
    case "CANCELLED":
      return "Anulowany"
    default:
      return status ? status.replace(/_/g, " ") : "Brak statusu"
  }
}

/**
 * Zwraca czytelną, biznesową etykietę dla statusu wysyłki (ShippingStatus).
 */
export function formatShippingStatus(status?: string | null): string {
  switch (status) {
    case "PENDING":
      return "Oczekuje na nadanie"
    case "SHIPPED":
      return "Wysłano kurierem"
    case "DELIVERED":
      return "Doręczono"
    default:
      return status ? status.replace(/_/g, " ") : "Brak statusu"
  }
}

/**
 * Zwraca czytelną etykietę dla powodu utraty leada ze słownika kontraktowego.
 */
export function formatLostReason(reason?: string | null): string {
  if (!reason) return "Brak danych"
  if (reason in LOST_REASON_PL) {
    return LOST_REASON_PL[reason as LostReason]
  }
  return reason.replace(/_/g, " ")
}

/**
 * Uniwersalny formatujący statusów i kodów — wykrywa typ i zwraca etykietę biznesową.
 * Idealny do filtrów, nagłówków, breadcrumbs i tabel.
 */
export function formatAnyStatus(val?: string | null): string {
  if (!val) return "-"
  if (val in STATE_META) return formatLeadStatus(val)
  if (val in LOST_REASON_PL) return formatLostReason(val)
  switch (val) {
    case "IN_INSTALLATION":
      return "Realizacja i montaż"
    case "PLANNED":
    case "IN_PROGRESS":
    case "COMPLETED":
    case "CANCELLED":
      return formatInstallationStatus(val)
    case "NOWE":
    case "W_TRAKCIE":
    case "OCZEKUJE_NA_CZESCI":
    case "ZAKONCZONE":
    case "ANULOWANE":
      return formatIncidentStatus(val)
    case "SCHEDULED":
      return formatServiceStatus(val)
    case "PENDING":
    case "SHIPPED":
    case "DELIVERED":
      return formatShippingStatus(val)
    default:
      return val.replace(/_/g, " ")
  }
}
