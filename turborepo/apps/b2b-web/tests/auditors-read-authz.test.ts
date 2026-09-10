import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-READ-GATES.md — AC4 (`auditors/actions.ts` getAuditors),
 * D2 (kształt odmowy = `[]`).
 *
 * `getAuditors()` (`auditors/actions.ts:46`) — panel KARTOTEKI audytorów (RÓŻNY od
 * `getAuditors()` w `leads/actions.ts`, pula wyboru przy przypisaniu do leada, już
 * zabramkowana w poprzedniej turze, patrz `leads-get-auditors-authz-gate.test.ts`).
 * Dziś woła `prisma.audytorzy.findMany({ include: { leady: true }, ... })` bez
 * żadnego sprawdzenia roli — RED z asercji.
 *
 * AC4 (WO): "Panel administracyjny nadal pokazuje audytorów is_active: false
 * uprawnionej roli (celowa różnica wobec puli w leads/actions.ts)" — ta funkcja NIE
 * ma dziś filtra `is_active`, i po dodaniu bramki roli NADAL nie powinna go dostać
 * (świadomie inny kontrakt niż pula wyboru, admin musi widzieć zablokowane konto,
 * żeby móc je odblokować).
 */

const { auditorFindManyMock, getCurrentActorRoleMock } = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findMany: auditorFindManyMock,
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { getAuditors } = await import('../src/app/(dashboard)/auditors/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'auditors', 'read') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'auditors', 'read') !== 'yes');

beforeEach(() => {
  auditorFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();
});

// @REQ: SEC-AUTHZ-B2B-READS
describe('getAuditors() (auditors/actions.ts) - bramka roli PRZED zapytaniem (auditors.read = admin/dyspozytor, AC4)', () => {
  it('kontrola pozytywna kontraktu - macierz RBAC przyznaje auditors.read wyłącznie admin/dyspozytor', () => {
    expect(ALLOWED_ROLES.sort()).toEqual(['admin', 'dyspozytor'].sort());
    expect(DENIED_ROLES.length).toBeGreaterThan(0);
  });

  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona PRZED prisma.audytorzy.findMany, wynik to []',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getAuditors();

      expect(auditorFindManyMock).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    },
  );

  it('brak roli (null) jest odrzucony fail-closed, findMany nie jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getAuditors();

    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await getAuditors();

    expect(auditorFindManyMock).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it.each(ALLOWED_ROLES)('rola %s - dozwolona, findMany jest wołane i wynik przechodzi', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    auditorFindManyMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Aktywny', telefon: null, email: null, certyfikat_fgaz: null, fgaz_valid_until: null, uprawnienia_sep: false, promien_dzialania_km: null, preferowane_marki: [], leady: [], is_active: true },
    ]);

    const result = await getAuditors();

    expect(auditorFindManyMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  // AC4 (WO): panel administracyjny musi CONTYNUOWAĆ pokazywanie zablokowanych kont
  // uprawnionej roli — bramka roli nie ma prawa dokładać ukrytego filtra `is_active`,
  // inaczej admin traci jedyny sposób odblokowania konta.
  it('admin - audytor zablokowany (is_active: false) NADAL widoczny w wyniku (celowa różnica wobec puli wyboru)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    auditorFindManyMock.mockResolvedValue([
      { id: 'aud-blocked', imie_i_nazwisko: 'Zablokowany', telefon: null, email: null, certyfikat_fgaz: null, fgaz_valid_until: null, uprawnienia_sep: false, promien_dzialania_km: null, preferowane_marki: [], leady: [], is_active: false },
    ]);

    const result = await getAuditors();

    const args = auditorFindManyMock.mock.calls[0]?.[0];
    // Brak filtra is_active w where zapytania — bramka roli nie ma dokładać zawężenia.
    expect(args?.where?.is_active).toBeUndefined();
    expect(result.find((a: { id: string }) => a.id === 'aud-blocked')).toBeDefined();
  });
});
