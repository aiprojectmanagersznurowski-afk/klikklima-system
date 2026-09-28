import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/B2C-LEAD-ATOMIC.md — AC10 (kryterium regresyjne dla
 * WO B2C-LEAD-GEO-PERSIST, ten plik).
 *
 * MECHANIZM MOCKOWANIA ZMIENIONY (AC10, "test-author przepisuje z mocka supabase.from na
 * Prismę — asercje merytoryczne bez zmian"): `saveLead.ts` przestaje importować
 * `@/lib/supabaseClient` (P-3, WO B2C-LEAD-ATOMIC) — cały zapis idzie przez `@repo/database`
 * (Prisma), w jednej transakcji (`prisma.$transaction`). Ten plik mockuje więc `@repo/database`
 * z `prisma.$transaction` wołającym callback z fałszywym `tx` (`klienci.create`,
 * `adresy.create`, `leady.create`) — DOKŁADNY odpowiednik dawnych `klienciInsertSpy` /
 * `adresyInsertSpy` / `leadyInsertSpy`, tylko wywoływanych jako `tx.<model>.create({ data })`
 * zamiast `supabase.from('<tabela>').insert(row)`. `data_rezerwacji` wchodzi teraz w TEN SAM
 * `leady.create` (P-4), nie osobny UPDATE — geokodowanie (cel tego pliku) jest nietknięte przez
 * tę zmianę, więc asercje merytoryczne (latitude/longitude, null-handling, id-propagation)
 * zostają identyczne, zmienia się wyłącznie ścieżka odczytu argumentu wywołania.
 *
 * Rezerwacja: `saveLead` woła teraz `prepareBookingCandidates` + `writeBookingCandidate`
 * z `@repo/scheduling` (P-2, WO B2C-LEAD-ATOMIC) — NIE `createBooking` bezpośrednio (ten
 * pozostaje własnością ścieżki B2B/`packages/scheduling` wewnętrznie, złożony z tych samych
 * dwóch części). Zamockowane na sukces domyślnie, żeby ścieżka geokodowania (jedyny cel tego
 * pliku) dotarła do `result.success`. Kontrakt sygnatury tych dwóch funkcji jest DECYZJĄ
 * test-authora (WO B2C-LEAD-ATOMIC nie podaje "Proponowanej sygnatury" dla rozbicia P-2) —
 * patrz uzasadnienie w `saveLead.atomic.test.ts` i w podsumowaniu tury. Jeśli implementer
 * wybierze inny kształt, to nie jest z automatu TEST-DEFECT — zgłoszone jako ryzyko do
 * potwierdzenia w review.
 *
 * AC6 (typowanie `SaveLeadData`) — bez zmian względem poprzedniej wersji tego pliku: dowód
 * RED jest w `tsc --noEmit`, nie w asercji runtime (Vitest/esbuild nie type-checkuje).
 */

const {
  transactionSpy,
  klienciCreateSpy,
  adresyCreateSpy,
  leadyCreateSpy,
  calendarSpy,
  prepareBookingCandidatesSpy,
  writeBookingCandidateSpy,
  visitDurationBasketFindFirstMock,
} = vi.hoisted(() => {
  const klienciCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
  const adresyCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
  const leadyCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));

  const fakeTx = {
    klienci: { create: klienciCreateSpy },
    adresy: { create: adresyCreateSpy },
    leady: { create: leadyCreateSpy },
  };

  // Odpowiednik `prisma.$transaction(async (tx) => { ... })` — wykonuje callback z
  // fałszywym `tx` synchronicznie, bez otwierania prawdziwej transakcji (jednostkowy poziom,
  // dowód realnej atomowości jest w `saveLead-atomic.itest.ts`).
  const transactionSpy = vi.fn(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx));

  const calendarSpy = vi.fn(async () => ({ success: true, eventLink: 'stub' }));

  const prepareBookingCandidatesSpy = vi.fn(async (_params: Record<string, unknown>) => ({
    ok: true,
    candidates: [{ resource_id: 'aud-1', resource_kind: 'AUDITOR' as const }],
    resourceKind: 'AUDITOR' as const,
    scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    visitBasketId: 'basket-audit-id',
  }));

  const writeBookingCandidateSpy = vi.fn(async (_tx: unknown, _params: Record<string, unknown>) => ({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
  }));

  const visitDurationBasketFindFirstMock = vi.fn(async (_args: Record<string, unknown>) => ({
    id: 'basket-audit-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  }));

  return {
    transactionSpy,
    klienciCreateSpy,
    adresyCreateSpy,
    leadyCreateSpy,
    calendarSpy,
    prepareBookingCandidatesSpy,
    writeBookingCandidateSpy,
    visitDurationBasketFindFirstMock,
  };
});

// Stub NIEUŻYWANY merytorycznie — `saveLead.ts` DZIŚ (przed implementacją P-3) wciąż
// importuje `@/lib/supabaseClient`; bez tego mocka import realnego modułu pada na
// nierozwiązywalnym aliasie `@/*` (Vitest, brak konfiguracji aliasu — RED z niewłaściwego
// powodu, "moduł nie istnieje", nie asercja domenowa). Po P-3 (implementer usuwa ten import)
// ten mock staje się martwym, nieszkodliwym stubem — nic w tym pliku nie asertuje na `supabase`.
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));
vi.mock('@repo/scheduling', () => ({
  prepareBookingCandidates: prepareBookingCandidatesSpy,
  writeBookingCandidate: writeBookingCandidateSpy,
}));
vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findFirst: visitDurationBasketFindFirstMock },
    $transaction: transactionSpy,
  },
}));

