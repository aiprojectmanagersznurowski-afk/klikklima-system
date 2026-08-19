#!/usr/bin/env node
/**
 * SubagentStart / SubagentStop — dziennik przebiegu pętli.
 * Bez tego nie odtworzysz, który agent co zrobił i ile to kosztowało.
 * Plik: .claude/state/run-log.jsonl (append-only, jedna linia = jedno zdarzenie).
 */
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }

const file = `${PROJECT}/.claude/state/run-log.jsonl`;
try {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify({
    ts: new Date().toISOString(),
    event: input.hook_event_name,
    agent: input.agent_type || input.agent_name || null,
    session: input.session_id || null,
  }) + '\n');
} catch { /* dziennik nigdy nie blokuje pracy */ }
process.exit(0);
