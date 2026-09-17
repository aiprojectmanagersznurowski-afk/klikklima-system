import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * NOWA FUNKCJA (decyzje Michała, 2026-09-17): przeglądarka dokumentacji projektu w panelu B2B
 * (`/dokumentacja`), widoczna i dostępna WYŁĄCZNIE dla roli `admin`. Narzędzie wewnętrzne,
 * bez ID wymagania w `contracts/requirements.contract.mjs` — testy w tym pliku ŚWIADOMIE
 * bez `@REQ`.
 *
 * Wzorzec bramki skopiowany 1:1 z `apps/b2b-web/tests/scheduling-config-calendar-page-authz.test.ts`
 * i `settings-page-authz.test.ts`: `notFound()` z `next/navigation`, wywołane PRZED
 * jakimkolwiek odczytem z dysku (`listDocs`/`findDocBySlug`/`readDocContent`), z JAWNYM
 * `return;` zaraz po nim (patrz komentarz w `settings-page-authz.test.ts`, punkt 2 —
 * `notFound()` zamockowany jako `vi.fn()` NIE przerywa wykonania samoistnie).
 *
 * RÓŻNICA wobec tamtych dwóch plików: bramka tego ekranu jest PROSTYM porównaniem roli
 * (`actorRole !== 'admin' → notFound()`), NIE przechodzi przez `can()` — "dokumentacja" nie
 * jest zasobem w `RESOURCES` (contracts/rbac.contract.mjs), bo nie odpowiada żadnej tabeli.
 * To jest DECYZJA WO, nie uproszczenie testu — WO mówi dosłownie "widoczna i dostępna
 * wyłącznie dla roli admin".
 *
 * ═══════════════════════ KONTRAKT Z IMPLEMENTEREM (implementer-server) ═══════════════════════
 *
 * `apps/b2b-web/src/app/(dashboard)/dokumentacja/page.tsx` — Server Component async:
 *   1. `actorRole = await getCurrentActorRole()` (import względny z `../../utils/supabase/server`,
 *      wzorem `settings/page.tsx`), w `try/catch` (błąd zapytania o rolę → odmowa, nie 500).
 *   2. `if (actorRole !== 'admin') { notFound(); return; }`
 *   3. Dopiero PO bramce: `listDocs()` z `../../../lib/docs/docs-catalog`, wynik przekazany
 *      do komponentu klienckiego (mockowanego w testach jako cały moduł, wzorem
 *      `SettingsClient`/`CalendarSettingsClient`).
 *
 * `apps/b2b-web/src/app/(dashboard)/dokumentacja/[slug]/page.tsx` — Server Component async,
 * `params: Promise<{ slug: string }>` (wzorem `customers/[id]/page.tsx`):
 *   1. Ta sama bramka roli, PRZED `await params` I przed `findDocBySlug`/`readDocContent`.
 *   2. `const { slug } = await params; const entry = findDocBySlug(slug); if (!entry) { notFound(); return; }`
 *   3. `readDocContent(entry)` przekazane do komponentu renderującego Markdown
 *      (`doc-markdown.tsx`, mockowany w testach jako cały moduł).
 *
 * Mockowane zależności: `../src/utils/supabase/server` (`getCurrentActorRole`/`getCurrentUser`),
 * `next/navigation` (`notFound`/`redirect` jako no-opowe `vi.fn()`), `../src/lib/docs/docs-catalog`
 * (`listDocs`/`findDocBySlug`/`readDocContent` — unika prawdziwego `node:fs`), oraz komponenty
 * klienckie renderujące listę/treść (mockowane jako całe moduły — patrz
 * `feedback_react_ui_test_infra_limits` w pamięci agenta: brak jsdom/aliasu `@/*` w root
 * `vitest.config.mts`).
 */

const {
  listDocsMock,
  findDocBySlugMock,
  readDocContentMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  notFoundMock,
  redirectMock,
  DocsListClientMock,
  DocMarkdownMock,
} = vi.hoisted(() => ({
  listDocsMock: vi.fn(),
  findDocBySlugMock: vi.fn(),
  readDocContentMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
  DocsListClientMock: vi.fn(),
  DocMarkdownMock: vi.fn(),
}));

