import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLES, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md (ROZSTRZYGNIĘTY 2026-09-16,
 * D1/D2/D3 zamknięte przez Michała). Wymaganie wiodące: `FNL-2PHASE-BOOKING`
 * (contracts/requirements.contract.mjs:164, TODO, HIGH), kryteria 3, 4, 5, 6.
 * Zawężona lista przypadków testowych (WO, ostatnia sekcja) — TEN plik pokrywa
 * obszary 3 (blokada etapu II), 4 (koszyki), 5 (bookings_one_active_per_subject
 * jako druga warstwa) i AC7 (preferencja ekipy, kryt. 6, wiring na poziomie akcji —
 * dowód na `createBooking` samym żyje w `fnl-2phase-create-booking-preference.test.ts`).
 *
 * ═══ KONTRAKT Z IMPLEMENTER-SERVER (decyzja test-authora, TEST-DEFECT jeśli kształt
 * inny) ═══
 *
 * Nowy plik `apps/b2b-web/src/app/(dashboard)/installations/two-phase-actions.ts`
 * ("use server"), eksport:
 *
 *   export async function bookPhaseTwoAction(input: {
 *     installationId: string
 *     visitBasketId: string
 *     startAt: Date
 *   }): Promise<CreateBookingResult>   // CreateBookingResult z "@repo/scheduling"
 *
 * Kolejność (identyczna z `createBookingAction` w `bookings/actions.ts`, AC-A12):
 *   1. `getCurrentActorRole()` -> `can(rola, 'bookings', 'create')` — odmowa PRZED
 *      jakimkolwiek zapytaniem (rbac.contract.mjs:64: create -> ['admin','dyspozytor']).
 *   2. Walidacja Zod wejścia.
 *   3. Odczyt `installation_phases` WHERE installationId + phaseNumber=1. Brak wiersza
 *      albo `completedAt === null` -> odmowa AC3, kod `PHASE_ONE_NOT_COMPLETED`, ZERO
 *      wywołania `createBooking` (bez skutku ubocznego — WO, AC3 dosłownie).
 *   4. Odczyt `instalacje.leadId` dla `installationId` (podmiot rezerwacji = LEAD,
 *      Booking.leadId — patrz R2 w WO, `bookings` nie ma kolumny `installation_id`).
 *   5. Preferencja ekipy (AC7/kryt. 6, "preselekcja po stronie wołającego" — reguła D-1
 *      w `orderCandidates` NIETKNIĘTA): `preferredResourceId` = crewId rezerwacji etapu I
 *      (przez `installationPhase.booking.crewId`), przekazywany jako NOWE, OPCJONALNE
 *      pole `CreateBookingParams.preferredResourceId` do `createBooking` z
 *      "@repo/scheduling" — patrz kontrakt w `fnl-2phase-create-booking-preference.test.ts`.
 *      NIE filtruje puli, NIE wymusza odmowy, gdy ekipa niedostępna — to WYŁĄCZNIE
 *      preselekcja.
 *   6. `createBooking({ visitBasketId, startAt, subject: { kind: 'LEAD', leadId },
 *      bookedBy: 'DISPATCHER', preferredResourceId })`.
 *   7. Na sukces: `installation_phases` WHERE installationId + phaseNumber=2 dostaje
 *      `bookingId = booking.id` (AC1/AC2: booking_id etapu II wskazuje TĘ rezerwację,
 *      nie etapu I).
 *
 * Stan zmierzony 2026-09-16: `grep -rn "two-phase-actions" apps/b2b-web/src/` —
 * zero wyników. Ten import ma się wywalić brakiem modułu (RED poprawny).
 */

