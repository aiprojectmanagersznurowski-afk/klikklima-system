import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Audyt: `docs/performance/AUDYT-B2B-2026-09-02.md`, znalezisko P1-3.
 *
 * Dziś `getCustomers()` (`customers/actions.ts`) robi:
 *   prisma.klienci.findMany({
 *     include: { leady: { include: { instalacje: true } } },
 *     orderBy: { created_at: 'desc' },
 *   })
 * Zmierzone: 1275 ms na PUSTEJ tabeli (≈8 roundtripów — Prisma rozbija zagnieżdżone
 * relacje na osobne zapytania). Z całego wyniku używane są wyłącznie dwie liczby:
 * `leady.length` i suma `instalacje.length`. Brak `take`/`skip` — koszt rośnie liniowo
 * bez ograniczenia.
 *
 * ═══════════════════════ KONTRAKT PROPONOWANY DLA IMPLEMENTERA ═══════════════════════
 *
 * Wzorowany na `getLeads()` (`leads/actions.ts`, w tym samym repo) dla spójności wzorca:
 * paginacja `page`/`limit` z domyślnym `limit = 50` (identyczna wartość domyślna jak
 * w `getLeads`), `skip = (page - 1) * limit`, zliczanie `_count` po stronie bazy
 * zamiast pełnego `include` + `.length` w JS.
 *
 *   export async function getCustomers(
 *     options?: { page?: number; limit?: number }
 *   ): Promise<{ customers: CustomerSummary[]; totalPages: number }>
 *
 * Uwaga: `getLeads()` NIE zwraca `currentPage` w wyniku — `page.tsx` śledzi bieżącą
 * stronę samodzielnie (z `searchParams`) i przekazuje ją do komponentu klienckiego
 * osobno. Ten sam wzorzec proponujemy tutaj (brak `currentPage` w zwracanym obiekcie).
 *
 * Zapytanie o dane strony i zapytanie o łączną liczbę klientów (do wyliczenia
 * `totalPages`) idą jak w `getLeads()` przez `Promise.all` — nie asercjonujemy tu
 * kolejności/równoległości (to osobny temat, P0-2 audytu), tylko że obie strony
 * zapytania w ogóle istnieją i mają poprawny kształt.
 *
 * Kształt `select` (dowolna forma spełniająca poniższe trzy warunki jest akceptowalna
 * — testy sprawdzają WŁAŚCIWOŚCI kształtu, nie identyczność co do bajtu):
 *   1. Brak zagnieżdżonego pobierania PEŁNYCH wierszy `instalacje` (żadne `instalacje: true`
 *      ani `include: { instalacje: true }` na żadnym poziomie zagnieżdżenia).
 *   2. Liczba leadów klienta pochodzi z `_count` (np. `_count: { select: { leady: true } }`),
 *      nie z tablicy pełnych rekordów `leady`.
 *   3. Liczba instalacji pochodzi z `_count` policzonego per-lead (np.
 *      `leady: { select: { _count: { select: { instalacje: true } } } }`), sumowanego
 *      w JS wyłącznie po polu `_count.instalacje` — NIE po `.length` żadnej tablicy
 *      pełnych rekordów instalacji.
 *
 * `anonymized_at`: zweryfikowane — `customers-client.tsx` i `CustomerSummary` NIE
 * używają dziś tej kolumny (nazwa "Klient usunięty" wchodzi przez istniejące pole
 * `imie_i_nazwisko` ustawiane na `ANONYMIZED_NAME_PLACEHOLDER` przy anonimizacji,
 * `customers-anonymize-rodo.test.ts`). Nowy kształt zapytania nie musi jej wybierać —
 * brak testu na ten temat jest świadomy, nie przeoczeniem.
 *
 * UWAGA DLA implementer-ui / implementer-server: zmiana sygnatury z `Promise<CustomerSummary[]>`
 * na `Promise<{ customers: CustomerSummary[]; totalPages: number }>` jest ZMIANĄ ŁAMIĄCĄ.
 * Dziś `customers/page.tsx` robi:
 *   const [customers, actorRole] = await Promise.all([getCustomers(), getCurrentActorRole()]);
 *   return <CustomersClient initialCustomers={customers} .../>
 * i musi zostać zaktualizowane do odczytu `.customers`/`.totalPages` (wzorem
 * `leads/page.tsx`), a `customers-client.tsx` prawdopodobnie potrzebuje kontrolek
 * paginacji (dziś ich nie ma). To NIE jest w zakresie test-authora — zgłoszone tutaj
 * jako kontrakt, żeby GREEN nie zaskoczył wywołujących.
 *
 * Mockujemy `@repo/database` (brak żywej instancji testowej).
 */

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    klienci: {
      findMany: findManyMock,
      count: countMock,
    },
  },
}));

const { getCustomers } = await import('../src/app/(dashboard)/customers/actions');

