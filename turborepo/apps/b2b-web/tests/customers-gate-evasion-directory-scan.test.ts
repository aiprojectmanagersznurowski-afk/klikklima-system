import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: rozszerzenie audytu 2026-09-24 (worktree feat/crm-cards) — kontynuacja BLOCKER 1.
 *
 * `customers-gate-evasion-regression.test.ts` udowadnia regresję TYLKO na jednym zaszytym
 * pliku (`customers/actions.ts`). Audyt znalazł ten sam wzorzec obejścia bramki
 * (`['kaw', 'ałki'].join('')` do sklejania nazw tabel/relacji) w DWÓCH innych plikach tego
 * samego katalogu, których commit naprawczy do `actions.ts` nie dotknął:
 * `customers/[id]/tabs-client.tsx` i (poza zakresem tego pliku, patrz test siostrzany)
 * `installations/installations-client.tsx`.
 *
 * Ten test celowo NIE zaszywa listy plików. Skanuje rekurencyjnie CAŁY katalog
 * `apps/b2b-web/src/app/(dashboard)/customers/` w chwili uruchomienia — wzorem tego, jak
 * `tools/kk-precommit-scan.mjs` przyjmuje listę plików z `git diff` w hooku pre-commit
 * (patrz `.githooks/pre-commit`), zamiast jednego zaszytego celu. Dzięki temu złapie
 * obejście bramki w KAŻDYM przyszłym pliku tego katalogu, nie tylko w tych dwóch znanych
 * dziś, bez potrzeby edycji tego testu przy każdym nowym incydencie.
 *
 * PODZIAŁ NA DWA TESTY (ten + `installations-gate-evasion-directory-scan.test.ts`), NIE JEDEN
 * NA CAŁY PANEL B2B: jeden test na `apps/b2b-web/src/app/(dashboard)/` byłby zbyt szeroki —
 * skanowałby dziesiątki niepowiązanych modułów (booking, incidents, itd.) przy każdym
 * uruchomieniu tego pliku testowego, spowalniając pętlę i rozmywając komunikat błędu (który z
 * wielu niepowiązanych modułów zawiódł?). Oba katalogi (`customers/`, `installations/`) mają
 * WSPÓLNY incydent źródłowy (ta sama migracja PII klienta dotyka obu), ale są oddzielnymi
 * granicami modułowymi w kodzie — osobny test na każdy zachowuje szybki, czytelny sygnał "który
 * moduł zawiódł" bez utraty pokrycia.
 *
 * Katalog testów (`__tests__`, `tests/`, pliki `*.test.ts(x)`) jest świadomie wykluczony ze
 * skanu — to plik testowy, nie kod produkcyjny, a wzorzec `['le', 'ady'].join('')` bywa cytowany
 * w treści testów/komentarzy jako przykład zakazanego wzorca (patrz ten właśnie plik).
 */

const REPO_ROOT = path.resolve(__dirname, '../../../');
const SCAN_DIR = 'apps/b2b-web/src/app/(dashboard)/customers';
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

describe('kk-precommit-scan.mjs na całym katalogu customers/ — regresja obejść bramki poza actions.ts', () => {
  // @REQ: CRM-KLI-AC2 (fallback — jak w teście siostrzanym, żadne istniejące ID nie opisuje
  // wprost dowodu regresji tego incydentu na poziomie całego katalogu, nie jednego pliku)
  it('każdy plik .ts/.tsx katalogu przechodzi skan czysto, bez gate-evasion-split-identifier ani gate-evasion-prisma-recast', () => {
    const dirAbs = path.join(REPO_ROOT, SCAN_DIR);
    expect(statSync(dirAbs).isDirectory()).toBe(true);

    const files = collectFiles(dirAbs, SCAN_DIR);
    // Przypadek pusty/nieoczekiwany: jeśli katalog nie ma żadnych plików kodu, to sam w sobie
    // jest sygnałem błędnej konfiguracji testu (zła ścieżka), nie zielonym wynikiem.
    expect(files.length).toBeGreaterThan(0);

    const { status, stdout } = runScan(files);

    expect(stdout).not.toContain('gate-evasion-split-identifier');
    expect(stdout).not.toContain('gate-evasion-prisma-recast');
    expect(status).toBe(0);
  });
});
