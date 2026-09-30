import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Znalezisko N1 (audyt bezpieczeństwa tej sesji): `saveLead` jest publiczną Server Action
 * BEZ autoryzacji (B2C, klient niezalogowany). Ostatni, zewnętrzny blok `catch` w tym pliku
 * (koniec funkcji) zwraca `err.message` klientowi BEZ FILTROWANIA:
 *
 *   } catch (err: any) {
 *     console.error("saveLead Error:", err);
 *     return { success: false, error: err.message };
 *   }
 *
 * Każdy INNY blok w `saveLead.ts` celowo zwraca ustalony, bezpieczny `message` — ten jeden,
 * ostatni, jest wyjątkiem od reguły całego pliku. Jeżeli cokolwiek NIEROZPOZNANE wewnątrz
 * funkcji rzuci błąd niosący surowy szczegół silnika bazy (nazwa ograniczenia unikalności,
 * fragment wartości kolumny z komunikatu Postgresa, "DETAIL: ..."), ten szczegół dziś
 * ucieka wprost do nieuwierzytelnionego wywołującego.
 *
 * Ten plik jest testem regresyjnym broniącym naprawy tego wycieku (kod produkcyjny został
 * już naprawiony przez `implementer-server` — testy poniżej są zielone na obecnym kodzie,
 * nie oczekuje się już RED). Kontrakt naprawy: kod zwrotny ustalony (nie treść wyjątku),
 * treść ogólna po polsku, ŻADEN fragment surowego komunikatu wyjątku nie trafia do żadnego
 * pola odpowiedzi. Logowanie serwerowe (`console.error`) NIE jest tu ograniczane — może
 * nadal nieść pełny szczegół, bo nie jest publiczne.
 *
 * Mechanizm wywołania nierozpoznanego błędu: `prisma.visitDurationBasket.findFirst` (krok
 * przygotowawczy, POZA transakcją, POZA per-kandydackim `try/catch`) rzuca błąd — jedyne
 * miejsce w funkcji, którego wyjątek trafia WYŁĄCZNIE do zewnętrznego, ostatniego `catch`,
 * bez żadnej pośredniej obsługi domenowej mogącej go przechwycić inaczej.
 */

const { transactionSpy, calendarSpy, visitDurationBasketFindFirstMock, prepareBookingCandidatesSpy, writeBookingCandidateSpy } =
  vi.hoisted(() => {
    const transactionSpy = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({}));
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
    // Domyślnie sukces — nadpisywany per-test na `mockRejectedValueOnce`, żeby wywołać
    // nierozpoznany błąd, POZA transakcją, przed jakąkolwiek obsługą domenową.
    const visitDurationBasketFindFirstMock = vi.fn(async (_args: Record<string, unknown>) => ({
      id: 'basket-audit-id',
      code: 'AUDIT',
      isActive: true,
      durationMinutes: 120,
      pool: 'AUDITOR',
    }));

    return {
      transactionSpy,
      calendarSpy,
      visitDurationBasketFindFirstMock,
      prepareBookingCandidatesSpy,
      writeBookingCandidateSpy,
    };
  });

// Stub NIEUŻYWANY merytorycznie — patrz uzasadnienie identyczne jak w `saveLead.test.ts`
// (alias `@/*` niedostępny w tym vitest.config.mts, import realnego modułu bez tego mocka
// pada na nierozwiązywalnym imporcie — RED z niewłaściwego powodu).
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));
vi.mock('@repo/scheduling', () => ({
  prepareBookingCandidates: prepareBookingCandidatesSpy,
  writeBookingCandidate: writeBookingCandidateSpy,
  findPoolSlots: vi.fn(async () => ({ slots: [] })),
}));
vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findFirst: visitDurationBasketFindFirstMock },
    $transaction: transactionSpy,
  },
  Prisma: {},
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

// Realistyczny kształt surowego komunikatu Postgresa przy naruszeniu ograniczenia
// unikalności — nazwa ograniczenia i PII klienta (adres e-mail) WEWNĄTRZ treści wyjątku,
// dokładnie tak, jak wyglądałby nieprzechwycony błąd sterownika bazy danych.
const RAW_CONSTRAINT_NAME = 'klienci_email_key';
const RAW_PII_EMAIL = 'jan.kowalski@example.com';
const RAW_DB_ERROR_MESSAGE =
  `duplicate key value violates unique constraint "${RAW_CONSTRAINT_NAME}" ` +
  `DETAIL: Key (email)=(${RAW_PII_EMAIL}) already exists.`;

