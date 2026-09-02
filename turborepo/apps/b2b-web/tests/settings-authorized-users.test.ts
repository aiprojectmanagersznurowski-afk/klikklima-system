import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can, ROLES } from '@klikklima/contracts';

/**
 * Wymaganie: SEC-AUTHZ-USER-MGMT (contracts/requirements.contract.mjs), status TODO.
 * Nie jest częścią żadnego Work Orderu w docs/workorders/ — to bezpośrednia naprawa
 * luki bezpieczeństwa znalezionej w review (rls-security-auditor, 2026-08-24, przy
 * okazji FLD-AVAILABILITY-SPLIT): `settings/actions.ts` NIE MIAŁ żadnego sprawdzenia
 * roli, mimo że macierz RBAC od początku mówi `authorized_users: create/update/delete
 * = ['admin']`. `role` był przyjmowany jako dowolny `string` i lądował w bazie bez
 * walidacji. Do dziś nie istniał żaden plik testowy dla `settings/`.
 *
 * Sygnatury przeczytane z produkcji (settings/actions.ts), zewnętrzne API BEZ zmian —
 * wymaganie prosi o bramkę WEWNĄTRZ istniejących funkcji, nie o nowy kształt:
 *   `addAuthorizedUser(email: string, role: string): Promise<{ success: boolean; error?: string }>`
 *   `deleteAuthorizedUser(id: string): Promise<{ success: boolean; error?: string }>`
 *
 * Kształt bramki (decyzja test-authora, uzasadnienie):
 * Wzorzec 1:1 z `deleteAuditorAction`/`toggleAuditorActiveAction`
 * (auditors-delete.test.ts, auditors-toggle-active.test.ts): `actorRole` WYŁĄCZNIE
 * z `getCurrentActorRole()` (`../src/utils/supabase/server` z perspektywy tego
 * pliku testowego — z perspektywy produkcji, `src/app/(dashboard)/settings/actions.ts`,
 * to `../../../utils/supabase/server`, ta sama głębokość co `auditors/actions.ts`),
 * fail-closed, decyzję podejmuje `can(actorRole, 'authorized_users', capability)` z
 * WYGENEROWANEGO kontraktu — nigdy literał `role === 'admin'` w kodzie akcji (kryterium
 * WO #2 wprost tego zakazuje, bo dubluje macierz). Akcja i tak nie przyjmuje roli jako
 * parametru wywołania, więc nie ma czego "przepchnąć" przez argument — to jest już
 * strukturalnie niemożliwe niezależnie od tego pliku, ale testy tego nie zakładają:
 * jedynym kanałem, którym sterujemy rolą w teście, jest mock `getCurrentActorRole`.
 *
 * Walidacja `role` (kryterium WO #5): zakładam `z.enum(ROLES)` po stronie serwera,
 * PRZED zapisem — `ROLES` z `@klikklima/contracts` jako jedyne źródło słownika ról
 * (kryterium: "Słownik ról ma dokładnie jedno źródło"). Test nie sprawdza MECHANIZMU
 * walidacji (Zod vs ręczny `includes`), tylko efekt: nieznana/pusta/błędna rola nie
 * trafia do `prisma.authorized_users.create`.
 *
 * Świadome ograniczenie (kryterium WO #3, "błąd samego zapytania o rolę"):
 * `getCurrentActorRole()` jest tu mockowane w CAŁOŚCI (tak jak w auditors-delete.test.ts),
 * więc nie mamy dostępu do wewnętrznego wywołania `prisma.authorizedUser.findUnique`
 * wewnątrz tej funkcji, żeby zasymulować TAM wyjątek Prismy — mockowalibyśmy coś, czego
 * ten plik nie importuje. Zamiast tego symulujemy odrzuceniem promise'a z mocka
 * (`getCurrentActorRoleMock.mockRejectedValue(...)`): to jest dokładnie ten sam sygnał
 * z punktu widzenia akcji wywołującej `await getCurrentActorRole()` — błąd zapytania
 * o rolę i brak sesji nie są rozróżnialne z tej strony granicy, a granica ta jest
 * jedyną, którą `settings/actions.ts` w ogóle widzi. Uznaję to za wystarczające pokrycie
 * kryterium na tym poziomie (nie za pominięcie) — dokładnie tak, jak zasugerowano:
 * "jeśli to niepraktyczne [...] odnotuj jako świadome ograniczenie, nie pomijaj milcząco".
 * Dodatkowo koduje to kryterium "odmowa jest błędem domenowym w zwracanym wyniku, nie
 * wyjątkiem 500" (spójnie z zasadą przy braku ujawniania istnienia konta) — odrzucone
 * zapytanie o rolę NIE MOŻE wypłynąć jako nieobsłużony reject z akcji.
 *
 * Kryterium "audit_log / role_change" (WO: "Zapis operacji do rejestru NIE należy do
 * tego wymagania") — świadomie pominięte, pokrywa je SEC-AUDIT-LOG, osobny wymóg.
 *
 * Kryterium "usunięcie ostatniego admina" — świadomie poza zakresem (WO: to inna klasa
 * awarii, wymaga gwarancji w bazie, nie w Server Action) — brak testu, celowo.
 *
 * Warstwa RLS: świadomie pominięta dla TEJ tabeli. `authorized_users` nie ma żadnej
 * polityki RLS (sprawdzone: brak trafień na "authorized_users" + RLS/POLICY w
 * supabase/migrations/), a wymaganie samo to zakłada — "Prisma omija RLS, więc jedyną
 * granicą jest kod akcji" (kryterium WO #1). Dodanie testu RLS dla tabeli, która go nie
 * ma, byłoby testem atrapą — sprawdzałby nieistniejącą politykę i zawsze by "przechodził"
 * z niewłaściwego powodu (pułapka 1, CLAUDE.md).
 *
 * Mockujemy @repo/database (brak żywej instancji testowej), next/cache (revalidatePath
 * wymaga kontekstu żądania Next.js, którego w vitest nie ma) i
 * ../src/utils/supabase/server (getCurrentActorRole woła next/headers cookies(), które
 * poza kontekstem żądania rzuca "cookies was called outside a request scope") —
 * identyczny wzorzec jak w auditors-delete.test.ts / auditors-toggle-active.test.ts.
 * `findUnique` na `prisma.authorizedUser` jest zamockowane profilaktycznie: dzisiejszy
 * `deleteAuthorizedUser` go nie woła, ale kryterium #6 (brak ujawniania istnienia konta)
 * zakłada, że implementer MÓGŁBY chcieć sprawdzić istnienie rekordu przed usunięciem —
 * gdyby to zrobił bez mocka, test padłby na "is not a function", czyli złym RED.
 */

