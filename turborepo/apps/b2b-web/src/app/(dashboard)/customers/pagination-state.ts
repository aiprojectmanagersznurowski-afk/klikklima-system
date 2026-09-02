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
