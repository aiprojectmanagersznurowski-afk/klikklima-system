#!/usr/bin/env node
/**
 * kk-naming — skan całego repozytorium pod kątem konwencji z ADR-002.
 *
 * Hook `guard-forbidden` blokuje pojedynczy zapis. To narzędzie odpowiada na inne
 * pytanie: co już leży w repozytorium i łamie konwencję, mimo że nikt tego dziś nie zapisał.
 * Bez tego kroku decyzja obowiązuje wyłącznie kod napisany po jej podjęciu.
 *
 * Reguły pochodzą z tools/kk.config.mjs (wpisy adr002-*), żeby istniało jedno źródło prawdy.
 *
 * Baseline (KK-NAMING-BASELINE, 2026-08-19): repozytorium niesie udokumentowany dług
 * sprzed ADR-002 (m.in. żywa ścieżka leada w apps/b2c-web/app/actions/saveLead.ts oraz
 * stare migracje SQL). Migracja tego długu to osobny projekt. Bramka commitowa nie może
 * być czerwona na starcie, bo wtedy nie niesie sygnału — dlatego pre-commit pyta wyłącznie
 * o PRZYROST ponad zamrożony stan (--check-baseline). Pełny skan bez flag zostaje bez zmian:
 * to narzędzie audytowe ma nadal pokazywać całą prawdę o repozytorium na żądanie.
 *
 * Klucz baseline'u to `ścieżka::id_reguły` z LICZBĄ trafień, świadomie bez numeru linii:
 * numery dryfują przy każdej niezwiązanej edycji pliku, a licznik i tak wykrywa nowe
 * naruszenie tej samej reguły w pliku, który dług już ma.
 *
 * Użycie:
 *   node tools/kk-naming.mjs            # pełny skan, exit 1 przy jakimkolwiek znalezisku
 *   node tools/kk-naming.mjs --json
 *   node tools/kk-naming.mjs --update-baseline   # zamraża dzisiejszy stan (świadoma decyzja)
 *   node tools/kk-naming.mjs --check-baseline    # exit 1 tylko przy PRZYROŚCIE (pre-commit)
 *   KK_SCAN_DIR=/inna/sciezka node tools/kk-naming.mjs
 *   KK_NAMING_BASELINE=/inna/sciezka.json node tools/kk-naming.mjs --check-baseline
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './kk.config.mjs';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.KK_SCAN_DIR || join(TOOLS_DIR, '..');
const JSON_OUT = process.argv.includes('--json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const CHECK_BASELINE = process.argv.includes('--check-baseline');
// Baseline leży przy narzędziu, nie przy skanowanym katalogu — KK_SCAN_DIR służy do testów
// bramki na sztucznym drzewie i nie powinien podmieniać zamrożonego stanu repozytorium.
const BASELINE_PATH = process.env.KK_NAMING_BASELINE || join(TOOLS_DIR, 'kk-naming-baseline.json');
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'generated', '.turbo']);

const rules = config.forbiddenPatterns
  .filter((p) => p.id.startsWith('adr002-'))
  .map((p) => ({ ...p, rx: new RegExp(p.re, 'g'), appliesRx: new RegExp(p.appliesTo) }));

if (rules.length === 0) {
  console.error('kk-naming: brak reguł adr002-* w kk.config.mjs — nic do sprawdzenia.');
  process.exit(1);
}

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP.has(name) || name.startsWith('.') && name !== '.claude') continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const findings = [];
let scanned = 0;

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  const applicable = rules.filter((r) => r.appliesRx.test(rel));
  if (applicable.length === 0) continue;
  scanned++;
  let lines;
  try { lines = readFileSync(file, 'utf8').split('\n'); } catch { continue; }
  lines.forEach((line, i) => {
    // Komentarze objaśniające starą nazwę są dozwolone — chodzi o kod, nie o notatki.
    const isComment = /^\s*(\/\/|\/\*|\*|--|#)/.test(line);
    for (const r of applicable) {
      r.rx.lastIndex = 0;
      const m = r.rx.exec(line);
      if (!m) continue;
      if (isComment) continue;
      if ((r.allowIn || []).some((a) => rel.includes(a))) continue;
      findings.push({ file: rel, line: i + 1, rule: r.id, match: m[0], msg: r.msg, text: line.trim().slice(0, 120) });
    }
  });
}

// Agregacja do postaci `ścieżka::id_reguły` -> liczba trafień. Sortowanie kluczy jest
// istotne: baseline trafia do repozytorium, więc jego diff ma być czytelny dla człowieka.
function aggregate(items) {
  const counts = {};
  for (const f of items) {
    const key = `${f.file}::${f.rule}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.keys(counts).sort().map((k) => [k, counts[k]]));
}

if (UPDATE_BASELINE) {
  const counts = aggregate(findings);
  const baseline = { generatedAt: new Date().toISOString(), counts, total: findings.length };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`  ✓ baseline nazewnictwa zapisany: ${relative(process.cwd(), BASELINE_PATH)}`);
  console.log(`    zamrożono ${findings.length} naruszeń w ${Object.keys(counts).length} parach plik::reguła.`);
  console.log('    To jest ZAAKCEPTOWANY dług, nie zgoda na nowy. Migracja: docs/architecture/NAMING.md');
  process.exit(0);
}

if (CHECK_BASELINE) {
  if (!existsSync(BASELINE_PATH)) {
    // Fail closed: brak baseline'u nie może cicho przepuszczać nowych naruszeń.
    console.log(`  ✗ kk-naming: brak baseline'u (${BASELINE_PATH}).`);
    console.log('    Uruchom świadomie: node tools/kk-naming.mjs --update-baseline');
    process.exit(1);
  }
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (e) {
    console.log(`  ✗ kk-naming: baseline nieczytelny (${BASELINE_PATH}): ${e.message}`);
    process.exit(1);
  }
  const accepted = baseline.counts || {};
  const current = aggregate(findings);
  const regressions = [];
  for (const [key, count] of Object.entries(current)) {
    const was = accepted[key] || 0;
    if (count > was) regressions.push({ key, count, was, delta: count - was });
  }

  if (regressions.length === 0) process.exit(0);

  const newFindings = new Set(regressions.map((r) => r.key));
  console.log(`  ✗ nazewnictwo ADR-002: ${regressions.reduce((a, r) => a + r.delta, 0)} NOWYCH naruszeń ponad baseline\n`);
  for (const r of regressions) {
    const [file, rule] = r.key.split('::');
    console.log(`  ${file}  [${rule}]  ${r.was} -> ${r.count}  (+${r.delta})`);
    // Porównanie jest licznikowe, więc nie wskazuje KTÓRE trafienie jest nowe.
    // Przy pliku z zaakceptowanym długiem wypisujemy próbkę, nie całą listę.
    const hits = findings.filter((f) => `${f.file}::${f.rule}` === r.key);
    for (const f of hits.slice(0, 10)) {
      console.log(`    :${f.line}  ${f.match}`);
      console.log(`      ${f.text}`);
    }
    if (hits.length > 10) console.log(`    … i ${hits.length - 10} dalszych trafień tej reguły w tym pliku`);
    if (r.was > 0) console.log(`    (plik miał już ${r.was} zaakceptowanych trafień tej reguły — nowe jest ${r.delta} z powyższych)`);
    console.log('');
  }
  console.log('  Słownik przekładu: docs/architecture/NAMING.md');
  console.log('  Baseline zamraża stary dług; nowe naruszenia poprawia się od razu.');
  process.exit(1);
}

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned, findings }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

if (findings.length === 0) {
  console.log(`  ✓ nazewnictwo ADR-002: ${scanned} plików przeskanowanych, 0 naruszeń`);
  process.exit(0);
}

console.log(`  ✗ nazewnictwo ADR-002: ${findings.length} naruszeń w ${new Set(findings.map((f) => f.file)).size} plikach\n`);
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}
for (const [file, items] of byFile) {
  console.log(`  ${file}`);
  for (const it of items) {
    console.log(`    :${it.line}  ${it.match}  [${it.rule}]`);
    console.log(`      ${it.text}`);
  }
  console.log('');
}
console.log('  Słownik przekładu: docs/architecture/NAMING.md');
process.exit(1);
