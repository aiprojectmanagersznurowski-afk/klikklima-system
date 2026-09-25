import { SLA } from "@klikklima/contracts";

/**
 * WO: docs/workorders/FLD-QUOTE-CALC.md — PRICE-VAT-RATE.
 * Rodzaj obiektu i wyliczanie stawki VAT (8% lub 23%).
 *
 * Próg powierzchni pochodzi ZE STAŁEJ W KONTRAKCIE SLA (PROPERTY_AREA_VAT_THRESHOLD).
 * W kodzie aplikacji NIE występuje literał 300.
 */

export type PropertyKind =
  | "RESIDENTIAL_UP_TO_THRESHOLD"
  | "RESIDENTIAL_ABOVE_THRESHOLD"
  | "COMMERCIAL";

export const PROPERTY_KINDS: readonly PropertyKind[] = [
  "RESIDENTIAL_UP_TO_THRESHOLD",
  "RESIDENTIAL_ABOVE_THRESHOLD",
  "COMMERCIAL",
] as const;

/**
 * AC-V3 — Wyliczenie stawki VAT na podstawie rodzaju obiektu:
 * - RESIDENTIAL_UP_TO_THRESHOLD -> 8%
 * - RESIDENTIAL_ABOVE_THRESHOLD -> 23%
 * - COMMERCIAL -> 23%
 */
export function resolveVatRate(kind: PropertyKind): 8 | 23 {
  if (kind === "RESIDENTIAL_UP_TO_THRESHOLD") {
    return 8;
  }
  if (kind === "RESIDENTIAL_ABOVE_THRESHOLD" || kind === "COMMERCIAL") {
    return 23;
  }
  throw new Error(`Wymagany rodzaj obiektu: nieznany rodzaj '${String(kind)}'.`);
}

export type TriageAnswersSummary = {
  location?: string | null;
  propertyAreaBand?: string | null;
};

/**
 * AC-V4 — Podpowiedź rodzaju obiektu z odpowiedzi Triage.
 * Wskazanie audytora ma pierwszeństwo i nadpisuje tę podpowiedź.
 */
export function inferPropertyKindFromTriage(
  answers: TriageAnswersSummary | null | undefined
): PropertyKind | null {
  if (!answers || !answers.location) {
    return null;
  }

  const loc = answers.location.trim();

  if (loc === "Lokal komercyjny") {
    return "COMMERCIAL";
  }

  if (loc === "Mieszkanie" || loc === "Dom") {
    if (answers.propertyAreaBand === "UP_TO_300") {
      return "RESIDENTIAL_UP_TO_THRESHOLD";
    }
    if (answers.propertyAreaBand === "ABOVE_300") {
      return "RESIDENTIAL_ABOVE_THRESHOLD";
    }
    return null;
  }

  return null;
}

/**
 * AC-V6 — Etykiety rodzajów obiektów dla formularza audytora i wyceny.
 * Próg powierzchni pobierany jest dynamicznie ze stałej SLA w kontrakcie.
 */
export function getPropertyKindLabels(overrideThreshold?: number): Record<PropertyKind, string> {
  const threshold = overrideThreshold ?? SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm;
  return {
    RESIDENTIAL_UP_TO_THRESHOLD: `Lokal mieszkalny do ${threshold} m² (włącznie)`,
    RESIDENTIAL_ABOVE_THRESHOLD: `Lokal mieszkalny powyżej ${threshold} m²`,
    COMMERCIAL: "Lokal komercyjny / usługowy",
  };
}
