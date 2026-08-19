#!/usr/bin/env node
/**
 * PreToolUse (Bash) — komendy, których agent nie wykonuje nigdy.
 * Nie chodzi o nieufność, tylko o to, że koszt jednego `prisma migrate reset`
 * na złej bazie jest nieodwracalny, a koszt zablokowania go wynosi zero.
 */
import { readFileSync } from 'node:fs';

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const cmd = input?.tool_input?.command || '';
if (!cmd) process.exit(0);

let cfg;
try { cfg = (await import(`file://${PROJECT}/tools/kk.config.mjs`)).config; } catch { process.exit(0); }

for (const p of cfg.forbiddenBashPatterns) {
  if (new RegExp(p.re, 'i').test(cmd)) {
    process.stderr.write(
      `[guard-bash] ZABLOKOWANO komendę:\n  ${cmd}\n\nPowód: ${p.msg}\n` +
      `Jeżeli ta operacja jest naprawdę potrzebna, poproś człowieka o wykonanie jej ręcznie.\n`
    );
    process.exit(2);
  }
}

// Ostrzeżenie o operacjach na produkcyjnym URL bazy
if (/postgres:\/\/[^\s]*(prod|production)/i.test(cmd)) {
  process.stderr.write('[guard-bash] ZABLOKOWANO: komenda wskazuje na bazę produkcyjną.\n');
  process.exit(2);
}
process.exit(0);
