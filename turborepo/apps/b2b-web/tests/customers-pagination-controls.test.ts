import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: kontrolki paginacji w widoku Klientów (brak numeru WO/rejestru wymagań — praca
 * wydajnościowo-UX, świadomie bez `@REQ`; `node tools/kk-trace.mjs --enforce` nie zna
 * tego identyfikatora i nie ma czego wymuszać).
 *
 * Kontekst (patrz `customers-get-customers-count-pagination.test.ts`, już GREEN):
 * `getCustomers()` w `customers/actions.ts` zwraca dziś `{ customers, totalPages }`.
 * Ale:
 *   1. `customers/page.tsx` destrukturyzuje wyłącznie `{ customers }` — `totalPages`
 *      jest wyrzucane, `searchParams.page` nie jest w ogóle czytane, `getCustomers()`
 *      jest wołane bez argumentów (zawsze strona 1, limit 50).
 *   2. `customers-client.tsx` nie ma żadnych kontrolek stronicowania — użytkownik nie
 *      ma jak dojść do klienta #51.
 *
 * Wzorzec referencyjny w tym samym repo: `leads/page.tsx` + `leads-client.tsx`.
 * `leads/page.tsx` czyta `searchParams.page` przez:
 *   const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
 * — dla braku parametru daje 1; dla śmieciowej wartości (`parseInt('abc', 10)` === `NaN`)
 * NIE ma dodatkowej ochrony w `leads/page.tsx` samym (`NaN` popłynąłby do `getLeads()`
 * niezmienione). Test-author MUSI zażądać identycznego zachowania (parity z leads),
 * a nie wymyślać drugi standard — stąd test niżej weryfikuje DOKŁADNIE ten sam wzorzec
 * `parseInt(...) || 1`-albo-równoważny, czyli fallback do 1 zarówno dla braku
 * `searchParams.page`, jak i dla wartości nie dającej się sparsować na liczbę.
 *
 * OGRANICZENIE INFRASTRUKTURALNE (patrz `customers-anonymize-ui.test.ts`,
 * `services-source-of-truth.test.ts` AC9): alias `@/*` nie jest skonfigurowany w root
 * `vitest.config.mts` — `customers-client.tsx` importuje `@/components/ui/button` i
 * `@/components/ui/dropdown-menu`, więc pełny render (`@testing-library/react`) tego
 * komponentu nie jest dziś wykonalny w tym pakiecie testów. Ten sam wzorzec co
 * `menu-visibility.ts`/`isAnonymizeMenuItemVisible`: logika stanu kontrolek paginacji
 * wydzielona do CZYSTEJ funkcji bez importów UI (`pagination-state.ts`), testowana
 * wprost jednostkowo, plus testy statyczne nad treścią źródeł `customers-client.tsx` /
 * `page.tsx`, żeby zamknąć lukę mutacyjną (sama obecność funkcji gdzieś w repo,
 * niepodłączonej do niczego, nie może dawać zielonego testu).
 *
 * ═══════════════════════ KONTRAKT DLA implementer-ui ═══════════════════════
 *
 * 1. Nowy plik `apps/b2b-web/src/app/(dashboard)/customers/pagination-state.ts`
 *    (bez importów UI, bez "use client"/"use server"), eksport:
 *
 *      export type PaginationState = {
 *        showPagination: boolean;
 *        canGoPrev: boolean;
 *        canGoNext: boolean;
 *        prevHref: string;
 *        nextHref: string;
 *      };
 *
 *      export function getPaginationState(
 *        currentPage: number,
 *        totalPages: number,
 *      ): PaginationState
 *
 *    Zachowanie:
 *      - `showPagination = totalPages > 1` (zgodnie z `leads-client.tsx`, gdzie blok
 *        nawigacji jest owinięty w `{totalPages > 1 && (...)}`) — przy jednej stronie
 *        (albo `totalPages === 0`, przypadek pustej bazy) kontrolki są zbędnym szumem.
 *      - `canGoPrev = currentPage > 1`, `canGoNext = currentPage < totalPages`
 *        (odpowiednik `disabled={currentPage <= 1 ...}` / `disabled={currentPage >= totalPages ...}`
 *        z `leads-client.tsx`, zanegowane na "czy przycisk jest AKTYWNY").
 *      - `prevHref` / `nextHref`: wzorem `buildPageUrl` z `leads-client.tsx`, ale bez
 *        parametru `status` (widok Klientów nie ma filtra etapu) — `?page=N`, z pominięciem
 *        parametru dla strony 1 (`?` zamiast `?page=1`). Href liczone niezależnie od tego,
 *        czy dany kierunek jest w ogóle dozwolony (przycisk i tak jest `disabled` przez
 *        `!canGoPrev`/`!canGoNext` — spójne z tym, że `leads-client.tsx` też nie warunkuje
 *        budowy URL-a przez to, czy strona docelowa istnieje).
 *
 * 2. `customers/page.tsx`:
 *      - `searchParams: Promise<{ page?: string }>`, odczyt analogiczny do `leads/page.tsx`:
 *          const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
 *        (fallback do 1 dla braku parametru ORAZ dla `NaN` musi być identyczny z tym, co
 *        `leads/page.tsx` faktycznie robi dziś — jeśli `leads/page.tsx` migruje na
 *        `parseInt(...) || 1`, `customers/page.tsx` ma zrobić to samo, nie coś ambitniejszego),
 *      - woła `getCustomers({ page })` (limit domyślny, jak w `getLeads`),
 *      - przekazuje `totalPages={result.totalPages}` i `currentPage={page}` do `<CustomersClient />`.
 *
 * 3. `customers-client.tsx`:
 *      - przyjmuje `totalPages: number` i `currentPage: number` jako propsy,
 *      - importuje `getPaginationState` z `./pagination-state` i renderuje blok nawigacji
 *        WARUNKOWO na `getPaginationState(currentPage, totalPages).showPagination`
 *        (nie na surowym `totalPages > 1` zduplikowanym lokalnie — jedno źródło prawdy),
 *      - przycisk „poprzednia" ma `disabled={!canGoPrev}`, przycisk „następna" —
 *        `disabled={!canGoNext}`.
 *
 * Dzisiejszy RED: `pagination-state.ts` jeszcze nie istnieje — import pada na braku
 * modułu (poprawny RED: nieistniejący, ale zaplanowany w tym kontrakcie plik, nie
 * literówka). Testy statyczne nad `customers-client.tsx` / `page.tsx` failują na
 * asercjach dopasowania treści (funkcja/prop jeszcze nieużyte), nie na błędzie
 * parsowania — plik dziś istnieje i jest poprawnym TS/TSX.
 */

