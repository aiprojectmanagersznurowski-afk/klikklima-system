#!/usr/bin/env node
/**
 * kk-precommit-scan — sprawdza pliki wchodzące do commita wobec reguł bramki.
 *
 * Skanuje WYŁĄCZNIE pliki kodu. Dokumentacja jest celowo pominięta: pliki takie
 * jak NAMING.md, CHANGES-ADR-*.md czy definicje agentów cytują zakazane wzorce
 * jako przykłady, a reguła, która nie odróżnia użycia od zacytowania,
 * uniemożliwia napisanie instrukcji o samej regule.
 *
 * Użycie: node tools/kk-precommit-scan.mjs <plik> [plik...]
 */
import { readFileSync } from 'node:fs';
import { checkWrite } from './guard-core.mjs';
import { config } from './kk.config.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|sql|prisma|css)$/;

/**
 * Pominięte świadomie:
 *  - contracts/ i wygenerowane artefakty — to źródło prawdy i jego pochodne.
 *    Wygenerowany TypeScript cytuje nazwy pól w treści wymagań („next_service_date
 *    jest polem pochodnym"), więc skan treści wyłapywałby własną dokumentację.
 *  - tools/ i hooki — zawierają wzorce zakazane jako wyrażenia regularne reguł.
 */
const SKIP = [config.contractsDir, config.generatedTsDir, 'tools/', '.claude/hooks/', '.agents/hooks/'];
/**
 * Reguły ADR-002 (adr002-*) są tu pomijane ŚWIADOMIE — nie są rozluźnione, tylko
 * sprawdzane precyzyjniej gdzie indziej: krok 3 tego samego `.githooks/pre-commit`
 * uruchamia `node tools/kk-naming.mjs --check-baseline`, który blokuje PRZYROST ponad
 * zamrożony dług (tools/kk-naming-baseline.json, ~1045 naruszeń sprzed ADR-002).
 *
 * Bez tego pominięcia ten skaner blokowałby KAŻDY commit dotykający pliku z długiem już
 * zaakceptowanym — dokładnie tak, jak kk-naming.mjs blokował przed własną naprawą
 * (ticket KK-NAMING-BASELINE), i dokładnie dlatego commit CRM-SAFE-RECORD-ACTIONS musiał
 * pójść przez --no-verify. Bramka czerwona na starcie nie niesie sygnału, tylko uczy
 * pomijania jej przez --no-verify.
 *
 * Pozostałe reguły (as-any, ts-ignore, skipped-test, hardcoded-hex, non-lucide-icons,
 * green-sla, service-key, adr001-*, adr003-*, adr008-*, adr010-*, magic-sla*) NIE mają
 * mechanizmu baseline i zostają tu absolutne, z zerową tolerancją.
 */
const baselineTrackedRuleIds = (config.forbiddenPatterns || [])
  .filter((p) => p.id.startsWith('adr002-'))
  .map((p) => p.id);

const files = process.argv.slice(2)
  .filter((f) => CODE.test(f))
  .filter((f) => !SKIP.some((s) => f.startsWith(s.replace(/^\.\//, ''))));
let fail = 0;

for (const f of files) {
  let content;
  try { content = readFileSync(f, 'utf8'); } catch { continue; }
  const v = checkWrite(f, content, { skipRules: baselineTrackedRuleIds });
  if (v.blocked) {
    console.log(`  ✗ ${f}`);
    console.log(`      ${v.reason}`);
    fail++;
  }
}
process.exit(fail ? 1 : 0);
