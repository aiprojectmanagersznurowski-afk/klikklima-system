import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC6, AC8, D1 (tabela `scopeWhere` per
 * zasób — wiersz "services").
 *
 * `getUpcomingServices()` (`services/actions.ts:28`) dziś woła DWA zapytania
 * (`prisma.serwisy.findMany`, `prisma.instalacje.findMany`) bez ŻADNEGO sprawdzenia
 * roli — każda rola, łącznie z `audytor`, widzi WSZYSTKIE serwisy/prognozy. RED z
 * asercji (funkcja istnieje).
 *
 * D1 (WO): `scopeWhere` dla montera:
 *   - zapytanie po `prisma.serwisy`:
 *       { OR: [ { zespol_id: own.id },
 *               { AND: [ { zespol_id: null }, { instalacja: { zespol_id: own.id } } ] } ] }
 *   - zapytanie po `prisma.instalacje` (wiersze forecast): dokłada się
 *     `{ zespol_id: own.id }` do istniejącego `next_service_date: { not: null }`.
 * Uzasadnienie OR (WO): `zespol_id` na `serwisy` jest w praktyce puste — przypisanie
 * ekipy żyje na `instalacje.zespol_id`. Dziedziczenie z instalacji jest ZAWĘŻONE do
 * rekordów BEZ własnego przypisania — rekord jawnie przypisany innej ekipie nigdy
 * nie wpada do zakresu montera, nawet gdy instalacja jest jego (przypadek brzegowy #6
 * WO). Ten plik dowodzi KSZTAŁTU zapytania przekazanego do Prisma (argument
 * `findMany`), NIE poprawności faktycznego filtrowania w bazie — to ostatnie zależy
 * od silnika SQL i jest poza zasięgiem testu jednostkowego z zamockowanym klientem
 * Prisma (kandydat na test integracyjny na żywej instancji, poza tym plikiem).
 *
 * Poprawność SCALANIA service/forecast (dedup `installationIdsWithService`,
 * sortowanie) jest już pokryta przez `services-source-of-truth.test.ts` — nie
 * duplikujemy jej tutaj, bo ten plik testuje WYŁĄCZNIE bramkę roli i kształt
 * zawężenia, niezależnie od roli.
 */

