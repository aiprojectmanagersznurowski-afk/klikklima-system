import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fromZonedTime } from 'date-fns-tz';
import { SLA } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CAL-SLOT-ENGINE.md — grupy A (nieobecności), B (rezerwacje),
 * T (bufor dojazdu), C (dzienny limit wizyt), S (strefa czasowa i granice),
 * E (stany błędne). Wymaganie CAL-SLOT-ENGINE, kryteria AC-A1..AC-A5, AC-B1..AC-B5,
 * AC-T1..AC-T6, AC-C1..AC-C7, AC-S1..AC-S3, AC-E1..AC-E3, oraz „przypadki brzegowe,
 * które MUSZĄ mieć test" z sekcji o tej samej nazwie w WO.
 *
 * Konwencja mockowania SKOPIOWANA 1:1 z `available-slots-engine-p-d.test.ts`, żeby oba
 * pliki działały niezależnie (osobne moduły vitest, osobne rejestry mocków — nazwy
 * zmiennych na poziomie modułu mogą się powtórzyć bez kolizji).
 *
 * Rozstrzygnięcia Michała 2026-09-10 (te same, co w pliku P/D): D1 = wariant (a) —
 * siatka slotów wyprowadzona z duration+buffer, bez nowego parametru konfiguracyjnego.
 * D2 = wariant (a) — dzienny limit (`SLA.AUDITOR_DAILY_CAP`) dotyczy WYŁĄCZNIE puli AUDITOR.
 *
 * Stan zweryfikowany 2026-09-10: `apps/b2b-web/src/lib/schedule/available-slots.ts`
 * NIE ISTNIEJE. `resourceKind` NIE jest parametrem wejściowym — pula wynika z
 * `visit_duration_baskets.pool`.
 *
 * TRZY ADAPTACJE nieoczywistych przykładów z WO (opisane tu, żeby implementer i review
 * wiedzieli, że to świadoma decyzja test-authora, nie TEST-DEFECT):
 *
 * 1) AC-T2 WO podaje przykład „slot 12:30–14:00 znika, a 11:00–13:00 zostaje" przy
 *    rezerwacji 14:00–16:00 — te dwa sloty mają różną długość (90 i 120 min), co nie
 *    może zachodzić dla jednego koszyka. Test poniżej realizuje TĘ SAMĄ zasadę
 *    (symetryczny bufor „od tyłu", z tą samą wartością graniczną — równo bufor
 *    dopuszczone, bufor minus minuta odrzucone) na własnych, wewnętrznie spójnych
 *    liczbach (koszyk 90 min): slot kończący się dokładnie o 13:00 (bufor=60 do
 *    rezerwacji o 14:00) jest dopuszczony, slot kończący się o 13:30 (bufor=30) odrzucony.
 *
 * 2) AC-C4 WO podaje przykład „rezerwacja o 23:30 czasu lokalnego" jako dowód na dobę
 *    lokalną kontra UTC. Warszawa ma ZAWSZE przesunięcie względem UTC w stronę
 *    DODATNIĄ (+1/+2), więc 23:30 lokalnie w czasie letnim to 21:30 UTC TEGO SAMEGO
 *    dnia — nie przecina granicy doby UTC i nie demonstruje różnicy. Różnicę
 *    demonstruje odczyt WCZESNORANNY (np. 00:30 lokalnie = 22:30 UTC dnia
 *    POPRZEDNIEGO). Test poniżej używa 00:30 lokalnie z tego samego powodu, dla
 *    którego WO chciało dowieść tę różnicę (naiwne grupowanie po dacie UTC
 *    przypisałoby rezerwację do złej doby).
 *
 * 3) AC-E2: sygnatura `findAvailableSlots` (WO, „Proponowana sygnatura") nie ma pola
 *    błędu PER-PRACOWNIK — `error` jest tylko na szczycie wyniku. Test sprawdza więc,
 *    że (a) `error` na szczycie wyniku jest ustawiony i (b) pracownik, którego dotyczy
 *    błąd materializacji dostępności, nie wnosi żadnych slotów — bez zakładania, czy
 *    implementacja w tej sytuacji całkowicie zeruje resztę wyniku, czy nie (WO tego
 *    nie precyzuje dla błędu per-pracownik, w odróżnieniu od AC-D4/AC-D5, gdzie błąd
 *    dotyczy całego wywołania).
 *
 * Metodologia (jak w pliku P/D): mockujemy Prisma, dane testowe to fixture'y z
 * zamockowanych `findMany`/`findUnique`. Mocki modeli ignorują `where` domyślnie
 * (odpowiedzialność za filtrowanie leży w silniku) — tam, gdzie test potrzebuje
 * zróżnicowania per pracownik (bo silnik prawdopodobnie woła regułę per-resource,
 * tak jak `getEffectiveAvailability` dziś), używamy `mockImplementation` czytającego
 * `where` WYŁĄCZNIE w tych konkretnych testach (oznaczone w komentarzu przy teście).
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function utcDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
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

let bookingCounter = 0;
function bookingRow(
  overrides: Partial<{
    id: string;
    auditorId: string | null;
    crewId: string | null;
    resourceKind: 'AUDITOR' | 'CREW';
    scheduledStart: Date;
    scheduledEnd: Date;
    status: string;
  }> & { scheduledStart: Date; scheduledEnd: Date },
) {
  bookingCounter += 1;
  return {
    id: overrides.id ?? `booking-${bookingCounter}`,
    auditorId: overrides.auditorId ?? null,
    crewId: overrides.crewId ?? null,
    resourceKind: overrides.resourceKind ?? 'AUDITOR',
    scheduledStart: overrides.scheduledStart,
    scheduledEnd: overrides.scheduledEnd,
    status: overrides.status ?? 'RESERVED',
  };
}

let absenceCounter = 0;
function absenceRow(
  overrides: Partial<{
    id: string;
    auditorId: string | null;
    crewId: string | null;
    reason: string;
  }> & { startsAt: Date; endsAt: Date },
) {
  absenceCounter += 1;
  return {
    id: overrides.id ?? `absence-${absenceCounter}`,
    auditorId: overrides.auditorId ?? null,
    crewId: overrides.crewId ?? null,
    startsAt: overrides.startsAt,
    endsAt: overrides.endsAt,
    reason: overrides.reason ?? 'OTHER',
    note: null,
    createdBy: null,
  };
}

function slotsFor(result: Awaited<ReturnType<typeof findAvailableSlots>>, resourceId: string) {
  return result.resources.find((r) => r.resource_id === resourceId)?.slots ?? [];
}

beforeEach(() => {
  bookingCounter = 0;
  absenceCounter = 0;

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
  auditorFindManyMock.mockResolvedValue([auditorRow('aud-1')]);
  crewFindManyMock.mockResolvedValue([crewRow('crew-1')]);
  bookingFindManyMock.mockResolvedValue([]);
  absenceFindManyMock.mockResolvedValue([]);
  visitDurationBasketQueryMock.mockResolvedValue(basketRow());
  availabilityDeclarationFindManyMock.mockResolvedValue([]);
});

describe('findAvailableSlots — grupa A (odjęcie nieobecności), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-A1 — nieobecność nakładająca się na slot usuwa go', async () => {
    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '10:00'), endsAt: localMoment('2026-09-14', '12:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const slots = slotsFor(result, 'aud-1');
    for (const slot of slots) {
      const overlaps =
        slot.start_at.getTime() < localMoment('2026-09-14', '12:00').getTime() &&
        slot.end_at.getTime() > localMoment('2026-09-14', '10:00').getTime();
      expect(overlaps).toBe(false);
    }
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-A2 — nieobecność wielodniowa usuwa wszystkie sloty objętych dni, dni poza zakresem zostają nietknięte', async () => {
    absenceFindManyMock.mockResolvedValue([
      absenceRow({
        auditorId: 'aud-1',
        startsAt: localMoment('2026-09-14', '00:00'),
        endsAt: localMoment('2026-09-16', '00:00'),
      }),
    ]);
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-17'),
    });
    const byDate = new Map<string, ReturnType<typeof slotsFor>>();
    for (const slot of slotsFor(result, 'aud-1')) {
      byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
    }
    expect(byDate.get('2026-09-14') ?? []).toEqual([]);
    expect(byDate.get('2026-09-15') ?? []).toEqual([]);
    // 2026-09-16 — nieobecność się kończy o 00:00, więc cały dzień jest poza zakresem
    // nieobecności (styk, nie kolizja, AC-A3).
    expect((byDate.get('2026-09-16') ?? []).length).toBeGreaterThan(0);
    expect((byDate.get('2026-09-17') ?? []).length).toBeGreaterThan(0);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-A3 — styk godzinowy nie jest kolizją: nieobecność kończąca się o 10:00 nie usuwa slotu 10:00–12:00, zaczynająca się o 12:00 nie usuwa slotu 10:00–12:00', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));

    // Nieobecność kończy się dokładnie o 10:00 — nie powinna dotknąć slotu 10:00-12:00.
    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '08:00'), endsAt: localMoment('2026-09-14', '10:00') }),
    ]);
    const resultEndTouch = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const slotsEndTouch = slotsFor(resultEndTouch, 'aud-1');
    expect(
      slotsEndTouch.some(
        (s) =>
          s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime() &&
          s.end_at.getTime() === localMoment('2026-09-14', '12:00').getTime(),
      ),
    ).toBe(true);

    // Nieobecność zaczyna się dokładnie o 12:00 — nie powinna dotknąć slotu 10:00-12:00.
    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '12:00'), endsAt: localMoment('2026-09-14', '14:00') }),
    ]);
    const resultStartTouch = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const slotsStartTouch = slotsFor(resultStartTouch, 'aud-1');
    expect(
      slotsStartTouch.some(
        (s) =>
          s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime() &&
          s.end_at.getTime() === localMoment('2026-09-14', '12:00').getTime(),
      ),
    ).toBe(true);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-A4 — nakładające się nieobecności (dwa wiersze na to samo okno) dają ten sam wynik co jedna, bez podwójnego odjęcia i bez duplikatu', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));

    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '10:00'), endsAt: localMoment('2026-09-14', '12:00') }),
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '11:00'), endsAt: localMoment('2026-09-14', '13:00') }),
    ]);
    const resultOverlapping = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '10:00'), endsAt: localMoment('2026-09-14', '13:00') }),
    ]);
    const resultUnion = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    const normalize = (r: typeof resultOverlapping) =>
      slotsFor(r, 'aud-1')
        .map((s) => s.start_at.getTime())
        .sort();
    expect(normalize(resultOverlapping)).toEqual(normalize(resultUnion));

    const starts = slotsFor(resultOverlapping, 'aud-1').map((s) => s.start_at.getTime());
    expect(new Set(starts).size).toBe(starts.length);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-A5 — bufor dojazdu NIE jest doliczany wokół nieobecności: nieobecność 08:00–10:00 z buforem 60 min zostawia slot zaczynający się o 10:00', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '08:00'), endsAt: localMoment('2026-09-14', '10:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });
    const slots = slotsFor(result, 'aud-1');
    expect(slots.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime())).toBe(true);
    // Żaden slot nie zaczyna się przed końcem nieobecności.
    for (const slot of slots) {
      expect(slot.start_at.getTime()).toBeGreaterThanOrEqual(localMoment('2026-09-14', '10:00').getTime());
    }
  });
});

