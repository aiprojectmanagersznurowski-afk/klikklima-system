import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wymaganie: SEC-RLS-AUDITOR-SCOPE (contracts/requirements.contract.mjs, status TODO,
 * risk HIGH, decyzje człowieka D1-D6 z 2026-08-26 — patrz docs/workorders/
 * SEC-RLS-AUDITOR-SCOPE.md).
 *
 * Dziś `getLeads()` (`leads/actions.ts`) i `getLogisticsLeads()` (`logistics/actions.ts`)
 * NIE wołają ani `getCurrentActorRole()`, ani `can()` — każde zalogowane konto,
 * niezależnie od roli, dostaje komplet leadów wszystkich audytorów. Ten plik zamraża
 * docelowe zachowanie:
 *
 *   - admin/dyspozytor: bez zmian, widzą wszystko (kontrola pozytywna, AC „bez tego
 *     przypadku naprawa mogłaby zawęzić zakres wszystkim").
 *   - audytor na /leads: `where` przekazane do `prisma.leady.findMany` (i do
 *     `prisma.leady.count` oraz `prisma.leady.groupBy` liczącego `stageCounts`) MUSI
 *     zawierać `audytor_id` równy identyfikatorowi WŁASNEGO rekordu w `audytorzy`,
 *     dociągniętemu przez `audytorzy.email` równe adresowi z sesji Supabase — dokładnie
 *     tym samym wzorcem co `setSelfAvailabilityAction`/`acceptLegalDocumentVersionAction`
 *     (`createClient()` + `supabase.auth.getUser()` + `prisma.audytorzy.findUnique({
 *     where: { email } })`, patrz auditors/actions.ts i crews/actions.ts). Audytor NIE
 *     widzi leadów nieprzypisanych (`audytor_id IS NULL`) — to konsekwencja filtra,
 *     świadomie zaakceptowana w D1, nie luka do naprawienia.
 *   - monter na /leads i audytor+monter na /logistics: ODMOWA, nie cicha pusta lista
 *     (D2, D4) — `prisma.leady.findMany` NIE JEST wołane w ogóle.
 *   - fail-closed: `getCurrentActorRole()` rzuca, zwraca rolę spoza `ROLES`, albo
 *     zalogowany audytor nie ma rekordu w `audytorzy` (`email IS NULL` też) — zawsze
 *     odmowa, NIGDY `where` zbudowane z `undefined` (Prisma ignoruje `undefined` w
 *     `where` i oddaje komplet — najgroźniejszy przypadek brzegowy tego wymagania).
 *
 * DOWÓD JEST ARGUMENTEM WYWOŁANIA (AC „dowodem jest argument przekazany do zapytania,
 * nie kształt wyniku"), tym samym standardem co SEC-LEADS-LIST-MINIMIZE/SCALARS —
 * przy zamockowanej Prismie mock oddaje to, co mu wpisano, niezależnie od `where`.
 *
 * DECYZJA TEST-AUTHORA (kształt odmowy — WO jawnie deleguje to na fazę RED/GREEN,
 * nie rozstrzyga z góry): odmowa to `{ success: false, error: string }`, ODRÓŻNIALNE
 * od kształtu sukcesu (`{ leads, totalCount, totalPages, stageCounts }` dla getLeads(),
 * `LogisticsLead[]` dla getLogisticsLeads()) samą obecnością klucza `success: false` i
 * brakiem `leads`/tablicy. Wzorzec spójny z jedynym istniejącym w repo konturem gated
 * Server Action (`{ success, error }` — assignCrewToLead/advanceLeadStatus/
 * deleteLeadAction/returnToFunnel/archiveLost/shipLogisticsOrder i inne w
 * logistics/actions.ts) — nie wymyślamy czwartego kształtu odmowy w tym samym pliku.
 *
 * Mockowane zależności: `@repo/database` (prisma.leady.{findMany,count,groupBy},
 * prisma.audytorzy.findUnique — identity resolution), `next/cache` (revalidatePath,
 * moduł importowany na górze obu plików actions.ts), `../src/utils/supabase/server`
 * (getCurrentActorRole, createClient — ten sam moduł, mockowany raz, importowany z
 * dwóch różnych podkatalogów, wzorem legal-document-consent.test.ts). `can()` z
 * `@klikklima/contracts` NIE jest mockowane — leci na prawdziwej, wygenerowanej macierzy
 * (leads.read = ['admin','dyspozytor','audytor:own'], brak wpisu dla monter → 'no').
 */

const {
  leadFindManyMock,
  leadCountMock,
  leadGroupByMock,
  auditorFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindManyMock: vi.fn(),
  leadCountMock: vi.fn(),
  leadGroupByMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      findMany: leadFindManyMock,
      count: leadCountMock,
      groupBy: leadGroupByMock,
    },
    audytorzy: {
      findUnique: auditorFindUniqueMock,
    },
  },
  LeadStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { getLeads } = await import('../src/app/(dashboard)/leads/actions');
const { getLogisticsLeads } = await import('../src/app/(dashboard)/logistics/actions');

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const AUDITOR_ID = 'audytor-x';
const OTHER_AUDITOR_ID = 'audytor-y-cudzy';

function mockSessionEmail(email: string | null | undefined) {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } });
}

