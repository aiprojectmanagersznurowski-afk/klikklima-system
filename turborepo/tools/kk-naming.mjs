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
 * Użycie:
 *   node tools/kk-naming.mjs            # skan, exit 1 przy znalezisku
 *   node tools/kk-naming.mjs --json
 *   KK_SCAN_DIR=/inna/sciezka node tools/kk-naming.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './kk.config.mjs';

const ROOT = process.env.KK_SCAN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');
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
