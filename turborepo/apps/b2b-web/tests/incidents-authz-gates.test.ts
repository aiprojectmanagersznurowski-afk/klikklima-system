import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `incidents/actions.ts`
 * (`docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, finding #3).
 *
 * `deleteIncidentAction` nie sprawdza dzis roli w ogole. Bramka
 * `can(role, 'incidents', 'delete') === 'yes'` (`contracts/rbac.contract.mjs:34` ->
 * wylacznie `admin`). Wzorzec 1:1 z `deleteLeadAction`
 * (`leads/actions.ts:490`, `leads-delete-admin-only.test.ts`).
 *
 * Zestawy rol dozwolonych/niedozwolonych sa wyliczone dynamicznie z `can()`/`ROLES`,
 * nie wpisane literalnie.
 *
 * Sygnatura docelowa: `deleteIncidentAction` dzis zwraca `void`, po naprawie musi
 * zwracac `{ success: boolean; error?: string }` (edge case WO, "Odmowa odroznialna
 * od sukcesu" — `incidents-client.tsx:37` dzis pokazuje sukces niezaleznie od wyniku).
 *
 * Mockujemy @repo/database, next/cache (revalidatePath) i
 * ../src/utils/supabase/server (getCurrentActorRole).
 *
 * Mechanicznie zaktualizowane pod SEC-AUDIT-LOG-DELETE (docs/workorders/SEC-AUDIT-LOG-DELETE.md):
 * `deleteIncidentAction` zyskuje drugi parametr `input: { justification, legalBasis }`, a `delete`
 * przenosi sie do `prisma.$transaction` (wzorzec $transaction-only skopiowany z
 * leads-delete-admin-only.test.ts). Ten plik NADAL dowodzi wylacznie bramki roli
 * (SEC-AUTHZ-B2B-MUTATIONS) — wpis do `audit_log` pokrywa osobno
 * sec-audit-log-delete-wave-a.test.ts. `getCurrentUser` musi zwracac email, inaczej
 * akcja odmawia przed dotarciem do bramki roli w testach kontroli pozytywnej.
 */

const {
  transactionMock,
  incidentDeleteMock,
  auditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  incidentDeleteMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } });

const tx = {
  usterki_incidents: { delete: incidentDeleteMock },
  auditLog: { create: auditLogCreateMock },
};

const VALID_INPUT = {
  justification: 'Duplikat zgloszenia utworzony przez pomylke operatora.',
  legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
};

const { deleteIncidentAction } = await import('../src/app/(dashboard)/incidents/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'incidents', 'delete') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'incidents', 'delete') !== 'yes');

describe('deleteIncidentAction — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    incidentDeleteMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona, mutacja usunięcia usterki nie jest wywołana',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'incidents', 'delete')).not.toBe('yes');

      const result = await deleteIncidentAction('incident-1', VALID_INPUT);

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(incidentDeleteMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteIncidentAction('incident-1', VALID_INPUT);

    expect(incidentDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteIncidentAction('incident-1', VALID_INPUT);

    expect(incidentDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(ALLOWED_ROLES)('rola %s jest dozwolona, delete faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    incidentDeleteMock.mockResolvedValue({});

    const result = await deleteIncidentAction('incident-1', VALID_INPUT);

    expect(result).toEqual({ success: true });
    expect(incidentDeleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'incident-1' } }),
    );
  });

  // Kontrola pozytywna kontraktu — dyspozytor ma incidents.update, ale NIE delete,
  // wiec naprawa oparta przez pomylke na 'update' musi ten test oblac (AC7).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — wylacznie admin ma delete na incidents w macierzy RBAC', () => {
    expect(PERMISSIONS.incidents.delete).toEqual(['admin']);
    expect(can('dyspozytor', 'incidents', 'update')).toBe('yes');
    expect(can('dyspozytor', 'incidents', 'delete')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteIncidentAction('incident-1', VALID_INPUT);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });

  // Przypadek nieistniejacego rekordu: odmowa dla roli bez uprawnien zachodzi
  // NIEZALEZNIE od tego, czy rekord istnieje (WO, "Przypadki brzegowe", pkt
  // "Idempotencja / rekord nieistniejacy").
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa dla roli bez uprawnien zachodzi niezaleznie od istnienia rekordu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await deleteIncidentAction('incident-nieistniejacy', VALID_INPUT);

    expect(incidentDeleteMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });
});

/**
 * BATCH-MEDIUM-LOW-CLEANUP — Punkt 18: `getCurrentActorRole()` jest dzis WEWNATRZ
 * `try` obejmujacego mutacje, wiec gdy rzuci wyjatek, uzytkownik dostaje generyczny
 * komunikat "Nie udało się..." zamiast odmowy uprawnien. Wzorzec docelowy:
 * `leads/actions.ts` (returnToFunnel/archiveLost), gdzie bramka jest przed `try`.
 */
describe('incidents/actions.ts — Punkt 18: fail-closed przed try (BATCH-MEDIUM-LOW-CLEANUP)', () => {
  beforeEach(() => {
    incidentDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
  });

  // AC18.1 / AC18.2
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('deleteIncidentAction: getCurrentActorRole rzuca -> odmowa uprawnien (nie generyczny blad zapisu), zero wywolan mutacji usunięcia usterki', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasla'));

    const result = await deleteIncidentAction('incident-1', VALID_INPUT);

    expect(incidentDeleteMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/uprawn/i);
    expect(result.error).not.toMatch(/nie udało się/i);
  });
});
