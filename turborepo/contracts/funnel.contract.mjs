/**
 * KONTRAKT: Maszyna stanów lejka sprzedażowo-montażowego.
 *
 * TO JEST ŹRÓDŁO PRAWDY. Nie edytuj generowanych plików TS.
 * Źródło biznesowe: docs/architecture/b2b_funnel_process.md, b2b_app_requirements.md (Epic 1)
 *
 * Po każdej zmianie:  node tools/kk-validate.mjs && node tools/kk-codegen.mjs
 *
 * status: 'STABLE'   — zatwierdzone, agenci implementują
 *         'PROPOSED' — luka wykryta w dokumentach, CZEKA NA DECYZJĘ CZŁOWIEKA (patrz docs/01-ADR-spec-conflicts.md)
 */

export const ACTORS = ['CLIENT', 'DISPATCHER', 'ADMIN', 'AUDITOR', 'INSTALLER', 'SYSTEM'];

export const TRIGGER_TYPES = ['MANUAL', 'AUTO_TRANSITION', 'CRON', 'WEBHOOK', 'CLIENT_ACTION'];

/** 8 etapów głównych + buckety. Kolejność `n` = kolejność w UI (dropdown filtra etapu). */
export const STATES = [
  { id: 'NEW_LEAD',                 n: 1,    kind: 'STAGE',  pl: 'Nowy lead',                       status: 'STABLE' },
  { id: 'AWAITING_AUDIT',           n: 2,    kind: 'STAGE',  pl: 'Oczekiwanie na audyt',            status: 'STABLE' },
  { id: 'AUDIT_COMPLETED',          n: 3,    kind: 'STAGE',  pl: 'Wykonany audyt',                  status: 'STABLE' },
  { id: 'AWAITING_CREW_ASSIGNMENT', n: 4,    kind: 'STAGE',  pl: 'Oczekuje na przydzielenie ekipy', status: 'STABLE' },
  { id: 'HARDWARE_IN_WAREHOUSE',    n: 5,    kind: 'STAGE',  pl: 'Wysyłka sprzętu (hurtownia)',     status: 'STABLE' },
  { id: 'HARDWARE_IN_TRANSIT',      n: 6,    kind: 'STAGE',  pl: 'Wysyłka w drodze (kurier)',       status: 'STABLE' },
  { id: 'AWAITING_INSTALLATION',    n: 7,    kind: 'STAGE',  pl: 'Oczekuje instalacji',             status: 'STABLE' },
  { id: 'INSTALLATION_COMPLETED',   n: 8,    kind: 'STAGE',  pl: 'Instalacja zakończona',           status: 'STABLE', terminal: true },

  { id: 'QUOTE_REJECTED',           n: 101,  kind: 'BUCKET', pl: 'Wyceny odrzucone (Zimne leady)',  status: 'STABLE' },
  { id: 'ROLLBACK_RESCHEDULING',    n: 102,  kind: 'BUCKET', pl: 'Anulowane / Do przełożenia',      status: 'STABLE' },

  // LUKA: CRM (widok 7) wymaga akcji „Archiwizuj trwale (Lost)" z obowiązkowym `lost_reason`,
  // ale enum LeadStatus w b2b_app_requirements.md ma tylko 8+2 wartości. Patrz ADR-004.
  { id: 'ARCHIVED_LOST',            n: 103,  kind: 'BUCKET', pl: 'Zarchiwizowany (Lost)',           status: 'STABLE',   terminal: true },
];

/**
 * Rejestr guardów. Każdy `guard` w TRANSITIONS musi tu istnieć, a implementacja
 * musi znaleźć się w packages/contracts/src/guards/<id>.ts (sprawdza kk-trace).
 */
