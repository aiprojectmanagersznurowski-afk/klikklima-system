#!/usr/bin/env node
/**
 * kk-trace — macierz identyfikowalności wymaganie → test.
 *
 * Agent zawsze powie „zaimplementowane". To narzędzie mówi, czy istnieje test,
 * który to sprawdza, i czy on przechodzi. Skanuje pliki testowe w poszukiwaniu
 * znacznika `@REQ: <ID>` i zestawia go z rejestrem wymagań.
 *
 *   node tools/kk-trace.mjs                    # raport
 *   node tools/kk-trace.mjs --enforce          # exit 1 gdy IMPLEMENTING/DONE nie ma testu
 *   node tools/kk-trace.mjs --results <plik>   # dołącz wyniki (JSON z vitest/playwright) i sprawdź, czy testy PRZECHODZĄ
 *   node tools/kk-trace.mjs --markdown         # tabela do PR-a
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './kk.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ENFORCE = args.includes('--enforce');
const MARKDOWN = args.includes('--markdown');
const RESULTS = args.includes('--results') ? args[args.indexOf('--results') + 1] : null;

const { REQUIREMENTS } = await import(join(ROOT, config.contractsDir, 'requirements.contract.mjs'));

const SEARCH_ROOTS = ['tests', 'e2e', 'apps', 'packages', 'examples'];
const TEST_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.sql']);
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git', 'generated']);

const isTestFile = (p) => config.testPathPatterns.some((pat) => p.includes(pat));

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (IGNORE.has(e)) continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (TEST_EXT.has(extname(full)) && isTestFile(full)) out.push(full);
  }
  return out;
}

// Zbierz znaczniki @REQ z testów
const TAG = /@REQ:\s*([A-Z0-9][A-Z0-9\-_]*(?:\s*,\s*[A-Z0-9][A-Z0-9\-_]*)*)/g;
const coverage = new Map(); // reqId -> [{file, line, title}]
const unknownTags = [];
const reqIds = new Set(REQUIREMENTS.map((r) => r.id));

for (const rootDir of SEARCH_ROOTS) {
  const abs = join(ROOT, rootDir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(TAG)) {
        for (const id of m[1].split(',').map((s) => s.trim())) {
          const title = (lines[i + 1] || '').trim().slice(0, 80);
          if (!reqIds.has(id)) { unknownTags.push({ id, file: relative(ROOT, file), line: i + 1 }); continue; }
          if (!coverage.has(id)) coverage.set(id, []);
          coverage.get(id).push({ file: relative(ROOT, file), line: i + 1, title });
        }
      }
    });
  }
}

// Opcjonalnie: wyniki testów (obsługiwany format vitest --reporter=json oraz playwright --reporter=json)
let failingFiles = new Set();
if (RESULTS && existsSync(RESULTS)) {
  try {
    const raw = JSON.parse(readFileSync(RESULTS, 'utf8'));
    const collect = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(collect);
      if (node.status === 'failed' || node.outcome === 'unexpected') {
        const f = node.file || node.name || node.location?.file;
        if (f) failingFiles.add(relative(ROOT, f));
      }
      for (const v of Object.values(node)) if (v && typeof v === 'object') collect(v);
    };
    collect(raw);
  } catch (e) {
    console.log(`  ⚠ Nie udało się odczytać wyników testów (${RESULTS}): ${e.message}`);
  }
}

const rows = REQUIREMENTS.map((r) => {
  const tests = coverage.get(r.id) || [];
  const failing = tests.filter((t) => failingFiles.has(t.file));
  let verdict;
  if (tests.length === 0) verdict = 'BRAK TESTU';
  else if (failing.length) verdict = 'TEST CZERWONY';
  else if (RESULTS) verdict = 'POKRYTE ✓';
  else verdict = 'POKRYTE (bez wyników)';
  return { ...r, tests, failing, verdict };
});

const violations = rows.filter(
  (r) => (['IMPLEMENTING', 'DONE'].includes(r.status) && r.tests.length === 0) || r.failing.length > 0
);
const highRiskUncovered = rows.filter((r) => r.risk === 'HIGH' && r.tests.length === 0 && r.status !== 'BLOCKED');

if (MARKDOWN) {
  console.log('| Wymaganie | Domena | Ryzyko | Status | Testy | Werdykt |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| \`${r.id}\` | ${r.domain} | ${r.risk} | ${r.status} | ${r.tests.length} | ${r.verdict} |`);
} else {
  const byDomain = {};
  for (const r of rows) (byDomain[r.domain] ||= []).push(r);
  console.log('\n  kk-trace — pokrycie wymagań testami\n');
  for (const [domain, list] of Object.entries(byDomain)) {
    const covered = list.filter((r) => r.tests.length).length;
    console.log(`  ${domain.padEnd(14)} ${String(covered).padStart(3)}/${String(list.length).padEnd(3)} pokrytych`);
    for (const r of list.filter((x) => x.status !== 'TODO' || x.tests.length)) {
      const mark = r.failing.length ? '✗' : r.tests.length ? '✓' : '·';
      console.log(`    ${mark} ${r.id.padEnd(30)} ${r.status.padEnd(13)} ${r.tests.map((t) => t.file).join(', ') || '—'}`);
    }
  }
  const total = rows.length, cov = rows.filter((r) => r.tests.length).length;
  console.log(`\n  Razem: ${cov}/${total} wymagań ma test (${Math.round((cov / total) * 100)}%).`);
  if (unknownTags.length) {
    console.log(`\n  ⚠ Znaczniki @REQ wskazujące na nieistniejące wymagania (literówka albo wymyślone ID):`);
    for (const u of unknownTags) console.log(`    - ${u.id} w ${u.file}:${u.line}`);
  }
  if (highRiskUncovered.length) {
    console.log(`\n  ⚠ Wymagania HIGH RISK bez żadnego testu:`);
    for (const r of highRiskUncovered) console.log(`    - ${r.id}: ${r.statement.slice(0, 90)}`);
  }
  if (violations.length) {
    console.log(`\n  ✗ NARUSZENIA BRAMKI:`);
    for (const v of violations) console.log(`    - ${v.id}: ${v.failing.length ? 'test czerwony' : `status ${v.status} bez testu`}`);
  }
  console.log('');
}

if (ENFORCE && (violations.length || unknownTags.length)) process.exit(1);
