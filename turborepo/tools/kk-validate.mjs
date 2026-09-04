#!/usr/bin/env node
/**
 * kk-validate — walidator niezmienników kontraktu.
 *
 * To jest pierwsza bramka pętli agentowej. Uruchamiana ZANIM ktokolwiek napisze linijkę kodu
 * i ponownie w CI. Zero zależności — działa na czystym node.
 *
 *   node tools/kk-validate.mjs           # błędy => exit 1, ostrzeżenia => exit 0
 *   node tools/kk-validate.mjs --strict  # ostrzeżenia (PROPOSED) też są błędami
 *   node tools/kk-validate.mjs --json    # wyjście maszynowe dla CI/agenta
 */
// Katalog kontraktów jest parametryzowany, aby kk-selftest mógł walidować zmutowane kopie.
const DIR = process.env.KK_CONTRACTS_DIR
  ? new URL(`file://${process.env.KK_CONTRACTS_DIR.replace(/\/?$/, '/')}`)
  : new URL('../contracts/', import.meta.url);
const load = (f) => import(new URL(f, DIR).href);

const { STATES, TRANSITIONS, GUARDS, ACTORS, TRIGGER_TYPES, START_STATE } = await load('funnel.contract.mjs');
const { NOTIFICATIONS, CHANNELS, RECIPIENTS, DOMAINS, QUEUE_POLICY } = await load('notifications.contract.mjs');
const { SLA_POLICIES, INCIDENT_PRIORITIES } = await load('sla.contract.mjs');
const { ROLES, MATRIX, RESOURCES, DELETE_POLICIES, AUDIT_REQUIREMENTS } = await load('rbac.contract.mjs');
const { REQUIREMENTS } = await load('requirements.contract.mjs');
const { ROOM_SIZE_BANDS, BUILDING_TYPES, PROPERTY_CONDITIONS, TRIAGE_FIELDS,
        DISQUALIFICATION_RULES, DISQUALIFICATION_OPERATORS, DISQUALIFICATION_OUTCOMES,
        ROOM_COUNT_EXPERT_THRESHOLD } = await load('triage.contract.mjs');

const errors = [];
const warnings = [];
const err = (rule, msg) => errors.push({ rule, msg });
const warn = (rule, msg) => warnings.push({ rule, msg });

const stateIds = new Set(STATES.map((s) => s.id));
const guardIds = new Set(GUARDS.map((g) => g.id));
const notifIds = new Set(NOTIFICATIONS.map((n) => n.id));
const reqIds = new Set(REQUIREMENTS.map((r) => r.id));
const transIds = new Set(TRANSITIONS.map((t) => t.id));

const dupes = (arr) => {
  const seen = new Set(), out = new Set();
  for (const x of arr) (seen.has(x) ? out : seen).add(x);
  return [...out];
};

// R01 — unikalność identyfikatorów
for (const [label, ids] of [
  ['STATES', STATES.map((s) => s.id)],
  ['TRANSITIONS', TRANSITIONS.map((t) => t.id)],
  ['NOTIFICATIONS', NOTIFICATIONS.map((n) => n.id)],
  ['REQUIREMENTS', REQUIREMENTS.map((r) => r.id)],
  ['GUARDS', GUARDS.map((g) => g.id)],
  ['ROOM_SIZE_BANDS', ROOM_SIZE_BANDS.map((b) => b.id)],
  ['BUILDING_TYPES', BUILDING_TYPES.map((b) => b.id)],
  ['PROPERTY_CONDITIONS', PROPERTY_CONDITIONS.map((c) => c.id)],
  ['DISQUALIFICATION_RULES', DISQUALIFICATION_RULES.map((r) => r.id)],
]) {
  const d = dupes(ids);
  if (d.length) err('R01-unique-ids', `${label}: zduplikowane ID: ${d.join(', ')}`);
}

// R02 — każde przejście wskazuje na istniejące stany
for (const t of TRANSITIONS) {
  if (!stateIds.has(t.from)) err('R02-known-states', `${t.id}: nieznany stan źródłowy "${t.from}"`);
  if (!stateIds.has(t.to)) err('R02-known-states', `${t.id}: nieznany stan docelowy "${t.to}"`);
  if (!ACTORS.includes(t.actor)) err('R02-known-states', `${t.id}: nieznany aktor "${t.actor}"`);
  if (!TRIGGER_TYPES.includes(t.trigger)) err('R02-known-states', `${t.id}: nieznany typ wyzwalacza "${t.trigger}"`);
}

