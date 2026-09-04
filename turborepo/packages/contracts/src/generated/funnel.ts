// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: contracts/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez `kk-codegen --check` i odrzucona w CI.

export const LEAD_STAGES = ["NEW_LEAD", "AWAITING_AUDIT", "AUDIT_COMPLETED", "AWAITING_CREW_ASSIGNMENT", "HARDWARE_IN_WAREHOUSE", "HARDWARE_IN_TRANSIT", "AWAITING_INSTALLATION", "INSTALLATION_COMPLETED"] as const;
export const LEAD_BUCKETS = ["QUOTE_REJECTED", "ROLLBACK_RESCHEDULING", "ARCHIVED_LOST"] as const;
export const LEAD_STATUSES = [...LEAD_STAGES, ...LEAD_BUCKETS] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];
export type LeadBucket = (typeof LEAD_BUCKETS)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const START_STATE: LeadStatus = "NEW_LEAD";

export const LOST_REASONS = ["COMPETITOR", "PRICE_TOO_HIGH", "POSTPONED", "NO_CONTACT", "TECHNICAL_BLOCKER", "OTHER"] as const;
export type LostReason = (typeof LOST_REASONS)[number];
export const LOST_REASON_PL: Record<LostReason, string> = {
  COMPETITOR: "Wybrał konkurencję",
  PRICE_TOO_HIGH: "Za drogo",
  POSTPONED: "Odłożone w czasie",
  NO_CONTACT: "Brak kontaktu z klientem",
  TECHNICAL_BLOCKER: "Przeszkoda techniczna po stronie obiektu",
  OTHER: "Inny (wymaga notatki)",
};
/** Archiwizacja bez powodu ze słownika jest odrzucana — guard lostReasonProvided (T16). */
export const isValidLostReason = (v: string): v is LostReason => (LOST_REASONS as readonly string[]).includes(v);

/** Powody wymagające niepustej notatki w leads.lost_reason_note (D5). Nie hardkoduj 'OTHER'. */
export const LOST_REASONS_REQUIRING_NOTE = ["OTHER"] as const;
export const lostReasonRequiresNote = (v: LostReason): boolean =>
  (LOST_REASONS_REQUIRING_NOTE as readonly string[]).includes(v);

export const STATE_META: Record<LeadStatus, { n: number; kind: 'STAGE' | 'BUCKET'; pl: string; terminal: boolean; status: 'STABLE' | 'PROPOSED' }> = {
  NEW_LEAD: { n: 1, kind: "STAGE", pl: "Nowy lead", terminal: false, status: "STABLE" },
  AWAITING_AUDIT: { n: 2, kind: "STAGE", pl: "Oczekiwanie na audyt", terminal: false, status: "STABLE" },
  AUDIT_COMPLETED: { n: 3, kind: "STAGE", pl: "Wykonany audyt", terminal: false, status: "STABLE" },
  AWAITING_CREW_ASSIGNMENT: { n: 4, kind: "STAGE", pl: "Oczekuje na przydzielenie ekipy", terminal: false, status: "STABLE" },
  HARDWARE_IN_WAREHOUSE: { n: 5, kind: "STAGE", pl: "Wysyłka sprzętu (hurtownia)", terminal: false, status: "STABLE" },
  HARDWARE_IN_TRANSIT: { n: 6, kind: "STAGE", pl: "Wysyłka w drodze (kurier)", terminal: false, status: "STABLE" },
  AWAITING_INSTALLATION: { n: 7, kind: "STAGE", pl: "Oczekuje instalacji", terminal: false, status: "STABLE" },
  INSTALLATION_COMPLETED: { n: 8, kind: "STAGE", pl: "Instalacja zakończona", terminal: true, status: "STABLE" },
  QUOTE_REJECTED: { n: 101, kind: "BUCKET", pl: "Wyceny odrzucone (Zimne leady)", terminal: false, status: "STABLE" },
  ROLLBACK_RESCHEDULING: { n: 102, kind: "BUCKET", pl: "Anulowane / Do przełożenia", terminal: false, status: "STABLE" },
  ARCHIVED_LOST: { n: 103, kind: "BUCKET", pl: "Zarchiwizowany (Lost)", terminal: true, status: "STABLE" },
};

