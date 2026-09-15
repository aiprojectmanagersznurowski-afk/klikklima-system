import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';
import { SLA } from '@klikklima/contracts';

/**
 * WO: docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md — Faza A (automat, assignment_mode='AUTO').
 * Wymaganie FLD-BOOKING-ATOMIC-ASSIGN (contracts/requirements.contract.mjs:673), 12 kryteriów
 * AC-A1..AC-A12.
 *
 * Rozstrzygnięcia Michała 2026-09-10 (wpisane do WO jako ostateczne):
 *   D-1 = wariant (a): przy >1 wolnym kandydacie wygrywa NAJMNIEJSZA liczba rezerwacji w danej
 *   dobie LOKALNEJ (Europe/Warsaw), remis po `id` rosnąco.
 *   D-2 = zbudowana infrastruktura CI z Postgresem — test WSPÓŁBIEŻNOŚCI (AC-A4/AC-A5) jest
 *   OSOBNYM plikiem `create-booking-concurrency.itest.ts` na żywym Postgresie. TEN plik dowodzi
 *   wyłącznie tego, co da się dowieść na atrapie Prismy (WO, sekcja "Zadanie 1").
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM (WO, "Kolejność ról" pkt 3): sygnatura z sekcji
 * "Proponowana sygnatura" WO jest kontraktem — inny kształt wybrany przez implementera to
 * TEST-DEFECT do zgłoszenia, nie powód do cichej zmiany testu.
 *
 * Stan zmierzony 2026-09-10: `apps/b2b-web/src/lib/schedule/create-booking.ts` i
 * `apps/b2b-web/src/app/(dashboard)/bookings/actions.ts` NIE ISTNIEJĄ. Ten import ma się
 * wywalić brakiem modułu — to jest poprawny stan RED tej tury (WO, "Weryfikacja").
 *
 * R-3 (WO, "Ryzyka i nieznane"): kod błędu 23P01/23514 z Postgresa nie ma w tym repo
 * precedensu odczytu przez Prismę. Ten plik NIE zakłada jednego konkretnego kształtu —
 * testuje DWA plauzybilne kształty (patrz `exclusionViolationError`/`poolMismatchError`
 * niżej) i wymaga, żeby `createBooking` rozpoznawał oba, bo `meta.code`/tekst komunikatu są
 * jedynym miejscem, gdzie prawdziwy SQLSTATE się ukrywa (P2002 nie jest tu poprawnym mapowaniem —
 * to nie jest zwykłe naruszenie UNIQUE).
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

const FIXED_NOW = new Date('2026-01-01T00:00:00Z');

const {
  availabilityRuleFindManyMock,
  systemConfigFindUniqueMock,
  auditorFindManyMock,
  crewFindManyMock,
  bookingFindManyMock,
  bookingCreateMock,
  absenceFindManyMock,
  visitDurationBasketQueryMock,
  availabilityDeclarationFindManyMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  availabilityRuleFindManyMock: vi.fn(),
  systemConfigFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  bookingFindManyMock: vi.fn(),
  bookingCreateMock: vi.fn(),
  absenceFindManyMock: vi.fn(),
  visitDurationBasketQueryMock: vi.fn(),
  availabilityDeclarationFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    availabilityRule: { findMany: availabilityRuleFindManyMock },
    system_config: { findUnique: systemConfigFindUniqueMock },
    audytorzy: { findMany: auditorFindManyMock },
    zespoly_monterskie: { findMany: crewFindManyMock },
    booking: { findMany: bookingFindManyMock, create: bookingCreateMock },
    absence: { findMany: absenceFindManyMock },
    visitDurationBasket: { findUnique: visitDurationBasketQueryMock, findFirst: visitDurationBasketQueryMock },
    availabilityDeclaration: { findMany: availabilityDeclarationFindManyMock },
  },
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { createBooking } = await import('@repo/scheduling');
const { createBookingAction } = await import('../src/app/(dashboard)/bookings/actions');

function basketRow(
  overrides: Partial<{ id: string; code: string; durationMinutes: number; pool: string; isActive: boolean }> = {},
) {
  return {
    id: overrides.id ?? 'basket-audit',
    code: overrides.code ?? 'AUDIT',
    labelPl: 'Audyt',
    durationMinutes: overrides.durationMinutes ?? 120,
    pool: overrides.pool ?? 'AUDITOR',
    isActive: overrides.isActive ?? true,
    sortOrder: 0,
  };
}

function auditorRow(id: string, overrides: Partial<{ is_active: boolean; leave_status: string }> = {}) {
  return {
    id,
    email: `${id}@klikklima.pl`,
    is_active: overrides.is_active ?? true,
    leave_status: overrides.leave_status ?? 'ACTIVE',
  };
}

function crewRow(id: string, overrides: Partial<{ aktywny: boolean; leave_status: string }> = {}) {
  return {
    id,
    email: `${id}@klikklima.pl`,
    aktywny: overrides.aktywny ?? true,
    leave_status: overrides.leave_status ?? 'ACTIVE',
  };
}

function schedulingConfigRow(
  overrides: { buffer?: number | null; start?: string; end?: string; weekdays?: number[] } = {},
) {
  return {
    konfiguracja: {
      travel_buffer_minutes: overrides.buffer === undefined ? 60 : overrides.buffer,
      default_workday_start: overrides.start ?? '08:00',
      default_workday_end: overrides.end ?? '16:00',
      default_weekdays: overrides.weekdays ?? [1, 2, 3, 4, 5],
    },
  };
}

function ruleRow(weekday: number, start: string, end: string, isActive = true) {
  return {
    weekday,
    startTime: new Date(`1970-01-01T${start}:00.000Z`),
    endTime: new Date(`1970-01-01T${end}:00.000Z`),
    isActive,
  };
}

function bookingRow(
  overrides: Partial<{
    auditorId: string | null;
    crewId: string | null;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: string;
  }> = {},
) {
  return {
    auditorId: overrides.auditorId ?? null,
    crewId: overrides.crewId ?? null,
    scheduledStart: overrides.scheduledStart ?? localMoment('2026-09-14', '08:00'),
    scheduledEnd: overrides.scheduledEnd ?? localMoment('2026-09-14', '10:00'),
    status: overrides.status ?? 'RESERVED',
  };
}

/**
 * R-3: pierwszy plauzybilny kształt — `PrismaClientKnownRequestError`-podobny obiekt z
 * rozpakowanym błędem raw ($queryRaw/$executeRaw zawsze mapują nierozpoznany SQLSTATE do
 * P2010 + `meta.code`). To jest kształt, którego WO explicite ostrzega, że NIE jest P2002.
 */