describe('findAvailableSlots — grupa B (odjęcie rezerwacji), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-B1 — rezerwacja RESERVED usuwa nakładające się sloty', async () => {
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '10:00'), scheduledEnd: localMoment('2026-09-14', '12:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    for (const slot of slotsFor(result, 'aud-1')) {
      const overlaps =
        slot.start_at.getTime() < localMoment('2026-09-14', '12:00').getTime() &&
        slot.end_at.getTime() > localMoment('2026-09-14', '10:00').getTime();
      expect(overlaps).toBe(false);
    }
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-B1 — rezerwacja CONFIRMED usuwa nakładające się sloty', async () => {
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'CONFIRMED', scheduledStart: localMoment('2026-09-14', '10:00'), scheduledEnd: localMoment('2026-09-14', '12:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    for (const slot of slotsFor(result, 'aud-1')) {
      const overlaps =
        slot.start_at.getTime() < localMoment('2026-09-14', '12:00').getTime() &&
        slot.end_at.getTime() > localMoment('2026-09-14', '10:00').getTime();
      expect(overlaps).toBe(false);
    }
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-B2 — rezerwacja RELEASED nie blokuje slotu', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RELEASED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    expect(slots.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '08:00').getTime())).toBe(true);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-B2 — rezerwacja COMPLETED nie blokuje slotu', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'COMPLETED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    expect(slots.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '08:00').getTime())).toBe(true);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-B3 — rezerwacja u innego pracownika nie usuwa slotu temu pracownikowi (per-osoba, nigdy globalne)', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-2')]);
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-2', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '16:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(slotsFor(result, 'aud-1').length).toBeGreaterThan(0);
    expect(slotsFor(result, 'aud-2').length).toBe(0);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-B4 — blokada porównywana na utrwalonych scheduled_start/scheduled_end, zmiana duration_minutes w słowniku PO FAKCIE nie przesuwa istniejącej blokady', async () => {
    // Rezerwacja utrwalona jako 08:00-10:00 (2h), NIEZALEŻNIE od tego, że koszyk teraz ma 480 min.
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 480 }));
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    // Koszyk 480 min w oknie 08-16 z rezerwacją utrwaloną na 08:00-10:00 (nie 08:00-16:00):
    // jedyny możliwy slot 08:00-16:00 nakłada się na blokadę 08:00-10:00 -> zero slotów.
    // Gdyby silnik przeliczał blokadę na nowo z duration_minutes=480, wynik byłby ten sam
    // przez przypadek — dlatego osobno sprawdzamy krótszy koszyk, gdzie różnica jest widoczna.
    expect(slotsFor(result, 'aud-1')).toEqual([]);

    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 60 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const resultShort = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slotsShort = slotsFor(resultShort, 'aud-1');
    // Blokada utrwalona 08:00-10:00 (2h) — NIE 08:00-08:60 (gdyby przeliczona z duration=60).
    // Slot 10:00-11:00 musi być wolny, a żaden slot nie może zaczynać się przed 10:00.
    expect(slotsShort.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime())).toBe(true);
    for (const slot of slotsShort) {
      expect(slot.start_at.getTime()).toBeGreaterThanOrEqual(localMoment('2026-09-14', '10:00').getTime());
    }
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-B5 — styk godzinowy rezerwacji: rezerwacja 08:00–10:00 zostawia slot 10:00–12:00 wolnym (z zastrzeżeniem bufora AC-T1)', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    expect(
      slots.some(
        (s) =>
          s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime() &&
          s.end_at.getTime() === localMoment('2026-09-14', '12:00').getTime(),
      ),
    ).toBe(true);
  });
});