export const GUARDS = [
  { id: 'auditorIsActive',            desc: 'Audytor ma status Aktywny (nie urlop/zwolnienie).' },
  { id: 'auditorCertsValid',          desc: 'F-Gaz i SEP audytora ważne w dniu wizyty.' },
  { id: 'auditorDailyCapNotExceeded', desc: 'Audytor nie przekroczył dziennego limitu audytów (SLA.AUDITOR_DAILY_CAP).' },
  { id: 'quoteNotExpired',            desc: 'Wycena w oknie ważności (SLA.QUOTE_VALIDITY_DAYS).' },
  { id: 'termsAccepted',              desc: 'Klient zaakceptował regulamin (wymóg E3→E4).' },
  { id: 'slotAvailable',              desc: 'Wybrany termin montażu wolny w kalendarzu.' },
  { id: 'crewCertsValid',             desc: 'F-Gaz i SEP zespołu ważne w dniu montażu — inaczej ekipa ukryta w E4.' },
  { id: 'crewCalendarFree',           desc: 'Zespół nie ma kolizji w kalendarzu.' },
  { id: 'trackingIdPresent',          desc: 'Podano numer listu przewozowego przy wysyłce kurierem.' },
  // D2 (2026-08-20): guard sprawdza WARUNEK KOŃCOWY, nie blokuje wejścia do dialogu.
  // Wycena świeższa niż próg — przechodzi bez pytania. Wycena przeterminowana — przechodzi
  // WYŁĄCZNIE po jednej z dwóch jawnych decyzji z `resolutions`. Brak decyzji = odmowa.
  // Wiek wyceny liczony od leads.quoted_at (D3), nie od wejścia do bucketu.
  { id: 'quoteRefreshedIfStale',      desc: 'Wycena starsza niż SLA.COLD_LEAD_REPRICE_DAYS przechodzi wyłącznie po jawnej decyzji: potwierdzenie starej ceny albo jej odświeżenie.',
    resolutions: ['acknowledgeStaleQuote', 'refreshQuote'],
    note: 'Obie ścieżki są legalne i obie restartują okno ważności wyceny (do:refreshQuoteValidity) — różnią się tym, czy zmieniła się kwota. Odstępstwo od pierwotnego brzmienia CRM-ZIMNE-AC2, zatwierdzone przez człowieka jako D2 w WO CRM-SAFE-RECORD-ACTIONS.' },
  { id: 'lostReasonProvided',         desc: 'Podano powód utraty (zasila moduł analityczny).' },
  { id: 'installationIsTwoPhase',     desc: 'Wycena oznaczona przez audytora jako TWO_PHASE (mieszkanie w stanie deweloperskim).' },
  { id: 'phaseOneNotCompleted',       desc: 'Etap I nie jest jeszcze zamknięty — chroni przed dwukrotnym zamknięciem tego samego etapu.' },
  { id: 'allPhasesCompleted',         desc: 'Wszystkie etapy montażu zamknięte. Dla TWO_PHASE oznacza etap II, dla SINGLE_PHASE jedyny etap.' },
];

/**
 * `effects` to identyfikatory z notifications.contract.mjs ORAZ efekty domenowe (prefiks `do:`).
 * Efekt domenowy = obowiązkowa zmiana stanu poza tabelą leads; test kontraktowy sprawdza jego wystąpienie.
 */
