import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

/**
 * NOWA FUNKCJA (decyzje Michała, 2026-09-17): przeglądarka dokumentacji projektu w panelu
 * B2B (`/dokumentacja`), widoczna WYŁĄCZNIE dla roli `admin`. Renderuje pliki `.md` z
 * katalogu `turborepo/docs/` (dwa poziomy nad `apps/b2b-web`) jako HTML, ze szczególnym
 * naciskiem na poprawne renderowanie tabel Markdown (GFM) — to główny powód powstania
 * ekranu. Narzędzie WEWNĘTRZNE, BEZ zarejestrowanego ID wymagania w
 * `contracts/requirements.contract.mjs` — testy w tym pliku ŚWIADOMIE nie są tagowane `@REQ`
 * (poinstruowane explicite przez zadanie, nie przeoczenie).
 *
 * ═══════════════════════ KONTRAKT Z IMPLEMENTEREM (implementer-server) ═══════════════════════
 *
 * Nowy plik `apps/b2b-web/src/lib/docs/docs-catalog.ts` — moduł CZYSTY (bez importu
 * `react`, bez `"use client"`/`"use server"`, testowalny w izolacji — wzorem
 * `apps/b2b-web/src/lib/schedule/basket-select.ts` i `nav-visibility.ts`):
 *
 *   export type DocCategory = { id: string; label: string; dir: string }
 *   export type DocEntry = { categoryId: string; slug: string; title: string; fileName: string }
 *
 *   export const DOC_CATEGORIES: readonly DocCategory[] — DOKŁADNIE 6 pozycji, W TEJ
 *   KOLEJNOŚCI, `dir` i `label` DOSŁOWNIE (kontrakt UI wobec użytkownika, z Work Ordera):
 *     { label: 'Zasady i decyzje',     dir: '' }
 *     { label: 'Architektura systemu', dir: 'architecture' }
 *     { label: 'Procesy i przepływy',  dir: 'workflows' }
 *     { label: 'Zlecenia wdrożeniowe', dir: 'workorders' }
 *     { label: 'Scenariusze testowe',  dir: 'testing' }
 *     { label: 'Materiały biznesowe',  dir: 'prezentacje' }
 *   (`id` nie jest ustalony przez WO dosłownie — testy niżej sprawdzają kolejność i
 *   zawartość przez `dir`/`label`, nie zgadują `id`.)
 *
 *   export function listDocs(): DocEntry[] — dla KAŻDEJ kategorii z `DOC_CATEGORIES` czyta
 *   WYŁĄCZNIE pliki `.md` leżące BEZPOŚREDNIO w jej katalogu (bez rekursji) przez
 *   `readdirSync(dir, { withFileTypes: true })` + `readFileSync` z `node:fs` (SYNCHRONICZNE
 *   — nie `node:fs/promises`). Katalogi spoza `DOC_CATEGORIES` (`prompts/`, `integrations/`,
 *   `performance/`) są ZAWSZE pomijane, nawet jeśli fizycznie istnieją w `docs/`. `title` =
 *   treść pierwszego nagłówka `# ...` w pliku (bez `#`, przycięta), fallback = nazwa pliku
 *   bez rozszerzenia, gdy nagłówka nie ma. `slug` = bezpieczny identyfikator zbudowany z
 *   `categoryId` + nazwy pliku — dokładny separator NIE jest częścią kontraktu (testy
 *   sprawdzają właściwości slug-a przez round-trip z `findDocBySlug`, nie format napisu).
 *
 *   export function findDocBySlug(slug: string): DocEntry | null — zwraca wpis WYŁĄCZNIE
 *   jeśli jest w liście zwróconej przez `listDocs()`. KAŻDY inny slug (w tym próby path
 *   traversal) → `null`, BEZ WYWOŁANIA `readFileSync` — ścieżka pliku nie może NIGDY być
 *   budowana przez sklejenie z surowym wejściem użytkownika.
 *
 *   export function readDocContent(entry: DocEntry): string — czyta zawartość pliku
 *   odpowiadającego JUŻ ZWERYFIKOWANEMU `DocEntry` (pochodzącemu z `findDocBySlug`/`listDocs`).
 *
 * Ustanowienie wzorca mockowania `node:fs` (brak precedensu w repo — sprawdzone:
 * `grep -rl "vi.mock.*fs" apps/b2b-web/tests` nic nie zwraca): `readdirSync`/`readFileSync`
 * jako `vi.fn()` przez `vi.hoisted`, odpowiadające na podstawie `path.basename(...)`
 * argumentu wywołania — niezależnie od tego, ile poziomów względnych implementer wybierze,
 * żeby zbudować ścieżkę do `docs/`. Atrapa WYMAGA `{ withFileTypes: true }` w `readdirSync`
 * (część kontraktu: implementacja musi rozróżniać plik/katalog przez `Dirent`, nie przez
 * dodatkowe zapytania `statSync`).
 */

