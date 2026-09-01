#!/usr/bin/env node
/**
 * kk-authz-gate — wykrywa Server Actions panelu B2B, które mutują bazę bez bramki `can()`
 * albo pytają o uprawnienie dopiero PO dotknięciu bazy.
 *
 * Pułapka #1 z CLAUDE.md: Prisma omija RLS. Panel B2B nie jest chroniony przez bazę,
 * więc autoryzacja MUSI być jawna w każdej Server Action. Do dziś żaden mechanizm nie
 * wykrywał, że akcja tę bramkę traci — kontrakt RBAC potrafi być wzorowy, a kod może
 * go po prostu nie czytać. Walidator kontraktu sprawdza spójność macierzy uprawnień,
 * nie jej użycie. To narzędzie odpowiada na inne pytanie: czy kod w ogóle o nią pyta.
 *
 * Zakres: WYŁĄCZNIE apps/b2b-web. W apps/b2c-web obowiązuje inny model ochrony
 * (supabase-js + RLS aktywne po stronie bazy) i ta heurystyka byłaby tam błędna.
 *
 * Heurystyka (świadomie prosta i jawna — ma być czytelna, nie sprytna):
 *   Funkcja jest PODEJRZANA, jeśli spełnia OBA warunki:
 *     a) w ciele wywołuje mutację Prismy w kształcie `<klient>.<model>.<metoda>(`,
 *        gdzie <klient> to `prisma` albo parametr callbacku `$transaction`,
 *        a <metoda> ∈ {create, createMany, update, updateMany, delete, deleteMany, upsert}.
 *        Odczyty (findMany/findUnique/count/groupBy/aggregate) nie liczą się.
 *     b) w ciele NIE ma jednocześnie `getCurrentActorRole(` ORAZ `can(`.
 *
 *   Osobna kategoria — NARUSZENIE KOLEJNOŚCI (2026-09-01, WO BATCH-MEDIUM-LOW-CLEANUP p.12):
 *   funkcja MA `can(`, ale pierwsze odwołanie do `prisma.`/`tx.` w jej ciele wypada
 *   PRZED pierwszym `can(`. Bramka po fakcie nie jest bramką — zapytanie już poszło.
 *   Liczy się KAŻDE dotknięcie bazy, także odczyt: `findUnique` przed `can()` wypuszcza
 *   dane osobie, której uprawnienia nikt jeszcze nie sprawdził. Porównanie idzie po
 *   pozycji w źródle, nie po kolejności wykonania — kod z bramką w `if` po zapytaniu
 *   i tak jest podejrzany i wymaga świadomej decyzji, nie milczenia narzędzia.
 *
 * ZAKRES I JEGO OGRANICZENIA (czytaj, zanim uznasz zielony wynik za dowód):
 *   · Skanowane są WYŁĄCZNIE pliki o nazwie `actions.ts` pod `apps/b2b-web/src/app`.
 *     Mutacja w `lib/`, w Route Handlerze (`route.ts`), w komponencie serwerowym
 *     (`page.tsx`) albo w pliku akcji o innej nazwie jest dla tego narzędzia NIEWIDOCZNA.
 *   · Analizowane są tylko EKSPORTOWANE deklaracje `function` na najwyższym poziomie
 *     modułu. Akcja przypisana do `export const foo = async () => …` nie zostanie
 *     sprawdzona — to znany, świadomy brak pokrycia.
 *   · Klienci transakcyjni są rozpoznawani po pierwszym parametrze callbacku
 *     `$transaction`; inne aliasy `prisma` (np. przez destrukturyzację) umkną.
 *
 * Czego to narzędzie NIE dowodzi: że bramka jest POPRAWNA. `can(role, 'leads', 'update')`
 * w akcji usuwającej klienta przejdzie ten skan. To detektor braku, nie audytor treści —
 * poprawność pary zasób/uprawnienie zostaje po stronie recenzji i testów.
 *
 * Wyjątek: komentarz `// AUTHZ-EXEMPT: <powód>` bezpośrednio nad definicją funkcji.
 * Powód jest obowiązkowy — wyjątek bez uzasadnienia to zwykłe wyciszenie bramki.
 *
 * Użycie:
 *   node tools/kk-authz-gate.mjs           # raport, exit 1 przy jakimkolwiek znalezisku
 *   node tools/kk-authz-gate.mjs --json
 *   KK_AUTHZ_SCAN_DIR=/inna/sciezka node tools/kk-authz-gate.mjs
 *
 * Świadomie NIE podpięte do scripts/verify.sh (2026-08-26): repozytorium ma dziś
 * prawdziwe, nienaprawione znaleziska. Bramka CI czerwona od pierwszego dnia nie niesie
 * sygnału. Podpięcie po zamknięciu długu albo po dodaniu baseline'u — wzorem kk-naming.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = process.env.KK_AUTHZ_SCAN_DIR || join(ROOT, 'apps/b2b-web/src/app');
const JSON_OUT = process.argv.includes('--json');

const MUTATING = new Set(['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']);
const GATE_ROLE = 'getCurrentActorRole';
const GATE_CAN = 'can';
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git', 'generated', 'coverage']);

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (IGNORE.has(e)) continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (e === 'actions.ts') out.push(full);
  }
  return out;
}

/** Rekurencyjny obchód poddrzewa — bez skrótów, żeby złapać mutacje w zagnieżdżonych callbackach. */
function visit(node, fn) {
  fn(node);
  ts.forEachChild(node, (c) => visit(c, fn));
}

