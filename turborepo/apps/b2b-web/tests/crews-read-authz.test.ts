import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC2 (`crews/actions.ts` getCrews) i AC3
 * (`leads/actions.ts` getCrews(installationDate)), D2 (kształt odmowy = `[]`, wzorem
 * `getAuditors()` z `leads/actions.ts`).
 *
 * DWIE różne funkcje o tej samej nazwie w DWÓCH różnych plikach. Vitest mockuje
 * moduły PER PLIK TESTOWY (nie per `describe`), więc `vi.mock('@repo/database', ...)`
 * i `vi.mock('../src/utils/supabase/server', ...)` żyją RAZ, na górze tego pliku —
 * OBIE produkcyjne funkcje importują `{ prisma } from "@repo/database"`, więc dzielą
 * jeden zamockowany klient; wystarcza to, bo obie i tak wołają dokładnie
 * `prisma.zespoly_monterskie.findMany(...)`.
 *
 * AC2 (`crews/actions.ts:33`): dziś woła `prisma.zespoly_monterskie.findMany()` bez
 * ŻADNEGO sprawdzenia roli — RED z asercji (funkcja istnieje, eksportowana).
 *
 * AC3 (`leads/actions.ts:122`): dziś woła to samo zapytanie bez sprawdzenia roli.
 * Regresja obowiązkowa (WO): istniejący filtr certyfikatów/dostępności
 * (`crews-cert-availability.test.ts`, `availability-pool-filter.test.ts`) musi
 * działać bez zmian dla ról dozwolonych — te dwa pliki dostały w tej samej turze
 * domyślny mock `getCurrentActorRoleMock.mockResolvedValue('admin')` właśnie po to,
 * żeby nie wygenerować fałszywej fali czerwieni po dodaniu tej bramki. Ten plik
 * testuje WYŁĄCZNIE bramkę samą w sobie (denial przed zapytaniem), nie duplikuje
 * baterii filtra certyfikatów.
 */

const { crewFindManyMock, getCurrentActorRoleMock } = vi.hoisted(() => ({
  crewFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    zespoly_monterskie: {
      findMany: crewFindManyMock,
    },
    leady: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { getCrews } = await import('../src/app/(dashboard)/crews/actions');
const { getCrews: getCrewsFromLeads } = await import('../src/app/(dashboard)/leads/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'crews', 'read') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'crews', 'read') !== 'yes');
const INSTALLATION_DATE = new Date('2026-09-15T00:00:00.000Z');

beforeEach(() => {
  crewFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();
});

describe('getCrews() (crews/actions.ts) - bramka roli PRZED zapytaniem (crews.read = admin/dyspozytor, AC2)', () => {
  it('kontrola pozytywna kontraktu - macierz RBAC przyznaje crews.read wyłącznie admin/dyspozytor', () => {
    expect(ALLOWED_ROLES.sort()).toEqual(['admin', 'dyspozytor'].sort());
    expect(DENIED_ROLES.length).toBeGreaterThan(0);
  });

  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona PRZED prisma.zespoly_monterskie.findMany, wynik to []',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getCrews();

      expect(crewFindManyMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed, findMany nie jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getCrews();

    expect(crewFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getCrews();

    expect(crewFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each(ALLOWED_ROLES)('rola %s - dozwolona, findMany jest wołane i wynik przechodzi', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    crewFindManyMock.mockResolvedValue([]);

    const result = await getCrews();

    expect(crewFindManyMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});

describe('getCrews(installationDate) (leads/actions.ts) - bramka roli PRZED zapytaniem (crews.read = admin/dyspozytor, AC3)', () => {
  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona PRZED prisma.zespoly_monterskie.findMany, wynik to [] (AC3)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getCrewsFromLeads(INSTALLATION_DATE);

      expect(crewFindManyMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed, findMany nie jest wołane (AC3)', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getCrewsFromLeads(INSTALLATION_DATE);

    expect(crewFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek (AC3)', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getCrewsFromLeads(INSTALLATION_DATE);

    expect(crewFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each(ALLOWED_ROLES)(
    'rola %s - dozwolona, findMany jest wołane (AC3, regresja filtra certyfikatów pokryta osobno)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      crewFindManyMock.mockResolvedValue([]);

      const result = await getCrewsFromLeads(INSTALLATION_DATE);

      expect(crewFindManyMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    },
  );
});
