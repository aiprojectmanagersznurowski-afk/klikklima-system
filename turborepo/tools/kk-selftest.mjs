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
import { checkWrite } from './guard-core.mjs';

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
  { rule: 'R29-override-shape', file: 'funnel.contract.mjs', from: "status: 'STABLE', override: true,", to: "status: 'STABLE', override: false,", desc: 'override: false — pole udaje decyzję klasyfikacyjną, której nie ma' },
  { rule: 'R29-override-shape', file: 'funnel.contract.mjs', from: "req: ['CRM-ZIMNE-AC3'], status: 'STABLE'", to: "req: ['CRM-ZIMNE-AC3'], status: 'STABLE', override: true", desc: 'override na przejściu łapanym już przez K3 (martwa flaga)' },
  { rule: 'R30-manual-equivalent-shape', file: 'funnel.contract.mjs', from: "status: 'STABLE', manualEquivalent: true,", to: "status: 'STABLE', manualEquivalent: false,", desc: 'manualEquivalent: false — pole udaje decyzję klasyfikacyjną, której nie ma' },
  { rule: 'R30-manual-equivalent-shape', file: 'funnel.contract.mjs', from: "req: ['FNL-E5-E6'], status: 'STABLE'", to: "req: ['FNL-E5-E6'], status: 'STABLE', manualEquivalent: true", desc: 'manualEquivalent na przejściu z aktorem-operatorem (K1 nie działa, nie ma czego anulować)' },
  { rule: 'R20-push-recipient', file: 'notifications.contract.mjs', from: "channels: ['PUSH'], recipient: 'AUDITOR'", to: "channels: ['PUSH'], recipient: 'CLIENT'", desc: 'push skierowany do klienta, który nie ma aplikacji' },
  { rule: 'R21-sla-shape',     file: 'sla.contract.mjs',           from: "appliesToPriorities: ['CRITICAL', 'MEDIUM']", to: "appliesToPriorities: ['KRYTYCZNY', 'MEDIUM']", desc: 'polski priorytet w polityce SLA' },
  { rule: 'R22-audit-append-only', file: 'rbac.contract.mjs', from: "{ resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: [],                      delete: [] },", to: "{ resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: ['admin'],               delete: [] },", desc: 'admin dostaje prawo edycji rejestru audytowego' },
  { rule: 'R17-var-naming',    file: 'notifications.contract.mjs', from: "vars: ['first_name', 'eta']", to: "vars: ['imie', 'eta']", desc: 'polska nazwa zmiennej szablonu (ADR-002)' },
  { rule: 'R11-req-complete',  file: 'requirements.contract.mjs',  from: "acceptance: ['Sortowanie po bucket_entered_at DESC']", to: "acceptance: []", desc: 'wymaganie bez kryteriów akceptacji' },
  { rule: 'R12-req-refs',      file: 'funnel.contract.mjs',        from: "req: ['FNL-E5-BYPASS']", to: "req: ['FNL-NIE-ISTNIEJE']", desc: 'odwołanie do nieistniejącego wymagania' },
  // KOTWICA ZAKTUALIZOWANA 2026-09-24: wiersz `clients` dostał warianty audytor:own i monter:own
  // (CRM-KLI-AC2), więc poprzednia kotwica przestała istnieć i kk-selftest zgłosił „mutacja
  // nieaktualna" — dokładnie tak, jak powinien. Mutacja bada nadal to samo: globalną zasadę
  // „usuwa wyłącznie admin", niezależną od tego, kto ma prawo ODCZYTU.
  { rule: 'R13-rbac',          file: 'rbac.contract.mjs',          from: "{ resource: 'clients',            read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] }", to: "{ resource: 'clients',            read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin', 'dyspozytor'] }", desc: 'dyspozytor dostaje prawo usuwania klientów' },
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

  // ── Etap 0 Field App: aktor systemowy i pytanie warunkowe (2026-09-23) ──
  // R31 i R32 to dwie NOWE reguły, a nowa reguła bez mutacji jest deklaracją, nie bramką.
  // Mutacje celują w te warianty, które przechodzą „na oko": aktor systemowy dopisany do ROLES
  // wygląda jak porządkowanie listy, a warunek widoczności ze złą wartością wygląda jak literówka
  // — a jedno daje konto z uprawnieniami automatu, drugie pytanie, które nigdy się nie pokaże.
  { rule: 'R31-system-actor',      file: 'rbac.contract.mjs', from: "export const ROLES = ['admin', 'dyspozytor', 'audytor', 'monter'];", to: "export const ROLES = ['admin', 'dyspozytor', 'audytor', 'monter', 'system'];", desc: 'aktor systemowy dopisany do ROLES — czyli do dziedziny authorized_users.role: powstaje konto, na które da się zalogować' },
  { rule: 'R31-system-actor',      file: 'rbac.contract.mjs', from: "    capabilities: ['create'],", to: "    capabilities: ['create', 'delete'],", desc: 'automat dostaje prawo kasowania faktur — awaria automatu sprząta po sobie dowody' },
  { rule: 'R31-system-actor',      file: 'rbac.contract.mjs', from: "    req: ['INV-ADVANCE-AUTO'],", to: "    req: [],", desc: 'nadanie dla automatu bez wymagania — uprawnienie, którego nikt nie zamówił i żaden test nie pilnuje' },
  { rule: 'R31-system-actor',      file: 'rbac.contract.mjs', from: "    resource: 'invoices',", to: "    resource: 'faktury',", desc: 'nadanie na zasobie spoza RESOURCES' },
  { rule: 'R32-triage-visibility', file: 'triage.contract.mjs', from: "visibleWhen: { field: 'BUILDING_TYPE', in: ['APARTMENT', 'HOUSE'] }", to: "visibleWhen: { field: 'BUILDING_TYPE', in: ['APARTMENT', 'DOM'] }", desc: 'warunek widoczności z wartością spoza słownika — pytanie o powierzchnię nie pokaże się domom, a oferta wyjdzie z domyślną stawką VAT' },
  { rule: 'R32-triage-visibility', file: 'triage.contract.mjs', from: "visibleWhen: { field: 'BUILDING_TYPE', in: ['APARTMENT', 'HOUSE'] }", to: "visibleWhen: { field: 'TYP_BUDYNKU', in: ['APARTMENT', 'HOUSE'] }", desc: 'warunek widoczności wskazuje nieistniejące pole odpowiedzi' },
  { rule: 'R32-triage-visibility', file: 'triage.contract.mjs', from: "{ id: 'UP_TO_300', pl: 'Do 300 m²',      boundary: 'BELOW_OR_EQUAL', status: 'STABLE' },", to: "{ id: 'UP_TO_300', pl: 'Do 300 m²',      boundary: 'BELOW_OR_EQUAL', maxSqm: 300, status: 'STABLE' },", desc: 'próg 300 m² powtórzony w słowniku Triage — druga kopia liczby, która żyje w kontrakcie SLA' },
];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * SONDY REGUŁ TREŚCIOWYCH (2026-09-24, wymaganie GATE-EVASION-DETECT)
 *
 * Mutacje powyżej dotyczą reguł WALIDATORA (kk-validate na zmutowanym kontrakcie). Reguły
 * wykrywające omijanie bramek żyją gdzie indziej — w `forbiddenPatterns` w tools/kk.config.mjs,
 * egzekwowanych przez guard-core przy ZAPISIE PLIKU. Tamtego mechanizmu nie da się sprawdzić
 * podmianą kontraktu, bo kontraktu on nie czyta.
 *
 * DLACZEGO TO JEST W TYM SAMYM PLIKU, A NIE W NOWYM NARZĘDZIU (decyzja projektowa,
 * contract-steward 2026-09-24): kk-selftest odpowiada na JEDNO pytanie — „czy bramka potrafi
 * zapalić się na czerwono". To pytanie jest identyczne dla obu rodzajów reguł, a rozdzielenie
 * go na dwa narzędzia dałoby drugie miejsce, o którym trzeba pamiętać, i drugi licznik, który
 * może po cichu spaść do zera. Jedno narzędzie, jedno miejsce w scripts/verify.sh, jeden wynik.
 *
 * RÓŻNICA WOBEC MUTACJI: każda sonda deklaruje `fires` — czy reguła MA się zapalić.
 * Sondy NEGATYWNE (`fires: false`) są tu równie ważne jak pozytywne i nie są ozdobą.
 * Reguła treściowa jest regexem nad cudzym kodem: reguła, która łapie przypadki legalne,
 * zostanie wyciszona przy pierwszym fałszywym alarmie — czyli w praktyce usunięta. Sonda
 * negatywna jest jedynym, co trzyma jej zakres na miejscu przy późniejszym „poszerzę trochę".
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const PROD = 'apps/b2b-web/src/app/(dashboard)/leads/probe.ts';
const TEST = 'apps/b2b-web/tests/probe.test.ts';