const { readdirSyncMock, readFileSyncMock } = vi.hoisted(() => ({
  readdirSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readdirSync: readdirSyncMock,
  readFileSync: readFileSyncMock,
}));

type FixtureEntry = { name: string; isDirectory: boolean };

const FS_FIXTURE: Record<string, FixtureEntry[]> = {
  docs: [
    { name: '00-METHODOLOGY.md', isDirectory: false },
    { name: 'DECISIONS.md', isDirectory: false },
    { name: 'BACKLOG.md', isDirectory: false },
    { name: 'architecture', isDirectory: true },
    { name: 'workflows', isDirectory: true },
    { name: 'workorders', isDirectory: true },
    { name: 'testing', isDirectory: true },
    { name: 'prezentacje', isDirectory: true },
    // ŚWIADOMIE POMINIĘTE przez WO — mimo że istnieją fizycznie w docs/, muszą zostać
    // odfiltrowane przez implementację, nie przez fakt nieistnienia w atrapie.
    { name: 'prompts', isDirectory: true },
    { name: 'integrations', isDirectory: true },
    { name: 'performance', isDirectory: true },
  ],
  architecture: [
    { name: 'NAMING.md', isDirectory: false },
    // plik niebędący .md — musi być pominięty niezależnie od kategorii.
    { name: 'diagram.png', isDirectory: false },
  ],
  workflows: [{ name: 'b2b_funnel_process.md', isDirectory: false }],
  workorders: [{ name: 'FLD-QUOTE-BASKET-SELECT.md', isDirectory: false }],
  testing: [{ name: 'scenario-1.md', isDirectory: false }],
  prezentacje: [{ name: 'oferta.md', isDirectory: false }],
  prompts: [{ name: 'secret-prompt.md', isDirectory: false }],
  integrations: [{ name: 'integration-notes.md', isDirectory: false }],
  performance: [{ name: 'perf-notes.md', isDirectory: false }],
};

const FILE_CONTENT: Record<string, string> = {
  '00-METHODOLOGY.md': '# Metodologia\n\ntreść metodologii...',
  'DECISIONS.md': '# Decyzje architektoniczne\n\ntreść decyzji...',
  // celowo BEZ nagłówka `# ` — dowód fallbacku na nazwę pliku.
  'BACKLOG.md': 'Brak nagłówka w tym pliku, tylko lista zadań w treści.',
  'NAMING.md': '# Nazewnictwo\n\ntreść słownika nazw...',
  'b2b_funnel_process.md': '# Proces lejka B2B\n\ntreść procesu...',
  'FLD-QUOTE-BASKET-SELECT.md': '# FLD-QUOTE-BASKET-SELECT\n\ntreść zlecenia...',
  // celowo BEZ nagłówka.
  'scenario-1.md': 'Scenariusz testowy bez nagłówka markdown na górze pliku.',
  'oferta.md': '# Oferta handlowa\n\ntreść z tabelą GFM...',
  'secret-prompt.md': '# PROMPT WEWNĘTRZNY — TO NIGDY NIE POWINNO SIĘ POJAWIĆ',
  'integration-notes.md': '# Notatki integracyjne — TO NIGDY NIE POWINNO SIĘ POJAWIĆ',
  'perf-notes.md': '# Notatki wydajnościowe — TO NIGDY NIE POWINNO SIĘ POJAWIĆ',
};