function exclusionViolationErrorRaw() {
  return Object.assign(new Error('Raw query failed. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "bookings_no_overlap_per_resource"`'), {
    name: 'PrismaClientKnownRequestError',
    code: 'P2010',
    meta: {
      code: '23P01',
      message: 'ERROR: conflicting key value violates exclusion constraint "bookings_no_overlap_per_resource"',
    },
  });
}

/**
 * R-3: drugi plauzybilny kształt — błąd bez mapowania na znany kod Prismy (typowe dla
 * ograniczeń, których silnik zapytań nie rozpoznaje przy zwykłym `create()`, w odróżnieniu
 * od `$queryRaw`): brak `.code`, ale surowy SQLSTATE i nazwa ograniczenia są w tekście.
 */
function exclusionViolationErrorUnknown() {
  return Object.assign(
    new Error(
      'Invalid `prisma.booking.create()` invocation: Unique constraint failed on the database: ERROR: conflicting key value violates exclusion constraint "bookings_no_overlap_per_resource" (SQLSTATE 23P01)',
    ),
    { name: 'PrismaClientUnknownRequestError' },
  );
}

function poolMismatchErrorRaw() {
  return Object.assign(new Error('Raw query failed. Code: `23514`. Message: `new row for relation "bookings" violates check constraint via trigger "bookings_pool_matches_basket_trg"`'), {
    name: 'PrismaClientKnownRequestError',
    code: 'P2010',
    meta: {
      code: '23514',
      message: 'ERROR: new row for relation "bookings" violates check constraint via trigger "bookings_pool_matches_basket_trg"',
    },
  });
}

