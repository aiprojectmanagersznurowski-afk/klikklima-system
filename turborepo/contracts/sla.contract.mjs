/**
 * KONTRAKT: Polityki SLA i progi czasowe.
 * Źródła: b2b_app_requirements.md (Epic 2), b2b_crm_specifications.md (§3, §4, §5, §6, §7), ui_ux_guidelines.md (§6)
 *
 * Każdy próg ma NAZWĘ. Zakaz literałów liczbowych w kodzie — agent musi importować z kontraktu.
 * To jest to, co ratuje Cię przed „48h w jednym module i 3 dni w drugim, oba nazwane SLA".
 */

export const SLA_POLICIES = [
  {
    id: 'LOGISTICS_INSTALL',
    scope: 'Logistyka — wiersze tabeli wysyłek względem daty montażu',
    metric: 'daysUntilInstallation',
    bands: [
      { id: 'CRITICAL', maxDays: 3,  color: 'destructive', ui: 'border-l-4 border-destructive bg-destructive/5' },
      { id: 'URGENT',   maxDays: 7,  color: 'amber',       ui: 'border-l-4 border-amber-500 bg-amber-500/5' },
      { id: 'NORMAL',   maxDays: null, color: 'none',      ui: '' },
    ],
    forbidGreenBands: true,
    req: ['SLA-LOG-COLORS', 'UI-SLA-NO-GREEN'],
  },
  {
    id: 'INCIDENT_RESPONSE',
    scope: 'Usterki — brak akcji od zgłoszenia',
    metric: 'hoursSinceCreated',
    bands: [
      { id: 'BREACHED', maxHours: null, afterHours: 48, color: 'destructive', appliesToPriorities: ['CRITICAL', 'MEDIUM'] },
    ],
    req: ['CRM-UST-AC3'],
  },
  { id: 'QUOTE_VALIDITY',        scope: 'Ważność wyceny przed zrzuceniem do bucketu Zimnych leadów', days: 14, req: ['SLA-QUOTE-14D'] },
  { id: 'COLD_LEAD_REPRICE',     scope: 'Po tylu dniach w bucketcie „Zwróć do obiegu" wymaga odświeżenia ceny', days: 30, req: ['CRM-ZIMNE-AC2'] },
  { id: 'SERVICE_REMINDER_LEAD', scope: 'Ile dni przed next_service_date wysyłamy N10', days: 30, req: ['CRM-SRV-TRIGGER'] },
  { id: 'CERT_EXPIRY_WARNING',   scope: 'Ile dni przed wygaśnięciem F-Gaz/SEP alarmujemy administratora', days: 30, req: ['CRM-AUDYT-AC3', 'CRM-ZESP-AC1'] },
  { id: 'AUDITOR_DAILY_CAP',     scope: 'Maksymalna liczba audytów przypisanych jednemu audytorowi na dzień', count: 5, req: ['CRM-AUDYT-AC2'] },
  { id: 'INSTALL_DAY_ALERT',     scope: 'Godzina, po której niezakończona dzisiejsza instalacja podświetla się na pomarańczowo', hourOfDay: 16, req: ['CRM-INST-AC2'] },
];

/**
 * Priorytety usterek — jedyne dopuszczalne wartości (ADR-002).
 * Trzymane tutaj, bo to SLA decyduje, których priorytetów dotyczy zegar reakcji.
 */
export const INCIDENT_PRIORITIES = ['LOW', 'MEDIUM', 'CRITICAL'];

/**
 * Reguła zabroniona globalnie: zielone podświetlenia SLA.
 * Hook .claude/hooks/guard-forbidden.mjs egzekwuje to na poziomie zapisu pliku.
 */
export const UI_SLA_FORBIDDEN_CLASSES = ['bg-green', 'border-green', 'text-green', 'bg-emerald', 'border-emerald'];
