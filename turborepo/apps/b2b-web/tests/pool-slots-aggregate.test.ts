import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fromZonedTime } from 'date-fns-tz';
import type { AvailableSlot, ResourceSlots, AvailableSlotsResult } from '../src/lib/schedule/available-slots';

/**
 * WO: docs/workorders/CAL-POOL-AGGREGATE.md — wymaganie CAL-POOL-AGGREGATE, kryteria AC1..AC18.
 *
 * Stan zweryfikowany 2026-09-14: `apps/b2b-web/src/lib/schedule/pool-slots.ts` NIE ISTNIEJE.
 * Ten import ma się wywalić brakiem modułu — to jest poprawny stan RED tej tury (analogicznie
 * do `create-booking.test.ts` i `available-slots-engine-p-d.test.ts` w tym samym repo).
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM: sygnatura z sekcji "Proponowana sygnatura" WO
 * jest kontraktem — inny kształt wybrany przez implementera to TEST-DEFECT do zgłoszenia,
 * nie powód do cichej zmiany testu.
 *
 * DECYZJA METODOLOGICZNA test-authora (WO delegował decyzję, nie precyzuje wprost):
 * `findPoolSlots` jest CZYSTYM przekładem `AvailableSlotsResult` -> `PoolSlotsResult` (WO,
 * "Proponowana sygnatura" + "W zakresie"). Ten plik mockuje bezpośrednio moduł
 * `../src/lib/schedule/available-slots` (funkcję `findAvailableSlots`), NIE Prismę —
 * z dwóch powodów:
 *   1. AC8 wprost wymaga skonstruowania przypadku (dwa sloty o tym samym `start_at`, różnym
 *      `end_at`) który WO nazywa "dziś nieosiągalnym z realnych danych silnika" — silnik
 *      wylicza `end_at` deterministycznie z jednego `duration_minutes` na cały wynik, więc
 *      ten przypadek NIE da się skonstruować żadnym zestawem fixture'ów Prismy. Jedyny sposób
 *      to spreparowanie zwróconego `AvailableSlotsResult` na poziomie mocka funkcji.
 *   2. Przedmiotem wymagania jest TRANSFORMACJA, nie odczyt z bazy (R-5 WO) — mockowanie na
 *      granicy `findAvailableSlots` testuje dokładnie tę granicę, bez przypadkowego
 *      sprzężenia z detalami silnika (nazwy kolumn, kształt `where`), które nie są
 *      przedmiotem tego WO.
 * Osobny test "brak gwarancji atomowości" mockuje DODATKOWO `@repo/database` rejestrującym
 * proxy, żeby dowieść, że `findPoolSlots` nie sięga do Prismy w ogóle (nie tylko że nie
 * blokuje/rezerwuje — że nie ma tam żadnego zapytania).
 *
 * DECYZJA test-authora dla AC16 (kształt błędu walidacji `limit`): WO explicite delegował
 * tę decyzję test-authorowi. Wybór: `limit` ujemny albo nie-całkowity powoduje ODRZUCONY
 * (rejected) Promise z `Error` (funkcja jest `async`, więc to jest naturalny mechanizm
 * propagacji błędu programisty-wywołującego — w odróżnieniu od `error` w wyniku, który jest
 * zarezerwowany dla błędów SILNIKA, patrz AC11/AC12). Jeżeli implementer wybierze inny
 * kształt (np. `error` w wyniku), to jest TEST-DEFECT do zgłoszenia w tej turze, nie powód
 * do cichej zmiany testu.
 */

const TIME_ZONE = 'Europe/Warsaw';

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

const { findAvailableSlotsMock, prismaCallLog } = vi.hoisted(() => ({
  findAvailableSlotsMock: vi.fn(),
  prismaCallLog: [] as string[],
}));

vi.mock('../src/lib/schedule/available-slots', () => ({
  findAvailableSlots: findAvailableSlotsMock,
}));

