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
  auditorFindUniqueMock,
  auditorUpdateMock,
  crewFindUniqueMock,
  crewUpdateMock,
  availabilityUpsertMock,
  availabilityDeleteMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  availabilityUpsertMock: vi.fn(),
  availabilityDeleteMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findUnique: auditorFindUniqueMock,
      update: auditorUpdateMock,
    },
    zespoly_monterskie: {
      findUnique: crewFindUniqueMock,
      update: crewUpdateMock,
    },
    availabilityDeclaration: {
      upsert: availabilityUpsertMock,
      delete: availabilityDeleteMock,
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

const { setSelfAvailabilityAction: setAuditorAvailability } = await import(
  '../src/app/(dashboard)/auditors/actions'
);
const { setSelfAvailabilityAction: setCrewAvailability } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';

beforeEach(() => {
  auditorFindUniqueMock.mockReset();
  auditorUpdateMock.mockReset();
  crewFindUniqueMock.mockReset();
  crewUpdateMock.mockReset();
  availabilityUpsertMock.mockReset();
  availabilityDeleteMock.mockReset();
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
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });
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
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });
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
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' });
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
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' });
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
