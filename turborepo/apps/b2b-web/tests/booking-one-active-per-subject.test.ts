import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Domykanie wymagania FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
 * (contracts/requirements.contract.mjs:687), 8 kryteriów AC1..AC8.
 *
 * Ten plik dowodzi WYŁĄCZNIE AC5 i AC6 — jedyne dwa kryteria z tego wymagania, których
 * przedmiotem jest zachowanie KODU (`packages/scheduling/src/create-booking.ts`), nie
 * zachowanie samego ograniczenia bazy. AC1/AC8 są już oznaczone jako spełnione przez
 * contract-steward. AC2/AC3/AC4 dowodzą właściwości SAMEGO indeksu
 * `bookings_one_active_per_subject` i wymagają żywego Postgresa — mieszkają w
 * `create-booking-concurrency.itest.ts` (AC7 jest kryterium meta, spełnionym samym faktem,
 * że AC2/AC3/AC4 są `*.itest.ts`, nie testami na atrapie).
 *
 * Wzorzec mockowania skopiowany z `create-booking.test.ts` (ten sam `vi.mock('@repo/database')`,
 * ta sama ścieżka importu `@repo/scheduling`, te samo fabryki `basketRow`/`auditorRow`/
 * `schedulingConfigRow`/`bookingRow`).
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

const {
  availabilityRuleFindManyMock,
  systemConfigFindUniqueMock,
  auditorFindManyMock,
  crewFindManyMock,
  bookingFindManyMock,
  bookingFindFirstMock,
  bookingCreateMock,
  absenceFindManyMock,
  visitDurationBasketQueryMock,
  availabilityDeclarationFindManyMock,
} = vi.hoisted(() => ({
  availabilityRuleFindManyMock: vi.fn(),
  systemConfigFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  bookingFindManyMock: vi.fn(),
  bookingFindFirstMock: vi.fn(),
  bookingCreateMock: vi.fn(),
  absenceFindManyMock: vi.fn(),
  visitDurationBasketQueryMock: vi.fn(),
  availabilityDeclarationFindManyMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    availabilityRule: { findMany: availabilityRuleFindManyMock },
    system_config: { findUnique: systemConfigFindUniqueMock },
    audytorzy: { findMany: auditorFindManyMock },
    zespoly_monterskie: { findMany: crewFindManyMock },
    booking: { findMany: bookingFindManyMock, findFirst: bookingFindFirstMock, create: bookingCreateMock },
    absence: { findMany: absenceFindManyMock },
    visitDurationBasket: { findUnique: visitDurationBasketQueryMock, findFirst: visitDurationBasketQueryMock },
    availabilityDeclaration: { findMany: availabilityDeclarationFindManyMock },
  },
}));

const { createBooking } = await import('@repo/scheduling');

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

function bookingRow(
  overrides: Partial<{
    id: string;
    leadId: string | null;
    auditorId: string | null;
    crewId: string | null;
    scheduledStart: Date;
    scheduledEnd: Date;
    status: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'booking-existing',
    leadId: overrides.leadId ?? null,
    serviceId: null,
    incidentId: null,
    auditorId: overrides.auditorId ?? null,
    crewId: overrides.crewId ?? null,
    scheduledStart: overrides.scheduledStart ?? localMoment('2026-09-14', '08:00'),
    scheduledEnd: overrides.scheduledEnd ?? localMoment('2026-09-14', '10:00'),
    status: overrides.status ?? 'CONFIRMED',
  };
}

/**
 * Kształt błędu 23505 z `bookings_one_active_per_subject` — analogiczny do
 * `exclusionViolationErrorRaw`/`poolMismatchErrorRaw` w `create-booking.test.ts` (raw query,
 * P2010 + `meta.code`), tyle że z innym SQLSTATE i nazwą ograniczenia.
 */
function subjectAlreadyBookedErrorRaw() {
  return Object.assign(
    new Error(
      'Raw query failed. Code: `23505`. Message: `duplicate key value violates unique constraint "bookings_one_active_per_subject"`',
    ),
    {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: {
        code: '23505',
        message: 'ERROR: duplicate key value violates unique constraint "bookings_one_active_per_subject"',
      },
    },
  );
}

beforeEach(() => {
  availabilityRuleFindManyMock.mockReset();
  systemConfigFindUniqueMock.mockReset();
  auditorFindManyMock.mockReset();
  crewFindManyMock.mockReset();
  bookingFindManyMock.mockReset();
  bookingFindFirstMock.mockReset();
  bookingCreateMock.mockReset();
  absenceFindManyMock.mockReset();
  visitDurationBasketQueryMock.mockReset();
  availabilityDeclarationFindManyMock.mockReset();

  availabilityRuleFindManyMock.mockResolvedValue([]);
  systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow());
  auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-2')]);
  crewFindManyMock.mockResolvedValue([]);
  bookingFindManyMock.mockResolvedValue([]);
  bookingFindFirstMock.mockResolvedValue(null);
  absenceFindManyMock.mockResolvedValue([]);
  visitDurationBasketQueryMock.mockResolvedValue(basketRow());
  availabilityDeclarationFindManyMock.mockResolvedValue([]);

  bookingCreateMock.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'booking-generated',
    status: 'RESERVED',
    assignmentMode: 'AUTO',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...args.data,
  }));
});

