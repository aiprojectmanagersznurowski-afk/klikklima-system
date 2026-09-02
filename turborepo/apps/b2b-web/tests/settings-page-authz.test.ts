import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

/**
 * Wymaganie: SEC-AUTHZ-USER-MGMT (contracts/requirements.contract.mjs), status TODO.
 * Kontynuacja tej samej sesji: `settings/actions.ts` (create/delete) już naprawione i
 * scommitowane (patrz settings-authorized-users.test.ts) — dziś rano (2026-08-25) kontrakt
 * rozszerzono o dwa kryteria dotyczące zdolności `read`. Znalezisko (rls-security-auditor,
 * przy weryfikacji naprawy create/delete): `settings/page.tsx` czyta PEŁNĄ listę kont
 * (e-maile, role) przez `prisma.authorizedUser.findMany()` bez JAKIEGOKOLWIEK sprawdzenia
 * roli wywołującego — każdy zalogowany `authorized_user` (dyspozytor, audytor, monter)
 * widzi listę kont wszystkich pracowników, mimo że macierz RBAC mówi
 * `authorized_users.read = ['admin']` od początku.
 *
 * Ten plik jest CELOWO osobny od settings-authorized-users.test.ts: testuje inny plik
 * (`settings/page.tsx`, nie `settings/actions.ts`) i inny KSZTAŁT modułu — Server Component
 * (async funkcja zwracająca JSX), nie Server Action zwracająca `{ success, error }`. Nie ma
 * w repo precedensu testu takiego pliku (sprawdzone: `find apps/b2b-web/tests -iname
 * "*page*"` nic nie zwraca; jedyny pokrewny WO, SERVICE-ROLE-LEADS-PAGE, świadomie NIE
 * testował page.tsx bezpośrednio — wydzielił logikę do osobnego modułu server-only
 * właśnie po to, żeby dało się ją przetestować w izolacji). Tu takiej możliwości nie ma:
 * bramka MUSI siedzieć w samym Server Component, bo to jedyne miejsce w tej ścieżce, które
 * widzi rolę PRZED zapytaniem do bazy.
 *
 * ═══════════════════════ KSZTAŁT BRAMKI (kontrakt dla implementer-server) ═══════════════════════
 *
 * Decyzja: `notFound()` z `next/navigation`, wywołane PRZED `prisma.authorizedUser.findMany(...)`,
 * z JAWNYM `return;` zaraz po nim. Uzasadnienie:
 *
 * 1. Kryterium z kontraktu: "kształt odmowy na ścieżce widoku (przekierowanie albo strona
 *    odmowy) jest wyborem implementacji, wykluczony jest wyjątek 500" — `notFound()` (błąd
 *    sterujący złapany przez framework, nie goły `throw new Error(...)`) spełnia to wprost.
 *    `redirect('/leads')` byłby równie zgodny z kontraktem, ale wymaga wyboru JEDNEGO
 *    kierunku, żeby test miał deterministyczny cel — wybieram `notFound()`, bo nie zakłada
 *    istnienia konkretnej innej trasy, do której "bezpiecznie" przekierować każdą rolę.
 *
 * 2. KRYTYCZNE dla poprawności testu: `vi.mock('next/navigation', ...)` podmienia `notFound`
 *    na zwykły `vi.fn()`, KTÓRY NIE RZUCA. Prawdziwy Next.js `notFound()` rzuca błąd sterowania
 *    (`NEXT_HTTP_ERROR_FALLBACK`), który przerywa wykonanie funkcji w miejscu wywołania — w
 *    tym mocku wykonanie NIE zostaje przerwane samo z siebie. Gdyby implementacja napisała
 *    `if (...) { notFound(); }` BEZ jawnego `return`, w PRODUKCJI zadziała poprawnie (prawdziwy
 *    `notFound()` i tak nigdy nie odda sterowania), ale w TYM środowisku testowym wykonanie
 *    poleci dalej do `findMany(...)` — czyli identyczny kod zachowuje się różnie pod testem i
 *    na produkcji. Jedynym sposobem, żeby test i produkcja się zgadzały, jest wymaganie
 *    jawnego `return;` zaraz po `notFound()` jako część kontraktu implementacji — nie jest to
 *    kosmetyka, to jedyny sposób, żeby asercja `findMany` `not.toHaveBeenCalled()` w tym pliku
 *    faktycznie dowodziła tego, co ma dowodzić. `implementer-server`: pisz
 *    `notFound(); return;`, nie samo `notFound();`.
 *
 * 3. Asercje w testach odmowy CELOWO nie sprawdzają "czy funkcja się zatrzymała" przez
 *    inspekcję wartości zwróconej (bo w mocku nie zatrzyma się bez (2)) — sprawdzają WPROST,
 *    że `prisma.authorizedUser.findMany` nie zostało wywołane (kryterium #1 z kontraktu:
 *    "pusty ekran niczego nie dowodzi... bramka musi zapadać zanim powstanie zapytanie do
 *    bazy") ORAZ że `notFound` zostało wywołane (dowód, że to zamockowany mechanizm odmowy,
 *    a nie goły wyjątek, przerwał ścieżkę — kryterium #5).
 *
 * 4. Kryterium #4 (odmowa NIE jako pusta lista): `SettingsClient` jest tu MOCKOWANY jako cały
 *    moduł (`../src/app/(dashboard)/settings/SettingsClient`), więc `<SettingsClient users={...} />`
 *    w kodzie produkcyjnym tworzy element React (`React.createElement`), który NIE wywołuje
 *    funkcji komponentu — nie ma tu `render()`/`renderToString()`, więc `expect(SettingsClientMock)
 *    .toHaveBeenCalled()` nigdy niczego by nie dowiodło (mock jako referencja typu JSX nie jest
 *    "wołany"). Dlatego różnicowanie kryterium #4 opiera się na `findMany` (wywołane tylko na
 *    ścieżce zezwolenia) — dokładnie tak, jak sugeruje sam kontrakt.
 *
 * Mockowane zależności: `@repo/database` (brak żywej instancji testowej — jak w
 * settings-authorized-users.test.ts), `../src/utils/supabase/server` (`getCurrentActorRole`
 * woła `next/headers cookies()`, niedostępne poza kontekstem żądania Next.js), `next/navigation`
 * (`notFound`/`redirect` są no-opowymi `vi.fn()` — patrz punkt 2 wyżej) oraz
 * `../src/app/(dashboard)/settings/SettingsClient` (komponent kliencki: `"use client"`,
 * `lucide-react`, `@/components/ui/*` rozwiązywane aliasem `@/*` z `tsconfig.json`, którego
 * `vitest.config.mts` w korzeniu repo NIE definiuje — import bez mocka skończyłby się błędem
 * rozwiązywania modułu, czyli złym RED z niewłaściwego powodu, patrz CLAUDE.md tego agenta).
 *
 * Świadomie POZA zakresem tego pliku (uzasadnienie):
 * - RLS: `authorized_users` nie ma żadnej polityki RLS (ustalone już w
 *   settings-authorized-users.test.ts) — Prisma i tak ją omija, jedyną granicą jest kod.
 *   Dodanie testu RLS dla tabeli bez polityk byłoby testem-atrapą.
 * - Idempotencja / współbieżność: to czysty odczyt bez efektu ubocznego — nie ma czego
 *   duplikować ani o co się ścigać.
 * - Przypadek maksymalny: kontrakt nie definiuje żadnego limitu/paginacji dla listy kont
 *   (to wewnętrzna lista pracowników, nie dane klienckie) — brak progu do przetestowania.
 *   Zamiast tego niżej jest test przypadku PUSTEGO w wariancie POZYTYWNYM (admin, zero kont),
 *   celowo skontrastowany z odmową — to właśnie jest sedno kryterium #4.
 */

