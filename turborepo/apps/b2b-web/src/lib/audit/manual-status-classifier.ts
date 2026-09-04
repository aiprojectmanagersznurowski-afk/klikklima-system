import { TRANSITIONS, STATE_META } from "@klikklima/contracts";

/**
 * SEC-AUDIT-LOG-MANUAL-STATUS (AC4) — klasyfikuje przejście lejka jako "ręczną
 * zmianę statusu" wymagającą wpisu audytowego. Kryteria (contracts/funnel.contract.mjs,
 * D3 2026-09-04), sprawdzane WYŁĄCZNIE względem `TRANSITIONS`/`STATE_META` z
 * `@klikklima/contracts` — nigdy jako własna lista nazw akcji powielająca kontrakt:
 *   K1 — actor przejścia ∉ {ADMIN, DISPATCHER} (operatorzy panelu B2B),
 *   K3 — STATE_META[from].kind === 'BUCKET' lub STATE_META[to].kind === 'BUCKET',
 *   K4 — `override === true` na przejściu.
 * Fail-loud: ID spoza kontraktu rzuca błąd — nigdy ciche `false` (ukryłoby operację
 * przed audytem, pułapka fail-open).
 */
export function isManualStatusChange(transitionId: string): boolean {
  const transition = TRANSITIONS.find((t) => t.id === transitionId);
  if (!transition) {
    throw new Error(`Nieznane przejście: "${transitionId}" nie istnieje w kontrakcie TRANSITIONS.`);
  }

  const nonOperatorActor = transition.actor !== "ADMIN" && transition.actor !== "DISPATCHER";
  const bucketEdge =
    STATE_META[transition.from].kind === "BUCKET" || STATE_META[transition.to].kind === "BUCKET";
  const override = transition.override === true;

  return nonOperatorActor || bucketEdge || override;
}