describe('findAvailableSlots — grupa T (bufor dojazdu), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-T1 — bufor po poprzedniej wizycie: rezerwacja 08:00–10:00 z buforem 60 min odrzuca slot 10:00–12:00, przyjmuje slot 11:00–13:00', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    expect(
      slots.some(
        (s) =>
          s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime() &&
          s.end_at.getTime() === localMoment('2026-09-14', '12:00').getTime(),
      ),
    ).toBe(false);
    expect(
      slots.some(
        (s) =>
          s.start_at.getTime() === localMoment('2026-09-14', '11:00').getTime() &&
          s.end_at.getTime() === localMoment('2026-09-14', '13:00').getTime(),
      ),
    ).toBe(true);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-T2 — bufor przed następną wizytą (patrz adaptacja #1 w nagłówku pliku): rezerwacja 14:00–16:00 z buforem 60 min dopuszcza slot kończący się o 13:00, odrzuca kończący się o 13:30', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 90 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60, start: '08:00', end: '16:00' }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '14:00'), scheduledEnd: localMoment('2026-09-14', '16:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    // Kończy się dokładnie o 13:00 -> bufor do 14:00 = 60 min = dopuszczone.
    expect(slots.some((s) => s.end_at.getTime() === localMoment('2026-09-14', '13:00').getTime())).toBe(true);
    // Żaden slot nie może kończyć się PO 13:00 (gap < 60 min do rezerwacji 14:00).
    for (const slot of slots) {
      if (slot.start_at.getTime() < localMoment('2026-09-14', '14:00').getTime()) {
        expect(slot.end_at.getTime()).toBeLessThanOrEqual(localMoment('2026-09-14', '13:00').getTime());
      }
    }
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-T3 — bufor NIE jest wymagany na krawędziach okna pracy: pierwszy slot zaczyna się dokładnie o starcie okna, ostatni kończy dokładnie o jego końcu', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60, start: '08:00', end: '16:00' }));
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    expect(slots.length).toBeGreaterThan(0);
    const starts = slots.map((s) => s.start_at.getTime());
    const ends = slots.map((s) => s.end_at.getTime());
    expect(Math.min(...starts)).toBe(localMoment('2026-09-14', '08:00').getTime());
    expect(Math.max(...ends)).toBe(localMoment('2026-09-14', '16:00').getTime());
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-T4 — bufor liczony wyłącznie między wizytami TEJ SAMEJ osoby: rezerwacja innego pracownika o 09:00 nie odsuwa slotu temu pracownikowi', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-1'), auditorRow('aud-2')]);
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-2', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '09:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    expect(slots.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '08:00').getTime())).toBe(true);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-T5 (funkcjonalny) — wartość bufora pochodzi z scheduling_config.travel_buffer_minutes: 60->30 zamienia odrzucony slot na zaproponowany', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 90 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);

    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
    const withBuffer60 = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots60 = slotsFor(withBuffer60, 'aud-1');
    // Kandydat naturalny z siatki (08:00 + 90+60 = 10:30) — gap do końca rezerwacji (10:00) = 30 min < 60.
    expect(slots60.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '10:30').getTime())).toBe(false);

    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 30 }));
    const withBuffer30 = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots30 = slotsFor(withBuffer30, 'aud-1');
    // Ten sam kandydat 10:30 — gap 30 min >= bufor 30 -> dopuszczony.
    expect(slots30.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '10:30').getTime())).toBe(true);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-T5 (statyczny) — literał 60 nie występuje w kodzie silnika', () => {
    const enginePath = path.join(__dirname, '..', '..', '..', 'packages', 'scheduling', 'src', 'available-slots.ts');
    expect(existsSync(enginePath)).toBe(true);
    const content = readFileSync(enginePath, 'utf-8');
    expect(content).not.toMatch(/\b60\b/);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-T6 — bufor stosuje wyłącznie silnik (test celuje w wynik silnika, nie w wyjątek z bazy)', async () => {
    // Rezerwacja 08:00-10:00 z buforem 60 -> slot 10:00-12:00 (styk, bez bufora byłby legalny
    // z punktu widzenia bookings_no_overlap_per_resource) MUSI zostać odfiltrowany przez SAM
    // WYNIK silnika, bez rzucania wyjątku (baza nie zna bufora i nigdy nie odrzuci go sama).
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    await expect(
      findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') }),
    ).resolves.not.toThrow();
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toBeNull();
    expect(
      slotsFor(result, 'aud-1').some(
        (s) =>
          s.start_at.getTime() === localMoment('2026-09-14', '10:00').getTime() &&
          s.end_at.getTime() === localMoment('2026-09-14', '12:00').getTime(),
      ),
    ).toBe(false);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('wartość graniczna bufora — dokładnie równy travel_buffer_minutes dopuszczony, żaden slot poniżej tej granicy nie istnieje', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 120 }));
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '08:00'), scheduledEnd: localMoment('2026-09-14', '10:00') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');
    // Granica: 10:00 + 60 = 11:00, dokładnie równy bufor -> dopuszczony.
    expect(slots.some((s) => s.start_at.getTime() === localMoment('2026-09-14', '11:00').getTime())).toBe(true);
    // Żaden slot nie zaczyna się poniżej tej granicy (bufor minus choćby minuta -> odrzucone).
    for (const slot of slots) {
      expect(slot.start_at.getTime()).toBeGreaterThanOrEqual(localMoment('2026-09-14', '11:00').getTime());
    }
  });
});

