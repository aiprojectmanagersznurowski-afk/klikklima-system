import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * CRM-DELETE-ADMIN-ONLY — pokrycie dla `deleteLeadAction` w
 * `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:451`. Akcja JEST juz poprawnie
 * zabezpieczona (`can(actorRole, "leads", "delete") !== "yes"`, fail-closed przez
 * `!actorRole`) — ale dzis nie ma ZADNEGO testu. Ten plik dowodzi, ze istniejaca
 * bramka faktycznie dziala, zanim `deleteLead` (duplikat w
 * `leads/[id]/actions.ts`, bez zadnego sprawdzenia roli) zostanie usuniety przez
 * implementer-server na rzecz tej wlasnie funkcji.
 *
 * Macierz: `leads.delete = ['admin']` — WAZNE: inny (wezszy) zestaw rol niz
 * `leads.update = ['admin', 'dyspozytor']` z CRM-LEAD-UPDATE-ADMIN-DISPATCHER.
 * dyspozytor ma prawo edytowac leada, ale NIE ma prawa go usunac — test to
 * jawnie odroznia, zeby przyszla "naprawa" oparta przez pomylke na leads.update
 * nie przeszla tego zestawu.
 *
 * Wzorzec 1:1 z crews-admin-gates.test.ts (`deleteCrewAction`) — `actorRole`
 * WYLACZNIE z `getCurrentActorRole()` (`../src/utils/supabase/server`, glebokosc
 * `../../../utils/supabase/server` z perspektywy produkcji), nigdy z parametru
 * wywolania.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej), next/cache
 * (revalidatePath wymaga kontekstu zadania Next.js) i
 * ../src/utils/supabase/server (getCurrentActorRole, createClient). Model Prisma po polsku
 * (leady) — dlug KK-NAMING-BASELINE, ADR-002 zamrozony.
 *
 * Mechanicznie zaktualizowane pod SEC-AUDIT-LOG-DELETE (docs/workorders/SEC-AUDIT-LOG-DELETE.md):
 * `deleteLeadAction` zyskuje drugi parametr `input: { justification, legalBasis }`, a `delete`
 * przenosi sie do `prisma.$transaction`. Ten plik NADAL dowodzi wylacznie bramki roli
 * (CRM-DELETE-ADMIN-ONLY-LEADS) — wpis do `audit_log` pokrywa osobno
 * sec-audit-log-delete-wave-a.test.ts. Wzorzec mocka ($transaction-only, zero modelu
 * bezposrednio na `prisma`) skopiowany z tamtego pliku, zeby oba pliki zgadzaly sie co do
 * ksztaltu API i zaden test nie przechodzil przypadkiem na starym mocku.
 *
 * Swiadome ograniczenie: warstwa UI (ukrycie przycisku "Usun" dla rol nie-admin)
 * i warstwa RLS sa OSOBNE od tej bramki Server Action i testowane gdzie indziej —
 * kontrakt CRM-DELETE-ADMIN-ONLY wymienia trzy warstwy wprost jako testowane
 * osobno. Ten plik pokrywa wylacznie warstwe Server Action.
 */

const {
  transactionMock,
  leadDeleteMock,
  auditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  leadDeleteMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
  LeadStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
getCurrentUserMock.mockImplementation(() => getUserMock());

const tx = {
  leady: { delete: leadDeleteMock },
  auditLog: { create: auditLogCreateMock },
};

const VALID_JUSTIFICATION = 'Duplikat rekordu utworzony przez pomylke operatora.';
const VALID_INPUT = { justification: VALID_JUSTIFICATION, legalBasis: AUDIT_REQUIREMENTS.legalBases[0] };

const { deleteLeadAction } = await import('../src/app/(dashboard)/leads/actions');

// leads.delete = ['admin'] -> dyspozytor NIE jest dozwolony tutaj, w odroznieniu od
// leads.update (CRM-LEAD-UPDATE-ADMIN-DISPATCHER).
const UNAUTHORIZED_DELETE_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

describe('deleteLeadAction - bramka roli, wylacznie admin (CRM-DELETE-ADMIN-ONLY-LEADS)', () => {
  beforeEach(() => {
    transactionMock.mockReset();
    leadDeleteMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockReset();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } });
    createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  });

  // Server Action odrzuca zadanie roli nie-admin, PRZED jakimkolwiek zapytaniem do
  // Prismy — dyspozytor wlaczony celowo, bo ma leads.update, ale NIE leads.delete.
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it.each(UNAUTHORIZED_DELETE_ROLES)(
    'rola %s jest odrzucona przed jakimkolwiek zapytaniem do Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'delete')).toBe('no');

      const result = await deleteLeadAction('lead-1', VALID_INPUT);

      expect(transactionMock).not.toHaveBeenCalled();
      expect(leadDeleteMock).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteLeadAction('lead-1', VALID_INPUT);

    expect(transactionMock).not.toHaveBeenCalled();
    expect(leadDeleteMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteLeadAction('lead-1', VALID_INPUT);

    expect(transactionMock).not.toHaveBeenCalled();
    expect(leadDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna: admin -> sukces, delete faktycznie wywolane (wewnatrz $transaction,
  // razem z wpisem audytowym pokrywanym w sec-audit-log-delete-wave-a.test.ts).
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('admin - dozwolony, wywolanie konczy sie usunieciem leada', async () => {
    leadDeleteMock.mockResolvedValue({});
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    const result = await deleteLeadAction('lead-1', VALID_INPUT);

    expect(result).toEqual({ success: true });
    expect(leadDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'lead-1' } }));
  });

  // Kontrola pozytywna kontraktu — dowod, ze macierz RBAC faktycznie zawezona do
  // samego admina dla delete, w odroznieniu od update (['admin','dyspozytor']).
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('kontrola pozytywna kontraktu - wylacznie admin ma delete na leads w macierzy RBAC', () => {
    expect(can('admin', 'leads', 'delete')).toBe('yes');
    expect(can('dyspozytor', 'leads', 'delete')).toBe('no');
    expect(PERMISSIONS.leads.delete).toEqual(['admin']);
  });

  // Odmowa ma jawny, odroznialny ksztalt — nie wyjatek, nie cichy sukces.
  // @REQ: CRM-DELETE-ADMIN-ONLY-LEADS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteLeadAction('lead-1', VALID_INPUT);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result.error).toBe('string');
  });
});
