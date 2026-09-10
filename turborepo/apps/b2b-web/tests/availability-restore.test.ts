import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/FLD-AVAILABILITY-SPLIT.md — FLD-AVAIL-RESTORE.
 * Wymaganie (contracts/requirements.contract.mjs, R('FLD-AVAIL-RESTORE', ...)):
 *   "Powrót pracownika do statusu dostępnego przywraca wcześniej wprowadzoną
 *   dostępność bez ponownego jej wprowadzania (D3)."
 * Kryteria (cytat z kontraktu):
 *   - "Test ustawia dostępność, przełącza pracownika na niedostępnego, wraca i
 *     sprawdza, że odczytana dostępność jest identyczna z wprowadzoną (AC5)"
 *   - "Deklaracja niedostępności jest przesłonięciem, a nie edycją danych źródłowych:
 *     zapis is_available = false nie kasuje i nie modyfikuje żadnego innego zapisu
 *     dostępności"
 *   - "Schemat świadomie NIE przechowuje kopii «poprzedniej wartości» w osobnej
 *     kolumnie" — AvailabilityDeclaration ma JEDNĄ kolumnę `isAvailable` (boolean),
 *     zweryfikowane czytaniem schema.prisma (linia ok. 378). "Przywrócenie" w tym
 *     zakresie NIE oznacza granularnego harmonogramu (faza 4, poza zakresem WO) —
 *     oznacza wyłącznie: powtórny zapis tej samej wartości daje ten sam odczyt, i nic
 *     po drodze nie zostało naruszone.
 *   - "Moment ostatniej zmiany deklaracji jest znacznikiem technicznym (updated_at,
 *     timestamptz) i nie wyznacza granicy doby roboczej pracownika" — NIETESTOWALNE
 *     na tym etapie i CELOWO pominięte: dziś nie istnieje ŻADEN kod (poza samym
 *     schema.prisma, który sam siebie nie może naruszyć), który czytałby
 *     `availability_declarations.updated_at` do wyznaczenia granicy doby. Napisanie
 *     testu przeciwko nieistniejącemu konsumentowi dałoby test zielony od pierwszej
 *     chwili (bo nie ma czego czerwienić) — dokładnie ten rodzaj testu, którego ta
 *     rola ma unikać. Gdy powstanie pierwszy kod liczący granicę doby roboczej
 *     (prawdopodobnie razem z availability_rules, faza 4), WTEDY ten punkt dostaje
 *     właściwy, czerwieniący się test — nie wcześniej.
 *
 * Reużywa Server Action i mocków z availability-self-declaration.test.ts
 * (`setSelfAvailabilityAction` w auditors/actions.ts i crews/actions.ts — ta sama
 * ustalona tam nazwa/lokalizacja, to jest jeden kontrakt, nie dwa).
 */

const {
  auditorFindManyMock,
  auditorUpdateMock,
  crewFindManyMock,
  crewUpdateMock,
  availabilityUpsertMock,
  availabilityDeleteMock,
  availabilityRuleCreateMock,
  availabilityRuleUpdateMock,
  availabilityRuleUpsertMock,
  availabilityRuleDeleteMock,
  availabilityRuleDeleteManyMock,
  queryRawMock,
  executeRawMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  availabilityUpsertMock: vi.fn(),
  availabilityDeleteMock: vi.fn(),
  // FLD-AVAIL-WEEKLY-RULES AC (kryterium wyniesione z FLD-AVAIL-RESTORE): przełącznik
  // is_available (ten plik) nie może ruszać availability_rules — dowód poniżej wymaga
  // mocków na WSZYSTKIE mutujące metody modelu i na obie ścieżki raw SQL, bo tabela
  // istnieje fizycznie tylko przez `prisma.$queryRaw`/`$executeRaw` (kolumna generowana
  // `resource_id`, patrz availability-rules-weekly.test.ts).
  availabilityRuleCreateMock: vi.fn(),
  availabilityRuleUpdateMock: vi.fn(),
  availabilityRuleUpsertMock: vi.fn(),
  availabilityRuleDeleteMock: vi.fn(),
  availabilityRuleDeleteManyMock: vi.fn(),
  queryRawMock: vi.fn(),
  executeRawMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

// SEC-EMAIL-UNIQUE (Faza A, implementer-server): tożsamość "własnego" rekordu idzie
// dziś przez `findMany({ where: { email }, take: 2 })`, nie `findUnique` — email już
// nie jest unikalny (auditors/actions.ts:143, crews/actions.ts:133).
vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findMany: auditorFindManyMock,
      update: auditorUpdateMock,
    },
    zespoly_monterskie: {
      findMany: crewFindManyMock,
      update: crewUpdateMock,
    },
    availabilityDeclaration: {
      upsert: availabilityUpsertMock,
      delete: availabilityDeleteMock,
    },
    availabilityRule: {
      create: availabilityRuleCreateMock,
      update: availabilityRuleUpdateMock,
      upsert: availabilityRuleUpsertMock,
      delete: availabilityRuleDeleteMock,
      deleteMany: availabilityRuleDeleteManyMock,
    },
    $queryRaw: queryRawMock,
    $executeRaw: executeRawMock,
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