describe('findAvailableSlots — grupa C (dzienny limit wizyt), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-C1 — literał 5 nie występuje w kodzie silnika (wartość limitu pochodzi z SLA.AUDITOR_DAILY_CAP.count)', () => {
    expect(SLA.AUDITOR_DAILY_CAP.count).toBe(5);
    const enginePath = path.join(__dirname, '..', '..', '..', 'packages', 'scheduling', 'src', 'available-slots.ts');
    expect(existsSync(enginePath)).toBe(true);
    const content = readFileSync(enginePath, 'utf-8');
    expect(content).not.toMatch(/\b5\b/);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-C2 — dzień z AUDITOR_DAILY_CAP wizyt (RESERVED/CONFIRMED) nie generuje ani jednego slotu, mimo wolnego miejsca w oknie pracy', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const cap = SLA.AUDITOR_DAILY_CAP.count;
    const bookings = Array.from({ length: cap }, (_, i) =>
      bookingRow({
        auditorId: 'aud-1',
        status: 'RESERVED',
        scheduledStart: localMoment('2026-09-14', `0${8 + i}:00`.slice(-5)),
        scheduledEnd: localMoment('2026-09-14', `0${8 + i}:10`.slice(-5)),
      }),
    );
    bookingFindManyMock.mockResolvedValue(bookings);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(slotsFor(result, 'aud-1')).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-C3 — dzień z (cap-1) wizyt generuje sloty normalnie: limit odcina dopiero po osiągnięciu, nie przed', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const capMinusOne = SLA.AUDITOR_DAILY_CAP.count - 1;
    const bookings = Array.from({ length: capMinusOne }, (_, i) =>
      bookingRow({
        auditorId: 'aud-1',
        status: 'RESERVED',
        scheduledStart: localMoment('2026-09-14', `0${8 + i}:00`.slice(-5)),
        scheduledEnd: localMoment('2026-09-14', `0${8 + i}:10`.slice(-5)),
      }),
    );
    bookingFindManyMock.mockResolvedValue(bookings);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(slotsFor(result, 'aud-1').length).toBeGreaterThan(0);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-C4 — limit liczony na dobę LOKALNĄ Europe/Warsaw, nie na dobę UTC (patrz adaptacja #2 w nagłówku pliku)', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const cap = SLA.AUDITOR_DAILY_CAP.count;
    // 00:15..00:15+cap*5min lokalnie w noc z 2026-09-14 na 2026-09-15 -> to jest doba LOKALNA
    // 2026-09-15 (wtorek), a w UTC (offset +2 w czasie letnim) to 2026-09-14 22:15... — czyli
    // doba UTC POPRZEDNIA. Naiwne grupowanie po UTC przypisałoby te rezerwacje do 2026-09-14
    // i limit dla 2026-09-15 by NIE zadziałał.
    const bookings = Array.from({ length: cap }, (_, i) => {
      const start = localMoment('2026-09-15', `00:${String(15 + i * 5).padStart(2, '0')}`);
      const end = new Date(start.getTime() + 3 * 60000);
      return bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: start, scheduledEnd: end });
    });
    bookingFindManyMock.mockResolvedValue(bookings);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-15') });
    expect(slotsFor(result, 'aud-1').filter((s) => s.date === '2026-09-14').length).toBeGreaterThan(0);
    expect(slotsFor(result, 'aud-1').filter((s) => s.date === '2026-09-15')).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-C5 — limit liczony per pracownik i per doba, nie narastająco: wyczerpanie limitu w poniedziałek nie odcina wtorku', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const cap = SLA.AUDITOR_DAILY_CAP.count;
    const bookings = Array.from({ length: cap }, (_, i) =>
      bookingRow({
        auditorId: 'aud-1',
        status: 'RESERVED',
        scheduledStart: localMoment('2026-09-14', `0${8 + i}:00`.slice(-5)),
        scheduledEnd: localMoment('2026-09-14', `0${8 + i}:10`.slice(-5)),
      }),
    );
    bookingFindManyMock.mockResolvedValue(bookings);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-15') });
    expect(slotsFor(result, 'aud-1').filter((s) => s.date === '2026-09-14')).toEqual([]);
    expect(slotsFor(result, 'aud-1').filter((s) => s.date === '2026-09-15').length).toBeGreaterThan(0);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-C6 — do limitu liczą się tylko RESERVED/CONFIRMED; COMPLETED (5 wizyt) nie odcina dnia', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const cap = SLA.AUDITOR_DAILY_CAP.count;
    const bookings = Array.from({ length: cap }, (_, i) =>
      bookingRow({
        auditorId: 'aud-1',
        status: 'COMPLETED',
        scheduledStart: localMoment('2026-09-14', `0${8 + i}:00`.slice(-5)),
        scheduledEnd: localMoment('2026-09-14', `0${8 + i}:10`.slice(-5)),
      }),
    );
    bookingFindManyMock.mockResolvedValue(bookings);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(slotsFor(result, 'aud-1').length).toBeGreaterThan(0);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-C7 — limit dotyczy WYŁĄCZNIE puli AUDITOR: pula CREW z 10 rezerwacjami w jednym dniu generuje sloty normalnie (z zastrzeżeniem A/B/T)', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ id: 'basket-install', code: 'INSTALL_SMALL', pool: 'CREW', durationMinutes: 60 }));
    crewFindManyMock.mockResolvedValue([crewRow('crew-1')]);
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const bookings = Array.from({ length: 10 }, (_, i) =>
      bookingRow({
        crewId: 'crew-1',
        resourceKind: 'CREW',
        status: 'RESERVED',
        scheduledStart: new Date(localMoment('2026-09-14', '08:00').getTime() + i * 5 * 60000),
        scheduledEnd: new Date(localMoment('2026-09-14', '08:00').getTime() + i * 5 * 60000 + 2 * 60000),
      }),
    );
    bookingFindManyMock.mockResolvedValue(bookings);
    const result = await findAvailableSlots('basket-install', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toBeNull();
    expect(slotsFor(result, 'crew-1').length).toBeGreaterThan(0);
  });
});

