import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WO: docs/workorders/SERVICE-ROLE-LEADS-PAGE.md
 *
 * Faza RED. `apps/b2b-web/src/lib/storage/signed-urls.ts` NIE ISTNIEJE jeszcze
 * (plan WO, wiersz "Plan plikow") - import ponizej celowo wskazuje na plik,
 * ktory implementer dopiero utworzy. To jest poprawny powod niepowodzenia
 * (brak eksportu funkcji domenowej), nie literowka.
 *
 * Mockujemy `../src/utils/supabase/admin` (tez jeszcze nieistniejacy), bo to
 * jest granica odpowiedzialnosci wg WO: `signStoragePaths` woła
 * `createAdminClient()` z tego modulu, a nie tworzy klienta samodzielnie.
 * Test jednostkowy signStoragePaths nie powinien wiedziec, jak createAdminClient
 * jest zaimplementowany - tylko ze go wywoluje i uzywa zwroconego `storage`.
 *
 * Sygnatura z WO ("Plan plikow"):
 *   signStoragePaths(bucket: string, paths: string[], expiresInSeconds: number)
 *     => Promise<Record<string, string>>
 */

const { createSignedUrlsMock, fromMock, createAdminClientMock } = vi.hoisted(() => {
  const createSignedUrlsMock = vi.fn();
  const fromMock = vi.fn(() => ({ createSignedUrls: createSignedUrlsMock }));
  const createAdminClientMock = vi.fn(() => ({
    storage: { from: fromMock },
  }));
  return { createSignedUrlsMock, fromMock, createAdminClientMock };
});

vi.mock('../src/utils/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}));

const { signStoragePaths } = await import('../src/lib/storage/signed-urls');

describe('signStoragePaths(bucket, paths, expiresInSeconds) - generowanie zbiorczych podpisanych URL-i (SERVICE-ROLE-LEADS-PAGE)', () => {
  beforeEach(() => {
    createSignedUrlsMock.mockReset();
    fromMock.mockClear();
    createAdminClientMock.mockClear();
  });

  // AC5 + przypadek pusty: "paths: [] -> {} bez zadnego zapytania sieciowego".
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('AC5 - pusta lista sciezek nie wykonuje zadnego zapytania do storage i zwraca pusty obiekt', async () => {
    const result = await signStoragePaths('audytorzy', [], 3600);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  // AC4: "dokladnie jedno wywolanie storage.createSignedUrls niezaleznie od
  // liczby audytorow (brak N+1)". N=3 tutaj celowo > 1, zeby wykluczyc petle.
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('AC4 - N sciezek generuje dokladnie jedno zbiorcze wywolanie createSignedUrls z tablica dlugosci N', async () => {
    const paths = ['aud-1.jpg', 'aud-2.jpg', 'aud-3.jpg'];
    createSignedUrlsMock.mockResolvedValue({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
      error: null,
    });

    const result = await signStoragePaths('audytorzy', paths, 3600);

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(
      expect.arrayContaining(paths),
      expect.anything(),
    );
    const [calledPaths] = createSignedUrlsMock.mock.calls[0];
    expect(calledPaths).toHaveLength(3);
    expect(result).toEqual({
      'aud-1.jpg': 'https://signed/aud-1.jpg',
      'aud-2.jpg': 'https://signed/aud-2.jpg',
      'aud-3.jpg': 'https://signed/aud-3.jpg',
    });
  });

  // Parametryzacja bucketem - WO: "Parametryzowany bucketem, zeby crews/page.tsx
  // mogl go uzyc w osobnym WO bez przepisywania". Sprawdzamy ze bucket przekazany
  // do funkcji trafia do storage.from(), a nie jest zaszyty na sztywno "audytorzy".
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('bucket jest przekazywany do storage.from() jako parametr, nie jako literal', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [{ path: 'zespol-1.jpg', signedUrl: 'https://signed/zespol-1.jpg', error: null }],
      error: null,
    });

    await signStoragePaths('zespoly', ['zespol-1.jpg'], 3600);

    expect(fromMock).toHaveBeenCalledWith('zespoly');
  });

  // Czas zycia podpisu jest parametrem wywolujacego (WO, Ryzyko #4) - nie jest
  // to prog SLA, ale musi byc przekazany dalej, a nie zignorowany/ustawiony na sztywno.
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('expiresInSeconds jest przekazywany do createSignedUrls bez modyfikacji', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [{ path: 'a.jpg', signedUrl: 'https://signed/a.jpg', error: null }],
      error: null,
    });

    await signStoragePaths('audytorzy', ['a.jpg'], 900);

    expect(createSignedUrlsMock).toHaveBeenCalledWith(expect.anything(), 900);
  });

  // AC6: "Czesciowa awaria storage nie wywraca strony: gdy createSignedUrls
  // zwraca mieszanke wpisow udanych i wpisow z error, audytorzy z udanym
  // podpisem maja avatarUrl, pozostali maja null".
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('AC6 - czesciowa awaria: wpisy z error sa pominiete, udane trafiaja do mapy', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: 'ok.jpg', signedUrl: 'https://signed/ok.jpg', error: null },
        { path: 'broken.jpg', signedUrl: null, error: { message: 'object not found' } },
      ],
      error: null,
    });

    const result = await signStoragePaths('audytorzy', ['ok.jpg', 'broken.jpg'], 3600);

    expect(result).toEqual({ 'ok.jpg': 'https://signed/ok.jpg' });
    expect(result).not.toHaveProperty('broken.jpg');
  });

  // Przypadek brzegowy z WO: "data === null (calkowita awaria storage / brak
  // uprawnien do bucketa) - funkcja zwraca {}, strona renderuje sie z
  // avatarUrl: null, nie rzuca."
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('calkowita awaria storage (data === null) nie rzuca i zwraca pusty obiekt', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: null,
      error: { message: 'bucket unreachable' },
    });

    await expect(signStoragePaths('audytorzy', ['a.jpg'], 3600)).resolves.toEqual({});
  });

  // Przypadek brzegowy z WO: "Duplikaty sciezek - dwoch audytorow z tym samym
  // zdjecie_url: obaj dostaja URL, mapa nie gubi wpisu."
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('duplikaty sciezek na wejsciu nie gubia wpisu w mapie wynikowej i sa deduplikowane przed wywolaniem storage', async () => {
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: 'shared.jpg', signedUrl: 'https://signed/shared.jpg', error: null },
      ],
      error: null,
    });

    const result = await signStoragePaths('audytorzy', ['shared.jpg', 'shared.jpg'], 3600);

    expect(result).toEqual({ 'shared.jpg': 'https://signed/shared.jpg' });
    // Dowod deduplikacji, nie tylko poprawnosci mapy: storage.createSignedUrls
    // musi dostac liste sciezek juz zdeduplikowana, jedno wystapienie 'shared.jpg'.
    // Implementacja bez deduplikacji przekazalaby dwa wystapienia i wciaz
    // przeszlaby asercje na samej mapie wynikowej powyzej.
    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(['shared.jpg'], 3600);
  });
});

