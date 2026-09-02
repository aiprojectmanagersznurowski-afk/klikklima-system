import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Audyt: `docs/performance/AUDYT-B2B-2026-09-02.md`, znalezisko P0-1.
 *
 * `getCurrentActorRole()` (`apps/b2b-web/src/utils/supabase/server.ts`) robi przy
 * KAŻDYM wywołaniu roundtrip `supabase.auth.getUser()` (~100 ms) + zapytanie
 * `prisma.authorizedUser.findUnique` (~174 ms), a jest wołane 2-3× w obrębie tego
 * samego żądania (`page.tsx`, wewnątrz `getLeads()`, plus jawny `auth.getUser()`
 * dla audytora). Naprawa z audytu: `React.cache()` — memoizacja na czas jednego
 * żądania serwerowego (`node_modules/next/dist/docs/01-app/01-getting-started/
 * 06-fetching-data.md`, linia ~548).
 *
 * ═══════════════ DLACZEGO NIE MA TU TESTU "wywołaj 3x, policz roundtripy" ═══════════════
 *
 * Sprawdzone empirycznie (Node 26 / react@19.2.4, poza kontekstem renderu React):
 *
 *   const { cache } = require('react');
 *   let calls = 0;
 *   const fn = cache(async () => { calls++; return calls; });
 *   await fn(); await fn(); await fn();
 *   // calls === 3  <-- BRAK memoizacji poza "request scope" Reacta
 *
 * `React.cache()` memoizuje wyłącznie w obrębie jednego renderu komponentów
 * serwerowych (per-request AsyncLocalStorage prowadzony przez sam React/Next).
 * Vitest nie tworzy takiego kontekstu — wywołanie `getCurrentActorRole()` trzy razy
 * pod rząd w teście jednostkowym NIE zmemoizuje się ani przed naprawą, ani po niej.
 * Test w formie z Work Orderu ("3 wywołania -> auth.getUser() dokładnie raz") byłby
 * RED dziś i pozostałby RED także PO poprawnie wdrożonej naprawie — to jest zły RED
 * (dowodzi nieistnienia kontekstu testowego, nie braku memoizacji), więc zgodnie z
 * poleceniem WO ("jeśli niewykonalne — zgłoś i zaproponuj testowalną alternatywę")
 * ZAMIAST tego piszemy:
 *
 *  1. Test statyczny (poniżej) — dowodzi, że `server.ts` importuje `cache` z `react`
 *     i że `getCurrentActorRole` jest zdefiniowane jako `cache(...)`. Słabszy niż
 *     test dynamiczny (nie mierzy realnej deduplikacji), ale uczciwy: faktycznie
 *     failuje dziś (implementacja nie używa `cache()`) i faktycznie przejdzie po
 *     zastosowaniu naprawy z audytu, bez fałszywego zielonego ani fałszywego
 *     czerwonego.
 *  2. Testy zachowania (opisane niżej) — `getCurrentActorRole()` wywoływane
 *     POJEDYNCZO (żadnej zależności od semantyki `cache()`) muszą zwracać identyczne
 *     wyniki po refaktorze: `null` przy braku sesji, `null` gdy e-mail spoza
 *     `AuthorizedUser`, `null` gdy rola spoza `ROLES`, poprawna rola w happy path.
 *     `grep -rln "getCurrentActorRole" apps/b2b-web/tests/` (sprawdzone przed
 *     napisaniem tego pliku) pokazuje wyłącznie testy, które MOCKUJĄ cały moduł
 *     `utils/supabase/server` — żaden nie wywołuje prawdziwej implementacji. Te
 *     cztery przypadki są więc nowe, nie duplikatem.
 *
 * Mockujemy `@supabase/ssr` (wzorem `middleware-auditor-blocked.test.ts`),
 * `next/headers` (`cookies()` poza kontekstem żądania Next.js po prostu nie istnieje
 * bez mocka) i `@repo/database` (brak żywej instancji testowej).
 */

const SERVER_TS_PATH = fileURLToPath(
  new URL('../src/utils/supabase/server.ts', import.meta.url),
);

describe('server.ts — React.cache() na getCurrentActorRole (P0-1, statyczny dowód wdrożenia)', () => {
  const source = readFileSync(SERVER_TS_PATH, 'utf-8');

  it('importuje `cache` z pakietu "react"', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bcache\b[^}]*\}\s*from\s*['"]react['"]/);
  });

  it('getCurrentActorRole jest zdefiniowane jako wynik wywołania cache(...), nie zwykłą funkcją', () => {
    // Kontrakt dla implementera: `export const getCurrentActorRole = cache(async (): Promise<Role | null> => { ... })`
    // (albo owinięcie nazwanej funkcji bazowej i re-export pod tą samą nazwą — obie
    // formy pasują do tego wzorca, bo obie wiążą identyfikator `getCurrentActorRole`
    // bezpośrednio z wywołaniem `cache(`).
    expect(source).toMatch(
      /(?:export\s+)?const\s+getCurrentActorRole\s*(?::[^=]+)?=\s*cache\(/,
    );
  });
});

const { getUserMock, findUniqueMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    authorizedUser: { findUnique: findUniqueMock },
  },
}));

const { getCurrentActorRole } = await import('../src/utils/supabase/server');

describe('getCurrentActorRole() — zachowanie musi pozostać identyczne po wdrożeniu cache() (P0-1)', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    findUniqueMock.mockReset();
  });

  it('brak sesji (auth.getUser zwraca user: null) -> null, zero zapytań do AuthorizedUser', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const role = await getCurrentActorRole();

    expect(role).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('e-mail spoza AuthorizedUser (findUnique zwraca null) -> null', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ktos@nieznany.pl' } } });
    findUniqueMock.mockResolvedValue(null);

    const role = await getCurrentActorRole();

    expect(role).toBeNull();
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: 'ktos@nieznany.pl' },
      select: { role: true },
    });
  });

  it('rola zapisana w AuthorizedUser spoza słownika ROLES -> null (fail-closed)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ktos@klikklima.pl' } } });
    findUniqueMock.mockResolvedValue({ role: 'nieistniejaca_rola_spoza_kontraktu' });

    const role = await getCurrentActorRole();

    expect(role).toBeNull();
  });

  it('happy path: sesja + rola w ROLES -> zwraca dokładnie tę rolę', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } });
    findUniqueMock.mockResolvedValue({ role: 'admin' });

    const role = await getCurrentActorRole();

    expect(role).toBe('admin');
  });
});
