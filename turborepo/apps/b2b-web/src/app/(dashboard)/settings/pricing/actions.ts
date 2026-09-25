"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can, AUDIT_REQUIREMENTS } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../../utils/supabase/server"
import { importPriceList } from "../../../../lib/pricing/price-list"

/**
 * WO: docs/workorders/PRICE-LIST-IMPORT.md — PRICE-LIST-IMPORT AC-I6, D-P1 = (A).
 * Punkt wejścia importu: Server Action wywoływana przez zalogowanego administratora.
 * Bramka roli sprawdza się PRZED jakimkolwiek zapisem (zero wierszy dla odmowy) — fail
 * closed, brak sesji traktowany identycznie jak nieuprawniona rola.
 *
 * Ślad audytowy (WO): utworzenie pozycji w pustej bazie zostawia JEDEN wpis zbiorczy
 * (nie po jednym na pozycję), a każda zmiana ceny istniejącej pozycji (AC-I5) zostawia
 * własny wpis z `record_id` pozycji i uzasadnieniem "przed → po". Import bez utworzonych
 * pozycji i bez zmian cen nie tworzy żadnego wpisu (wzorzec `updateVisitDurationBasketAction`
 * — brak zmiany = brak wpisu).
 */

const OTHER_LEGAL_BASIS = AUDIT_REQUIREMENTS.legalBases.at(-1)!

// Górny limit (MINOR, audyt): 10 MB — pochłania z naddatkiem realny arkusz cennika (kilka
// tysięcy wierszy), a jednocześnie odrzuca ewidentnie nieprawidłowy/złośliwy upload przed
// jakimkolwiek parsowaniem CSV.
const importPriceListActionSchema = z
  .string()
  .min(1, "Plik CSV jest wymagany.")
  .max(10_000_000, "Plik CSV jest zbyt duży.")

export type ImportPriceListActionResult = { success: boolean; error?: string }

function formatMoney(value: number): string {
  return value.toFixed(2)
}

export async function importPriceListAction(csvContent: string): Promise<ImportPriceListActionResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do importu cennika." }
  }
  if (!actorRole || can(actorRole, "price_list_items", "create") !== "yes") {
    return { success: false, error: "Brak uprawnień do importu cennika." }
  }

  const parsed = importPriceListActionSchema.safeParse(csvContent)
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowy plik cennika." }
  }

  let actorEmail: string | undefined
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    actorEmail = user?.email
  } catch (error) {
    console.error("Failed to resolve actor email:", error)
    return { success: false, error: "Nie udało się zaimportować cennika." }
  }
  if (!actorEmail) {
    return { success: false, error: "Nie udało się zaimportować cennika." }
  }

  try {
    const report = await importPriceList(parsed.data)

    // Decyzja człowieka: każdy wpis audytowy dostaje WŁASNĄ `$transaction`, nie jedną
    // transakcję obejmującą całą pętlę zmian — błąd zapisu jednego wpisu nie może cofnąć
    // poprzednich, już potwierdzonych wpisów.
    if (report.createdItems > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            operation: "field_update",
            resource: "price_list_items",
            recordId: "bulk-import",
            actorEmail,
            actorRole,
            justification: `Import cennika utworzył ${report.createdItems} nowych pozycji (${report.createdVersions} wersji cen).`,
            legalBasis: OTHER_LEGAL_BASIS,
          },
        })
      })
    }

    for (const change of report.priceChanges) {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            operation: "field_update",
            resource: "price_list_items",
            recordId: change.itemId,
            actorEmail,
            actorRole,
            justification: `Import cennika zmienił cenę pozycji "${change.itemName}": sale_price_net ${formatMoney(
              change.before.salePriceNet
            )} → ${formatMoney(change.after.salePriceNet)}; crew_cost_net ${
              change.before.crewCostNet === null ? "(brak)" : formatMoney(change.before.crewCostNet)
            } → ${change.after.crewCostNet === null ? "(brak)" : formatMoney(change.after.crewCostNet)}.`,
            legalBasis: OTHER_LEGAL_BASIS,
          },
        })
      })
    }

    revalidatePath("/settings/pricing")
    return { success: true }
  } catch (error) {
    console.error("Failed to import price list:", error)
    return { success: false, error: "Nie udało się zaimportować cennika." }
  }
}
