// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const ROOM_SIZE_BAND_IDS = ["UP_TO_20", "FROM_21_TO_25", "FROM_26_TO_35", "OVER_35"] as const;
export type RoomSizeBandId = (typeof ROOM_SIZE_BAND_IDS)[number];

export interface RoomSizeBand { id: RoomSizeBandId; pl: string; minSqm: number | null; maxSqm: number | null; }

/** Progi metrażu. Komponent kreatora renderuje TO, nie własną tablicę literałów. */
export const ROOM_SIZE_BANDS: readonly RoomSizeBand[] = [
  { id: "UP_TO_20", pl: "Do 20 m²", minSqm: null, maxSqm: 20 },
  { id: "FROM_21_TO_25", pl: "21-25 m²", minSqm: 21, maxSqm: 25 },
  { id: "FROM_26_TO_35", pl: "26-35 m²", minSqm: 26, maxSqm: 35 },
  { id: "OVER_35", pl: "Powyżej 35 m²", minSqm: 36, maxSqm: null },
] as const;

export const ROOM_SIZE_BAND_PL: Record<RoomSizeBandId, string> = {
  UP_TO_20: "Do 20 m²",
  FROM_21_TO_25: "21-25 m²",
  FROM_26_TO_35: "26-35 m²",
  OVER_35: "Powyżej 35 m²",
};

/** Pasmo właściwe dla metrażu. Granice są domknięte, null oznacza granicę otwartą. */
export function roomSizeBandForSqm(sqm: number): RoomSizeBandId | undefined {
  return ROOM_SIZE_BANDS.find((b) => (b.minSqm === null || sqm >= b.minSqm) && (b.maxSqm === null || sqm <= b.maxSqm))?.id;
}

export const BUILDING_TYPE_IDS = ["APARTMENT", "HOUSE", "COMMERCIAL"] as const;
export type BuildingTypeId = (typeof BUILDING_TYPE_IDS)[number];
export const BUILDING_TYPE_PL: Record<BuildingTypeId, string> = {
  APARTMENT: "Mieszkanie",
  HOUSE: "Dom",
  COMMERCIAL: "Lokal komercyjny",
};

/**
 * Wartości enuma leads.declared_property_condition (ADR-005 + decyzja 2026-08-19).
 * Deklaracja klienta NIE decyduje o trybie montażu — wiążące jest quotes.installation_type.
 */
export const PROPERTY_CONDITION_IDS = ["FINISHED", "RENOVATION", "DEVELOPER_SHELL"] as const;
export type PropertyConditionId = (typeof PROPERTY_CONDITION_IDS)[number];
export const PROPERTY_CONDITION_PL: Record<PropertyConditionId, string> = {
  FINISHED: "Wykończony / Zamieszkany",
  RENOVATION: "W trakcie remontu",
  DEVELOPER_SHELL: "Stan deweloperski",
};

/**
 * Przesłanka montażu dwuetapowego — informacja DLA AUDYTORA, nie rozstrzygnięcie.
 * Nie wpływa na wycenę prezentowaną w Triage (B2C-PRICE-FROM) i nie ustawia
 * quotes.installation_type — to robi audytor po oględzinach (FNL-2PHASE).
 */
export const PROPERTY_CONDITION_SUGGESTS_TWO_PHASE: Record<PropertyConditionId, boolean> = {
  FINISHED: false,
  RENOVATION: true,
  DEVELOPER_SHELL: true,
};

/** Czy deklaracja klienta jest przesłanką montażu dwuetapowego. Nie licz tego warunkiem w kodzie. */
export function suggestsTwoPhase(condition: PropertyConditionId): boolean {
  return PROPERTY_CONDITION_SUGGESTS_TWO_PHASE[condition];
}

/** Próg liczby pomieszczeń kierujący na ekran Eksperta. Zakaz literału w komponencie. */
export const ROOM_COUNT_EXPERT_THRESHOLD = 4;

export const TRIAGE_FIELD_IDS = ["BUILDING_TYPE", "ROOM_COUNT", "ROOM_SIZE_BAND", "PROPERTY_CONDITION"] as const;
export type TriageFieldId = (typeof TRIAGE_FIELD_IDS)[number];

/** Odpowiedzi kreatora w postaci, w jakiej trafiają do leads.triage_answers. */
export type TriageAnswers = Partial<Record<TriageFieldId, string | number>>;

export const DISQUALIFICATION_RULES = [
  { id: "COMMERCIAL_PROPERTY", field: "BUILDING_TYPE", operator: "EQUALS", value: "COMMERCIAL", outcome: "EXPERT_SCREEN", pl: "Lokal komercyjny wymaga indywidualnej oceny — nie wyceniamy go automatycznie." },
  { id: "ROOM_COUNT_AT_OR_ABOVE_THRESHOLD", field: "ROOM_COUNT", operator: "GTE", value: 4, outcome: "EXPERT_SCREEN", pl: "Od czterech pomieszczeń dobór multisplitu wykracza poza automatyczną konfigurację." },
] as const;
export type DisqualificationRuleId = (typeof DISQUALIFICATION_RULES)[number]['id'];

/** Reguły spełnione dla podanych odpowiedzi. Pusta tablica oznacza, że klient idzie na wycenę. */
export function disqualifyingRules(answers: TriageAnswers): DisqualificationRuleId[] {
  return DISQUALIFICATION_RULES.filter((r) => {
    const v = answers[r.field];
    if (v === undefined || v === null) return false;
    if (r.operator === 'EQUALS') return v === r.value;
    if (r.operator === 'GTE') return typeof v === 'number' && typeof r.value === 'number' && v >= r.value;
    return false;
  }).map((r) => r.id);
}

/** Jedyne źródło prawdy o tym, czy klient trafia na ekran Eksperta zamiast na wycenę. */
export function isExpertScreen(answers: TriageAnswers): boolean {
  return disqualifyingRules(answers).length > 0;
}
