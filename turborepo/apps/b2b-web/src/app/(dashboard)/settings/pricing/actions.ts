"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can, AUDIT_REQUIREMENTS } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../../utils/supabase/server"
import { importPriceList } from "../../../../lib/pricing/price-list"
import {
  createPriceListItemSchema,
  updatePriceSchema,
  togglePriceListItemActiveSchema,
  type CreatePriceListItemInput,
  type UpdatePriceInput,
  type TogglePriceListItemActiveInput,
} from "../../../../lib/pricing/pricing-schema"

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md & PRICE-LIST-IMPORT.md.
 * Server Actions dla zarządzania pozycjami cennika, wersjami cen oraz importem.
 *
 * Wszystkie mutacje sprawdzają uprawnienia przez `can()` PRZED jakimkolwiek dotknięciem bazy.
 * Zmiana ceny NIGDY nie edytuje rekordów w miejscu — zdejmuje `is_current` i tworzy nową wersję.
 * Każda zmiana zostawia ślad w `audit_log` w tej samej transakcji.
 */

const OTHER_LEGAL_BASIS = AUDIT_REQUIREMENTS.legalBases.at(-1)!

const importPriceListActionSchema = z
  .string()
  .min(1, "Plik CSV jest wymagany.")
  .max(10_000_000, "Plik CSV jest zbyt duży.")

export type ImportPriceListActionResult = { success: boolean; error?: string }
export type PriceListMutationResult = { success: boolean; error?: string }

function formatMoney(value: number): string {
  return value.toFixed(2)
}

/**
 * Import cennika z CSV (WO-P1).
 */
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
    const report = await importPriceList(parsed.data, { actorEmail, actorRole })

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

/**
 * WO: PRICE-LIST-ADMIN AC6 — Dodanie nowej pozycji cennika przez administratora.
 */
export async function createPriceListItemAction(rawInput: unknown): Promise<PriceListMutationResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do zarządzania cennikiem." }
  }
  if (!actorRole || can(actorRole, "price_list_items", "create") !== "yes") {
    return { success: false, error: "Brak uprawnień do dodania pozycji cennika." }
  }

  const parsed = createPriceListItemSchema.safeParse(rawInput)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { success: false, error: issue?.message || "Nieprawidłowe dane pozycji cennika." }
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
    return { success: false, error: "Nie udało się ustalić tożsamości użytkownika." }
  }
  if (!actorEmail) {
    return { success: false, error: "Nie udało się ustalić tożsamości użytkownika." }
  }

  const input = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.priceListItem.create({
        data: {
          name: input.name,
          unit: input.unit,
          scope: input.scope,
          category: input.category ?? null,
          description: input.description ?? null,
          isActive: true,
        },
      })

      await tx.priceListItemVersion.create({
        data: {
          priceListItemId: item.id,
          salePriceNet: input.salePriceNet,
          crewCostNet: input.crewCostNet ?? null,
          isCurrent: true,
        },
      })

      const crewCostText = input.crewCostNet ? `${input.crewCostNet} zł` : "(brak)"
      await tx.auditLog.create({
        data: {
          operation: "field_update",
          resource: "price_list_items",
          recordId: item.id,
          actorEmail,
          actorRole,
          justification: `Dodanie nowej pozycji cennika "${item.name}": cena sprzedaży netto ${input.salePriceNet} zł; koszt ekipy netto ${crewCostText}.`,
          legalBasis: OTHER_LEGAL_BASIS,
        },
      })
    })

    revalidatePath("/settings/pricing")
    return { success: true }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    if (err?.code === "P2002") {
      return { success: false, error: "Pozycja o tej nazwie już istnieje." }
    }
    console.error("Failed to create price list item:", error)
    return { success: false, error: "Nie udało się zapisać pozycji cennika." }
  }
}

/**
 * WO: PRICE-LIST-ADMIN AC3, AC5 — Zmiana ceny pozycji przez administratora.
 */