const {
  authorizedUserCreateMock,
  authorizedUserDeleteMock,
  authorizedUserFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  authorizedUserCreateMock: vi.fn(),
  authorizedUserDeleteMock: vi.fn(),
  authorizedUserFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    authorizedUser: {
      create: authorizedUserCreateMock,
      delete: authorizedUserDeleteMock,
      findUnique: authorizedUserFindUniqueMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { addAuthorizedUser, deleteAuthorizedUser } = await import(
  '../src/app/(dashboard)/settings/actions'
);

const UNAUTHORIZED_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;
const INVALID_ROLE_VALUES = ['', 'admiin', 'superadmin'];

describe('addAuthorizedUser / deleteAuthorizedUser - bramka RBAC i walidacja roli (SEC-AUTHZ-USER-MGMT)', () => {
  beforeEach(() => {
    authorizedUserCreateMock.mockReset();
    authorizedUserDeleteMock.mockReset();
    authorizedUserFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kontrola pozytywna: macierz RBAC rzeczywiście przyznaje adminowi obie zdolności.
  // Bez tego testu bramka mogłaby odrzucać WSZYSTKICH i "przechodzić" z niewłaściwego powodu.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('kontrola pozytywna kontraktu - admin ma create i delete na authorized_users w macierzy RBAC', () => {
    expect(can('admin', 'authorized_users', 'create')).toBe('yes');
    expect(can('admin', 'authorized_users', 'delete')).toBe('yes');
    expect(PERMISSIONS.authorized_users.create).toEqual(['admin']);
    expect(PERMISSIONS.authorized_users.delete).toEqual(['admin']);
  });

  // @REQ: SEC-AUTHZ-USER-MGMT
  it.each(UNAUTHORIZED_ROLES)(
    'addAuthorizedUser wywolane bezposrednio przez role %s jest odrzucone po stronie serwera',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'authorized_users', 'create')).toBe('no');

      const result = await addAuthorizedUser('nowy@klikklima.pl', 'dyspozytor');

      expect(result.success).toBe(false);
      expect(authorizedUserCreateMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: SEC-AUTHZ-USER-MGMT
  it.each(UNAUTHORIZED_ROLES)(
    'deleteAuthorizedUser wywolane bezposrednio przez role %s jest odrzucone po stronie serwera',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'authorized_users', 'delete')).toBe('no');

      const result = await deleteAuthorizedUser('usr-1');

      expect(result.success).toBe(false);
      expect(authorizedUserDeleteMock).not.toHaveBeenCalled();
      expect(authorizedUserFindUniqueMock).not.toHaveBeenCalled();
    },
  );

  // Fail-closed: brak sesji / e-mail spoza authorized_users -> getCurrentActorRole() zwraca null.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('addAuthorizedUser - brak roli (null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await addAuthorizedUser('nowy@klikklima.pl', 'dyspozytor');

    expect(result.success).toBe(false);
    expect(authorizedUserCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUTHZ-USER-MGMT
  it('deleteAuthorizedUser - brak roli (null) jest odrzucony fail-closed, nie przepuszczony', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteAuthorizedUser('usr-1');

    expect(result.success).toBe(false);
    expect(authorizedUserDeleteMock).not.toHaveBeenCalled();
    expect(authorizedUserFindUniqueMock).not.toHaveBeenCalled();
  });

  // Blad samego zapytania o role (patrz komentarz na gorze pliku - ograniczenie
  // swiadome: mockujemy cala funkcje getCurrentActorRole, nie Prisme wewnatrz niej).
  // Odmowa musi byc wynikiem domenowym, nie nieobslugiwanym rejectem/wyjatkiem 500.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('addAuthorizedUser - blad zapytania o role daje odmowe, nie nieobslugiwany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    await expect(addAuthorizedUser('nowy@klikklima.pl', 'dyspozytor')).resolves.toMatchObject({
      success: false,
    });
    expect(authorizedUserCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUTHZ-USER-MGMT
  it('deleteAuthorizedUser - blad zapytania o role daje odmowe, nie nieobslugiwany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    await expect(deleteAuthorizedUser('usr-1')).resolves.toMatchObject({ success: false });
    expect(authorizedUserDeleteMock).not.toHaveBeenCalled();
    expect(authorizedUserFindUniqueMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna funkcjonalna: admin PRZECHODZI bramke roli w obu akcjach
  // (nie tylko w izolacji kontraktu wyzej - to samo sprawdzone na realnym wywolaniu akcji).
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('admin - addAuthorizedUser z poprawna rola przechodzi bramke i zapisuje rekord', async () => {
    authorizedUserCreateMock.mockResolvedValue({ id: 'usr-2', email: 'nowy@klikklima.pl', role: 'dyspozytor' });

    const result = await addAuthorizedUser('nowy@klikklima.pl', 'dyspozytor');

    expect(result.success).toBe(true);
    expect(authorizedUserCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'nowy@klikklima.pl', role: 'dyspozytor' }) }),
    );
  });

  // @REQ: SEC-AUTHZ-USER-MGMT
  it('admin - deleteAuthorizedUser przechodzi bramke i usuwa rekord', async () => {
    authorizedUserDeleteMock.mockResolvedValue({ id: 'usr-1' });

    const result = await deleteAuthorizedUser('usr-1');

    expect(result.success).toBe(true);
    expect(authorizedUserDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'usr-1' } }));
  });

  // Walidacja roli wobec ROLES - TESTOWANA OSOBNO od bramki uprawnien: actorRole
  // jest juz 'admin' (bramka przechodzi), wiec kazde odrzucenie ponizej jest wynikiem
  // walidacji DANYCH, nie autoryzacji.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it.each(INVALID_ROLE_VALUES)(
    'admin - addAuthorizedUser z rola spoza ROLES (%j) jest odrzucone przez walidacje, nie zapisane',
    async (invalidRole) => {
      expect((ROLES as readonly string[]).includes(invalidRole)).toBe(false);

      const result = await addAuthorizedUser('nowy@klikklima.pl', invalidRole);

      expect(result.success).toBe(false);
      expect(authorizedUserCreateMock).not.toHaveBeenCalled();
    },
  );

  // Brak ujawniania istnienia konta (kryterium #6): dla nieuprawnionego wywolania
  // deleteAuthorizedUser wynik jest identyczny niezaleznie od tego, czy 'id' istnieje -
  // dowod posredni: findUnique/delete NIGDY nie sa wolane, wiec nie ma z czego wyciekac
  // roznicy. Dwa rozne id, ten sam ksztalt odmowy.
  // @REQ: SEC-AUTHZ-USER-MGMT
  it('deleteAuthorizedUser - odmowa nie ujawnia istnienia konta (identyczny wynik, zero zapytan do bazy)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const forExisting = await deleteAuthorizedUser('usr-istniejacy');
    const forMissing = await deleteAuthorizedUser('usr-nieistniejacy');

    expect(forExisting).toEqual(forMissing);
    expect(forExisting.success).toBe(false);
    expect(authorizedUserFindUniqueMock).not.toHaveBeenCalled();
    expect(authorizedUserDeleteMock).not.toHaveBeenCalled();
  });
});
