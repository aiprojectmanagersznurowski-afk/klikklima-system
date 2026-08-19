#!/usr/bin/env node
/**
 * kk-contract-window — świadoma zgoda człowieka na zmianę kontraktu.
 *
 * Kontrakt to jedyna rzecz, której agent nie zmienia sam. Nie dlatego, że nie umie,
 * tylko dlatego, że zmiana kontraktu przepisuje wszystkie testy jednocześnie —
 * a wtedy zielona bramka przestaje cokolwiek znaczyć.
 *
 *   node tools/kk-contract-window.mjs open <TICKET> [--minutes 30]
 *   node tools/kk-contract-window.mjs status
 *   node tools/kk-contract-window.mjs close
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, '.claude/state/contract-window.json');
const [cmd, ticket] = process.argv.slice(2);
const minutes = process.argv.includes('--minutes') ? Number(process.argv[process.argv.indexOf('--minutes') + 1]) : 30;

if (cmd === 'open') {
  if (!ticket) { console.error('Podaj ticket: node tools/kk-contract-window.mjs open FNL-E5-BYPASS'); process.exit(1); }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n  Otwierasz okno zmiany KONTRAKTU dla: ${ticket}`);
  console.log('  Skutki: agent contract-steward będzie mógł zmienić kontrakty, schemat Prisma i migracje.');
  console.log('  Wszystkie istniejące testy mogą po tym wymagać ponownej walidacji.\n');
  const ans = (await rl.question(`  Wpisz dokładnie "${ticket}", aby potwierdzić: `)).trim();
  rl.close();
  if (ans !== ticket) { console.log('\n  Anulowano — okno pozostaje zamknięte.\n'); process.exit(1); }
  mkdirSync(dirname(FILE), { recursive: true });
  const token = { ticket, openedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + minutes * 60000).toISOString(), openedBy: process.env.USER || 'unknown' };
  writeFileSync(FILE, JSON.stringify(token, null, 2));
  console.log(`\n  ✓ Okno otwarte do ${token.expiresAt}. Zamknij je od razu po zmianie: node tools/kk-contract-window.mjs close\n`);
} else if (cmd === 'close') {
  if (existsSync(FILE)) rmSync(FILE);
  console.log('  ✓ Okno kontraktowe zamknięte.');
} else {
  if (!existsSync(FILE)) { console.log('  Okno kontraktowe: ZAMKNIĘTE.'); process.exit(0); }
  const t = JSON.parse(readFileSync(FILE, 'utf8'));
  const open = new Date(t.expiresAt) > new Date();
  console.log(`  Okno kontraktowe: ${open ? 'OTWARTE' : 'WYGASŁE'} | ticket ${t.ticket} | do ${t.expiresAt}`);
}
