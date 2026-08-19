#!/usr/bin/env node
/**
 * kk-smoke — czy wygenerowany TypeScript da się w ogóle załadować i czy działa.
 *
 * Codegen może wyprodukować plik, który wygląda poprawnie i nie kompiluje się.
 * Ten etap wykonuje wygenerowany kod i sprawdza kilka niezmienników domenowych.
 * Degraduje się łagodnie na starszym Node (brak --experimental-strip-types).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './kk.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = join(ROOT, config.generatedTsDir);
const MODULES = ['funnel.ts', 'notifications.ts', 'sla.ts', 'rbac.ts', 'requirements.ts'];

for (const m of MODULES) {
  if (!existsSync(join(GEN, m))) { console.log(`  ✗ brak pliku ${m} — uruchom node tools/kk-codegen.mjs`); process.exit(1); }
}

const assertions = `
const f = await import('file://${GEN}/funnel.ts');
const n = await import('file://${GEN}/notifications.ts');
const s = await import('file://${GEN}/sla.ts');
const r = await import('file://${GEN}/rbac.ts');
const fail = (m) => { console.log('  ✗ ' + m); process.exit(1); };

if (!f.LEAD_STATUSES.length) fail('pusta lista statusów');
if (f.canTransition('NEW_LEAD', 'completeInstallation')) fail('maszyna stanów przepuszcza nielegalne przejście');
if (!f.canTransition('HARDWARE_IN_WAREHOUSE', 'deliverWithCrew')) fail('bypass E5->E7 nie działa');
if (f.transitionMatrix().filter(x => x.legal).length !== f.TRANSITIONS.length) fail('macierz niezgodna z tabelą przejść');
if (f.LEAD_STATUSES.some(x => !f.STATE_META[x]?.pl)) fail('etap bez polskiej etykiety');
if (!f.isValidLostReason('COMPETITOR') || f.isValidLostReason('wolny tekst')) fail('słownik powodów utraty nie jest zamknięty');
if (f.TRANSITIONS.filter(t => t.from === 'ARCHIVED_LOST').length) fail('ARCHIVED_LOST ma wyjście — miał być terminalny');
if (!f.canTransition('QUOTE_REJECTED', 'archiveLost')) fail('T16 niedostępne z bucketu zimnych leadów');
if (r.can('dyspozytor', 'clients', 'delete') !== 'no') fail('dyspozytor może usuwać klientów');
if (r.can('admin', 'clients', 'delete') !== 'yes') fail('admin nie może usuwać klientów');
if (s.logisticsBand(2) !== 'CRITICAL' || s.logisticsBand(5) !== 'URGENT' || s.logisticsBand(10) !== 'NORMAL') fail('pasma SLA liczone błędnie');
if (Object.values(s.SLA_ROW_CLASSES).some(c => /green|emerald/.test(c))) fail('zielona klasa SLA w wygenerowanym kodzie');
if (n.notificationsForTransition('T01').length < 1) fail('brak powiązania powiadomień z przejściem T01');
if (n.NOTIFICATIONS.some(x => !x.templateKey)) fail('powiadomienie bez templateKey');
console.log('  ✓ wygenerowany kod wykonuje się i spełnia niezmienniki domenowe');
`;

const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', assertions], { encoding: 'utf8' });
const out = (res.stdout || '') + (res.stderr || '');
if (/experimental-strip-types|Unknown option|not supported/i.test(out) && res.status !== 0 && !out.includes('✗')) {
  console.log('  − pominięte: ten Node nie obsługuje wykonywania TypeScript (wymagany Node 22+). Etap wykona CI.');
  process.exit(0);
}
console.log(out.split('\n').filter(l => l.includes('✓') || l.includes('✗')).join('\n') || out.trim());
process.exit(res.status === 0 ? 0 : 1);