/**
 * Nazwy klientów transakcyjnych w danej funkcji: `prisma.$transaction(async (tx) => …)`
 * wiąże mutacje pod identyfikatorem `tx`, a nie `prisma`. Bez tego kroku umknęłyby
 * m.in. shipLogisticsOrder/markAsDelivered, które mutują wyłącznie wewnątrz transakcji.
 */
function collectTransactionClients(fnNode) {
  const names = new Set(['prisma']);
  visit(fnNode, (n) => {
    if (!ts.isCallExpression(n)) return;
    const callee = n.expression;
    if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== '$transaction') return;
    for (const arg of n.arguments) {
      if (!ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)) continue;
      const p = arg.parameters[0];
      if (p && ts.isIdentifier(p.name)) names.add(p.name.text);
    }
  });
  return names;
}

function analyzeFunction(fnNode, sourceFile, relPath) {
  const clients = collectTransactionClients(fnNode);
  const mutations = [];
  let hasRoleLookup = false;
  let hasCan = false;
  let firstCanPos = null;
  let firstDbPos = null;
  let firstDb = null;

  visit(fnNode, (n) => {
    if (!ts.isCallExpression(n)) return;
    const callee = n.expression;

    // Bramka: wywołania `getCurrentActorRole()` i `can(...)` jako gołe identyfikatory.
    if (ts.isIdentifier(callee)) {
      if (callee.text === GATE_ROLE) hasRoleLookup = true;
      if (callee.text === GATE_CAN) {
        hasCan = true;
        const p = n.getStart(sourceFile);
        if (firstCanPos === null || p < firstCanPos) firstCanPos = p;
      }
      return;
    }
    if (!ts.isPropertyAccessExpression(callee)) return;

    const method = callee.name.text;

    // Kształt `<klient>.<model>.<metoda>(` — bez tego `formData.update()` czy
    // `supabase.auth.updateUser()` trafiałyby na listę jako fałszywy alarm.
    const modelAccess = callee.expression;
    if (!ts.isPropertyAccessExpression(modelAccess)) return;
    const base = modelAccess.expression;
    if (!ts.isIdentifier(base) || !clients.has(base.text)) return;

    const pos = n.getStart(sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
    const call = `${base.text}.${modelAccess.name.text}.${method}`;

    // Kolejność liczy się dla KAŻDEGO dotknięcia bazy, także odczytu: `findUnique`
    // przed `can()` też wypuszcza dane, zanim ktokolwiek zapytał o uprawnienie.
    if (firstDbPos === null || pos < firstDbPos) {
      firstDbPos = pos;
      firstDb = { line: line + 1, call };
    }

    if (!MUTATING.has(method)) return;
    mutations.push({ line: line + 1, call });
  });

  if (mutations.length === 0) return null;

  const { line } = sourceFile.getLineAndCharacterOfPosition(fnNode.getStart(sourceFile));
  const name = fnNode.name ? fnNode.name.text : '<anonimowa>';
  const exemption = readExemption(fnNode, sourceFile);

  return {
    file: relPath,
    line: line + 1,
    name,
    mutations,
    hasRoleLookup,
    hasCan,
    gated: hasRoleLookup && hasCan,
    // Bramka po fakcie to nie bramka: jeśli pierwsze dotknięcie bazy wypada PRZED
    // pierwszym `can(`, zapytanie już poszło, zanim ktokolwiek zapytał o uprawnienie.
    orderingViolation: hasCan && firstDbPos !== null && firstDbPos < firstCanPos ? firstDb : null,
    exemption,
  };
}

/** `// AUTHZ-EXEMPT: <powód>` w komentarzach bezpośrednio poprzedzających definicję. */
function readExemption(fnNode, sourceFile) {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, fnNode.getFullStart()) || [];
  for (const r of ranges) {
    const text = sourceFile.text.slice(r.pos, r.end);
    const m = text.match(/AUTHZ-EXEMPT:\s*(.+)/);
    if (m) return m[1].replace(/\*\/\s*$/, '').trim();
  }
  return null;
}

