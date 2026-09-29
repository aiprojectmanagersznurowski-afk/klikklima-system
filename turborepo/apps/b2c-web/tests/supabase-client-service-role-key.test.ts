import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * WO: docs/workorders/B2C-RLS-PUBLIC.md, AC5 (statement wymagania B2C-RLS-PUBLIC + kryt. 4).
 *
 * Statement: „`lib/supabaseClient.ts` używa wyłącznie NEXT_PUBLIC_SUPABASE_ANON_KEY; brak
 * klucza anonimowego = błąd konfiguracji, nie cichy powrót do klucza serwisowego ani do
 * `placeholder_key`. Test statyczny: żaden plik w `apps/b2c-web` poza jawną listą Server
 * Actions (z uzasadnieniem przy każdej) nie odwołuje się do SUPABASE_SERVICE_ROLE_KEY."
 *
 * Cztery niezależne dowody (stan po implementacji AC5 — wszystkie GREEN, zdolne wywrócić się
 * przy regresji):
 *   1. `lib/supabaseClient.ts` (kod ŹRÓDŁOWY, nie moduł) nie zawiera literału
 *      `SUPABASE_SERVICE_ROLE_KEY`.
 *   2. Zachowanie modułu w RUNTIME: import `lib/supabaseClient.ts` bez
 *      `NEXT_PUBLIC_SUPABASE_ANON_KEY` w środowisku RZUCA błąd konfiguracji zawierający nazwę
 *      brakującej zmiennej, nie tworzy cicho klienta z `SUPABASE_SERVICE_ROLE_KEY` ani z
 *      `'placeholder_key'`.
 *   3. Skan CAŁEGO `apps/b2c-web` (poza `tests/`, `scripts/`, `.next/`, `node_modules/`,
 *      `e2e/`, `public/`, artefaktami Playwrighta, na DOWOLNYM poziomie zagnieżdżenia) —
 *      `SUPABASE_SERVICE_ROLE_KEY` wolno odwoływać się WYŁĄCZNIE plikom z
 *      `ALLOWED_SERVICE_ROLE_KEY_FILES` niżej. Ten sam skan sprawdza też, że każdy plik
 *      importujący `lib/supabaseAdminClient` (dowolną formą ścieżki) zaczyna się od
 *      dyrektywy `"use server"` — klient service-role nie może trafić do modułu, który nie
 *      jest jawnie Server Action.
 *
 * `scripts/seed_scraped_data.ts` (skrypt deweloperski uruchamiany ręcznie przez `ts-node`/
 * `node`, poza `next build`, nigdy nie trafia do bundla klienckiego ani nie jest Server
 * Action) jest CELOWO POZA zakresem skanu — katalog `scripts/` jest wykluczony w ogóle, tak
 * samo jak `tests/`. AC5 mówi o „plikach w apps/b2c-web poza jawną listą Server Actions";
 * skrypty deweloperskie nie są ani jednym, ani drugim, więc traktujemy je jak `tests/` —
 * poza zakresem tego konkretnego kryterium (nie: ukryty wyjątek dla runtime'u aplikacji).
 */

const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
const THIS_FILE = fileURLToPath(new URL('./supabase-client-service-role-key.test.ts', import.meta.url));

const SUPABASE_CLIENT_SOURCE = join(APP_DIR, 'lib', 'supabaseClient.ts');

const SERVICE_ROLE_KEY_LITERAL = 'SUPABASE_SERVICE_ROLE_KEY';

// Katalogi bez powodu, żeby kiedykolwiek zawierać kod aplikacji odczytywany przez skan AC5:
// testy (własne mocki i asercje na literale), skrypty deweloperskie (patrz komentarz wyżej),
// e2e (Playwright, osobny runner), artefakty builda/instalacji.
//
// Wykluczenie dotyczy TYLKO segmentu ścieżki na zamierzonym poziomie — czyli
// `apps/b2c-web/tests/`, `apps/b2c-web/scripts/` itd. — nie dowolnego katalogu o tej nazwie
// gdziekolwiek głębiej w drzewie (np. hipotetyczny `app/scripts/` czy `components/tests/`
// MUSI zostać przeskanowany, bo to kod aplikacji, nie infrastruktura testowa/developerska).
const EXCLUDED_RELATIVE_DIR_PREFIXES = ['tests/', 'scripts/', 'e2e/', 'test-results/', 'playwright-report/'];
const EXCLUDED_DIR_NAMES_ANY_DEPTH = new Set(['node_modules', '.next', 'public', '.git']);

const SOURCE_FILE_EXTENSIONS = new Set(['.js', '.mjs', '.jsx', '.ts', '.tsx']);

// Jawna lista plików uprawnionych do odwołania się do SUPABASE_SERVICE_ROLE_KEY — każdy wpis
// z uzasadnieniem, dlaczego NIE MOŻE przejść na wspólny `lib/supabaseClient.ts` (który po
// AC5 używa wyłącznie klucza anonimowego). Podstawa: docs/workorders/B2C-RLS-PUBLIC.md,
// sekcja „Kontekst kodu" i D-R1.
const ALLOWED_SERVICE_ROLE_KEY_FILES: ReadonlyArray<{ path: string; reason: string }> = [
  {
    path: 'app/actions/leads.ts',
    reason:
      'Server Action zapisująca/odczytująca soft_leady i legal_document_versions przez ' +
      'własny, lokalny getAdminClient() — żadna z tych tabel nie ma polityki SELECT/INSERT ' +
      'dla roli anon (WO B2C-RLS-PUBLIC, „Stan żywej bazy"); to nie jest katalog produktowy ' +
      'z D-R1, więc świadomie zostaje na kluczu serwisowym, jawnie w tym pliku, nie przez ' +
      'wspólny lib/supabaseClient.ts.',
  },
  {
    path: 'app/actions/getFomoSlots.ts',
    reason:
      'Server Action odczytująca system_config oraz starszą tabelę leadów (audytów umówionych z B2C) przez własny, lokalny klient ' +
      'service-role — obie tabele są poza D-R1 („to nie katalog"), anon nie ma na nich ' +
      'żadnej polityki (WO „Stan żywej bazy"); WO wprost wymaga, żeby ten odczyt „został na ' +
      'kluczu serwisowym w Server Action", nie przechodził na wspólny klient anonimowy.',
  },
  {
    path: 'lib/supabaseAdminClient.ts',
    reason:
      'Wspólny klient serwisowy dla Server Actions odczytujących cennik usług montażowych (D-R1) — ' +
      'polityka anon SELECT cofnięta migracją 20260929100000_b2c_rls_public_catalog.sql. ' +
      'Importowany przez getSetForConfig.ts, getRecommendation.ts, getBestsellers.ts, ' +
      'getLowestPriceForIndoorUnit.ts, getCatalog.ts zamiast pięciu osobnych klientów.',
  },
];

function toPosixRelative(absolutePath: string): string {
  return relative(APP_DIR, absolutePath).split('\\').join('/');
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (EXCLUDED_DIR_NAMES_ANY_DEPTH.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      // Wykluczenie tylko na zamierzonym poziomie: `apps/b2c-web/tests/`,
      // `apps/b2c-web/scripts/` itd. — sprawdzamy PREFIKS ścieżki względem APP_DIR, nie samą
      // nazwę katalogu, więc np. `app/scripts/` (gdyby kiedyś powstał) zostaje przeskanowany.
      const relDir = toPosixRelative(fullPath) + '/';
      if (EXCLUDED_RELATIVE_DIR_PREFIXES.some((prefix) => relDir === prefix)) continue;
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (fullPath === THIS_FILE) continue;
    if (!SOURCE_FILE_EXTENSIONS.has(extname(entry))) continue;
    // Pliki testowe (gdyby jakiś leżał poza tests/) i deklaracje typów nie są kodem
    // uruchamianym w apce — nie interesują tego skanu.
    if (/\.(test|itest|spec)\.[jt]sx?$/.test(entry)) continue;
    if (entry.endsWith('.d.ts')) continue;
    files.push(fullPath);
  }
  return files;
}

// Import `lib/supabaseAdminClient` dowolną formą ścieżki: aliasem (`@/lib/supabaseAdminClient`)
// albo relatywnie (`./supabaseAdminClient`, `../../lib/supabaseAdminClient`, ...).
const ADMIN_CLIENT_IMPORT_PATTERN =
  /from\s+['"](?:@\/lib\/supabaseAdminClient|(?:\.\.?\/)+(?:lib\/)?supabaseAdminClient)['"]/;

const USE_SERVER_DIRECTIVE_PATTERN = /^(['"])use server\1;?$/;

/**
 * Pierwsza niepusta, nie-komentarzowa linia pliku. W Next.js dyrektywa `"use server"` MUSI
 * być pierwszym statementem modułu — przed jakimkolwiek importem — więc wystarczy jedna
 * linia, bez parsera AST.
 */
function firstMeaningfulLine(content: string): string | undefined {
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith('//')) continue;
    return line;
  }
  return undefined;
}

describe('AC5 — lib/supabaseClient.ts używa wyłącznie klucza anonimowego, klucz serwisowy tylko w jawnej liście Server Actions', () => {
  // @REQ: B2C-RLS-PUBLIC
  it('lib/supabaseClient.ts (kod źródłowy) nie zawiera literału SUPABASE_SERVICE_ROLE_KEY', () => {
    const source = readFileSync(SUPABASE_CLIENT_SOURCE, 'utf8');
    expect(source).not.toContain(SERVICE_ROLE_KEY_LITERAL);
  });

  // @REQ: B2C-RLS-PUBLIC
  it(
    'import lib/supabaseClient.ts bez NEXT_PUBLIC_SUPABASE_ANON_KEY w środowisku rzuca błąd konfiguracji, ' +
      'nie tworzy cicho klienta z kluczem serwisowym ani z placeholder_key',
    async () => {
      vi.resetModules();
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sentinel_service_role_should_never_be_used_as_fallback');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder.supabase.co');

      await expect(import('../lib/supabaseClient')).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    },
  );

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // @REQ: B2C-RLS-PUBLIC
  it('żaden plik w apps/b2c-web poza ALLOWED_SERVICE_ROLE_KEY_FILES nie odwołuje się do SUPABASE_SERVICE_ROLE_KEY', () => {
    const allowedPaths = new Set(ALLOWED_SERVICE_ROLE_KEY_FILES.map((entry) => entry.path));
    for (const entry of ALLOWED_SERVICE_ROLE_KEY_FILES) {
      expect(entry.reason.length, `Wpis ${entry.path} musi mieć niepuste uzasadnienie`).toBeGreaterThan(0);
    }

    const sourceFiles = collectSourceFiles(APP_DIR);
    const violations: string[] = [];
    for (const filePath of sourceFiles) {
      const relPath = toPosixRelative(filePath);
      if (allowedPaths.has(relPath)) continue;
      const content = readFileSync(filePath, 'utf8');
      if (content.includes(SERVICE_ROLE_KEY_LITERAL)) {
        violations.push(relPath);
      }
    }

    expect(
      violations,
      `Pliki spoza jawnej listy odwołujące się do ${SERVICE_ROLE_KEY_LITERAL}: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  // @REQ: B2C-RLS-PUBLIC
  it('każdy importer lib/supabaseAdminClient (dowolną ścieżką) zaczyna się od dyrektywy "use server"', () => {
    const sourceFiles = collectSourceFiles(APP_DIR);
    const violations: string[] = [];
    let importerCount = 0;
    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, 'utf8');
      if (!ADMIN_CLIENT_IMPORT_PATTERN.test(content)) continue;
      importerCount += 1;
      const firstLine = firstMeaningfulLine(content);
      if (!firstLine || !USE_SERVER_DIRECTIVE_PATTERN.test(firstLine)) {
        violations.push(toPosixRelative(filePath));
      }
    }

    // Dowód, że test w ogóle coś sprawdza — dziś jest 5 importerów (WO), lista nie może
    // po cichu spaść do zera przy złej zmianie w skanie.
    expect(importerCount).toBeGreaterThan(0);
    expect(
      violations,
      `Pliki importujące lib/supabaseAdminClient bez dyrektywy "use server" jako pierwszej linii: ${violations.join(', ')}`,
    ).toEqual([]);
  });

  // @REQ: B2C-RLS-PUBLIC
  it('każdy plik z ALLOWED_SERVICE_ROLE_KEY_FILES faktycznie istnieje i faktycznie odwołuje się do SUPABASE_SERVICE_ROLE_KEY (lista nie jest martwa)', () => {
    for (const entry of ALLOWED_SERVICE_ROLE_KEY_FILES) {
      const fullPath = join(APP_DIR, entry.path);
      const content = readFileSync(fullPath, 'utf8');
      expect(
        content.includes(SERVICE_ROLE_KEY_LITERAL),
        `${entry.path} jest na liście wyjątków, ale nie odwołuje się już do ${SERVICE_ROLE_KEY_LITERAL} — usuń martwy wpis`,
      ).toBe(true);
    }
  });
});
