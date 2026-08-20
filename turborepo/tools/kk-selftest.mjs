#!/usr/bin/env node
/**
 * kk-selftest — test mutacyjny bramki kontraktowej.
 *
 * Odpowiada na pytanie, którego nie zadaje nikt, dopóki nie jest za późno:
 * „czy ten walidator w ogóle POTRAFI zapalić się na czerwono?"
 *
 * Dla każdej reguły podstawiamy celowo zepsutą kopię kontraktów i sprawdzamy,
 * czy walidator zgłasza DOKŁADNIE tę regułę. Reguła, której nie da się złamać,
 * nie jest bramką — jest dekoracją.
 *
 *   node tools/kk-selftest.mjs
 */
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'contracts');
const VALIDATOR = join(ROOT, 'tools', 'kk-validate.mjs');

/** Każda mutacja: podmiana tekstu w pliku kontraktu + oczekiwana reguła, która ma się zapalić. */
const MUTATIONS = [
  { rule: 'R01-unique-ids',    file: 'funnel.contract.mjs',        from: "id: 'T02',", to: "id: 'T01'," , desc: 'zduplikowane ID przejścia' },
  { rule: 'R02-known-states',  file: 'funnel.contract.mjs',        from: "to: 'AWAITING_INSTALLATION',\n    action: 'markDelivered'", to: "to: 'NIE_ISTNIEJE',\n    action: 'markDelivered'", desc: 'przejście do nieistniejącego stanu' },
  { rule: 'R03-determinism',   file: 'funnel.contract.mjs',        from: "action: 'deliverWithCrew'", to: "action: 'shipByCourier'", desc: 'dwie akcje o tej samej nazwie z tego samego stanu' },
  { rule: 'R04-reachability',  file: 'funnel.contract.mjs',        from: "from: 'AWAITING_AUDIT', to: 'AUDIT_COMPLETED',", to: "from: 'AWAITING_AUDIT', to: 'AWAITING_AUDIT',", desc: 'odcięcie gałęzi grafu' },
  { rule: 'R05-no-dead-end',   file: 'funnel.contract.mjs',        from: "{ id: 'ROLLBACK_RESCHEDULING',    n: 102,", to: "{ id: 'DEAD_STATE', n: 999, kind: 'STAGE', pl: 'x', status: 'STABLE' },\n  { id: 'ROLLBACK_RESCHEDULING',    n: 102,", desc: 'stan bez wyjścia' },
  { rule: 'R07-effect-exists', file: 'funnel.contract.mjs',        from: "effects: ['N1', 'I5']", to: "effects: ['N99', 'I5']", desc: 'efekt wskazujący na nieistniejące powiadomienie' },
  { rule: 'R08-guard-exists',  file: 'funnel.contract.mjs',        from: "guards: ['trackingIdPresent']", to: "guards: ['guardKtoregoNieMa']", desc: 'niezarejestrowany guard' },
  { rule: 'R09-notif-binding', file: 'notifications.contract.mjs', from: "bind: { kind: 'TRANSITION', transition: 'T01' }, vars: ['first_name', 'order_number'], templateKey: 'funnel.auditor_assigned'", to: "bind: { kind: 'TRANSITION', transition: 'T99' }, vars: ['first_name', 'order_number'], templateKey: 'funnel.auditor_assigned'", desc: 'powiadomienie powiązane z nieistniejącym przejściem' },
  { rule: 'R10-template-unique', file: 'notifications.contract.mjs', from: "templateKey: 'funnel.quote_ready'", to: "templateKey: 'funnel.auditor_assigned'", desc: 'dwa powiadomienia w jednym szablonie (kolizja jak N1..N4 w complaints_process.md)' },
  { rule: 'R05-no-dead-end',   file: 'funnel.contract.mjs',        from: "pl: 'Zarchiwizowany (Lost)',           status: 'STABLE',   terminal: true", to: "pl: 'Zarchiwizowany (Lost)',           status: 'STABLE',   terminal: false", desc: 'stan terminalny bez oznaczenia — staje się ślepym zaułkiem' },
  { rule: 'R18-channel-window', file: 'notifications.contract.mjs', from: "channels: ['SMS'], recipient: 'CLIENT', bind: { kind: 'GEO', event: 'auditor_en_route' }", to: "channels: ['WHATSAPP'], recipient: 'CLIENT', bind: { kind: 'GEO', event: 'auditor_en_route' }", desc: 'kanał bez zdefiniowanego okna wysyłki' },
  { rule: 'R19-self-loop-guard', file: 'funnel.contract.mjs', from: "guards: ['installationIsTwoPhase', 'phaseOneNotCompleted']", to: "guards: []", desc: 'pętla własna bez guarda (nieskończone zamykanie etapu I)' },
  { rule: 'R20-push-recipient', file: 'notifications.contract.mjs', from: "channels: ['PUSH'], recipient: 'AUDITOR'", to: "channels: ['PUSH'], recipient: 'CLIENT'", desc: 'push skierowany do klienta, który nie ma aplikacji' },
  { rule: 'R21-sla-shape',     file: 'sla.contract.mjs',           from: "appliesToPriorities: ['CRITICAL', 'MEDIUM']", to: "appliesToPriorities: ['KRYTYCZNY', 'MEDIUM']", desc: 'polski priorytet w polityce SLA' },
  { rule: 'R22-audit-append-only', file: 'rbac.contract.mjs', from: "{ resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: [],                      delete: [] },", to: "{ resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: ['admin'],               delete: [] },", desc: 'admin dostaje prawo edycji rejestru audytowego' },
  { rule: 'R17-var-naming',    file: 'notifications.contract.mjs', from: "vars: ['first_name', 'eta']", to: "vars: ['imie', 'eta']", desc: 'polska nazwa zmiennej szablonu (ADR-002)' },
  { rule: 'R11-req-complete',  file: 'requirements.contract.mjs',  from: "acceptance: ['Sortowanie po bucket_entered_at DESC']", to: "acceptance: []", desc: 'wymaganie bez kryteriów akceptacji' },
  { rule: 'R12-req-refs',      file: 'funnel.contract.mjs',        from: "req: ['FNL-E5-BYPASS']", to: "req: ['FNL-NIE-ISTNIEJE']", desc: 'odwołanie do nieistniejącego wymagania' },
  { rule: 'R13-rbac',          file: 'rbac.contract.mjs',          from: "{ resource: 'clients',            read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] }", to: "{ resource: 'clients',            read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin', 'dyspozytor'] }", desc: 'dyspozytor dostaje prawo usuwania klientów' },
  { rule: 'R14-sla',           file: 'sla.contract.mjs',           from: "{ id: 'URGENT',   maxDays: 7,", to: "{ id: 'URGENT',   maxDays: 2,", desc: 'progi SLA w złej kolejności' },
  { rule: 'R15-queue',         file: 'notifications.contract.mjs', from: 'requiresIdempotencyKey: true', to: 'requiresIdempotencyKey: false', desc: 'ponawianie bez klucza idempotencji' },

  // ── Triage B2C: słownictwo wejścia do lejka (2026-08-19) ──
  // NEW_LEAD ma dokładnie jednego producenta. Te mutacje dowodzą, że reguły R23-R27
  // potrafią zatrzymać zmianę słownika, na którym ten producent stoi.
  { rule: 'R01-unique-ids',        file: 'triage.contract.mjs', from: "id: 'FROM_21_TO_25',", to: "id: 'UP_TO_20',", desc: 'zduplikowane ID pasma metrażu' },
  { rule: 'R23-triage-dict',       file: 'triage.contract.mjs', from: "id: 'UP_TO_20',      pl:", to: "id: 'up_to_20',      pl:", desc: 'ID słownika Triage poza SCREAMING_SNAKE_CASE (ADR-002)' },
  { rule: 'R23-triage-dict',       file: 'triage.contract.mjs', from: "pl: 'Dom',", to: "pl: 'Mieszkanie',", desc: 'dwa kafelki o tej samej etykiecie — odpowiedzi nierozróżnialne dla klienta' },
  { rule: 'R24-triage-bands',      file: 'triage.contract.mjs', from: 'minSqm: 26,   maxSqm: 35', to: 'minSqm: 27,   maxSqm: 35', desc: 'dziura w progach metrażu (26 m² bez reprezentacji)' },
  { rule: 'R24-triage-bands',      file: 'triage.contract.mjs', from: 'minSqm: null, maxSqm: 20', to: 'minSqm: null, maxSqm: 25', desc: 'zachodzenie progów metrażu (21-25 m² w dwóch pasmach)' },
  { rule: 'R24-triage-bands',      file: 'triage.contract.mjs', from: 'minSqm: 36,   maxSqm: null', to: 'minSqm: 36,   maxSqm: 60', desc: 'domknięte ostatnie pasmo — metraż powyżej 60 m² bez reprezentacji' },
  { rule: 'R25-triage-disqualify', file: 'triage.contract.mjs', from: "value: 'COMMERCIAL',", to: "value: 'OFFICE',", desc: 'reguła dyskwalifikacji wskazuje wartość spoza słownika' },
  { rule: 'R25-triage-disqualify', file: 'triage.contract.mjs', from: "field: 'ROOM_COUNT',\n    operator: 'GTE',", to: "field: 'ROOM_NUMBER',\n    operator: 'GTE',", desc: 'reguła odwołuje się do nieistniejącego pola odpowiedzi' },
  { rule: 'R25-triage-disqualify', file: 'triage.contract.mjs', from: 'export const ROOM_COUNT_EXPERT_THRESHOLD = 4;', to: 'export const ROOM_COUNT_EXPERT_THRESHOLD = 0;', desc: 'próg ekranu Eksperta ustawiony na wartość bezsensowną' },
  { rule: 'R26-property-condition', file: 'triage.contract.mjs', from: "  { id: 'RENOVATION',", to: "  { id: 'ATTIC', pl: 'Poddasze', suggestsTwoPhase: false, status: 'STABLE' },\n  { id: 'RENOVATION',", desc: 'stan lokalu spoza enuma w bazie — odpowiedź, której nie da się zapisać' },
  { rule: 'R26-property-condition', file: 'triage.contract.mjs', from: "  { id: 'RENOVATION',      pl: 'W trakcie remontu',        suggestsTwoPhase: true,  status: 'STABLE' },\n", to: '', desc: 'usunięcie wartości obecnej w enumie — dane, których nie da się odczytać' },
  { rule: 'R27-two-phase-premise', file: 'triage.contract.mjs', from: "pl: 'W trakcie remontu',        suggestsTwoPhase: true,", to: "pl: 'W trakcie remontu',        suggestsTwoPhase: false,", desc: 'odebranie przesłanki dwuetapowości stanowi w trakcie remontu (decyzja 2026-08-19)' },
  { rule: 'R27-two-phase-premise', file: 'triage.contract.mjs', from: "pl: 'Wykończony / Zamieszkany', suggestsTwoPhase: false,", to: "pl: 'Wykończony / Zamieszkany',", desc: 'stan lokalu bez rozstrzygnięcia flagi suggestsTwoPhase' },
  { rule: 'R27-two-phase-premise', file: 'triage.contract.mjs', from: "pl: 'Wykończony / Zamieszkany', suggestsTwoPhase: false,", to: "pl: 'Wykończony / Zamieszkany', suggestsTwoPhase: true,", desc: 'przesłanka dwuetapowości przypisana lokalowi wykończonemu' },
  { rule: 'R12-req-refs',          file: 'triage.contract.mjs', from: "req: ['B2C-TRIAGE-DISQUALIFY'],\n    status: 'STABLE',\n  },\n  {", to: "req: ['B2C-NIE-ISTNIEJE'],\n    status: 'STABLE',\n  },\n  {", desc: 'reguła dyskwalifikacji wskazuje nieistniejące wymaganie' },

  // ── Progi przestrzenne (2026-08-21) ──
  // Rozszerzenie MEASURES o 'meters' to moment, w którym reguła pilnująca kształtu pomiaru
  // najłatwiej przestaje czegokolwiek pilnować. Ta mutacja dowodzi, że R21 NADAL łapie próg,
  // który nie mierzy niczego — po rozszerzeniu listy, nie przed nim.
  { rule: 'R21-sla-shape',         file: 'sla.contract.mjs', from: "meters: 20,   req: ['FLD-GEO-UNLOCK']", to: "req: ['FLD-GEO-UNLOCK']", desc: 'próg geofencingu bez żadnego kształtu pomiaru — sam opis i wymaganie, bez liczby' },
  // Odwrotna strona tej samej reguły: nie „zero kształtów", tylko „dwa naraz". Próg z metrami I dniami
  // nie mówi, co właściwie mierzy — kod importujący go musiałby zgadywać, a dokumentacja pokaże jeden
  // z dwóch (kk-codegen bierze PIERWSZY pasujący skalar i drugi znika po cichu).
  { rule: 'R21-sla-shape',         file: 'sla.contract.mjs', from: "meters: 20,   req: ['FLD-GEO-UNLOCK']", to: "meters: 20, days: 14, req: ['FLD-GEO-UNLOCK']", desc: 'próg z dwoma kształtami pomiaru naraz — metry i dni w jednej polityce' },
  // R28: wartość skalara. R21 przepuszcza każdą liczbę, także niemożliwą.
  { rule: 'R28-sla-range',         file: 'sla.contract.mjs', from: "meters: 20,   req: ['FLD-GEO-UNLOCK']", to: "meters: -20,  req: ['FLD-GEO-UNLOCK']", desc: 'ujemny promień geofencingu — warunek, którego monter pod adresem nigdy nie spełni' },
];

