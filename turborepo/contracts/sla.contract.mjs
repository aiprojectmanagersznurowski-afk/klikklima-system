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

  // ── Progi przestrzenne Field App (rozdział 6 field_app_requirements.md, D4) ──
  // Pułapka nr 5 z CLAUDE.md („wszystkie progi czasowe pochodzą z kontraktu") dotyczy tak samo progów
  // przestrzennych. Jedna jednostka dla obu — metry (decyzja człowieka D-B, 2026-08-21): jeżeli w kontrakcie
  // istnieje wyłącznie `meters`, nie da się pomylić metra z kilometrem ani wprowadzić przeliczania do kodu.
  // Świadomy koszt: literał 3000 czyta się gorzej niż „3 km" — dlatego jednostkę mówi słowami `scope`.
  // Specyfikacja rekomendowała nazwy z sufiksem (_M, _KM); sufiksy odrzucone razem z drugą jednostką.
  { id: 'GEOFENCE_UNLOCK_RADIUS',   scope: 'Promień w metrach od punktu docelowego, w którym Field App odblokowuje rozpoczęcie i zakończenie zlecenia', meters: 20,   req: ['FLD-GEO-UNLOCK'] },
  { id: 'GEOFENCE_EN_ROUTE_RADIUS', scope: 'Promień w metrach (3 km), którego przecięcie w oknie dnia wizyty wyzwala klientowi SMS „w drodze" — N3/N7/N13/N17', meters: 3000, req: ['FLD-GEO-EN-ROUTE'] },

  // ── Próg podatkowy wyceny (D16/D17, rozstrzygnięte 2026-09-23) ──
  // Powierzchnia lokalu rozstrzyga o stawce VAT: mieszkalny do progu — 8%, powyżej progu — 23%,
  // usługowy — zawsze 23%, niezależnie od metrażu. Próg dotyczy MIESZKAŃ I DOMÓW JEDNAKOWO (R21).
  //
  // Dlaczego to mieszka w kontrakcie SLA razem z progami czasowymi i przestrzennymi: to jest próg
  // liczbowy, od którego zależy kwota na fakturze. Literał 300 rozsiany po kodzie oznaczałby,
  // że korekta po rozmowie z księgowym wymaga znalezienia wszystkich miejsc, a jedno przeoczone
  // daje fakturę z inną stawką niż oferta. Nazwa bez sufiksu jednostki (nie `..._M2`) — jednostkę
  // niesie nazwa pola `sqm`, dokładnie tak samo jak `days`, `meters` i `hourOfDay` wyżej;
  // sufiksy w identyfikatorach zostały odrzucone razem z drugą jednostką przy progach przestrzennych.
  //
  // Konsumenci: PRICE-VAT-RATE (stawka na ofercie i fakturze), B2C-PROPERTY-AREA-BAND (granica
  // dwóch kafelków w Triage). Słownik PROPERTY_AREA_BANDS w contracts/triage.contract.mjs celowo
  // NIE powtarza tej liczby — opisuje pasma przez `boundary`, żeby zmiana progu była jedną zmianą.
  { id: 'PROPERTY_AREA_VAT_THRESHOLD', scope: 'Powierzchnia lokalu mieszkalnego w m², do której (włącznie) obowiązuje obniżona stawka VAT na montaż; powyżej — stawka podstawowa', sqm: 300, req: ['PRICE-VAT-RATE', 'B2C-PROPERTY-AREA-BAND'] },
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
