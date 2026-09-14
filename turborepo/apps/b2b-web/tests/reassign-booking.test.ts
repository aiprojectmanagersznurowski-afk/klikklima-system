import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md — Faza B (nadpisanie przypisania przez
 * dyspozytora, `assignment_mode = 'MANUAL'`). Faza A (`create-booking.ts` / `bookings/actions.ts`
 * — `createBooking`/`createBookingAction`) jest już zaimplementowana i zacommitowana
 * (`1bd6cb4`); ten plik NIE testuje ponownie Fazy A.
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM — Faza B nie ma w WO sekcji "Proponowana
 * sygnatura" (tamta opisuje wyłącznie `createBooking`), więc sygnatura poniżej jest DECYZJĄ
 * test-authora, podjętą zgodnie z konwencją Fazy A i udokumentowaną tutaj jako wiążąca:
 *
 *   apps/b2b-web/src/lib/schedule/reassign-booking.ts
 *     export type ReassignBookingParams = { bookingId: string; newResourceId: string }
 *     export type ReassignBookingErrorCode =
 *       'BOOKING_NOT_FOUND' | 'ALREADY_RELEASED' | 'RESOURCE_TAKEN' | 'POOL_MISMATCH'
 *     export type ReassignBookingResult =
 *       | { ok: true; booking: BookingRow; error: null }
 *       | { ok: false; booking: null; error: { code: ReassignBookingErrorCode; message: string } }
 *     export async function reassignBooking(params: ReassignBookingParams): Promise<ReassignBookingResult>
 *
 *   apps/b2b-web/src/app/(dashboard)/bookings/actions.ts (DOPISANE do istniejącego pliku)
 *     export async function reassignBookingAction(input: unknown): Promise<ReassignBookingResult>
 *
 * Założenia test-authora, udokumentowane jawnie (nie ciche domniemania):
 *
 *  (1) `reassignBooking` NAJPIERW czyta bieżący wiersz (`prisma.booking.findUnique({ where: { id } })`),
 *      żeby poznać `resourceKind` (AUDITOR/CREW — decyduje, czy `newResourceId` ląduje w
 *      `auditorId` czy `crewId`) i `status` (brama ALREADY_RELEASED). Brak wiersza ->
 *      `BOOKING_NOT_FOUND`, zero zapisu.
 *  (2) Rezerwacja w statusie innym niż `RESERVED`/`CONFIRMED` (czyli `RELEASED`/`COMPLETED`) NIE
 *      jest legalnym celem przepięcia — WO tego nie rozstrzyga wprost dla Fazy B, ale
 *      przepinanie nieaktywnej rezerwacji nie ma sensu biznesowego (rekomendacja WO,
 *      "Przypadek brzegowy"). Kod błędu: `ALREADY_RELEASED`, zero zapisu.
 *  (3) Zapis idzie przez `prisma.booking.update({ where: { id: bookingId }, data })` — WO
 *      wskazuje (Kontekst kodu, R-2) że kolumny GENEROWANE (`resource_id`) dotyczą wyłącznie
 *      odczytu/unikalności, więc zwykły `update()` powinien działać bez `$queryRaw`, analogicznie
 *      do `prisma.booking.create()` w Fazie A. Jeżeli implementer stwierdzi, że `update()` naprawdę
     *      wymaga raw SQL — to TEST-DEFECT do zgłoszenia, nie cicha zmiana testu.
 *  (4) `data` przekazane do `update()` ustawia DOKŁADNIE jedno z `auditorId`/`crewId` (to
 *      wynikające z `resourceKind` bieżącego wiersza) na `newResourceId` oraz `assignmentMode:
 *      'MANUAL'`. Jeżeli implementer doda do `data` inne klucze (`visitBasketId`,
 *      `scheduledStart`, `scheduledEnd`, `status`) z NIEZMIENIONą wartością — test to toleruje;
 *      nie toleruje ZMIENIONEJ wartości tych pól (AC-B* + WO, "Przepięcie NIE zmienia...").
 *  (5) R-3 z Fazy A (rozpoznanie SQLSTATE z wyjątku Prismy) NIE jest tu importowane z
 *      `create-booking.ts` — `extractSqlState` nie jest tam eksportowane, a ten plik (Faza A)
 *      jest zamknięty i test-author go nie modyfikuje. Ten plik, tak jak `create-booking.test.ts`,
 *      testuje na poziomie ZACHOWANIA (wstrzykuje surowy błąd Prismy, sprawdza kod domenowy
 *      wynikowy), nie importując funkcji rozpoznającej SQLSTATE. Jeżeli implementer wydzieli
 *      wspólny moduł `sql-state.ts` między Fazą A i B — to nie zmienia kształtu tych testów.
 *  (6) RBAC: `contracts/rbac.contract.mjs` / `packages/contracts/src/generated/rbac.ts` mają dla
 *      `bookings` OSOBNĄ operację `assign: ['admin','dyspozytor']` (nie `update` — sprawdzone
 *      w pliku, nie zgadywane). `reassignBookingAction` MUSI bramkować przez
 *      `can(role, 'bookings', 'assign')`. Ponieważ `assign` i `update` mają dziś identyczny
 *      zestaw ról dla `bookings`, sama obserwacja przepuszczenia/odmowy ról nie odróżnia, której
 *      operacji użyto — dlatego ten plik DODATKOWO szpieguje wywołania `can()` i asercjuje
 *      literalnie `capability === 'assign'`, żeby przyszła zmiana macierzy (np. odebranie
 *      `dyspozytorowi` prawa `update`, zostawienie `assign`) nie przeszła cicho przez złą bramkę.
 *
 * Stan zmierzony (ta tura): `apps/b2b-web/src/lib/schedule/reassign-booking.ts` NIE ISTNIEJE i
 * `reassignBookingAction` nie jest eksportowana z `bookings/actions.ts`. Ten import ma się
 * wywalić brakiem modułu/eksportu — to jest poprawny stan RED tej tury.
 */

