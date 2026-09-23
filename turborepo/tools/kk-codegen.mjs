#!/usr/bin/env node
/**
 * kk-codegen — kontrakt → TypeScript + dokumentacja.
 *
 * Kod aplikacji NIGDY nie definiuje etapów, przejść, progów SLA ani ID powiadomień.
 * Importuje je z wygenerowanego pakietu. Dokumentacja też jest generowana,
 * więc nie może się rozjechać z implementacją — to jedyny sposób, by diagram
 * w docs/ i enum w bazie mówiły to samo za pół roku.
 *
 *   node tools/kk-codegen.mjs           # zapisz artefakty
 *   node tools/kk-codegen.mjs --check   # exit 1 jeśli na dysku jest coś innego (bramka CI: „dryf kontraktu")
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './kk.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const { STATES, TRANSITIONS, GUARDS, START_STATE, LOST_REASONS } = await import(join(ROOT, config.contractsDir, 'funnel.contract.mjs'));
const { NOTIFICATIONS, QUEUE_POLICY } = await import(join(ROOT, config.contractsDir, 'notifications.contract.mjs'));
const { SLA_POLICIES } = await import(join(ROOT, config.contractsDir, 'sla.contract.mjs'));
const { ROLES, MATRIX, DELETE_POLICIES, AUDIT_REQUIREMENTS, SYSTEM_ACTOR, SYSTEM_GRANTS } = await import(join(ROOT, config.contractsDir, 'rbac.contract.mjs'));
const { REQUIREMENTS } = await import(join(ROOT, config.contractsDir, 'requirements.contract.mjs'));
const { ROOM_SIZE_BANDS, BUILDING_TYPES, PROPERTY_CONDITIONS, TRIAGE_FIELDS, PROPERTY_AREA_BANDS,
        DISQUALIFICATION_RULES, ROOM_COUNT_EXPERT_THRESHOLD } = await import(join(ROOT, config.contractsDir, 'triage.contract.mjs'));

const BANNER = `// ⚠️  PLIK GENEROWANY — NIE EDYTUJ RĘCZNIE.
// Źródło: ${config.contractsDir}/*.contract.mjs
// Regeneracja: node tools/kk-codegen.mjs
// Każda ręczna zmiana zostanie wykryta przez \`kk-codegen --check\` i odrzucona w CI.
`;

const q = (v) => JSON.stringify(v);
const files = {};

// ─────────────────────────── funnel.ts ───────────────────────────
const stages = STATES.filter((s) => s.kind === 'STAGE');
const buckets = STATES.filter((s) => s.kind === 'BUCKET');
files[`${config.generatedTsDir}/funnel.ts`] = `${BANNER}
export const LEAD_STAGES = [${stages.map((s) => q(s.id)).join(', ')}] as const;
export const LEAD_BUCKETS = [${buckets.map((s) => q(s.id)).join(', ')}] as const;
export const LEAD_STATUSES = [...LEAD_STAGES, ...LEAD_BUCKETS] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];
export type LeadBucket = (typeof LEAD_BUCKETS)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const START_STATE: LeadStatus = ${q(START_STATE)};

export const LOST_REASONS = [${LOST_REASONS.map((r) => q(r.id)).join(', ')}] as const;
export type LostReason = (typeof LOST_REASONS)[number];
export const LOST_REASON_PL: Record<LostReason, string> = {
${LOST_REASONS.map((r) => `  ${r.id}: ${q(r.pl)},`).join('\n')}
};
/** Archiwizacja bez powodu ze słownika jest odrzucana — guard lostReasonProvided (T16). */
export const isValidLostReason = (v: string): v is LostReason => (LOST_REASONS as readonly string[]).includes(v);

/** Powody wymagające niepustej notatki w leads.lost_reason_note (D5). Nie hardkoduj 'OTHER'. */
export const LOST_REASONS_REQUIRING_NOTE = [${LOST_REASONS.filter((r) => r.requiresNote).map((r) => q(r.id)).join(', ')}] as const;
export const lostReasonRequiresNote = (v: LostReason): boolean =>
  (LOST_REASONS_REQUIRING_NOTE as readonly string[]).includes(v);

