#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write) — wzorce zakazane w kodzie.
 *
 * To jest maszynowa wersja „Krytycznej Listy Sprawdzeniowej dla Subagentów AI"
 * z ui_ux_guidelines.md §8. Lista w dokumencie jest przestrzegana w większości przypadków.
 * Lista w hooku jest przestrzegana zawsze.
 *
 * Konfiguracja: tools/kk.config.mjs -> forbiddenPatterns
 */
import { readFileSync } from 'node:fs';
import { relative, isAbsolute, basename } from 'node:path';

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }

const ti = input?.tool_input || {};
const raw = ti.file_path || '';
if (!raw) process.exit(0);
const rel = (isAbsolute(raw) ? relative(PROJECT, raw) : raw).replace(/\\/g, '/');

// Treść, która ma trafić do pliku: Write -> content, Edit -> new_string
const payload = [ti.content, ti.new_string, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e.new_string) : [])]
  .filter(Boolean).join('\n');
if (!payload) process.exit(0);

let cfg;
try { cfg = (await import(`file://${PROJECT}/tools/kk.config.mjs`)).config; } catch { process.exit(0); }

const blockers = [];
const warnings = [];

for (const p of cfg.forbiddenPatterns) {
  if (p.appliesTo && !new RegExp(p.appliesTo).test(rel)) continue;
  if (p.allowIn && p.allowIn.some((a) => rel.includes(a) || basename(rel).includes(a))) continue;
  const re = new RegExp(p.re, 'gm');
  const hits = payload.match(re);
  if (!hits) continue;
  const entry = { id: p.id, msg: p.msg, sample: hits.slice(0, 3).join(', ') };
  (p.severity === 'warn' ? warnings : blockers).push(entry);
}

if (warnings.length) {
  process.stderr.write(`[guard-forbidden] Uwagi dla ${rel}:\n` + warnings.map((w) => `  ⚠ ${w.id}: ${w.msg} (${w.sample})`).join('\n') + '\n');
}

if (blockers.length) {
  process.stderr.write(
    `[guard-forbidden] ZABLOKOWANO zapis do ${rel}\n` +
    blockers.map((b) => `  ✗ ${b.id}: ${b.msg}\n    znaleziono: ${b.sample}`).join('\n') +
    `\n\nPopraw treść i spróbuj ponownie. Nie obchodź reguły — jeżeli uważasz, że jest błędna,\nzgłoś to w podsumowaniu jako RULE-CHALLENGE i zakończ turę.\n`
  );
  process.exit(2);
}
process.exit(0);
