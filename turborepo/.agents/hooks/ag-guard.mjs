#!/usr/bin/env node
/**
 * ag-guard — adapter hooków Antigravity dla bramki KlikKlima.
 *
 * Antigravity woła PreToolUse z JSON-em na stdin i oczekuje JSON-a na stdout:
 *   wejście : { toolCall: { name, args }, workspacePaths: [...], ... }
 *   wyjście : { decision: "allow" | "deny" | "ask", reason: "..." }
 *
 * Claude Code używa innego kontraktu (exit 2 = blokada), dlatego logika reguł
 * mieszka w tools/guard-core.mjs, a ten plik tłumaczy wyłącznie format.
 *
 * Uwaga o rolach: payload Antigravity NIE zawiera nazwy subagenta, więc reguły
 * zależne od roli (implementer nie edytuje testów) nie mogą być tu egzekwowane.
 * Zastępuje je kontrola fazowa — patrz tools/kk-phase.mjs.
 */
import { readFileSync } from 'node:fs';
import { checkWrite, checkBash, projectRoot } from '../../tools/guard-core.mjs';

const out = (decision, reason) => {
  process.stdout.write(JSON.stringify(reason ? { decision, reason } : { decision }));
  process.exit(0);
};

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  out('allow'); // nie blokujemy z powodu własnego błędu parsowania
}

// Antigravity podaje katalogi robocze — użyj pierwszego jako korzenia, jeśli nie ustawiono jawnie
if (!process.env.KK_PROJECT_DIR && Array.isArray(input.workspacePaths) && input.workspacePaths[0]) {
  process.env.KK_PROJECT_DIR = input.workspacePaths[0];
}

const name = input?.toolCall?.name || '';
const args = input?.toolCall?.args || {};

// ── Zapis do pliku ────────────────────────────────────────────────────────
if (name === 'write_to_file' || name === 'replace_file_content' || name === 'multi_replace_file_content') {
  const path = args.TargetFile || '';
  const chunks = Array.isArray(args.ReplacementChunks)
    ? args.ReplacementChunks.map((c) => c?.ReplacementContent || c?.TargetContent || '').join('\n')
    : '';
  const content = [args.CodeContent, args.ReplacementContent, chunks].filter(Boolean).join('\n');

  const role = process.env.KK_AGENT_ROLE || null;
  // enforceContract: true — zapis idzie od agenta. Bez znajomości roli reguła
  // sprowadza się do „ścieżki kontraktowe wymagają otwartego okna", co nadal
  // zatrzymuje przypadkową edycję kontraktu w trakcie implementacji.
  const verdict = checkWrite(path, content, { role, enforceContract: true });
  if (verdict.blocked) out('deny', `BRAMKA KLIKKLIMA — ${verdict.reason}`);
  out('allow');
}

// ── Komenda w terminalu ───────────────────────────────────────────────────
if (name === 'run_command') {
  const cmd = args.CommandLine || '';
  const verdict = checkBash(cmd);
  if (verdict.blocked) out('deny', `BRAMKA KLIKKLIMA — ${verdict.reason}`);

  // Komendy nieodwracalne i wdrożeniowe zawsze przez człowieka, nawet w trybie Turbo
  if (/\b(git\s+push|pnpm\s+publish|vercel|supabase\s+db\s+push|prisma\s+migrate\s+deploy)\b/.test(cmd)) {
    out('force_ask', 'Operacja wychodząca poza maszynę lokalną — decyzja należy do człowieka.');
  }
  out('allow');
}

out('allow');