describe('createBooking — FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT, AC5/AC6 (atrapa Prismy)', () => {
  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it('AC5 — 23505 daje kod SUBJECT_ALREADY_BOOKED i przerywa pętlę: create() wywołane DOKŁADNIE RAZ mimo puli dwuosobowej', async () => {
    // Pula dwuosobowa (aud-1, aud-2, ustawione w beforeEach) — dowodzi, że po 23505 pętla
    // NIE próbuje kolejnego kandydata (inaczej niż przy 23P01, patrz AC-A11 w
    // create-booking.test.ts), bo ponowienie na innym kandydacie tego samego podmiotu
    // skończyłoby się identycznie.
    bookingCreateMock.mockRejectedValue(subjectAlreadyBookedErrorRaw());

    const result = await createBooking({
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('SUBJECT_ALREADY_BOOKED');
    expect(bookingCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it('AC6 — błąd SUBJECT_ALREADY_BOOKED niesie existingBooking z danymi kolidującej rezerwacji podmiotu (nie tylko komunikat tekstowy)', async () => {
    const existing = bookingRow({ id: 'booking-collision', leadId: 'lead-1', auditorId: 'aud-9', status: 'CONFIRMED' });
    bookingCreateMock.mockRejectedValue(subjectAlreadyBookedErrorRaw());
    bookingFindFirstMock.mockResolvedValue(existing);

    const result = await createBooking({
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('SUBJECT_ALREADY_BOOKED');
    expect(result.error.existingBooking).toEqual(existing);

    // Odesłanie musi dotyczyć TEGO SAMEGO podmiotu (leadId) i szukać wyłącznie rezerwacji
    // aktywnych (RESERVED/CONFIRMED) — status RELEASED/COMPLETED nie jest kolizją.
    expect(bookingFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leadId: 'lead-1',
          status: { in: ['RESERVED', 'CONFIRMED'] },
        }),
      }),
    );
  });

  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it('AC6 — przypadek pusty: gdy dociągnięcie kolidującej rezerwacji nic nie znajduje, existingBooking jest null, nie undefined', async () => {
    // Przypadek brzegowy zawsze dopisywany (CLAUDE.md): rezydualne ryzyko rozjazdu odczytu
    // (np. rezerwacja skasowana między błędem 23505 a dociągnięciem) nie może wywalić się
    // wyjątkiem ani zamienić w pole nieobecne w błędzie.
    bookingCreateMock.mockRejectedValue(subjectAlreadyBookedErrorRaw());
    bookingFindFirstMock.mockResolvedValue(null);

    const result = await createBooking({
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('SUBJECT_ALREADY_BOOKED');
    expect(result.error.existingBooking).toBeNull();
  });

  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it('AC5 — pula MAKSYMALNA (pięciu kandydatów): 23505 na PIERWSZEJ próbie wciąż zatrzymuje pętlę po jednym wywołaniu create()', async () => {
    // Przypadek maksymalny (CLAUDE.md): więcej kandydatów niż w podstawowym AC5 nie zmienia
    // zachowania — pętla przerywa się na pierwszym 23505 niezależnie od rozmiaru puli.
    auditorFindManyMock.mockResolvedValue([
      auditorRow('aud-1'),
      auditorRow('aud-2'),
      auditorRow('aud-3'),
      auditorRow('aud-4'),
      auditorRow('aud-5'),
    ]);
    bookingCreateMock.mockRejectedValue(subjectAlreadyBookedErrorRaw());

    const result = await createBooking({
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('SUBJECT_ALREADY_BOOKED');
    expect(bookingCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it('AC6 — podmiot SERVICE: odesłanie do kolidującej rezerwacji szuka po serviceId, nie leadId', async () => {
    // Sprawdza, że dociągnięcie `existingBooking` korzysta z faktycznych pól podmiotu
    // (subjectFields), nie zawsze leadId — inny podmiot (SERVICE/INCIDENT) musi trafić we
    // właściwą kolumnę, inaczej odesłanie wskazywałoby na przypadkowy, niezwiązany wiersz.
    const existing = bookingRow({ id: 'booking-service-collision', leadId: null, status: 'RESERVED' });
    bookingCreateMock.mockRejectedValue(subjectAlreadyBookedErrorRaw());
    bookingFindFirstMock.mockResolvedValue(existing);

    const result = await createBooking({
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'SERVICE', serviceId: 'service-1' },
      bookedBy: 'DISPATCHER',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.existingBooking).toEqual(existing);
    expect(bookingFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceId: 'service-1',
          leadId: null,
          incidentId: null,
          status: { in: ['RESERVED', 'CONFIRMED'] },
        }),
      }),
    );
  });
});
