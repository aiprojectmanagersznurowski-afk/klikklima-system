#!/usr/bin/env node
/**
 * kk-authz-gate — wykrywa Server Actions panelu B2B, które mutują bazę bez bramki `can()`.
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

  visit(fnNode, (n) => {
    if (!ts.isCallExpression(n)) return;
    const callee = n.expression;

    // Bramka: wywołania `getCurrentActorRole()` i `can(...)` jako gołe identyfikatory.
    if (ts.isIdentifier(callee)) {
      if (callee.text === GATE_ROLE) hasRoleLookup = true;
      if (callee.text === GATE_CAN) hasCan = true;
      return;
    }
    if (!ts.isPropertyAccessExpression(callee)) return;

    const method = callee.name.text;
    if (!MUTATING.has(method)) return;

    // Kształt `<klient>.<model>.<metoda>(` — bez tego `formData.update()` czy
    // `supabase.auth.updateUser()` trafiałyby na listę jako fałszywy alarm.
    const modelAccess = callee.expression;
    if (!ts.isPropertyAccessExpression(modelAccess)) return;
    const base = modelAccess.expression;
    if (!ts.isIdentifier(base) || !clients.has(base.text)) return;

    const { line } = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile));
    mutations.push({ line: line + 1, call: `${base.text}.${modelAccess.name.text}.${method}` });
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
    if (res.gated) { gatedFns++; continue; }
    if (res.exemption) { exempted.push(res); continue; }
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
  }, null, 2));
  process.exit(suspects.length ? 1 : 0);
}

console.log('\n  kk-authz-gate — Server Actions B2B mutujące bazę bez bramki can()\n');
console.log(`  Przeskanowano: ${files.length} plików actions.ts, ${mutatingFns} eksportowanych funkcji mutujących`);
console.log(`  Z bramką: ${gatedFns}   Z wyjątkiem AUTHZ-EXEMPT: ${exempted.length}   Podejrzanych: ${suspects.length}\n`);

if (exempted.length) {
  console.log('  Świadome wyjątki:');
  for (const e of exempted) console.log(`    · ${e.file}:${e.line}  ${e.name} — ${e.exemption}`);
  console.log('');
}

if (suspects.length === 0) {
  console.log('  ✓ każda mutująca Server Action pyta o rolę i o uprawnienie\n');
  process.exit(0);
}

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
