import { describe, it, expect } from 'vitest';
import {
  getCompactPageNumbers,
  PAGE_ELLIPSIS,
  type CompactPageEntry,
} from '../src/app/(dashboard)/customers/pagination-state';

/**
 * Domykanie pokrycia dla `getCompactPageNumbers` (patrz `pagination-state.ts`, linia ok. 51),
 * używanej przez `leads-client.tsx` do renderu kompaktowej listy numerów stron
 * (`1 … 5 6 [7] 8 9 … 144`). Sąsiadująca w tym samym pliku `getPaginationState` ma
 * pełne pokrycie w `customers-pagination-controls.test.ts` — ten plik uzupełnia lukę
 * zgłoszoną przez reviewera dla drugiej funkcji z tego samego modułu.
 *
 * Brak `@REQ` — wzorem `customers-pagination-controls.test.ts`, to nie jest zarejestrowane
 * wymaganie kontraktowe (poprawka pokrycia UI po audycie reviewera), więc nie tagujemy.
 *
 * Czysta funkcja, bez efektów ubocznych — brak mocków.
 *
 * ZNALEZISKO (nie naprawiane tutaj, zob. finalny raport agenta):
 * Gdy między krawędzią (`1` albo `totalPages`) a sąsiadem aktywnej strony pozostaje do
 * pominięcia DOKŁADNIE jedna strona (np. `totalPages=10, currentPage=4` ->
 * `leftSiblingIndex=3`, pomijana jest tylko strona `2`), implementacja i tak wstawia
 * `PAGE_ELLIPSIS` zamiast pokazać tę jedną stronę jako liczbę. To dotyczy warunków
 * `showLeftEllipsis = leftSiblingIndex > 2` oraz `showRightEllipsis = rightSiblingIndex <
 * totalPages - 1` — obie odcinają przy pominięciu już pojedynczej strony, a nie dopiero
 * dwóch i więcej. Świadomie NIE testujemy tego jako oczekiwanego zachowania (to
 * wymuszałoby test na błędnym kontrakcie UX) — zgłoszone jako
 * TEST-DEFECT-CANDIDATE-ON-PRODUCTION w podsumowaniu tej tury.
 */

function pageNumbersOnly(entries: CompactPageEntry[]): number[] {
  return entries.filter((entry): entry is number => entry !== PAGE_ELLIPSIS);
}

function hasAdjacentDuplicateEllipsis(entries: CompactPageEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i] === PAGE_ELLIPSIS && entries[i - 1] === PAGE_ELLIPSIS) return true;
  }
  return false;
}

describe('getCompactPageNumbers — zakres krótki (totalPages <= próg), brak elipsy', () => {
  it('totalPages === 1 -> pojedyncza strona, brak elipsy', () => {
    expect(getCompactPageNumbers(1, 1)).toEqual([1]);
  });

  it('totalPages dokładnie na progu (7 dla domyślnego siblingCount=1) -> wszystkie strony, brak elipsy', () => {
    const result = getCompactPageNumbers(4, 7);
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result).not.toContain(PAGE_ELLIPSIS);
  });

  it('totalPages tuż poniżej progu (6) -> wszystkie strony niezależnie od currentPage', () => {
    expect(getCompactPageNumbers(1, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getCompactPageNumbers(6, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getCompactPageNumbers(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('getCompactPageNumbers — próg przejścia w tryb kompaktowy (totalPages > 7)', () => {
  it('totalPages tuż powyżej progu (8) -> pojawia się dokładnie jedna elipsa, wynik krótszy niż pełny zakres', () => {
    const result = getCompactPageNumbers(1, 8);
    expect(result.length).toBeLessThan(8);
    expect(result).toContain(PAGE_ELLIPSIS);
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(8);
  });
});

describe('getCompactPageNumbers — currentPage na skraju zakresu', () => {
  it('currentPage === 1 przy dużym totalPages -> brak elipsy z lewej, elipsa z prawej', () => {
    const result = getCompactPageNumbers(1, 20);

    expect(result[0]).toBe(1);
    // Brak elipsy zaraz po pierwszej stronie - lewa strona jest "pełna" (bez luki do ukrycia).
    expect(result[1]).not.toBe(PAGE_ELLIPSIS);
    expect(result).toContain(PAGE_ELLIPSIS);
    expect(result[result.length - 1]).toBe(20);
  });

  it('currentPage === totalPages przy dużym totalPages -> brak elipsy z prawej, elipsa z lewej', () => {
    const result = getCompactPageNumbers(20, 20);

    expect(result[result.length - 1]).toBe(20);
    expect(result[result.length - 2]).not.toBe(PAGE_ELLIPSIS);
    expect(result).toContain(PAGE_ELLIPSIS);
    expect(result[0]).toBe(1);
  });
});

describe('getCompactPageNumbers — środek dużego zakresu, elipsy po obu stronach', () => {
  it('totalPages=144, currentPage=63 -> elipsy z obu stron, aktywna strona i sąsiedzi widoczni, brak duplikatów', () => {
    const result = getCompactPageNumbers(63, 144);

    expect(result).toEqual([1, PAGE_ELLIPSIS, 62, 63, 64, PAGE_ELLIPSIS, 144]);

    const numbers = pageNumbersOnly(result);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('siblingCount=2 (parametr niedomyślny) -> dwóch sąsiadów z każdej strony aktywnej strony', () => {
    const result = getCompactPageNumbers(63, 144, 2);

    expect(result).toEqual([1, PAGE_ELLIPSIS, 61, 62, 63, 64, 65, PAGE_ELLIPSIS, 144]);
  });
});

describe('getCompactPageNumbers — pierwsza i ostatnia strona zawsze obecne', () => {
  it.each([
    [1, 50],
    [25, 50],
    [50, 50],
    [1, 144],
    [144, 144],
    [72, 144],
  ])('currentPage=%i, totalPages=%i -> wynik zawiera 1 i totalPages', (currentPage, totalPages) => {
    const result = getCompactPageNumbers(currentPage, totalPages);

    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(totalPages);
  });
});

describe('getCompactPageNumbers — brak sąsiadujących duplikatów PAGE_ELLIPSIS', () => {
  it.each([1, 2, 4, 8, 20, 50, 72, 100, 144])(
    'dla totalPages=%i (przemiatane po currentPage) żadne dwie elipsy nie sąsiadują ze sobą',
    (totalPages) => {
      for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        const result = getCompactPageNumbers(currentPage, totalPages);
        expect(hasAdjacentDuplicateEllipsis(result)).toBe(false);
      }
    },
  );
});

describe('getCompactPageNumbers — przypadki puste i degenerate', () => {
  it('totalPages === 0 -> pusta tablica, brak wyjątku', () => {
    expect(() => getCompactPageNumbers(1, 0)).not.toThrow();
    expect(getCompactPageNumbers(1, 0)).toEqual([]);
  });

  it('totalPages ujemne -> pusta tablica, brak wyjątku', () => {
    expect(getCompactPageNumbers(1, -5)).toEqual([]);
  });
});

describe('getCompactPageNumbers — brak duplikatów numerów stron w wyniku (przypadek maksymalny)', () => {
  it('totalPages=144, currentPage w środku -> zero powtórzonych numerów stron', () => {
    const result = getCompactPageNumbers(100, 144);
    const numbers = pageNumbersOnly(result);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
