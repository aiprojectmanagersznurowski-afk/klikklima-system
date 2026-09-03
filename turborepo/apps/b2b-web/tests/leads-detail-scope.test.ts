import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wymaganie: SEC-RLS-AUDITOR-SCOPE (contracts/requirements.contract.mjs, status TODO,
 * risk HIGH) — kryteria AC4/AC5 z docs/workorders/SEC-RLS-AUDITOR-SCOPE.md, znalezisko
 * MAJOR 3 recenzji `rls-security-auditor` po zamknięciu GREEN.
 *
 * Dziś `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx:53` woła
 * `prisma.leady.findUnique({ where: { id }, include: { klient: true, adres: true } })`
 * BEZ jakiejkolwiek bramki roli i BEZ filtra własności. Każde zalogowane konto —
 * łącznie z audytorem spoza sprawy i monterem, który nie ma `leads.read` w macierzy
 * w żadnym wariancie — dostaje po wpisaniu dowolnego `id` w URL pełny rekord: telefon,
 * e-mail, notatki wewnętrzne, surowe odpowiedzi triage.
 *
 * Ten plik zamraża oczekiwane zachowanie funkcji pomocniczej `getLeadDetail(id)`,
 * którą GREEN musi wydzielić do `leads/[id]/actions.ts` (ten sam plik, w którym już
 * mieszkają `updateLeadAuditor`/`updateLeadData`, bramkowane wzorem
 * `can(actorRole, "leads", "update") !== "yes"` — patrz CRM-LEAD-UPDATE-ADMIN-DISPATCHER).
 * `page.tsx` (Server Component) ma wywołać `getLeadDetail(id)` i zrobić `notFound()`,
 * gdy wynik to `{ success: false }` — dokładnie wzorem `settings/page.tsx:16`
 * (`can(...) !== 'yes' → notFound()`), tyle że tutaj potrzebny jest DODATKOWO filtr
 * WŁASNOŚCI dla wariantu `'own'`, bo `leads.read = ['admin', 'dyspozytor', 'audytor:own']`
 * (contracts/rbac.contract.mjs:30) — nie binarna bramka jak w settings.
 *
 * Ten plik NIE testuje renderowania JSX `page.tsx` — testuje wyłącznie logikę dostępu
 * do danych, tym samym standardem dowodowym co `leads-auditor-scope.test.ts`
 * (SEC-RLS-AUDITOR-SCOPE, SEC-LEADS-LIST-MINIMIZE/SCALARS): dowodem jest argument
 * przekazany do `prisma.leady.findUnique` oraz kształt zwróconego wyniku, nie efekt
 * uboczny renderowania.
 *
 * AC4 (indistinguishability): odpowiedź dla leada cudzego i dla leada nieistniejącego
 * musi mieć IDENTYCZNY kształt — inaczej odmowa sama w sobie potwierdza istnienie
 * rekordu. Test na to jest obowiązkowy (patrz opis w ostatnim `describe` poniżej).
 *
 * Tożsamość audytora: ten sam wzorzec identity-resolution co w `getLeads()`
 * (`leads/actions.ts`) — `createClient()` + `supabase.auth.getUser()` +
 * `prisma.audytorzy.findUnique({ where: { email } })`. Re-użycie tego wzorca (a nie
 * wynalezienie czwartego) jest oczekiwane w GREEN, ale to już decyzja implementera —
 * dla RED liczy się wyłącznie obserwowalne zachowanie `getLeadDetail`.
 *
 * Mockowane zależności: `@repo/database` (`prisma.leady.findUnique`,
 * `prisma.audytorzy.findUnique`), `next/cache` (moduł importowany w tym samym pliku
 * `actions.ts` przez `updateLeadAuditor`/`updateLeadData`), `../../../../utils/supabase/server`
 * (`getCurrentActorRole`, `createClient`). `can()` z `@klikklima/contracts` NIE jest
 * mockowane — leci na prawdziwej, wygenerowanej macierzy.
 */

const {
  leadFindUniqueMock,
  auditorFindManyMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

// SEC-EMAIL-UNIQUE (Faza A, implementer-server): tożsamość "własnego" audytora idzie
// dziś przez `findMany({ where: { email }, select: { id, is_active }, take: 2 })`, nie
// `findUnique` — email już nie jest unikalny (leads/[id]/actions.ts:45).
// `prisma.leady.findUnique` NIE zmienia się — to inne zapytanie (po `id`, nie `email`).
vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      findUnique: leadFindUniqueMock,
    },
    audytorzy: {
      findMany: auditorFindManyMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): `getCurrentUser` deleguje do tego samego
// `getUserMock`, którym testy już sterują dla `createClient().auth.getUser()` —
// jeden punkt prawdy o sesji, spójny niezależnie od tego, którą ścieżką kod
// produkcyjny po nią sięgnie.
getCurrentUserMock.mockImplementation(() => getUserMock());

// `leads/[id]/actions.ts` jest cztery katalogi głębiej niż `tests/`, więc importuje
// `utils/supabase/server` przez `../../../../utils/supabase/server` — Vitest rozwiązuje
// mock modułu po ŚCIEŻCE ROZWIĄZANEJ, nie po literalnym stringu importu, więc mock
// zarejestrowany wyżej (dla `getLeads()` w `leads/actions.ts`, trzy poziomy głębiej)
// obejmuje też ten import, o ile wskazuje na ten sam plik fizyczny.
const { getLeadDetail } = await import('../src/app/(dashboard)/leads/[id]/actions');

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const AUDITOR_ID = 'audytor-x';
const OTHER_AUDITOR_ID = 'audytor-y-cudzy';
const LEAD_ID = 'lead-1';