vi.mock('../src/lib/docs/docs-catalog', () => ({
  listDocs: listDocsMock,
  findDocBySlug: findDocBySlugMock,
  readDocContent: readDocContentMock,
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));
vi.mock('../src/app/(dashboard)/dokumentacja/docs-list-client', () => ({
  DocsListClient: DocsListClientMock,
}));
vi.mock('../src/app/(dashboard)/dokumentacja/doc-markdown', () => ({
  DocMarkdown: DocMarkdownMock,
}));

const DocsListScreen = (await import('../src/app/(dashboard)/dokumentacja/page')).default;
const DocDetailScreen = (await import('../src/app/(dashboard)/dokumentacja/[slug]/page')).default;

const UNAUTHORIZED_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

const DOC_ENTRY_FIXTURE = {
  categoryId: 'architecture',
  slug: 'architecture__NAMING',
  title: 'Nazewnictwo',
  fileName: 'NAMING.md',
};

beforeEach(() => {
  listDocsMock.mockReset();
  findDocBySlugMock.mockReset();
  readDocContentMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  notFoundMock.mockReset();
  redirectMock.mockReset();
  DocsListClientMock.mockReset();
  DocMarkdownMock.mockReset();

  getCurrentActorRoleMock.mockResolvedValue('admin');
  listDocsMock.mockReturnValue([DOC_ENTRY_FIXTURE]);
  findDocBySlugMock.mockReturnValue(DOC_ENTRY_FIXTURE);
  readDocContentMock.mockReturnValue('# Nazewnictwo\n\ntreść...');
});

describe('DocsListScreen (/dokumentacja) — bramka roli admin, notFound przed odczytem z dysku', () => {
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona PRZED wywołaniem listDocs()',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const call = DocsListScreen();
      await expect(call).resolves.not.toBeInstanceOf(Error);

      expect(listDocsMock).not.toHaveBeenCalled();
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = DocsListScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(listDocsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek/500', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const call = DocsListScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(listDocsMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('admin przechodzi bramkę i otrzymuje wynik listDocs()', async () => {
    const result = await DocsListScreen();

    expect(listDocsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: DocsListClientMock });
  });
});

describe('DocDetailScreen (/dokumentacja/[slug]) — bramka roli admin, notFound przed findDocBySlug/readDocContent', () => {
  const paramsFor = (slug: string) => Promise.resolve({ slug });

  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona PRZED wywołaniem findDocBySlug/readDocContent',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const call = DocDetailScreen({ params: paramsFor(DOC_ENTRY_FIXTURE.slug) });
      await expect(call).resolves.not.toBeInstanceOf(Error);

      expect(findDocBySlugMock).not.toHaveBeenCalled();
      expect(readDocContentMock).not.toHaveBeenCalled();
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = DocDetailScreen({ params: paramsFor(DOC_ENTRY_FIXTURE.slug) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(findDocBySlugMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek/500', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const call = DocDetailScreen({ params: paramsFor(DOC_ENTRY_FIXTURE.slug) });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(findDocBySlugMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('admin ze znanym slugiem przechodzi bramkę i otrzymuje treść z readDocContent', async () => {
    const result = await DocDetailScreen({ params: paramsFor(DOC_ENTRY_FIXTURE.slug) });

    expect(findDocBySlugMock).toHaveBeenCalledWith(DOC_ENTRY_FIXTURE.slug);
    expect(readDocContentMock).toHaveBeenCalledWith(DOC_ENTRY_FIXTURE);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ type: DocMarkdownMock });
  });

  it('admin ze slugiem nieznanym katalogowi (findDocBySlug -> null) dostaje notFound(), nie 500', async () => {
    findDocBySlugMock.mockReturnValue(null);

    const call = DocDetailScreen({ params: paramsFor('nieznany-slug') });
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(readDocContentMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
