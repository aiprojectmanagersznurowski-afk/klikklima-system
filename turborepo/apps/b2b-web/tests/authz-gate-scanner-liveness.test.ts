import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Test ŻYWOTNOŚCI (SEC-AUTHZ-B2B-READS, AC12) rozszerzonego `tools/kk-authz-gate.mjs`.
 *
 * kk-selftest.mjs dowodzi, że BRAMKA KONTRAKTU potrafi zablokować mutację kontraktu —
 * nie dotyka `tools/kk-authz-gate.mjs` w ogóle. Ten skaner AST właśnie dostał drugi
 * zestaw metod (odczyty: findMany/findUnique/…) i drugi zakres plików (całe `app/`,
 * nie tylko `actions.ts`) — od tej heurystyki zależy wykrywanie wycieków PII (patrz
 * `SEC-AUTHZ-B2B-READS`, ósmy przypadek: `customers/[id]/page.tsx` wołający
 * `prisma.sampleRecords.findUnique` wprost, z pominięciem `actions.ts`). Gdyby ktoś zepsuł
 * tę heurystykę, `node tools/kk-authz-gate.mjs` w `scripts/verify.sh` świeciłby się na
 * zielono i NIKT by się nie dowiedział — dokładnie ta klasa długu, którą `kk-selftest`
 * zamyka dla walidatora kontraktu, ale nie dla tego narzędzia.
 *
 * Mechanizm: skaner wspiera `KK_AUTHZ_SCAN_DIR` (patrz `tools/kk-authz-gate.mjs`,
 * `const SCAN_DIR = process.env.KK_AUTHZ_SCAN_DIR || join(ROOT, 'apps/b2b-web/src/app')`)
 * — CAŁKOWICIE podmienia katalog skanowany, niezależnie od repozytorium. Uruchamiamy
 * realny proces node na PIĘCIU fikstrach w `__fixtures__/authz-gate/` (syntetyczne
 * pliki .ts/.tsx poza `apps/b2b-web/src/app`, więc nigdy nie trafiają do skanu
 * produkcyjnego) i czytamy `--json`, żeby dowodzić nie tylko kodu wyjścia, ale KATEGORII
 * znaleziska (suspect vs. ordering) i tego, KTÓRA funkcja/plik został złapany — sam kod
 * wyjścia 1 nie odróżniłby "skaner działa" od "skaner się wywalił z innego powodu".
 *
 * Cztery obowiązkowe przypadki z Work Ordera + piąty (ordering) wprost wymieniony w
 * acceptance AC12 punkt (b) tego samego wymagania — "can() postawione PO pierwszym
 * findMany trafia do kategorii ordering".
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');
const SCANNER = path.join(ROOT, 'tools/kk-authz-gate.mjs');
const FIXTURES = path.join(ROOT, 'apps/b2b-web/tests/__fixtures__/authz-gate');

function runScanner(scanDir: string) {
  const result = spawnSync(process.execPath, [SCANNER, '--json'], {
    env: { ...process.env, KK_AUTHZ_SCAN_DIR: scanDir },
    encoding: 'utf8',
  });
  if (!result.stdout) {
    throw new Error(
      `kk-authz-gate nie wypisał nic na stdout (status ${result.status}). stderr: ${result.stderr}`,
    );
  }
  return { status: result.status, json: JSON.parse(result.stdout) };
}

describe('kk-authz-gate — żywotność heurystyki odczytów i skanu poza actions.ts (SEC-AUTHZ-B2B-READS AC12)', () => {
  // @REQ: SEC-AUTHZ-B2B-READS
  it('1) funkcja WYŁĄCZNIE odczytowa (findMany) bez can() jest zgłoszona jako suspect, exit != 0', () => {
    const { status, json } = runScanner(path.join(FIXTURES, 'ungated-read/app'));

    expect(status).not.toBe(0);
    expect(json.suspects).toHaveLength(1);
    expect(json.suspects[0]).toMatchObject({ name: 'getSecrets', kind: 'read' });
    expect(json.ordering).toHaveLength(0);
  });

  // @REQ: SEC-AUTHZ-B2B-READS
  it('2) funkcja odczytowa z can() PRZED zapytaniem jest czysta, exit 0, brak suspectów', () => {
    const { status, json } = runScanner(path.join(FIXTURES, 'gated-read/app'));

    expect(status).toBe(0);
    expect(json.suspects).toHaveLength(0);
    expect(json.ordering).toHaveLength(0);
    expect(json.gated).toBe(1);
  });

  // @REQ: SEC-AUTHZ-B2B-READS
  it('3) can() postawione PO pierwszym findMany trafia do kategorii ordering, nie suspects, exit != 0', () => {
    const { status, json } = runScanner(path.join(FIXTURES, 'ordering-violation-read/app'));

    expect(status).not.toBe(0);
    expect(json.suspects).toHaveLength(0);
    expect(json.ordering).toHaveLength(1);
    expect(json.ordering[0]).toMatchObject({
      name: 'getCustomersOrderedWrong',
      firstDbCall: 'prisma.sampleRecords.findMany',
    });
  });

  // @REQ: SEC-AUTHZ-B2B-READS
  it('4) odczyt w page.tsx wołający Prismę bezpośrednio, bez actions.ts, jest zgłoszony (kształt BLOCKERA z karty klienta)', () => {
    const { status, json } = runScanner(path.join(FIXTURES, 'ungated-page-read/app'));

    expect(status).not.toBe(0);
    expect(json.suspects).toHaveLength(1);
    expect(json.suspects[0]).toMatchObject({
      name: 'CustomerDetailPageFixture',
      kind: 'read',
    });
    expect(json.suspects[0].file.endsWith('page.tsx')).toBe(true);
  });

  // @REQ: SEC-AUTHZ-B2B-READS
  it('5) mutacja bez bramki jest nadal zgłaszana — rozszerzenie o odczyty nie zepsuło starego zachowania', () => {
    const { status, json } = runScanner(path.join(FIXTURES, 'ungated-mutation/app'));

    expect(status).not.toBe(0);
    expect(json.suspects).toHaveLength(1);
    expect(json.suspects[0]).toMatchObject({ name: 'deleteCustomerFixture', kind: 'mutation' });
  });
});