const {
  installationPhaseFindUniqueMock,
  installationPhaseUpdateMock,
  createBookingMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  installationPhaseFindUniqueMock: vi.fn(),
  installationPhaseUpdateMock: vi.fn(),
  createBookingMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    installationPhase: {
      findUnique: installationPhaseFindUniqueMock,
      update: installationPhaseUpdateMock,
    },
  },
}));
vi.mock('@repo/scheduling', () => ({
  createBooking: createBookingMock,
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { bookPhaseTwoAction } = await import(
  '../src/app/(dashboard)/installations/two-phase-actions'
);

const INSTALLATION_ID = 'install-1';
const LEAD_ID = 'lead-1';
const PHASE_ONE_CREW_ID = 'crew-phase1';

function phaseOneRow(overrides: Partial<{ completedAt: Date | null; crewId: string | null }> = {}) {
  return {
    id: 'phase-1',
    installationId: INSTALLATION_ID,
    phaseNumber: 1,
    completedAt: overrides.completedAt === undefined ? new Date('2026-09-01T10:00:00Z') : overrides.completedAt,
    bookingId: 'booking-phase-1',
    booking: { crewId: overrides.crewId === undefined ? PHASE_ONE_CREW_ID : overrides.crewId },
    installation: { leadId: LEAD_ID },
  };
}

const VALID_INPUT = {
  installationId: INSTALLATION_ID,
  visitBasketId: 'basket-phase-2',
  startAt: new Date('2026-10-15T08:00:00Z'),
};

const successBooking = (crewId: string) => ({
  ok: true as const,
  error: null,
  booking: {
    id: 'booking-phase-2',
    leadId: LEAD_ID,
    serviceId: null,
    incidentId: null,
    auditorId: null,
    crewId,
    resourceKind: 'CREW',
    visitBasketId: VALID_INPUT.visitBasketId,
    scheduledStart: VALID_INPUT.startAt,
    scheduledEnd: new Date(VALID_INPUT.startAt.getTime() + 240 * 60000),
    status: 'RESERVED',
    bookedBy: 'DISPATCHER',
    assignmentMode: 'AUTO',
  },
});

beforeEach(() => {
  installationPhaseFindUniqueMock.mockReset();
  installationPhaseUpdateMock.mockReset();
  createBookingMock.mockReset();
  getCurrentActorRoleMock.mockReset();

  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  installationPhaseFindUniqueMock.mockResolvedValue(phaseOneRow());
  createBookingMock.mockResolvedValue(successBooking(PHASE_ONE_CREW_ID));
  installationPhaseUpdateMock.mockResolvedValue({});
});

// ═══ Obszar 3 — blokada etapu II przed zamknięciem etapu I (AC3, sedno WO) ═══

describe('bookPhaseTwoAction — AC3, etap II niemożliwy przed zamknięciem etapu I', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('etap 1 nieznaleziony (installation_phases brak wiersza) -> odmowa domenowa, ZERO wywołania createBooking', async () => {
    installationPhaseFindUniqueMock.mockResolvedValue(null);

    const result = await bookPhaseTwoAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).not.toBe('SLOT_TAKEN'); // to nie jest błąd silnika, to guard
    expect(createBookingMock).not.toHaveBeenCalled();
  });

  // @REQ: FNL-2PHASE-BOOKING
  it('etap 1 istnieje, ale completedAt IS NULL -> odmowa czytelnym kodem, nie 500, nie cichy sukces', async () => {
    installationPhaseFindUniqueMock.mockResolvedValue(phaseOneRow({ completedAt: null }));

    const result = await bookPhaseTwoAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(typeof result.error.code).toBe('string');
    expect(result.error.code.length).toBeGreaterThan(0);
    expect(createBookingMock).not.toHaveBeenCalled();
  });

  // AC3 dosłownie: "po odmowie phase_number=2 nadal ma booking_id IS NULL — odmowa bez
  // skutku ubocznego". Sprawdzamy, że żaden update etapu 2 nie jest wołany.
  // @REQ: FNL-2PHASE-BOOKING
  it('odmowa (etap 1 niezamknięty) nie ustawia booking_id na etapie 2 — brak skutku ubocznego', async () => {
    installationPhaseFindUniqueMock.mockResolvedValue(phaseOneRow({ completedAt: null }));

    await bookPhaseTwoAction(VALID_INPUT);

    expect(installationPhaseUpdateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: etap 1 zamknięty -> createBooking JEST wołane.
  // @REQ: FNL-2PHASE-BOOKING
  it('etap 1 zamknięty (completedAt niepuste) -> createBooking wołane, sukces', async () => {
    const result = await bookPhaseTwoAction(VALID_INPUT);

    expect(result.ok).toBe(true);
    expect(createBookingMock).toHaveBeenCalledTimes(1);
  });

  // AC1/AC2: sukces linkuje booking_id NOWEJ rezerwacji do etapu 2, nie do etapu 1.
  // @REQ: FNL-2PHASE-BOOKING
  it('sukces ustawia installation_phases(phaseNumber=2).booking_id na ID nowej rezerwacji', async () => {
    await bookPhaseTwoAction(VALID_INPUT);

    expect(installationPhaseUpdateMock).toHaveBeenCalledTimes(1);
    const call = installationPhaseUpdateMock.mock.calls[0]![0];
    expect(call.where).toMatchObject({
      installationId_phaseNumber: { installationId: INSTALLATION_ID, phaseNumber: 2 },
    });
    expect(call.data).toMatchObject({ bookingId: 'booking-phase-2' });
  });
});

// ═══ Obszar 5 — bookings_one_active_per_subject jako DRUGA warstwa obrony (AC3, R3) ═══

describe('bookPhaseTwoAction — druga warstwa obrony (SUBJECT_ALREADY_BOOKED z createBooking)', () => {
  // WO, AC3: "próba ominięcia Server Action i wstawienia wiersza wprost odbija się od
  // indeksu" — tutaj dowodzimy, że GDY warstwa aplikacyjna (guard etapu 1) przepuści
  // wywołanie (etap 1 zamknięty), a mimo to podmiot ma jeszcze aktywną rezerwację
  // (np. rezerwacja etapu I nie została poprawnie przełączona na COMPLETED — R3),
  // `createBooking` zwraca kod domenowy SUBJECT_ALREADY_BOOKED i `bookPhaseTwoAction`
  // PRZEPUSZCZA go bez przykrycia własnym komunikatem ani bez traktowania jako sukces.
  // @REQ: FNL-2PHASE-BOOKING
  it('SUBJECT_ALREADY_BOOKED z createBooking (R3 — rezerwacja etapu I nie zeszła z RESERVED/CONFIRMED) propagowany jako odmowa', async () => {
    createBookingMock.mockResolvedValue({
      ok: false,
      booking: null,
      error: { code: 'SUBJECT_ALREADY_BOOKED', message: 'x', alternatives: [], existingBooking: null },
    });

    const result = await bookPhaseTwoAction(VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('SUBJECT_ALREADY_BOOKED');
    // Odmowa z silnika -> zero linkowania booking_id do etapu 2.
    expect(installationPhaseUpdateMock).not.toHaveBeenCalled();
  });
});

// ═══ AC5 — etap II jest zwykłą ścieżką lejka, D2: BRAK minimalnej przerwy ═══

describe('bookPhaseTwoAction — AC5, D2 (brak minimalnej przerwy międzyetapowej)', () => {
  // D2 (decyzja Michała 2026-09-16): rezerwacja etapu II NAZAJUTRZ po zamknięciu etapu I
  // KOŃCZY SIĘ SUKCESEM — dowód negatywny, że nie ma progu.
  // @REQ: FNL-2PHASE-BOOKING
  it('etap I zamknięty WCZORAJ, rezerwacja etapu II na JUTRO (od "teraz") kończy się sukcesem — brak progu przerwy', async () => {
    const now = new Date('2026-09-16T00:00:00Z');
    installationPhaseFindUniqueMock.mockResolvedValue(
      phaseOneRow({ completedAt: new Date('2026-09-15T10:00:00Z') }),
    );
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60000);

    const result = await bookPhaseTwoAction({ ...VALID_INPUT, startAt: tomorrow });

    expect(result.ok).toBe(true);
    expect(createBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({ startAt: tomorrow }),
    );
  });

  // Test STATYCZNY: `bookPhaseTwoAction` nie odczytuje daty zamknięcia etapu I przy
  // budowaniu wywołania createBooking (AC5, "wyszukiwanie terminów dla etapu II nie
  // odwołuje się w żaden sposób do daty etapu I"). Sprawdzamy, że `startAt` przekazany
  // do createBooking jest TOŻSAMOŚCIOWO (===) tym z wejścia, niezależnie od completedAt.
  // @REQ: FNL-2PHASE-BOOKING
  it('startAt przekazany do createBooking jest identyczny z wejściem, niezależnie od completedAt etapu I', async () => {
    installationPhaseFindUniqueMock.mockResolvedValue(
      phaseOneRow({ completedAt: new Date('2020-01-01T00:00:00Z') }),
    );
    await bookPhaseTwoAction(VALID_INPUT);
    const call = createBookingMock.mock.calls[0]![0];
    expect(call.startAt).toBe(VALID_INPUT.startAt);
  });
});

// ═══ AC6 — koszyk etapu II pochodzi ze słownika, nie z literału ═══

describe('bookPhaseTwoAction — AC6, koszyk etapu II', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('visitBasketId z wejścia jest przekazany do createBooking bez zmiany (dowolna wartość — nie literał INSTALL_PHASE_2 zaszyty w akcji)', async () => {
    const arbitraryBasketId = 'basket-arbitrary-xyz';
    await bookPhaseTwoAction({ ...VALID_INPUT, visitBasketId: arbitraryBasketId });
    const call = createBookingMock.mock.calls[0]![0];
    expect(call.visitBasketId).toBe(arbitraryBasketId);
  });
});

// Test statyczny (AC5/AC6, kontrola negatywna): koszyk "montaż duży = 2 dni" świadomie
// NIE ISTNIEJE w słowniku i silnik nie ma ścieżki szukającej dwóch sąsiadujących dni.
// @REQ: FNL-2PHASE-BOOKING
describe('Test statyczny — brak koszyka dwudniowego, brak wyszukiwania sąsiadujących dni', () => {
  it('seed migracji kalendarza NIE zawiera koszyka "montaż duży"/2-dniowego', () => {
    const migrationPath = join(
      __dirname,
      '../../../supabase/migrations/20260910100000_fld_calendar_foundation.sql',
    );
    const sql = readFileSync(migrationPath, 'utf-8');
    // TEST-DEFECT (naprawione): plik migracji LEGALNIE zawiera frazę "montaż duży"
    // w prozie komentarza dokumentacyjnego (korekta 2026-09-10), właśnie po to, żeby
    // udokumentować BRAK takiego koszyka — sprawdzanie całego pliku pod tę frazę
    // było niewykonalne wobec własnej, poprawnej treści migracji. Intencja testu
    // (dowód, że koszyk NIE ISTNIEJE) jest w pełni pokryta przez sprawdzenie
    // identyfikatora/kodu koszyka poniżej — nie trzeba duplikować jej na poziomie prozy.
    expect(sql).not.toMatch(/INSTALL_(BIG|LARGE|2DAY|DWUDNIOWY)/i);
  });

  it('packages/scheduling/src nie zawiera funkcji/identyfikatora szukającego sąsiadujących dni', () => {
    const createBookingPath = join(__dirname, '../../../packages/scheduling/src/create-booking.ts');
    const src = readFileSync(createBookingPath, 'utf-8');
    expect(src).not.toMatch(/adjacent[_ ]?day/i);
    expect(src).not.toMatch(/sasiaduj|sąsiaduj/i);
    expect(src).not.toMatch(/two[_-]?day/i);
  });
});

// ═══ AC7 (kryt. 6) — ta sama ekipa to preferencja, nie warunek (wiring na poziomie akcji) ═══

describe('bookPhaseTwoAction — AC7, preselekcja ekipy etapu I (kryt. 6)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('crewId rezerwacji etapu I jest przekazany do createBooking jako preferredResourceId', async () => {
    installationPhaseFindUniqueMock.mockResolvedValue(phaseOneRow({ crewId: 'crew-preferred' }));
    await bookPhaseTwoAction(VALID_INPUT);
    const call = createBookingMock.mock.calls[0]![0];
    expect(call.preferredResourceId).toBe('crew-preferred');
  });

  // Brak ekipy na etapie I (np. rezerwacja etapu I bez crewId zapisanego z jakiegoś
  // powodu) -> preselekcja jest pominięta (undefined/null), rezerwacja NIE odmawia.
  // @REQ: FNL-2PHASE-BOOKING
  it('brak crewId na rezerwacji etapu I -> preferredResourceId puste, rezerwacja etapu II i tak się udaje', async () => {
    installationPhaseFindUniqueMock.mockResolvedValue(phaseOneRow({ crewId: null }));
    const result = await bookPhaseTwoAction(VALID_INPUT);
    expect(result.ok).toBe(true);
    const call = createBookingMock.mock.calls[0]![0];
    expect(call.preferredResourceId == null).toBe(true);
  });
});

