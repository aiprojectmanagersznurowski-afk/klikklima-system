import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';

/**
 * WO: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md — AC7 (kryt. 6 `FNL-2PHASE-BOOKING`):
 * "ta sama ekipa na obu etapach jest PREFERENCJĄ, nie WARUNKIEM".
 *
 * ═══ KONTRAKT Z IMPLEMENTER-SERVER — packages/scheduling/src/create-booking.ts ═══
 * `CreateBookingParams` dostaje NOWE, OPCJONALNE pole:
 *
 *   preferredResourceId?: string
 *
 * Semantyka: PO wywołaniu `orderCandidates` (reguła D-1, funkcja NIETKNIĘTA — WO,
 * "Rozstrzygnięcie zakresowe": "Reguła D-1 w orderCandidates zostaje nietknięta, a
 * preferencja realizuje się jako preselekcja po stronie wołającego") `createBooking`
 * przenosi kandydata o `resource_id === preferredResourceId` na START listy WYNIKOWEJ
 * D-1, jeśli taki kandydat w niej istnieje (czyli jest wolny w żądanym terminie) —
 * zachowując względną kolejność D-1 dla pozostałych kandydatów. Gdy
 * `preferredResourceId` NIE występuje w kandydatach D-1 (ekipa nieaktywna, na
 * urlopie, zajęta, poza pulą oferowaną na ten koszyk), lista pozostaje w
 * niezmienionym porządku D-1 — rezerwacja i tak się udaje z innym kandydatem,
 * NIGDY odmową z powodu niedostępności preferowanej ekipy (dowód: test niżej,
 * "ekipa preferowana NIEDOSTĘPNA").
 *
 * Ten plik jest osobny od `create-booking.test.ts` (FLD-BOOKING-ATOMIC-ASSIGN) —
 * dzieli z nim wzorzec mockowania Prisma 1:1 (harness skopiowany, nie zaimportowany:
 * `vi.mock` jest per-plik), ale testuje WYŁĄCZNIE kryterium 6 tego WO, stąd
 * osobny `@REQ`.
 *
 * Stan zmierzony 2026-09-16: `grep -n "preferredResourceId"
 * packages/scheduling/src/create-booking.ts` — zero wyników. RED tej tury jest
 * ASERCJĄ (kandydat preferowany nie jest wybrany mimo dostępności), nie brakiem
 * modułu — dopuszczone przez kryterium poprawnego RED z instrukcji ("test musi
 * padać na asercji ALBO na braku eksportu"). `preferredResourceId` jest przekazywane
 * przez rzutowanie przez `unknown` (jedyny dozwolony wariant rzutowania w tym repo,
 * `sec-audit-log-manual-status-wave-c.test.ts` używa identycznego wzorca) — dzisiejszy
 * typ `CreateBookingParams` tego pola jeszcze nie ma.
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

const { createBooking } = await import('@repo/scheduling');

function basketRow(
  overrides: Partial<{ id: string; code: string; durationMinutes: number; pool: string; isActive: boolean }> = {},
) {
  return {
    id: overrides.id ?? 'basket-phase-2',
    code: overrides.code ?? 'INSTALL_PHASE_2',
    labelPl: 'Montaż — faza 2',
    durationMinutes: overrides.durationMinutes ?? 240,
    pool: overrides.pool ?? 'CREW',
    isActive: overrides.isActive ?? true,
    sortOrder: 70,
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

function schedulingConfigRow() {
  return {
    konfiguracja: {
      travel_buffer_minutes: 60,
      default_workday_start: '08:00',
      default_workday_end: '16:00',
      default_weekdays: [1, 2, 3, 4, 5],
    },
  };
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

  availabilityRuleFindManyMock.mockResolvedValue([]);
  systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow());
  auditorFindManyMock.mockResolvedValue([]);
  // Trzy ekipy, wszystkie WOLNE w żądanym slocie 08:00-12:00 (240 min, bufor 60 min —
  // wszystkie istniejące rezerwacje niżej zaczynają się >= 13:00, czyli >= bufor po
  // końcu 12:00): crew-a ma ZERO rezerwacji tego dnia (D-1 wygrywa nią SAMĄ), crew-b
  // ma 1, crew-preferred ma 2 — D-1 BEZ preferencji wybiera crew-a (najmniej), NIE
  // crew-preferred.
  crewFindManyMock.mockResolvedValue([crewRow('crew-a'), crewRow('crew-b'), crewRow('crew-preferred')]);
  bookingFindManyMock.mockResolvedValue([
    { auditorId: null, crewId: 'crew-b', scheduledStart: localMoment('2026-09-14', '13:30'), scheduledEnd: localMoment('2026-09-14', '14:00'), status: 'RESERVED' },
    { auditorId: null, crewId: 'crew-preferred', scheduledStart: localMoment('2026-09-14', '14:00'), scheduledEnd: localMoment('2026-09-14', '14:30'), status: 'RESERVED' },
    { auditorId: null, crewId: 'crew-preferred', scheduledStart: localMoment('2026-09-14', '15:00'), scheduledEnd: localMoment('2026-09-14', '15:30'), status: 'RESERVED' },
  ]);
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

describe('createBooking — AC7/kryt. 6, preferredResourceId (preselekcja, nie warunek)', () => {
  // Kontrola pozytywna: SANS preferredResourceId, D-1 wybiera crew-a (najmniej
  // rezerwacji tego dnia) — dowodzi, że fixture jest poprawny i D-1 nie jest złamane.
  // @REQ: FNL-2PHASE-BOOKING
  it('kontrola pozytywna — bez preferredResourceId, D-1 wybiera crew-a (najmniej rezerwacji)', async () => {
    const result = await createBooking({
      now: FIXED_NOW,
      visitBasketId: 'basket-phase-2',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.booking.crewId ?? result.booking['crew_id']).toBe('crew-a');
  });

  // Ekipa preferowana JEST wolna w tym terminie (jest w puli kandydatów D-1, mimo że
  // nie wygrywa D-1 samodzielnie) -> preferredResourceId ją PRZESUWA na start listy,
  // rezerwacja ląduje na niej, NIE na zwycięzcy D-1.
  // @REQ: FNL-2PHASE-BOOKING
  it('ekipa preferowana DOSTĘPNA -> wygrywa preselekcja, nie D-1 (crew-preferred, nie crew-a)', async () => {
    const params = {
      now: FIXED_NOW,
      visitBasketId: 'basket-phase-2',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
      preferredResourceId: 'crew-preferred',
    };
    const result = await createBooking(params as unknown as Parameters<typeof createBooking>[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.booking.crewId ?? result.booking['crew_id']).toBe('crew-preferred');
  });

  // Ekipa preferowana NIEDOSTĘPNA (nieaktywna) — rezerwacja NIE odmawia, ląduje na
  // zwycięzcy D-1 (crew-a) jak w kontroli pozytywnej. To jest kryt. 6 dosłownie:
  // "gdy niedostępna, rezerwacja etapu II i tak się udaje z inną ekipą".
  // @REQ: FNL-2PHASE-BOOKING
  it('ekipa preferowana NIEDOSTĘPNA (nieaktywna) -> rezerwacja i tak się udaje, z inną ekipą (D-1)', async () => {
    crewFindManyMock.mockResolvedValue([
      crewRow('crew-a'),
      crewRow('crew-b'),
      crewRow('crew-preferred', { aktywny: false }),
    ]);

    const params = {
      now: FIXED_NOW,
      visitBasketId: 'basket-phase-2',
      startAt: localMoment('2026-09-14', '08:00'),
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'DISPATCHER',
      preferredResourceId: 'crew-preferred',
    };
    const result = await createBooking(params as unknown as Parameters<typeof createBooking>[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.booking.crewId ?? result.booking['crew_id']).not.toBe('crew-preferred');
    expect(result.booking.crewId ?? result.booking['crew_id']).toBe('crew-a');
  });
});