beforeEach(() => {
  leadFindManyMock.mockReset();
  leadCountMock.mockReset();
  leadGroupByMock.mockReset();
  auditorFindUniqueMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  leadFindManyMock.mockResolvedValue([]);
  leadCountMock.mockResolvedValue(0);
  leadGroupByMock.mockResolvedValue([]);
});

describe('getLeads() — zawężenie zakresu audytora (SEC-RLS-AUDITOR-SCOPE)', () => {
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: where przekazane do findMany zawiera audytor_id równy WŁASNEMU id dociągniętemu przez audytorzy.email z sesji', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    await getLeads();

    expect(leadFindManyMock).toHaveBeenCalledTimes(1);
    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where).toBeTruthy();
    expect(callArgs.where.audytor_id).toBe(AUDITOR_ID);
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: tożsamość jest dociągana przez audytorzy.findUnique({ where: { email } }) z e-mailem SESJI, nie z żadnego argumentu getLeads()', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    await getLeads();

    expect(auditorFindUniqueMock).toHaveBeenCalledTimes(1);
    const identityArgs = auditorFindUniqueMock.mock.calls[0]?.[0] ?? {};
    expect(identityArgs.where?.email).toBe(AUDITOR_EMAIL);
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: filtr własności MERGE-uje się z filtrem status/bucket istniejącym już w where, nie zastępuje go', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    await getLeads({ status: 'AWAITING_AUDIT' });

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where.status).toBe('AWAITING_AUDIT');
    expect(callArgs.where.audytor_id).toBe(AUDITOR_ID);
  });

  // Kontrola pozytywna (bez tego przypadku naprawa mogłaby zawęzić zakres wszystkim).
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('admin: where NIE zawiera klucza audytor_id wcale — zakres bez zmian względem dzisiejszego zachowania', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');

    await getLeads();

    expect(leadFindManyMock).toHaveBeenCalledTimes(1);
    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where ?? {}).not.toHaveProperty('audytor_id');
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('dyspozytor: where NIE zawiera klucza audytor_id wcale — identycznie jak admin', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    await getLeads();

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where ?? {}).not.toHaveProperty('audytor_id');
  });

  // D2: odmowa jawna, nie cicha pusta lista.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('monter: getLeads() zwraca odmowę jednoznacznie odróżnialną od sukcesu, prisma.leady.findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(result).not.toHaveProperty('leads');
    expect(leadFindManyMock).not.toHaveBeenCalled();
    expect(leadCountMock).not.toHaveBeenCalled();
    expect(leadGroupByMock).not.toHaveBeenCalled();
  });

  // Fail-closed #1: getCurrentActorRole() rzuca.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: getCurrentActorRole() rzuca wyjątek → odmowa, prisma nie wołane', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja nieczytelna'));

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  // Fail-closed #2: rola spoza ROLES (getCurrentActorRole() zwraca null).
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: getCurrentActorRole() zwraca null (rola spoza ROLES / brak sesji) → odmowa, prisma nie wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  // Fail-closed #3: audytor zalogowany, ale brak rekordu w audytorzy (konto usunięte/
  // nigdy nie utworzone) — NAJGROŹNIEJSZY przypadek: where nie może zostać zbudowane
  // z undefined, bo Prisma taki warunek IGNORUJE i oddaje komplet leadów.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: rola audytor, ale audytorzy.findUnique(email z sesji) zwraca null → odmowa, findMany NIE jest wołane (nigdy where z undefined)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue(null);

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  // Fail-closed #4: audytorzy.email IS NULL w sesji — supabase nie zwraca e-maila.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: rola audytor, ale sesja Supabase nie ma e-maila (user.email brak) → odmowa, findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(null);

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
  });

  // Liczniki i paginacja są częścią zakresu (AC „stageCounts... jest wyciekiem informacji
  // o wolumenie, jeżeli nie jest zawężony").
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: prisma.leady.groupBy (stageCounts) jest wołane z tym samym filtrem audytor_id', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    await getLeads();

    expect(leadGroupByMock).toHaveBeenCalledTimes(1);
    const groupByArgs = leadGroupByMock.mock.calls[0]?.[0] ?? {};
    expect(groupByArgs.where).toBeTruthy();
    expect(groupByArgs.where.audytor_id).toBe(AUDITOR_ID);
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: prisma.leady.count (totalCount/totalPages) jest wołane z tym samym filtrem audytor_id', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    await getLeads();

    expect(leadCountMock).toHaveBeenCalledTimes(1);
    const countArgs = leadCountMock.mock.calls[0]?.[0] ?? {};
    expect(countArgs.where).toBeTruthy();
    expect(countArgs.where.audytor_id).toBe(AUDITOR_ID);
  });

  // Kontrola pozytywna symetryczna: dla admin/dyspozytor stageCounts/count NIE dostają
  // audytor_id — bez tego przypadku implementacja mogłaby przez pomyłkę wstrzyknąć
  // filtr wszystkim rolom.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('dyspozytor: groupBy i count NIE dostają klucza audytor_id', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    await getLeads();

    const groupByArgs = leadGroupByMock.mock.calls[0]?.[0] ?? {};
    const countArgs = leadCountMock.mock.calls[0]?.[0] ?? {};
    expect(groupByArgs.where ?? {}).not.toHaveProperty('audytor_id');
    expect(countArgs.where ?? {}).not.toHaveProperty('audytor_id');
  });

  // Przepięcie leada (D3): identyfikator "cudzego" audytora nigdzie w kodzie nie może
  // wpłynąć na warunek — dowodem jest, że przy zamockowanej identyczności OTHER_AUDITOR_ID
  // nigdy się nie pojawia w where, niezależnie od tego, co zwróciłby lead. Test negatywny,
  // dopełniający dowód "dokładna wartość z sesji, nie cokolwiek innego".
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: where.audytor_id nigdy nie przyjmuje wartości innej niż WŁASNE id z sesji (kontrola negatywna)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    await getLeads();

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where.audytor_id).not.toBe(OTHER_AUDITOR_ID);
    expect(callArgs.where.audytor_id).toBe(AUDITOR_ID);
  });

  // MINOR 1 (recenzja rls-security-auditor po zamknięciu GREEN, 2026-08-26):
  // acceptance[1] wymaga wprost "test wywołuje akcję bezpośrednio, z pominięciem
  // interfejsu, podstawiając cudzy identyfikator w argumencie, i dowodzi że where
  // zawiera identyfikator z SESJI, nie z argumentu" — kontrola negatywna powyżej tego
  // NIE robi: nigdy nie podaje OTHER_AUDITOR_ID na WEJŚCIU wywołania, więc mutant, który
  // pozwala argumentowi nadpisać own.id (np. `audytor_id: options?.audytor_id ?? own.id`)
  // przeżyłby całą baterię. `getLeads()` nie deklaruje dziś parametru `audytor_id` w
  // sygnaturze — podajemy go mimo to, rzutując na typ parametru SAMEJ funkcji
  // (`Parameters<typeof getLeads>[0]`, nigdy na `any`), właśnie po to, żeby dowieść,
  // że NAWET próba przekazania obcego id nie ma wpływu, niezależnie od tego, czy ktoś
  // kiedyś dopisze taki parametr do sygnatury. Ten test, w odróżnieniu od pozostałych
  // w tym pliku, PRZECHODZI już dziś (implementacja i tak ignoruje options.audytor_id)
  // — zamyka lukę dowodową w baterii testów, nie w kodzie produkcyjnym; RED tej pary
  // dopisanych testów dotyczy wyłącznie MAJOR 2 (konto is_active=false) poniżej.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: podanie CUDZEGO audytor_id w argumencie getLeads() nie ma żadnego wpływu na where — liczy się wyłącznie tożsamość z sesji', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID });

    const maliciousOptions = { status: 'NEW_LEAD', audytor_id: OTHER_AUDITOR_ID };
    await getLeads(maliciousOptions as Parameters<typeof getLeads>[0]);

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where.audytor_id).toBe(AUDITOR_ID);
    expect(callArgs.where.audytor_id).not.toBe(OTHER_AUDITOR_ID);
  });

  // MAJOR 2 (recenzja rls-security-auditor po zamknięciu GREEN, 2026-08-26):
  // acceptance[10] ("KONTO NIEAKTYWNE") wymaga, żeby audytor z is_active=false w
  // audytorzy dostał odmowę BEZPOŚREDNIO w getLeads(), niezależnie od tego, że
  // middleware.ts:87-107 go już wylogowuje — middleware nie chroni przed bezpośrednim
  // POST-em do Server Action. Dziś (actions.ts:300-304) `own` jest akceptowany, gdy
  // TYLKO istnieje rekord — is_active w ogóle nie jest odczytywane z findUnique ani
  // sprawdzane. Ten test MUSI dziś failować: bez sprawdzenia is_active kod zbuduje
  // scopeWhere = { audytor_id: AUDITOR_ID } i wywoła findMany, więc odmowa nie
  // nastąpi.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: konto is_active=false w audytorzy → odmowa BEZPOŚREDNIO w getLeads(), prisma.leady.{findMany,count,groupBy} NIE są wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindUniqueMock.mockResolvedValue({ id: AUDITOR_ID, is_active: false });

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(result).not.toHaveProperty('leads');
    expect(leadFindManyMock).not.toHaveBeenCalled();
    expect(leadCountMock).not.toHaveBeenCalled();
    expect(leadGroupByMock).not.toHaveBeenCalled();
  });
});

