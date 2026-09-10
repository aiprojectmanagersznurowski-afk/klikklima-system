import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/FLD-AVAIL-WEEKLY-RULES.md — blok B (odczyt efektywnej
 * dostępności). Wymaganie (contracts/requirements.contract.mjs, R('FLD-AVAIL-WEEKLY-RULES',
 * ...)), kryteria AC-B1..AC-B10. Blok A (zapis) jest już GREEN i zacommitowany
 * (commit 1234fad, plik `availability-rules-weekly.test.ts`) — ten plik go NIE
 * dotyka i nie duplikuje jego testów. Blok C (UI) jest poza zakresem tej tury.
 *
 * Stan zweryfikowany 2026-09-10: `apps/b2b-web/src/lib/schedule/effective-availability.ts`
 * NIE ISTNIEJE (grep -rn "getEffectiveAvailability" apps/ = brak wyników poza tym
 * plikiem). `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` i `.../crews/actions.ts`
 * NIE eksportują żadnej akcji odczytu dostępności — tylko `setAvailabilityRuleAction`
 * (zapis, blok A) i `setSelfAvailabilityAction` (deklaracja, FLD-AVAIL-SELF).
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM (kształt wybrany przeze mnie, test-author,
 * zgodnie z poleceniem WO — jeśli implementer wybierze inny kształt, to TEST-DEFECT do
 * zgłoszenia w tej turze, nie powód do cichej zmiany testu; wzorzec tej klauzuli:
 * availability-rules-weekly.test.ts, availability-self-declaration.test.ts):
 *
 *   Silnik (czysta funkcja, BEZ sprawdzania uprawnień — to robi warstwa Server Action,
 *   dokładnie jak `writeAvailabilityRuleRaw` w bloku A):
 *
 *   `apps/b2b-web/src/lib/schedule/effective-availability.ts`:
 *     export type EffectiveAvailabilityDay = {
 *       date: string;                              // "yyyy-MM-dd", kalendarz Europe/Warsaw
 *       weekday: number;                            // ISO-8601 1..7 (EXTRACT(ISODOW))
 *       available: boolean;
 *       start_time: string | null;                  // "HH:MM" lokalny czas Europe/Warsaw
 *       end_time: string | null;
 *       start_at: Date | null;                       // moment UTC
 *       end_at: Date | null;
 *       source: 'RULE' | 'RULE_INACTIVE' | 'DEFAULT' | 'NONE';
 *     };
 *     export type EffectiveAvailabilityResult = {
 *       days: EffectiveAvailabilityDay[];
 *       error: string | null;                        // komunikat domenowy PL, np. brak
 *                                                      // wiersza scheduling_config (AC-B6)
 *     };
 *     export async function getEffectiveAvailability(
 *       resourceId: string,
 *       resourceKind: 'AUDITOR' | 'CREW',
 *       dateRange: { from: Date; to: Date },
 *     ): Promise<EffectiveAvailabilityResult>
 *
 *   Odczyt z bazy: `prisma.availabilityRule.findMany({ where: resourceKind === 'AUDITOR'
 *   ? { auditorId: resourceId } : { crewId: resourceId } })` (pola modelu Prisma już
 *   istnieją — `auditorId`/`crewId`/`weekday`/`startTime`/`endTime`/`isActive` — filtrowanie
 *   nie potrzebuje `resource_id` generowanego, więc `prisma.availabilityRule.upsert`-owy
 *   problem z blokiu A tu nie występuje). `startTime`/`endTime` to kolumny `@db.Time(6)` —
 *   Prisma Client zwraca je jako `Date` zakotwiczone na `1970-01-01T` w UTC (konwencja
 *   sterownika dla typu TIME), NIE jako string — inaczej niż `writeAvailabilityRuleRaw`,
 *   który idzie przez `$queryRaw` i zwraca string. Mocki w tym pliku odzwierciedlają to
 *   wprost (`timeOfDay()` niżej).
 *
 *   Wartości domyślne: `prisma.system_config.findUnique({ where: { typ_konfiguracji:
 *   'scheduling_config' } })`, pole `konfiguracja: Json` z kluczami
 *   `default_workday_start`, `default_workday_end`, `default_weekdays` (AC-B3: ZERO
 *   literałów tych wartości w silniku — patrz test statyczny niżej).
 *
 *   Warstwa Server Action (uprawnienia, AC-B9) — wzorem `setAvailabilityRuleAction`:
 *     `getAvailabilityAction(id: string, from: Date, to: Date):
 *        Promise<{ success: boolean; error?: string; days?: EffectiveAvailabilityDay[] }>`
 *   w `auditors/actions.ts` (AUDITOR) i symetrycznie w `crews/actions.ts` (CREW).
 *   Zasób RBAC `availability_rules`, capability `read`
 *   (`admin`/`dyspozytor` → 'yes', `audytor:own`/`monter:own` → 'own'). Wiązanie roli
 *   z encją żyje w kodzie akcji (jak przy `update` w bloku A) — `monter` wywołujący
 *   akcję z `auditors/actions.ts` musi dostać odmowę niezależnie od `id`. Własność dla
 *   wariantu `:own` idzie przez e-mail z sesji (`findMany({ where: { email }, take: 2 })`),
 *   tym samym wzorcem co `setAvailabilityRuleAction`.
 *
 * Zakres warstw: silnik (mock Prisma) + Server Action (mock Prisma + sesja). Warstwa RLS
 * i realna współbieżność wymagają żywej bazy — poza zakresem tego pliku (ta sama, znana
 * granica co w blokach A i FLD-AVAIL-SELF).
 */

