import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

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
 * ../src/utils/supabase/server (getCurrentActorRole). Model Prisma po polsku
 * (leady) — dlug KK-NAMING-BASELINE, ADR-002 zamrozony.
 *
 * Swiadome ograniczenie: warstwa UI (ukrycie przycisku "Usun" dla rol nie-admin)
 * i warstwa RLS sa OSOBNE od tej bramki Server Action i testowane gdzie indziej —
 * kontrakt CRM-DELETE-ADMIN-ONLY wymienia trzy warstwy wprost jako testowane
 * osobno. Ten plik pokrywa wylacznie warstwe Server Action.
 */

const { leadDeleteMock, revalidatePathMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  leadDeleteMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      delete: leadDeleteMock,
    },
  },
  LeadStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { deleteLeadAction } = await import('../src/app/(dashboard)/leads/actions');

// leads.delete = ['admin'] -> dyspozytor NIE jest dozwolony tutaj, w odroznieniu od
// leads.update (CRM-LEAD-UPDATE-ADMIN-DISPATCHER).
const UNAUTHORIZED_DELETE_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

describe('deleteLeadAction - bramka roli, wylacznie admin (CRM-DELETE-ADMIN-ONLY)', () => {
  beforeEach(() => {
    leadDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Server Action odrzuca zadanie roli nie-admin, PRZED jakimkolwiek zapytaniem do
  // Prismy — dyspozytor wlaczony celowo, bo ma leads.update, ale NIE leads.delete.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it.each(UNAUTHORIZED_DELETE_ROLES)(
    'rola %s jest odrzucona przed jakimkolwiek zapytaniem do Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'delete')).toBe('no');

      const result = await deleteLeadAction('lead-1');

      expect(leadDeleteMock).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await deleteLeadAction('lead-1');

    expect(leadDeleteMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await deleteLeadAction('lead-1');

    expect(leadDeleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna: admin -> sukces, delete faktycznie wywolane.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('admin - dozwolony, wywolanie konczy sie usunieciem leada', async () => {
    leadDeleteMock.mockResolvedValue({});

    const result = await deleteLeadAction('lead-1');

    expect(result).toEqual({ success: true });
    expect(leadDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'lead-1' } }));
  });

  // Kontrola pozytywna kontraktu — dowod, ze macierz RBAC faktycznie zawezona do
  // samego admina dla delete, w odroznieniu od update (['admin','dyspozytor']).
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('kontrola pozytywna kontraktu - wylacznie admin ma delete na leads w macierzy RBAC', () => {
    expect(can('admin', 'leads', 'delete')).toBe('yes');
    expect(can('dyspozytor', 'leads', 'delete')).toBe('no');
    expect(PERMISSIONS.leads.delete).toEqual(['admin']);
  });

  // Odmowa ma jawny, odroznialny ksztalt — nie wyjatek, nie cichy sukces.
  // @REQ: CRM-DELETE-ADMIN-ONLY
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteLeadAction('lead-1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result.error).toBe('string');
  });
});