function mockSessionEmail(email: string | null | undefined) {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } });
}

function fullLeadRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LEAD_ID,
    status: 'AWAITING_AUDIT',
    audytor_id: AUDITOR_ID,
    created_at: new Date('2026-01-01T10:00:00Z'),
    klient: { id: 'klient-1', imie_i_nazwisko: 'Jan Kowalski', telefon: '600000000', email: 'jan@example.com' },
    adres: { ulica_miasto: 'Testowa 1, Warszawa' },
    ...overrides,
  };
}

beforeEach(() => {
  leadFindUniqueMock.mockReset();
  auditorFindManyMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('getLeadDetail() — bramka roli i filtr własności na /leads/[id] (SEC-RLS-AUDITOR-SCOPE, AC4/AC5)', () => {
  // Kontrola pozytywna — bez zmian względem dzisiejszego zachowania.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('admin: dostaje pełny rekord dowolnego leada, niezależnie od audytor_id', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: OTHER_AUDITOR_ID }));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(true);
    expect((result as { success: true; lead: any }).lead?.id).toBe(LEAD_ID);
    expect(auditorFindManyMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('dyspozytor: dostaje pełny rekord dowolnego leada, identycznie jak admin', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: OTHER_AUDITOR_ID }));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(true);
    expect((result as { success: true; lead: any }).lead?.id).toBe(LEAD_ID);
  });

  // AC5: audytor otwierający WŁASNY lead widzi go bez zmian.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: otwierający WŁASNY lead (audytor_id === własny id z sesji) dostaje pełny rekord', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([{ id: AUDITOR_ID, is_active: true }]);
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: AUDITOR_ID }));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(true);
    expect((result as { success: true; lead: any }).lead?.id).toBe(LEAD_ID);
  });

  // Punkt 14 (BATCH-MEDIUM-LOW-CLEANUP): tożsamość audytora dociągana wyłącznie
  // po id i is_active — dowód nad dokładnym kształtem `select`, nie nad samym
  // faktem wywołania (ten jest już pokryty testem powyżej dla audytora WŁASNEGO
  // leada).
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: audytorzy.findMany() jest wołane z select: { id: true, is_active: true } dokładnie, nic więcej', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([{ id: AUDITOR_ID, is_active: true }]);
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: AUDITOR_ID }));

    await getLeadDetail(LEAD_ID);

    const callArgs = auditorFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.select).toEqual({ id: true, is_active: true });
  });

  // AC4: audytor próbujący otworzyć CUDZY lead — odmowa, zero danych w odpowiedzi.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: otwierający CUDZY lead (audytor_id inny niż własny id z sesji) dostaje odmowę bez żadnych danych leada', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([{ id: AUDITOR_ID, is_active: true }]);
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: OTHER_AUDITOR_ID }));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('lead');
  });

  // AC1 wariant leada nieprzypisanego — spójne z D1 (getLeads()): audytor nie widzi
  // leadów, które do niego nie należą, a NULL nie jest jego własnością.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: lead z audytor_id = null (nieprzypisany) — odmowa, nie sukces z pustymi polami', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([{ id: AUDITOR_ID, is_active: true }]);
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: null }));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
  });

  // monter nie ma leads.read w żadnym wariancie — odmowa na KAŻDYM leadzie, w tym
  // własnym hipotetycznym przypisaniu (monter nie ma kolumny własności w ogóle).
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('monter: odmowa na dowolnym leadzie, prisma.leady.findUnique NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });

  // AC4, dowód kluczowy: kształt odmowy dla leada CUDZEGO i dla leada NIEISTNIEJĄCEGO
  // musi być identyczny — inaczej odmowa sama w sobie zdradza, że rekord istnieje.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('AC4: kształt odmowy dla leada cudzego jest identyczny jak dla leada nieistniejącego (nieodróżnialność)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([{ id: AUDITOR_ID, is_active: true }]);

    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: OTHER_AUDITOR_ID }));
    const foreignLeadResult = await getLeadDetail(LEAD_ID);

    leadFindUniqueMock.mockResolvedValue(null);
    const missingLeadResult = await getLeadDetail('nie-istnieje');

    expect(foreignLeadResult).toEqual(missingLeadResult);
  });

  // Fail-closed #1: getCurrentActorRole() rzuca.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: getCurrentActorRole() rzuca wyjątek → odmowa, prisma.leady.findUnique NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja nieczytelna'));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });

  // Fail-closed #2: rola spoza ROLES (getCurrentActorRole() zwraca null).
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: getCurrentActorRole() zwraca null → odmowa, prisma.leady.findUnique NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });

  // Fail-closed #3: audytor bez rekordu w audytorzy — najgroźniejszy przypadek
  // brzegowy z WO, analogiczny do fail-closed #3 w getLeads().
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: rola audytor, ale audytorzy.findMany(email z sesji) zwraca pustą tablicę → odmowa, findUnique(lead) NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([]);

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });

  // Fail-closed #4: audytorzy.email IS NULL w sesji.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: rola audytor, ale sesja Supabase nie ma e-maila → odmowa, findUnique(lead) NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(null);

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
    expect(auditorFindManyMock).not.toHaveBeenCalled();
  });

  // Konto zablokowane (analogiczne do MAJOR 2 w getLeads()) — middleware nie chroni
  // przed bezpośrednim wywołaniem, a is_active nie jest dziś w ogóle sprawdzane.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: konto is_active=false w audytorzy → odmowa BEZPOŚREDNIO w getLeadDetail(), findUnique(lead) NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([{ id: AUDITOR_ID, is_active: false }]);

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });
});