// Proxy „rejestrujący": dowodzi, że `findPoolSlots` NIE dotyka Prismy w żadnej formie
// (przypadek brzegowy „brak gwarancji atomowości" / brak blokady/rezerwacji).
vi.mock('@repo/database', () => ({
  prisma: new Proxy(
    {},
    {
      get(_target, model: string) {
        return new Proxy(
          {},
          {
            get(_t2, method: string) {
              return (..._args: unknown[]) => {
                prismaCallLog.push(`${model}.${method}`);
                return Promise.resolve(undefined);
              };
            },
          },
        );
      },
    },
  ),
}));

const { findPoolSlots } = await import('../src/lib/schedule/pool-slots');

function mkSlot(startAt: Date, endAt: Date, date: string): AvailableSlot {
  return { start_at: startAt, end_at: endAt, date };
}

function mkResource(resourceId: string, resourceKind: 'AUDITOR' | 'CREW', slots: AvailableSlot[]): ResourceSlots {
  return { resource_id: resourceId, resource_kind: resourceKind, slots };
}

function engineResult(
  resources: ResourceSlots[],
  overrides: Partial<Omit<AvailableSlotsResult, 'resources'>> = {},
): AvailableSlotsResult {
  return {
    resources,
    duration_minutes: overrides.duration_minutes ?? 120,
    travel_buffer_minutes: overrides.travel_buffer_minutes ?? 60,
    error: overrides.error ?? null,
  };
}

const RANGE = { from: localMoment('2026-09-14', '00:00'), to: localMoment('2026-09-20', '00:00') };

beforeEach(() => {
  findAvailableSlotsMock.mockReset();
  prismaCallLog.length = 0;
});

describe('findPoolSlots — anonimizacja i kształt wyniku, CAL-POOL-AGGREGATE', () => {
  // @REQ: CAL-POOL-AGGREGATE
  it('AC1 — każdy element wyniku ma DOKŁADNIE klucze start_at, end_at, date (strukturalnie, nie toEqual)', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([
        mkResource('aud-1', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')]),
        mkResource('aud-2', 'AUDITOR', [mkSlot(localMoment('2026-09-15', '08:00'), localMoment('2026-09-15', '10:00'), '2026-09-15')]),
      ]),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      expect(Object.keys(slot).sort()).toEqual(['date', 'end_at', 'start_at']);
    }
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC2 — resource_id z odpowiedzi silnika nie pojawia się w JSON.stringify(result) w ŻADNEJ postaci', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([
        mkResource('aud-tajny-id-123', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')]),
      ]),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(JSON.stringify(result)).not.toContain('aud-tajny-id-123');
  });
});