const {
  availabilityRuleFindManyMock,
  systemConfigFindUniqueMock,
  auditorFindManyMock,
  crewFindManyMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  availabilityRuleFindManyMock: vi.fn(),
  systemConfigFindUniqueMock: vi.fn(),
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    availabilityRule: {
      findMany: availabilityRuleFindManyMock,
    },
    system_config: {
      findUnique: systemConfigFindUniqueMock,
    },
    audytorzy: {
      findMany: auditorFindManyMock,
    },
    zespoly_monterskie: {
      findMany: crewFindManyMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { getEffectiveAvailability } = await import('../src/lib/schedule/effective-availability');
const { getAvailabilityAction: getAuditorAvailability } = await import(
  '../src/app/(dashboard)/auditors/actions'
);
const { getAvailabilityAction: getCrewAvailability } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';

// Kolumny @db.Time(6) — Prisma Client zwraca Date zakotwiczone na epoce UTC (patrz
// nagłówek pliku). NIE string, w przeciwieństwie do writeAvailabilityRuleRaw.
function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

function ruleRow(weekday: number, start: string, end: string, isActive = true) {
  return { weekday, startTime: timeOfDay(start), endTime: timeOfDay(end), isActive };
}

function schedulingConfigRow(overrides: {
  start?: string;
  end?: string;
  weekdays?: number[];
} = {}) {
  return {
    konfiguracja: {
      travel_buffer_minutes: 60,
      default_workday_start: overrides.start ?? '08:00',
      default_workday_end: overrides.end ?? '16:00',
      default_weekdays: overrides.weekdays ?? [1, 2, 3, 4, 5],
    },
  };
}

function utcDay(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

beforeEach(() => {
  availabilityRuleFindManyMock.mockReset();
  systemConfigFindUniqueMock.mockReset();
  auditorFindManyMock.mockReset();
  crewFindManyMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });

  availabilityRuleFindManyMock.mockResolvedValue([]);
  systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow());
  auditorFindManyMock.mockResolvedValue([
    { id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' },
  ]);
  crewFindManyMock.mockResolvedValue([
    { id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' },
  ]);
});

describe('getEffectiveAvailability (lib/schedule/effective-availability.ts) — silnik odczytu (FLD-AVAIL-WEEKLY-RULES, blok B)', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B1 — okno z reguły ma pierwszeństwo przed domyślnym, gdy jest WĘŻSZE od domyślnego', async () => {
    // wtorek 2026-09-15 = ISODOW 2; domyślne okno 08:00-16:00, reguła węższa 10:00-14:00
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(2, '10:00', '14:00')]);

    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-15'),
      to: utcDay('2026-09-15'),
    });

    expect(result.days).toHaveLength(1);
    expect(result.days[0]).toMatchObject({
      date: '2026-09-15',
      weekday: 2,
      available: true,
      start_time: '10:00',
      end_time: '14:00',
      source: 'RULE',
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B1 — okno z reguły ma pierwszeństwo przed domyślnym, gdy jest SZERSZE od domyślnego', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(2, '06:00', '20:00')]);

    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-15'),
      to: utcDay('2026-09-15'),
    });

    expect(result.days[0]).toMatchObject({
      start_time: '06:00',
      end_time: '20:00',
      source: 'RULE',
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B2 — pracownik BEZ żadnej reguły dostaje okno domyślne z scheduling_config na dzień z default_weekdays', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([]);
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ weekdays: [1, 2, 3, 4, 5] }));

    // poniedziałek 2026-09-14 = ISODOW 1, jest w default_weekdays
    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    expect(result.days[0]).toMatchObject({
      date: '2026-09-14',
      weekday: 1,
      available: true,
      start_time: '08:00',
      end_time: '16:00',
      source: 'DEFAULT',
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B2 — pracownik BEZ żadnej reguły dostaje "brak dostępności" na dzień SPOZA default_weekdays (fail-open ≠ zawsze dostępny)', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([]);
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ weekdays: [1, 2, 3, 4, 5] }));

    // sobota 2026-09-19 = ISODOW 6, POZA default_weekdays
    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-19'),
      to: utcDay('2026-09-19'),
    });

    expect(result.days[0]).toMatchObject({
      date: '2026-09-19',
      weekday: 6,
      available: false,
      start_time: null,
      end_time: null,
      source: 'NONE',
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B3 — wartości domyślne są CZYTANE Z BAZY: zmiana scheduling_config zmienia wynik (07:00-15:00, weekdays [1..6])', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([]);
    systemConfigFindUniqueMock.mockResolvedValue(
      schedulingConfigRow({ start: '07:00', end: '15:00', weekdays: [1, 2, 3, 4, 5, 6] })
    );

    // sobota 2026-09-19 = ISODOW 6 — z domyślną konfiguracją z AC-B2 byłaby niedostępna;
    // z podmienioną konfiguracją (weekdays zawiera 6) musi być dostępna, z nowym oknem.
    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-19'),
      to: utcDay('2026-09-19'),
    });

    expect(result.days[0]).toMatchObject({
      available: true,
      start_time: '07:00',
      end_time: '15:00',
      source: 'DEFAULT',
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B3 — silnik nie zawiera zaszytych literałów wartości domyślnych ("08:00", "16:00", 60, [1,2,3,4,5])', () => {
    const enginePath = path.join(
      __dirname,
      '..',
      'src',
      'lib',
      'schedule',
      'effective-availability.ts'
    );
    expect(existsSync(enginePath)).toBe(true);

    const content = readFileSync(enginePath, 'utf-8');
    expect(content).not.toMatch(/["']08:00["']/);
    expect(content).not.toMatch(/["']16:00["']/);
    expect(content).not.toMatch(/\b60\b/);
    expect(content).not.toMatch(/\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*\]/);
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B4 — fallback jest PER-PRACOWNIK: zero reguł dostaje domyślne okno na KAŻDY dzień z default_weekdays, jedna reguła (tylko poniedziałek) NIE dostaje domyślnego okna na pozostałe dni z tej samej listy', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ weekdays: [1, 2, 3, 4, 5] }));
    availabilityRuleFindManyMock.mockImplementation(async ({ where }: { where: { auditorId?: string } }) => {
      if (where.auditorId === 'aud-zero-rules') return [];
      if (where.auditorId === 'aud-one-rule') return [ruleRow(1, '08:00', '16:00')];
      throw new Error(`nieoczekiwany resourceId w teście: ${where.auditorId}`);
    });

    const range = { from: utcDay('2026-09-14'), to: utcDay('2026-09-15') }; // pon (1), wt (2)

    const zeroRules = await getEffectiveAvailability('aud-zero-rules', 'AUDITOR', range);
    const oneRule = await getEffectiveAvailability('aud-one-rule', 'AUDITOR', range);

    // Pracownik bez reguł: oba dni z default_weekdays → dostępny oba dni.
    expect(zeroRules.days.map((d) => d.available)).toEqual([true, true]);
    expect(zeroRules.days.map((d) => d.source)).toEqual(['DEFAULT', 'DEFAULT']);

    // Pracownik z JEDNĄ regułą (poniedziałek): poniedziałek z reguły, wtorek MUSI być
    // niedostępny mimo że wtorek jest w default_weekdays — to jest sedno AC-B4.
    expect(oneRule.days[0]).toMatchObject({ weekday: 1, available: true, source: 'RULE' });
    expect(oneRule.days[1]).toMatchObject({ weekday: 2, available: false, source: 'NONE' });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B5 — reguła z is_active=false to "brak dostępności" BEZ fallbacku, jawnie odróżniona od braku wiersza w ogóle', async () => {
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ weekdays: [1, 2, 3, 4, 5] }));
    availabilityRuleFindManyMock.mockResolvedValue([
      ruleRow(1, '08:00', '16:00', true), // poniedziałek — aktywna
      ruleRow(3, '09:00', '12:00', false), // środa — WYŁĄCZONA, nie brak wiersza
      // wtorek (2): brak wiersza w ogóle
    ]);

    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-14'), // pon
      to: utcDay('2026-09-16'), // śr
    });

    const [mon, tue, wed] = result.days;
    expect(mon).toMatchObject({ weekday: 1, available: true, source: 'RULE' });
    // Środa: is_active=false — niedostępna, i NIE 'DEFAULT' (fallback się nie uruchomił),
    // i jawnie ODRÓŻNIONA od wtorku (brak wiersza) innym source.
    expect(wed).toMatchObject({ weekday: 3, available: false, source: 'RULE_INACTIVE' });
    expect(tue).toMatchObject({ weekday: 2, available: false, source: 'NONE' });
    expect(wed!.source).not.toBe(tue!.source);
    expect(wed!.source).not.toBe('DEFAULT');
    expect(wed!.start_time).toBeNull();
    expect(wed!.end_time).toBeNull();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B6 — brak wiersza scheduling_config w system_config NIE wywraca odczytu: kontrolowany wynik + błąd domenowy, nigdy wyjątek', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([]);
    systemConfigFindUniqueMock.mockResolvedValue(null);

    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-14'),
    });

    expect(result.error).toEqual(expect.any(String));
    expect(result.error!.length).toBeGreaterThan(0);
    expect(result.days[0]).toMatchObject({
      available: false,
      start_time: null,
      end_time: null,
      source: 'NONE',
    });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B7 — mapowanie daty na weekday idzie przez ISODOW (niedziela=7, poniedziałek=1), NIE przez Date.getDay() (niedziela=0)', async () => {
    // niedziela 2026-09-13 i następujący po niej poniedziałek 2026-09-14 — granica tygodnia.
    availabilityRuleFindManyMock.mockResolvedValue([
      ruleRow(7, '09:00', '12:00'), // reguła WYŁĄCZNIE na niedzielę (ISODOW 7)
      ruleRow(1, '08:00', '16:00'), // reguła WYŁĄCZNIE na poniedziałek (ISODOW 1)
    ]);

    const result = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-13'),
      to: utcDay('2026-09-14'),
    });

    expect(result.days).toHaveLength(2);
    // Gdyby silnik użył Date.getDay() (niedziela=0), reguła weekday=7 nigdy by nie
    // trafiła niedzieli — dzień wypadłby jako 'NONE'/niedostępny zamiast dopasować regułę.
    expect(result.days[0]).toMatchObject({ date: '2026-09-13', weekday: 7, available: true, source: 'RULE' });
    expect(result.days[1]).toMatchObject({ date: '2026-09-14', weekday: 1, available: true, source: 'RULE' });
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B8 — materializacja "8-16" w Europe/Warsaw daje RÓŻNY moment UTC w obu dobach zmiany czasu (2026-03-29 i 2026-10-25)', async () => {
    // Obie daty to niedziele (ISODOW 7) w 2026 roku.
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(7, '08:00', '16:00')]);

    const springForward = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-03-29'),
      to: utcDay('2026-03-29'),
    });
    const fallBack = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-10-25'),
      to: utcDay('2026-10-25'),
    });

    // Lokalnie identyczne "8-16" w obu przypadkach:
    expect(springForward.days[0]!.start_time).toBe('08:00');
    expect(fallBack.days[0]!.start_time).toBe('08:00');

    // 2026-03-29: czas letni (CEST, UTC+2) — 08:00 lokalnego to 06:00 UTC.
    expect(springForward.days[0]!.start_at).toEqual(new Date('2026-03-29T06:00:00.000Z'));
    expect(springForward.days[0]!.end_at).toEqual(new Date('2026-03-29T14:00:00.000Z'));

    // 2026-10-25: czas zimowy (CET, UTC+1) — 08:00 lokalnego to 07:00 UTC.
    expect(fallBack.days[0]!.start_at).toEqual(new Date('2026-10-25T07:00:00.000Z'));
    expect(fallBack.days[0]!.end_at).toEqual(new Date('2026-10-25T15:00:00.000Z'));

    // Ten sam lokalny zapis "8-16" daje inny moment UTC — dowód, że materializacja
    // jest strefowa (Europe/Warsaw), nie stały offset zaszyty w kodzie.
    expect(springForward.days[0]!.start_at!.getTime()).not.toBe(fallBack.days[0]!.start_at!.getTime());
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B10 — zakres dat jest odczytany w JEDNYM wywołaniu na model, niezależnie od długości zakresu (brak N+1)', async () => {
    availabilityRuleFindManyMock.mockResolvedValue([]);
    systemConfigFindUniqueMock.mockResolvedValue(schedulingConfigRow({ weekdays: [1, 2, 3, 4, 5, 6, 7] }));

    availabilityRuleFindManyMock.mockClear();
    systemConfigFindUniqueMock.mockClear();
    const weekResult = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-09-20'), // 7 dni
    });
    const weekRuleCalls = availabilityRuleFindManyMock.mock.calls.length;
    const weekConfigCalls = systemConfigFindUniqueMock.mock.calls.length;

    availabilityRuleFindManyMock.mockClear();
    systemConfigFindUniqueMock.mockClear();
    const monthResult = await getEffectiveAvailability('aud-1', 'AUDITOR', {
      from: utcDay('2026-09-14'),
      to: utcDay('2026-10-13'), // 30 dni
    });
    const monthRuleCalls = availabilityRuleFindManyMock.mock.calls.length;
    const monthConfigCalls = systemConfigFindUniqueMock.mock.calls.length;

    expect(weekResult.days).toHaveLength(7);
    expect(monthResult.days).toHaveLength(30);
    // Liczba zapytań NIE rośnie z długością zakresu — jedno wywołanie na model,
    // niezależnie od tego, czy zakres to 7 czy 30 dni (N+1 jest defektem).
    expect(weekRuleCalls).toBeGreaterThan(0);
    expect(weekRuleCalls).toBe(monthRuleCalls);
    expect(weekConfigCalls).toBe(monthConfigCalls);
  });
});