describe('findAvailableSlots — grupa S (strefa czasowa i granice), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-S1 — okno dnia bierze się z materializacji już-w-UTC (fromZonedTime), silnik nie robi własnej arytmetyki offsetów', async () => {
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slot = slotsFor(result, 'aud-1')[0]!;
    expect(slot.start_at).toEqual(localMoment('2026-09-14', '08:00'));
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-S2 — doba zmiany czasu 2026-03-29 (23h, CET->CEST): reguła 8-16 daje lokalny start 08:00 = 06:00 UTC', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(7, '08:00', '16:00')]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-03-29'), to: utcDay('2026-03-29') });
    const slot = slotsFor(result, 'aud-1')[0]!;
    expect(slot.start_at).toEqual(localMoment('2026-03-29', '08:00'));
    expect(slot.start_at).toEqual(new Date('2026-03-29T06:00:00.000Z'));
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-S2 — doba zmiany czasu 2026-10-25 (25h, CEST->CET): reguła 8-16 daje lokalny start 08:00 = 07:00 UTC', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(7, '08:00', '16:00')]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-10-25'), to: utcDay('2026-10-25') });
    const slot = slotsFor(result, 'aud-1')[0]!;
    expect(slot.start_at).toEqual(localMoment('2026-10-25', '08:00'));
    expect(slot.start_at).toEqual(new Date('2026-10-25T07:00:00.000Z'));
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-S3 — pole date to data LOKALNA, nie toISOString().slice(0,10) na start_at: wizyta o 00:30 lokalnie (Warszawa) leży w innej dobie UTC', async () => {
    // Okno 00:30-03:00 (150 min) — musi zmieścić w całości domyślny koszyk (120 min, AC-D2);
    // okno 00:30-02:00 (90 min) z poprzedniej wersji testu było fizycznie za krótkie na
    // 120-minutową wizytę i gwarantowało zero slotów niezależnie od implementacji (TEST-DEFECT).
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(1, '00:30', '03:00')]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slot = slotsFor(result, 'aud-1')[0]!;
    // 2026-09-14 00:30 czasu Warszawy (CEST, +2) = 2026-09-13T22:30:00.000Z — data UTC to
    // 2026-09-13, ale pole `date` musi zostać LOKALNE: 2026-09-14.
    expect(slot.start_at.toISOString().slice(0, 10)).toBe('2026-09-13');
    expect(slot.date).toBe('2026-09-14');
  });
});

