import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: rozszerzenie audytu 2026-09-24 (worktree feat/crm-cards) — kontynuacja BLOCKER 1.
 *
 * Test siostrzany `customers-gate-evasion-directory-scan.test.ts` skanuje rekurencyjnie
 * `customers/`; ten skanuje analogicznie `installations/`, gdzie audyt znalazł ten sam wzorzec
 * obejścia bramki w `installations-client.tsx`
 * (`const TBL_REALTIME_INSTALLATIONS = ['instal', 'acje'].join('')`).
 *
 * Uzasadnienie podziału na dwa osobne testy zamiast jednego na oba katalogi (albo na cały
 * `(dashboard)/`) — patrz komentarz nagłówkowy testu siostrzanego w `customers/`: szybszy,
 * czytelniejszy sygnał per moduł, bez skanowania niepowiązanych modułów panelu B2B przy każdym
 * uruchomieniu.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../');
const SCAN_DIR = 'apps/b2b-web/src/app/(dashboard)/installations';
const CODE_EXT = /\.(ts|tsx)$/;
const TEST_MARKERS = /(\.test\.|\.spec\.|[\\/]__tests__[\\/]|[\\/]tests[\\/])/;

function collectFiles(dirAbs: string, dirRel: string): string[] {
  const entries = readdirSync(dirAbs, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dirAbs, entry.name);
    const rel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs, rel));
    } else if (entry.isFile() && CODE_EXT.test(entry.name) && !TEST_MARKERS.test(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function runScan(files: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['tools/kk-precommit-scan.mjs', ...files],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return { status: 0, stdout };
  } catch (error) {
    const err = error as { status?: number; stdout?: string };
    return { status: err.status ?? 1, stdout: err.stdout ?? '' };
  }
}

describe('kk-precommit-scan.mjs na całym katalogu installations/ — regresja obejść bramki poza actions.ts', () => {
  // @REQ: CRM-KLI-AC2 (fallback — jak w teście siostrzanym w customers/, żadne istniejące ID
  // nie opisuje wprost dowodu regresji tego incydentu na poziomie całego katalogu)
  it('każdy plik .ts/.tsx katalogu przechodzi skan czysto, bez gate-evasion-split-identifier ani gate-evasion-prisma-recast', () => {
    const dirAbs = path.join(REPO_ROOT, SCAN_DIR);
    expect(statSync(dirAbs).isDirectory()).toBe(true);

    const files = collectFiles(dirAbs, SCAN_DIR);
    expect(files.length).toBeGreaterThan(0);

    const { status, stdout } = runScan(files);

    expect(stdout).not.toContain('gate-evasion-split-identifier');
    expect(stdout).not.toContain('gate-evasion-prisma-recast');
    expect(status).toBe(0);
  });
});
