#!/usr/bin/env node
/**
 * PreInvocation — wstrzykuje aktualny stan bramki do kontekstu modelu.
 *
 * Antigravity woła ten hook przed każdym wywołaniem modelu i przyjmuje
 * { injectSteps: [{ ephemeralMessage: "..." }] }. Wiadomość efemeryczna nie
 * zaśmieca historii, a agent wie, czy okno kontraktowe jest otwarte i nad czym pracuje.
 *
 * Wstrzykujemy tylko przy pierwszym wywołaniu — powtarzanie tego przy każdym
 * kroku zużywa kontekst i uczy model ignorowania komunikatu.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { }
const done = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };

if (input.invocationNum !== 0) done({});

const ROOT = process.env.KK_PROJECT_DIR || input.workspacePaths?.[0] || process.cwd();
const read = (p) => { try { return JSON.parse(readFileSync(join(ROOT, p), 'utf8')); } catch { return null; } };

const wo = read('.claude/state/current-workorder.json');
const win = read('.claude/state/contract-window.json');

const lines = ['STAN BRAMKI KLIKKLIMA'];
lines.push(wo?.active ? `Aktywny Work Order: ${wo.active}` : 'Brak aktywnego Work Order — zacznij od /kk-plan.');
lines.push(win?.open ? `Okno kontraktowe OTWARTE (${win.ticket || 'bez ticketu'}) — contract-steward może pisać w contracts/.`
                     : 'Okno kontraktowe zamknięte — contracts/ jest tylko do odczytu.');
lines.push('Kontrakt jest źródłem prawdy. Progi SLA importuj z @klikklima/contracts/sla, ID powiadomień z .../notifications.');
lines.push('Przed zamknięciem zadania: bash scripts/verify.sh --full');

done({ injectSteps: [{ ephemeralMessage: lines.join('\n') }] });
