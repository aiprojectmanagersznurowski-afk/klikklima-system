/**
 * Czysta funkcja stanu kontrolek paginacji dla widoku Klientów — bez importów UI,
 * testowana wprost jednostkowo (patrz `tests/customers-pagination-controls.test.ts`).
 * Wzorem `buildPageUrl` z `leads-client.tsx`, ale bez parametru `status` (widok
 * Klientów nie ma filtra etapu).
 */

export type PaginationState = {
  showPagination: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  prevHref: string;
  nextHref: string;
};

function buildPageUrl(page: number): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  return `?${params.toString()}`;
}

export function getPaginationState(currentPage: number, totalPages: number): PaginationState {
  return {
    showPagination: totalPages > 1,
    canGoPrev: currentPage > 1,
    canGoNext: currentPage < totalPages,
    prevHref: buildPageUrl(currentPage - 1),
    nextHref: buildPageUrl(currentPage + 1),
  };
}

/**
 * Placeholder elipsy w kompaktowej liście numerów stron — odróżnialny od
 * numeru strony (`number`) przez konsumenta bez porównywania stringów.
 */
export const PAGE_ELLIPSIS = "ellipsis" as const;

export type CompactPageEntry = number | typeof PAGE_ELLIPSIS;

/**
 * Kompaktowa lista numerów stron do paginacji przy dużej liczbie stron
 * (np. 7200 leadów / 50 na stronę = 144 strony — pełny zakres byłby 144
 * przyciskami w DOM). Zwraca zawsze pierwszą i ostatnią stronę, aktualną
 * stronę z jednym sąsiadem z każdej strony, i elipsy zamiast pominiętych
 * zakresów. Przykład: currentPage=7, totalPages=144 ->
 * [1, 'ellipsis', 6, 7, 8, 'ellipsis', 144].
 *
 * Bez importów UI — czysta funkcja, testowalna wprost jednostkowo, wzorem
 * `getPaginationState` wyżej.
 */
export function getCompactPageNumbers(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): CompactPageEntry[] {
  if (totalPages <= 0) return [];

  const totalNumbersShown = siblingCount * 2 + 5; // pierwsza + ostatnia + aktualna + 2*siblingi + 2 elipsy(max)
  if (totalPages <= totalNumbersShown) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const clampedCurrent = Math.min(Math.max(currentPage, 1), totalPages);
  const leftSiblingIndex = Math.max(clampedCurrent - siblingCount, 1);
  const rightSiblingIndex = Math.min(clampedCurrent + siblingCount, totalPages);

  const showLeftEllipsis = leftSiblingIndex > 3;
  const showRightEllipsis = rightSiblingIndex < totalPages - 2;

  const pages: CompactPageEntry[] = [1];

  if (showLeftEllipsis) {
    pages.push(PAGE_ELLIPSIS);
  } else {
    for (let p = 2; p < leftSiblingIndex; p++) pages.push(p);
  }

  for (let p = leftSiblingIndex; p <= rightSiblingIndex; p++) {
    if (p !== 1 && p !== totalPages) pages.push(p);
  }

  if (showRightEllipsis) {
    pages.push(PAGE_ELLIPSIS);
  } else {
    for (let p = rightSiblingIndex + 1; p < totalPages; p++) pages.push(p);
  }

  pages.push(totalPages);

  return pages;
}