describe('findAvailableSlots — grupa E (stany błędne), CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('AC-E1 — brak travel_buffer_minutes w scheduling_config daje kontrolowany error i PUSTĄ listę (fail-closed, bufor 0 jako domyślny jest ZABRONIONY)', async () => {
    systemConfigFindUniqueMock.mockResolvedValue({
      konfiguracja: {
        default_workday_start: '08:00',
        default_workday_end: '16:00',
        default_weekdays: [1, 2, 3, 4, 5],
        // travel_buffer_minutes celowo brak
      },
    });
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toEqual(expect.any(String));
    expect(result.error!.length).toBeGreaterThan(0);
    expect(result.resources).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-E1 — brak wiersza scheduling_config w ogóle daje kontrolowany error i PUSTĄ listę', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(null);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toEqual(expect.any(String));
    expect(result.resources).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-E2 — error materializacji dostępności dla jednego pracownika (brak reguł + config domyślny niepoprawny) jest propagowany, ten pracownik nie wnosi slotów (patrz adaptacja #3 w nagłówku pliku)', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-with-rule'), auditorRow('aud-no-rule')]);
    // aud-with-rule ma własną regułę (nie zależy od domyślnej konfiguracji).
    // aud-no-rule nie ma ŻADNEJ reguły -> zależy od scheduling_config, który tu jest niepoprawny.
    availabilityRuleFindManyMock.mockImplementation(async (args: { where?: { auditorId?: string } }) => {
      if (args?.where?.auditorId === 'aud-with-rule') {
        return [ruleRow(1, '08:00', '16:00')];
      }
      return [];
    });
    systemConfigFindUniqueMock.mockResolvedValue({
      konfiguracja: {
        default_workday_start: '08:00',
        // default_workday_end celowo brak -> konfiguracja niepoprawna
        default_weekdays: [1, 2, 3, 4, 5],
      },
    });
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toEqual(expect.any(String));
    const brokenResourceSlots = result.resources.find((r) => r.resource_id === 'aud-no-rule')?.slots ?? [];
    expect(brokenResourceSlots).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('AC-E3 — zakres dat odwrócony (to < from) daje pustą listę i error, nigdy pętli nieskończonej', async () => {
    const result = await findAvailableSlots('basket-audit', {
      from: utcDay('2026-09-20'),
      to: utcDay('2026-09-14'),
    });
    expect(result.error).toEqual(expect.any(String));
    expect(result.resources).toEqual([]);
  });
});

