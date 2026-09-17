"use client"

import Link from "next/link"
import { BookOpen, ChevronRight, FileText, FolderOpen } from "lucide-react"
import { DOC_CATEGORIES } from "../../../lib/docs/docs-categories"
import type { DocEntry } from "../../../lib/docs/docs-catalog"

/**
 * Lista dokumentów przeglądarki dokumentacji projektu w panelu B2B (decyzje Michała,
 * 2026-09-17), pogrupowana po kategoriach z `DOC_CATEGORIES` (etykiety biznesowe,
 * importowane z `docs-categories.ts` — czyste dane, bez `node:fs` — nie z `docs-catalog.ts`,
 * bo import tego drugiego z komponentu klienckiego wywala build Next).
 */
export type DocsListClientProps = {
  entries: readonly DocEntry[]
}

export function DocsListClient({ entries }: DocsListClientProps) {
  const categoriesWithEntries = DOC_CATEGORIES.map((category) => ({
    category,
    docs: entries.filter((entry) => entry.categoryId === category.id),
  }))

  const totalDocs = entries.length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <BookOpen className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Dokumentacja
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalDocs} {totalDocs === 1 ? "dokument" : "dokumentów"} w {categoriesWithEntries.length} kategoriach
          </p>
        </div>
      </div>

      {totalDocs === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <FolderOpen className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Brak dokumentów do wyświetlenia</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Katalog dokumentacji jest obecnie pusty.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoriesWithEntries.map(({ category, docs }) => (
            <section
              key={category.id}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/50 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {category.label}
                </h2>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                  {docs.length} {docs.length === 1 ? "dokument" : "dokumentów"}
                </span>
              </div>

              {docs.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Brak dokumentów w tej kategorii.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {docs.map((entry) => (
                    <li key={entry.slug}>
                      <Link
                        href={`/dokumentacja/${entry.slug}`}
                        className="flex items-center gap-3 p-4 text-sm transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 font-medium text-foreground">{entry.title}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