const { saveLead } = await import('../../app/actions/saveLead');

const basePayload = () => ({
  name: 'Jan Kowalski',
  email: 'jan.kowalski@example.com',
  phone: '500600700',
  address: 'Marszałkowska 1, Warszawa',
  startAtIso: '2026-11-16T08:00:00.000+01:00',
  triageData: {},
});

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('saveLead — persystencja współrzędnych adresu (WO B2C-LEAD-GEO-PERSIST, mechanizm mockowania: Prisma — AC10 WO B2C-LEAD-ATOMIC)', () => {
  beforeEach(() => {
    transactionSpy.mockClear();
    klienciCreateSpy.mockClear();
    adresyCreateSpy.mockClear();
    leadyCreateSpy.mockClear();
    calendarSpy.mockClear();
    prepareBookingCandidatesSpy.mockClear();
    writeBookingCandidateSpy.mockClear();
    visitDurationBasketFindFirstMock.mockClear();
  });

  // @REQ: FLD-GEO-COORDS
  it('AC1/AC2/AC5 — adres geokodowany: latitude i longitude z dokładnością bez zaokrąglenia trafiają do TEGO SAMEGO create() na adresy', async () => {
    const lat = 52.2296756;
    const lng = 21.0122287;

    const result = await saveLead({ ...basePayload(), lat, lng });

    expect(result.success).toBe(true);
    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);

    const insertArg = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(insertArg.ulica_miasto).toBe('Marszałkowska 1, Warszawa');
    expect(insertArg.latitude).toBe(lat);
    expect(insertArg.longitude).toBe(lng);
  });

  // @REQ: FLD-GEO-COORDS
  it('AC3 — adres bez geokodowania (coordinates === undefined): create() zapisuje null, nie undefined, i lead powstaje normalnie', async () => {
    const result = await saveLead({ ...basePayload(), lat: undefined, lng: undefined });

    expect(result.success).toBe(true);

    const insertArg = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(insertArg.latitude).toBeNull();
    expect(insertArg.longitude).toBeNull();
  });

  // @REQ: FLD-GEO-COORDS
  it('AC4 — lat === 0 zapisuje się jako 0, nie jako null (?? kontra ||)', async () => {
    await saveLead({ ...basePayload(), lat: 0, lng: 21.0122287 });

    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    const insertArg = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(insertArg.latitude).not.toBeNull();
    expect(insertArg.latitude).toBe(0);
  });

  // @REQ: FLD-GEO-COORDS
  it('brzeg: współrzędne przekazane jako string trafiają do create() jako number, nie jako surowy tekst', async () => {
    const payload = basePayload() as Record<string, unknown>;
    payload.lat = '52.2296756';
    payload.lng = '21.0122287';

    await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    const insertArg = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(typeof insertArg.latitude).toBe('number');
    expect(insertArg.latitude).toBe(52.2296756);
    expect(typeof insertArg.longitude).toBe('number');
    expect(insertArg.longitude).toBe(21.0122287);
  });

  it('id przekazane jako klient_id do create() na adresy jest DOKŁADNIE tym samym id, które trafiło do create() na klienci — a leady.klient_id/adres_id zgadzają się analogicznie', async () => {
    await saveLead({ ...basePayload(), lat: 52.2296756, lng: 21.0122287 });

    expect(klienciCreateSpy).toHaveBeenCalledTimes(1);
    const klientRow = klienciCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    const adresRow = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(adresRow.klient_id).toBe(klientRow.id);

    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(leadRow.klient_id).toBe(klientRow.id);
    expect(leadRow.adres_id).toBe(adresRow.id);
  });

  it('id przekazane do create() klienci/adresy wygląda jak UUID (crypto.randomUUID(), nie pusty string ani inny placeholder)', async () => {
    await saveLead({ ...basePayload(), lat: 52.2296756, lng: 21.0122287 });

    expect(klienciCreateSpy).toHaveBeenCalledTimes(1);
    const klientRow = klienciCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(typeof klientRow.id).toBe('string');
    expect(klientRow.id).toMatch(UUID_SHAPE);

    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    const adresRow = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(typeof adresRow.id).toBe('string');
    expect(adresRow.id).toMatch(UUID_SHAPE);
  });
});
