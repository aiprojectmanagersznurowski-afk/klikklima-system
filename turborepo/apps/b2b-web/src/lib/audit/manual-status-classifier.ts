import { TRANSITIONS, STATE_META } from "@klikklima/contracts";

/**
 * SEC-AUDIT-LOG-MANUAL-STATUS (AC4) — klasyfikuje przejście lejka jako "ręczną
 * zmianę statusu" wymagającą wpisu audytowego. Kryteria (contracts/funnel.contract.mjs,
 * D3 2026-09-04), sprawdzane WYŁĄCZNIE względem `TRANSITIONS`/`STATE_META` z
 * `@klikklima/contracts` — nigdy jako własna lista nazw akcji powielająca kontrakt:
 *   K1 — actor przejścia ∉ {ADMIN, DISPATCHER} (operatorzy panelu B2B), chyba że
 *        przejście ma `manualEquivalent === true` — wtedy K1 nie stosuje się do
 *        tego przejścia (decyzja D4, WO SEC-AUDIT-LOG-MANUAL-STATUS: `SYSTEM` jako
 *        actor potwierdza fakt fizyczny, np. T08 `markDelivered`, a nie obchodzi
 *        regułę operatorską, więc samo K1 nie powinno go kwalifikować jako ręczne),
 *   K3 — STATE_META[from].kind === 'BUCKET' lub STATE_META[to].kind === 'BUCKET',
 *   K4 — `override === true` na przejściu.
 * K3 i K4 działają niezależnie od `manualEquivalent` — nie są tym warunkiem objęte.
 * Fail-loud: ID spoza kontraktu rzuca błąd — nigdy ciche `false` (ukryłoby operację
 * przed audytem, pułapka fail-open).
 */
export function isManualStatusChange(transitionId: string): boolean {
  const transition = TRANSITIONS.find((t) => t.id === transitionId);
  if (!transition) {
    throw new Error(`Nieznane przejście: "${transitionId}" nie istnieje w kontrakcie TRANSITIONS.`);
  }

  const nonOperatorActor =
    transition.manualEquivalent !== true &&
    transition.actor !== "ADMIN" && transition.actor !== "DISPATCHER";
  const bucketEdge =
    STATE_META[transition.from].kind === "BUCKET" || STATE_META[transition.to].kind === "BUCKET";
  const override = transition.override === true;

  return nonOperatorActor || bucketEdge || override;
}