export const LEAD_ACTIONS = ["assignAuditor", "sendQuote", "acceptQuoteAndBook", "expireQuote", "assignCrew", "shipByCourier", "deliverWithCrew", "markDelivered", "completeInstallation", "rollback", "rebookInstallation", "completePhaseOne", "returnToFunnel", "archiveLost"] as const;
export type LeadAction = (typeof LEAD_ACTIONS)[number];

export const GUARD_IDS = ["auditorIsActive", "auditorCertsValid", "auditorDailyCapNotExceeded", "quoteNotExpired", "termsAccepted", "slotAvailable", "crewCertsValid", "crewCalendarFree", "trackingIdPresent", "quoteRefreshedIfStale", "lostReasonProvided", "installationIsTwoPhase", "phaseOneNotCompleted", "allPhasesCompleted"] as const;
export type GuardId = (typeof GUARD_IDS)[number];

export interface LeadTransition {
  id: string;
  from: LeadStatus;
  to: LeadStatus;
  action: LeadAction;
  actor: string;
  trigger: string;
  guards: GuardId[];
  effects: string[];
  req: string[];
  status: 'STABLE' | 'PROPOSED';
  /**
   * Przejście jest obejściem reguły procesu, którego nie wykrywa żadne kryterium wyliczalne
   * (aktor / brak przejścia / krawędź bucketu). Klasyfikacja „ręczna zmiana statusu" — patrz
   * contracts/funnel.contract.mjs. Nieobecne dla przejść normalnych.
   */
  override?: true;
}

