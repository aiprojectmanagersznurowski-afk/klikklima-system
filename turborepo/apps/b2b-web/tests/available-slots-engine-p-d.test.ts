import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fromZonedTime } from 'date-fns-tz';

/**
 * WO: docs/workorders/CAL-SLOT-ENGINE.md — grupy P (pula i kształt wyniku) i D (długość
 * wizyty i siatka). Wymaganie CAL-SLOT-ENGINE, kryteria AC-P1..AC-P5, AC-D1..AC-D5.
 *
 * Rozstrzygnięcia Michała 2026-09-10 (wpisane do WO jako ostateczne):
 *   D1 = wariant (a): siatka slotów wyprowadzona z duration+buffer, sloty startują o godzinie
 *   startu okna i co duration_minutes+travel_buffer_minutes, plus sloty domykające bezpośrednio
 *   po (koniec istniejącej rezerwacji + buffer). Żaden nowy parametr konfiguracyjny.
 *   D2 = wariant (a): dzienny limit (SLA.AUDITOR_DAILY_CAP) dotyczy WYŁĄCZNIE puli AUDITOR
 *   (testowane w pliku C/S/E).
 *
 * Stan zweryfikowany 2026-09-10: `apps/b2b-web/src/lib/schedule/available-slots.ts` NIE ISTNIEJE
 * (WO, sekcja "Brakuje"). `resourceKind` NIE jest parametrem wejściowym — pula wynika z
 * `visit_duration_baskets.pool` dla podanego `visitBasketId` (WO, "Proponowana sygnatura").
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM (wzorzec: availability-effective-read.test.ts):
 * jeżeli implementer wybierze inny kształt sygnatury/wyniku niż podany w WO, to TEST-DEFECT
 * do zgłoszenia w tej turze, nie powód do cichej zmiany testu.
 *
 * Metodologia (Ryzyka #1-2 z WO): mockujemy Prisma, NIE żywy Postgres — silnik tylko CZYTA
 * istniejące rezerwacje/nieobecności/koszyki, dane testowe to fixture'y zwracane przez
 * zamockowane `prisma.*.findMany`/`findUnique`, nie prawdziwe wiersze przechodzące przez
 * CHECK/trigger/EXCLUDE. Mocki modeli `booking`/`absence`/`audytorzy`/`zespoly_monterskie`
 * IGNORUJĄ argument `where` i zwracają pełny fixture — odpowiedzialność za filtrowanie
 * (per pula, per zakres) leży po stronie silnika, nie zakładamy filtrowania na poziomie
 * zapytania Prisma (WO nie precyzuje kształtu `where`, więc test nie może go zgadywać).
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function utcDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function hh(n: number): string {
  return String(n).padStart(2, '0');
}

const {
  availabilityRuleFindManyMock,
  systemConfigFindUniqueMock,
  auditorFindManyMock,
  crewFindManyMock,
  bookingFindManyMock,
  absenceFindManyMock,
  visitDurationBasketQueryMock,
  availabilityDeclarationFindManyMock,
} = vi.hoisted(() => ({
  availabilityRuleFindManyMock: vi.fn(),
  systemConfigFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  bookingFindManyMock: vi.fn(),
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
    booking: { findMany: bookingFindManyMock },
    absence: { findMany: absenceFindManyMock },
    // Nazwa metody Prisma nieznana z góry (findUnique vs findFirst po id) — oba klucze
    // wskazują TEN SAM mock, żeby test nie zgadywał, której implementer użyje.
    visitDurationBasket: { findUnique: visitDurationBasketQueryMock, findFirst: visitDurationBasketQueryMock },
    availabilityDeclaration: { findMany: availabilityDeclarationFindManyMock },
  },
}));

const { findAvailableSlots } = await import('@repo/scheduling');

function basketRow(
  overrides: Partial<{
    id: string;
    code: string;
    durationMinutes: number;
    pool: string;
    isActive: boolean;
  }> = {},
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
  overrides: { buffer?: number; start?: string; end?: string; weekdays?: number[] } = {},
) {
  return {
    konfiguracja: {
      travel_buffer_minutes: overrides.buffer ?? 60,
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

beforeEach(() => {
  availabilityRuleFindManyMock.mockReset();
  systemConfigFindUniqueMock.mockReset();
  auditorFindManyMock.mockReset();
  crewFindManyMock.mockReset();
  bookingFindManyMock.mockReset();
  absenceFindManyMock.mockReset();
  visitDurationBasketQueryMock.mockReset();
  availabilityDeclarationFindManyMock.mockReset();

  availabilityRuleFindManyMock.mockResolvedValue([]);
  systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow());
  auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-2')]);
  crewFindManyMock.mockResolvedValue([crewRow('crew-1')]);
  bookingFindManyMock.mockResolvedValue([]);
  absenceFindManyMock.mockResolvedValue([]);
  visitDurationBasketQueryMock.mockResolvedValue(basketRow());
  availabilityDeclarationFindManyMock.mockResolvedValue([]);
});

describe('findAvailableSlots — grupa P (pula i kształt wyniku), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-P1 — wynik jest per-pracownik: dwaj pracownicy z tym samym wolnym oknem dają DWA wpisy w resources, nie jeden', async () => {
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    expect(result.resources).toHaveLength(2);
    expect(result.resources.map((r) => r.resource_id).sort()).toEqual(['aud-1', 'aud-2']);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P2 — pula wynika z visit_duration_baskets.pool: koszyk AUDIT -> tylko audytorzy, INSTALL_STANDARD -> tylko ekipy, zbiory rozłączne', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ id: 'basket-audit', code: 'AUDIT', pool: 'AUDITOR' }));
    const auditResult = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    visitDurationBasketQueryMock.mockResolvedValue(
      basketRow({ id: 'basket-install', code: 'INSTALL_STANDARD', pool: 'CREW', durationMinutes: 480 }),
    );
    const installResult = await findAvailableSlots('basket-install', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    expect(auditResult.resources.every((r) => r.resource_kind === 'AUDITOR')).toBe(true);
    expect(installResult.resources.every((r) => r.resource_kind === 'CREW')).toBe(true);

    const auditIds = new Set(auditResult.resources.map((r) => r.resource_id));
    const installIds = new Set(installResult.resources.map((r) => r.resource_id));
    expect(auditIds.size).toBeGreaterThan(0);
    expect(installIds.size).toBeGreaterThan(0);
    for (const id of auditIds) expect(installIds.has(id)).toBe(false);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P3 (a, AUDITOR) — audytorzy.is_active=false wyklucza audytora z puli', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-blocked', { is_active: false })]);
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const ids = result.resources.map((r) => r.resource_id);
    expect(ids).not.toContain('aud-blocked');
    expect(ids).toContain('aud-1');
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P3 (a, CREW) — zespoly_monterskie.aktywny=false wyklucza ekipę z puli (INNA nazwa kolumny niż audytorzy.is_active)', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(
      basketRow({ id: 'basket-install', code: 'INSTALL_STANDARD', pool: 'CREW', durationMinutes: 480 }),
    );
    crewFindManyMock.mockResolvedValue([crewRow('crew-1'), crewRow('crew-blocked', { aktywny: false })]);
    const result = await findAvailableSlots('basket-install', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const ids = result.resources.map((r) => r.resource_id);
    expect(ids).not.toContain('crew-blocked');
    expect(ids).toContain('crew-1');
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P3 (b) — leave_status inny niż ACTIVE wyklucza pracownika z puli', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-vacation', { leave_status: 'VACATION' })]);
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    expect(result.resources.map((r) => r.resource_id)).not.toContain('aud-vacation');
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P3 (c) — availability_declarations.is_available=false wyklucza pracownika, BRAK wiersza deklaracji znaczy dostępny (fail-open)', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-declined')]);
    availabilityDeclarationFindManyMock.mockResolvedValue([
      { id: 'decl-1', auditorId: 'aud-declined', crewId: null, isAvailable: false },
      // aud-1: brak wiersza w ogóle — musi pozostać dostępny.
    ]);
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const ids = result.resources.map((r) => r.resource_id);
    expect(ids).not.toContain('aud-declined');
    expect(ids).toContain('aud-1');
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P4 — liczba zapytań (absences/bookings/visit_duration_baskets/scheduling_config) nie rośnie z liczbą dni ani wielkością puli: 30dni×5 vs 60dni×10', async () => {
    const smallPool = Array.from({ length: 5 }, (_, i) => auditorRow(`aud-p4-${i}`));
    const bigPool = Array.from({ length: 10 }, (_, i) => auditorRow(`aud-p4-${i}`));

    auditorFindManyMock.mockResolvedValue(smallPool);
    bookingFindManyMock.mockClear();
    absenceFindManyMock.mockClear();
    systemConfigFindUniqueMock.mockClear();
    visitDurationBasketQueryMock.mockClear();
    const small = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-01'),
      to: utcDay('2026-09-30'), // 30 dni
    });
    const smallCounts = {
      booking: bookingFindManyMock.mock.calls.length,
      absence: absenceFindManyMock.mock.calls.length,
      config: systemConfigFindUniqueMock.mock.calls.length,
      basket: visitDurationBasketQueryMock.mock.calls.length,
    };

    auditorFindManyMock.mockResolvedValue(bigPool);
    bookingFindManyMock.mockClear();
    absenceFindManyMock.mockClear();
    systemConfigFindUniqueMock.mockClear();
    visitDurationBasketQueryMock.mockClear();
    const big = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-01'),
      to: utcDay('2026-10-30'), // 60 dni
    });
    const bigCounts = {
      booking: bookingFindManyMock.mock.calls.length,
      absence: absenceFindManyMock.mock.calls.length,
      config: systemConfigFindUniqueMock.mock.calls.length,
      basket: visitDurationBasketQueryMock.mock.calls.length,
    };

    expect(small.resources).toHaveLength(5);
    expect(big.resources).toHaveLength(10);

    // Jedno zapytanie na całą pulę i cały zakres — niezależnie od 30/60 dni i 5/10 pracowników.
    expect(smallCounts.booking).toBe(1);
    expect(bigCounts.booking).toBe(1);
    expect(smallCounts.absence).toBe(1);
    expect(bigCounts.absence).toBe(1);
    expect(smallCounts.basket).toBeGreaterThan(0);
    expect(bigCounts.basket).toBe(smallCounts.basket);

    // scheduling_config: raz na wywołanie, NIE raz na pracownika.
    expect(smallCounts.config).toBe(1);
    expect(bigCounts.config).toBe(1);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-P5 — pula z zerem wolnych terminów (dzień poza dostępnością) to poprawny wynik, nie błąd: slots:[] per pracownik, error===null', async () => {
    // sobota 2026-09-19 — poza default_weekdays [1..5], brak reguł -> source NONE dla obu.
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-19'),
      to: utcDay('2026-09-19'),
    });
    expect(result.error).toBeNull();
    expect(result.resources.length).toBeGreaterThan(0);
    for (const r of result.resources) {
      expect(r.slots).toEqual([]);
    }
  });
});

describe('findAvailableSlots — grupa D (długość wizyty i siatka), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-D1 (funkcjonalny) — długość slotu pochodzi WYŁĄCZNIE z visit_duration_baskets.duration_minutes: zmiana 120->180 zmienia end_at-start_at', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    const r120 = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slot120 = r120.resources.find((r) => r.resource_id === 'aud-1')!.slots[0]!;
    expect(slot120.end_at.getTime() - slot120.start_at.getTime()).toBe(120 * 60000);
    expect(r120.duration_minutes).toBe(120);

    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 180 }));
    const r180 = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slot180 = r180.resources.find((r) => r.resource_id === 'aud-1')!.slots[0]!;
    expect(slot180.end_at.getTime() - slot180.start_at.getTime()).toBe(180 * 60000);
    expect(r180.duration_minutes).toBe(180);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-D1 (statyczny) — literały 120/90/240/480 nie występują w kodzie silnika', () => {
    const enginePath = path.join(__dirname, '..', '..', '..', 'packages', 'scheduling', 'src', 'available-slots.ts');
    expect(existsSync(enginePath)).toBe(true);
    const content = readFileSync(enginePath, 'utf-8');
    expect(content).not.toMatch(/\b120\b/);
    expect(content).not.toMatch(/\b90\b/);
    expect(content).not.toMatch(/\b240\b/);
    expect(content).not.toMatch(/\b480\b/);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-D2 — koszyk 480min w oknie 08:00-16:00 daje DOKŁADNIE jeden slot (08:00-16:00), slot nigdy nie przekracza końca okna', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 480 }));
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = result.resources.find((r) => r.resource_id === 'aud-1')!.slots;
    expect(slots).toHaveLength(1);
    expect(slots[0]!.start_at).toEqual(localMoment('2026-09-14', '08:00'));
    expect(slots[0]!.end_at).toEqual(localMoment('2026-09-14', '16:00'));
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-D2 — koszyk 481min w oknie 08:00-16:00 (480 minut) daje ZERO slotów', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 481 }));
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = result.resources.find((r) => r.resource_id === 'aud-1')!.slots;
    expect(slots).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-D3 — dzień z available=false (RULE_INACTIVE) nie generuje ani jednego slotu', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-solo')]);
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(1, '08:00', '16:00', false)]);
    // poniedziałek 2026-09-14 = ISODOW 1
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.resources.find((r) => r.resource_id === 'aud-solo')!.slots).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-D4 — koszyk nieaktywny (is_active=false) daje kontrolowany error, nie wyjątek i nie cichą listę slotów', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ isActive: false }));
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toEqual(expect.any(String));
    expect(result.error!.length).toBeGreaterThan(0);
    expect(result.resources).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-D5 — nieistniejący visitBasketId daje kontrolowany error, nigdy undefined.duration_minutes (bez wyjątku)', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(null);
    const result = await findAvailableSlots('basket-nieistniejacy', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    expect(result.error).toEqual(expect.any(String));
    expect(result.error!.length).toBeGreaterThan(0);
    expect(result.resources).toEqual([]);
  });
});