let passed = 0;
const failures = [];

// Krok 0 — kontrakt bazowy MUSI być zielony, inaczej test mutacyjny nic nie znaczy.
const base = run(SRC);
if (!base.ok) {
  console.log('\n  ✗ Kontrakt bazowy jest niepoprawny — napraw go przed testem mutacyjnym.\n');
  for (const e of base.errors) console.log(`    ${e.rule}: ${e.msg}`);
  process.exit(1);
}
console.log(`\n  kk-selftest — test mutacyjny bramki kontraktowej`);
console.log(`  baza: zielona (${base.warnings.length} ostrzeżeń) — mutuję ${MUTATIONS.length} reguł\n`);

for (const m of MUTATIONS) {
  const dir = mkdtempSync(join(tmpdir(), 'kk-mut-'));
  try {
    cpSync(SRC, dir, { recursive: true });
    const target = join(dir, m.file);
    const src = readFileSync(target, 'utf8');
    if (!src.includes(m.from)) {
      failures.push(`${m.rule}: mutacja nieaktualna — nie znaleziono kotwicy w ${m.file}`);
      continue;
    }
    writeFileSync(target, src.replace(m.from, m.to));
    const res = run(dir);
    const fired = res.errors.some((e) => e.rule === m.rule);
    if (fired) {
      passed++;
      console.log(`  ✓ ${m.rule.padEnd(20)} wykryto: ${m.desc}`);
    } else {
      failures.push(`${m.rule}: mutacja „${m.desc}" NIE została wykryta (reguła martwa)`);
      console.log(`  ✗ ${m.rule.padEnd(20)} PRZEOCZONO: ${m.desc}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(contractsDir) {
  try {
    const out = execFileSync(process.execPath, [VALIDATOR, '--json'], {
      env: { ...process.env, KK_CONTRACTS_DIR: contractsDir },
      encoding: 'utf8',
    });
    return JSON.parse(out);
  } catch (e) {
    // exit 1 przy błędach walidacji — stdout nadal zawiera JSON
    try { return JSON.parse(e.stdout); } catch { return { ok: false, errors: [{ rule: 'CRASH', msg: String(e.stderr || e) }], warnings: [] }; }
  }
}

console.log(`\n  Wynik: ${passed}/${MUTATIONS.length} reguł udowodniło, że potrafi zablokować zmianę.`);
if (failures.length) {
  console.log('\n  MARTWE REGUŁY:');
  for (const f of failures) console.log(`    - ${f}`);
  console.log('');
  process.exit(1);
}
console.log('  ✓ Każda reguła bramki jest żywa.\n');
