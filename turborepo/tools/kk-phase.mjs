#!/usr/bin/env node
/**
 * kk-phase — bramka fazowa oparta na diffie gita.
 *
 * PO CO TO ISTNIEJE
 * W Claude Code rozdział ról egzekwują uprawnienia zapisu: implementer fizycznie
 * nie zapisze pliku testowego, bo hook zna nazwę subagenta. Antigravity nie podaje
 * nazwy agenta w payloadzie hooka, więc tamtej ochrony nie da się odtworzyć wprost.
 *
 * Zamiast pytać KTO zmienił plik, ta bramka pyta CO się zmieniło w danej fazie.
 * Jest to ochrona słabsza w czasie (działa po fakcie, nie przy zapisie), ale
 * mocniejsza w zasięgu: działa w każdym IDE, w CI i przy commicie, niezależnie
 * od tego, czy narzędzie w ogóle ma pojęcie subagenta.
 *
 * UŻYCIE
 *   node tools/kk-phase.mjs red     # faza RED: wolno ruszać wyłącznie testy
 *   node tools/kk-phase.mjs green   # faza GREEN: nie wolno ruszać testów ani kontraktu
 *   node tools/kk-phase.mjs contract # faza CONTRACT: wyłącznie kontrakt i artefakty generowane
 *   node tools/kk-phase.mjs --base main --json
 *
 * Domyślnie porównuje z HEAD (zmiany niezacommitowane). Z --base <ref> porównuje z gałęzią.
 */
import { execSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './kk.config.mjs';

const ROOT = process.env.KK_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const phase = argv.find((a) => !a.startsWith('-'));
const JSON_OUT = argv.includes('--json');
const baseIdx = argv.indexOf('--base');
const base = baseIdx >= 0 ? argv[baseIdx + 1] : null;

if (!['red', 'green', 'contract'].includes(phase)) {
  console.error('Użycie: node tools/kk-phase.mjs <red|green|contract> [--base <ref>] [--json]');
  process.exit(2);
}

let files = [];
try {
  const cmd = base
    ? `git diff --name-only ${base}...HEAD && git diff --name-only`
    : 'git diff --name-only HEAD && git status --porcelain --untracked-files=all | sed "s/^...//"';
  files = execSync(cmd, { cwd: ROOT, encoding: 'utf8', shell: '/bin/bash' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
} catch (e) {
  console.error('  ✗ Nie udało się odczytać diffa gita. Czy to repozytorium git?');
  process.exit(1);
}

// ADAPTER topologii: turborepo bywa podkatalogiem repozytorium git.
// git zwraca ścieżki względem korzenia repo, a kk.config.mjs opisuje je względem
// korzenia turborepo — bez tej normalizacji wzorce typu 'contracts/' nigdy nie trafiają,
// a pliki spoza turborepo (np. źródło kitu) fałszywie liczą się do fazy.
let gitPrefix = '';
try {
  const top = execSync('git rev-parse --show-toplevel', { cwd: ROOT, encoding: 'utf8' }).trim();
  const rel = relative(top, ROOT).replace(/\\/g, '/');
  if (rel && !rel.startsWith('..')) gitPrefix = rel + '/';
} catch { /* nie repo git — zostaw ścieżki bez zmian */ }
if (gitPrefix) {
  files = files.filter((f) => f.startsWith(gitPrefix)).map((f) => f.slice(gitPrefix.length));
}

files = [...new Set(files)].filter((f) => !f.startsWith('.claude/state/'));

const isTest = (f) => (config.testPathPatterns || []).some((p) => f.includes(p));
const isContract = (f) => (config.contractProtectedPaths || []).some((p) => f.startsWith(p));
const isDocs = (f) => f.startsWith('docs/') || f.endsWith('.md');

const RULES = {
  red: {
    label: 'RED — wolno dodawać wyłącznie testy',
    illegal: (f) => !isTest(f) && !isDocs(f),
    why: 'W fazie RED powstaje wyłącznie test. Zmiana kodu produkcyjnego oznacza, że test i implementacja powstały razem — a wtedy nie wiadomo, czy test kiedykolwiek był czerwony.',
  },
  green: {
    label: 'GREEN — nie wolno ruszać testów ani kontraktu',
    illegal: (f) => isTest(f) || isContract(f),
    why: 'W fazie GREEN test jest wymaganiem, nie materiałem do negocjacji. Jeżeli test jest błędny, zgłoś to człowiekowi zamiast go poprawiać.',
  },
  contract: {
    label: 'CONTRACT — wyłącznie kontrakt, schemat i artefakty generowane',
    illegal: (f) => !isContract(f) && !isDocs(f) && !f.startsWith('packages/database/'),
    why: 'Okno kontraktowe służy zmianie źródła prawdy. Implementacja idzie osobnym krokiem, po regeneracji i walidacji.',
  },
};

const rule = RULES[phase];
const violations = files.filter(rule.illegal);

if (JSON_OUT) {
  console.log(JSON.stringify({ phase, files, violations, ok: violations.length === 0 }, null, 2));
  process.exit(violations.length ? 1 : 0);
}

console.log(`\n  Faza ${rule.label}`);
console.log(`  Zmienionych plików: ${files.length}\n`);

if (violations.length === 0) {
  if (files.length === 0) {
    console.log('  ⚠ Brak zmian w drzewie roboczym — nie ma czego sprawdzać.');
    process.exit(phase === 'red' ? 1 : 0);
  }
  console.log('  ✓ Wszystkie zmiany mieszczą się w fazie.');
  process.exit(0);
}

console.log(`  ✗ ${violations.length} plik(ów) poza zakresem fazy:\n`);
for (const v of violations) console.log(`    ${v}`);
console.log(`\n  ${rule.why}\n`);
process.exit(1);