/** Wiersz z bazy w NOWYM kształcie (_count), tak jak powinien wyglądać po naprawie. */
function makeRow(overrides: Partial<{
  id: string;
  imie_i_nazwisko: string | null;
  email: string | null;
  telefon: string | null;
  created_at: Date;
  leadsCount: number;
  installationCountsPerLead: number[];
}> = {}) {
  // TEST-DEFECT 2 (naprawa): `??` traktuje jawne `null` jak "brak wartości", więc
  // `makeRow({ imie_i_nazwisko: null })` wcześniej faktycznie podstawiał domyślne
  // 'Jan Kowalski' zamiast przekazać `null` dalej — test fallbacku "Nieznany" nie mógł
  // przejść niezależnie od poprawności kodu produkcyjnego. `'klucz' in overrides`
  // odróżnia "nie podano" od "podano jawnie null".
  const leadsCount = 'leadsCount' in overrides ? overrides.leadsCount! : 2;
  const installationCountsPerLead =
    'installationCountsPerLead' in overrides ? overrides.installationCountsPerLead! : [1, 3];
  return {
    id: 'id' in overrides ? overrides.id! : 'klient-1',
    imie_i_nazwisko: 'imie_i_nazwisko' in overrides ? overrides.imie_i_nazwisko! : 'Jan Kowalski',
    email: 'email' in overrides ? overrides.email! : 'jan@example.com',
    telefon: 'telefon' in overrides ? overrides.telefon! : '111222333',
    created_at: 'created_at' in overrides ? overrides.created_at! : new Date('2026-01-01T00:00:00.000Z'),
    _count: { leady: leadsCount },
    leady: installationCountsPerLead.map((n) => ({ _count: { instalacje: n } })),
  };
}

function findManyCallArgs(): any {
  expect(findManyMock).toHaveBeenCalledTimes(1);
  return findManyMock.mock.calls[0][0];
}

/**
 * TEST-DEFECT 1 (naprawa): przeszukuje rekurencyjnie obiekt argumentów zapytania w
 * poszukiwaniu pobrania PEŁNYCH wierszy relacji `instalacje` (`instalacje: true` jako
 * relacja pod `select`/`include`, np. stary `include: { leady: { include: { instalacje:
 * true } } }`). NIE flaguje `instalacje: true` wewnątrz `_count: { select: { ... } }` —
 * to jedyny poprawny sposób wyrażenia w Prismie "policz relację instalacje" i jest
 * dokładnie formą, którą ten sam plik (patrz docstring wyżej) podaje jako kształt
 * docelowy. Pomijamy więc całe poddrzewo pod kluczem `_count`, zamiast płytko sprawdzać
 * klucz `instalacje` w oderwaniu od kontekstu.
 */
function hasFullInstalacjeFetch(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key === '_count') continue;
    if (key === 'instalacje' && v === true) return true;
    if (hasFullInstalacjeFetch(v)) return true;
  }
  return false;
}

describe('getCustomers() — _count zamiast zagnieżdżonego include (P1-3, audyt 2026-09-02)', () => {
  beforeEach(() => {
    findManyMock.mockReset();
    countMock.mockReset();
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it('zapytanie NIE pobiera pełnych wierszy instalacje na żadnym poziomie zagnieżdżenia', async () => {
    await getCustomers();

    const args = findManyCallArgs();
    expect(hasFullInstalacjeFetch(args)).toBe(false);
  });

  it('liczba leadów klienta pochodzi z _count, nie z include pełnych rekordów leady', async () => {
    await getCustomers();

    const args = findManyCallArgs();
    // `_count: { select: { leady: true } }` w select/include na poziomie klienta.
    const countSelect = args.select?._count?.select ?? args.include?._count?.select;
    expect(countSelect?.leady).toBe(true);

    // Nigdzie w argumentach zapytania nie ma `leady: true` (co ściągnęłoby pełne wiersze).
    expect(args.select?.leady).not.toBe(true);
    expect(args.include?.leady).not.toBe(true);
  });

  it('liczba instalacji per-klient pochodzi z _count per-lead, sumowanego w JS po polu _count.instalacje', async () => {
    findManyMock.mockResolvedValue([
      makeRow({ id: 'k1', leadsCount: 2, installationCountsPerLead: [1, 3] }),
    ]);
    countMock.mockResolvedValue(1);

    const result = await getCustomers();

    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({
      id: 'k1',
      leadsCount: 2,
      installationsCount: 4, // 1 + 3, z _count, nie z .length pełnych tablic
    });
  });

  it('domyślna paginacja: strona 1, limit 50 (spójne z domyślnym limitem getLeads)', async () => {
    await getCustomers();

    const args = findManyCallArgs();
    expect(args.skip).toBe(0);
    expect(args.take).toBe(50);
  });

  it('paginacja: params.page/limit przekładają się na skip/take', async () => {
    await getCustomers({ page: 3, limit: 20 });

    const args = findManyCallArgs();
    expect(args.skip).toBe(40); // (3 - 1) * 20
    expect(args.take).toBe(20);
  });

  it('totalPages liczone z prisma.klienci.count(), nie z długości pobranej strony wyników', async () => {
    findManyMock.mockResolvedValue([makeRow({ id: 'k1' })]); // jedna strona wyniku
    countMock.mockResolvedValue(101); // ale łącznie 101 klientów w bazie

    const result = await getCustomers({ page: 1, limit: 50 });

    expect(countMock).toHaveBeenCalledTimes(1);
    expect(result.totalPages).toBe(3); // Math.ceil(101 / 50)
  });

  it('name ma fallback "Nieznany" gdy imie_i_nazwisko jest null (zachowanie istniejące, nie może się zepsuć)', async () => {
    findManyMock.mockResolvedValue([makeRow({ id: 'k1', imie_i_nazwisko: null })]);
    countMock.mockResolvedValue(1);

    const result = await getCustomers();

    expect(result.customers[0].name).toBe('Nieznany');
  });

  it('kształt wyniku to { customers, totalPages } — nie goła tablica jak dziś', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    const result = await getCustomers();

    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty('customers');
    expect(result).toHaveProperty('totalPages');
    expect(Array.isArray(result.customers)).toBe(true);
  });

  it('przypadek pusty: zero klientów w bazie -> customers: [], totalPages: 0, brak wyjątku', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    const result = await getCustomers();

    expect(result.customers).toEqual([]);
    expect(result.totalPages).toBe(0);
  });
});
