import { notFound } from "next/navigation"
import { getCurrentActorRole } from "../../../utils/supabase/server"
import { listDocs } from "../../../lib/docs/docs-catalog"
import { DocsListClient } from "./docs-list-client"

export const dynamic = "force-dynamic"

/**
 * Przeglądarka dokumentacji projektu w panelu B2B (decyzje Michała, 2026-09-17), widoczna
 * i dostępna WYŁĄCZNIE dla roli `admin`. "Dokumentacja" nie jest zasobem w
 * `RESOURCES` (contracts/rbac.contract.mjs) — bramka jest prostym porównaniem roli,
 * bez `can()`, wzorem `../lib/docs/nav-visibility.ts`. `notFound()` wywołane PRZED
 * jakimkolwiek odczytem z dysku (`listDocs()`).
 */
export default async function DocsListScreen() {
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

  let entries: ReturnType<typeof listDocs> = []
  try {
    entries = listDocs()
  } catch (error) {
    console.error("Failed to load docs list:", error)
  }

  return <DocsListClient entries={entries} />
}
