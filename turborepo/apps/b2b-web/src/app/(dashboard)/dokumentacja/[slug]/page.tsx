import { notFound } from "next/navigation"
import { getCurrentActorRole } from "../../../../utils/supabase/server"
import { findDocBySlug, readDocContent } from "../../../../lib/docs/docs-catalog"
import { DocMarkdown } from "../doc-markdown"

/**
 * Widok jednego dokumentu (decyzje Michała, 2026-09-17), widoczny i dostępny WYŁĄCZNIE dla
 * roli `admin`. Bramka PRZED `await params` i przed `findDocBySlug`/`readDocContent` —
 * nieznany slug (w tym każda próba path traversal, odrzucona już w `findDocBySlug`) →
 * `notFound()`, nigdy 500.
 */
export default async function DocDetailScreen({ params }: { params: Promise<{ slug: string }> }) {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
  }

  if (actorRole !== "admin") {
    notFound()
    return
  }

  const { slug } = await params
  const entry = findDocBySlug(slug)
  if (!entry) {
    notFound()
    return
  }

  const content = readDocContent(entry)

  return <DocMarkdown content={content} />
}
