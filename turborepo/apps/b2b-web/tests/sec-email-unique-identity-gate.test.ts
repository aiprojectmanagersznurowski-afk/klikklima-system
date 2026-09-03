import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/SEC-EMAIL-UNIQUE.md — Faza A (bramka tożsamości w kodzie,
 * bez okna kontraktowego). AC-A1 do AC-A6, AC-A8.
 *
 * Baza żywa NIE ma ograniczenia UNIQUE na `audytorzy.email` ani na
 * `zespoly_monterskie.email` (zweryfikowane 2026-09-03 — WO, sekcja "Baza —
 * brak ograniczenia"). Sześć miejsc w kodzie ufają dziś obietnicy `@unique` ze
 * `schema.prisma`, która NIE odpowiada rzeczywistości: wołają
 * `prisma.<tabela>.findUnique({ where: { email } })`, a Prisma przy braku
 * ograniczenia w bazie po prostu zwraca PIERWSZY pasujący wiersz zamiast rzucić
 * błędem "więcej niż jeden wynik". Przy duplikacie e-maila każde z tych sześciu
 * miejsc cicho działa na dowolnym z dwóch rekordów.
 *
 * Ten plik zamraża wzorzec docelowy (D4 z WO, już ustalony w SEC-READ-GATES dla
 * trzech innych funkcji odczytowych, `installations/actions.ts:49-56` itd.):
 * `findMany({ where: { email }, take: 2 })`, odmowa gdy `matches.length !== 1`
 * lub gdy dopasowany rekord jest nieaktywny.
 *
 * SYMULACJA DZISIEJSZEJ PODATNOŚCI (dlaczego duplikat-testy padają na dzisiejszym
 * kodzie, nie na braku importu): mock `findUnique` w scenariuszach duplikatu
 * zwraca JEDEN z dwóch kolidujących wierszy — dokładnie to, co realny Postgres
 * zrobiłby bez ograniczenia UNIQUE (zwraca "jakiś" pasujący wiersz, kolejność
 * nieokreślona). Dzisiejszy kod korzysta z `findUnique`, więc dostaje ten wiersz
 * i PRZECHODZI DALEJ zamiast odmówić — to jest właściwy dowód luki, nie efekt
 * uboczny złego mocka.
 *
 * Mockowane zależności, symetrycznie do `leads-auditor-scope.test.ts` /
 * `availability-self-declaration.test.ts` / `legal-document-consent.test.ts`:
 * `@repo/database`, `next/cache` (`revalidatePath`), `../src/utils/supabase/server`
 * (`getCurrentActorRole`, `getCurrentUser`, `createClient` — jeden moduł fizyczny,
 * mockowany raz, obejmujący też import z `leads/[id]/actions.ts`, cztery poziomy
 * głębiej). `can()` z `@klikklima/contracts` NIE jest mockowane.
 *
 * Ten plik NIE duplikuje bramek roli/fail-closed już zamrożonych w
 * `leads-auditor-scope.test.ts`, `leads-detail-scope.test.ts`,
 * `availability-self-declaration.test.ts`, `legal-document-consent.test.ts` —
 * dopisuje wyłącznie przypadki DUPLIKATU/BRAKU DOPASOWANIA e-maila, których żaden
 * z tych plików nie testuje (dziś każdy z nich mockuje `findUnique` zwracające
 * dokładnie jeden rekord albo `null`, nigdy scenariusz "dwa wiersze").
 */

const {
  leadFindManyMock,
  leadCountMock,
  leadGroupByMock,
  leadFindUniqueMock,
  auditorFindManyMock,
  auditorFindUniqueMock,
  crewFindManyMock,
  crewFindUniqueMock,
  availabilityUpsertMock,
  employeeConsentCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindManyMock: vi.fn(),
  leadCountMock: vi.fn(),
  leadGroupByMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  availabilityUpsertMock: vi.fn(),
  employeeConsentCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      findMany: leadFindManyMock,
      count: leadCountMock,
      groupBy: leadGroupByMock,
      findUnique: leadFindUniqueMock,
    },
    audytorzy: {
      findMany: auditorFindManyMock,
      findUnique: auditorFindUniqueMock,
    },
    zespoly_monterskie: {
      findMany: crewFindManyMock,
      findUnique: crewFindUniqueMock,
    },
    availabilityDeclaration: {
      upsert: availabilityUpsertMock,
    },
    employeeConsent: {
      create: employeeConsentCreateMock,
    },
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

const { getLeads } = await import('../src/app/(dashboard)/leads/actions');
const { getLeadDetail } = await import('../src/app/(dashboard)/leads/[id]/actions');
const {
  setSelfAvailabilityAction: setAuditorAvailability,
  acceptLegalDocumentVersionAction: acceptAuditorConsent,
} = await import('../src/app/(dashboard)/auditors/actions');
const {
  setSelfAvailabilityAction: setCrewAvailability,
  acceptLegalDocumentVersionAction: acceptCrewConsent,
} = await import('../src/app/(dashboard)/crews/actions');

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';
const LEAD_ID = 'lead-1';
const CURRENT_VERSION_ID = 'ldv-rodo-v3';

function mockSessionEmail(email: string | null | undefined) {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } });
}

function fullLeadRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LEAD_ID,
    status: 'AWAITING_AUDIT',
    audytor_id: 'audytor-x',
    created_at: new Date('2026-01-01T10:00:00Z'),
    klient: { id: 'klient-1', imie_i_nazwisko: 'Jan Kowalski', telefon: '600000000', email: 'jan@example.com' },
    adres: { ulica_miasto: 'Testowa 1, Warszawa' },
    ...overrides,
  };
}

beforeEach(() => {
  leadFindManyMock.mockReset();
  leadCountMock.mockReset();
  leadGroupByMock.mockReset();
  leadFindUniqueMock.mockReset();
  auditorFindManyMock.mockReset();
  auditorFindUniqueMock.mockReset();
  crewFindManyMock.mockReset();
  crewFindUniqueMock.mockReset();
  availabilityUpsertMock.mockReset();
  employeeConsentCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  leadFindManyMock.mockResolvedValue([]);
  leadCountMock.mockResolvedValue(0);
  leadGroupByMock.mockResolvedValue([]);
  auditorFindUniqueMock.mockResolvedValue(null);
  crewFindUniqueMock.mockResolvedValue(null);
  // Domyślny zwrot dla dzisiejszej (podatnej) ścieżki, żeby scenariusze duplikatu
  // padały na ASERCJI (kod dziś przechodzi dalej i woła upsert), nie na TypeError
  // z powodu nieskonfigurowanego mocka niżej w łańcuchu.
  availabilityUpsertMock.mockResolvedValue({ isAvailable: false });
});

describe('getLeads() — duplikat/brak dopasowania audytorzy.email (SEC-EMAIL-UNIQUE, miejsce #1)', () => {
  it('AC-A1: dwa wiersze audytorzy o tym samym e-mailu → odmowa, prisma.leady.findMany NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const rowA = { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true };
    const rowB = { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true };
    auditorFindManyMock.mockResolvedValue([rowA, rowB]);
    // Symulacja dzisiejszej podatności: findUnique (kod nienaprawiony) zwraca
    // dowolny z dwóch wierszy i pozwala kontynuować.
    auditorFindUniqueMock.mockResolvedValue(rowA);

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
    expect(leadCountMock).not.toHaveBeenCalled();
    expect(leadGroupByMock).not.toHaveBeenCalled();
  });

  it('AC-A1: bramka pyta findMany z where.email i take:2, nie findUnique', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([
      { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true },
      { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true },
    ]);

    await getLeads();

    expect(auditorFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ email: AUDITOR_EMAIL }), take: 2 }),
    );
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
  });

  it('AC-A5 (regresja): dokładnie jedno dopasowanie — audytor widzi własny zakres bez zmian', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const own = { id: 'audytor-x', email: AUDITOR_EMAIL, is_active: true };
    auditorFindManyMock.mockResolvedValue([own]);
    auditorFindUniqueMock.mockResolvedValue(own);

    await getLeads();

    expect(leadFindManyMock).toHaveBeenCalledTimes(1);
    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where.audytor_id).toBe('audytor-x');
  });

  it('zero dopasowań (konto usunięte) → odmowa, findMany(leady) NIE jest wołane (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([]);

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });

  it('AC-A6: dwa wiersze, ale dopasowany wiersz miałby is_active=false — odmowa niezależnie', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([
      { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: false },
      { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true },
    ]);
    auditorFindUniqueMock.mockResolvedValue({ id: 'audytor-A', email: AUDITOR_EMAIL, is_active: false });

    const result = await getLeads();

    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(leadFindManyMock).not.toHaveBeenCalled();
  });
});