const { serviceFindManyMock, installationFindManyMock, crewLookupFindManyMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  serviceFindManyMock: vi.fn(),
  installationFindManyMock: vi.fn(),
  crewLookupFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    serwisy: {
      findMany: serviceFindManyMock,
    },
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

const { getUpcomingServices } = await import('../src/app/(dashboard)/services/actions');

const NO_ACCESS_ROLES = ROLES.filter((r) => can(r, 'services', 'read') === 'no');
const OWN_ROLES = ROLES.filter((r) => can(r, 'services', 'read') === 'own');
const FULL_ACCESS_ROLES = ROLES.filter((r) => can(r, 'services', 'read') === 'yes');
const MONTER_EMAIL = 'monter@ekipa-testowa.pl';
const OWN_CREW_ID = 'crew-own-1';

const EXPECTED_SERVICE_SCOPE = {
  OR: [
    { zespol_id: OWN_CREW_ID },
    { AND: [{ zespol_id: null }, { instalacja: { zespol_id: OWN_CREW_ID } }] },
  ],
};

beforeEach(() => {
  serviceFindManyMock.mockReset();
  installationFindManyMock.mockReset();
  crewLookupFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();
  serviceFindManyMock.mockResolvedValue([]);
  installationFindManyMock.mockResolvedValue([]);
});

describe('getUpcomingServices() - kontrola kontraktu RBAC (services.read)', () => {
  it('macierz przyznaje: admin/dyspozytor = yes, monter = own, audytor = no', () => {
    expect(FULL_ACCESS_ROLES.sort()).toEqual(['admin', 'dyspozytor'].sort());
    expect(OWN_ROLES).toEqual(['monter']);
    expect(NO_ACCESS_ROLES).toEqual(['audytor']);
  });
});

describe('getUpcomingServices() - AC6: audytor odrzucony, admin/dyspozytor bez zawężenia', () => {
  it.each(NO_ACCESS_ROLES)(
    'rola %s (no) jest odrzucona, zero wywołań OBU zapytań (serwisy + instalacje), wynik []',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getUpcomingServices();

      expect(serviceFindManyMock).not.toHaveBeenCalled();
      expect(installationFindManyMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each(FULL_ACCESS_ROLES)(
    'rola %s (yes) - OBA zapytania wołane BEZ filtra zespol_id (widzi wszystko)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      await getUpcomingServices();

      expect(serviceFindManyMock).toHaveBeenCalledTimes(1);
      expect(installationFindManyMock).toHaveBeenCalledTimes(1);
      const serviceArgs = serviceFindManyMock.mock.calls[0][0];
      const installationArgs = installationFindManyMock.mock.calls[0][0];
      expect(serviceArgs?.where?.zespol_id).toBeUndefined();
      expect(serviceArgs?.where?.OR).toBeUndefined();
      expect(installationArgs?.where?.zespol_id).toBeUndefined();
    },
  );
});

describe('getUpcomingServices() - AC6/D1: monter:own - OBA zapytania dostają filtr ekipy', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([{ id: OWN_CREW_ID, aktywny: true }]);
  });

  it('prisma.serwisy.findMany dostaje where wg dokładnego kształtu D1 (OR jawne/dziedziczone)', async () => {
    await getUpcomingServices();

    expect(crewLookupFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: MONTER_EMAIL }, take: 2 }),
    );
    expect(serviceFindManyMock).toHaveBeenCalledTimes(1);
    const args = serviceFindManyMock.mock.calls[0][0];
    expect(args?.where).toEqual(EXPECTED_SERVICE_SCOPE);
  });

  it('prisma.instalacje.findMany (forecast) dostaje zespol_id DOŁOŻONY do next_service_date: { not: null }', async () => {
    await getUpcomingServices();

    expect(installationFindManyMock).toHaveBeenCalledTimes(1);
    const args = installationFindManyMock.mock.calls[0][0];
    expect(args?.where?.zespol_id).toBe(OWN_CREW_ID);
    expect(args?.where?.next_service_date).toEqual({ not: null });
  });
});

describe('getUpcomingServices() - AC8: fail-closed montera (5 wariantów), zero wywołań OBU zapytań', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
  });

  it('brak sesji (getCurrentUser zwraca user: null) - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('brak user.email - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('getCurrentActorRole() rzuca wyjątek - odmowa, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('baza niedostępna'));
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // MINOR 1 (audyt SEC-READ-GATES): `getCurrentUser()` (services/actions.ts:45) jest
  // dziś (2026-09-02) POZA `try/catch` — inaczej niż sąsiedni `getCurrentActorRole()`
  // (opakowany, test powyżej). Wyjątek propaguje się z Server Action zamiast dać
  // odmowę fail-closed `[]` (AC8 WO). RED z asercji: promise dziś się odrzuca
  // zamiast rozwiązać do `[]`.
  it('getCurrentUser() rzuca wyjątek - odmowa fail-closed ([]), nie nieobsłużony wyjątek (MINOR 1 SEC-READ-GATES)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockRejectedValue(new Error('Supabase niedostępny'));

    const call = getUpcomingServices();
    await expect(call).resolves.toEqual([]);

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
  });

  it('brak wiersza w zespoly_monterskie o tym e-mailu - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([]);

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('zespoly_monterskie.aktywny === false - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([{ id: 'crew-inactive', aktywny: false }]);

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('duplikat e-maila w zespoly_monterskie (2 rekordy) - odmowa fail-closed', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([
      { id: 'crew-a', aktywny: true },
      { id: 'crew-b', aktywny: true },
    ]);

    const result = await getUpcomingServices();

    expect(serviceFindManyMock).not.toHaveBeenCalled();
    expect(installationFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