const files = existsSync(SCAN_DIR) ? walk(SCAN_DIR).sort() : [];
if (files.length === 0) {
  console.error(`kk-authz-gate: nie znaleziono żadnego actions.ts w ${relative(ROOT, SCAN_DIR) || SCAN_DIR}`);
  process.exit(1);
}

const suspects = [];
const exempted = [];
const ordering = [];
let mutatingFns = 0;
let gatedFns = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  for (const stmt of src.statements) {
    if (!ts.isFunctionDeclaration(stmt) || !stmt.body) continue;
    const isExported = (ts.getModifiers(stmt) || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;

    const res = analyzeFunction(stmt, src, rel);
    if (!res) continue;
    mutatingFns++;
    if (res.exemption) { exempted.push(res); continue; }
    if (res.orderingViolation) { ordering.push(res); continue; }
    if (res.gated) { gatedFns++; continue; }
    suspects.push(res);
  }
}

function missingLabel(r) {
  if (!r.hasRoleLookup && !r.hasCan) return `brak ${GATE_ROLE}() i ${GATE_CAN}()`;
  if (!r.hasCan) return `jest ${GATE_ROLE}(), BRAK ${GATE_CAN}() — rola odczytana, nieużyta`;
  return `jest ${GATE_CAN}(), BRAK ${GATE_ROLE}() — rola spoza sesji serwera`;
}

if (JSON_OUT) {
  console.log(JSON.stringify({
    scannedFiles: files.length,
    mutatingFunctions: mutatingFns,
    gated: gatedFns,
    exempted: exempted.map((e) => ({ file: e.file, line: e.line, name: e.name, reason: e.exemption })),
    suspects: suspects.map((s) => ({ ...s, missing: missingLabel(s) })),
    ordering: ordering.map((o) => ({
      file: o.file, line: o.line, name: o.name,
      firstDbCall: o.orderingViolation.call, firstDbLine: o.orderingViolation.line,
    })),
  }, null, 2));
  process.exit(suspects.length + ordering.length ? 1 : 0);
}

console.log('\n  kk-authz-gate — Server Actions B2B mutujące bazę bez bramki can()\n');
console.log(`  Przeskanowano: ${files.length} plików actions.ts, ${mutatingFns} eksportowanych funkcji mutujących`);
console.log(`  Z bramką: ${gatedFns}   Z wyjątkiem AUTHZ-EXEMPT: ${exempted.length}   Podejrzanych: ${suspects.length}\n`);

if (exempted.length) {
  console.log('  Świadome wyjątki:');
  for (const e of exempted) console.log(`    · ${e.file}:${e.line}  ${e.name} — ${e.exemption}`);
  console.log('');
}

if (ordering.length) {
  console.log(`  ✗ ${ordering.length} funkcji pyta o uprawnienie DOPIERO PO dotknięciu bazy:\n`);
  for (const o of ordering) {
    console.log(`  ${o.file}`);
    console.log(`    :${o.line}  ${o.name}()`);
    console.log(`        :${o.orderingViolation.line}  ${o.orderingViolation.call}()  ← przed pierwszym can()`);
  }
  console.log('\n  Bramka po fakcie nie chroni: zapytanie poszło, zanim ktokolwiek zapytał o rolę.');
  console.log('  can(...) musi wypaść PRZED pierwszym odwołaniem do prisma/tx w ciele funkcji.\n');
}

if (suspects.length === 0 && ordering.length === 0) {
  console.log('  ✓ każda mutująca Server Action pyta o rolę i o uprawnienie przed dotknięciem bazy\n');
  process.exit(0);
}

if (suspects.length === 0) process.exit(1);

const byFile = new Map();
for (const s of suspects) {
  if (!byFile.has(s.file)) byFile.set(s.file, []);
  byFile.get(s.file).push(s);
}

console.log(`  ✗ ${suspects.length} funkcji mutuje bazę bez sprawdzenia uprawnień:\n`);
for (const [file, items] of byFile) {
  console.log(`  ${file}`);
  for (const it of items) {
    console.log(`    :${it.line}  ${it.name}()  [${missingLabel(it)}]`);
    for (const m of it.mutations) console.log(`        :${m.line}  ${m.call}()`);
  }
  console.log('');
}
console.log('  Wzorzec bramki: const actorRole = await getCurrentActorRole();');
console.log("                  if (!actorRole || can(actorRole, '<zasob>', '<uprawnienie>') !== 'yes') return …;");
console.log('  Zasoby i uprawnienia: contracts/rbac.contract.mjs (PERMISSIONS).');
console.log('  Świadomy wyjątek: // AUTHZ-EXEMPT: <powód> nad definicją funkcji.\n');
process.exit(1);