export const TRANSITIONS = [
  {
    id: 'T01', from: 'NEW_LEAD', to: 'AWAITING_AUDIT',
    action: 'assignAuditor', actor: 'ADMIN', trigger: 'MANUAL',
    guards: ['auditorIsActive', 'auditorCertsValid', 'auditorDailyCapNotExceeded'],
    effects: ['N1', 'I5'],
    req: ['FNL-E1-E2'], status: 'STABLE',
  },
  {
    id: 'T02', from: 'AWAITING_AUDIT', to: 'AUDIT_COMPLETED',
    action: 'sendQuote', actor: 'AUDITOR', trigger: 'AUTO_TRANSITION',
    guards: [],
    effects: ['N4', 'do:createQuote', 'do:startQuoteValidityClock'],
    req: ['FNL-E2-E3'], status: 'STABLE',
  },
  {
    id: 'T03', from: 'AUDIT_COMPLETED', to: 'AWAITING_CREW_ASSIGNMENT',
    action: 'acceptQuoteAndBook', actor: 'CLIENT', trigger: 'CLIENT_ACTION',
    guards: ['quoteNotExpired', 'termsAccepted', 'slotAvailable'],
    effects: ['I2', 'do:reserveInstallationSlot'],
    req: ['FNL-E3-E4'], status: 'STABLE',
  },
  {
    id: 'T04', from: 'AUDIT_COMPLETED', to: 'QUOTE_REJECTED',
    action: 'expireQuote', actor: 'SYSTEM', trigger: 'CRON',
    guards: [],
    effects: ['N_REJECT', 'do:stampBucketEnteredAt'],
    req: ['FNL-E3-BUCKET', 'SLA-QUOTE-14D'], status: 'STABLE',
  },
  {
    id: 'T05', from: 'AWAITING_CREW_ASSIGNMENT', to: 'HARDWARE_IN_WAREHOUSE',
    action: 'assignCrew', actor: 'ADMIN', trigger: 'MANUAL',
    guards: ['crewCertsValid', 'crewCalendarFree'],
    effects: ['I3', 'do:createShipmentOrder'],
    req: ['FNL-E4-E5', 'CRM-ZESP-AC2'], status: 'STABLE',
  },
  {
    id: 'T06', from: 'HARDWARE_IN_WAREHOUSE', to: 'HARDWARE_IN_TRANSIT',
    action: 'shipByCourier', actor: 'DISPATCHER', trigger: 'MANUAL',
    guards: ['trackingIdPresent'],
    effects: ['N5'],
    req: ['FNL-E5-E6'], status: 'STABLE',
  },
  {
    id: 'T07', from: 'HARDWARE_IN_WAREHOUSE', to: 'AWAITING_INSTALLATION',
    action: 'deliverWithCrew', actor: 'DISPATCHER', trigger: 'MANUAL',
    guards: [],
    effects: [],
    req: ['FNL-E5-BYPASS'], status: 'STABLE', note: 'State Bypass — pomija E6.',
  },
  {
    id: 'T08', from: 'HARDWARE_IN_TRANSIT', to: 'AWAITING_INSTALLATION',
    action: 'markDelivered', actor: 'SYSTEM', trigger: 'WEBHOOK',
    guards: [],
    effects: [],
    req: ['FNL-E6-E7'], status: 'STABLE', note: 'Webhook kuriera LUB ręczna akcja dyspozytora (ten sam action).',
  },
  {
    id: 'T09', from: 'AWAITING_INSTALLATION', to: 'INSTALLATION_COMPLETED',
    action: 'completeInstallation', actor: 'INSTALLER', trigger: 'MANUAL',
    guards: ['allPhasesCompleted'],
    effects: ['N8', 'do:computeNextServiceDate', 'do:generateHandoverProtocol'],
    req: ['FNL-E7-E8', 'SRV-NEXT-DATE'], status: 'STABLE',
  },

  // --- Rollback Engine (E4–E7 → bucket) ---
  { id: 'T10', from: 'AWAITING_CREW_ASSIGNMENT', to: 'ROLLBACK_RESCHEDULING', action: 'rollback', actor: 'DISPATCHER', trigger: 'MANUAL', guards: [], effects: ['N_ROLLBACK', 'I4', 'do:releaseCrewSlot', 'do:suspendLogisticsSla'], req: ['FNL-ROLLBACK'], status: 'STABLE' },
  { id: 'T11', from: 'HARDWARE_IN_WAREHOUSE',    to: 'ROLLBACK_RESCHEDULING', action: 'rollback', actor: 'DISPATCHER', trigger: 'MANUAL', guards: [], effects: ['N_ROLLBACK', 'I4', 'do:releaseCrewSlot', 'do:suspendLogisticsSla'], req: ['FNL-ROLLBACK'], status: 'STABLE' },
  { id: 'T12', from: 'HARDWARE_IN_TRANSIT',      to: 'ROLLBACK_RESCHEDULING', action: 'rollback', actor: 'DISPATCHER', trigger: 'MANUAL', guards: [], effects: ['N_ROLLBACK', 'I4', 'do:releaseCrewSlot', 'do:suspendLogisticsSla'], req: ['FNL-ROLLBACK'], status: 'STABLE' },
  { id: 'T13', from: 'AWAITING_INSTALLATION',    to: 'ROLLBACK_RESCHEDULING', action: 'rollback', actor: 'CLIENT',     trigger: 'CLIENT_ACTION', guards: [], effects: ['N_ROLLBACK', 'I4', 'do:releaseCrewSlot', 'do:suspendLogisticsSla'], req: ['FNL-ROLLBACK'], status: 'STABLE' },
  {
    id: 'T14', from: 'ROLLBACK_RESCHEDULING', to: 'AWAITING_CREW_ASSIGNMENT',
    action: 'rebookInstallation', actor: 'CLIENT', trigger: 'CLIENT_ACTION',
    guards: ['slotAvailable'],
    effects: ['do:reserveInstallationSlot'],
    req: ['FNL-ROLLBACK-EXIT'], status: 'STABLE',
  },

  // --- Montaż dwuetapowy (ADR-005, rozstrzygnięte 2026-08-18) ---
  // Pętla własna na E7: po etapie I lead nadal oczekuje instalacji — zmienia się faza, nie etap lejka.
  {
    id: 'T17', from: 'AWAITING_INSTALLATION', to: 'AWAITING_INSTALLATION',
    action: 'completePhaseOne', actor: 'INSTALLER', trigger: 'MANUAL',
    guards: ['installationIsTwoPhase', 'phaseOneNotCompleted'],
    effects: ['N8a', 'do:issuePhaseOneInvoice', 'do:openPhaseTwoBooking'],
    req: ['FNL-2PHASE'], status: 'STABLE',
    note: 'Ekipa zamyka etap I w mieszkaniu deweloperskim. Klient dostaje fakturę za etap I i link do rezerwacji etapu II.',
  },

  // --- Wyjścia z bucketu Zimnych leadów (ADR-004, rozstrzygnięte 2026-08-18) ---
  {
    id: 'T15', from: 'QUOTE_REJECTED', to: 'AUDIT_COMPLETED',
    action: 'returnToFunnel', actor: 'DISPATCHER', trigger: 'MANUAL',
    guards: ['quoteRefreshedIfStale'],
    effects: ['do:refreshQuoteValidity'],
    req: ['CRM-ZIMNE-AC2'], status: 'STABLE', note: 'CRM §7 „Zwróć do obiegu". ADR-004 rozstrzygnięte 2026-08-18 — dopisać do b2b_funnel_process.md przy najbliższej edycji diagramu.',
  },
  {
    id: 'T16', from: 'QUOTE_REJECTED', to: 'ARCHIVED_LOST',
    action: 'archiveLost', actor: 'DISPATCHER', trigger: 'MANUAL',
    guards: ['lostReasonProvided'],
    effects: ['do:recordLostReasonForAnalytics'],
    req: ['CRM-ZIMNE-AC3'], status: 'STABLE', note: 'CRM §7 „Archiwizuj trwale". ADR-004 rozstrzygnięte 2026-08-18. Stan terminalny: wyjście wyłącznie ręczne przez admina, poza maszyną stanów.',
  },
];