describe('findPoolSlots — unia zbiorów, nie suma liczb, CAL-POOL-AGGREGATE', () => {
  // @REQ: CAL-POOL-AGGREGATE
  it('AC3 — slot oferowany przez DOKŁADNIE jednego pracownika trafia na listę', async () => {
    const startAt = localMoment('2026-09-14', '08:00');
    const endAt = localMoment('2026-09-14', '10:00');
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-1', 'AUDITOR', [mkSlot(startAt, endAt, '2026-09-14')]), mkResource('aud-2', 'AUDITOR', [])]),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.slots.some((s) => s.start_at.getTime() === startAt.getTime())).toBe(true);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC4 — slot oferowany przez TRZECH pracowników o identycznym start_at pojawia się DOKŁADNIE RAZ', async () => {
    const startAt = localMoment('2026-09-14', '08:00');
    const endAt = localMoment('2026-09-14', '10:00');
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([
        mkResource('aud-1', 'AUDITOR', [mkSlot(startAt, endAt, '2026-09-14')]),
        mkResource('aud-2', 'AUDITOR', [mkSlot(startAt, endAt, '2026-09-14')]),
        mkResource('aud-3', 'AUDITOR', [mkSlot(startAt, endAt, '2026-09-14')]),
      ]),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    const occurrences = result.slots.filter((s) => s.start_at.getTime() === startAt.getTime());
    expect(occurrences).toHaveLength(1);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC5 — liczność listy jest niezależna od liczby pracowników oferujących ten sam komplet slotów (dwa przebiegi identyczne)', async () => {
    const startAtA = localMoment('2026-09-14', '08:00');
    const endAtA = localMoment('2026-09-14', '10:00');
    const startAtB = localMoment('2026-09-14', '11:00');
    const endAtB = localMoment('2026-09-14', '13:00');
    const sharedSlots = [mkSlot(startAtA, endAtA, '2026-09-14'), mkSlot(startAtB, endAtB, '2026-09-14')];

    findAvailableSlotsMock.mockResolvedValueOnce(
      engineResult([mkResource('aud-1', 'AUDITOR', sharedSlots), mkResource('aud-2', 'AUDITOR', sharedSlots)]),
    );
    const twoEmployees = await findPoolSlots('basket-audit', RANGE);

    findAvailableSlotsMock.mockResolvedValueOnce(
      engineResult([
        mkResource('aud-1', 'AUDITOR', sharedSlots),
        mkResource('aud-2', 'AUDITOR', sharedSlots),
        mkResource('aud-3', 'AUDITOR', sharedSlots),
        mkResource('aud-4', 'AUDITOR', sharedSlots),
        mkResource('aud-5', 'AUDITOR', sharedSlots),
      ]),
    );
    const fiveEmployees = await findPoolSlots('basket-audit', RANGE);

    expect(twoEmployees).toEqual(fiveEmployees);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC6 — slot znika dopiero, gdy przestaje być wolny u OSTATNIEGO pracownika', async () => {
    const startAt = localMoment('2026-09-14', '08:00');
    const endAt = localMoment('2026-09-14', '10:00');
    const slot = mkSlot(startAt, endAt, '2026-09-14');

    findAvailableSlotsMock.mockResolvedValueOnce(engineResult([mkResource('aud-1', 'AUDITOR', [slot]), mkResource('aud-2', 'AUDITOR', [slot])]));
    const both = await findPoolSlots('basket-audit', RANGE);
    expect(both.slots.some((s) => s.start_at.getTime() === startAt.getTime())).toBe(true);

    findAvailableSlotsMock.mockResolvedValueOnce(engineResult([mkResource('aud-1', 'AUDITOR', [slot]), mkResource('aud-2', 'AUDITOR', [])]));
    const oneLeft = await findPoolSlots('basket-audit', RANGE);
    expect(oneLeft.slots.some((s) => s.start_at.getTime() === startAt.getTime())).toBe(true);

    findAvailableSlotsMock.mockResolvedValueOnce(engineResult([mkResource('aud-1', 'AUDITOR', []), mkResource('aud-2', 'AUDITOR', [])]));
    const none = await findPoolSlots('basket-audit', RANGE);
    expect(none.slots.some((s) => s.start_at.getTime() === startAt.getTime())).toBe(false);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC7 — lista jest posortowana rosnąco po start_at niezależnie od kolejności pracowników zwróconej przez silnik', async () => {
    const late = mkSlot(localMoment('2026-09-16', '08:00'), localMoment('2026-09-16', '10:00'), '2026-09-16');
    const middle = mkSlot(localMoment('2026-09-15', '08:00'), localMoment('2026-09-15', '10:00'), '2026-09-15');
    const early = mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14');

    // Pracownicy podani w kolejności ODWROTNEJ do chronologicznej ich slotów.
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-late', 'AUDITOR', [late]), mkResource('aud-middle', 'AUDITOR', [middle]), mkResource('aud-early', 'AUDITOR', [early])]),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    const starts = result.slots.map((s) => s.start_at.getTime());
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
    expect(starts[0]).toBe(early.start_at.getTime());
    expect(starts[starts.length - 1]).toBe(late.start_at.getTime());
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC8 — dedup WYŁĄCZNIE po start_at: dwa sloty o tym samym start_at, różnym end_at, nie trafiają OBA na listę; wygrywa pierwszy w porządku (pierwszy w kolejności pracowników)', async () => {
    const sharedStart = localMoment('2026-09-14', '08:00');
    const firstResourceSlot = mkSlot(sharedStart, localMoment('2026-09-14', '09:00'), '2026-09-14');
    const secondResourceSlot = mkSlot(sharedStart, localMoment('2026-09-14', '09:30'), '2026-09-14');

    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-first', 'AUDITOR', [firstResourceSlot]), mkResource('aud-second', 'AUDITOR', [secondResourceSlot])]),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    const matching = result.slots.filter((s) => s.start_at.getTime() === sharedStart.getTime());
    expect(matching).toHaveLength(1);
    expect(matching[0]!.end_at.getTime()).toBe(firstResourceSlot.end_at.getTime());
  });
});

describe('findPoolSlots — pula wynika z typu wizyty, CAL-POOL-AGGREGATE', () => {
  // @REQ: CAL-POOL-AGGREGATE
  it('AC9 — koszyk puli AUDITOR i koszyk puli CREW dają rozłączne zbiory slotów pochodzące z rozłącznych zbiorów pracowników', async () => {
    const auditorSlot = mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14');
    const crewSlot = mkSlot(localMoment('2026-09-15', '08:00'), localMoment('2026-09-15', '16:00'), '2026-09-15');

    findAvailableSlotsMock.mockImplementation(async (basketId: string) => {
      if (basketId === 'basket-audit') {
        return engineResult([mkResource('aud-1', 'AUDITOR', [auditorSlot])]);
      }
      return engineResult([mkResource('crew-1', 'CREW', [crewSlot])]);
    });

    const auditResult = await findPoolSlots('basket-audit', RANGE);
    const installResult = await findPoolSlots('basket-install', RANGE);

    const auditStarts = new Set(auditResult.slots.map((s) => s.start_at.getTime()));
    const installStarts = new Set(installResult.slots.map((s) => s.start_at.getTime()));
    expect(auditStarts.size).toBeGreaterThan(0);
    expect(installStarts.size).toBeGreaterThan(0);
    for (const t of auditStarts) expect(installStarts.has(t)).toBe(false);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC10 — nadmiarowe pole żądania (np. pool: "CREW") nie wpływa na wynik: przebieg z nim i bez niego identyczny', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-1', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')])]),
    );

    // Zmienna nazwana (nie literał obiektowy) obchodzi kontrolę nadmiarowych właściwości TS
    // bez rzutowania na typ uniwersalny (zakazane w tym repo). Kształt jest zamierzony:
    // rozszerzony o pole, którego `findPoolSlots` NIE przyjmuje w sygnaturze.
    const optionsWithExtraField: { limit?: number; pool?: string } = { limit: 5, pool: 'CREW' };
    const withExtra = await findPoolSlots('basket-audit', RANGE, optionsWithExtraField);
    const withoutExtra = await findPoolSlots('basket-audit', RANGE, { limit: 5 });

    expect(withExtra).toEqual(withoutExtra);
  });
});

