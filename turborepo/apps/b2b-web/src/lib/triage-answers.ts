/**
 * `odpowiedzi_triage` to `Json?` w Prisma (kształt kontrolowany przez B2C Triage,
 * nie przez ten panel) — nie mamy generowanego typu, więc opisujemy oczekiwany
 * kształt jawnie zamiast rzutować przez `any`. Wszystkie pola opcjonalne: rekord
 * może pochodzić ze starszej wersji triage lub być pusty.
 */
export interface TriageDeviceUnit {
  brand?: string;
  model_code?: string;
  series_name?: string;
  cooling_capacity_kw?: number | string;
  color?: string;
}

export interface TriageAnswers {
  location?: string;
  buildingState?: string;
  roomCount?: number | string;
  hasBalcony?: boolean;
  floor?: number | null;
  roomSizes?: Record<string, number | string>;
  selectedExternalUnit?: TriageDeviceUnit;
  selectedInternalUnits?: TriageDeviceUnit[];
  selectedDeviceLine?: string;
}
