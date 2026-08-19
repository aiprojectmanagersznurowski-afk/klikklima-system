#!/usr/bin/env node
/**
 * SessionStart — wstrzykuje aktualny stan pętli do kontekstu.
 * Agent zaczynający sesję ma od razu wiedzieć: nad czym pracujemy,
 * czy kontrakt jest zielony i czy okno kontraktowe jest otwarte.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const out = [];

try {
  const wo = `${PROJECT}/.claude/state/current-workorder.json`;
  if (existsSync(wo)) {
    const j = JSON.parse(readFileSync(wo, 'utf8'));
    out.push(`AKTYWNY WORK ORDER: ${j.ticket} — ${j.title} | faza: ${j.phase} | iteracja: ${j.iteration}/${j.maxIterations}`);
    out.push(`Wymagania: ${(j.requirements || []).join(', ')}`);
  } else {
    out.push('Brak aktywnego Work Order. Zacznij od /kk-plan.');
  }
} catch { /* ignoruj */ }

try {
  execFileSync(process.execPath, [`${PROJECT}/tools/kk-validate.mjs`], { stdio: 'pipe' });
  out.push('Kontrakty: ZIELONE.');
} catch {
  out.push('Kontrakty: CZERWONE — uruchom `node tools/kk-validate.mjs` przed jakąkolwiek implementacją.');
}

try {
  const t = JSON.parse(readFileSync(`${PROJECT}/.claude/state/contract-window.json`, 'utf8'));
  if (new Date(t.expiresAt) > new Date()) out.push(`UWAGA: okno kontraktowe OTWARTE do ${t.expiresAt} (ticket ${t.ticket}).`);
} catch { /* zamknięte */ }

console.log(out.join('\n'));
process.exit(0);