// R03 — determinizm: para (from, action) musi być unikalna
const pairs = TRANSITIONS.map((t) => `${t.from}::${t.action}`);
for (const d of dupes(pairs)) err('R03-determinism', `Niedeterministyczne przejście — para (stan, akcja) występuje wielokrotnie: ${d}`);

// R04 — osiągalność każdego stanu ze stanu startowego
const adj = new Map();
for (const t of TRANSITIONS) {
  if (!adj.has(t.from)) adj.set(t.from, []);
  adj.get(t.from).push(t.to);
}
const seen = new Set([START_STATE]);
const queue = [START_STATE];
while (queue.length) {
  const cur = queue.shift();
  for (const nxt of adj.get(cur) || []) if (!seen.has(nxt)) { seen.add(nxt); queue.push(nxt); }
}
for (const s of STATES) {
  if (!seen.has(s.id)) err('R04-reachability', `Stan "${s.id}" jest nieosiągalny ze stanu startowego ${START_STATE}.`);
}

// R05 — brak ślepych zaułków (poza stanami terminalnymi)
for (const s of STATES) {
  const out = TRANSITIONS.filter((t) => t.from === s.id);
  if (!s.terminal && out.length === 0) err('R05-no-dead-end', `Stan "${s.id}" nie jest terminalny, a nie ma wyjść. Lead utknie tu na zawsze.`);
  if (s.terminal && out.length > 0) warn('R05-no-dead-end', `Stan "${s.id}" oznaczony jako terminalny, ale ma ${out.length} wyjść.`);
}

// R06 — każdy bucket ma drogę powrotu lub jest jawnie terminalny
for (const s of STATES.filter((x) => x.kind === 'BUCKET')) {
  const out = TRANSITIONS.filter((t) => t.from === s.id);
  if (!s.terminal && out.length === 0) err('R06-bucket-exit', `Bucket "${s.id}" nie ma wyjścia ani flagi terminal.`);
}

// R07 — efekty przejść wskazują na istniejące powiadomienia albo są efektami domenowymi
for (const t of TRANSITIONS) {
  for (const e of t.effects || []) {
    if (e.startsWith('do:')) continue;
    if (!notifIds.has(e)) err('R07-effect-exists', `${t.id}: efekt "${e}" nie istnieje w katalogu powiadomień.`);
  }
}

// R29 — kształt flagi `override` (D3, WO SEC-AUDIT-LOG-MANUAL-STATUS)
// Flaga domyka klasyfikację „ręczna zmiana statusu" tam, gdzie nie sięgają kryteria wyliczalne
// (K1 aktor, K2 brak przejścia, K3 krawędź bucketu). Dwa błędy, których nie widać gołym okiem:
// `override: false` (klasyfikator czyta truthy — pole udaje decyzję, a jej nie ma) oraz flaga
// na przejściu i tak łapanym przez K1/K3 (martwa adnotacja, która przeżyje zmianę aktora).
const BUCKET_STATES = new Set(STATES.filter((s) => s.kind === 'BUCKET').map((s) => s.id));
const NON_OPERATOR_ACTORS = new Set(['CLIENT', 'SYSTEM', 'INSTALLER', 'AUDITOR']);
for (const t of TRANSITIONS) {
  if (!('override' in t)) continue;
  if (t.override !== true) {
    err('R29-override-shape', `${t.id}: override = ${JSON.stringify(t.override)}. Dopuszczalny jest wyłącznie literał true; przejście normalne nie ma tego pola.`);
    continue;
  }
  const k1 = NON_OPERATOR_ACTORS.has(t.actor);
  const k3 = BUCKET_STATES.has(t.from) || BUCKET_STATES.has(t.to);
  if (k1 || k3) {
    err('R29-override-shape', `${t.id}: override zbędny — przejście jest już klasyfikowane jako ręczne przez ${[k1 && 'K1 (aktor ' + t.actor + ')', k3 && 'K3 (krawędź bucketu)'].filter(Boolean).join(' i ')}. Martwa flaga przeżyje zmianę aktora lub kind stanu i nikt nie zauważy, że została sama.`);
  }
}