readdirSyncMock.mockImplementation((dirPath: unknown, options?: unknown) => {
  const opts = options as { withFileTypes?: boolean } | undefined;
  if (!opts?.withFileTypes) {
    throw new Error(
      `Atrapa fs: readdirSync musi być wywołane z { withFileTypes: true } (wywołano dla ${String(dirPath)})`,
    );
  }
  const base = path.basename(String(dirPath));
  const entries = FS_FIXTURE[base] ?? [];
  return entries.map((entry) => ({
    name: entry.name,
    isDirectory: () => entry.isDirectory,
    isFile: () => !entry.isDirectory,
  }));
});

readFileSyncMock.mockImplementation((filePath: unknown) => {
  const base = path.basename(String(filePath));
  const content = FILE_CONTENT[base];
  if (content === undefined) {
    throw new Error(`Atrapa fs: ENOENT — brak zamockowanej treści dla ${String(filePath)}`);
  }
  return content;
});

beforeEach(() => {
  readdirSyncMock.mockClear();
  readFileSyncMock.mockClear();
});

const ALL_LEGAL_FILE_NAMES = [
  '00-METHODOLOGY.md',
  'BACKLOG.md',
  'DECISIONS.md',
  'FLD-QUOTE-BASKET-SELECT.md',
  'NAMING.md',
  'b2b_funnel_process.md',
  'oferta.md',
  'scenario-1.md',
].sort();

describe('DOC_CATEGORIES — kontrakt UI (dosłowne polskie etykiety, ustalona kolejność)', () => {
  it('ma dokładnie 6 pozycji, w ustalonej kolejności katalogów', async () => {
    const { DOC_CATEGORIES } = await import('../src/lib/docs/docs-catalog');

    expect(DOC_CATEGORIES).toHaveLength(6);
    expect(DOC_CATEGORIES.map((category: { dir: string }) => category.dir)).toEqual([
      'prezentacje',
      '',
      'architecture',
      'workflows',
      'workorders',
      'testing',
    ]);
  });

  it('etykiety w interfejsie są dosłownie te z Work Ordera (kontrakt UI, nie dowolna redakcja)', async () => {
    const { DOC_CATEGORIES } = await import('../src/lib/docs/docs-catalog');

    expect(DOC_CATEGORIES.map((category: { label: string }) => category.label)).toEqual([
      'Materiały biznesowe',
      'Zasady i decyzje',
      'Architektura systemu',
      'Procesy i przepływy',
      'Zlecenia wdrożeniowe',
      'Scenariusze testowe',
    ]);
  });
});

describe('listDocs() — grupowanie po kategoriach i filtrowanie katalogów spoza listy', () => {
  it('każdy wpis ma categoryId należące do DOC_CATEGORIES (żaden wpis spoza katalogu)', async () => {
    const { listDocs, DOC_CATEGORIES } = await import('../src/lib/docs/docs-catalog');
    const knownIds = new Set(DOC_CATEGORIES.map((category: { id: string }) => category.id));

    const entries = listDocs();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries as Array<{ categoryId: string }>) {
      expect(knownIds.has(entry.categoryId)).toBe(true);
    }
  });

  it('pomija katalogi spoza DOC_CATEGORIES (prompts/, integrations/, performance/), mimo że atrapa fs je zwraca', async () => {
    const { listDocs } = await import('../src/lib/docs/docs-catalog');

    const fileNames = listDocs().map((entry: { fileName: string }) => entry.fileName);
    expect(fileNames).not.toContain('secret-prompt.md');
    expect(fileNames).not.toContain('integration-notes.md');
    expect(fileNames).not.toContain('perf-notes.md');
  });

  it('zawiera dokładnie i wyłącznie pliki .md z katalogów skatalogowanych', async () => {
    const { listDocs } = await import('../src/lib/docs/docs-catalog');

    const fileNames = listDocs()
      .map((entry: { fileName: string }) => entry.fileName)
      .sort();
    expect(fileNames).toEqual(ALL_LEGAL_FILE_NAMES);
  });

  it('pliki inne niż .md są pomijane (diagram.png w architecture/)', async () => {
    const { listDocs } = await import('../src/lib/docs/docs-catalog');

    const fileNames = listDocs().map((entry: { fileName: string }) => entry.fileName);
    expect(fileNames).not.toContain('diagram.png');
  });
});