describe('findAvailableSlots — przypadki brzegowe wymagane przez WO, CAL-SLOT-ENGINE', () => {
  // @REQ: CAL-SLOT-ENGINE
  it('pracownik bez ani jednej reguły (fallback DEFAULT z scheduling_config) obok pracownika z własnymi regułami — oba trafiają do wyniku z właściwym oknem', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-with-rule'), auditorRow('aud-default')]);
    availabilityRuleFindManyMock.mockImplementation(async (args: { where?: { auditorId?: string } }) => {
      if (args?.where?.auditorId === 'aud-with-rule') {
        return [ruleRow(1, '09:00', '17:00')];
      }
      return [];
    });
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ start: '08:00', end: '16:00', buffer: 0 }));
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });

    const withRuleSlots = slotsFor(result, 'aud-with-rule');
    const defaultSlots = slotsFor(result, 'aud-default');
    expect(Math.min(...withRuleSlots.map((s) => s.start_at.getTime()))).toBe(localMoment('2026-09-14', '09:00').getTime());
    expect(Math.max(...withRuleSlots.map((s) => s.end_at.getTime()))).toBe(localMoment('2026-09-14', '17:00').getTime());
    expect(Math.min(...defaultSlots.map((s) => s.start_at.getTime()))).toBe(localMoment('2026-09-14', '08:00').getTime());
    expect(Math.max(...defaultSlots.map((s) => s.end_at.getTime()))).toBe(localMoment('2026-09-14', '16:00').getTime());
  });

  // @REQ: CAL-SLOT-ENGINE
  it('koszyk całodniowy (480 min) w oknie 08:00–16:00: jakakolwiek rezerwacja tego dnia zeruje dzień (bufor nie pozwala się zmieścić w resztkach okna)', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 480 }));
    bookingFindManyMock.mockResolvedValue([
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '12:00'), scheduledEnd: localMoment('2026-09-14', '12:10') }),
    ]);
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(slotsFor(result, 'aud-1')).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('pusta pula (zero aktywnych pracowników): resources:[], error===null, bez wyjątku', async () => {
    auditorFindManyMock.mockResolvedValue([]);
    await expect(
      findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') }),
    ).resolves.not.toThrow();
    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    expect(result.error).toBeNull();
    expect(result.resources).toEqual([]);
  });

  // @REQ: CAL-SLOT-ENGINE
  it('idempotencja odczytu: dwa wywołania z tymi samymi danymi dają identyczny wynik w identycznej kolejności, sloty posortowane rosnąco po start_at', async () => {
    auditorFindManyMock.mockResolvedValue([auditorRow('aud-3'), auditorRow('aud-1'), auditorRow('aud-2')]);
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 0 }));
    const result1 = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-16') });
    const result2 = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-16') });

    expect(result1.resources.map((r) => r.resource_id)).toEqual(result2.resources.map((r) => r.resource_id));
    expect(
      result1.resources.map((r) => r.slots.map((s) => s.start_at.getTime())),
    ).toEqual(result2.resources.map((r) => r.slots.map((s) => s.start_at.getTime())));

    for (const resource of result1.resources) {
      const starts = resource.slots.map((s) => s.start_at.getTime());
      const sorted = [...starts].sort((a, b) => a - b);
      expect(starts).toEqual(sorted);
    }
  });

  // @REQ: CAL-SLOT-ENGINE
  it('wszystkie składniki naraz na jednym dniu (nieobecność + rezerwacja + wizyta sąsiadująca w odstępie < bufor + cap-1 wizyt): wynik końcowy nie zawiera ani jednego slotu naruszającego którykolwiek składnik, kolejność odejmowania nie ma znaczenia', async () => {
    visitDurationBasketQueryMock.mockResolvedValue(basketRow({ durationMinutes: 60 }));
    // Okno wydłużone do 17:00: z absencją 08:00-09:00, wizytą-sąsiadem 09:30-10:30 (bufor do
    // 11:30) i trzema wypełniaczami o 12:00/13:00/14:00 (bufor 60 wokół każdego) jedyny
    // matematycznie możliwy wolny slot zaczyna się o 15:05 (14:05 + bufor 60) i trwa 60 min,
    // czyli kończy się o 16:05. Przy oknie 08:00-16:00 (z poprzedniej wersji testu) ten
    // kandydat wypadał 5 minut PO końcu okna pracy — dzień był matematycznie w pełni zajęty
    // niezależnie od implementacji (TEST-DEFECT). Wydłużenie do 17:00 zachowuje cel testu
    // (cap nieosiągnięty, wszystkie 4 składniki nadal aktywne) i dopuszcza jedyny legalny slot.
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ buffer: 60, start: '08:00', end: '17:00' }));

    absenceFindManyMock.mockResolvedValue([
      absenceRow({ auditorId: 'aud-1', startsAt: localMoment('2026-09-14', '08:00'), endsAt: localMoment('2026-09-14', '09:00') }),
    ]);

    const capMinusOne = SLA.AUDITOR_DAILY_CAP.count - 1; // = 4, obejmuje też wizytę-sąsiada poniżej
    const bookings = [
      // Wizyta "sąsiadująca" — po niej bufor 60 min blokuje kolejny slot do 11:30.
      bookingRow({ auditorId: 'aud-1', status: 'RESERVED', scheduledStart: localMoment('2026-09-14', '09:30'), scheduledEnd: localMoment('2026-09-14', '10:30') }),
      ...Array.from({ length: capMinusOne - 1 }, (_, i) =>
        bookingRow({
          auditorId: 'aud-1',
          status: 'RESERVED',
          scheduledStart: localMoment('2026-09-14', `1${2 + i}:00`.slice(-5)),
          scheduledEnd: localMoment('2026-09-14', `1${2 + i}:05`.slice(-5)),
        }),
      ),
    ];
    bookingFindManyMock.mockResolvedValue(bookings);

    const result = await findAvailableSlots('basket-audit', { from: utcDay('2026-09-14'), to: utcDay('2026-09-14') });
    const slots = slotsFor(result, 'aud-1');

    // Cap nie osiągnięty (4 wizyty < 5) -> dzień nie jest zerowany przez limit.
    expect(slots.length).toBeGreaterThan(0);

    for (const slot of slots) {
      // Żaden slot nie nakłada się na nieobecność 08:00-09:00.
      const overlapsAbsence =
        slot.start_at.getTime() < localMoment('2026-09-14', '09:00').getTime() &&
        slot.end_at.getTime() > localMoment('2026-09-14', '08:00').getTime();
      expect(overlapsAbsence).toBe(false);

      // Żaden slot nie nakłada się na wizytę-sąsiada 09:30-10:30.
      const overlapsBooking =
        slot.start_at.getTime() < localMoment('2026-09-14', '10:30').getTime() &&
        slot.end_at.getTime() > localMoment('2026-09-14', '09:30').getTime();
      expect(overlapsBooking).toBe(false);

      // Żaden slot nie zaczyna się w oknie bufora po wizycie-sąsiedzie (10:30 + 60 = 11:30),
      // jeśli zaczyna się po niej i przed granicą bufora.
      if (slot.start_at.getTime() >= localMoment('2026-09-14', '10:30').getTime()) {
        expect(slot.start_at.getTime()).toBeGreaterThanOrEqual(localMoment('2026-09-14', '11:30').getTime());
      }
    }
  });
});