// R30 — kształt flagi `manualEquivalent` (D4, WO SEC-AUDIT-LOG-MANUAL-STATUS-T08-FIX)
// Flaga ANULUJE kryterium K1 (aktor spoza operatorów panelu) na przejściu, w którym `actor`
// opisuje jedynie ścieżkę typową, a ręczna ścieżka operatora jest równoważna i legalna.
// Dwa błędy nie do wychwycenia gołym okiem: `manualEquivalent: false` (klasyfikator czyta truthy —
// pole udaje decyzję, której nie ma) oraz flaga na przejściu, którego K1 wcale nie łapie —
// wtedy nie ma czego anulować, pole jest martwe i po zmianie aktora nikt nie zauważy, że zostało.
for (const t of TRANSITIONS) {
  if (!('manualEquivalent' in t)) continue;
  if (t.manualEquivalent !== true) {
    err('R30-manual-equivalent-shape', `${t.id}: manualEquivalent = ${JSON.stringify(t.manualEquivalent)}. Dopuszczalny jest wyłącznie literał true; przejście normalne nie ma tego pola.`);
    continue;
  }
  if (!NON_OPERATOR_ACTORS.has(t.actor)) {
    err('R30-manual-equivalent-shape', `${t.id}: manualEquivalent bezcelowy — aktor ${t.actor} jest operatorem panelu, więc K1 i tak nie klasyfikuje tego przejścia jako ręcznego. Flaga anulująca K1 nie ma czego anulować i przeżyje zmianę aktora niezauważona.`);
  }
}

// R08 — guardy przejść istnieją w rejestrze
for (const t of TRANSITIONS) {
  for (const g of t.guards || []) if (!guardIds.has(g)) err('R08-guard-exists', `${t.id}: guard "${g}" nie jest zarejestrowany w GUARDS.`);
}

// R09 — powiązania powiadomień wskazują na istniejące przejścia
for (const n of NOTIFICATIONS) {
  if (n.bind?.kind === 'TRANSITION') {
    for (const tid of String(n.bind.transition).split('|')) {
      if (!transIds.has(tid)) err('R09-notif-binding', `${n.id}: powiązane z nieistniejącym przejściem "${tid}".`);
    }
  }
  if (!n.channels?.length) err('R09-notif-binding', `${n.id}: brak kanału wysyłki.`);
  for (const c of n.channels || []) if (!CHANNELS.includes(c)) err('R09-notif-binding', `${n.id}: nieznany kanał "${c}".`);
  if (!RECIPIENTS.includes(n.recipient)) err('R09-notif-binding', `${n.id}: nieznany adresat "${n.recipient}".`);
  if (!DOMAINS.includes(n.domain)) err('R09-notif-binding', `${n.id}: nieznana domena "${n.domain}".`);
  if (!n.templateKey) err('R09-notif-binding', `${n.id}: brak templateKey.`);
}

// R10 — brak sierot: każde przejście STABLE, które powinno powiadamiać klienta, ma powiadomienie ALBO jawną adnotację
const templateKeys = NOTIFICATIONS.map((n) => n.templateKey);
for (const d of dupes(templateKeys)) err('R10-template-unique', `Zduplikowany templateKey "${d}" — dwa powiadomienia trafią w ten sam szablon.`);

// R17 — nazwy zmiennych szablonów: angielski snake_case (ADR-002)
// Szablon jest interpolowany w kodzie, więc `{{imie}}` to identyfikator, nie treść dla użytkownika.
const ABANDONED_VARS = new Set(['imie', 'nazwisko', 'adres', 'godzina', 'data', 'data_waznosci',
  'numer_zlecenia', 'typ_certyfikatu', 'osoba_lub_zespol', 'kwota', 'telefon', 'link_rezerwacji']);
for (const n of NOTIFICATIONS) {
  for (const v of n.vars || []) {
    if (ABANDONED_VARS.has(v)) err('R17-var-naming', `${n.id}: zmienna "${v}" jest porzucona w ADR-002. Słownik: docs/architecture/NAMING.md.`);
    else if (!/^[a-z][a-z0-9_]*$/.test(v)) err('R17-var-naming', `${n.id}: zmienna "${v}" nie jest snake_case.`);
  }
}

// R11 — rejestr wymagań: kompletność
for (const r of REQUIREMENTS) {
  if (!r.source) err('R11-req-complete', `${r.id}: brak wskazania dokumentu źródłowego.`);
  if (!r.statement) err('R11-req-complete', `${r.id}: brak treści wymagania.`);
  if (!r.acceptance?.length) err('R11-req-complete', `${r.id}: brak kryteriów akceptacji — nie da się z tego wygenerować testu.`);
  // SUPERSEDED dodane 2026-09-01 (WO BATCH-MEDIUM-LOW-CLEANUP punkt 22): wymaganie rozbite na wpisy
  // potomne. Zostaje w rejestrze, żeby nie zerwać historii i dopasowań kk-trace do już otagowanych
  // testów, ale nie jest już samodzielnie egzekwowalne — pokrycie liczy się na potomkach.
  if (!['TODO', 'IMPLEMENTING', 'DONE', 'BLOCKED', 'SUPERSEDED'].includes(r.status)) err('R11-req-complete', `${r.id}: nieznany status "${r.status}".`);
}

