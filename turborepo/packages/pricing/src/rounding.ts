/**
 * WO: docs/workorders/FLD-QUOTE-CALC.md — AC-C5.
 * Jedna funkcja zaokrąglająca do 2 miejsc po przecinku (do grosza, połówki w górę).
 * Zabezpiecza przed typowymi błędami zmiennoprzecinkowymi w JavaScript.
 */
export function roundToCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