describe('getLeadDetail() — duplikat/brak dopasowania audytorzy.email (SEC-EMAIL-UNIQUE, miejsce #2)', () => {
  it('AC-A2: dwa wiersze audytorzy o tym samym e-mailu → odmowa, prisma.leady.findUnique NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const rowA = { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true };
    const rowB = { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true };
    auditorFindManyMock.mockResolvedValue([rowA, rowB]);
    auditorFindUniqueMock.mockResolvedValue(rowA);

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('lead');
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });

  it('AC-A2: nieodróżnialność — kształt odmowy przy duplikacie tożsamości identyczny jak przy leadzie nieistniejącym', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);

    auditorFindManyMock.mockResolvedValue([
      { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true },
      { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true },
    ]);
    auditorFindUniqueMock.mockResolvedValue({ id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true });
    const duplicateIdentityResult = await getLeadDetail(LEAD_ID);

    auditorFindManyMock.mockResolvedValue([{ id: 'audytor-x', email: AUDITOR_EMAIL, is_active: true }]);
    auditorFindUniqueMock.mockResolvedValue({ id: 'audytor-x', email: AUDITOR_EMAIL, is_active: true });
    leadFindUniqueMock.mockResolvedValue(null);
    const missingLeadResult = await getLeadDetail('nie-istnieje');

    expect(duplicateIdentityResult).toEqual(missingLeadResult);
  });

  it('AC-A5 (regresja): dokładnie jedno dopasowanie — audytor otwierający własny lead widzi go bez zmian', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const own = { id: 'audytor-x', email: AUDITOR_EMAIL, is_active: true };
    auditorFindManyMock.mockResolvedValue([own]);
    auditorFindUniqueMock.mockResolvedValue(own);
    leadFindUniqueMock.mockResolvedValue(fullLeadRecord({ audytor_id: 'audytor-x' }));

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(true);
  });

  it('zero dopasowań → odmowa, findUnique(lead) NIE jest wołane (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([]);

    const result = await getLeadDetail(LEAD_ID);

    expect(result.success).toBe(false);
    expect(leadFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe('setSelfAvailabilityAction (auditors/actions.ts) — duplikat audytorzy.email (SEC-EMAIL-UNIQUE, miejsce #3)', () => {
  it('AC-A3: dwa wiersze, ta sama osoba zdublowana — odmowa, availabilityDeclaration.upsert NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const rowA = { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    const rowB = { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    auditorFindManyMock.mockResolvedValue([rowA, rowB]);
    auditorFindUniqueMock.mockResolvedValue(rowA);

    const result = await setAuditorAvailability('audytor-A', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  it('AC-A3 (wektor eskalacji, punkt 2 z "Przypadki brzegowe"): dwie RÓŻNE osoby o tym samym e-mailu — atakujący podaje id ofiary, findUnique dziś zwróciłoby wiersz ofiary i own.id===id by przeszło; findMany wymusza odmowę', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const attacker = { id: 'audytor-attacker', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    const victim = { id: 'audytor-victim', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    auditorFindManyMock.mockResolvedValue([attacker, victim]);
    // Dziś: findUnique zwraca wiersz OFIARY (kolejność Postgresa bez UNIQUE jest
    // nieokreślona) — stara bramka `own.id !== id` PRZECHODZI, bo own.id === id.
    auditorFindUniqueMock.mockResolvedValue(victim);

    const result = await setAuditorAvailability('audytor-victim', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  it('AC-A5 (regresja): dokładnie jedno dopasowanie — deklaracja własnej dostępności działa bez zmian', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const own = { id: 'audytor-x', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    auditorFindManyMock.mockResolvedValue([own]);
    auditorFindUniqueMock.mockResolvedValue(own);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const result = await setAuditorAvailability('audytor-x', false);

    expect(result.success).toBe(true);
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { auditorId: 'audytor-x' },
      create: { auditorId: 'audytor-x', isAvailable: false },
      update: { isAvailable: false },
    });
  });

  it('zero dopasowań → odmowa, upsert NIE jest wołane (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([]);

    const result = await setAuditorAvailability('cokolwiek', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-SELF
  // D-A (WO FLD-AVAILABILITY-SPLIT, komentarz nad setSelfAvailabilityAction w
  // auditors/actions.ts): ta akcja jest ŚWIADOMIE rozłączna z `is_active`. To NIE
  // jest luka SEC-EMAIL-UNIQUE — blokada administratora (is_active=false) i
  // własna deklaracja niedostępności to dwa różne mechanizmy. Zablokowany audytor
  // nadal może zadeklarować się jako niedostępny; to nie jest ścieżka do
  // odblokowania konta (odblokowanie samo w sobie nie następuje tu w żaden
  // sposób). Poprzednia wersja tego testu (przed naprawą WO SEC-EMAIL-UNIQUE)
  // oczekiwała odmowy — to była błędna instrukcja z Work Orderu, sprzeczna z
  // wcześniejszą, udokumentowaną decyzją D-A. Test poprawiony, żeby potwierdzać
  // właściwe zachowanie zamiast żądać regresji.
  it('AC-A6 / D-A: dopasowany JEDYNY wiersz ma is_active=false — deklaracja własnej dostępności NADAL działa (rozłączność z blokadą administratora)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const own = { id: 'audytor-x', email: AUDITOR_EMAIL, is_active: false, leave_status: 'ACTIVE' };
    auditorFindManyMock.mockResolvedValue([own]);
    auditorFindUniqueMock.mockResolvedValue(own);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const result = await setAuditorAvailability('audytor-x', false);

    expect(result.success).toBe(true);
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { auditorId: 'audytor-x' },
      create: { auditorId: 'audytor-x', isAvailable: false },
      update: { isAvailable: false },
    });
  });
});

describe('setSelfAvailabilityAction (crews/actions.ts) — duplikat zespoly_monterskie.email (SEC-EMAIL-UNIQUE, miejsce #5)', () => {
  it('AC-A3: dwa wiersze, ta sama ekipa zdublowana — odmowa, availabilityDeclaration.upsert NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const rowA = { id: 'crew-A', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    const rowB = { id: 'crew-B', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    crewFindManyMock.mockResolvedValue([rowA, rowB]);
    crewFindUniqueMock.mockResolvedValue(rowA);

    const result = await setCrewAvailability('crew-A', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  it('AC-A3 (wektor eskalacji): dwie RÓŻNE ekipy o tym samym e-mailu — findUnique dziś zwróciłoby wiersz ofiary i own.id===id by przeszło; findMany wymusza odmowę', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const attacker = { id: 'crew-attacker', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    const victim = { id: 'crew-victim', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    crewFindManyMock.mockResolvedValue([attacker, victim]);
    crewFindUniqueMock.mockResolvedValue(victim);

    const result = await setCrewAvailability('crew-victim', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  it('AC-A5 (regresja): dokładnie jedno dopasowanie — deklaracja własnej dostępności ekipy działa bez zmian', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const own = { id: 'crew-x', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    crewFindManyMock.mockResolvedValue([own]);
    crewFindUniqueMock.mockResolvedValue(own);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const result = await setCrewAvailability('crew-x', false);

    expect(result.success).toBe(true);
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { crewId: 'crew-x' },
      create: { crewId: 'crew-x', isAvailable: false },
      update: { isAvailable: false },
    });
  });

  it('zero dopasowań → odmowa, upsert NIE jest wołane (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    crewFindManyMock.mockResolvedValue([]);

    const result = await setCrewAvailability('cokolwiek', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-SELF
  // D-A (WO FLD-AVAILABILITY-SPLIT, komentarz nad setSelfAvailabilityAction w
  // crews/actions.ts): ta akcja jest ŚWIADOMIE rozłączna z `aktywny`. To NIE jest
  // luka SEC-EMAIL-UNIQUE — blokada administratora (aktywny=false) i własna
  // deklaracja niedostępności ekipy to dwa różne mechanizmy. Zablokowana ekipa
  // nadal może zadeklarować się jako niedostępna; to nie jest ścieżka do
  // odblokowania. Poprzednia wersja tego testu (przed naprawą WO
  // SEC-EMAIL-UNIQUE) oczekiwała odmowy — to była błędna instrukcja z Work
  // Orderu, sprzeczna z wcześniejszą, udokumentowaną decyzją D-A. Test poprawiony,
  // żeby potwierdzać właściwe zachowanie zamiast żądać regresji.
  it('AC-A6 / D-A: dopasowany JEDYNY wiersz ma aktywny=false — deklaracja własnej dostępności ekipy NADAL działa (rozłączność z blokadą administratora)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const own = { id: 'crew-x', email: CREW_EMAIL, aktywny: false, leave_status: 'ACTIVE' };
    crewFindManyMock.mockResolvedValue([own]);
    crewFindUniqueMock.mockResolvedValue(own);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const result = await setCrewAvailability('crew-x', false);

    expect(result.success).toBe(true);
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { crewId: 'crew-x' },
      create: { crewId: 'crew-x', isAvailable: false },
      update: { isAvailable: false },
    });
  });
});

describe('acceptLegalDocumentVersionAction (auditors/actions.ts) — duplikat audytorzy.email (SEC-EMAIL-UNIQUE, miejsce #4, najgroźniejsze)', () => {
  it('AC-A4: dwa wiersze o tym samym e-mailu → odmowa, employeeConsent.create NIE jest wołane (zgoda prawna nie zapisuje się na żaden z dwóch wierszy)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const rowA = { id: 'audytor-A', email: AUDITOR_EMAIL, is_active: true };
    const rowB = { id: 'audytor-B', email: AUDITOR_EMAIL, is_active: true };
    auditorFindManyMock.mockResolvedValue([rowA, rowB]);
    // Dziś: findUnique zwraca DOWOLNY z dwóch wierszy i akcja zapisuje zgodę pod
    // niewłaściwym nazwiskiem, bo #4 nie porównuje żadnego id (WO, tabela).
    auditorFindUniqueMock.mockResolvedValue(rowA);

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  it('AC-A5 (regresja): dokładnie jedno dopasowanie — akceptacja dokumentu działa bez zmian', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const own = { id: 'audytor-x', email: AUDITOR_EMAIL, is_active: true };
    auditorFindManyMock.mockResolvedValue([own]);
    auditorFindUniqueMock.mockResolvedValue(own);
    employeeConsentCreateMock.mockResolvedValue({
      id: 'consent-1',
      auditorId: 'audytor-x',
      versionId: CURRENT_VERSION_ID,
      acceptedAt: new Date('2026-09-03T10:00:00Z'),
    });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(true);
    expect(employeeConsentCreateMock).toHaveBeenCalledWith({
      data: { auditorId: 'audytor-x', versionId: CURRENT_VERSION_ID },
    });
  });

  it('zero dopasowań (konto usunięte) → odmowa, create NIE jest wołane (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    auditorFindManyMock.mockResolvedValue([]);

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  it('AC-A6: dopasowany JEDYNY wiersz ma is_active=false — odmowa (dziś ta akcja w ogóle nie sprawdza is_active)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    mockSessionEmail(AUDITOR_EMAIL);
    const own = { id: 'audytor-x', email: AUDITOR_EMAIL, is_active: false };
    auditorFindManyMock.mockResolvedValue([own]);
    auditorFindUniqueMock.mockResolvedValue(own);

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });
});

describe('acceptLegalDocumentVersionAction (crews/actions.ts) — duplikat zespoly_monterskie.email (SEC-EMAIL-UNIQUE, miejsce #6, najgroźniejsze)', () => {
  it('AC-A4: dwa wiersze o tym samym e-mailu → odmowa, employeeConsent.create NIE jest wołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const rowA = { id: 'crew-A', email: CREW_EMAIL, aktywny: true };
    const rowB = { id: 'crew-B', email: CREW_EMAIL, aktywny: true };
    crewFindManyMock.mockResolvedValue([rowA, rowB]);
    crewFindUniqueMock.mockResolvedValue(rowA);

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  it('AC-A5 (regresja): dokładnie jedno dopasowanie — akceptacja dokumentu ekipy działa bez zmian', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const own = { id: 'crew-x', email: CREW_EMAIL, aktywny: true };
    crewFindManyMock.mockResolvedValue([own]);
    crewFindUniqueMock.mockResolvedValue(own);
    employeeConsentCreateMock.mockResolvedValue({
      id: 'consent-crew-1',
      crewId: 'crew-x',
      versionId: CURRENT_VERSION_ID,
      acceptedAt: new Date('2026-09-03T11:00:00Z'),
    });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(true);
    expect(employeeConsentCreateMock).toHaveBeenCalledWith({
      data: { crewId: 'crew-x', versionId: CURRENT_VERSION_ID },
    });
  });

  it('zero dopasowań (konto usunięte) → odmowa, create NIE jest wołane (zachowanie bez zmian)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    crewFindManyMock.mockResolvedValue([]);

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  it('AC-A6: dopasowany JEDYNY wiersz ma aktywny=false — odmowa (dziś ta akcja w ogóle nie sprawdza aktywny)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    mockSessionEmail(CREW_EMAIL);
    const own = { id: 'crew-x', email: CREW_EMAIL, aktywny: false };
    crewFindManyMock.mockResolvedValue([own]);
    crewFindUniqueMock.mockResolvedValue(own);

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });
});