// R12 — odwołania do wymagań z innych kontraktów muszą istnieć
const checkReqRefs = (label, list) => {
  for (const item of list) for (const rid of item.req || []) {
    if (!reqIds.has(rid)) err('R12-req-refs', `${label} ${item.id}: odwołanie do nieistniejącego wymagania "${rid}".`);
  }
};
checkReqRefs('TRANSITION', TRANSITIONS);
checkReqRefs('SLA', SLA_POLICIES);
checkReqRefs('DISQUALIFICATION_RULE', DISQUALIFICATION_RULES);

// R13 — RBAC: delete tylko dla admina, brak nieznanych ról i zasobów
for (const row of MATRIX) {
  if (!RESOURCES.includes(row.resource)) err('R13-rbac', `MATRIX: nieznany zasób "${row.resource}".`);
  for (const cap of ['read', 'create', 'update', 'delete', 'assign']) {
    for (const role of row[cap] || []) {
      const base = role.split(':')[0];
      if (!ROLES.includes(base)) err('R13-rbac', `MATRIX ${row.resource}.${cap}: nieznana rola "${role}".`);
    }
  }
  const del = row.delete || [];
  if (del.length && !(del.length === 1 && del[0] === 'admin')) {
    err('R13-rbac', `MATRIX ${row.resource}.delete = [${del}] — narusza globalną regułę „usuwa wyłącznie admin".`);
  }
}
for (const rs of RESOURCES) if (!MATRIX.some((m) => m.resource === rs)) err('R13-rbac', `Zasób "${rs}" nie ma wiersza w MATRIX.`);
for (const p of DELETE_POLICIES) if (!RESOURCES.includes(p.entity)) err('R13-rbac', `DELETE_POLICIES: nieznana encja "${p.entity}".`);

// R14 — SLA: progi rosnące, brak zielonych pasm
for (const p of SLA_POLICIES) {
  if (!p.bands) continue;
  const withDays = p.bands.filter((b) => typeof b.maxDays === 'number');
  for (let i = 1; i < withDays.length; i++) {
    if (withDays[i].maxDays <= withDays[i - 1].maxDays) err('R14-sla', `${p.id}: progi pasm nie są rosnące (${withDays[i - 1].maxDays} -> ${withDays[i].maxDays}).`);
  }
  if (p.forbidGreenBands && p.bands.some((b) => /green|emerald|success/i.test(b.color || ''))) {
    err('R14-sla', `${p.id}: zielone pasmo SLA jest zabronione wytycznymi UI.`);
  }
}

// R15 — polityka kolejki spójna z wymogiem ponawiania
if (QUEUE_POLICY.deadLetterAfterAttempts > QUEUE_POLICY.maxAttempts) {
  err('R15-queue', 'QUEUE_POLICY: dead-letter po większej liczbie prób niż maxAttempts — nieosiągalne.');
}
if (!QUEUE_POLICY.requiresIdempotencyKey) err('R15-queue', 'QUEUE_POLICY: brak klucza idempotencji przy ponawianiu — ryzyko dubli SMS do klienta.');

// R18 — każdy kanał użyty w katalogu ma zdefiniowane okno wysyłki (ADR-007)
// Kanał bez okna oznacza wiadomość, której planista nie wie kiedy wysłać.
const KNOWN_RECIPIENTS = ['CLIENT', 'DISPATCHER', 'ADMIN', 'AUDITOR', 'CREW'];
const windows = Object.keys(QUEUE_POLICY.sendWindow || {});
for (const n of NOTIFICATIONS) {
  if (!n.channels?.length) err('R18-channel-window', `${n.id}: brak kanału — wiadomość, której nie da się wysłać.`);
  for (const ch of n.channels || []) {
    if (!windows.includes(ch)) err('R18-channel-window', `${n.id}: kanał "${ch}" nie ma okna wysyłki w QUEUE_POLICY.sendWindow.`);
  }
  if (!KNOWN_RECIPIENTS.includes(n.recipient)) err('R18-channel-window', `${n.id}: nieznany odbiorca "${n.recipient}".`);
}

// R19 — pętla własna bez guarda to zaproszenie do nieskończonego przetwarzania (ADR-005)
for (const t of TRANSITIONS) {
  if (t.from === t.to && !(t.guards || []).length) {
    err('R19-self-loop-guard', `${t.id}: przejście ${t.from} → ${t.to} bez guarda. Pętla własna musi mieć warunek, który kiedyś przestaje być prawdziwy.`);
  }
}

