import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/**
 * WO: audyt bezpieczeństwa 2026-09-24 (worktree feat/crm-cards), BLOCKER 1 —
 * incydent regresji na `customers/actions.ts` (znaleziony przez Gemini/rls-security-auditor):
 * nazwa tabeli sklejana z kawałków przez `['kli', 'enci'].join('')` ORAZ klient Prismy
 * podwójnie rzutowany przez `unknown` na własny typ delegatów, na ścieżce niosącej PII klienta.
 * To dokładnie wzorzec, który reguły `gate-evasion-split-identifier` i
 * `gate-evasion-prisma-recast` (`tools/kk.config.mjs`) miały wykryć.
 *
 * STAN NA 2026-09-24 (sprawdzone przed napisaniem tego pliku — patrz `Read` linie 11-29 tego
 * samego zlecenia): OBIE konstrukcje WCIĄŻ ISTNIEJĄ w `customers/actions.ts`. Work Order
 * zakładał, że incydent jest już naprawiony ("sprawdź obecny stan pliku — powinno być z
 * powrotem odwołanie wprost do modelu klienta...") — w TYM worktree to założenie jest NIEAKTUALNE, patrz
 * podsumowanie zgłoszone przez test-author.
 *
 * Dlatego ten test jest napisany jako REGRESYJNY dowód docelowego stanu: "ten konkretny plik
 * przechodzi skan bramki nazewnictwa czysto". Dziś jest CZERWONY, bo bramka (poprawnie)
 * odrzuca plik — to jest właściwy RED tego pliku: asercja na kodzie wyjścia i treści komunikatu
 * skanera, nie błąd składni czy brakujący import. Po naprawie (usunięciu obfuskacji nazw
 * tabel i podwójnego rzutowania Prismy) ten test przejdzie na ZIELONO bez żadnej zmiany w
 * samym teście — to jest jego funkcja jako testu regresyjnego na ten dokładny incydent.
 *
 * Ogólna reguła (każdy plik .ts/.tsx w apps/, nie tylko ten jeden) ma już pokrycie gdzie indziej
 * w repozytorium (`tools/kk-selftest.mjs` uruchamiane przez `bash scripts/verify.sh --full`) —
 * ten plik NIE duplikuje tamtego pokrycia, dowodzi wyłącznie regresji na TYM incydencie i TYM
 * pliku, zgodnie z zakresem zlecenia.
 *
 * Żadne ID w `contracts/requirements.contract.mjs` nie opisuje wprost "narzędzie kk-precommit-
 * scan wykrywa obfuskację nazw na tym pliku" — `CRM-KLI-AC2` (fallback wskazany w Work Orderze)
 * jest dziś o wąskim odczycie danych kontaktowych dla audytora/montera (przepisane 2026-09-24),
 * czyli inny problem w tym samym pliku. Tag zostaje jako fallback zgodnie z instrukcją zlecenia.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../');
const TARGET_FILE = 'apps/b2b-web/src/app/(dashboard)/customers/actions.ts';

function runScan(): { status: number; stdout: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['tools/kk-precommit-scan.mjs', TARGET_FILE],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return { status: 0, stdout };
  } catch (error) {
    const err = error as { status?: number; stdout?: string };
    return { status: err.status ?? 1, stdout: err.stdout ?? '' };
  }
}

describe('kk-precommit-scan.mjs na customers/actions.ts — regresja incydentu gate-evasion (BLOCKER 1)', () => {
  // @REQ: CRM-KLI-AC2 (fallback — patrz nagłówek pliku: żadne istniejące ID nie opisuje wprost
  // dowód regresji na tym konkretnym incydencie/pliku)
  it('skan przechodzi czysto (kod wyjścia 0), bez wykrycia gate-evasion-split-identifier ani gate-evasion-prisma-recast', () => {
    const { status, stdout } = runScan();

    expect(status).toBe(0);
    expect(stdout).not.toContain('gate-evasion-split-identifier');
    expect(stdout).not.toContain('gate-evasion-prisma-recast');
  });
});