const { setSelfAvailabilityAction: setAuditorAvailability } = await import(
  '../src/app/(dashboard)/auditors/actions'
);
const { setSelfAvailabilityAction: setCrewAvailability } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';

beforeEach(() => {
  auditorFindManyMock.mockReset();
  auditorUpdateMock.mockReset();
  crewFindManyMock.mockReset();
  crewUpdateMock.mockReset();
  availabilityUpsertMock.mockReset();
  availabilityDeleteMock.mockReset();
  availabilityRuleCreateMock.mockReset();
  availabilityRuleUpdateMock.mockReset();
  availabilityRuleUpsertMock.mockReset();
  availabilityRuleDeleteMock.mockReset();
  availabilityRuleDeleteManyMock.mockReset();
  queryRawMock.mockReset();
  executeRawMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('setSelfAvailabilityAction — powrót do dostępności po przełączeniu (FLD-AVAIL-RESTORE, audytor)', () => {
  // MAJOR (REVIEW #1, iteracja 2/3): oryginalna wersja porównywała `initial.isAvailable`
  // z `restored.isAvailable` — obie wartości pochodziły z `mockResolvedValueOnce`
  // WSTRZYKNIĘTEGO przez sam test, więc akcja jedynie je przepisywała; asercja była
  // prawdziwa nawet dla implementacji, która nie wysyła NICZEGO do bazy. Dowód musi
  // siedzieć w PAYLOADZIE wysłanym do `upsert` w każdym z trzech wywołań (kształt
  // zweryfikowany czytaniem auditors/actions.ts:122-126 — `update.isAvailable` niesie
  // wartość niezależnie od tego, czy Prisma wybierze gałąź create czy update, bo akcja
  // wysyła obie naraz), nie w wartości zwrotnej mocka.
  // @REQ: FLD-AVAIL-RESTORE
  it('AC5 — ustawienie dostępności, przełączenie na niedostępny, powrót: sekwencja payloadów wysłanych do upsert to [true, false, true]', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindManyMock.mockResolvedValue([{ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' }]);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await setAuditorAvailability('aud-1', true);
    await setAuditorAvailability('aud-1', false);
    await setAuditorAvailability('aud-1', true);

    expect(
      availabilityUpsertMock.mock.calls.map((call) => call[0].update.isAvailable),
    ).toEqual([true, false, true]);
    // Przesłonięcie, nie kasowanie (D3/AC5) — powrót nie usuwa i nie zakłada nowego wiersza.
    expect(availabilityDeleteMock).not.toHaveBeenCalled();
  });

  // Deklaracja to przesłonięcie, nie edycja/kasowanie danych źródłowych — `delete`
  // nigdy nie jest wywoływany, a zapis zawsze celuje w TEN SAM wiersz (auditorId
  // niezmienny), nie tworzy nowego niezależnego rekordu.
  // @REQ: FLD-AVAIL-RESTORE
  it('ustawienie niedostępności nie kasuje i nie tworzy nowego, niezależnego zapisu dostępności', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindManyMock.mockResolvedValue([{ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' }]);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await setAuditorAvailability('aud-1', false);

    expect(availabilityDeleteMock).not.toHaveBeenCalled();
    // BLOCKER 1 (REVIEW #1, iteracja 2/3) — pełne dopasowanie payloadu, nie tylko `where`
    // (jak w availability-self-declaration.test.ts AC3).
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { auditorId: 'aud-1' },
      create: { auditorId: 'aud-1', isAvailable: false },
      update: { isAvailable: false },
    });
  });
});

describe('setSelfAvailabilityAction — powrót do dostępności po przełączeniu (FLD-AVAIL-RESTORE, ekipa — R3)', () => {
  // MAJOR (REVIEW #1, iteracja 2/3) — analogicznie do wariantu audytora powyżej: dowód
  // sekwencji payloadów wysłanych do `upsert` (crews/actions.ts:93-97), nie wartości
  // zwrotnych mocka.
  // @REQ: FLD-AVAIL-RESTORE
  it('AC5 — to samo dla zespoly_monterskie: sekwencja payloadów wysłanych do upsert to [true, false, true]', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindManyMock.mockResolvedValue([{ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' }]);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await setCrewAvailability('crew-1', true);
    await setCrewAvailability('crew-1', false);
    await setCrewAvailability('crew-1', true);

    expect(
      availabilityUpsertMock.mock.calls.map((call) => call[0].update.isAvailable),
    ).toEqual([true, false, true]);
    expect(availabilityDeleteMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-RESTORE
  it('ustawienie niedostępności ekipy nie kasuje istniejącego zapisu dostępności', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindManyMock.mockResolvedValue([{ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' }]);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await setCrewAvailability('crew-1', false);

    expect(availabilityDeleteMock).not.toHaveBeenCalled();
    // BLOCKER 1 (REVIEW #1, iteracja 2/3) — pełne dopasowanie payloadu.
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { crewId: 'crew-1' },
      create: { crewId: 'crew-1', isAvailable: false },
      update: { isAvailable: false },
    });
  });
});

describe('setSelfAvailabilityAction — przełącznik nie modyfikuje availability_rules (FLD-AVAIL-WEEKLY-RULES / FLD-AVAIL-RESTORE)', () => {
  // Kierunek ODWROTNY do AC-A11 w availability-rules-weekly.test.ts (tamten dowodzi, że
  // zapis GRAFIKU nie rusza availability_declarations; ten dowodzi symetrii: zapis
  // PRZEŁĄCZNIKA nie rusza availability_rules). Kontrakt (FLD-AVAIL-WEEKLY-RULES, AC
  // dopisane 2026-09-10): "Reguły są danymi ŹRÓDŁOWYMI: przełącznik «jestem teraz
  // niedostępny» (FLD-AVAIL-RESTORE) ich nie modyfikuje, tylko przesłania." Doprecyzowanie
  // w samym FLD-AVAIL-RESTORE (2026-09-10) każe sprawdzić WSZYSTKIE mutujące metody
  // modelu availabilityRule oraz obie ścieżki raw SQL, bo tabela żyje fizycznie tylko
  // przez $queryRaw/$executeRaw (resource_id jest kolumną generowaną — patrz
  // availability-rules-weekly.test.ts, komentarz nad writeAvailabilityRuleRaw).
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  // @REQ: FLD-AVAIL-RESTORE
  it('audytor: przełączenie niedostępny -> dostępny -> niedostępny nie wywołuje ani jednej mutacji na availabilityRule ani raw SQL na availability_rules', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindManyMock.mockResolvedValue([{ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' }]);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await setAuditorAvailability('aud-1', false);
    await setAuditorAvailability('aud-1', true);
    await setAuditorAvailability('aud-1', false);

    expect(availabilityRuleCreateMock).not.toHaveBeenCalled();
    expect(availabilityRuleUpdateMock).not.toHaveBeenCalled();
    expect(availabilityRuleUpsertMock).not.toHaveBeenCalled();
    expect(availabilityRuleDeleteMock).not.toHaveBeenCalled();
    expect(availabilityRuleDeleteManyMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  // @REQ: FLD-AVAIL-RESTORE
  it('ekipa (zespoly_monterskie): przełączenie niedostępny -> dostępny -> niedostępny nie wywołuje ani jednej mutacji na availabilityRule ani raw SQL na availability_rules', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindManyMock.mockResolvedValue([{ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' }]);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await setCrewAvailability('crew-1', false);
    await setCrewAvailability('crew-1', true);
    await setCrewAvailability('crew-1', false);

    expect(availabilityRuleCreateMock).not.toHaveBeenCalled();
    expect(availabilityRuleUpdateMock).not.toHaveBeenCalled();
    expect(availabilityRuleUpsertMock).not.toHaveBeenCalled();
    expect(availabilityRuleDeleteMock).not.toHaveBeenCalled();
    expect(availabilityRuleDeleteManyMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();
  });
});