const CUSTOMERS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/customers');
const LEADS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/leads');

function readCustomersClient(): string {
  return readFileSync(path.join(CUSTOMERS_DIR, 'customers-client.tsx'), 'utf-8');
}

function readCustomersPage(): string {
  return readFileSync(path.join(CUSTOMERS_DIR, 'page.tsx'), 'utf-8');
}

function readLeadsPage(): string {
  return readFileSync(path.join(LEADS_DIR, 'page.tsx'), 'utf-8');
}

describe('getPaginationState — czysta funkcja stanu kontrolek paginacji (bez renderu UI)', () => {
  it('showPagination jest false, gdy totalPages <= 1 (jedna strona albo baza pusta), true dla totalPages > 1', async () => {
    const { getPaginationState } = await import(
      '../src/app/(dashboard)/customers/pagination-state'
    );

    expect(getPaginationState(1, 0).showPagination).toBe(false);
    expect(getPaginationState(1, 1).showPagination).toBe(false);
    expect(getPaginationState(1, 2).showPagination).toBe(true);
    expect(getPaginationState(2, 5).showPagination).toBe(true);
  });

  it('canGoPrev jest false na stronie 1, true na dalszych stronach', async () => {
    const { getPaginationState } = await import(
      '../src/app/(dashboard)/customers/pagination-state'
    );

    expect(getPaginationState(1, 5).canGoPrev).toBe(false);
    expect(getPaginationState(2, 5).canGoPrev).toBe(true);
    expect(getPaginationState(5, 5).canGoPrev).toBe(true);
  });

  it('canGoNext jest false na ostatniej stronie, true na wcześniejszych stronach', async () => {
    const { getPaginationState } = await import(
      '../src/app/(dashboard)/customers/pagination-state'
    );

    expect(getPaginationState(5, 5).canGoNext).toBe(false);
    expect(getPaginationState(1, 5).canGoNext).toBe(true);
    expect(getPaginationState(4, 5).canGoNext).toBe(true);
  });

  // Przypadek brzegowy: jedna strona całkowita — ani prev, ani next nie mogą być aktywne,
  // niezależnie od tego, że showPagination i tak ukrywa cały blok. Kontrolki nie mogą
  // "przez przypadek" być aktywne, gdyby ktoś kiedyś zrenderował je bez sprawdzenia
  // showPagination.
  it('przypadek brzegowy: totalPages === 1 -> canGoPrev i canGoNext oboje false', async () => {
    const { getPaginationState } = await import(
      '../src/app/(dashboard)/customers/pagination-state'
    );

    const state = getPaginationState(1, 1);
    expect(state.canGoPrev).toBe(false);
    expect(state.canGoNext).toBe(false);
  });

  // Przypadek maksymalny / brzegowy dla pustej bazy: totalPages === 0. currentPage w tym
  // stanie to zawsze 1 (page.tsx nigdy nie zażąda strony 0) — funkcja nie może rzucić
  // wyjątku ani zwrócić canGoNext: true (nie ma dokąd iść).
  it('przypadek pusty: totalPages === 0 -> showPagination false, canGoNext false, brak wyjątku', async () => {
    const { getPaginationState } = await import(
      '../src/app/(dashboard)/customers/pagination-state'
    );

    expect(() => getPaginationState(1, 0)).not.toThrow();
    const state = getPaginationState(1, 0);
    expect(state.showPagination).toBe(false);
    expect(state.canGoNext).toBe(false);
    expect(state.canGoPrev).toBe(false);
  });

  it('prevHref i nextHref pomijają parametr page dla strony 1, ustawiają ?page=N dla N > 1', async () => {
    const { getPaginationState } = await import(
      '../src/app/(dashboard)/customers/pagination-state'
    );

    // Ze strony 2 cofnięcie prowadzi na stronę 1 -> brak parametru page w URL-u
    // (parytet z buildPageUrl w leads-client.tsx: `if (page && page > 1) params.set(...)`).
    const fromPage2 = getPaginationState(2, 5);
    expect(fromPage2.prevHref).not.toMatch(/page=1(&|$)/);
    expect(fromPage2.prevHref).not.toMatch(/page=0/);

    // Z pierwszej strony ruch naprzód prowadzi na stronę 2 -> ?page=2 obecne.
    const fromPage1 = getPaginationState(1, 5);
    expect(fromPage1.nextHref).toMatch(/page=2(&|$)/);

    // Z ostatniej strony (5 z 5) cofnięcie prowadzi na stronę 4.
    const fromLast = getPaginationState(5, 5);
    expect(fromLast.prevHref).toMatch(/page=4(&|$)/);
  });
});

