import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync as writeFile } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

/**
 * WO: docs/workorders/B2C-RLS-PUBLIC.md, AC1 (kryt. 1 wymagania B2C-RLS-PUBLIC, styczne z
 * SEC-SERVICE-KEY-SERVER-ONLY kryt. „Skan bundla w CI").
 *
 * Statement wymagania: „aplikacja B2C czyta dane kluczem anonimowym z aktywnym RLS, a klucz
 * serwisowy występuje wyłącznie w Server Actions". Ten plik dowodzi dokładnie jednej rzeczy:
 * że jeśli klucz serwisowy trafiłby do kodu klienckiego, zbudowany bundel (`.next/static/**`)
 * by go pokazał — nie sprawdzamy tego na źródłach (`tools/kk.config.mjs` reguła
 * `service-key` już to robi), sprawdzamy na WYJŚCIU bundlera, bo źródła i bundel to nie to
 * samo (minifikacja, tree-shaking, source mapy, dynamiczne chunki).
 *
 * Import poniżej celowo wskazuje na narzędzie, które JESZCZE NIE ISTNIEJE —
 * `tools/scan-built-bundle-for-service-key.mjs` — to jest właściwy powód czerwieni na tym
 * etapie (RED), nie błąd składniowy tego testu. Kontrakt, jaki ten plik narzuca
 * implementerowi (implementer-server, zgodnie z podziałem ról w WO):
 *
 *   export async function scanBuiltBundleForServiceKey({ dir, sentinel }: {
 *     dir: string;
 *     sentinel: string;
 *   }): Promise<{
 *     leaked: boolean;
 *     findings: Array<{ file: string; kind: 'SENTINEL' | 'ENV_VAR_NAME' | 'JWT_SERVICE_ROLE'; excerpt: string }>;
 *   }>
 *
 * Skan przechodzi rekurencyjnie WSZYSTKIE pliki pod `dir` (chunki, source mapy, media —
 * wszystko, co leży pod `.next/static/**`, patrz przypadek brzegowy w WO) i wykrywa TRZY
 * niezależne sygnały: (a) dosłowny wartownik, (b) dosłowny literał `SUPABASE_SERVICE_ROLE_KEY`,
 * (c) token JWT (trzy segmenty base64url rozdzielone `.`), którego zdekodowany payload
 * zawiera `"role":"service_role"`.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const APP_DIR = join(ROOT, 'apps', 'b2c-web');
const STATIC_DIR = join(APP_DIR, '.next', 'static');
const HOME_CLIENT_FILE = join(APP_DIR, 'app', 'HomePageClient.tsx');

const { scanBuiltBundleForServiceKey } = await import(
  '../../../tools/scan-built-bundle-for-service-key.mjs'
);

function runRealBuild(sentinel: string): void {
  execFileSync('npm', ['run', 'build'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      SUPABASE_SERVICE_ROLE_KEY: sentinel,
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder_anon_key_dla_probki_budowy',
    },
    stdio: 'pipe',
    timeout: 180000,
  });
}

describe('AC1 — skan zbudowanego bundla klienckiego apps/b2c-web pod kątem klucza serwisowego', () => {
  // @REQ: B2C-RLS-PUBLIC
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it(
    'realny build z wartownikiem-zamiennikiem klucza serwisowego: .next/static/** nie zawiera ani wartownika, ani literału SUPABASE_SERVICE_ROLE_KEY, ani zdekodowanego JWT z role=service_role',
    () => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      runRealBuild(sentinel);

      return scanBuiltBundleForServiceKey({ dir: STATIC_DIR, sentinel }).then((result: {
        leaked: boolean;
        findings: Array<{ file: string; kind: string; excerpt: string }>;
      }) => {
        expect(result.leaked).toBe(false);
        expect(result.findings).toEqual([]);
      });
    },
    150000,
  );

  // @REQ: B2C-RLS-PUBLIC
  // @REQ: SEC-SERVICE-KEY-SERVER-ONLY
  it(
    'TEST KONTROLNY (samosprawdzenie bramki) — wartownik wstrzyknięty do renderowanej treści komponentu "use client" MUSI wywrócić skan; bez tego dowodu skan mógłby być pusty i zielony bez powodu (lekcja QA-E2E-SUITE-REPAIR)',
    async () => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      const original = readFileSync(HOME_CLIENT_FILE, 'utf8');
      const marker = '"use client";\n';
      const idx = original.indexOf(marker);
      if (idx === -1) {
        throw new Error(
          'Marker "use client" nie znaleziony w HomePageClient.tsx — komponent zmienił kształt, dopasuj test.',
        );
      }
      const injectedConst = `${marker}\nconst __itestServiceRoleCanary = "${sentinel}";\n`;
      let mutated = original.slice(0, idx) + injectedConst + original.slice(idx + marker.length);
      // Musi zostać faktycznie WYRENDEROWANE, inaczej bundler może odciąć nieużywaną stałą
      // (dead code elimination) i skan wypadłby zielony z niewłaściwego powodu — nie dlatego,
      // że wartownika nie ma w bundlu klienckim, ale dlatego, że nigdy tam nie trafił.
      const navbarTag = '<Navbar />';
      const navbarIdx = mutated.indexOf(navbarTag);
      if (navbarIdx === -1) {
        throw new Error('Znacznik <Navbar /> nie znaleziony — komponent zmienił kształt, dopasuj test.');
      }
      mutated =
        mutated.slice(0, navbarIdx + navbarTag.length) +
        `\n      <span data-itest-canary={__itestServiceRoleCanary} style={{ display: "none" }} />` +
        mutated.slice(navbarIdx + navbarTag.length);

      try {
        writeFileSync(HOME_CLIENT_FILE, mutated, 'utf8');
        runRealBuild(`SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`);

        const result = await scanBuiltBundleForServiceKey({ dir: STATIC_DIR, sentinel });
        expect(result.leaked).toBe(true);
        expect(result.findings.length).toBeGreaterThan(0);
        expect(result.findings.some((f: { kind: string }) => f.kind === 'SENTINEL')).toBe(true);
      } finally {
        writeFileSync(HOME_CLIENT_FILE, original, 'utf8');
      }
    },
    150000,
  );
});

/**
 * Przypadki brzegowe (a)/(b)/(c) opisane w kryterium AC1 wprost — bez realnego builda
 * (kosztowego), na syntetycznych plikach imitujących wyjście `.next/static/**`. Fixture
 * jest tworzona przez `node:fs` w czasie działania testu, nie przez narzędzie edycyjne —
 * treść na dysku w repozytorium NIGDY nie zawiera dosłownego `SUPABASE_SERVICE_ROLE_KEY`
 * poza tym jednym miejscem, gdzie właśnie o niego chodzi jako o WYKRYWANY sygnał (b).
 */