describe('listDocs() — title z pierwszego nagłówka, fallback na nazwę pliku', () => {
  it('title pochodzi z treści pierwszego nagłówka "# " w pliku', async () => {
    const { listDocs } = await import('../src/lib/docs/docs-catalog');

    const naming = listDocs().find((entry: { fileName: string; title: string }) => entry.fileName === 'NAMING.md');
    expect(naming?.title).toBe('Nazewnictwo');

    const backlogHeaderless = listDocs().find((entry: { fileName: string; title: string }) => entry.fileName === 'DECISIONS.md');
    expect(backlogHeaderless?.title).toBe('Decyzje architektoniczne');
  });

  it('title ma fallback na nazwę pliku, gdy plik nie zawiera nagłówka "# "', async () => {
    const { listDocs } = await import('../src/lib/docs/docs-catalog');

    const backlog = listDocs().find((entry: { fileName: string; title: string }) => entry.fileName === 'BACKLOG.md');
    expect(backlog).toBeDefined();
    expect(backlog?.title.length).toBeGreaterThan(0);
    // Nie jest treścią pliku (bo brak nagłówka) — musi pochodzić z nazwy pliku.
    expect(backlog?.title).not.toContain('Brak nagłówka');
  });
});

describe('findDocBySlug() — round-trip z listDocs(), odmowa dla nieznanych slugów', () => {
  it('zwraca wpis identyczny z listDocs() dla prawidłowego sluga', async () => {
    const { listDocs, findDocBySlug } = await import('../src/lib/docs/docs-catalog');

    const naming = listDocs().find((entry: { fileName: string; slug: string }) => entry.fileName === 'NAMING.md');
    expect(naming).toBeDefined();
    expect(findDocBySlug(naming!.slug)).toEqual(naming);
  });

  it('zwraca null dla sluga, który nie odpowiada żadnemu skatalogowanemu wpisowi', async () => {
    const { findDocBySlug } = await import('../src/lib/docs/docs-catalog');

    expect(findDocBySlug('nieistniejacy-slug-nigdy-skatalogowany-xyz')).toBeNull();
  });
});

describe('BEZPIECZEŃSTWO — findDocBySlug() odrzuca path traversal, zero odczytu z dysku', () => {
  const MALICIOUS_SLUGS = [
    '../../../etc/passwd',
    '..%2F..%2F..%2Fetc%2Fpasswd',
    '/etc/passwd',
    'docs/../../.env',
    'architecture/../../../.env',
    '....//....//etc/passwd',
    'root__../../../../etc/passwd',
    'NAMING.md/../../../etc/passwd',
    '\0architecture/NAMING.md',
    'architecture/NAMING.md\0.png',
  ];

  it.each(MALICIOUS_SLUGS)('slug złośliwy %j jest odrzucony (null) i NIE wywołuje readFileSync', async (maliciousSlug) => {
    const { findDocBySlug } = await import('../src/lib/docs/docs-catalog');
    readFileSyncMock.mockClear();

    expect(findDocBySlug(maliciousSlug)).toBeNull();
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });

  it('slug pusty i undefined-jak-wejście (string puste) jest odrzucony', async () => {
    const { findDocBySlug } = await import('../src/lib/docs/docs-catalog');
    readFileSyncMock.mockClear();

    expect(findDocBySlug('')).toBeNull();
    expect(readFileSyncMock).not.toHaveBeenCalled();
  });
});