describe('findPoolSlots — przeniesienie błędów silnika, CAL-POOL-AGGREGATE', () => {
  // @REQ: CAL-POOL-AGGREGATE
  it('AC11 — error i resources:[] z silnika (koszyk nieistniejący/wycofany/zakres odwrócony/brak bufora) daje slots:[] i TEN SAM komunikat', async () => {
    const message = 'Koszyk wizyty o identyfikatorze "basket-nieistniejacy" nie istnieje.';
    findAvailableSlotsMock.mockResolvedValue(engineResult([], { error: message }));
    const result = await findPoolSlots('basket-nieistniejacy', RANGE);
    expect(result.slots).toEqual([]);
    expect(result.error).toBe(message);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC12 — wynik CZĘŚCIOWY (error ustawiony, ale część pracowników wniosła sloty) przechodzi jako sloty ORAZ error, nie jedno albo drugie', async () => {
    const message = 'Nie udało się zmaterializować dostępności dla jednego z pracowników.';
    const startAt = localMoment('2026-09-14', '08:00');
    findAvailableSlotsMock.mockResolvedValue(
      engineResult(
        [mkResource('aud-ok', 'AUDITOR', [mkSlot(startAt, localMoment('2026-09-14', '10:00'), '2026-09-14')]), mkResource('aud-broken', 'AUDITOR', [])],
        { error: message },
      ),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.error).toBe(message);
    expect(result.slots.some((s) => s.start_at.getTime() === startAt.getTime())).toBe(true);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC13 — duration_minutes i travel_buffer_minutes przepisane z wyniku silnika bez zmiany', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-1', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')])], {
        duration_minutes: 137,
        travel_buffer_minutes: 42,
      }),
    );
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.duration_minutes).toBe(137);
    expect(result.travel_buffer_minutes).toBe(42);
  });
});

