import { TRANSITIONS, type LeadStatus, type LeadTransition } from "@klikklima/contracts";

/**
 * SEC-AUDIT-LOG-MANUAL-STATUS (Fala C) — `findTransition` z `@klikklima/contracts`
 * szuka po (`from`, `action`), nie po (`from`, `to`). `advanceLeadStatus` nie zna
 * `action`, tylko `targetStatus` — stąd ten wariant wyszukiwania po (`from`, `to`)
 * wprost w `TRANSITIONS`. Brak dopasowania to legalny wynik (K2 — przejście, którego
 * kontrakt nie zna), obsługiwany przez wołającego jako twarda odmowa, NIE throw.
 */
export function findTransitionByFromTo(from: LeadStatus, to: LeadStatus): LeadTransition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}