export async function updatePriceAction(rawInput: unknown): Promise<PriceListMutationResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do zmiany ceny." }
  }
  if (!actorRole || can(actorRole, "price_list_items", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zmiany ceny." }
  }

  const parsed = updatePriceSchema.safeParse(rawInput)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { success: false, error: issue?.message || "Nieprawidłowe dane nowej ceny." }
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
    return { success: false, error: "Nie udało się ustalić tożsamości użytkownika." }
  }
  if (!actorEmail) {
    return { success: false, error: "Nie udało się ustalić tożsamości użytkownika." }
  }

  const input = parsed.data

  try {
    // 1. Sprawdź bieżącą wersję ceny
    const item = await prisma.priceListItem.findUnique({
      where: { id: input.itemId },
      include: {
        versions: {
          where: { isCurrent: true },
        },
      },
    })

    if (!item) {
      return { success: false, error: "Pozycja cennika nie istnieje." }
    }

    const currentVersion = item.versions[0]
    const newSalePrice = Number(input.salePriceNet)
    const newCrewCost = input.crewCostNet ? Number(input.crewCostNet) : null

    // 2. Jeśli cena jest identyczna, nie wykonujemy zapisu ani wpisu w audit_log (AC5)
    if (currentVersion) {
      const currentSalePrice = Number(currentVersion.salePriceNet)
      const currentCrewCost = currentVersion.crewCostNet !== null ? Number(currentVersion.crewCostNet) : null

      const isSameSalePrice = Math.abs(currentSalePrice - newSalePrice) < 0.001
      const isSameCrewCost =
        (currentCrewCost === null && newCrewCost === null) ||
        (currentCrewCost !== null && newCrewCost !== null && Math.abs(currentCrewCost - newCrewCost) < 0.001)

      if (isSameSalePrice && isSameCrewCost) {
        return { success: true }
      }
    }

    // 3. Zapis nowej wersji ceny i wpisu audytowego w jednej transakcji
    await prisma.$transaction(async (tx) => {
      // Zdejmij is_current z poprzedniej wersji
      await tx.priceListItemVersion.updateMany({
        where: { priceListItemId: input.itemId, isCurrent: true },
        data: { isCurrent: false },
      })

      // Utwórz nową wersję z isCurrent: true
      await tx.priceListItemVersion.create({
        data: {
          priceListItemId: input.itemId,
          salePriceNet: input.salePriceNet,
          crewCostNet: input.crewCostNet ?? null,
          isCurrent: true,
        },
      })

      // Szczegółowe uzasadnienie audytowe z wartościami przed i po
      const beforeSale = currentVersion ? formatMoney(Number(currentVersion.salePriceNet)) : "(brak)"
      const afterSale = formatMoney(newSalePrice)
      const beforeCrew = currentVersion && currentVersion.crewCostNet !== null ? formatMoney(Number(currentVersion.crewCostNet)) : "(brak)"
      const afterCrew = newCrewCost !== null ? formatMoney(newCrewCost) : "(brak)"

      await tx.auditLog.create({
        data: {
          operation: "field_update",
          resource: "price_list_items",
          recordId: input.itemId,
          actorEmail,
          actorRole,
          justification: `Zmiana ceny pozycji "${item.name}": cena sprzedaży netto: ${beforeSale} → ${afterSale}; koszt ekipy netto: ${beforeCrew} → ${afterCrew}.`,
          legalBasis: OTHER_LEGAL_BASIS,
        },
      })
    })

    revalidatePath("/settings/pricing")
    return { success: true }
  } catch (error) {
    console.error("Failed to update price:", error)
    return { success: false, error: "Nie udało się zapisać nowej wersji ceny." }
  }
}

/**
 * WO: PRICE-LIST-ADMIN AC2 — Przełączenie stanu aktywności pozycji (wycofanie / przywrócenie).
 */
export async function togglePriceListItemActiveAction(rawInput: unknown): Promise<PriceListMutationResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do zmiany statusu pozycji." }
  }
  if (!actorRole || can(actorRole, "price_list_items", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zmiany statusu pozycji." }
  }

  const parsed = togglePriceListItemActiveSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane." }
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
    return { success: false, error: "Nie udało się ustalić tożsamości użytkownika." }
  }
  if (!actorEmail) {
    return { success: false, error: "Nie udało się ustalić tożsamości użytkownika." }
  }

  const input = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.priceListItem.update({
        where: { id: input.itemId },
        data: { isActive: input.isActive },
      })

      await tx.auditLog.create({
        data: {
          operation: "field_update",
          resource: "price_list_items",
          recordId: input.itemId,
          actorEmail,
          actorRole,
          justification: input.isActive
            ? `Przywrócenie pozycji z cennika: "${updated.name}".`
            : `Wycofanie pozycji z cennika: "${updated.name}".`,
          legalBasis: OTHER_LEGAL_BASIS,
        },
      })
    })

    revalidatePath("/settings/pricing")
    return { success: true }
  } catch (error) {
    console.error("Failed to toggle item active status:", error)
    return { success: false, error: "Nie udało się zmienić statusu pozycji." }
  }
}
