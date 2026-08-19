// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const SLA = {
  LOGISTICS_INSTALL: {"scope":"Logistyka — wiersze tabeli wysyłek względem daty montażu","metric":"daysUntilInstallation","bands":[{"id":"CRITICAL","maxDays":3,"color":"destructive","ui":"border-l-4 border-destructive bg-destructive/5"},{"id":"URGENT","maxDays":7,"color":"amber","ui":"border-l-4 border-amber-500 bg-amber-500/5"},{"id":"NORMAL","maxDays":null,"color":"none","ui":""}]},
  INCIDENT_RESPONSE: {"scope":"Usterki — brak akcji od zgłoszenia","metric":"hoursSinceCreated","bands":[{"id":"BREACHED","maxHours":null,"afterHours":48,"color":"destructive","appliesToPriorities":["CRITICAL","MEDIUM"]}]},
  QUOTE_VALIDITY: {"days":14,"scope":"Ważność wyceny przed zrzuceniem do bucketu Zimnych leadów"},
  COLD_LEAD_REPRICE: {"days":30,"scope":"Po tylu dniach w bucketcie „Zwróć do obiegu\" wymaga odświeżenia ceny"},
  SERVICE_REMINDER_LEAD: {"days":30,"scope":"Ile dni przed next_service_date wysyłamy N10"},
  CERT_EXPIRY_WARNING: {"days":30,"scope":"Ile dni przed wygaśnięciem F-Gaz/SEP alarmujemy administratora"},
  AUDITOR_DAILY_CAP: {"count":5,"scope":"Maksymalna liczba audytów przypisanych jednemu audytorowi na dzień"},
  INSTALL_DAY_ALERT: {"hourOfDay":16,"scope":"Godzina, po której niezakończona dzisiejsza instalacja podświetla się na pomarańczowo"},
} as const;

export type SlaPolicyId = keyof typeof SLA;

/** Pasmo SLA dla logistyki. Nie licz progów ręcznie w komponencie. */
export function logisticsBand(daysUntilInstallation: number): 'CRITICAL' | 'URGENT' | 'NORMAL' {
  if (daysUntilInstallation < 3) return 'CRITICAL';
  if (daysUntilInstallation <= 7) return 'URGENT';
  return 'NORMAL';
}

export const SLA_ROW_CLASSES: Record<'CRITICAL' | 'URGENT' | 'NORMAL', string> = {
  CRITICAL: "border-l-4 border-destructive bg-destructive/5",
  URGENT: "border-l-4 border-amber-500 bg-amber-500/5",
  NORMAL: "",
};