/**
 * AC2: "grep -rn 'SUPABASE_SERVICE_ROLE_KEY|service_role' apps/b2b-web/src
 * zwraca wylacznie trafienie w src/utils/supabase/admin.ts (oraz - do czasu
 * osobnego WO - w crews/page.tsx, patrz 'Poza zakresem')."
 *
 * To NIE jest test jednostkowy na logike - to statyczna kontrola izolacji
 * klucza serwisowego, odtwarzajaca dokladnie polecenie z AC2. Celowo w tym
 * samym pliku, bo dotyczy tego samego WO i tego samego modulu docelowego.
 * AC1 (kk-precommit-scan) i AC7 (blad builda w komponencie klienckim) NIE sa
 * pokrywane tutaj - to bramki fazy VERIFY, nie testy jednostkowe.
 */
describe('AC2 - klucz serwisowy wystepuje wylacznie w src/utils/supabase/admin.ts', () => {
  const KEY_PATTERN = /SUPABASE_SERVICE_ROLE_KEY|service_role/;
  const ALLOWED_RELATIVE_PATHS = new Set([
    'src/utils/supabase/admin.ts',
    // Wyjatek celowy do czasu WO SERVICE-ROLE-CREWS-PAGE (WO, "Poza zakresem").
    'src/app/(dashboard)/crews/page.tsx',
  ]);

  function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, acc);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        acc.push(full);
      }
    }
    return acc;
  }

  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it('zaden plik .ts/.tsx pod apps/b2b-web/src poza dozwolona lista nie zawiera klucza serwisowego', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const srcRoot = join(__dirname, '..', 'src');

    const offenders = walk(srcRoot)
      .filter((file) => KEY_PATTERN.test(readFileSync(file, 'utf-8')))
      .map((file) => relative(join(srcRoot, '..'), file).split('\\').join('/'))
      .filter((relPath) => !ALLOWED_RELATIVE_PATHS.has(relPath));

    expect(offenders).toEqual([]);
  });
});
