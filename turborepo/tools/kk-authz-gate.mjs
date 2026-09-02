#!/usr/bin/env node
/**
 * kk-authz-gate — wykrywa kod panelu B2B, który dotyka bazy (mutacją LUB odczytem)
 * bez bramki `can()` albo pyta o uprawnienie dopiero PO dotknięciu bazy.
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
 * DLACZEGO ODCZYTY (2026-09-03, WO docs/workorders/SEC-READ-GATES.md, decyzja D4):
 *   Pierwsza wersja narzędzia liczyła wyłącznie mutacje i wprost deklarowała, że
 *   „odczyty się nie liczą". Audyt znalazł SIEDEM eksportowanych funkcji odczytowych
 *   (getCustomers, getCrews ×2, getAuditors, getInstallations, getUpcomingServices,
 *   getIncidents) bez jakiejkolwiek bramki roli — zalogowany `monter`/`audytor` czytał
 *   dane osobowe wszystkich klientów. Skaner nie mógł tego zobaczyć z definicji.
 *   Ósmy przypadek — `customers/[id]/page.tsx` wołający `prisma.klienci.findUnique`
 *   BEZPOŚREDNIO ze strony, z pominięciem `actions.ts` — wymykał się też kryterium
 *   pliku. Był to zamknięty łańcuch ataku: audytor brał UUID klienta z leada, do
 *   którego miał prawo, i przez URL czytał kartotekę z leadami innych audytorów.
 *   Stąd oba rozszerzenia: drugi zbiór metod ORAZ szerszy zbiór plików.
 *
 * Heurystyka (świadomie prosta i jawna — ma być czytelna, nie sprytna):
 *   Odwołaniem do bazy jest wywołanie w kształcie `<klient>.<model>.<metoda>(`,
 *   gdzie <klient> to `prisma` albo parametr callbacku `$transaction`, oraz
 *   `<klient>.$queryRaw|$queryRawUnsafe|$executeRaw|$executeRawUnsafe` (także jako
 *   tagged template). Metody dzielą się na:
 *     · MUTUJĄCE: create, createMany, update, updateMany, delete, deleteMany, upsert,
 *       $executeRaw, $executeRawUnsafe
 *     · ODCZYTOWE: findMany, findUnique, findFirst, findUniqueOrThrow, findFirstOrThrow,
 *       count, groupBy, aggregate, $queryRaw, $queryRawUnsafe
 *
 *   Funkcja MUTUJĄCA jest PODEJRZANA, gdy w ciele NIE ma jednocześnie
 *   `getCurrentActorRole(` ORAZ `can(`.
 *
 *   Funkcja wyłącznie ODCZYTOWA jest PODEJRZANA, gdy w ciele NIE ma `can(`.
 *   `getCurrentActorRole` nie jest tu warunkiem: bez roli nie ma czego podać do `can()`,
 *   a rola bywa czytana pomocnikiem o innej nazwie. Wymóg jest jeden i sprawdzalny —
 *   uprawnienie ma być sprawdzone, zanim dane wyjdą z bazy.
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
 *   · Skanowane są WSZYSTKIE pliki `.ts`/`.tsx` pod `apps/b2b-web/src/app` — czyli już nie
 *     tylko `actions.ts`, ale też `page.tsx`, `layout.tsx` i `route.ts`. Kryterium „plik
 *     nazywa się actions.ts" przepuszczało zapytanie wołane wprost z komponentu serwerowego.
 *   · NADAL NIEWIDOCZNE: cokolwiek POZA `apps/b2b-web/src/app` — `src/lib/`, `src/utils/`,
 *     `src/components/`, pakiety w `packages/`. Zapytanie schowane w pomocniku z `lib/`
 *     i wołane z zabramkowanej akcji jest dla tego narzędzia niewidzialne w obie strony:
 *     nie zgłosi go, ale też nie zaliczy bramki wołającego pomocnikowi.
 *   · Analizowane są tylko EKSPORTOWANE deklaracje `function` na najwyższym poziomie
 *     modułu (`export function`, `export default function`). Akcja przypisana do
 *     `export const foo = async () => …` nie zostanie sprawdzona — to znany, świadomy
 *     brak pokrycia. Sprawdzone 2026-09-03: w skanowanym zakresie nie ma dziś ani jednego
 *     takiego eksportu dotykającego Prismy, więc dziura jest realna, ale pusta.
 *   · Zapytanie w funkcji NIEEKSPORTOWANEJ (pomocnik w tym samym pliku) nie jest liczone
 *     osobno; liczy się dopiero, gdy stoi w ciele funkcji eksportowanej.
 *   · Klienci transakcyjni są rozpoznawani po pierwszym parametrze callbacku
 *     `$transaction`; inne aliasy `prisma` (np. przez destrukturyzację) umkną.
 *   · Route Handlery są skanowane tą samą heurystyką co akcje, ale ich `GET`/`POST` to
 *     osobny model ryzyka (brak sesji Next w niektórych ścieżkach) — zielony wynik nie
 *     zastępuje tu recenzji.
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
 * Podpięte do scripts/verify.sh (2026-08-26 dla mutacji, 2026-09-03 dla odczytów).
 * Rozszerzenie o odczyty ląduje PO naprawie siedmiu funkcji i strony 360 — bramka
 * czerwona od pierwszego dnia nie niesie sygnału, a tryb ostrzegawczy uczy ignorować
 * własny wynik, więc etapowania świadomie nie ma.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIR = process.env.KK_AUTHZ_SCAN_DIR || join(ROOT, 'apps/b2b-web/src/app');
const JSON_OUT = process.argv.includes('--json');

const MUTATING = new Set(['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']);
const READING = new Set([
  'findMany', 'findUnique', 'findFirst', 'findUniqueOrThrow', 'findFirstOrThrow',
  'count', 'groupBy', 'aggregate',
]);
// Surowy SQL wisi bezpośrednio na kliencie (`prisma.$queryRaw`), bez segmentu modelu,
// i bywa wołany jako tagged template — obsługiwany osobną gałęzią niżej.
const RAW_READING = new Set(['$queryRaw', '$queryRawUnsafe']);
const RAW_MUTATING = new Set(['$executeRaw', '$executeRawUnsafe']);
const SCANNED_EXT = /\.(ts|tsx)$/;
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
    // Od 2026-09-03 skanujemy każdy moduł TS pod app/, nie tylko `actions.ts`:
    // `customers/[id]/page.tsx` wołał prisma.klienci.findUnique wprost ze strony.
    else if (SCANNED_EXT.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) out.push(full);
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
  const reads = [];
  let hasRoleLookup = false;
  let hasCan = false;
  let firstCanPos = null;
  let firstDbPos = null;
  let firstDb = null;

  /** Wspólne księgowanie dotknięcia bazy — z wywołania i z tagged template. */
  function record(node, call, kind) {
    const pos = node.getStart(sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
    // Kolejność liczy się dla KAŻDEGO dotknięcia bazy, także odczytu: `findUnique`
    // przed `can()` też wypuszcza dane, zanim ktokolwiek zapytał o uprawnienie.
    if (firstDbPos === null || pos < firstDbPos) {
      firstDbPos = pos;
      firstDb = { line: line + 1, call };
    }
    (kind === 'mutation' ? mutations : reads).push({ line: line + 1, call });
  }

  /** `prisma.$queryRaw`/`tx.$executeRaw` — klient bez segmentu modelu. */
  function rawKind(expr) {
    if (!ts.isPropertyAccessExpression(expr)) return null;
    const base = expr.expression;
    if (!ts.isIdentifier(base) || !clients.has(base.text)) return null;
    const m = expr.name.text;
    if (RAW_MUTATING.has(m)) return { kind: 'mutation', call: `${base.text}.${m}` };
    if (RAW_READING.has(m)) return { kind: 'read', call: `${base.text}.${m}` };
    return null;
  }

  visit(fnNode, (n) => {
    // `prisma.$queryRaw\`SELECT …\`` to tagged template, nie CallExpression.
    if (ts.isTaggedTemplateExpression(n)) {
      const raw = rawKind(n.tag);
      if (raw) record(n, raw.call, raw.kind);
      return;
    }
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

    const raw = rawKind(callee);
    if (raw) { record(n, raw.call, raw.kind); return; }

    const method = callee.name.text;

    // Kształt `<klient>.<model>.<metoda>(` — bez tego `formData.update()` czy
    // `supabase.auth.updateUser()` trafiałyby na listę jako fałszywy alarm.
    const modelAccess = callee.expression;
    if (!ts.isPropertyAccessExpression(modelAccess)) return;
    const base = modelAccess.expression;
    if (!ts.isIdentifier(base) || !clients.has(base.text)) return;

    const call = `${base.text}.${modelAccess.name.text}.${method}`;
    if (MUTATING.has(method)) record(n, call, 'mutation');
    else if (READING.has(method)) record(n, call, 'read');
  });

  if (mutations.length === 0 && reads.length === 0) return null;

  const { line } = sourceFile.getLineAndCharacterOfPosition(fnNode.getStart(sourceFile));
  const name = fnNode.name ? fnNode.name.text : '<anonimowa>';
  const exemption = readExemption(fnNode, sourceFile);
  // Funkcja, która i czyta, i mutuje, jest oceniana jako mutująca — surowsze kryterium.
  const kind = mutations.length ? 'mutation' : 'read';

  return {
    file: relPath,
    line: line + 1,
    name,
    kind,
    mutations,
    reads,
    hasRoleLookup,
    hasCan,
    // Mutacja: rola z sesji serwera ORAZ uprawnienie. Sam odczyt: wystarczy `can(` —
    // bez roli nie ma czego do niego podać, a rola bywa czytana pomocnikiem o innej nazwie.
    gated: kind === 'mutation' ? hasRoleLookup && hasCan : hasCan,
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
  console.error(`kk-authz-gate: nie znaleziono żadnego pliku .ts/.tsx w ${relative(ROOT, SCAN_DIR) || SCAN_DIR}`);
  process.exit(1);
}

const suspects = [];
const exempted = [];
const ordering = [];
let mutatingFns = 0;
let readingFns = 0;
let gatedFns = 0;
let dbFiles = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  // Tani filtr wstępny: plik bez słowa `prisma` nie ma czego zgłosić. Skanujemy teraz
  // cały katalog app/, więc AST budujemy tylko tam, gdzie może być znalezisko.
  if (!text.includes('prisma')) continue;
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let fileTouchedDb = false;

  for (const stmt of src.statements) {
    if (!ts.isFunctionDeclaration(stmt) || !stmt.body) continue;
    const isExported = (ts.getModifiers(stmt) || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;

    const res = analyzeFunction(stmt, src, rel);
    if (!res) continue;
    fileTouchedDb = true;
    if (res.kind === 'mutation') mutatingFns++; else readingFns++;
    if (res.exemption) { exempted.push(res); continue; }
    if (res.orderingViolation) { ordering.push(res); continue; }
    if (res.gated) { gatedFns++; continue; }
    suspects.push(res);
  }
  if (fileTouchedDb) dbFiles++;
}

function missingLabel(r) {
  if (r.kind === 'read') return `odczyt bez ${GATE_CAN}() — dane wychodzą z bazy bez sprawdzenia uprawnienia`;
  if (!r.hasRoleLookup && !r.hasCan) return `brak ${GATE_ROLE}() i ${GATE_CAN}()`;
  if (!r.hasCan) return `jest ${GATE_ROLE}(), BRAK ${GATE_CAN}() — rola odczytana, nieużyta`;
  return `jest ${GATE_CAN}(), BRAK ${GATE_ROLE}() — rola spoza sesji serwera`;
}

if (JSON_OUT) {
  console.log(JSON.stringify({
    scannedFiles: files.length,
    filesTouchingDb: dbFiles,
    mutatingFunctions: mutatingFns,
    readingFunctions: readingFns,
    gated: gatedFns,
    exempted: exempted.map((e) => ({ file: e.file, line: e.line, name: e.name, kind: e.kind, reason: e.exemption })),
    suspects: suspects.map((s) => ({ ...s, missing: missingLabel(s) })),
    ordering: ordering.map((o) => ({
      file: o.file, line: o.line, name: o.name, kind: o.kind,
      firstDbCall: o.orderingViolation.call, firstDbLine: o.orderingViolation.line,
    })),
  }, null, 2));
  process.exit(suspects.length + ordering.length ? 1 : 0);
}

console.log('\n  kk-authz-gate — kod B2B dotykający bazy bez bramki can()\n');
console.log(`  Przeskanowano: ${files.length} plików .ts/.tsx pod app/, z czego ${dbFiles} dotyka Prismy`);
console.log(`  Eksportowanych funkcji: ${mutatingFns} mutujących, ${readingFns} wyłącznie odczytowych`);
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
  console.log('  ✓ każde dotknięcie bazy — mutacja i odczyt — poprzedzone sprawdzeniem uprawnienia\n');
  process.exit(0);
}