// R20 — PUSH tylko do pracowników (ADR-006). Klient korzysta z aplikacji webowej i nie ma tokena urządzenia.
for (const n of NOTIFICATIONS) {
  if ((n.channels || []).includes('PUSH') && n.recipient === 'CLIENT') {
    err('R20-push-recipient', `${n.id}: PUSH do odbiorcy CLIENT. Klient nie rejestruje urządzenia — użyj SMS lub EMAIL.`);
  }
}

// R21 — „SLA" musi znaczyć coś konkretnego (ADR-011)
// Cztery różne mechanizmy nosiły tę samą nazwę. Każda polityka deklaruje dokładnie jeden
// kształt pomiaru, ma zasięg i wskazuje wymaganie — inaczej nie wiadomo, co właściwie mierzy.
// 'meters' — jedyna jednostka odległości w kontrakcie (decyzja człowieka D-B, 2026-08-21).
// Świadomie NIE ma 'kilometers': dwie jednostki tej samej wielkości fizycznej wymuszają przeliczanie
// w kodzie, czyli dokładnie to, przed czym ADR-011 i reguła magic-sla-days mają chronić.
// Każde rozszerzenie tej listy musi być odzwierciedlone w tools/kk-codegen.mjs (lista skalarów przy sla.ts),
// inaczej próg przechodzi walidację, a w wygenerowanym pliku zostaje sam opis bez liczby.
const MEASURES = ['bands', 'days', 'count', 'hourOfDay', 'meters'];
for (const p of SLA_POLICIES) {
  const declared = MEASURES.filter((k) => p[k] !== undefined);
  if (declared.length !== 1) {
    err('R21-sla-shape', `${p.id}: zadeklarowano ${declared.length} kształtów pomiaru (${declared.join(', ') || 'żaden'}). Polityka mierzy dokładnie jedną rzecz.`);
  }
  if (!p.scope) err('R21-sla-shape', `${p.id}: brak opisu zasięgu — nie wiadomo, czego dotyczy.`);
  if (!p.req?.length) err('R21-sla-shape', `${p.id}: próg bez wymagania. Liczba, której nikt nie żądał, nie ma jak zostać przetestowana.`);
  for (const band of p.bands || []) {
    for (const pr of band.appliesToPriorities || []) {
      if (!INCIDENT_PRIORITIES.includes(pr)) err('R21-sla-shape', `${p.id}: nieznany priorytet "${pr}". Dopuszczalne: ${INCIDENT_PRIORITIES.join(', ')}.`);
    }
  }
}

// R22 — audyt append-only musi być spójny z macierzą uprawnień (ADR-008).
// Deklaracja `appendOnly: true` obok wiersza dającego komukolwiek UPDATE to deklaracja bez pokrycia.
if (AUDIT_REQUIREMENTS.appendOnly) {
  const row = MATRIX.find((m) => m.resource === 'audit_log');
  if (!row) err('R22-audit-append-only', 'Brak wiersza audit_log w macierzy RBAC, mimo że audyt jest wymagany.');
  else {
    for (const cap of ['update', 'delete']) {
      if ((row[cap] || []).length) {
        err('R22-audit-append-only', `audit_log.${cap} przyznane rolom [${row[cap].join(', ')}], a AUDIT_REQUIREMENTS deklaruje append-only. Rejestr, który da się zmienić, nie jest dowodem.`);
      }
    }
    if (!(row.create || []).length) err('R22-audit-append-only', 'audit_log.create nie przyznane żadnej roli — rejestru nie da się zapisać.');
  }
  if (!AUDIT_REQUIREMENTS.retentionDays) err('R22-audit-append-only', 'Brak okresu retencji rejestru audytowego.');
  if (AUDIT_REQUIREMENTS.requiresJustification && !AUDIT_REQUIREMENTS.legalBases?.length) {
    err('R22-audit-append-only', 'Wymagane uzasadnienie bez zamkniętej listy podstaw prawnych — wolny tekst nie da się raportować.');
  }
}