describe('findPoolSlots — limit i brak nowych literałów, CAL-POOL-AGGREGATE', () => {
  function sevenDistinctSlots(): AvailableSlot[] {
    return Array.from({ length: 7 }, (_, i) =>
      mkSlot(localMoment('2026-09-14', `0${8 + i}:00`.slice(-5)), localMoment('2026-09-14', `0${9 + i}:00`.slice(-5)), '2026-09-14'),
    );
  }

  // @REQ: CAL-POOL-AGGREGATE
  it('AC14 — bez limit funkcja NIE obcina listy', async () => {
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', sevenDistinctSlots())]));
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.slots).toHaveLength(7);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC15 — limit: 5 zwraca pięć PIERWSZYCH CHRONOLOGICZNIE slotów', async () => {
    const slots = sevenDistinctSlots();
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', slots)]));
    const result = await findPoolSlots('basket-audit', RANGE, { limit: 5 });
    expect(result.slots).toHaveLength(5);
    const expectedFirstFive = [...slots].sort((a, b) => a.start_at.getTime() - b.start_at.getTime()).slice(0, 5);
    expect(result.slots.map((s) => s.start_at.getTime())).toEqual(expectedFirstFive.map((s) => s.start_at.getTime()));
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC16 — limit: 0 zwraca pustą listę i error: null (jawny wybór wywołującego)', async () => {
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', sevenDistinctSlots())]));
    const result = await findPoolSlots('basket-audit', RANGE, { limit: 0 });
    expect(result.slots).toEqual([]);
    expect(result.error).toBeNull();
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC16 — limit ujemny jest błędem walidacji (Promise odrzucony), nie cichym slice', async () => {
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', sevenDistinctSlots())]));
    await expect(findPoolSlots('basket-audit', RANGE, { limit: -1 })).rejects.toThrow(/limit/i);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC16 — limit nie-całkowity (2.5) jest błędem walidacji (Promise odrzucony), nie cichym slice', async () => {
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', sevenDistinctSlots())]));
    await expect(findPoolSlots('basket-audit', RANGE, { limit: 2.5 })).rejects.toThrow(/limit/i);
  });
});

