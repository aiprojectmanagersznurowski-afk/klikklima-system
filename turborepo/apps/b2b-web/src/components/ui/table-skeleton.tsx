import { Skeleton } from "@/components/ui/skeleton";

/**
 * Wspólne bloki szkieletu ładowania dla tras panelu B2B (`loading.tsx`).
 *
 * Cel (P2-4, docs/performance/AUDYT-B2B-2026-09-02.md): pokazać natychmiastową
 * reakcję interfejsu odwzorowującą rzeczywisty układ danego widoku, zamiast
 * generycznego spinnera na całym ekranie — i uniknąć skoku layoutu (CLS) przy
 * przejściu szkielet -> dane.
 *
 * Każdy `loading.tsx` trasy składa te bloki zamiast kopiować markup ośmiu razy.
 */

/**
 * Nagłówek strony: tytuł + podtytuł po lewej, opcjonalna zawartość po prawej
 * (przycisk akcji albo — jak w `/leads` — filtr i wyszukiwarka wpięte wprost
 * w pasek nagłówka zamiast osobnego `FilterBarSkeleton` poniżej).
 */
export function PageHeaderSkeleton({
  withAction = false,
  right,
}: {
  withAction?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center bg-card p-6 border-b border-border">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 sm:h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-72 sm:w-96" />
      </div>
      {right}
      {!right && withAction && <Skeleton className="h-9 w-40 rounded-md" />}
    </div>
  );
}

/** Rząd kafelków statystyk/kubełków (np. KPI logistyki). */
export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="size-5 rounded-md" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Pasek filtrów/wyszukiwarki nad tabelą lub siatką kart. */
export function FilterBarSkeleton({ withSelect = false }: { withSelect?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {withSelect && <Skeleton className="h-9 w-48 rounded-md" />}
        <Skeleton className="h-9 w-full sm:w-80 rounded-md" />
      </div>
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

/**
 * Szkielet tabeli danych: nagłówek zgodny z `text-xs uppercase ... bg-secondary/50 p-3`
 * (§6 wytycznych UI/UX) plus zadana liczba wierszy i kolumn.
 */
export function TableSkeleton({
  columns,
  rows = 8,
  /** Pomija zewnętrzny panel `rounded-2xl border` — dla tras (np. `/leads`),
   * gdzie tabela wypełnia całą dostępną wysokość bez dodatkowej karty wokół. */
  flat = false,
}: {
  columns: number;
  rows?: number;
  flat?: boolean;
}) {
  const table = (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="bg-secondary/50 border-b border-border">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="text-xs uppercase font-semibold text-muted-foreground tracking-wider p-3 px-6">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-6 py-4">
                  <Skeleton className="h-4 w-full max-w-32" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (flat) {
    return (
      <div className="flex-1 overflow-auto bg-card">
        {table}
      </div>
    );
  }

  return (
    <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col">
      {table}
    </div>
  );
}

/** Szkielet siatki kart (np. audytorzy, ekipy, zgłoszenia) — te same breakpointy co realne widoki. */
export function CardGridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="p-5 flex-1 flex flex-col gap-3">
            <div className="flex justify-between items-start mb-1">
              <Skeleton className="size-10 rounded-lg" />
              <Skeleton className="size-8 rounded-md" />
            </div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
            <div className="mt-3 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="bg-secondary/50 border-t border-border px-5 py-3">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