const {
  bookingFindUniqueMock,
  bookingUpdateMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  bookingFindUniqueMock: vi.fn(),
  bookingUpdateMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    booking: { findUnique: bookingFindUniqueMock, update: bookingUpdateMock },
  },
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

// Założenie (6): szpiegujemy `can()` przepuszczony przez oryginalną implementację, żeby
// asercjonować KTÓREJ capability używa bramka, nie tylko wynik.
const canCalls: Array<{ role: unknown; resource: unknown; capability: unknown }> = [];
vi.mock('@klikklima/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klikklima/contracts')>();
  return {
    ...actual,
    can: vi.fn((role: unknown, resource: unknown, capability: unknown) => {
      canCalls.push({ role, resource, capability });
      return actual.can(role as never, resource as never, capability as never);
    }),
  };
});

const { reassignBooking } = await import('../src/lib/schedule/reassign-booking');
const { reassignBookingAction } = await import('../src/app/(dashboard)/bookings/actions');

function bookingFixture(
  overrides: Partial<{
    id: string;
    resourceKind: string;
    auditorId: string | null;
    crewId: string | null;
    status: string;
    visitBasketId: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    assignmentMode: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'booking-1',
    leadId: 'lead-1',
    serviceId: null,
    incidentId: null,
    resourceKind: overrides.resourceKind ?? 'AUDITOR',
    visitBasketId: overrides.visitBasketId ?? 'basket-audit',
    auditorId: overrides.auditorId ?? 'aud-old',
    crewId: overrides.crewId ?? null,
    scheduledStart: overrides.scheduledStart ?? new Date('2026-09-14T08:00:00.000Z'),
    scheduledEnd: overrides.scheduledEnd ?? new Date('2026-09-14T10:00:00.000Z'),
    status: overrides.status ?? 'RESERVED',
    bookedBy: 'DISPATCHER',
    assignmentMode: overrides.assignmentMode ?? 'AUTO',
  };
}

