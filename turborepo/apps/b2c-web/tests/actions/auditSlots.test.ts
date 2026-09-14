import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/B2C-BOOKING-SLOT.md (wersja 2, rozstrzygnięta 2026-09-14).
 *
 * Nowa Server Action `getAuditSlots()` (proponowana lokalizacja z WO, "Architektura
 * docelowa → Odczyt terminów": `apps/b2c-web/app/actions/auditSlots.ts`) ZASTĘPUJE
 * `getAvailableSlots` z `calendar.ts` (Google Calendar) jako źródło terminów dla
 * `Step8Booking.tsx`. Plik `auditSlots.ts` NIE ISTNIEJE jeszcze — to jest oczekiwany,
 * jedyny prawidłowy powód czerwieni na tym etapie (WO, "Kolejność ról" pkt 4).
 *
 * Mockowanie: dwie zależności, obie z `@repo/scheduling`/`@repo/database`, oba pakiety
 * SĄ fizycznie rozwiązywalne w tym monorepo (workspaces npm hoistują `@repo/scheduling`
 * do korzenia `node_modules` niezależnie od tego, czy `apps/b2c-web/package.json` go
 * deklaruje — zweryfikowane: `node_modules/@repo/scheduling` istnieje jako symlink).
 * Mock zastępuje implementację całkowicie, więc brak wpisu w `package.json` nie jest
 * przeszkodą dla samego mockowania — jest jednak osobnym elementem "Brakuje" z WO,
 * który musi uzupełnić `implementer-server`.
 *
 * Rozwiązanie koszyka `AUDIT` (kod -> UUID) zakładam po stronie serwera jako
 * `prisma.visitDurationBasket.findFirst({ where: { code: 'AUDIT', isActive: true } })` —
 * dokładnie ten sam wzorzec, jaki już istnieje w
 * `apps/b2b-web/tests/create-booking-concurrency.itest.ts` (`requireBasket`). WO nie
 * definiuje żadnego innego helpera "code -> id" w repo (grep potwierdza jego brak),
 * więc to jest najbliższe, uzasadnione założenie o implementacji, nie nadinterpretacja
 * zakresu. Jeżeli `implementer-server` wybierze inny mechanizm resolwowania koszyka,
 * to jest kandydat na TEST-DEFECT, nie samowolną zmianę tego pliku przez implementera.
 */

type VisitDurationBasketRow = { id: string; code: string; isActive: boolean; durationMinutes: number; pool: string } | null;

const { visitDurationBasketFindFirstSpy, findPoolSlotsSpy } = vi.hoisted(() => {
  const visitDurationBasketFindFirstSpy = vi.fn(
    async (_args: unknown): Promise<VisitDurationBasketRow> => ({
      id: 'basket-audit-uuid',
      code: 'AUDIT',
      isActive: true,
      durationMinutes: 120,
      pool: 'AUDITOR',
    }),
  );

  const findPoolSlotsSpy = vi.fn(async (_basketId: string, _range: { from: Date; to: Date }, _opts?: { limit?: number }) => ({
    slots: [] as Array<{ start_at: Date; end_at: Date; date: string }>,
    duration_minutes: 120,
    travel_buffer_minutes: 30,
    error: null as string | null,
  }));

  return { visitDurationBasketFindFirstSpy, findPoolSlotsSpy };
});

vi.mock('@repo/database', () => ({
  prisma: { visitDurationBasket: { findFirst: visitDurationBasketFindFirstSpy } },
}));

vi.mock('@repo/scheduling', () => ({ findPoolSlots: findPoolSlotsSpy }));

const AUDIT_SLOTS_FILE = path.resolve(__dirname, '../../app/actions/auditSlots.ts');

// Kształty z WO ("Architektura docelowa → Odczyt terminów") — zduplikowane tu jawnie,
// żeby test miał własny, jawny typ zamiast `any` (moduł jeszcze nie istnieje, więc
// `import(...)` poniżej i tak rozwiązuje się do `any` w runtime Vitest/esbuild;
// `as` na wywołaniu daje statyczną kontrolę w tym pliku, nie w module źródłowym).
type AuditSlotShape = { startAtIso: string; endAtIso: string; label: string };
type AuditDayShape = { dateStr: string; slots: AuditSlotShape[] };
type AuditSlotsResultShape = { days: AuditDayShape[]; error: string | null };

const { getAuditSlots: getAuditSlotsUntyped } = await import('../../app/actions/auditSlots');
const getAuditSlots = getAuditSlotsUntyped as () => Promise<AuditSlotsResultShape>;

// Klucze, których odpowiedź NIE MOŻE zawierać (AC3) — budowane z fragmentów tak, żeby
// dopasowanie było jawnym testem zawartości, nie literałem, który mógłby zostać
// przypadkiem "uciszony" przez ślepe kopiowanie tego pliku.
const FORBIDDEN_RESOURCE_KEYS = /resource_id|resource_kind|resources\b|auditor_id|auditorId|crew_id|crewId/i;

describe('getAuditSlots — B2C-BOOKING-SLOT', () => {
  beforeEach(() => {
    visitDurationBasketFindFirstSpy.mockClear();
    findPoolSlotsSpy.mockClear();
    visitDurationBasketFindFirstSpy.mockResolvedValue({
      id: 'basket-audit-uuid',
      code: 'AUDIT',
      isActive: true,
      durationMinutes: 120,
      pool: 'AUDITOR',
    });
    findPoolSlotsSpy.mockResolvedValue({ slots: [], duration_minutes: 120, travel_buffer_minutes: 30, error: null });
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC2 — każde wywołanie odpytuje findPoolSlots na nowo (brak cache), zakres dat to dziś..+60 dni', async () => {
    await getAuditSlots();
    await getAuditSlots();

    expect(findPoolSlotsSpy).toHaveBeenCalledTimes(2);

    const [basketIdArg, rangeArg] = findPoolSlotsSpy.mock.calls[0] as [string, { from: Date; to: Date }];
    expect(basketIdArg).toBe('basket-audit-uuid');

    const diffDays = (rangeArg.to.getTime() - rangeArg.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(60, 0);
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC3 — odpowiedź nie zawiera żadnego identyfikatora zasobu/pracownika, ani tablicy per zasób', async () => {
    const startA = new Date('2026-11-16T07:00:00.000Z'); // 08:00 Warsaw (zima, UTC+1)
    const endA = new Date(startA.getTime() + 120 * 60000);
    findPoolSlotsSpy.mockResolvedValueOnce({
      slots: [{ start_at: startA, end_at: endA, date: '2026-11-16' }],
      duration_minutes: 120,
      travel_buffer_minutes: 30,
      error: null,
    });

    const result = await getAuditSlots();
    const serialized = JSON.stringify(result);

    expect(FORBIDDEN_RESOURCE_KEYS.test(serialized)).toBe(false);

    // Jeden slot na wejściu (już zdeduplikowany przez CAL-POOL-AGGREGATE) -> jeden slot
    // na wyjściu, żadnego rozdzielenia po pracowniku.
    const totalSlots = result.days.reduce((sum, day) => sum + day.slots.length, 0);
    expect(totalSlots).toBe(1);
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC8 (statyczny) — plik z getAuditSlots nie odwołuje się do googleapis/freebusy', () => {
    const source = readFileSync(AUDIT_SLOTS_FILE, 'utf-8');
    expect(source).not.toMatch(/googleapis/);
    expect(source).not.toMatch(/freebusy/);
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC8 — lista terminów działa mimo całkowicie niedostępnego Google Calendar (brak zmiennych uwierzytelniających)', async () => {
    const savedEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const savedKey = process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;

    try {
      const startA = new Date('2026-11-16T07:00:00.000Z');
      const endA = new Date(startA.getTime() + 120 * 60000);
      findPoolSlotsSpy.mockResolvedValueOnce({
        slots: [{ start_at: startA, end_at: endA, date: '2026-11-16' }],
        duration_minutes: 120,
        travel_buffer_minutes: 30,
        error: null,
      });

      const result = await getAuditSlots();

      expect(result.error).toBeNull();
      expect(result.days.length).toBeGreaterThan(0);
    } finally {
      if (savedEmail !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = savedEmail;
      if (savedKey !== undefined) process.env.GOOGLE_PRIVATE_KEY = savedKey;
    }
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC11 — label i długość slotu pochodzą z start_at/end_at rzeczywistego koszyka (45 min), nie ze stałej 120 minut', async () => {
    const startA = new Date('2026-01-15T07:00:00.000Z'); // 08:00 Warsaw (zima, UTC+1)
    const endA = new Date(startA.getTime() + 45 * 60000); // 45 minut — inne niż domyślne TIME_SLOTS (2h)
    findPoolSlotsSpy.mockResolvedValueOnce({
      slots: [{ start_at: startA, end_at: endA, date: '2026-01-15' }],
      duration_minutes: 45,
      travel_buffer_minutes: 15,
      error: null,
    });

    const result = await getAuditSlots();
    const day = result.days.find((d) => d.dateStr === '2026-01-15');
    expect(day).toBeDefined();

    const slot = day!.slots[0];
    expect(slot.label).toBe('08:00 - 08:45');
    expect(slot.startAtIso).toBe(startA.toISOString());
    expect(slot.endAtIso).toBe(endA.toISOString());
  });

  // @REQ: B2C-BOOKING-SLOT
  it('strefa czasowa — dzień zmiany czasu na letni (ostatnia niedziela marca 2026): label liczony w Europe/Warsaw (UTC+2 po zmianie), nie w UTC', async () => {
    const startA = new Date('2026-03-29T10:00:00.000Z'); // po przejściu na czas letni (01:00 UTC)
    const endA = new Date(startA.getTime() + 120 * 60000);
    findPoolSlotsSpy.mockResolvedValueOnce({
      slots: [{ start_at: startA, end_at: endA, date: '2026-03-29' }],
      duration_minutes: 120,
      travel_buffer_minutes: 30,
      error: null,
    });

    const result = await getAuditSlots();
    const day = result.days.find((d) => d.dateStr === '2026-03-29');
    expect(day).toBeDefined();
    expect(day!.slots[0].label).toBe('12:00 - 14:00');
  });

  // @REQ: B2C-BOOKING-SLOT
  it('strefa czasowa — dzień powrotu do czasu zimowego (ostatnia niedziela października 2026): label liczony w Europe/Warsaw (UTC+1 po zmianie)', async () => {
    const startA = new Date('2026-10-25T10:00:00.000Z'); // po powrocie do czasu zimowego (01:00 UTC)
    const endA = new Date(startA.getTime() + 120 * 60000);
    findPoolSlotsSpy.mockResolvedValueOnce({
      slots: [{ start_at: startA, end_at: endA, date: '2026-10-25' }],
      duration_minutes: 120,
      travel_buffer_minutes: 30,
      error: null,
    });

    const result = await getAuditSlots();
    const day = result.days.find((d) => d.dateStr === '2026-10-25');
    expect(day).toBeDefined();
    expect(day!.slots[0].label).toBe('11:00 - 13:00');
  });

  // @REQ: B2C-BOOKING-SLOT
  it('brzeg: koszyk AUDIT wycofany/nieistniejący — komunikat błędu, nie wyjątek, nie cicha pusta lista udająca pełny kalendarz', async () => {
    visitDurationBasketFindFirstSpy.mockResolvedValueOnce(null);

    const result = await getAuditSlots();

    expect(result.days).toEqual([]);
    expect(result.error).not.toBeNull();
    expect(typeof result.error).toBe('string');
    expect(findPoolSlotsSpy).not.toHaveBeenCalled();
  });

  // @REQ: B2C-BOOKING-SLOT
  it('brzeg: błąd z findPoolSlots (np. brak scheduling_config) jest przekazywany dalej jako komunikat, nie wyciszany', async () => {
    findPoolSlotsSpy.mockResolvedValueOnce({
      slots: [],
      duration_minutes: 0,
      travel_buffer_minutes: 0,
      error: 'CONFIG_MISSING: brak konfiguracji bufora dojazdu',
    });

    const result = await getAuditSlots();

    expect(result.error).toBe('CONFIG_MISSING: brak konfiguracji bufora dojazdu');
  });
});