/**
 * Słownik zamknięty powodów utraty (ADR-004, wymaganie CRM-ZIMNE-AC3).
 * `b2b_crm_specifications.md` §7 podaje wyłącznie przykłady („Konkurencja", „Za drogo").
 * Lista poniżej została ZATWIERDZONA przez człowieka bez zmian merytorycznych
 * (D5, 2026-08-20, WO CRM-SAFE-RECORD-ACTIONS) — nie jest już propozycją i nie czeka na decyzję.
 * Rozszerzenie lub zawężenie tej listy wymaga osobnego ADR.
 *
 * Pole `lost_reason` przyjmuje WYŁĄCZNIE te wartości — wolny tekst uniemożliwia analitykę,
 * po którą to wymaganie w ogóle powstało. Techniczny znacznik automatu 14-dniowego
 * NIE należy do tego słownika i mieszka w osobnej kolumnie `leads.auto_rejected_reason` (D4),
 * dzięki czemu nie zaśmieca statystyki powodów utraty (AC4.8).
 *
 * `requiresNote: true` oznacza, że wybór tej wartości wymaga niepustej notatki
 * w `leads.lost_reason_note` (D5). Walidację obowiązkowości wykonuje Server Action;
 * kontrakt określa, KTÓRE wartości jej wymagają — nie wolno tego hardkodować w kodzie.
 */
export const LOST_REASONS = [
  { id: 'COMPETITOR',        pl: 'Wybrał konkurencję' },
  { id: 'PRICE_TOO_HIGH',    pl: 'Za drogo' },
  { id: 'POSTPONED',         pl: 'Odłożone w czasie' },
  { id: 'NO_CONTACT',        pl: 'Brak kontaktu z klientem' },
  { id: 'TECHNICAL_BLOCKER', pl: 'Przeszkoda techniczna po stronie obiektu' },
  { id: 'OTHER',             pl: 'Inny (wymaga notatki)', requiresNote: true },
];

export const START_STATE = 'NEW_LEAD';