const CONTENT_PROBES = [
  // ── gate-evasion-split-identifier ──
  {
    rule: 'gate-evasion-split-identifier', file: PROD, fires: true,
    content: "const TBL = ['kli', 'enci'].join('');\n",
    desc: 'identyfikator sklejony z tablicy literałów joinem z pustym separatorem (wzorzec z feat/crm-cards)',
  },
  {
    rule: 'gate-evasion-split-identifier', file: PROD, fires: true,
    content: 'const TBL = "zespoly_" + "monterskie";\n',
    desc: 'identyfikator sklejony konkatenacją dwóch literałów bez spacji',
  },
  {
    // Zakres celowo ogólny: reguła NIE zna słownika porzuconych nazw i ma łapać także
    // sklejenie nazwy, której nikt jeszcze nie porzucił. Ta sonda pilnuje, żeby przy
    // przyszłym „doprecyzowaniu" reguły nie przypięto jej do listy z adr002-pl-tables.
    rule: 'gate-evasion-split-identifier', file: PROD, fires: true,
    content: "const col = ['price', '_netto'].join('');\n",
    desc: 'sklejanie działa na dowolnym identyfikatorze, nie tylko na dzisiejszej liście porzuconych nazw',
  },
  {
    rule: 'gate-evasion-split-identifier', file: PROD, fires: false,
    content: "const label = ['Jan', 'Kowalski'].join(', ');\nconst msg = 'Witaj, ' + name;\n",
    desc: 'NEGATYWNA: join z separatorem i konkatenacja z tekstem dla człowieka są legalne',
  },
  {
    rule: 'gate-evasion-split-identifier', file: TEST, fires: false,
    content: "const UNSAFE_TYPE = ['an', 'y'].join('');\n",
    desc: 'NEGATYWNA: test budujący zakazany token, żeby sam się o niego nie odbić (dwa takie pliki istnieją w repo)',
  },

  // ── gate-evasion-prisma-recast ──
  {
    rule: 'gate-evasion-prisma-recast', file: PROD, fires: true,
    content: 'const db = prisma as unknown as SomeDynamicType;\n',
    desc: 'klient Prismy przepuszczony przez podwójne rzutowanie — as any w przebraniu',
  },
  {
    rule: 'gate-evasion-prisma-recast', file: PROD, fires: true,
    content: 'const d = client as unknown as PrismaLeadDelegate;\n',
    desc: 'rzutowanie NA typ prismowy — druga strona tego samego obejścia',
  },
  {
    // UWAGA NA KSZTAŁT TEJ SONDY (pomyłka popełniona i naprawiona 2026-09-24): operandem
    // rzutowania musi być identyfikator prismowy, a nie CEL PRZYPISANIA. `const mockPrisma =
    // raw as unknown as X` reguły NIE zapala i zapalać nie powinna — rzutowane jest `raw`.
    // Reguła patrzy na to, CO jest rzutowane, i to jest właściwe zachowanie.
    rule: 'gate-evasion-prisma-recast', file: TEST, fires: true,
    content: 'const client = mockPrisma as unknown as Whatever;\n',
    desc: 'reguła obowiązuje także w testach — atrapa udająca typowanego klienta to ten sam problem',
  },
  {
    rule: 'gate-evasion-prisma-recast', file: TEST, fires: false,
    content: 'const missing = undefined as unknown as string;\nconst n = badWeekday as unknown as number;\n',
    desc: 'NEGATYWNA: ~20 legalnych użyć `as unknown as` w repo (podsuwanie złego typu walidacji) NIE może zapalać bramki',
  },
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

// ── Sondy reguł treściowych (guard-core + forbiddenPatterns z kk.config.mjs) ──
console.log(`\n  sondy reguł treściowych (omijanie bramek): ${CONTENT_PROBES.length}\n`);
let probesPassed = 0;
for (const p of CONTENT_PROBES) {
  // role: null + enforceContract: false => uruchamia WYŁĄCZNIE sekcję 3 (wzorce zakazane
  // w treści). Bez tego sonda odbijałaby się od reguł ścieżkowych, nie od badanej reguły.
  const res = checkWrite(p.file, p.content, { role: null, enforceContract: false });
  const firedRule = res.blocked ? res.rule : null;
  const ok = p.fires ? firedRule === p.rule : firedRule !== p.rule;
  const tag = p.fires ? 'wykryto' : 'przepuszczono';
  if (ok) {
    probesPassed++;
    console.log(`  ✓ ${p.rule.padEnd(30)} ${tag}: ${p.desc}`);
    // Dowodem żywotności jest KOMUNIKAT, nie licznik — ta sama zasada co przy mutacjach.
    if (p.fires) console.log(`      └─ ${res.reason.slice(0, 150)}`);
  } else if (p.fires) {
    failures.push(`${p.rule}: sonda „${p.desc}" NIE zapaliła reguły (zapaliło się: ${firedRule || 'nic'}) — reguła martwa`);
    console.log(`  ✗ ${p.rule.padEnd(30)} PRZEOCZONO: ${p.desc}`);
  } else {
    failures.push(`${p.rule}: FAŁSZYWY ALARM na przypadku legalnym „${p.desc}" — reguła w tym kształcie zostanie wyciszona`);
    console.log(`  ✗ ${p.rule.padEnd(30)} FAŁSZYWY ALARM: ${p.desc}`);
  }
}

console.log(`\n  Wynik: ${passed}/${MUTATIONS.length} reguł walidatora udowodniło, że potrafi zablokować zmianę.`);
console.log(`         ${probesPassed}/${CONTENT_PROBES.length} sond reguł treściowych zachowało się zgodnie z zamiarem.`);
if (failures.length) {
  console.log('\n  MARTWE REGUŁY:');
  for (const f of failures) console.log(`    - ${f}`);
  console.log('');
  process.exit(1);
}
console.log('  ✓ Każda reguła bramki jest żywa.\n');
