import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { DOC_CATEGORIES, type DocCategory } from "./docs-categories"

export type { DocCategory }
export { DOC_CATEGORIES }

/**
 * Przeglądarka dokumentacji projektu w panelu B2B (decyzje Michała, 2026-09-17),
 * widoczna wyłącznie dla roli `admin` (bramka w `dokumentacja/page.tsx` i
 * `dokumentacja/[slug]/page.tsx`, poza zakresem tego modułu).
 *
 * Moduł CZYSTY — bez `react`, bez `"use client"`/`"use server"` — czyta pliki `.md`
 * z `turborepo/docs/` (dwa poziomy nad `apps/b2b-web`) synchronicznie przez `node:fs`.
 * `findDocBySlug` NIGDY nie buduje ścieżki pliku ze surowego wejścia użytkownika —
 * jedyny sposób na znalezienie wpisu jest przeszukanie listy już skatalogowanej przez
 * `listDocs()` (obrona przed path traversal ze slug-a w URL).
 */

export type DocEntry = { categoryId: string; slug: string; title: string; fileName: string }

// `turborepo/docs/` — dwa poziomy nad `apps/b2b-web`, ten moduł żyje w
// `apps/b2b-web/src/lib/docs/`, więc pięć poziomów w górę od `__dirname`.
const DOCS_ROOT = path.resolve(__dirname, "../../../../../docs")

const SLUG_SEPARATOR = "__"

function categoryDirPath(category: DocCategory): string {
  return category.dir ? path.join(DOCS_ROOT, category.dir) : DOCS_ROOT
}

function titleFromContent(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+?)\s*$/m)
  return match ? match[1].trim() : fallback
}

function slugFor(categoryId: string, fileName: string): string {
  const base = fileName.replace(/\.md$/, "")
  return `${categoryId}${SLUG_SEPARATOR}${base}`
}

function buildEntry(category: DocCategory, dirPath: string, fileName: string): DocEntry {
  const filePath = path.join(dirPath, fileName)
  const content = readFileSync(filePath, "utf-8")
  const fallback = fileName.replace(/\.md$/, "")

  return {
    categoryId: category.id,
    slug: slugFor(category.id, fileName),
    title: titleFromContent(content, fallback),
    fileName,
  }
}

export function listDocs(): DocEntry[] {
  const entries: DocEntry[] = []

  for (const category of DOC_CATEGORIES) {
    const dirPath = categoryDirPath(category)
    const dirents = readdirSync(dirPath, { withFileTypes: true })

    for (const dirent of dirents) {
      if (!dirent.isFile()) continue
      if (!dirent.name.endsWith(".md")) continue

      entries.push(buildEntry(category, dirPath, dirent.name))
    }
  }

  return entries
}

/**
 * Rozwiązuje slug bez sklejania ścieżki z surowym wejściem: rozbija na `categoryId` +
 * nazwę bazową, odrzuca cokolwiek podejrzanego (separator ścieżki, `..`, bajt NUL) PRZED
 * jakimkolwiek dotknięciem `node:fs`, po czym weryfikuje istnienie pliku wyłącznie przez
 * `readdirSync` skatalogowanego katalogu — nigdy przez próbę odczytu skonstruowanej ścieżki
 * na oślep. `readFileSync` jest wywoływane wyłącznie dla pliku, który już potwierdzony jako
 * należący do listy zwróconej przez `readdirSync`.
 */
export function findDocBySlug(slug: string): DocEntry | null {
  if (!slug) return null

  const sepIndex = slug.indexOf(SLUG_SEPARATOR)
  if (sepIndex <= 0) return null

  const categoryId = slug.slice(0, sepIndex)
  const base = slug.slice(sepIndex + SLUG_SEPARATOR.length)
  if (!base) return null
  if (/[\\/]/.test(base) || base.includes("..") || base.includes("\0")) return null

  const category = DOC_CATEGORIES.find((candidate) => candidate.id === categoryId)
  if (!category) return null

  const fileName = `${base}.md`
  const dirPath = categoryDirPath(category)
  const dirents = readdirSync(dirPath, { withFileTypes: true })
  const dirent = dirents.find((candidate) => candidate.isFile() && candidate.name === fileName)
  if (!dirent) return null

  return buildEntry(category, dirPath, fileName)
}

export function readDocContent(entry: DocEntry): string {
  const category = DOC_CATEGORIES.find((candidate) => candidate.id === entry.categoryId)
  const dirPath = category ? categoryDirPath(category) : DOCS_ROOT
  const filePath = path.join(dirPath, entry.fileName)
  return readFileSync(filePath, "utf-8")
}
