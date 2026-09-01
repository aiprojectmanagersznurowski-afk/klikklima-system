import { describe, it, expect, afterEach } from 'vitest';

/**
 * Wymaganie: FNL-B-FORMATDATE (Work Order BATCH-MEDIUM-LOW-CLEANUP.md, punkt 2).
 *
 * Dziś `leads-client.tsx` ma lokalny `formatDate()` oparty o
 * `formatInTimeZone(date, 'Europe/Warsaw', pattern, { locale: pl })`
 * (apps/b2b-web/src/app/(dashboard)/leads/leads-client.tsx, linie ~15-17).
 * Cztery inne pliki (`incidents-client.tsx`, `services-client.tsx`,
 * `installations-client.tsx`, `customers-client.tsx`) używają gołego
 * `format(new Date(...), pattern)` z `date-fns` — BEZ strefy czasowej, co
 * powoduje hydration mismatch (serwer i przeglądarka klienta mogą być w innych
 * strefach) oraz błędne "przesunięcie dnia" w nocnych godzinach.
 *
 * Ten plik testuje NOWY, jeszcze NIEISTNIEJĄCY moduł
 * `apps/b2b-web/src/lib/format-date.ts`, który ma:
 *   - eksportować `APP_TIMEZONE = 'Europe/Warsaw'`,
 *   - eksportować `formatDate(date: Date | string | null | undefined, pattern: string): string`
 *     zwracające "—" dla null/undefined i sformatowaną datę w Europe/Warsaw
 *     w przeciwnym razie.
 *
 * W repo NIE znaleziono istniejącego wzorca manipulacji `process.env.TZ` w
 * testach (grep po `process.env.TZ` w całym repo — brak wyników). Node.js
 * czyta `process.env.TZ` leniwie przy każdym wywołaniu formatowania dat (nie
 * cache'uje go raz na start procesu), więc ustawienie `process.env.TZ` tuż
 * przed wywołaniem `formatDate()` w teście jest wystarczające i bezpieczne —
 * przywracamy oryginalną wartość w `afterEach`, żeby nie wyciekało między
 * testami w tym samym procesie vitest.
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

describe('formatDate (apps/b2b-web/src/lib/format-date.ts)', () => {
  it('AC2.1 daje identyczny tekst niezależnie od strefy czasowej hosta (UTC vs Europe/Warsaw), dla wszystkich 4 wzorców użytych w kodzie', async () => {
    const patterns = ['dd.MM.yyyy HH:mm', 'dd MMM yyyy', 'dd MMMM yyyy', 'dd.MM.yyyy'];
    const instant = '2026-06-15T10:30:00Z';

    for (const pattern of patterns) {
      process.env.TZ = 'UTC';
      const { formatDate } = await import('../src/lib/format-date');
      const underUtc = formatDate(instant, pattern);

      process.env.TZ = 'Europe/Warsaw';
      // moduł już zaimportowany (cache) — formatDate musi sam wymuszać Europe/Warsaw
      // niezależnie od strefy hosta, więc wynik powinien być identyczny bez re-importu
      const underWarsawHost = formatDate(instant, pattern);

      expect(underWarsawHost).toBe(underUtc);
    }
  });

  it('AC2.3 2026-01-01T23:30:00Z z "dd.MM.yyyy" daje "02.01.2026" (dzień następny w Warszawie)', async () => {
    process.env.TZ = 'UTC';
    const { formatDate } = await import('../src/lib/format-date');

    const result = formatDate('2026-01-01T23:30:00Z', 'dd.MM.yyyy');

    expect(result).toBe('02.01.2026');
  });

  it('przypadek brzegowy: zmiana czasu z zimowego na letni (2026-03-29) — offset zastosowany poprawnie po obu stronach', async () => {
    process.env.TZ = 'UTC';
    const { formatDate } = await import('../src/lib/format-date');

    // Przeskok następuje 2026-03-29 01:00:00Z (02:00 CET -> 03:00 CEST).
    // 2026-03-29 00:30 UTC = 01:30 CET (przed zmianą, offset +1)
    const beforeChange = formatDate('2026-03-29T00:30:00Z', 'dd.MM.yyyy HH:mm');
    // 2026-03-29 01:30 UTC = 03:30 CEST (po zmianie, offset +2)
    const afterChange = formatDate('2026-03-29T01:30:00Z', 'dd.MM.yyyy HH:mm');

    expect(beforeChange).toBe('29.03.2026 01:30');
    expect(afterChange).toBe('29.03.2026 03:30');
  });

  it('przypadek brzegowy: zmiana czasu z letniego na zimowy (2026-10-25) — offset zastosowany poprawnie po obu stronach', async () => {
    process.env.TZ = 'UTC';
    const { formatDate } = await import('../src/lib/format-date');

    // 2026-10-25 00:30 UTC = 02:30 CEST (przed przeskokiem, offset +2)
    const beforeChange = formatDate('2026-10-25T00:30:00Z', 'dd.MM.yyyy HH:mm');
    // 2026-10-25 01:30 UTC = 02:30 CET (po przeskoku 01:00 UTC, offset +1)
    const afterChange = formatDate('2026-10-25T01:30:00Z', 'dd.MM.yyyy HH:mm');

    expect(beforeChange).toBe('25.10.2026 02:30');
    expect(afterChange).toBe('25.10.2026 02:30');
  });

  it('przypadek brzegowy: null zwraca "—", nie "Invalid Date"', async () => {
    const { formatDate } = await import('../src/lib/format-date');

    expect(formatDate(null, 'dd.MM.yyyy')).toBe('—');
  });

  it('przypadek brzegowy: undefined zwraca "—", nie "Invalid Date"', async () => {
    const { formatDate } = await import('../src/lib/format-date');

    expect(formatDate(undefined, 'dd.MM.yyyy')).toBe('—');
  });

  it('eksportuje APP_TIMEZONE równe "Europe/Warsaw"', async () => {
    const mod = await import('../src/lib/format-date');

    expect(mod.APP_TIMEZONE).toBe('Europe/Warsaw');
  });

  it('używa polskiego locale dla skróconej nazwy miesiąca ("dd MMM yyyy" -> "cze", nie "Jun")', async () => {
    const { formatDate } = await import('../src/lib/format-date');

    expect(formatDate('2026-06-15T10:30:00Z', 'dd MMM yyyy')).toBe('15 cze 2026');
  });

  it('używa polskiego locale dla pełnej nazwy miesiąca ("dd MMMM yyyy" -> "czerwca", nie "June")', async () => {
    const { formatDate } = await import('../src/lib/format-date');

    expect(formatDate('2026-06-15T10:30:00Z', 'dd MMMM yyyy')).toBe('15 czerwca 2026');
  });

  it('przypadek brzegowy: string pusty zwraca "—", nie rzuca RangeError', async () => {
    const { formatDate } = await import('../src/lib/format-date');

    expect(formatDate('', 'dd.MM.yyyy')).toBe('—');
  });

  it('przypadek brzegowy: nieparsowalny string zwraca "—", nie rzuca RangeError', async () => {
    const { formatDate } = await import('../src/lib/format-date');

    expect(formatDate('nie-data', 'dd.MM.yyyy')).toBe('—');
  });
});
