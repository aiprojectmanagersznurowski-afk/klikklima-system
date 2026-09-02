import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `advanceLeadStatus`
 * (`leads/actions.ts:434`, `docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, finding #8).
 *
 * KRYTYCZNE (WO): funkcja jest podpieta do UI (`leads-client.tsx:239`) bez ZADNEJ
 * bramki roli, mimo ze `leads/actions.ts` byl w tej sesji naprawiany trzy razy
 * (`deleteLeadAction`, `assignCrewToLead`, `returnToFunnel`, `archiveLost`).
 *
 * Bramka: `can(role, 'leads', 'update') === 'yes'` — ten sam zasob/zdolnosc co
 * `CRM-LEAD-UPDATE-ADMIN-DISPATCHER` (`['admin', 'dyspozytor']`).
 *
 * AC2 (WO) jest tu SZCZEGOLNIE istotne: `advanceLeadStatus` dzis zaczyna od
 * `prisma.leady.findUnique` PRZED jakakolwiek walidacja przejscia — po naprawie
 * odrzucone wywolanie NIE MOZE wykonac tego odczytu, inaczej akcja jest oraklem
 * istnienia/statusu dowolnego leada dla konta bez uprawnien. Ten plik dowodzi tego
 * wprost: `leadFindUniqueMock` NIE jest wywolane dla roli bez `leads.update`.
 *
 * Walidacja dozwolonych przejsc (`ALLOWED_TRANSITIONS`, `leads/actions.ts:412`) MA
 * pozostac nietknieta — bramka roli idzie PRZED nia, nie zamiast niej. Ten plik
 * dowodzi tylko warstwy roli; poprawnosc samej mapy przejsc jest poza zakresem tego
 * WO (patrz "Poza zakresem" w dokumencie).
 *
 * Funkcja `updateLeadStatus` (leads/actions.ts:378) jest martwym kodem (D4,
 * potwierdzone grep w WO: zero wywolan w calym repo) i ma zostac CALKOWICIE
 * usunieta jako scislej slabsza duplikacja `advanceLeadStatus` (bez walidacji
 * przejsc). Ten plik SWIADOMIE nie zawiera dla niej zadnego testu.
 *
 * Mockujemy @repo/database, next/cache (revalidatePath) i
 * ../src/utils/supabase/server (getCurrentActorRole).
 */

const { leadFindUniqueMock, leadUpdateMock, revalidatePathMock, getCurrentActorRoleMock, getCurrentUserMock } =
  vi.hoisted(() => ({
    leadFindUniqueMock: vi.fn(),
    leadUpdateMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    getCurrentActorRoleMock: vi.fn(),
    getCurrentUserMock: vi.fn(),
  }));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      findUnique: leadFindUniqueMock,
      update: leadUpdateMock,
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

const { advanceLeadStatus } = await import('../src/app/(dashboard)/leads/actions');

const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'leads', 'update') === 'yes');
const DENIED_ROLES = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');

describe('advanceLeadStatus — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    leadUpdateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // AC2 (WO): odmowa PRZED jakimkolwiek zapytaniem do Prismy, WLACZNIE z odczytem
  // findUnique — inaczej akcja jest oraklem istnienia/statusu dowolnego leada.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(DENIED_ROLES)(
    'rola %s jest odrzucona PRZED odczytem leada (findUnique nie jest wywolane)',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'update')).not.toBe('yes');

      const result = await advanceLeadStatus('lead-1', 'AWAITING_AUDIT' as never);

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(leadFindUniqueMock).not.toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed, bez odczytu leada', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await advanceLeadStatus('lead-1', 'AWAITING_AUDIT' as never);

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role — cialo akcji jest opakowane w
  // try/catch zwracajacy komunikat bledu (WO, ostrzezenie dla implementera AC5) —
  // bramka MUSI stac przed tym blokiem, inaczej wyjatek z getCurrentActorRole
  // zamienia sie w zwykle "nie udalo sie zmienic statusu" zamiast w twarda odmowe,
  // co i tak jest odroznialne od zwyklego bledu tylko przez to, ze nie ma efektu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek, bez odczytu leada', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await advanceLeadStatus('lead-1', 'AWAITING_AUDIT' as never);

    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla kazdej dozwolonej roli osobno (AC3) — przejscie zgodne z
  // ALLOWED_TRANSITIONS (NEW_LEAD -> AWAITING_AUDIT wymaga tez audytor_id, wiec
  // fixture ma go ustawiony).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(ALLOWED_ROLES)(
    'rola %s jest dozwolona, dozwolone przejscie konczy sie zapisem',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      leadFindUniqueMock.mockResolvedValue({ status: 'NEW_LEAD', audytor_id: 'audytor-1' });
      leadUpdateMock.mockResolvedValue({});

      const result = await advanceLeadStatus('lead-1', 'AWAITING_AUDIT' as never);

      expect(result).toEqual({ success: true });
      expect(leadUpdateMock).toHaveBeenCalled();
    },
  );

  // Walidacja przejsc MA pozostac nietknieta: rola dozwolona, ale przejscie
  // niedozwolone wg ALLOWED_TRANSITIONS -> odmowa z powodu logiki biznesowej, nie
  // bramki roli (dowod, ze bramka nie zastapila tej walidacji, tylko stanela przed
  // nia).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('admin — przejscie niedozwolone wg ALLOWED_TRANSITIONS jest odrzucone mimo poprawnej roli', async () => {
    leadFindUniqueMock.mockResolvedValue({ status: 'INSTALLATION_COMPLETED', audytor_id: 'audytor-1' });

    const result = await advanceLeadStatus('lead-1', 'NEW_LEAD' as never);

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kontrola pozytywna kontraktu.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — admin i dyspozytor maja update na leads, audytor i monter nie', () => {
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);
    expect(can('audytor', 'leads', 'update')).toBe('no');
    expect(can('monter', 'leads', 'update')).toBe('no');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await advanceLeadStatus('lead-1', 'AWAITING_AUDIT' as never);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});
