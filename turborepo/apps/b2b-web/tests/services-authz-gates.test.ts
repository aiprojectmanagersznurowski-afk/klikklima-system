import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `services/actions.ts`
 * (`docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, finding #14).
 *
 * `deleteServiceAction` nie sprawdza dzis roli w ogole. Bramka
 * `can(role, 'services', 'delete') === 'yes'` (`contracts/rbac.contract.mjs` ->
 * wylacznie `admin`). Wzorzec 1:1 z `deleteIncidentAction`
 * (`incidents/actions.ts:40`, `incidents-authz-gates.test.ts`), ten sam ksztalt:
 * jedna funkcja delete, jeden zasob.
 *
 * Zestawy rol dozwolonych/niedozwolonych sa wyliczone dynamicznie z `can()`/`ROLES`,
 * nie wpisane literalnie.
 *
 * Sygnatura docelowa: `deleteServiceAction` dzis zwraca `void`, po naprawie musi
 * zwracac `{ success: boolean; error?: string }` (edge case WO, "Odmowa odroznialna
 * od sukcesu" — `services-client.tsx:37` dzis pokazuje sukces niezaleznie od wyniku).
 *
 * Uwaga (do zaraportowania, nie do naprawy w tym pliku): `getUpcomingServices()` w tym
 * samym module buduje liste z `prisma.instalacje` i podstawia `id: inst.id` (id INSTALACJI),
 * a `deleteServiceAction(id)` kasuje z `prisma.serwisy` (osobny model, wlasne UUID) tym samym
 * id — to jest odrebny blad poprawnosci (WO, R3), nie przedmiot tego testu. Ten plik testuje
 * WYLACZNIE bramke roli i celowo uzywa jednoznacznie fikcyjnych identyfikatorow serwisu, zeby
 * nie sugerowac zwiazku z `getUpcomingServices()`.
 *
 * Mockujemy @repo/database, next/cache (revalidatePath) i
 * ../src/utils/supabase/server (getCurrentActorRole).
 */

const { serviceDeleteMock, revalidatePathMock, getCurrentActorRoleMock } = vi.hoisted(() => ({
  serviceDeleteMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    serwisy: {
      delete: serviceDeleteMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { deleteServiceAction } = await import('../src/app/(dashboard)/services/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'services', 'delete') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'services', 'delete') !== 'yes');

describe('deleteServiceAction — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    serviceDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona, prisma.serwisy.delete nie jest wywolane ani razu',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'services', 'delete')).not.toBe('yes');

      const result = await deleteServiceAction('service-1');

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(serviceDeleteMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteServiceAction('service-1');

    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteServiceAction('service-1');

    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(ALLOWED_ROLES)('rola %s jest dozwolona, delete faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    serviceDeleteMock.mockResolvedValue({});

    const result = await deleteServiceAction('service-1');

    expect(result).toEqual({ success: true });
    expect(serviceDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'service-1' } }),
    );
  });

  // Kontrola pozytywna kontraktu — dyspozytor ma services.update, ale NIE delete,
  // wiec naprawa oparta przez pomylke na 'update' musi ten test oblac (AC7).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — wylacznie admin ma delete na services w macierzy RBAC', () => {
    expect(PERMISSIONS.services.delete).toEqual(['admin']);
    expect(can('dyspozytor', 'services', 'update')).toBe('yes');
    expect(can('dyspozytor', 'services', 'delete')).toBe('no');
  });

  // Wariant 'own' nie przepuszcza — monter ma services.update = 'own', nie 'yes' (AC4).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — monter ma tylko wariant own na services.update, na delete brak', () => {
    expect(can('monter', 'services', 'update')).toBe('own');
    expect(can('monter', 'services', 'delete')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteServiceAction('service-1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });

  // Przypadek nieistniejacego rekordu: odmowa dla roli bez uprawnien zachodzi
  // NIEZALEZNIE od tego, czy rekord istnieje (WO, "Przypadki brzegowe", pkt
  // "Idempotencja / rekord nieistniejacy").
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa dla roli bez uprawnien zachodzi niezaleznie od istnienia rekordu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await deleteServiceAction('service-nieistniejacy');

    expect(serviceDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });
});