beforeEach(() => {
  availabilityRuleFindManyMock.mockReset();
  systemConfigFindUniqueMock.mockReset();
  auditorFindManyMock.mockReset();
  crewFindManyMock.mockReset();
  bookingFindManyMock.mockReset();
  bookingCreateMock.mockReset();
  absenceFindManyMock.mockReset();
  visitDurationBasketQueryMock.mockReset();
  availabilityDeclarationFindManyMock.mockReset();
  getCurrentActorRoleMock.mockReset();

  availabilityRuleFindManyMock.mockResolvedValue([]);
  systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow());
  auditorFindManyMock.mockResolvedValue([auditorRow('aud-1')]);
  crewFindManyMock.mockResolvedValue([crewRow('crew-1')]);
  bookingFindManyMock.mockResolvedValue([]);
  absenceFindManyMock.mockResolvedValue([]);
  visitDurationBasketQueryMock.mockResolvedValue(basketRow());
  availabilityDeclarationFindManyMock.mockResolvedValue([]);
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

  // Domyślnie: INSERT się udaje i echuje dane wejściowe — testy nadpisują dla scenariuszy
  // kolizji. `data` to jedyna rzecz, o którą test-author może się oprzeć bez zgadywania
  // wewnętrznych nazw zmiennych implementera.
  bookingCreateMock.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'booking-generated',
    status: 'RESERVED',
    assignmentMode: 'AUTO',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...args.data,
  }));
});