describe('getAvailabilityAction (auditors/actions.ts, crews/actions.ts) — uprawnienia odczytu (FLD-AVAIL-WEEKLY-RULES, AC-B9)', () => {
  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B9 — admin czyta CUDZĄ dostępność (dowolny id)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(1, '08:00', '16:00')]);

    const result = await getAuditorAvailability('aud-inny', utcDay('2026-09-14'), utcDay('2026-09-14'));

    expect(result.success).toBe(true);
    expect(result.days).toBeDefined();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B9 — dyspozytor czyta CUDZĄ dostępność (dowolny id)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(1, '08:00', '16:00')]);

    const result = await getCrewAvailability('crew-inny', utcDay('2026-09-14'), utcDay('2026-09-14'));

    expect(result.success).toBe(true);
    expect(result.days).toBeDefined();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B9 — audytor czyta WŁASNĄ dostępność — dozwolone', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    availabilityRuleFindManyMock.mockResolvedValue([ruleRow(1, '08:00', '16:00')]);

    const result = await getAuditorAvailability('aud-1', utcDay('2026-09-14'), utcDay('2026-09-14'));

    expect(result.success).toBe(true);
    expect(result.days).toBeDefined();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B9 — audytor próbuje czytać CUDZĄ dostępność — odmowa po stronie serwera, bez ani jednego zapytania do availability_rules', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } }); // sesja to aud-1

    const result = await getAuditorAvailability('aud-INNY-AUDYTOR', utcDay('2026-09-14'), utcDay('2026-09-14'));

    expect(result.success).toBe(false);
    expect(result.days).toBeUndefined();
    expect(availabilityRuleFindManyMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-WEEKLY-RULES
  it('AC-B9 — monter próbuje odczytać dostępność audytora przez auditors/actions.ts — odmowa (wiązanie roli z encją, nie tylko can())', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });

    const result = await getAuditorAvailability('aud-1', utcDay('2026-09-14'), utcDay('2026-09-14'));

    expect(result.success).toBe(false);
    expect(availabilityRuleFindManyMock).not.toHaveBeenCalled();
  });
});