describe('findPoolSlots — przypadki brzegowe (WO, "Przypadki brzegowe, które MUSZĄ mieć test")', () => {
  // @REQ: CAL-POOL-AGGREGATE
  it('pula pusta (zero pracowników) daje slots:[] i error: null — rozróżnialne od AC11', async () => {
    findAvailableSlotsMock.mockResolvedValue(engineResult([], { error: null }));
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.slots).toEqual([]);
    expect(result.error).toBeNull();
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('jeden pracownik w puli — wynik identyczny z jego slotami, ale bez resource_id (przypadek degeneracyjny)', async () => {
    const slots = [
      mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14'),
      mkSlot(localMoment('2026-09-15', '08:00'), localMoment('2026-09-15', '10:00'), '2026-09-15'),
    ];
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-solo', 'AUDITOR', slots)]));
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.slots).toHaveLength(2);
    for (const slot of result.slots) {
      expect(Object.keys(slot).sort()).toEqual(['date', 'end_at', 'start_at']);
    }
    expect(result.slots.map((s) => s.start_at.getTime()).sort()).toEqual(slots.map((s) => s.start_at.getTime()).sort());
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('zmiana czasu na letni (2026-03-29): dedup nie psuje date slotu wspólnego dwóm pracownikom', async () => {
    const dstSlot = mkSlot(localMoment('2026-03-29', '08:00'), localMoment('2026-03-29', '10:00'), '2026-03-29');
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', [dstSlot]), mkResource('aud-2', 'AUDITOR', [dstSlot])]));
    const result = await findPoolSlots('basket-audit', RANGE);
    const matching = result.slots.filter((s) => s.start_at.getTime() === dstSlot.start_at.getTime());
    expect(matching).toHaveLength(1);
    expect(matching[0]!.date).toBe('2026-03-29');
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('zmiana czasu z powrotem (2026-10-25): dedup nie psuje date slotu wspólnego dwóm pracownikom', async () => {
    const dstSlot = mkSlot(localMoment('2026-10-25', '08:00'), localMoment('2026-10-25', '10:00'), '2026-10-25');
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', [dstSlot]), mkResource('aud-2', 'AUDITOR', [dstSlot])]));
    const result = await findPoolSlots('basket-audit', RANGE);
    const matching = result.slots.filter((s) => s.start_at.getTime() === dstSlot.start_at.getTime());
    expect(matching).toHaveLength(1);
    expect(matching[0]!.date).toBe('2026-10-25');
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('sloty z różnych dni o tej samej godzinie lokalnej NIE są duplikatami (różny start_at w ms)', async () => {
    const day1 = mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14');
    const day2 = mkSlot(localMoment('2026-09-15', '08:00'), localMoment('2026-09-15', '10:00'), '2026-09-15');
    findAvailableSlotsMock.mockResolvedValue(engineResult([mkResource('aud-1', 'AUDITOR', [day1, day2])]));
    const result = await findPoolSlots('basket-audit', RANGE);
    expect(result.slots).toHaveLength(2);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('brak gwarancji atomowości: findPoolSlots nie dotyka Prismy w żadnej formie (zero blokady/rezerwacji/holdu)', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-1', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')])]),
    );
    await findPoolSlots('basket-audit', RANGE);
    expect(prismaCallLog).toEqual([]);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('idempotencja odczytu: dwa wywołania na niezmienionych danych dają identyczny wynik (treść i kolejność)', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([
        mkResource('aud-1', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')]),
        mkResource('aud-2', 'AUDITOR', [mkSlot(localMoment('2026-09-15', '08:00'), localMoment('2026-09-15', '10:00'), '2026-09-15')]),
      ]),
    );
    const first = await findPoolSlots('basket-audit', RANGE);
    const second = await findPoolSlots('basket-audit', RANGE);
    expect(first).toEqual(second);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('uprawnienia: findPoolSlots jest czystą funkcją domenową — działa bez żadnej atrapy sesji/roli, bramka należy do wywołującego', async () => {
    findAvailableSlotsMock.mockResolvedValue(
      engineResult([mkResource('aud-1', 'AUDITOR', [mkSlot(localMoment('2026-09-14', '08:00'), localMoment('2026-09-14', '10:00'), '2026-09-14')])]),
    );
    // Brak jakiegokolwiek mocka `getCurrentActorRole`/`can()` w tym pliku — jeśli implementacja
    // by ich wymagała, wywołanie poniżej wywaliłoby się modułem niezaimportowanym/undefined.
    await expect(findPoolSlots('basket-audit', RANGE)).resolves.toBeDefined();
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('statyczny: pool-slots.ts nie importuje bramki sesji/roli (utils/supabase/server) — czysta funkcja domenowa', () => {
    const filePath = path.join(__dirname, '..', 'src', 'lib', 'schedule', 'pool-slots.ts');
    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf-8');
    expect(source).not.toMatch(/utils\/supabase\/server/);
    expect(source).not.toMatch(/getCurrentActorRole/);
  });
});

describe('findPoolSlots — przepięcie istniejącego wywołania w create-booking.ts, CAL-POOL-AGGREGATE AC17/AC18', () => {
  /**
   * Ekstrakcja treści funkcji przez zliczanie nawiasów klamrowych (bez zachłannego regexu) —
   * patrz pamięć agenta: naiwny regex na wielolinijkowym kodzie łapie ZŁY zakres.
   */
  function extractFunctionBody(source: string, functionName: string): string {
    const signature = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)[^{]*\\{`);
    const startMatch = signature.exec(source);
    if (!startMatch) return '';
    const braceStart = startMatch.index + startMatch[0].length - 1;
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(braceStart, i + 1);
      }
    }
    return '';
  }

  // @REQ: CAL-POOL-AGGREGATE
  it('AC17 — findAlternatives w create-booking.ts woła findPoolSlots i NIE zawiera już własnej pętli deduplikującej/sortującej', () => {
    const filePath = path.join(__dirname, '..', 'src', 'lib', 'schedule', 'create-booking.ts');
    const source = readFileSync(filePath, 'utf-8');
    const body = extractFunctionBody(source, 'findAlternatives');
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/findPoolSlots\(/);
    // Sygnatura starej, zastępowanej logiki: własny Set do deduplikacji po start_at.getTime()
    // i własne sortowanie spłaszczonej listy. Obie muszą zniknąć z TEJ funkcji — sortowanie
    // i dedup są teraz odpowiedzialnością `findPoolSlots`.
    expect(body).not.toMatch(/new Set/);
    expect(body).not.toMatch(/\.sort\(/);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC18 — MAX_ALTERNATIVES=5 i DEFAULT_ALTERNATIVES_HORIZON_DAYS=14 ZOSTAJĄ literałami lokalnymi create-booking.ts', () => {
    const filePath = path.join(__dirname, '..', 'src', 'lib', 'schedule', 'create-booking.ts');
    const source = readFileSync(filePath, 'utf-8');
    expect(source).toMatch(/const\s+MAX_ALTERNATIVES\s*=\s*5\b/);
    expect(source).toMatch(/const\s+DEFAULT_ALTERNATIVES_HORIZON_DAYS\s*=\s*14\b/);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC18 — pool-slots.ts NIE definiuje/importuje MAX_ALTERNATIVES ani DEFAULT_ALTERNATIVES_HORIZON_DAYS', () => {
    const filePath = path.join(__dirname, '..', 'src', 'lib', 'schedule', 'pool-slots.ts');
    expect(existsSync(filePath)).toBe(true);
    const source = readFileSync(filePath, 'utf-8');
    expect(source).not.toMatch(/MAX_ALTERNATIVES/);
    expect(source).not.toMatch(/DEFAULT_ALTERNATIVES_HORIZON_DAYS/);
  });

  // @REQ: CAL-POOL-AGGREGATE
  it('AC18 — contracts/sla.contract.mjs nie wchłonął MAX_ALTERNATIVES/DEFAULT_ALTERNATIVES_HORIZON_DAYS (zbieżność z AUDITOR_DAILY_CAP=5 jest przypadkowa)', () => {
    const contractPath = path.join(__dirname, '..', '..', '..', 'contracts', 'sla.contract.mjs');
    expect(existsSync(contractPath)).toBe(true);
    const source = readFileSync(contractPath, 'utf-8');
    expect(source).not.toMatch(/MAX_ALTERNATIVES/);
    expect(source).not.toMatch(/DEFAULT_ALTERNATIVES_HORIZON_DAYS/);
  });
});