if (suspects.length === 0) process.exit(1);

const byFile = new Map();
for (const s of suspects) {
  if (!byFile.has(s.file)) byFile.set(s.file, []);
  byFile.get(s.file).push(s);
}

const nMut = suspects.filter((s) => s.kind === 'mutation').length;
const nRead = suspects.length - nMut;
console.log(`  ✗ ${suspects.length} funkcji dotyka bazy bez sprawdzenia uprawnień (${nMut} mutujących, ${nRead} odczytowych):\n`);
for (const [file, items] of byFile) {
  console.log(`  ${file}`);
  for (const it of items) {
    console.log(`    :${it.line}  ${it.name}()  [${missingLabel(it)}]`);
    for (const m of it.kind === 'mutation' ? it.mutations : it.reads) {
      console.log(`        :${m.line}  ${m.call}()`);
    }
  }
  console.log('');
}
if (nRead) {
  console.log('  Odczyt bez bramki to wyciek, nie niedopatrzenie: Prisma omija RLS, więc lista');
  console.log('  bez can(...) oddaje KAŻDEMU zalogowanemu wszystko, co zwróci zapytanie.\n');
}
console.log('  Wzorzec bramki: const actorRole = await getCurrentActorRole();');
console.log("                  if (!actorRole || can(actorRole, '<zasob>', '<uprawnienie>') !== 'yes') return …;");
console.log('  Zasoby i uprawnienia: contracts/rbac.contract.mjs (PERMISSIONS).');
console.log('  Świadomy wyjątek: // AUTHZ-EXEMPT: <powód> nad definicją funkcji.\n');
process.exit(1);