describe('createBooking — Faza A (automat), FLD-BOOKING-ATOMIC-ASSIGN', () => {
  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A1 — udana rezerwacja tworzy JEDEN wiersz z dokładnie jednym wykonawcą, status RESERVED, assignment_mode AUTO', async () => {
    const startAt = localMoment('2026-09-14', '08:00');
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt,
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(bookingCreateMock).toHaveBeenCalledTimes(1);
    expect(result.booking.status).toBe('RESERVED');
    expect(result.booking.assignmentMode ?? result.booking['assignment_mode']).toBe('AUTO');
    expect(result.booking.bookedBy ?? result.booking['booked_by']).toBe('DISPATCHER');

    const auditorId = result.booking.auditorId ?? result.booking['auditor_id'] ?? null;
    const crewId = result.booking.crewId ?? result.booking['crew_id'] ?? null;
    // Dokładnie jedno z dwóch jest niepuste (CHECK bookings_one_assignee).
    expect([auditorId, crewId].filter((v) => v !== null && v !== undefined)).toHaveLength(1);
    expect(auditorId).toBe('aud-1');
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A2 — scheduled_end jest UTRWALONE w chwili rezerwacji: zmiana duration_minutes koszyka PO zapisie nie przesuwa wartości przekazanej do create()', async () => {
    const startAt = localMoment('2026-09-14', '08:00');
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));

    await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt,
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });

    const firstCallData = bookingCreateMock.mock.calls[0]![0].data;
    const scheduledEnd = firstCallData.scheduledEnd ?? firstCallData['scheduled_end'];
    expect(new Date(scheduledEnd).getTime()).toBe(startAt.getTime() + 120 * 60000);

    // Słownik zmienia się PO fakcie — kolejne wywołanie z INNYM koszykiem nie ma wpływu
    // na argumenty JUŻ WYSŁANEGO create() z pierwszego wywołania (mock call history jest
    // niezmienny — to jest dowód, że wartość była policzona raz, nie wyliczana leniwie).
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 999 }));
    const firstCallDataAfterMutation = bookingCreateMock.mock.calls[0]![0].data;
    const scheduledEndAfter = firstCallDataAfterMutation.scheduledEnd ?? firstCallDataAfterMutation['scheduled_end'];
    expect(new Date(scheduledEndAfter).getTime()).toBe(startAt.getTime() + 120 * 60000);
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A3 — koszyk AUDIT ląduje na audytorze (auditorId niepuste, crewId puste)', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ code: 'AUDIT', pool: 'AUDITOR' }));
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.booking.auditorId ?? result.booking['auditor_id']).toBe('aud-1');
    expect(result.booking.crewId ?? result.booking['crew_id'] ?? null).toBeNull();
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A3 — koszyk INSTALL_STANDARD ląduje na ekipie (crewId niepuste, auditorId puste)', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(
      basketRow({ id: 'basket-install', code: 'INSTALL_STANDARD', pool: 'CREW', durationMinutes: 480 }),
    );
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-install',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.booking.crewId ?? result.booking['crew_id']).toBe('crew-1');
    expect(result.booking.auditorId ?? result.booking['auditor_id'] ?? null).toBeNull();
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A3 — POOL_MISMATCH: 23514 z wyzwalacza (kształt raw/P2010+meta.code) wraca jako błąd domenowy, nie wyjątek', async () => {
    bookingCreateMock.mockRejectedValue(poolMismatchErrorRaw());
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('POOL_MISMATCH');
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A6 — ekipa zajęta montażem całodniowym 08:00-16:00 nie jest kandydatem dla INCIDENT 10:00 tego samego dnia: SLOT_NOT_OFFERED, zero zapisów', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(
      basketRow({ id: 'basket-incident', code: 'INCIDENT', pool: 'CREW', durationMinutes: 120 }),
    );
    crewFindManyMock.mockResolvedValue([crewRow('crew-solo')]);
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ crewId: 'crew-solo', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '16:00') }),
    ]);

    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-incident',
      startAt: localMoment('2026-09-14', '10:00'),
      subject: { kind: 'INCIDENT', incidentId: 'incident-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('SLOT_NOT_OFFERED');
    expect(bookingCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A7 — styk godzinowy nie jest kolizją: 08:00-10:00 i 10:00-12:00 u tej samej osoby OBIE się udają', async () => {
    // Bufor dojazdu z definicji wymaga odstępu między rezerwacjami — przy buforze>0 styk
    // godzinowy JEST odrzucany (patrz AC-A9(c) w tym pliku i AC-T1 w
    // available-slots-engine-a-b-t-c-s-e.test.ts:483-497). To AC dowodzi, że silnik nie
    // traktuje samego STYKU jako kolizji, niezależnie od bufora — więc bufor musi być 0,
    // inaczej test mierzyłby zachowanie bufora, nie zachowanie styku.
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));

    const first = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(first.ok).toBe(true);

    // Drugie żądanie widzi rezerwację utworzoną pierwszym wywołaniem (silnik czyta stan bazy;
    // atrapa symuluje to jawnym dopisaniem wiersza do fixture'u odczytu).
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);

    const second = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '10:00'),
      subject: { kind: 'LEAD', leadId: 'lead-2' },
      bookedBy: 'DISPATCHER',
    });
    expect(second.ok).toBe(true);
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A8 — rezerwacja RELEASED nie blokuje slotu: ten sam slot u tego samego pracownika daje się zarezerwować ponownie', async () => {
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00'), status: 'RELEASED' }),
    ]);
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(result.ok).toBe(true);
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A8 — rezerwacja COMPLETED nie blokuje slotu', async () => {
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00'), status: 'COMPLETED' }),
    ]);
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(result.ok).toBe(true);
  });

  describe('AC-A9 — SLOT_NOT_OFFERED, cztery powody osobno', () => {
    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('(a) godzina poza oknem reguły tygodniowej — brak reguły dla tego dnia tygodnia, brak fallbacku (pracownik MA regułę na inny dzień)', async () => {
      // AC-B4: fallback jest per-pracownik i wyłącza się, gdy pracownik ma choć jedną regułę.
      availabilityRuleFindManyMock.mockResolvedValue([ruleRow(2, '08:00', '16:00', true)]); // tylko wtorek
      // 2026-09-14 to poniedziałek (weekday=1) — brak reguły na ten dzień.
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('(b) kolizja z nieobecnością — cały dzień na urlopie', async () => {
      absenceFindManyMock.mockResolvedValue([
        { auditorId: 'aud-1', crewId: null, startsAt: localMoment('2026-09-14', '00:00'), endsAt: localMoment('2026-09-15', '00:00') },
      ]);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('(c) naruszenie SAMEGO bufora dojazdu przy formalnie wolnym oknie — baza tego nie egzekwuje, akcja MUSI', async () => {
      // Rezerwacja 08:00-10:00, bufor 60 min => kolejny slot nie może zaczynać się przed 11:00.
      // 10:30 formalnie leży w oknie 8-16 i nie nakłada się na 08:00-10:00, ale narusza bufor.
      bookingFindManyMock.mockResolvedValue([
        bookingRow({ auditorId: 'aud-1', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
      ]);
      systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '10:30'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it(`(d) wyczerpany SLA.AUDITOR_DAILY_CAP (${SLA.AUDITOR_DAILY_CAP.count}) dla puli AUDITOR — próg pochodzi z kontraktu, nie z literału`, async () => {
      const capacity = SLA.AUDITOR_DAILY_CAP.count;
      const existingBookings = Array.from({ length: capacity }, (_, i) =>
        bookingRow({
          auditorId: 'aud-1',
          scheduledStart: localMoment('2026-09-14', `0${8 + i}:00`.slice(-5)),
          scheduledEnd: localMoment('2026-09-14', `0${9 + i}:00`.slice(-5)),
        }),
      );
      bookingFindManyMock.mockResolvedValue(existingBookings);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-15', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      // AUDITOR_DAILY_CAP liczy się per doba lokalna — powyższe rezerwacje są na 09-14, więc
      // 09-15 pozostaje wolny; to sprawdza, że próg NIE jest przeniesiony na cały horyzont.
      // Test właściwy na wyczerpanie: żądamy TEGO SAMEGO dnia, co istniejące rezerwacje.
      expect(result.ok).toBe(true);

      const exhaustedResult = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', `0${8 + capacity}:00`.slice(-5)),
        subject: { kind: 'LEAD', leadId: 'lead-2' },
        bookedBy: 'DISPATCHER',
      });
      expect(exhaustedResult.ok).toBe(false);
      if (exhaustedResult.ok) throw new Error('unreachable');
      expect(exhaustedResult.error.code).toBe('SLOT_NOT_OFFERED');
    });
  });

  describe('AC-A10/AC-A11 — 23P01 nie wydostaje się jako wyjątek, brak śladu po nieudanej próbie', () => {
    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('AC-A10 (kształt raw/P2010+meta.code) — SLOT_TAKEN z co najmniej jedną alternatywą bez resource_id', async () => {
      bookingCreateMock.mockRejectedValue(exclusionViolationErrorRaw());
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_TAKEN');
      expect(result.error.alternatives.length).toBeGreaterThan(0);
      for (const alt of result.error.alternatives) {
        expect(alt).not.toHaveProperty('resource_id');
        expect(alt).not.toHaveProperty('resourceId');
      }
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('AC-A10 (kształt bez mapowania, tekst SQLSTATE 23P01 w komunikacie) — SLOT_TAKEN, nie wyjątek', async () => {
      bookingCreateMock.mockRejectedValue(exclusionViolationErrorUnknown());
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_TAKEN');
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('AC-A11 — wyczerpanie CAŁEJ puli (23P01 na każdym kandydacie) daje SLOT_TAKEN i ZERO sukcesów: liczba wywołań create() === liczba kandydatów, wszystkie odrzucone', async () => {
      auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-2'), auditorRow('aud-3')]);
      bookingCreateMock.mockRejectedValue(exclusionViolationErrorRaw());

      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_TAKEN');
      // Trzej kandydaci wolni w tym slocie -> dokładnie trzy próby, zero sukcesów.
      // `mock.results[i].type` jest 'return' zawsze, gdy funkcja synchronicznie zwraca Promise
      // (niezależnie czy się potem odrzuci) — to strukturalna właściwość vitest, nie sygnał
      // sukcesu. Rzeczywisty status odrzucenia jest w `mock.settledResults`.
      expect(bookingCreateMock).toHaveBeenCalledTimes(3);
      expect(bookingCreateMock.mock.settledResults).toHaveLength(3);
      for (const settled of bookingCreateMock.mock.settledResults) {
        expect(settled.type).toBe('rejected');
      }
    });
  });

  describe('D-1 — reguła wyboru kandydata przy >1 wolnej osobie', () => {
    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('wygrywa kandydat z NAJMNIEJSZĄ liczbą rezerwacji w danej dobie lokalnej', async () => {
      auditorFindManyMock.mockResolvedValue([auditorRow('aud-a'), auditorRow('aud-b'), auditorRow('aud-c')]);
      bookingFindManyMock.mockResolvedValue([
        // aud-a: 2 rezerwacje tego dnia, aud-b: 1, aud-c: 0 -> wygrywa aud-c.
        bookingRow({ auditorId: 'aud-a', scheduledStart: localMoment('2026-09-14', '11:00'), scheduledEnd: localMoment('2026-09-14', '13:00') }),
        bookingRow({ auditorId: 'aud-a', scheduledStart: localMoment('2026-09-14', '14:00'), scheduledEnd: localMoment('2026-09-14', '15:00') }),
        bookingRow({ auditorId: 'aud-b', scheduledStart: localMoment('2026-09-14', '13:00'), scheduledEnd: localMoment('2026-09-14', '15:00') }),
      ]);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.booking.auditorId ?? result.booking['auditor_id']).toBe('aud-c');
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('remis (liczba rezerwacji równa) rozstrzygany po `id` rosnąco', async () => {
      auditorFindManyMock.mockResolvedValue([auditorRow('aud-z'), auditorRow('aud-a')]);
      bookingFindManyMock.mockResolvedValue([]);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.booking.auditorId ?? result.booking['auditor_id']).toBe('aud-a');
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('strefa czasowa — doba zmiany czasu 2026-03-29 (23h): rezerwacja o Warszawskiej lokalnej 00:30 (UTC 2026-03-28) MUSI się liczyć do doby 03-29 przy zliczaniu D-1, nie do UTC 03-28', async () => {
      // 2026-03-29 to niedziela (ISODOW 7). Reguła 00:00-02:00 pozwala na istniejącą wczesną
      // rezerwację aud-a bez naruszania okna dnia; docelowa wizyta to normalne 08:00 tego dnia.
      availabilityRuleFindManyMock.mockResolvedValue([
        ruleRow(7, '00:00', '02:00'),
        ruleRow(7, '08:00', '16:00'),
      ]);
      auditorFindManyMock.mockResolvedValue([auditorRow('aud-a'), auditorRow('aud-b')]);
      const earlyLocalBookingUtc = new Date('2026-03-28T23:30:00.000Z'); // = 2026-03-29 00:30 CET
      bookingFindManyMock.mockResolvedValue([
        bookingRow({
          auditorId: 'aud-a',
          scheduledStart: earlyLocalBookingUtc,
          scheduledEnd: new Date(earlyLocalBookingUtc.getTime() + 60 * 60000),
        }),
      ]);
      const startAt = localMoment('2026-03-29', '08:00');
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt,
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      // aud-a MA jedną rezerwację w dobie lokalnej 03-29 (00:30 CET), aud-b ma zero -> aud-b wygrywa.
      // Zgrupowanie po dacie UTC (03-28) błędnie policzyłoby aud-a jako 0 i (przy id aud-a < aud-b)
      // wybrałoby aud-a przez remis — dokładnie ten błąd ten test wykrywa.
      expect(result.booking.auditorId ?? result.booking['auditor_id']).toBe('aud-b');
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('strefa czasowa — doba zmiany czasu 2026-10-25 (25h): rezerwacja o Warszawskiej lokalnej 00:30 (UTC 2026-10-24) MUSI się liczyć do doby 10-25, nie do UTC 10-24', async () => {
      // 2026-10-25 to niedziela (ISODOW 7).
      availabilityRuleFindManyMock.mockResolvedValue([
        ruleRow(7, '00:00', '02:00'),
        ruleRow(7, '08:00', '16:00'),
      ]);
      auditorFindManyMock.mockResolvedValue([auditorRow('aud-a'), auditorRow('aud-b')]);
      const earlyLocalBookingUtc = new Date('2026-10-24T22:30:00.000Z'); // = 2026-10-25 00:30 CEST
      bookingFindManyMock.mockResolvedValue([
        bookingRow({
          auditorId: 'aud-a',
          scheduledStart: earlyLocalBookingUtc,
          scheduledEnd: new Date(earlyLocalBookingUtc.getTime() + 60 * 60000),
        }),
      ]);
      const startAt = localMoment('2026-10-25', '08:00');
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt,
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.booking.auditorId ?? result.booking['auditor_id']).toBe('aud-b');
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('wizyta 480-minutowa w dobie 23-godzinnej (2026-03-29) startuje o 08:00 lokalnym i konczy się o 16:00 lokalnym niezależnie od skoku czasu', async () => {
      visitDurationBasketQueryMock.mockResolvedValue(
        basketRow({ id: 'basket-install', code: 'INSTALL_STANDARD', pool: 'CREW', durationMinutes: 480 }),
      );
      availabilityRuleFindManyMock.mockResolvedValue([ruleRow(7, '08:00', '16:00')]);
      const startAt = localMoment('2026-03-29', '08:00');
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-install',
        startAt,
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      const scheduledEnd = result.booking.scheduledEnd ?? result.booking['scheduled_end'];
      expect(new Date(scheduledEnd).getTime()).toBe(localMoment('2026-03-29', '16:00').getTime());
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('wizyta 480-minutowa w dobie 25-godzinnej (2026-10-25) startuje o 08:00 lokalnym i konczy się o 16:00 lokalnym niezależnie od powrotu czasu', async () => {
      visitDurationBasketQueryMock.mockResolvedValue(
        basketRow({ id: 'basket-install', code: 'INSTALL_STANDARD', pool: 'CREW', durationMinutes: 480 }),
      );
      availabilityRuleFindManyMock.mockResolvedValue([ruleRow(7, '08:00', '16:00')]);
      const startAt = localMoment('2026-10-25', '08:00');
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-install',
        startAt,
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      const scheduledEnd = result.booking.scheduledEnd ?? result.booking['scheduled_end'];
      expect(new Date(scheduledEnd).getTime()).toBe(localMoment('2026-10-25', '16:00').getTime());
    });
  });

  describe('Przypadki brzegowe (WO, "Przypadki brzegowe, które MUSZĄ mieć test")', () => {
    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('koszyk wycofany (is_active=false) -> BASKET_INACTIVE, zero zapisu (silnik już to zwraca, akcja nie może tego przykryć)', async () => {
      visitDurationBasketQueryMock.mockResolvedValue(basketRow({ isActive: false }));
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('BASKET_INACTIVE');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('koszyk nieistniejący -> BASKET_NOT_FOUND, zero zapisu', async () => {
      visitDurationBasketQueryMock.mockResolvedValue(null);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-nieistniejacy',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('BASKET_NOT_FOUND');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('brak travel_buffer_minutes w scheduling_config -> fail-CLOSED (CONFIG_MISSING), bufor 0 NIE jest wartością domyślną', async () => {
      systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: null }));
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('CONFIG_MISSING');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('pusta pula (wszyscy nieaktywni) -> SLOT_NOT_OFFERED, nie wyjątek', async () => {
      auditorFindManyMock.mockResolvedValue([auditorRow('aud-1', { is_active: false })]);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
    it('pusta pula (wszyscy na urlopie przez availability_declarations) -> SLOT_NOT_OFFERED', async () => {
      availabilityDeclarationFindManyMock.mockResolvedValue([
        { id: 'decl-1', auditorId: 'aud-1', crewId: null, isAvailable: false },
      ]);
      const result = await createBooking({
        now: FIXED_NOW,
        visitBasketId: 'basket-audit',
        startAt: localMoment('2026-09-14', '08:00'),
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'DISPATCHER',
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');
      expect(bookingCreateMock).not.toHaveBeenCalled();
    });
  });
});

describe('createBookingAction — bramka uprawnień, FLD-BOOKING-ATOMIC-ASSIGN AC-A12', () => {
  // `createBookingAction` waliduje wejście przez Zod (bez pola `now` w schemacie) i
  // przekazuje wynik dalej do `createBooking`, który wtedy domyślnie liczy `now = new
  // Date()` — CAL-SLOT-ENGINE-PAST-REJECTION odrzuciłby '2026-09-14' względem
  // prawdziwego zegara systemowego. Zamiast literału daty (zakazane) albo zmiany
  // production-code schematu (zakazane dla test-authora), zamrażamy zegar systemowy
  // na FIXED_NOW — dokładnie ten sam mechanizm, którym `now` byłby przekazany, gdyby
  // schemat go przyjmował.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const VALID_PAYLOAD = {
    visitBasketId: 'basket-audit',
    startAt: localMoment('2026-09-14', '08:00'),
    subject: { kind: 'LEAD', leadId: 'lead-1' },
    bookedBy: 'DISPATCHER',
  };

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it.each(['audytor', 'monter'])(
    'AC-A12 — rola %s dostaje odmowę (ok:false) i NIE wykonuje żadnego zapytania zapisującego',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      const result = await createBookingAction(VALID_PAYLOAD);
      expect(result.ok).toBe(false);
      expect(bookingCreateMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it.each(['dyspozytor', 'admin'])('AC-A12 — rola %s przechodzi bramkę i akcja próbuje zapisać', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const result = await createBookingAction(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    expect(bookingCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-A12 — brak roli (sesja nieznana) jest odmową, nie wyjątkiem', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    const result = await createBookingAction(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    expect(bookingCreateMock).not.toHaveBeenCalled();
  });
});