export const TRANSITIONS: readonly LeadTransition[] = [
  { id: "T01", from: "NEW_LEAD", to: "AWAITING_AUDIT", action: "assignAuditor", actor: "ADMIN", trigger: "MANUAL", guards: ["auditorIsActive","auditorCertsValid","auditorDailyCapNotExceeded"], effects: ["N1","I5"], req: ["FNL-E1-E2"], status: "STABLE" },
  { id: "T02", from: "AWAITING_AUDIT", to: "AUDIT_COMPLETED", action: "sendQuote", actor: "AUDITOR", trigger: "AUTO_TRANSITION", guards: [], effects: ["N4","do:createQuote","do:startQuoteValidityClock"], req: ["FNL-E2-E3"], status: "STABLE" },
  { id: "T03", from: "AUDIT_COMPLETED", to: "AWAITING_CREW_ASSIGNMENT", action: "acceptQuoteAndBook", actor: "CLIENT", trigger: "CLIENT_ACTION", guards: ["quoteNotExpired","termsAccepted","slotAvailable"], effects: ["I2","do:reserveInstallationSlot"], req: ["FNL-E3-E4"], status: "STABLE" },
  { id: "T04", from: "AUDIT_COMPLETED", to: "QUOTE_REJECTED", action: "expireQuote", actor: "SYSTEM", trigger: "CRON", guards: [], effects: ["N_REJECT","do:stampBucketEnteredAt"], req: ["FNL-E3-BUCKET","SLA-QUOTE-14D"], status: "STABLE" },
  { id: "T05", from: "AWAITING_CREW_ASSIGNMENT", to: "HARDWARE_IN_WAREHOUSE", action: "assignCrew", actor: "ADMIN", trigger: "MANUAL", guards: ["crewCertsValid","crewCalendarFree"], effects: ["I3","do:createShipmentOrder"], req: ["FNL-E4-E5","CRM-ZESP-AC2"], status: "STABLE" },
  { id: "T06", from: "HARDWARE_IN_WAREHOUSE", to: "HARDWARE_IN_TRANSIT", action: "shipByCourier", actor: "DISPATCHER", trigger: "MANUAL", guards: ["trackingIdPresent"], effects: ["N5"], req: ["FNL-E5-E6"], status: "STABLE" },
  { id: "T07", from: "HARDWARE_IN_WAREHOUSE", to: "AWAITING_INSTALLATION", action: "deliverWithCrew", actor: "DISPATCHER", trigger: "MANUAL", guards: [], effects: [], req: ["FNL-E5-BYPASS"], status: "STABLE", override: true },
  { id: "T08", from: "HARDWARE_IN_TRANSIT", to: "AWAITING_INSTALLATION", action: "markDelivered", actor: "SYSTEM", trigger: "WEBHOOK", guards: [], effects: [], req: ["FNL-E6-E7"], status: "STABLE" },
  { id: "T09", from: "AWAITING_INSTALLATION", to: "INSTALLATION_COMPLETED", action: "completeInstallation", actor: "INSTALLER", trigger: "MANUAL", guards: ["allPhasesCompleted"], effects: ["N8","do:computeNextServiceDate","do:generateHandoverProtocol"], req: ["FNL-E7-E8","SRV-NEXT-DATE"], status: "STABLE" },
  { id: "T10", from: "AWAITING_CREW_ASSIGNMENT", to: "ROLLBACK_RESCHEDULING", action: "rollback", actor: "DISPATCHER", trigger: "MANUAL", guards: [], effects: ["N_ROLLBACK","I4","do:releaseCrewSlot","do:suspendLogisticsSla"], req: ["FNL-ROLLBACK"], status: "STABLE" },
  { id: "T11", from: "HARDWARE_IN_WAREHOUSE", to: "ROLLBACK_RESCHEDULING", action: "rollback", actor: "DISPATCHER", trigger: "MANUAL", guards: [], effects: ["N_ROLLBACK","I4","do:releaseCrewSlot","do:suspendLogisticsSla"], req: ["FNL-ROLLBACK"], status: "STABLE" },
  { id: "T12", from: "HARDWARE_IN_TRANSIT", to: "ROLLBACK_RESCHEDULING", action: "rollback", actor: "DISPATCHER", trigger: "MANUAL", guards: [], effects: ["N_ROLLBACK","I4","do:releaseCrewSlot","do:suspendLogisticsSla"], req: ["FNL-ROLLBACK"], status: "STABLE" },
  { id: "T13", from: "AWAITING_INSTALLATION", to: "ROLLBACK_RESCHEDULING", action: "rollback", actor: "CLIENT", trigger: "CLIENT_ACTION", guards: [], effects: ["N_ROLLBACK","I4","do:releaseCrewSlot","do:suspendLogisticsSla"], req: ["FNL-ROLLBACK"], status: "STABLE" },
  { id: "T14", from: "ROLLBACK_RESCHEDULING", to: "AWAITING_CREW_ASSIGNMENT", action: "rebookInstallation", actor: "CLIENT", trigger: "CLIENT_ACTION", guards: ["slotAvailable"], effects: ["do:reserveInstallationSlot"], req: ["FNL-ROLLBACK-EXIT"], status: "STABLE" },
  { id: "T17", from: "AWAITING_INSTALLATION", to: "AWAITING_INSTALLATION", action: "completePhaseOne", actor: "INSTALLER", trigger: "MANUAL", guards: ["installationIsTwoPhase","phaseOneNotCompleted"], effects: ["N8a","do:issuePhaseOneInvoice","do:openPhaseTwoBooking"], req: ["FNL-2PHASE"], status: "STABLE" },
  { id: "T15", from: "QUOTE_REJECTED", to: "AUDIT_COMPLETED", action: "returnToFunnel", actor: "DISPATCHER", trigger: "MANUAL", guards: ["quoteRefreshedIfStale"], effects: ["do:refreshQuoteValidity"], req: ["CRM-ZIMNE-AC2"], status: "STABLE" },
  { id: "T16", from: "QUOTE_REJECTED", to: "ARCHIVED_LOST", action: "archiveLost", actor: "DISPATCHER", trigger: "MANUAL", guards: ["lostReasonProvided"], effects: ["do:recordLostReasonForAnalytics"], req: ["CRM-ZIMNE-AC3"], status: "STABLE" },
] as const;

/** Jedyne dozwolone źródło prawdy o legalności przejścia. Nie duplikuj tej logiki w Server Action. */
export function findTransition(from: LeadStatus, action: LeadAction): LeadTransition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.action === action);
}

export function canTransition(from: LeadStatus, action: LeadAction): boolean {
  return findTransition(from, action) !== undefined;
}

export function allowedActions(from: LeadStatus): LeadAction[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.action);
}

/** Pełna macierz stan × akcja — używana przez testy model-based (FNL-NO-ILLEGAL-TRANSITIONS). */
export function transitionMatrix(): { from: LeadStatus; action: LeadAction; legal: boolean }[] {
  const out: { from: LeadStatus; action: LeadAction; legal: boolean }[] = [];
  for (const from of LEAD_STATUSES) for (const action of LEAD_ACTIONS) out.push({ from, action, legal: canTransition(from, action) });
  return out;
}