// R23 — słowniki Triage: niepuste, identyfikatory angielskie, etykiety rozróżnialne.
// Słownik wejścia do lejka jest tak samo wiążący jak enum w bazie: to on decyduje,
// co w ogóle da się zapisać w leads.triage_answers.
const TRIAGE_DICTS = { ROOM_SIZE_BANDS, BUILDING_TYPES, PROPERTY_CONDITIONS };
for (const [name, dict] of Object.entries(TRIAGE_DICTS)) {
  if (!dict.length) { err('R23-triage-dict', `${name}: słownik pusty — Triage nie ma z czego zbudować pytania.`); continue; }
  for (const item of dict) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(item.id)) err('R23-triage-dict', `${name}: ID "${item.id}" nie jest angielskim SCREAMING_SNAKE_CASE (ADR-002). Słownik: docs/architecture/NAMING.md.`);
    if (!item.pl) err('R23-triage-dict', `${name} ${item.id}: brak etykiety PL — kafelek bez treści dla klienta.`);
  }
  for (const d of dupes(dict.map((x) => x.pl))) err('R23-triage-dict', `${name}: zduplikowana etykieta "${d}" — dwie odpowiedzi nierozróżnialne dla klienta.`);
}

// R24 — progi metrażu bez dziur i bez zachodzenia.
// Dziura oznacza metraż, którego klient nie może zadeklarować; zachodzenie oznacza dwie
// poprawne odpowiedzi na to samo pytanie i dwie różne moce dobrane dla tego samego pokoju.
if (!ROOM_SIZE_BANDS.length) {
  err('R24-triage-bands', 'ROOM_SIZE_BANDS: brak pasm metrażu.');
} else {
  const first = ROOM_SIZE_BANDS[0];
  const last = ROOM_SIZE_BANDS[ROOM_SIZE_BANDS.length - 1];
  if (first.minSqm !== null) err('R24-triage-bands', `${first.id}: pierwsze pasmo ma domkniętą granicę dolną — metraż poniżej ${first.minSqm} m² nie ma reprezentacji.`);
  if (last.maxSqm !== null) err('R24-triage-bands', `${last.id}: ostatnie pasmo ma domkniętą granicę górną — metraż powyżej ${last.maxSqm} m² nie ma reprezentacji.`);
  for (let i = 0; i < ROOM_SIZE_BANDS.length; i++) {
    const b = ROOM_SIZE_BANDS[i];
    const prev = ROOM_SIZE_BANDS[i - 1];
    if (b.minSqm === null && i !== 0) err('R24-triage-bands', `${b.id}: otwarta granica dolna dozwolona wyłącznie w pierwszym paśmie.`);
    if (b.maxSqm === null && i !== ROOM_SIZE_BANDS.length - 1) err('R24-triage-bands', `${b.id}: otwarta granica górna dozwolona wyłącznie w ostatnim paśmie.`);
    if (typeof b.minSqm === 'number' && typeof b.maxSqm === 'number' && b.minSqm > b.maxSqm) err('R24-triage-bands', `${b.id}: granica dolna ${b.minSqm} m² jest większa od górnej ${b.maxSqm} m².`);
    if (!prev) continue;
    if (typeof prev.maxSqm !== 'number' || typeof b.minSqm !== 'number') {
      err('R24-triage-bands', `${prev.id} → ${b.id}: sąsiadujące pasma bez domkniętej granicy — nie da się sprawdzić ciągłości.`);
    } else if (b.minSqm !== prev.maxSqm + 1) {
      const kind = b.minSqm > prev.maxSqm + 1 ? 'dziura' : 'zachodzenie';
      err('R24-triage-bands', `${prev.id} kończy się na ${prev.maxSqm} m², a ${b.id} zaczyna od ${b.minSqm} m² — ${kind} w progach metrażu.`);
    }
  }
}