const {
  authorizedUserFindManyMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  notFoundMock,
  redirectMock,
  SettingsClientMock,
} = vi.hoisted(() => ({
  authorizedUserFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
  SettingsClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    authorizedUser: {
      findMany: authorizedUserFindManyMock,
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));
vi.mock('../src/app/(dashboard)/settings/SettingsClient', () => ({
  SettingsClient: SettingsClientMock,
}));

const SettingsScreen = (await import('../src/app/(dashboard)/settings/page')).default;

const UNAUTHORIZED_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

const ADMIN_USERS_FIXTURE = [
  {
    id: 'usr-1',
    email: 'admin@klikklima.pl',
    role: 'admin',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'usr-2',
    email: 'dyspozytor@klikklima.pl',
    role: 'dyspozytor',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  },
];

describe('SettingsScreen - bramka RBAC na odczycie listy kont (SEC-AUTHZ-USER-MGMT)', () => {
  beforeEach(() => {
    authorizedUserFindManyMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    notFoundMock.mockReset();
    redirectMock.mockReset();
    SettingsClientMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kontrola pozytywna: macierz RBAC rzeczywiście przyznaje adminowi `read` na
  // authorized_users i odmawia go pozostałym trzem rolom. Bez tego testu bramka mogłaby
  // odrzucać WSZYSTKICH i "przechodzić" z niewłaściwego powodu.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('kontrola pozytywna kontraktu - authorized_users.read = [admin] w wygenerowanej macierzy RBAC', () => {
    expect(PERMISSIONS.authorized_users.read).toEqual(['admin']);
    expect(can('admin', 'authorized_users', 'read')).toBe('yes');
    for (const role of UNAUTHORIZED_ROLES) {
      expect(can(role, 'authorized_users', 'read')).toBe('no');
    }
  });

  // Kryterium #1: bramka musi zapadać ZANIM powstanie zapytanie do bazy - "pusty ekran
  // niczego nie dowodzi". Kryterium #4: różnicujemy odmowę od "listy pustej" przez
  // findMany nie wywołane, nie przez inspekcję JSX (patrz komentarz na górze pliku, punkt 4).
  // Kryterium #5: notFound (nie goły throw) jest tym, co odróżnia odmowę od wyjątku 500.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it.each(UNAUTHORIZED_ROLES)(
    'SettingsScreen() wywołane bezpośrednio przez rolę %s jest odrzucone PRZED zapytaniem do bazy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const call = SettingsScreen();
      await expect(call).resolves.not.toBeInstanceOf(Error);

      expect(authorizedUserFindManyMock).not.toHaveBeenCalled();
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    },
  );

  // Fail-closed: brak sesji / e-mail spoza authorized_users -> getCurrentActorRole() zwraca
  // null. Musi dać dokładnie ten sam efekt co rola nieuprawniona, nie przepuszczenie.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('SettingsScreen() - brak roli (null) jest odrzucone fail-closed, nie przepuszczone', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const call = SettingsScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(authorizedUserFindManyMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  // Błąd samego zapytania o rolę -> ta sama odmowa, nie nieobsłużony wyjątek/500.
  // Ten sam wzorzec i to samo świadome ograniczenie co w settings-authorized-users.test.ts:
  // getCurrentActorRole() jest mockowane w całości, więc symulujemy błąd odrzuceniem
  // promise'a z mocka, nie wyjątkiem Prismy wewnątrz tej funkcji.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('SettingsScreen() - błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek/500', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const call = SettingsScreen();
    await expect(call).resolves.not.toBeInstanceOf(Error);

    expect(authorizedUserFindManyMock).not.toHaveBeenCalled();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  // Kryterium #3: kontrola pozytywna funkcjonalna - admin PRZECHODZI bramkę i dostaje
  // realny wynik z findMany przekazany do SettingsClient. Bez tego testu bramka odrzucająca
  // KAŻDĄ rolę (łącznie z admin) "przechodziłaby" powyższe testy odmowy z niewłaściwego powodu.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('admin - SettingsScreen() przechodzi bramkę i przekazuje wynik findMany do SettingsClient', async () => {
    authorizedUserFindManyMock.mockResolvedValue(ADMIN_USERS_FIXTURE);

    const result = await SettingsScreen();

    expect(authorizedUserFindManyMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: SettingsClientMock,
      props: { users: ADMIN_USERS_FIXTURE },
    });
  });

  // Kryterium #4, wariant pozytywny (przypadek pusty, dopisany z własnej inicjatywy - patrz
  // komentarz na górze pliku): lista PUSTA dla admina jest wynikiem LEGALNYM ("nie ma jeszcze
  // kont"), różnym strukturalnie od odmowy dla nieuprawnionej roli - tu findMany JEST wołane,
  // tam nie jest. Bez tego testu nic nie odróżnia "dozwolonej pustki" od "zamaskowanej odmowy".
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('admin - lista pusta (zero kont) jest wynikiem legalnym, odróżnialnym od odmowy', async () => {
    authorizedUserFindManyMock.mockResolvedValue([]);

    const result = await SettingsScreen();

    expect(authorizedUserFindManyMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: SettingsClientMock,
      props: { users: [] },
    });
  });
});