// ═══ Uprawnienia (brzeg 5 WO, po D3) ═══

describe('bookPhaseTwoAction — uprawnienia (brzeg 5, D3: dyspozytor/admin dozwoleni, monter/audytor odmowa)', () => {
  const DENIED_ROLES = ROLES.filter((r) => can(r, 'bookings', 'create') !== 'yes');
  const ALLOWED_ROLES = ROLES.filter((r) => can(r, 'bookings', 'create') === 'yes');

  // @REQ: FNL-2PHASE-BOOKING
  it.each(DENIED_ROLES)('rola %s odmówiona fail-closed, zero odczytu installation_phases', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const result = await bookPhaseTwoAction(VALID_INPUT);
    expect(result.ok).toBe(false);
    expect(installationPhaseFindUniqueMock).not.toHaveBeenCalled();
    expect(createBookingMock).not.toHaveBeenCalled();
  });

  // @REQ: FNL-2PHASE-BOOKING
  it.each(ALLOWED_ROLES)('rola %s (dyspozytor/admin) przechodzi bramkę', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const result = await bookPhaseTwoAction(VALID_INPUT);
    expect(result.ok).toBe(true);
  });

  // @REQ: FNL-2PHASE-BOOKING
  it('brak roli (sesja nieznana) jest odmową, nie wyjątkiem', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    const result = await bookPhaseTwoAction(VALID_INPUT);
    expect(result.ok).toBe(false);
  });
});
