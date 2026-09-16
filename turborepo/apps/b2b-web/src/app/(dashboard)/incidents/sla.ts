import { SLA } from "@klikklima/contracts"

export type IncidentSlaStatus = {
  hoursElapsed: number;
  slaLimitHours: number;
  isBreached: boolean;
  isPaused: boolean;
  isResolved: boolean;
  label: string;
  uiBadgeClass: string;
};

/**
 * CRM-UST-AC3 / SLA: Wylicza stan SLA (48h na reakcję) dla usterki.
 * Czysta funkcja narzędziowa (wydzielona z actions.ts ze względu na regułę Next.js
 * zabraniającą eksportu funkcji synchronicznych z plików 'use server').
 */
export function calculateIncidentSla(
  createdAt: Date,
  status: string | null,
  priority: string | null,
  referenceDate = new Date()
): IncidentSlaStatus {
  const slaLimitHours = SLA.INCIDENT_RESPONSE.bands[0]?.afterHours ?? 48;
  const isResolved = status === "ZAKONCZONE" || status === "ANULOWANE";
  const isPaused = status === "OCZEKUJE_NA_CZESCI";

  const diffMs = Math.max(0, referenceDate.getTime() - new Date(createdAt).getTime());
  const hoursElapsed = Math.floor(diffMs / (1000 * 60 * 60));

  const isApplicablePriority =
    priority === "KRYTYCZNY" ||
    priority === "WYSOKI" ||
    priority === "ŚREDNI" ||
    priority === "CRITICAL" ||
    priority === "MEDIUM";

  const isBreached = !isResolved && !isPaused && isApplicablePriority && hoursElapsed >= slaLimitHours;

  let label = `${hoursElapsed}h / ${slaLimitHours}h`;
  let uiBadgeClass = "bg-secondary text-secondary-foreground border-border";

  if (isResolved) {
    label = "Rozwiązano";
    uiBadgeClass = "bg-secondary/60 text-muted-foreground border-border/50";
  } else if (isPaused) {
    label = "Wstrzymano (części)";
    uiBadgeClass = "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30";
  } else if (isBreached) {
    label = `Przekroczono SLA (${hoursElapsed}h)`;
    uiBadgeClass = "bg-destructive/15 text-destructive border-destructive/30";
  } else if (hoursElapsed >= slaLimitHours / 2) {
    label = `${hoursElapsed}h / ${slaLimitHours}h (Pilne)`;
    uiBadgeClass = "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30";
  }

  return {
    hoursElapsed,
    slaLimitHours,
    isBreached,
    isPaused,
    isResolved,
    label,
    uiBadgeClass,
  };
}