// R25 — reguły dyskwalifikacji odwołują się wyłącznie do istniejących pól i wartości słowników.
// Reguła wskazująca wartość spoza słownika nigdy się nie zapali, a klient dostanie wycenę,
// której nie powinien zobaczyć.
const triageFieldById = new Map(TRIAGE_FIELDS.map((f) => [f.id, f]));
if (!DISQUALIFICATION_RULES.length) err('R25-triage-disqualify', 'Brak reguł dyskwalifikacji — każda konfiguracja trafiłaby na wycenę automatyczną.');
if (!Number.isInteger(ROOM_COUNT_EXPERT_THRESHOLD) || ROOM_COUNT_EXPERT_THRESHOLD < 2) {
  err('R25-triage-disqualify', `ROOM_COUNT_EXPERT_THRESHOLD = ${ROOM_COUNT_EXPERT_THRESHOLD} — próg musi być liczbą całkowitą nie mniejszą niż 2.`);
}
for (const r of DISQUALIFICATION_RULES) {
  const f = triageFieldById.get(r.field);
  if (!f) { err('R25-triage-disqualify', `${r.id}: pole "${r.field}" nie istnieje w TRIAGE_FIELDS.`); continue; }
  if (!DISQUALIFICATION_OPERATORS.includes(r.operator)) err('R25-triage-disqualify', `${r.id}: nieznany operator "${r.operator}". Dopuszczalne: ${DISQUALIFICATION_OPERATORS.join(', ')}.`);
  if (!DISQUALIFICATION_OUTCOMES.includes(r.outcome)) err('R25-triage-disqualify', `${r.id}: nieznany skutek "${r.outcome}". Dopuszczalne: ${DISQUALIFICATION_OUTCOMES.join(', ')}.`);
  if (!r.pl) err('R25-triage-disqualify', `${r.id}: brak uzasadnienia dla klienta — ekran Eksperta musi powiedzieć, dlaczego się na nim znalazł.`);
  if (f.kind === 'ENUM') {
    const dict = TRIAGE_DICTS[f.dictionary];
    if (!dict) err('R25-triage-disqualify', `${r.id}: pole ${f.id} wskazuje na nieistniejący słownik "${f.dictionary}".`);
    else if (!dict.some((x) => x.id === r.value)) err('R25-triage-disqualify', `${r.id}: wartość "${r.value}" nie występuje w słowniku ${f.dictionary}. Reguła odwołuje się do odpowiedzi, której klient nie może udzielić.`);
  } else if (f.kind === 'NUMBER') {
    if (!Number.isInteger(r.value) || r.value <= 0) err('R25-triage-disqualify', `${r.id}: próg "${r.value}" nie jest dodatnią liczbą całkowitą.`);
  }
}

// R26 — stan lokalu deklarowany w Triage nie tworzy drugiego słownika obok enuma w bazie.
// leads.declared_property_condition jest enumem (ADR-005, rozszerzony decyzją człowieka
// z 2026-08-19 o RENOVATION). Dorzucenie wartości po stronie formularza bez migracji
// oznacza odpowiedź, której nie da się zapisać; usunięcie — dane, których nie da się odczytać.
const PROPERTY_CONDITION_ENUM = ['FINISHED', 'RENOVATION', 'DEVELOPER_SHELL'];
for (const c of PROPERTY_CONDITIONS) {
  if (!PROPERTY_CONDITION_ENUM.includes(c.id)) {
    err('R26-property-condition', `PROPERTY_CONDITIONS: wartość "${c.id}" nie występuje w enumie leads.declared_property_condition. Rozszerzenie enuma to migracja i osobna decyzja, nie zmiana słownika Triage.`);
  }
}
for (const id of PROPERTY_CONDITION_ENUM) {
  if (!PROPERTY_CONDITIONS.some((c) => c.id === id)) {
    err('R26-property-condition', `PROPERTY_CONDITIONS: brak wartości "${id}" obecnej w enumie — klient nie miałby jak jej zadeklarować.`);
  }
}

// R27 — przesłanka montażu dwuetapowego jest rozstrzygnięta dla KAŻDEGO stanu lokalu.
// Flaga jest przesłanką dla audytora, nie decyzją (FNL-2PHASE: wiążące jest
// quotes.installation_type). Stan lokalu dopisany bez rozstrzygnięcia tej flagi oznacza
// leada, przy którym audytor nie wie, czy ma się rozglądać za montażem dwuetapowym.
const TWO_PHASE_PREMISE = ['RENOVATION', 'DEVELOPER_SHELL'];
for (const c of PROPERTY_CONDITIONS) {
  if (typeof c.suggestsTwoPhase !== 'boolean') {
    err('R27-two-phase-premise', `PROPERTY_CONDITIONS ${c.id}: brak rozstrzygniętej flagi suggestsTwoPhase (decyzja człowieka 2026-08-19). Nowy stan lokalu wymaga odpowiedzi na pytanie, czy jest przesłanką montażu dwuetapowego.`);
    continue;
  }
  const expected = TWO_PHASE_PREMISE.includes(c.id);
  if (c.suggestsTwoPhase !== expected) {
    err('R27-two-phase-premise', `PROPERTY_CONDITIONS ${c.id}: suggestsTwoPhase = ${c.suggestsTwoPhase}, a decyzja z 2026-08-19 mówi ${expected}. Przesłankę montażu dwuetapowego niosą dokładnie: ${TWO_PHASE_PREMISE.join(', ')}.`);
  }
}