describe('customers/page.tsx — czyta searchParams.page z fallbackiem do 1, parytet z leads/page.tsx', () => {
  it('leads/page.tsx faktycznie stosuje wzorzec fallbacku do 1 (kontrola pozytywna wzorca, na którym opieramy wymaganie)', () => {
    const content = readLeadsPage();

    expect(content).toMatch(
      /searchParams\.page\s*\?\s*parseInt\(\s*searchParams\.page\s*,\s*10\s*\)\s*:\s*1/,
    );
  });

  it('page.tsx deklaruje searchParams.page jako część typu propsów', () => {
    const content = readCustomersPage();

    expect(content).toMatch(/searchParams\s*:\s*Promise<\{[^}]*page\s*\?:\s*string[^}]*\}>/);
  });

  it('page.tsx czyta page ze searchParams tym samym wzorcem fallbacku co leads/page.tsx (searchParams.page ? parseInt(...) : 1)', () => {
    const content = readCustomersPage();

    expect(content).toMatch(
      /searchParams\.page\s*\?\s*parseInt\(\s*searchParams\.page\s*,\s*10\s*\)\s*:\s*1/,
    );
  });

  it('page.tsx przekazuje odczytaną stronę do getCustomers({ page })', () => {
    const content = readCustomersPage();

    expect(content).toMatch(/getCustomers\(\s*\{\s*page[\s\S]{0,40}\}\s*\)/);
  });
});