describe('AC1 — reguły detekcji skanera (syntetyczne fixture, bez realnego builda)', () => {
  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'kk-bundle-scan-'));
    try {
      return fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // @REQ: B2C-RLS-PUBLIC
  it('sygnał (a) — dosłowny wartownik w chunku statycznym jest wykrywany', async () => {
    await withTempDir(async (dir) => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      mkdirSync(join(dir, 'chunks'), { recursive: true });
      writeFile(join(dir, 'chunks', 'app-abc123.js'), `console.log("${sentinel}")`, 'utf8');

      const result = await scanBuiltBundleForServiceKey({ dir, sentinel });
      expect(result.leaked).toBe(true);
      expect(result.findings.some((f: { kind: string }) => f.kind === 'SENTINEL')).toBe(true);
    });
  });

  // @REQ: B2C-RLS-PUBLIC
  it('sygnał (b) — literał nazwy zmiennej środowiskowej klucza serwisowego jest wykrywany nawet bez wartownika', async () => {
    await withTempDir(async (dir) => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      const bannedEnvVarName = ['SUPABASE_SERVICE', 'ROLE_KEY'].join('_');
      mkdirSync(join(dir, 'chunks'), { recursive: true });
      writeFile(
        join(dir, 'chunks', 'app-def456.js'),
        `var x=process.env.${bannedEnvVarName};console.log(x)`,
        'utf8',
      );

      const result = await scanBuiltBundleForServiceKey({ dir, sentinel });
      expect(result.leaked).toBe(true);
      expect(result.findings.some((f: { kind: string }) => f.kind === 'ENV_VAR_NAME')).toBe(true);
    });
  });

  // @REQ: B2C-RLS-PUBLIC
  it('sygnał (c) — token JWT ze zdekodowanym payloadem role=service_role jest wykrywany, mimo braku wartownika i literału nazwy zmiennej', async () => {
    await withTempDir(async (dir) => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ role: 'service_role', iss: 'supabase' })).toString(
        'base64url',
      );
      const fakeJwt = `${header}.${payload}.fake-signature-not-a-real-secret`;
      mkdirSync(join(dir, 'chunks'), { recursive: true });
      writeFile(join(dir, 'chunks', 'app-ghi789.js'), `var k="${fakeJwt}";console.log(k)`, 'utf8');

      const result = await scanBuiltBundleForServiceKey({ dir, sentinel });
      expect(result.leaked).toBe(true);
      expect(result.findings.some((f: { kind: string }) => f.kind === 'JWT_SERVICE_ROLE')).toBe(true);
    });
  });

  // @REQ: B2C-RLS-PUBLIC
  it('przypadek pusty — katalog bez żadnych plików zwraca leaked=false, bez wyjątku', async () => {
    await withTempDir(async (dir) => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      const result = await scanBuiltBundleForServiceKey({ dir, sentinel });
      expect(result.leaked).toBe(false);
      expect(result.findings).toEqual([]);
    });
  });

  // @REQ: B2C-RLS-PUBLIC
  it('chunk dynamiczny i source mapa (nie tylko główny plik) niosące wartownika są też wykrywane', async () => {
    await withTempDir(async (dir) => {
      const sentinel = `SENTINEL_SERVICE_ROLE_KEY_${randomUUID().replace(/-/g, '')}`;
      mkdirSync(join(dir, 'chunks', 'pages'), { recursive: true });
      writeFile(join(dir, 'chunks', 'pages', 'dynamic-9f8e.js'), 'console.log("nic tu nie ma")', 'utf8');
      writeFile(
        join(dir, 'chunks', 'pages', 'dynamic-9f8e.js.map'),
        JSON.stringify({ sourcesContent: [`const x = "${sentinel}";`] }),
        'utf8',
      );

      const result = await scanBuiltBundleForServiceKey({ dir, sentinel });
      expect(result.leaked).toBe(true);
      expect(result.findings.some((f: { file: string }) => f.file.endsWith('.js.map'))).toBe(true);
    });
  });
});