describe('saveLead — błąd nierozpoznany nie ujawnia surowego szczegółu bazy danych klientowi (N1, wyciek błędu)', () => {
  beforeEach(() => {
    transactionSpy.mockClear();
    calendarSpy.mockClear();
    prepareBookingCandidatesSpy.mockClear();
    writeBookingCandidateSpy.mockClear();
    visitDurationBasketFindFirstMock.mockReset();
    visitDurationBasketFindFirstMock.mockImplementation(async (_args: Record<string, unknown>) => ({
      id: 'basket-audit-id',
      code: 'AUDIT',
      isActive: true,
      durationMinutes: 120,
      pool: 'AUDITOR',
    }));
  });

  // Test regresyjny N1: dowodzi że wyciek surowego komunikatu bazy do klienta jest zablokowany.
  it('nierozpoznany błąd (surowy komunikat Postgresa z PII) nie pojawia się w ŻADNYM polu odpowiedzi zwróconej klientowi', async () => {
    visitDurationBasketFindFirstMock.mockRejectedValueOnce(new Error(RAW_DB_ERROR_MESSAGE));

    const result = await saveLead(basePayload());

    // Dowód, że błąd faktycznie doszedł do funkcji (inaczej test nic by nie sprawdzał).
    expect(result.success).toBe(false);

    const serialized = JSON.stringify(result);

    // Sprawdzenie CAŁEGO zserializowanego wyniku, nie jednego, dziś znanego pola —
    // implementer może wybrać dowolną nazwę pola dla bezpiecznej treści.
    expect(serialized).not.toContain(RAW_CONSTRAINT_NAME);
    expect(serialized).not.toContain(RAW_PII_EMAIL);
    expect(serialized).not.toContain('DETAIL:');
    expect(serialized).not.toContain(RAW_DB_ERROR_MESSAGE);
  });

  // Test regresyjny N1: kod zwrotny i komunikat są ustalone, nie pochodzą z treści wyjątku.
  it('nierozpoznany błąd zwraca success:false, ustalony kod (nie treść wyjątku) i ogólny, bezpieczny komunikat po polsku', async () => {
    visitDurationBasketFindFirstMock.mockRejectedValueOnce(new Error(RAW_DB_ERROR_MESSAGE));

    const result = await saveLead(basePayload());

    expect(result.success).toBe(false);

    const withCode = result as Record<string, unknown>;
    expect(typeof withCode.code).toBe('string');
    expect(withCode.code).not.toBe(RAW_DB_ERROR_MESSAGE);
    expect(String(withCode.code)).not.toContain(RAW_CONSTRAINT_NAME);

    // Komunikat ma być ogólny — dopasowanie częściowe do rodziny sformułowań "błąd" /
    // "spróbuj ponownie", bez zakładania dokładnej treści (implementer dobiera brzmienie).
    const messageField = (withCode.message ?? withCode.error) as string | undefined;
    expect(typeof messageField).toBe('string');
    expect(messageField as string).toMatch(/błąd|spróbuj ponownie/i);
    expect(messageField as string).not.toContain(RAW_CONSTRAINT_NAME);
    expect(messageField as string).not.toContain(RAW_PII_EMAIL);
  });

  // Test regresyjny N1: logowanie serwerowe CELOWO zostaje pełne (kontrast z odpowiedzią
  // klienta) — logi nie są publiczne, więc filtrowanie tu byłoby błędem, nie naprawą.
  it('logowanie serwerowe (console.error) MOŻE nadal nieść pełny surowy błąd — ograniczenie dotyczy wyłącznie wartości zwracanej do klienta', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    visitDurationBasketFindFirstMock.mockRejectedValueOnce(new Error(RAW_DB_ERROR_MESSAGE));

    await saveLead(basePayload());

    // Asercja jawna: log niesie PEŁNY, surowy błąd (nazwę ograniczenia i PII), zgodnie z
    // faktycznym wywołaniem w kodzie: console.error("saveLead Error:", err).
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'saveLead Error:',
      expect.objectContaining({ message: expect.stringContaining(RAW_CONSTRAINT_NAME) }),
    );

    consoleErrorSpy.mockRestore();
  });
});