describe('customers/page.tsx — przekazuje totalPages i currentPage do CustomersClient (dziś nie przekazuje żadnego z nich)', () => {
  it('destrukturyzuje totalPages z wyniku getCustomers() (nie tylko { customers })', () => {
    const content = readCustomersPage();

    expect(content).toMatch(/\{\s*customers\s*,\s*totalPages\s*\}/);
  });

  it('<CustomersClient /> otrzymuje prop totalPages', () => {
    const content = readCustomersPage();

    expect(content).toMatch(/<CustomersClient[\s\S]*?\btotalPages\s*=\s*\{[^}]+\}/);
  });

  it('<CustomersClient /> otrzymuje prop currentPage', () => {
    const content = readCustomersPage();

    expect(content).toMatch(/<CustomersClient[\s\S]*?\bcurrentPage\s*=\s*\{[^}]+\}/);
  });
});

describe('customers-client.tsx — renderuje nawigację paginacji tylko gdy totalPages > 1, wzorem leads-client.tsx', () => {
  it('kontrola pozytywna wzorca: leads-client.tsx warunkuje blok nawigacji przez totalPages > 1', () => {
    const leadsClientContent = readFileSync(
      path.join(LEADS_DIR, 'leads-client.tsx'),
      'utf-8',
    );

    expect(leadsClientContent).toMatch(/\{\s*totalPages\s*>\s*1\s*&&/);
  });

  it('przyjmuje totalPages i currentPage jako propsy', () => {
    const content = readCustomersClient();

    expect(content).toMatch(/totalPages\s*:\s*number/);
    expect(content).toMatch(/currentPage\s*:\s*number/);
  });

  it('importuje getPaginationState z ./pagination-state i woła go z (currentPage, totalPages)', () => {
    const content = readCustomersClient();

    expect(content).toMatch(
      /import\s*\{[^}]*getPaginationState[^}]*\}\s*from\s*['"]\.\/pagination-state['"]/,
    );
    expect(content).toMatch(/getPaginationState\(\s*currentPage\s*,\s*totalPages\s*\)/);
  });

  it('nie duplikuje lokalnie warunek "totalPages > 1" jako źródło prawdy dla widoczności bloku nawigacji (musi płynąć z showPagination)', () => {
    const content = readCustomersClient();

    expect(content).not.toMatch(/\{\s*totalPages\s*>\s*1\s*&&/);
  });
});

describe('customers-client.tsx — przycisk "poprzednia" nieaktywny na stronie 1, "następna" na ostatniej', () => {
  it('przycisk cofania paginacji ma disabled powiązane z !canGoPrev (nie z surowym currentPage <= 1 zduplikowanym lokalnie)', () => {
    const content = readCustomersClient();

    expect(content).toMatch(/disabled=\{[^}]*!canGoPrev[^}]*\}/);
  });

  it('przycisk kolejnej strony ma disabled powiązane z !canGoNext', () => {
    const content = readCustomersClient();

    expect(content).toMatch(/disabled=\{[^}]*!canGoNext[^}]*\}/);
  });

  // Kontrola mutacyjna: same nazwy `canGoPrev`/`canGoNext` w pliku bez faktycznego
  // wywołania getPaginationState (test wyżej) i bez propsów totalPages/currentPage
  // (test wyżej) nie wystarczą — te trzy testy razem zamykają lukę, w której ktoś
  // deklaruje lokalne zmienne o tych samych nazwach zamiast użyć kontraktu.
  it('canGoPrev i canGoNext użyte w disabled pochodzą z destrukturyzacji wyniku getPaginationState', () => {
    const content = readCustomersClient();

    const callIndex = content.indexOf('getPaginationState(');
    expect(callIndex).toBeGreaterThan(-1);

    // Poprzedzający wywołanie fragment (destrukturyzacja) musi wymieniać obie nazwy —
    // wzorzec `const { showPagination, canGoPrev, canGoNext, ... } = getPaginationState(...)`
    // albo dowolna kolejność pól w tej samej destrukturyzacji.
    const precedingContext = content.slice(Math.max(0, callIndex - 300), callIndex);
    expect(precedingContext).toMatch(/canGoPrev/);
    expect(precedingContext).toMatch(/canGoNext/);
  });
});
