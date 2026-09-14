import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/B2C-BOOKING-SLOT.md — sekcja "Architektura docelowa → FOMO".
 * Ten plik NIE dowodzi żadnego z AC1-AC11 z rejestru (rejestr nie ma kryterium na
 * `getFomoSlots` — WO jest wprost jawny, że to konsekwencja techniczna usunięcia
 * `getAvailableSlots`, "nie da się go zostawić bez zmian", zakres MINIMALNY: podmiana
 * źródła slotów na `findPoolSlots(AUDIT, ...)`, NIC więcej (filtr statusu
 * 'Umówiony Audyt', limit, fallback {slots:3} — POZA ZAKRESEM, nietestowane tutaj
 * celowo). Testy poniżej są bez znacznika `@REQ:`, analogicznie do precedensu w
 * `saveLead.test.ts` (dwa testy na końcu tamtego pliku, bez `@REQ:`, z tego samego
 * powodu: konsekwencja techniczna, nie kryterium z rejestru).
 *
 * `getFomoSlots.ts` DZIŚ importuje `getAvailableSlots` z `./calendar` — ten import
 * zniknie razem z Google Calendar jako źródłem odczytu (WO, D-1). Pierwszy test w tym
 * pliku jest statyczny i celowo pada już DZIŚ (asercja, nie błąd modułu) — dowodzi
 * to, że start jest czerwony z właściwego powodu (treść pliku, nie brakujący plik).
 */

const { visitDurationBasketFindFirstSpy, findPoolSlotsSpy, configBuilder, leadyBuilder, fromSpy } = vi.hoisted(() => {
  const visitDurationBasketFindFirstSpy = vi.fn(async (_args: unknown) => ({
    id: 'basket-audit-uuid',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  }));

  const findPoolSlotsSpy = vi.fn(async (_basketId: string, _range: { from: Date; to: Date }, _opts?: { limit?: number }) => ({
    slots: [] as Array<{ start_at: Date; end_at: Date; date: string }>,
    duration_minutes: 120,
    travel_buffer_minutes: 30,
    error: null as string | null,
  }));

  const configBuilder = {
    select: vi.fn(() => configBuilder),
    eq: vi.fn(() => configBuilder),
    single: vi.fn(async () => ({ data: { konfiguracja: { weekly_audit_limit: 10 } }, error: null })),
  };

  const leadyBuilder = {
    select: vi.fn(() => leadyBuilder),
    eq: vi.fn(() => leadyBuilder),
    gte: vi.fn(() => leadyBuilder),
    lte: vi.fn(async () => ({ count: 0, error: null })),
  };

  const fromSpy = vi.fn((table: string) => {
    if (table === 'system_config') return configBuilder;
    if (table === 'leady') return leadyBuilder;
    throw new Error(`getFomoSlots.test: nieoczekiwana tabela "${table}"`);
  });

  return { visitDurationBasketFindFirstSpy, findPoolSlotsSpy, configBuilder, leadyBuilder, fromSpy };
});

vi.mock('@repo/database', () => ({
  prisma: { visitDurationBasket: { findFirst: visitDurationBasketFindFirstSpy } },
}));
vi.mock('@repo/scheduling', () => ({ findPoolSlots: findPoolSlotsSpy }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({ from: fromSpy })) }));

const GET_FOMO_SLOTS_FILE = path.resolve(__dirname, '../../app/actions/getFomoSlots.ts');

const { getFomoSlots } = await import('../../app/actions/getFomoSlots');

describe('getFomoSlots — podmiana źródła po B2C-BOOKING-SLOT (Google Calendar -> findPoolSlots)', () => {
  beforeEach(() => {
    visitDurationBasketFindFirstSpy.mockClear();
    findPoolSlotsSpy.mockClear();
    fromSpy.mockClear();
    configBuilder.single.mockClear();
    leadyBuilder.lte.mockClear();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    configBuilder.single.mockResolvedValue({ data: { konfiguracja: { weekly_audit_limit: 10 } }, error: null });
    leadyBuilder.lte.mockResolvedValue({ count: 0, error: null });
    findPoolSlotsSpy.mockResolvedValue({ slots: [], duration_minutes: 120, travel_buffer_minutes: 30, error: null });
  });

  it('(statyczny) getFomoSlots.ts nie importuje już getAvailableSlots/googleapis — źródło slotów jest @repo/scheduling', () => {
    const source = readFileSync(GET_FOMO_SLOTS_FILE, 'utf-8');
    expect(source).not.toMatch(/getAvailableSlots/);
    expect(source).not.toMatch(/googleapis/);
    expect(source).toMatch(/@repo\/scheduling/);
  });

  it('liczba dostępnych terminów w tym tygodniu pochodzi z findPoolSlots(AUDIT, ...), nie z Google Calendar', async () => {
    const now = new Date();
    const s1 = { start_at: now, end_at: new Date(now.getTime() + 120 * 60000), date: '2026-01-01' };
    const s2 = { start_at: new Date(now.getTime() + 3600000), end_at: new Date(now.getTime() + 3600000 + 120 * 60000), date: '2026-01-01' };
    const s3 = { start_at: new Date(now.getTime() + 7200000), end_at: new Date(now.getTime() + 7200000 + 120 * 60000), date: '2026-01-01' };
    findPoolSlotsSpy.mockResolvedValueOnce({ slots: [s1, s2, s3], duration_minutes: 120, travel_buffer_minutes: 30, error: null });

    const result = await getFomoSlots();

    expect(findPoolSlotsSpy).toHaveBeenCalled();
    // limit(10) - booked(0) = 10; min(10, 3 sloty realne z findPoolSlots) = 3.
    expect(result.slots).toBe(3);
  });
});
