import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC7, AC8, D1 (tabela `scopeWhere` per
 * zasób — wiersz "incidents", IDENTYCZNY kształt OR co "services": `zespol_id` na
 * `usterki_incidents` jest w praktyce puste, dziedziczenie z `instalacja.zespol_id`
 * zawężone do rekordów BEZ własnego przypisania).
 *
 * `getIncidents()` (`incidents/actions.ts:19`) dziś woła
 * `prisma.usterki_incidents.findMany(...)` bez ŻADNEGO sprawdzenia roli — każda
 * rola, łącznie z `audytor`, widzi WSZYSTKIE usterki. RED z asercji (funkcja
 * istnieje).
 *
 * Ten plik dowodzi KSZTAŁTU zapytania przekazanego do Prisma, nie poprawności
 * faktycznego filtrowania w bazie (jak `services-read-scope.test.ts` — ten sam
 * ograniczenie, ta sama uzasadnienie).
 */

const { incidentFindManyMock, crewLookupFindManyMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  incidentFindManyMock: vi.fn(),
  crewLookupFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    usterki_incidents: {
      findMany: incidentFindManyMock,
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

const { getIncidents } = await import('../src/app/(dashboard)/incidents/actions');

const NO_ACCESS_ROLES = ROLES.filter((r) => can(r, 'incidents', 'read') === 'no');
const OWN_ROLES = ROLES.filter((r) => can(r, 'incidents', 'read') === 'own');
const FULL_ACCESS_ROLES = ROLES.filter((r) => can(r, 'incidents', 'read') === 'yes');
const MONTER_EMAIL = 'monter@ekipa-testowa.pl';
const OWN_CREW_ID = 'crew-own-1';

const EXPECTED_INCIDENT_SCOPE = {
  OR: [
    { zespol_id: OWN_CREW_ID },
    { AND: [{ zespol_id: null }, { instalacja: { zespol_id: OWN_CREW_ID } }] },
  ],
};

beforeEach(() => {
  incidentFindManyMock.mockReset();
  crewLookupFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();
  incidentFindManyMock.mockResolvedValue([]);
});

describe('getIncidents() - kontrola kontraktu RBAC (incidents.read)', () => {
  it('macierz przyznaje: admin/dyspozytor = yes, monter = own, audytor = no', () => {
    expect(FULL_ACCESS_ROLES.sort()).toEqual(['admin', 'dyspozytor'].sort());
    expect(OWN_ROLES).toEqual(['monter']);
    expect(NO_ACCESS_ROLES).toEqual(['audytor']);
  });
});

describe('getIncidents() - AC7: audytor odrzucony, admin/dyspozytor bez zawężenia', () => {
  it.each(NO_ACCESS_ROLES)(
    'rola %s (no) jest odrzucona, zero wywołań prisma.usterki_incidents.findMany, wynik []',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getIncidents();

      expect(incidentFindManyMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each(FULL_ACCESS_ROLES)(
    'rola %s (yes) - findMany wołane BEZ filtra zespol_id (widzi wszystko)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      await getIncidents();

      expect(incidentFindManyMock).toHaveBeenCalledTimes(1);
      const args = incidentFindManyMock.mock.calls[0][0];
      expect(args?.where?.zespol_id).toBeUndefined();
      expect(args?.where?.OR).toBeUndefined();
    },
  );
});

describe('getIncidents() - AC7/D1: monter:own - where wg dokładnego kształtu D1 (OR jawne/dziedziczone)', () => {
  it('prisma.usterki_incidents.findMany dostaje where OR (zespol_id własny LUB zespol_id null + instalacja własna)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([{ id: OWN_CREW_ID, aktywny: true }]);

    await getIncidents();

    expect(crewLookupFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: MONTER_EMAIL }, take: 2 }),
    );
    expect(incidentFindManyMock).toHaveBeenCalledTimes(1);
    const args = incidentFindManyMock.mock.calls[0][0];
    expect(args?.where).toEqual(EXPECTED_INCIDENT_SCOPE);
  });
});

describe('getIncidents() - AC8: fail-closed montera (5 wariantów), zero wywołań findMany', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
  });

  it('brak sesji (getCurrentUser zwraca user: null) - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('brak user.email - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('getCurrentActorRole() rzuca wyjątek - odmowa, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('baza niedostępna'));
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  // MINOR 1 (audyt SEC-READ-GATES): `getCurrentUser()` (incidents/actions.ts:35) jest
  // dziś (2026-09-02) POZA `try/catch` — inaczej niż sąsiedni `getCurrentActorRole()`
  // (opakowany, test powyżej). Wyjątek propaguje się z Server Action zamiast dać
  // odmowę fail-closed `[]` (AC8 WO). RED z asercji: promise dziś się odrzuca
  // zamiast rozwiązać do `[]`.
  it('getCurrentUser() rzuca wyjątek - odmowa fail-closed ([]), nie nieobsłużony wyjątek (MINOR 1 SEC-READ-GATES)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getCurrentUserMock.mockRejectedValue(new Error('Supabase niedostępny'));

    const call = getIncidents();
    await expect(call).resolves.toEqual([]);

    expect(incidentFindManyMock).not.toHaveBeenCalled();
  });

  it('brak wiersza w zespoly_monterskie o tym e-mailu - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([]);

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('zespoly_monterskie.aktywny === false - odmowa', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([{ id: 'crew-inactive', aktywny: false }]);

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('duplikat e-maila w zespoly_monterskie (2 rekordy) - odmowa fail-closed', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: MONTER_EMAIL } } });
    crewLookupFindManyMock.mockResolvedValue([
      { id: 'crew-a', aktywny: true },
      { id: 'crew-b', aktywny: true },
    ]);

    const result = await getIncidents();

    expect(incidentFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