describe('getLogisticsLeads() — /logistics zamknięte dla audytora i montera (SEC-RLS-AUDITOR-SCOPE, D4)', () => {
  // Kontrola pozytywna — bez zmian dla ról uprzywilejowanych.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('admin: getLogisticsLeads() woła prisma.leady.findMany i zwraca tablicę (bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    leadFindManyMock.mockResolvedValue([]);

    const result = await getLogisticsLeads();

    expect(leadFindManyMock).toHaveBeenCalledTimes(1);
    expect(Array.isArray(result)).toBe(true);
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('dyspozytor: getLogisticsLeads() woła prisma.leady.findMany i zwraca tablicę (bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    leadFindManyMock.mockResolvedValue([]);

    const result = await getLogisticsLeads();

    expect(leadFindManyMock).toHaveBeenCalledTimes(1);
    expect(Array.isArray(result)).toBe(true);
  });

  // D4: audytor NIE dostaje zakresu :own na tym widoku — odmowa całkowita, nie zawężenie.
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('audytor: getLogisticsLeads() zwraca odmowę jednoznacznie odróżnialną od sukcesu, findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await getLogisticsLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(Array.isArray(result)).toBe(false);
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('monter: getLogisticsLeads() zwraca odmowę, findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await getLogisticsLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  // Fail-closed, symetrycznie do getLeads().
  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: getCurrentActorRole() rzuca wyjątek → odmowa, findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja nieczytelna'));

    const result = await getLogisticsLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-RLS-AUDITOR-SCOPE
  it('fail-closed: getCurrentActorRole() zwraca null → odmowa, findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await getLogisticsLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });
});