export const STATE_META: Record<LeadStatus, { n: number; kind: 'STAGE' | 'BUCKET'; pl: string; terminal: boolean; status: 'STABLE' | 'PROPOSED' }> = {
${STATES.map((s) => `  ${s.id}: { n: ${s.n}, kind: ${q(s.kind)}, pl: ${q(s.pl)}, terminal: ${!!s.terminal}, status: ${q(s.status)} },`).join('\n')}
};

export const LEAD_ACTIONS = [${[...new Set(TRANSITIONS.map((t) => t.action))].map(q).join(', ')}] as const;
export type LeadAction = (typeof LEAD_ACTIONS)[number];

export const GUARD_IDS = [${GUARDS.map((g) => q(g.id)).join(', ')}] as const;
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
  /**
   * Odwrotność override: pole actor opisuje tu wyłącznie ścieżkę typową (automat), a istnieje
   * równoważna, w pełni legalna ścieżka ręczna operatora panelu. Anuluje kryterium K1
   * klasyfikacji „ręczna zmiana statusu" — i tylko je; K2/K3/K4 działają dalej.
   * Patrz contracts/funnel.contract.mjs. Nieobecne dla przejść normalnych.
   */
  manualEquivalent?: true;
}

export const TRANSITIONS: readonly LeadTransition[] = [
${TRANSITIONS.map((t) => `  { id: ${q(t.id)}, from: ${q(t.from)}, to: ${q(t.to)}, action: ${q(t.action)}, actor: ${q(t.actor)}, trigger: ${q(t.trigger)}, guards: ${q(t.guards || [])}, effects: ${q(t.effects || [])}, req: ${q(t.req || [])}, status: ${q(t.status)}${t.override ? ', override: true' : ''}${t.manualEquivalent ? ', manualEquivalent: true' : ''} },`).join('\n')}
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
`;

// ─────────────────────────── notifications.ts ───────────────────────────
files[`${config.generatedTsDir}/notifications.ts`] = `${BANNER}
export const NOTIFICATION_IDS = [${NOTIFICATIONS.map((n) => q(n.id)).join(', ')}] as const;
export type NotificationId = (typeof NOTIFICATION_IDS)[number];

export interface NotificationDef {
  id: NotificationId;
  domain: 'FUNNEL' | 'SERVICE' | 'INCIDENT' | 'INTERNAL';
  channels: ('SMS' | 'EMAIL' | 'PUSH')[];
  recipient: 'CLIENT' | 'DISPATCHER' | 'AUDITOR' | 'CREW' | 'ADMIN';
  bind: { kind: string; transition?: string; schedule?: string; event?: string };
  vars: string[];
  attachments?: string[];
  templateKey: string;
  status: 'STABLE' | 'PROPOSED';
}

export const NOTIFICATIONS: readonly NotificationDef[] = [
${NOTIFICATIONS.map((n) => `  { id: ${q(n.id)}, domain: ${q(n.domain)}, channels: ${q(n.channels)}, recipient: ${q(n.recipient)}, bind: ${q(n.bind)}, vars: ${q(n.vars)},${n.attachments ? ` attachments: ${q(n.attachments)},` : ''} templateKey: ${q(n.templateKey)}, status: ${q(n.status)} },`).join('\n')}
] as const;

export const QUEUE_POLICY = ${JSON.stringify(QUEUE_POLICY, null, 2)} as const;

export function notificationsForTransition(transitionId: string): NotificationDef[] {
  return NOTIFICATIONS.filter((n) => n.bind.kind === 'TRANSITION' && String(n.bind.transition).split('|').includes(transitionId));
}

export function byId(id: NotificationId): NotificationDef {
  const found = NOTIFICATIONS.find((n) => n.id === id);
  if (!found) throw new Error(\`Nieznane powiadomienie: \${id}\`);
  return found;
}
`;

// ─────────────────────────── sla.ts ───────────────────────────
// Lista musi odpowiadać MEASURES w tools/kk-validate.mjs (pomniejszonej o 'bands', które nie jest skalarem).
// Kształt nieobecny tutaj nie powoduje błędu: JSON.stringify wycina undefined, więc próg trafiłby
// do sla.ts jako sam scope — liczba znika po cichu, kontrakt i dokumentacja zostają zielone.
const MEASURE_SCALARS = ['days', 'count', 'hourOfDay', 'meters', 'sqm'];

files[`${config.generatedTsDir}/sla.ts`] = `${BANNER}
export const SLA = {
${SLA_POLICIES.map((p) => {
  const scalar = MEASURE_SCALARS.find((k) => p[k] !== undefined);
  return `  ${p.id}: ${JSON.stringify(scalar ? { [scalar]: p[scalar], scope: p.scope } : { scope: p.scope, metric: p.metric, bands: p.bands })},`;
}).join('\n')}
} as const;

export type SlaPolicyId = keyof typeof SLA;

/** Pasmo SLA dla logistyki. Nie licz progów ręcznie w komponencie. */
export function logisticsBand(daysUntilInstallation: number): 'CRITICAL' | 'URGENT' | 'NORMAL' {
  if (daysUntilInstallation < ${SLA_POLICIES.find((p) => p.id === 'LOGISTICS_INSTALL').bands[0].maxDays}) return 'CRITICAL';
  if (daysUntilInstallation <= ${SLA_POLICIES.find((p) => p.id === 'LOGISTICS_INSTALL').bands[1].maxDays}) return 'URGENT';
  return 'NORMAL';
}

export const SLA_ROW_CLASSES: Record<'CRITICAL' | 'URGENT' | 'NORMAL', string> = {
${SLA_POLICIES.find((p) => p.id === 'LOGISTICS_INSTALL').bands.map((b) => `  ${b.id}: ${q(b.ui || '')},`).join('\n')}
};
`;

// ─────────────────────────── rbac.ts ───────────────────────────
files[`${config.generatedTsDir}/rbac.ts`] = `${BANNER}
export const ROLES = [${ROLES.map(q).join(', ')}] as const;
export type Role = (typeof ROLES)[number];

export type Capability = 'read' | 'create' | 'update' | 'delete' | 'assign';

export const PERMISSIONS: Record<string, Partial<Record<Capability, string[]>>> = {
${MATRIX.map((m) => `  ${m.resource}: { read: ${q(m.read || [])}, create: ${q(m.create || [])}, update: ${q(m.update || [])}, delete: ${q(m.delete || [])}${m.assign ? `, assign: ${q(m.assign)}` : ''} },`).join('\n')}
};

export const DELETE_POLICIES = ${JSON.stringify(DELETE_POLICIES, null, 2)} as const;

/**
 * Wymogi audytowe (ADR-008). Jedyne źródło dozwolonych wartości \`operation\`
 * i \`legalBasis\` — waliduj z tej stałej, nie z listy zakodowanej w Server Action.
 */
export const AUDIT_REQUIREMENTS = ${JSON.stringify(AUDIT_REQUIREMENTS, null, 2)} as const;

export type AuditOperation = (typeof AUDIT_REQUIREMENTS.mustLog)[number];
export type AuditLegalBasis = (typeof AUDIT_REQUIREMENTS.legalBases)[number];

/** \`audytor:own\` oznacza dostęp wyłącznie do własnych rekordów — sprawdź to w RLS, nie tylko tutaj. */
export function can(role: Role, resource: string, capability: Capability): 'no' | 'yes' | 'own' {
  const entry = PERMISSIONS[resource]?.[capability] ?? [];
  if (entry.includes(role)) return 'yes';
  if (entry.includes(\`\${role}:own\`)) return 'own';
  return 'no';
}

/**
 * AKTOR SYSTEMOWY — zapis bez udziału człowieka (dziś: faktura zaliczkowa po wpłacie, INV-ADVANCE-AUTO).
 *
 * Celowo OSOBNA funkcja i osobny typ, a nie kolejna wartość w \`Role\`: \`Role\` jest dziedziną
 * kolumny authorized_users.role, więc aktor systemowy na tej liście oznaczałby konto, na które
 * da się zalogować. Tutaj nie ma konta — jest wąska lista par (zasób, uprawnienie).
 *
 * WARUNEK UŻYCIA, którego ta funkcja NIE JEST W STANIE sprawdzić za wywołującego: tożsamość aktora
 * systemowego wolno przyjąć WYŁĄCZNIE po pomyślnej weryfikacji podpisu dostawcy (sekret serwerowy,
 * liczony z surowego ciała żądania). Nigdy na podstawie nagłówka, parametru ani pola w JSON-ie —
 * każde z nich kontroluje ten, kto wysyła żądanie.
 */
export const SYSTEM_ACTOR = ${q(SYSTEM_ACTOR)};

export const SYSTEM_GRANTS = ${JSON.stringify(SYSTEM_GRANTS, null, 2)} as const;

export type SystemTrigger = (typeof SYSTEM_GRANTS)[number]['trigger'];

export function canSystem(resource: string, capability: Capability, trigger: SystemTrigger): boolean {
  return SYSTEM_GRANTS.some(
    (g) => g.resource === resource && g.trigger === trigger && (g.capabilities as readonly string[]).includes(capability),
  );
}
`;

// ─────────────────────────── requirements.ts ───────────────────────────
files[`${config.generatedTsDir}/requirements.ts`] = `${BANNER}
export const REQUIREMENT_IDS = [${REQUIREMENTS.map((r) => q(r.id)).join(', ')}] as const;
export type RequirementId = (typeof REQUIREMENT_IDS)[number];

export const REQUIREMENTS = ${JSON.stringify(
  REQUIREMENTS.map(({ id, domain, status, risk, source, statement }) => ({ id, domain, status, risk, source, statement })),
  null, 2
)} as const;
`;

// ─────────────────────────── triage.ts ───────────────────────────
files[`${config.generatedTsDir}/triage.ts`] = `${BANNER}
export const ROOM_SIZE_BAND_IDS = [${ROOM_SIZE_BANDS.map((b) => q(b.id)).join(', ')}] as const;
export type RoomSizeBandId = (typeof ROOM_SIZE_BAND_IDS)[number];

export interface RoomSizeBand { id: RoomSizeBandId; pl: string; minSqm: number | null; maxSqm: number | null; }

/** Progi metrażu. Komponent kreatora renderuje TO, nie własną tablicę literałów. */
export const ROOM_SIZE_BANDS: readonly RoomSizeBand[] = [
${ROOM_SIZE_BANDS.map((b) => `  { id: ${q(b.id)}, pl: ${q(b.pl)}, minSqm: ${b.minSqm === null ? 'null' : b.minSqm}, maxSqm: ${b.maxSqm === null ? 'null' : b.maxSqm} },`).join('\n')}
] as const;

export const ROOM_SIZE_BAND_PL: Record<RoomSizeBandId, string> = {
${ROOM_SIZE_BANDS.map((b) => `  ${b.id}: ${q(b.pl)},`).join('\n')}
};

/** Pasmo właściwe dla metrażu. Granice są domknięte, null oznacza granicę otwartą. */
export function roomSizeBandForSqm(sqm: number): RoomSizeBandId | undefined {
  return ROOM_SIZE_BANDS.find((b) => (b.minSqm === null || sqm >= b.minSqm) && (b.maxSqm === null || sqm <= b.maxSqm))?.id;
}

export const BUILDING_TYPE_IDS = [${BUILDING_TYPES.map((t) => q(t.id)).join(', ')}] as const;
export type BuildingTypeId = (typeof BUILDING_TYPE_IDS)[number];
export const BUILDING_TYPE_PL: Record<BuildingTypeId, string> = {
${BUILDING_TYPES.map((t) => `  ${t.id}: ${q(t.pl)},`).join('\n')}
};

/**
 * Wartości enuma leads.declared_property_condition (ADR-005 + decyzja 2026-08-19).
 * Deklaracja klienta NIE decyduje o trybie montażu — wiążące jest quotes.installation_type.
 */
export const PROPERTY_CONDITION_IDS = [${PROPERTY_CONDITIONS.map((c) => q(c.id)).join(', ')}] as const;
export type PropertyConditionId = (typeof PROPERTY_CONDITION_IDS)[number];
export const PROPERTY_CONDITION_PL: Record<PropertyConditionId, string> = {
${PROPERTY_CONDITIONS.map((c) => `  ${c.id}: ${q(c.pl)},`).join('\n')}
};

/**
 * Przesłanka montażu dwuetapowego — informacja DLA AUDYTORA, nie rozstrzygnięcie.
 * Nie wpływa na wycenę prezentowaną w Triage (B2C-PRICE-FROM) i nie ustawia
 * quotes.installation_type — to robi audytor po oględzinach (FNL-2PHASE).
 */
export const PROPERTY_CONDITION_SUGGESTS_TWO_PHASE: Record<PropertyConditionId, boolean> = {
${PROPERTY_CONDITIONS.map((c) => `  ${c.id}: ${c.suggestsTwoPhase === true},`).join('\n')}
};

/** Czy deklaracja klienta jest przesłanką montażu dwuetapowego. Nie licz tego warunkiem w kodzie. */
export function suggestsTwoPhase(condition: PropertyConditionId): boolean {
  return PROPERTY_CONDITION_SUGGESTS_TWO_PHASE[condition];
}

/** Próg liczby pomieszczeń kierujący na ekran Eksperta. Zakaz literału w komponencie. */
export const ROOM_COUNT_EXPERT_THRESHOLD = ${ROOM_COUNT_EXPERT_THRESHOLD};

export const PROPERTY_AREA_BAND_IDS = [${PROPERTY_AREA_BANDS.map((b) => q(b.id)).join(', ')}] as const;
export type PropertyAreaBandId = (typeof PROPERTY_AREA_BAND_IDS)[number];
export const PROPERTY_AREA_BAND_PL: Record<PropertyAreaBandId, string> = {
${PROPERTY_AREA_BANDS.map((b) => `  ${b.id}: ${q(b.pl)},`).join('\n')}
};

/**
 * Pasmo powierzchni CAŁEGO LOKALU — wyłącznie do ustalenia stawki VAT (PRICE-VAT-RATE).
 * To NIE jest metraż pomieszczenia (ROOM_SIZE_BANDS) i nie służy doborowi mocy jednostki.
 * Granica NIE JEST tu powtórzona jako liczba — mieszka w SLA.PROPERTY_AREA_VAT_THRESHOLD.
 */
export const PROPERTY_AREA_BAND_BOUNDARY: Record<PropertyAreaBandId, 'BELOW_OR_EQUAL' | 'ABOVE'> = {
${PROPERTY_AREA_BANDS.map((b) => `  ${b.id}: ${q(b.boundary)},`).join('\n')}
};

export const TRIAGE_FIELD_IDS = [${TRIAGE_FIELDS.map((f) => q(f.id)).join(', ')}] as const;
export type TriageFieldId = (typeof TRIAGE_FIELD_IDS)[number];

/** Odpowiedzi kreatora w postaci, w jakiej trafiają do leads.triage_answers. */
export type TriageAnswers = Partial<Record<TriageFieldId, string | number>>;

/**
 * Warunki widoczności pytań kreatora (D17). Pole nieobecne w tej mapie jest widoczne ZAWSZE.
 * Kreator MUSI pytać o to stąd — warunek przepisany do komponentu przestaje być kontraktem
 * i rozjeżdża się przy pierwszej zmianie słownika typów nieruchomości.
 */
export const TRIAGE_FIELD_VISIBILITY: Partial<Record<TriageFieldId, { field: TriageFieldId; in: readonly string[] }>> = {
${TRIAGE_FIELDS.filter((f) => f.visibleWhen).map((f) => `  ${f.id}: { field: ${q(f.visibleWhen.field)}, in: [${f.visibleWhen.in.map(q).join(', ')}] as const },`).join('\n')}
};

/** Czy pytanie ma być zadane przy dotychczasowych odpowiedziach. Nie licz tego warunkiem w komponencie. */
export function isTriageFieldVisible(field: TriageFieldId, answers: TriageAnswers): boolean {
  const cond = TRIAGE_FIELD_VISIBILITY[field];
  if (!cond) return true;
  const v = answers[cond.field];
  return typeof v === 'string' && cond.in.includes(v);
}

export const DISQUALIFICATION_RULES = [
${DISQUALIFICATION_RULES.map((r) => `  { id: ${q(r.id)}, field: ${q(r.field)}, operator: ${q(r.operator)}, value: ${typeof r.value === 'number' ? r.value : q(r.value)}, outcome: ${q(r.outcome)}, pl: ${q(r.pl)} },`).join('\n')}
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
`;

files[`${config.generatedTsDir}/index.ts`] = `${BANNER}
// Re-eksporty bez rozszerzeń — zgodne z moduleResolution: "bundler" (domyślne w Next.js/Turborepo).
// Jeżeli przejdziesz na moduleResolution: "nodenext", zmień to w codegenie, nie w tym pliku.
export * from './funnel';
export * from './notifications';
export * from './sla';
export * from './rbac';
export * from './requirements';
export * from './triage';
`;

// ─────────────────────────── dokumentacja (Mermaid) ───────────────────────────
const mermaidId = (s) => s;
const stateDiagram = [
  '```mermaid',
  'stateDiagram-v2',
  '    direction TB',
  '',
  ...STATES.map((s) => `    ${mermaidId(s.id)}: ${s.kind === 'BUCKET' ? 'BUCKET — ' : `${s.n}. `}${s.pl}${s.status === 'PROPOSED' ? ' [PROPOZYCJA]' : ''}`),
  '',
  ...TRANSITIONS.map((t) => `    ${mermaidId(t.from)} --> ${mermaidId(t.to)} : ${t.id} ${t.action}${t.status === 'PROPOSED' ? ' [?]' : ''}`),
  '```',
].join('\n');

const notifTable = [
  '| ID | Domena | Kanał | Adresat | Wyzwalacz | Szablon | Status |',
  '|---|---|---|---|---|---|---|',
  ...NOTIFICATIONS.map((n) => {
    const trig = n.bind.kind === 'TRANSITION' ? `przejście ${n.bind.transition}` : n.bind.kind === 'CRON' ? `CRON: ${n.bind.schedule}` : `${n.bind.kind}: ${n.bind.event}`;
    return `| \`${n.id}\` | ${n.domain} | ${n.channels.join('+')} | ${n.recipient} | ${trig} | \`${n.templateKey}\` | ${n.status} |`;
  }),
].join('\n');

const transTable = [
  '| ID | Z | Do | Akcja | Aktor | Guardy | Efekty | Wymagania | Override | Równoważnik ręczny |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...TRANSITIONS.map((t) => `| \`${t.id}\` | ${t.from} | ${t.to} | \`${t.action}\` | ${t.actor} | ${(t.guards || []).join(', ') || '—'} | ${(t.effects || []).join(', ') || '—'} | ${(t.req || []).join(', ')} | ${t.override ? 'TAK' : '—'} | ${t.manualEquivalent ? 'TAK (K1 anulowane)' : '—'} |`),
].join('\n');

const triageTable = [
  '| Słownik | Wartość | Etykieta PL | Uwagi |',
  '|---|---|---|---|',
  ...ROOM_SIZE_BANDS.map((b) => `| ROOM_SIZE_BANDS | \`${b.id}\` | ${b.pl} | ${b.minSqm === null ? '—' : b.minSqm} – ${b.maxSqm === null ? '∞' : b.maxSqm} m² |`),
  ...BUILDING_TYPES.map((t) => `| BUILDING_TYPES | \`${t.id}\` | ${t.pl} | — |`),
  ...PROPERTY_CONDITIONS.map((c) => `| PROPERTY_CONDITIONS | \`${c.id}\` | ${c.pl} | ${c.suggestsTwoPhase ? 'przesłanka montażu dwuetapowego (dla audytora, nie dla wyceny)' : 'bez przesłanki dwuetapowości'} |`),
].join('\n');

const disqTable = [
  '| Reguła | Warunek | Skutek | Wymaganie |',
  '|---|---|---|---|',
  ...DISQUALIFICATION_RULES.map((r) => `| \`${r.id}\` | ${r.field} ${r.operator} ${r.value} | ${r.outcome} | ${(r.req || []).join(', ')} |`),
].join('\n');

files[`${config.generatedDocsDir}/CONTRACTS.md`] = `<!-- ⚠️ PLIK GENEROWANY — NIE EDYTUJ. Źródło: ${config.contractsDir}/*.contract.mjs -->
# Kontrakty KlikKlima (widok wygenerowany)

Ten plik jest artefaktem, nie dokumentem roboczym. Jeżeli coś tu jest nie tak, popraw kontrakt i uruchom \`node tools/kk-codegen.mjs\`.

## Maszyna stanów leada

${stateDiagram}

## Tabela przejść

${transTable}

## Katalog powiadomień

${notifTable}

## Słownictwo wejścia do lejka (Triage B2C)

Lejek zaczyna się od \`NEW_LEAD\`. To są odpowiedzi, z których ten stan powstaje.

${triageTable}

Próg kierujący na ekran Eksperta: **ROOM_COUNT_EXPERT_THRESHOLD = ${ROOM_COUNT_EXPERT_THRESHOLD}**.

${disqTable}

## Progi SLA (czasowe, ilościowe i przestrzenne)

Każdy próg ma nazwę i dokładnie jeden kształt pomiaru (R21). Literał liczbowy w kodzie zamiast importu z kontraktu to przyszła rozbieżność między modułami.

| ID | Pomiar | Wartość | Zasięg | Wymagania |
|---|---|---|---|---|
${SLA_POLICIES.map((p) => {
  const key = MEASURE_SCALARS.find((k) => p[k] !== undefined);
  const measure = key || (p.bands ? 'bands' : '—');
  const value = key ? String(p[key]) : (p.bands ? `${p.bands.length} pasm (${p.metric})` : '—');
  return `| \`${p.id}\` | ${measure} | ${value} | ${p.scope} | ${(p.req || []).join(', ')} |`;
}).join('\n')}

## Elementy oczekujące na decyzję człowieka

${[...STATES, ...TRANSITIONS, ...NOTIFICATIONS].filter((x) => x.status === 'PROPOSED').map((x) => `- \`${x.id}\` — ${x.note || x.pl || ''}`).join('\n') || '_Brak._'}
`;

// ─────────────────────────── zapis / porównanie ───────────────────────────
let drift = 0;
for (const [rel, content] of Object.entries(files)) {
  const abs = join(ROOT, rel);
  if (CHECK) {
    const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (current !== content) {
      drift++;
      console.log(`  ✗ DRYF: ${rel} ${current === null ? '(brak pliku)' : '(treść różni się od kontraktu)'}`);
    }
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`  ✓ ${rel}`);
  }
}

if (CHECK) {
  if (drift) {
    console.log(`\n  ${drift} plik(ów) rozjechało się z kontraktem. Uruchom: node tools/kk-codegen.mjs\n`);
    process.exit(1);
  }
  console.log('  ✓ Brak dryfu — wygenerowany kod odpowiada kontraktowi.\n');
} else {
  console.log(`\n  Wygenerowano ${Object.keys(files).length} plików.\n`);
}