// R28 — skalarny próg SLA musi mieć wartość możliwą do spełnienia (WO FLD-GATE-HARDEN, decyzja człowieka 2026-08-21).
// R21 pilnuje, ŻE polityka mierzy dokładnie jedną rzecz. Nie pilnuje, CZY zmierzona liczba jest możliwa:
// `meters: -20` i `meters: 0` przechodziły bramkę do dziś, a promień ujemny albo zerowy to geofencing,
// którego nie da się odblokować — wykryty dopiero przez montera stojącego pod adresem klienta.
// Zakres celowo obejmuje WSZYSTKIE skalary, nie tylko 'meters': mechanizmem pomyłki jest ręcznie wpisany
// literał, ten sam dla dni, sztuk i metrów. Reguła zawężona do jednej jednostki umiera w dniu dodania
// progu w innej — a wtedy nikt jej nie odnowi, bo bramka świeci na zielono.
// Granice: 'hourOfDay' to pora doby (0-23), reszta to wielkości dodatnie. Górnej granicy dla dni, sztuk
// i metrów świadomie NIE ma — próg „za duży" jest decyzją biznesową, a nie niemożliwością.
// Całkowitość: pół dnia, pół sztuki i pół metra przy dokładności GPS rzędu kilku metrów nie znaczą nic.
const SCALAR_RANGES = {
  days:      { min: 1, max: null,  unit: 'dni' },
  count:     { min: 1, max: null,  unit: 'sztuk' },
  hourOfDay: { min: 0, max: 23,    unit: 'godzina doby' },
  meters:    { min: 1, max: null,  unit: 'metrów' },
};
// Fail-safe: skalar dopuszczony w MEASURES, ale bez zakresu, przechodziłby R28 niezauważony.
for (const key of MEASURES) {
  if (key !== 'bands' && !SCALAR_RANGES[key]) {
    err('R28-sla-range', `Skalar "${key}" jest dopuszczony w MEASURES, ale nie ma granic w SCALAR_RANGES. Nowa jednostka bez zakresu to reguła, która jej nie sprawdza.`);
  }
}
for (const p of SLA_POLICIES) {
  for (const [key, range] of Object.entries(SCALAR_RANGES)) {
    const v = p[key];
    if (v === undefined) continue;
    const span = range.max === null ? `>= ${range.min}` : `${range.min}-${range.max}`;
    if (!Number.isInteger(v)) {
      err('R28-sla-range', `${p.id}: ${key} = ${JSON.stringify(v)} nie jest liczbą całkowitą (${range.unit}, dopuszczalne ${span}).`);
      continue;
    }
    if (v < range.min || (range.max !== null && v > range.max)) {
      err('R28-sla-range', `${p.id}: ${key} = ${v} poza dopuszczalnym zakresem ${span} (${range.unit}). Próg spoza zakresu to warunek, którego w terenie nic nie spełni.`);
    }
  }
}

// Ostrzeżenia: elementy PROPOSED = luki wymagające decyzji człowieka
const proposed = [
  ...STATES.filter((s) => s.status === 'PROPOSED').map((s) => `STATE ${s.id}`),
  ...TRANSITIONS.filter((t) => t.status === 'PROPOSED').map((t) => `TRANSITION ${t.id} (${t.note || ''})`),
  ...NOTIFICATIONS.filter((n) => n.status === 'PROPOSED').map((n) => `NOTIFICATION ${n.id} (${n.note || ''})`),
];
for (const p of proposed) warn('R16-proposed', `Wymaga decyzji człowieka: ${p}`);
for (const r of REQUIREMENTS.filter((x) => x.status === 'BLOCKED')) warn('R16-proposed', `Wymaganie zablokowane luką kontraktu: ${r.id}`);

const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');
const result = {
  ok: errors.length === 0 && (!strict || warnings.length === 0),
  counts: { states: STATES.length, transitions: TRANSITIONS.length, notifications: NOTIFICATIONS.length, requirements: REQUIREMENTS.length },
  errors, warnings,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`\n  kk-validate — kontrakty KlikKlima`);
  console.log(`  stany: ${result.counts.states} | przejścia: ${result.counts.transitions} | powiadomienia: ${result.counts.notifications} | wymagania: ${result.counts.requirements}\n`);
  for (const e of errors) console.log(`  ✗ [${e.rule}] ${e.msg}`);
  for (const w of warnings) console.log(`  ⚠ [${w.rule}] ${w.msg}`);
  console.log(errors.length ? `\n  BŁĘDÓW: ${errors.length}, OSTRZEŻEŃ: ${warnings.length}\n` : `\n  ✓ Kontrakty spójne. Ostrzeżeń: ${warnings.length}${strict ? ' (tryb --strict: ostrzeżenia blokują)' : ''}\n`);
}
process.exit(result.ok ? 0 : 1);
