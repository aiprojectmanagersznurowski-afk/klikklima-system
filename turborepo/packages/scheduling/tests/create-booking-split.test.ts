import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fromZonedTime } from 'date-fns-tz';

/**
 * WO: docs/workorders/B2C-LEAD-ATOMIC.md — P-2 ("Transakcja ponawiana per kandydat"),
 * przypadki brzegowe "40P01 (deadlock) traktowany jak 23P01" i "Timeout transakcji".
 *
 * `packages/scheduling/src/create-booking.ts` NIE eksportuje dziś (2026-09-28) żadnej z
 * dwóch funkcji, na które WO żąda rozbicia ("część przygotowawcza" / "część zapisująca") —
 * to jest oczekiwany, właściwy powód czerwieni tego pliku (brak eksportu, nie błąd składni).
 *
 * KONTRAKT (decyzja test-authora — WO opisuje PODEJŚCIE, nie "Proponowaną sygnaturę", patrz
 * uzasadnienie pełne w `apps/b2c-web/tests/actions/saveLead.atomic.test.ts`):
 *
 *   prepareBookingCandidates(params): odczyty WYŁĄCZNIE (koszyk, konfiguracja,
 *   findAvailableSlots, D-1, preferredResourceId) — BEZ zapisu, BEZ transakcji.
 *
 *   writeBookingCandidate(tx, params): przyjmuje klienta transakcyjnego `tx`
 *   (`Prisma.TransactionClient` albo globalny `prisma` — oba mają identyczny kształt
 *   `.booking.create`), wykonuje DOKŁADNIE jeden `tx.booking.create`. Łapie 23514
 *   (POOL_MISMATCH) i 23505 (SUBJECT_ALREADY_BOOKED) — te dwa kody NIE wymagają ponowienia na
 *   innym kandydacie (WO/R-4, zachowanie 1:1 z dzisiejszym `createBooking`). NIE ŁAPIE
 *   23P01/40P01 — WO, P-2: "część zapisująca (...) NIE łapie 23P01/40P01 — oddaje błąd
 *   wołającemu, bo po nim transakcja i tak jest martwa". Błąd nierozpoznany — rzuca dalej
 *   (zachowanie 1:1 z dzisiejszym `createBooking`).
 *
 * `createBooking` (WO: "zachowuje obecny kontrakt zachowania") MUSI zostać złożony z tych
 * samych dwóch części — ten plik dowodzi WYŁĄCZNIE właściwości SAMYCH części nowych; dowód, że
 * `createBooking` po złożeniu nadal przechodzi bez zmiany asercji, jest w
 * `apps/b2b-web/tests/create-booking.test.ts` i `create-booking-concurrency.itest.ts`
 * (NIETKNIĘTE przez tę turę — WO, "Kolejność ról" pkt 4: potwierdzenie regresji, nie zmiana).
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

const scheduling = (await import('../src/index')) as unknown as {
  prepareBookingCandidates?: (params: Record<string, unknown>) => Promise<unknown>;
  writeBookingCandidate?: (tx: unknown, params: Record<string, unknown>) => Promise<unknown>;
};

function basketRow(overrides: Partial<{ id: string; code: string; durationMinutes: number; pool: string; isActive: boolean }> = {}) {
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

function auditorRow(id: string) {
  return { id, email: `${id}@klikklima.pl`, is_active: true, leave_status: 'ACTIVE' };
}

function schedulingConfigRow(overrides: { buffer?: number | null } = {}) {
  return {
    konfiguracja: {
      travel_buffer_minutes: overrides.buffer === undefined ? 60 : overrides.buffer,
      default_workday_start: '08:00',
      default_workday_end: '16:00',
      default_weekdays: [1, 2, 3, 4, 5],
    },
  };
}

function exclusionViolationError40P01() {
  return Object.assign(
    new Error(
      'Invalid `prisma.booking.create()` invocation: deadlock detected (SQLSTATE 40P01) on exclusion constraint "bookings_no_overlap_per_resource"',
    ),
    { name: 'PrismaClientUnknownRequestError' },
  );
}

function exclusionViolationError23P01() {
  return Object.assign(
    new Error(
      'Invalid `prisma.booking.create()` invocation: conflicting key value violates exclusion constraint "bookings_no_overlap_per_resource" (SQLSTATE 23P01)',
    ),
    { name: 'PrismaClientUnknownRequestError' },
  );
}

beforeEach(() => {
  availabilityRuleFindManyMock.mockReset().mockResolvedValue([]);
  systemConfigFindUniqueMock.mockReset().mockResolvedValue(schedulingConfigRow());
  auditorFindManyMock.mockReset().mockResolvedValue([auditorRow('aud-1')]);
  crewFindManyMock.mockReset().mockResolvedValue([]);
  bookingFindManyMock.mockReset().mockResolvedValue([]);
  bookingCreateMock.mockReset();
  absenceFindManyMock.mockReset().mockResolvedValue([]);
  visitDurationBasketQueryMock.mockReset().mockResolvedValue(basketRow());
  availabilityDeclarationFindManyMock.mockReset().mockResolvedValue([]);

  bookingCreateMock.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'booking-generated',
    status: 'RESERVED',
    assignmentMode: 'AUTO',
    ...args.data,
  }));
});

describe('prepareBookingCandidates — rozbicie createBooking (WO B2C-LEAD-ATOMIC, P-2)', () => {
  // @REQ: B2C-LEAD-ATOMIC
  it('brak eksportu prepareBookingCandidates w @repo/scheduling (RED — WO żąda rozbicia P-2, dziś nie istnieje)', () => {
    expect(typeof scheduling.prepareBookingCandidates).toBe('function');
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('zwraca kandydatów WYŁĄCZNIE odczytem — bez żadnego prisma.booking.create', async () => {
    if (typeof scheduling.prepareBookingCandidates !== 'function') {
      throw new Error('prepareBookingCandidates nie istnieje jeszcze — patrz test poprzedni.');
    }
    const result = (await scheduling.prepareBookingCandidates({
      now: FIXED_NOW,
      visitBasketId: 'basket-audit',
      startAt: localMoment('2026-09-14', '08:00'),
    })) as { ok: boolean; candidates?: unknown[] };

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidates).toEqual([{ resource_id: 'aud-1', resource_kind: 'AUDITOR' }]);
    }
    expect(bookingCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('BASKET_NOT_FOUND/CONFIG_MISSING/SLOT_NOT_OFFERED — rozpoznane bez żadnego zapisu (te same kody co createBooking dzisiaj)', async () => {
    if (typeof scheduling.prepareBookingCandidates !== 'function') {
      throw new Error('prepareBookingCandidates nie istnieje jeszcze.');
    }
    visitDurationBasketQueryMock.mockResolvedValueOnce(null);
    const result = (await scheduling.prepareBookingCandidates({
      now: FIXED_NOW,
      visitBasketId: 'basket-nieistniejacy',
      startAt: localMoment('2026-09-14', '08:00'),
    })) as { ok: boolean; error?: { code: string } };

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('BASKET_NOT_FOUND');
    expect(bookingCreateMock).not.toHaveBeenCalled();
  });
});

describe('writeBookingCandidate — rozbicie createBooking (WO B2C-LEAD-ATOMIC, P-2)', () => {
  // @REQ: B2C-LEAD-ATOMIC
  it('brak eksportu writeBookingCandidate w @repo/scheduling (RED)', () => {
    expect(typeof scheduling.writeBookingCandidate).toBe('function');
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('sukces — DOKŁADNIE jeden prisma.booking.create, wołany na `tx` przekazanym jako pierwszy argument', async () => {
    if (typeof scheduling.writeBookingCandidate !== 'function') {
      throw new Error('writeBookingCandidate nie istnieje jeszcze.');
    }
    const fakeTx = { booking: { create: bookingCreateMock, findFirst: vi.fn() } };
    const result = (await scheduling.writeBookingCandidate(fakeTx, {
      visitBasketId: 'basket-audit',
      scheduledStart: localMoment('2026-09-14', '08:00'),
      scheduledEnd: localMoment('2026-09-14', '10:00'),
      resourceKind: 'AUDITOR',
      candidate: { resource_id: 'aud-1', resource_kind: 'AUDITOR' },
      subject: { kind: 'LEAD', leadId: 'lead-1' },
      bookedBy: 'CLIENT',
    })) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(bookingCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('40P01 (deadlock) NIE jest łapane — wydostaje się jako wyjątek, dokładnie jak 23P01 (WO: "40P01 traktowany jak 23P01" — ale traktowany przez WOŁAJĄCEGO, nie przez writeBookingCandidate)', async () => {
    if (typeof scheduling.writeBookingCandidate !== 'function') {
      throw new Error('writeBookingCandidate nie istnieje jeszcze.');
    }
    bookingCreateMock.mockRejectedValueOnce(exclusionViolationError40P01());
    const fakeTx = { booking: { create: bookingCreateMock, findFirst: vi.fn() } };

    await expect(
      scheduling.writeBookingCandidate!(fakeTx, {
        visitBasketId: 'basket-audit',
        scheduledStart: localMoment('2026-09-14', '08:00'),
        scheduledEnd: localMoment('2026-09-14', '10:00'),
        resourceKind: 'AUDITOR',
        candidate: { resource_id: 'aud-1', resource_kind: 'AUDITOR' },
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'CLIENT',
      }),
    ).rejects.toThrow();
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('23P01 (przegrany wyścig o zasób) NIE jest łapane — wydostaje się jako wyjątek (nie fail() domenowy) — to wołający decyduje o ponowieniu na innym kandydacie w NOWEJ transakcji', async () => {
    if (typeof scheduling.writeBookingCandidate !== 'function') {
      throw new Error('writeBookingCandidate nie istnieje jeszcze.');
    }
    bookingCreateMock.mockRejectedValueOnce(exclusionViolationError23P01());
    const fakeTx = { booking: { create: bookingCreateMock, findFirst: vi.fn() } };

    await expect(
      scheduling.writeBookingCandidate!(fakeTx, {
        visitBasketId: 'basket-audit',
        scheduledStart: localMoment('2026-09-14', '08:00'),
        scheduledEnd: localMoment('2026-09-14', '10:00'),
        resourceKind: 'AUDITOR',
        candidate: { resource_id: 'aud-1', resource_kind: 'AUDITOR' },
        subject: { kind: 'LEAD', leadId: 'lead-1' },
        bookedBy: 'CLIENT',
      }),
    ).rejects.toThrow();
  });
});

describe('Timeout transakcji Prismy — findAvailableSlots NIE może być wewnątrz $transaction (WO, "Przypadki brzegowe")', () => {
  // @REQ: B2C-LEAD-ATOMIC
  it('statyczny — apps/b2c-web/app/actions/saveLead.ts nie woła findAvailableSlots/prepareBookingCandidates WEWNĄTRZ prisma.$transaction(...)', () => {
    const saveLeadPath = path.resolve(__dirname, '../../../apps/b2c-web/app/actions/saveLead.ts');
    let source: string;
    try {
      source = readFileSync(saveLeadPath, 'utf-8');
    } catch {
      throw new Error(`saveLead.ts nie istnieje jeszcze w tej ścieżce: ${saveLeadPath}`);
    }

    const forbidden = [/findAvailableSlots/, /prepareBookingCandidates/];

    // Wydobywa treść KAŻDEGO wywołania `prisma.$transaction(` przez zrównoważenie
    // nawiasów — wzorzec "brace-balancing", nie zachłanny regex (patrz pamięć test-authora,
    // `feedback_delete_action_wave_pattern`).
    function extractBalancedCallBodies(src: string, marker: string): string[] {
      const bodies: string[] = [];
      let searchFrom = 0;
      for (;;) {
        const idx = src.indexOf(marker, searchFrom);
        if (idx === -1) break;
        const openParenIdx = idx + marker.length - 1;
        let depth = 0;
        let end = -1;
        for (let i = openParenIdx; i < src.length; i++) {
          if (src[i] === '(') depth++;
          else if (src[i] === ')') {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        if (end === -1) break;
        bodies.push(src.slice(openParenIdx, end + 1));
        searchFrom = end + 1;
      }
      return bodies;
    }

    const transactionBodies = extractBalancedCallBodies(source, 'prisma.$transaction(');
    // RED dopuszczalny: jeśli implementacja jeszcze nie woła $transaction wprost, ta lista
    // jest pusta i test przechodzi trywialnie — nie jest to fałszywy zielony, bo asercja
    // właściwa (brak findAvailableSlots wewnątrz) i tak obowiązuje na docelowym kodzie; dowód
    // realnego domknięcia AC1 (transakcja istnieje) jest w innych testach tego WO.
    for (const body of transactionBodies) {
      for (const pattern of forbidden) {
        expect(pattern.test(body)).toBe(false);
      }
    }
  });
});