/** R-3 (Faza A), kształt raw/P2010+meta.code — powtórzone tu na potrzeby AC-B2/AC-B3. */
function exclusionViolationErrorRaw() {
  return Object.assign(
    new Error('Raw query failed. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "bookings_no_overlap_per_resource"`'),
    {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: { code: '23P01', message: 'ERROR: conflicting key value violates exclusion constraint "bookings_no_overlap_per_resource"' },
    },
  );
}

function poolMismatchErrorRaw() {
  return Object.assign(
    new Error('Raw query failed. Code: `23514`. Message: `new row for relation "bookings" violates check constraint via trigger "bookings_pool_matches_basket_trg"`'),
    {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: { code: '23514', message: 'ERROR: new row for relation "bookings" violates check constraint via trigger "bookings_pool_matches_basket_trg"' },
    },
  );
}

beforeEach(() => {
  bookingFindUniqueMock.mockReset();
  bookingUpdateMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  canCalls.length = 0;

  bookingFindUniqueMock.mockResolvedValue(bookingFixture());
  bookingUpdateMock.mockImplementation(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
    ...bookingFixture(),
    ...args.data,
  }));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
});

describe('reassignBooking — Faza B (MANUAL), FLD-BOOKING-ATOMIC-ASSIGN', () => {
  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-B1 — udane przepięcie ustawia assignment_mode MANUAL i przenosi wykonawcę', async () => {
    bookingFindUniqueMock.mockResolvedValue(bookingFixture({ resourceKind: 'AUDITOR', auditorId: 'aud-old' }));

    const result = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'aud-new' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(bookingUpdateMock).toHaveBeenCalledTimes(1);

    const data = bookingUpdateMock.mock.calls[0]![0].data;
    const assignmentMode = data.assignmentMode ?? data['assignment_mode'];
    expect(assignmentMode).toBe('MANUAL');

    const auditorId = data.auditorId ?? data['auditor_id'];
    expect(auditorId).toBe('aud-new');

    expect(result.booking.assignmentMode ?? result.booking['assignment_mode']).toBe('MANUAL');
    expect(result.booking.auditorId ?? result.booking['auditor_id']).toBe('aud-new');
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-B1 — pula CREW: newResourceId ląduje w crewId, nie auditorId', async () => {
    bookingFindUniqueMock.mockResolvedValue(
      bookingFixture({ resourceKind: 'CREW', auditorId: null, crewId: 'crew-old' }),
    );

    const result = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'crew-new' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const data = bookingUpdateMock.mock.calls[0]![0].data;
    const crewId = data.crewId ?? data['crew_id'];
    expect(crewId).toBe('crew-new');
    const auditorId = data.auditorId ?? data['auditor_id'] ?? null;
    expect(auditorId).toBeNull();
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-B2 — przepięcie na osobę już zajętą w oknie: 23P01 z UPDATE zamienione na błąd domenowy RESOURCE_TAKEN, nie wyjątek', async () => {
    bookingUpdateMock.mockRejectedValue(exclusionViolationErrorRaw());

    const result = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'aud-busy' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('RESOURCE_TAKEN');
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('AC-B3 — przepięcie na pracownika z niewłaściwej puli: 23514 z bookings_pool_matches_basket_trg zamienione na POOL_MISMATCH', async () => {
    bookingUpdateMock.mockRejectedValue(poolMismatchErrorRaw());

    const result = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'crew-1' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('POOL_MISMATCH');
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('rezerwacja nieistniejąca -> BOOKING_NOT_FOUND, zero zapisu', async () => {
    bookingFindUniqueMock.mockResolvedValue(null);

    const result = await reassignBooking({ bookingId: 'booking-nieistniejaca', newResourceId: 'aud-new' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.error.code).toBe('BOOKING_NOT_FOUND');
    expect(bookingUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it.each(['RELEASED', 'COMPLETED'])(
    'przepięcie rezerwacji w statusie %s -> ALREADY_RELEASED, zero zapisu (założenie test-authora, patrz nagłówek pliku)',
    async (status) => {
      bookingFindUniqueMock.mockResolvedValue(bookingFixture({ status }));

      const result = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'aud-new' });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('ALREADY_RELEASED');
      expect(bookingUpdateMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('przepięcie NIE zmienia visit_basket_id, scheduled_start, scheduled_end, status — jeżeli klucze są obecne w data, wartość jest NIEZMIENIONA', async () => {
    const original = bookingFixture({
      visitBasketId: 'basket-audit',
      scheduledStart: new Date('2026-09-14T08:00:00.000Z'),
      scheduledEnd: new Date('2026-09-14T10:00:00.000Z'),
      status: 'RESERVED',
    });
    bookingFindUniqueMock.mockResolvedValue(original);

    await reassignBooking({ bookingId: 'booking-1', newResourceId: 'aud-new' });

    const data = bookingUpdateMock.mock.calls[0]![0].data;

    const visitBasketId = data.visitBasketId ?? data['visit_basket_id'];
    if (visitBasketId !== undefined) expect(visitBasketId).toBe(original.visitBasketId);

    const scheduledStart = data.scheduledStart ?? data['scheduled_start'];
    if (scheduledStart !== undefined) expect(new Date(scheduledStart as never).getTime()).toBe(original.scheduledStart.getTime());

    const scheduledEnd = data.scheduledEnd ?? data['scheduled_end'];
    if (scheduledEnd !== undefined) expect(new Date(scheduledEnd as never).getTime()).toBe(original.scheduledEnd.getTime());

    const status = data.status;
    if (status !== undefined) expect(status).toBe(original.status);
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('idempotencja — drugie przepięcie na TEN SAM zasób nie tworzy dodatkowego skutku (jeden update, ten sam cel)', async () => {
    const first = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'aud-new' });
    expect(first.ok).toBe(true);

    // Drugie wywołanie widzi wiersz JUŻ przepięty (atrapa symuluje odczyt po pierwszym zapisie).
    bookingFindUniqueMock.mockResolvedValue(bookingFixture({ auditorId: 'aud-new', assignmentMode: 'MANUAL' }));

    const second = await reassignBooking({ bookingId: 'booking-1', newResourceId: 'aud-new' });

    expect(second.ok).toBe(true);
    expect(bookingUpdateMock).toHaveBeenCalledTimes(2);
    const secondData = bookingUpdateMock.mock.calls[1]![0].data;
    const auditorId = secondData.auditorId ?? secondData['auditor_id'];
    expect(auditorId).toBe('aud-new');
  });
});

describe('reassignBookingAction — bramka uprawnień (RBAC: bookings.assign, NIE bookings.update)', () => {
  const VALID_PAYLOAD = { bookingId: 'booking-1', newResourceId: 'aud-new' };

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it.each(['audytor', 'monter'])(
    'rola %s dostaje odmowę (ok:false) i NIE wykonuje żadnego zapytania zapisującego ani odczytu domenowego',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      const result = await reassignBookingAction(VALID_PAYLOAD);
      expect(result.ok).toBe(false);
      expect(bookingUpdateMock).not.toHaveBeenCalled();
      expect(bookingFindUniqueMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it.each(['dyspozytor', 'admin'])('rola %s przechodzi bramkę i akcja próbuje zapisać', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    const result = await reassignBookingAction(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    expect(bookingUpdateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('brak roli (sesja nieznana) jest odmową, nie wyjątkiem', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    const result = await reassignBookingAction(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    expect(bookingUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it('bramka używa capability "assign", NIE "update" (RBAC, contracts/rbac.contract.mjs: bookings.assign jest osobną operacją)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    await reassignBookingAction(VALID_PAYLOAD);

    const bookingsCalls = canCalls.filter((c) => c.resource === 'bookings');
    expect(bookingsCalls.length).toBeGreaterThan(0);
    expect(bookingsCalls.every((c) => c.capability === 'assign')).toBe(true);
    expect(bookingsCalls.some((c) => c.capability === 'update')).toBe(false);
  });
});
