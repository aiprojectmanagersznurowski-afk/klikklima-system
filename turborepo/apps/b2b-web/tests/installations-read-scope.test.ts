import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC5, AC8, D1 (semantyka monter:own),
 * przypadki brzegowe #1 (`where` z undefined), #2 (aktywny === false), #3 (duplikat
 * e-maila w zespoly_monterskie).
 *
 * `getInstallations()` (`installations/actions.ts:20`) dziś woła
 * `prisma.instalacje.findMany(...)` bez ŻADNEGO sprawdzenia roli — każda rola,
 * łącznie z `audytor` (bez `installations.read` w MATRIX), widzi WSZYSTKIE
 * instalacje. RED z asercji (funkcja istnieje, eksportowana).
 *
 * D1 (WO, rozstrzygnięcie): `monter:own` = rekord przypisany do ekipy zalogowanego
 * montera, identyfikacja przez `zespoly_monterskie.email = <e-mail z sesji>`.
 * `scopeWhere` dla `instalacje`: `{ zespol_id: own.id }`.
 *
 * KONTRAKT dla implementer-server (identyfikacja "własnej" ekipy, pasy-i-szelki —
 * patrz WO § "Dodatkowe znalezisko"): unikalny indeks na `zespoly_monterskie.email`
 * NIE jest egzekwowany na żywej bazie (potwierdzone `pg_constraint`, `schema.prisma`
 * deklaruje `@unique`, ale to dryf). `findUnique({ where: { email } })` przy
 * duplikacie przypięłoby montera do CUDZEJ ekipy. Wymagany kształt zapytania:
 *   prisma.zespoly_monterskie.findMany({ where: { email }, take: 2 })
 * i odmowa (fail-closed, wynik pusty), gdy `length !== 1`. Ten plik mockuje
 * WYŁĄCZNIE `findMany` na `zespoly_monterskie` (nie `findUnique`) — to jest
 * świadomy wybór kontraktu, nie przeoczenie: implementacja przez `findUnique`
 * nie przejdzie testu duplikatu poniżej, i o to chodzi.
 *
 * Mockujemy `@repo/database` (`prisma.instalacje.findMany`, `prisma.zespoly_monterskie.findMany`),
 * `../src/utils/supabase/server` (`getCurrentActorRole`, `getCurrentUser` — wzorem
 * `getLeads()` w `leads/actions.ts`).
 */

const { installationFindManyMock, crewLookupFindManyMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  installationFindManyMock: vi.fn(),
  crewLookupFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    instalacje: {
      findMany: installationFindManyMock,
    },
    zespoly_monterskie: {
      findMany: crewLookupFindManyMock,
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const { getInstallations } = await import('../src/app/(dashboard)/installations/actions');

const NO_ACCESS_ROLES = ROLES.filter((r) => can(r, 'installations', 'read') === 'no');
const OWN_ROLES = ROLES.filter((r) => can(r, 'installations', 'read') === 'own');
const FULL_ACCESS_ROLES = ROLES.filter((r) => can(r, 'installations', 'read') === 'yes');
const MONTER_EMAIL = 'monter@ekipa-testowa.pl';

beforeEach(() => {
  installationFindManyMock.mockReset();
  crewLookupFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();
});

describe('getInstallations() - kontrola kontraktu RBAC (installations.read)', () => {
  it('macierz przyznaje: admin/dyspozytor = yes, monter = own, audytor = no', () => {
    expect(FULL_ACCESS_ROLES.sort()).toEqual(['admin', 'dyspozytor'].sort());
    expect(OWN_ROLES).toEqual(['monter']);
    expect(NO_ACCESS_ROLES).toEqual(['audytor']);
  });
});

describe('getInstallations() - AC5: admin/dyspozytor widzą wszystko, audytor odrzucony', () => {
  it.each(NO_ACCESS_ROLES)('rola %s (no) jest odrzucona, zero wywołań prisma.instalacje.findMany, wynik []', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each(FULL_ACCESS_ROLES)(
    'rola %s (yes) - findMany wołane BEZ klucza zespol_id w where (widzi wszystko)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      installationFindManyMock.mockResolvedValue([]);

      await getInstallations();

      expect(installationFindManyMock).toHaveBeenCalledTimes(1);
      const args = installationFindManyMock.mock.calls[0][0];
      expect(args?.where?.zespol_id).toBeUndefined();
    },
  );
});

describe('getInstallations() - AC5/D1: monter:own - zawężenie do własnej ekipy', () => {
  it('monter z rekordem w zespoly_monterskie - findMany wołane z where.zespol_id === id własnej ekipy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([{ id: 'crew-own-1', aktywny: true }]);
    installationFindManyMock.mockResolvedValue([]);

    await getInstallations();

    expect(crewLookupFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: MONTER_EMAIL }, take: 2 }),
    );
    expect(installationFindManyMock).toHaveBeenCalledTimes(1);
    const args = installationFindManyMock.mock.calls[0][0];
    expect(args?.where?.zespol_id).toBe('crew-own-1');
  });
});

describe('getInstallations() - AC8: fail-closed montera (5 wariantów), zero wywołań instalacje.findMany', () => {
  it('brak sesji (getCurrentUser zwraca user: null) - odmowa, findMany nie wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('brak user.email - odmowa, findMany nie wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('getCurrentActorRole() rzuca wyjątek - odmowa, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('baza niedostępna'));
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // MINOR 1 (audyt SEC-READ-GATES): `getCurrentUser()` (installations/actions.ts:36)
  // jest dziś (2026-09-02) POZA `try/catch` — inaczej niż sąsiedni
  // `getCurrentActorRole()` (opakowany, patrz test powyżej). Wyjątek (np. Supabase
  // niedostępny) dziś propaguje się z Server Action zamiast dać odmowę fail-closed
  // `[]`, co jest niespójne z AC8 WO ("wyjątek → odmowa"). RED z asercji: wynik
  // zwrócony przez `await getInstallations()` NIGDY nie jest osiągany, bo promise
  // się dziś odrzuca zamiast rozwiązać do `[]`.
  it('getCurrentUser() rzuca wyjątek - odmowa fail-closed ([]), nie nieobsłużony wyjątek (MINOR 1 SEC-READ-GATES)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockRejectedValue(new Error('Supabase niedostępny'));

    const call = getInstallations();
    await expect(call).resolves.toEqual([]);

    expect(installationFindManyMock).not.toHaveBeenCalled();
  });

  it('brak wiersza w zespoly_monterskie o tym e-mailu - odmowa, findMany nie wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([]);

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // Przypadek brzegowy #2 (WO): konto ekipy wyłączone administracyjnie.
  it('zespoly_monterskie.aktywny === false - odmowa, findMany nie wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([{ id: 'crew-inactive', aktywny: false }]);

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // Przypadek brzegowy #3 (WO): dwa rekordy o tym samym e-mailu -> odmowa fail-closed,
  // NIGDY arbitralny wybór pierwszego wiersza (co przypięłoby montera do cudzej ekipy).
  it('duplikat e-maila w zespoly_monterskie (2 rekordy) - odmowa fail-closed, nie wybór pierwszego wiersza', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([
      { id: 'crew-a', aktywny: true },
      { id: 'crew-b', aktywny: true },
    ]);

    const result = await getInstallations();

    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
