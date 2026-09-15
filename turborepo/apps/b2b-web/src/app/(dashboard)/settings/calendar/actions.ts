"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, getCurrentUser } from "../../../../utils/supabase/server"
import {
  updateVisitDurationBasketSchema,
  updateTravelBufferSchema,
} from "../../../../lib/schedule/scheduling-config-schema"

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md.
 * Wzorzec justification identyczny (nie "podobny") z
 * `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` (`formatFieldChange`).
 */
function formatFieldChange(label: string, before: unknown, after: unknown): string {
  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "(brak)" : String(v))
  return `${label}: ${fmt(before)} → ${fmt(after)}`
}

const POOL_LABELS: Record<string, string> = {
  AUDITOR: "Audytor",
  CREW: "Ekipa",
}

/**
 * P-6 (ROZSTRZYGNIĘTE 2026-09-15, WO): sentinel odróżniający odmowę "ostatni aktywny koszyk
 * w puli" od innych błędów transakcji — złapany wyłącznie w zewnętrznym catch tej akcji,
 * nigdy nie ucieka poza nią. Wzorzec identyczny jak `LastAdminError`
 * (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts`).
 */
class LastActiveBasketError extends Error {
  pool: string
  constructor(pool: string) {
    super("last-active-basket")
    this.pool = pool
  }
}

export type UpdateVisitDurationBasketInput = {
  durationMinutes?: number
  isActive?: boolean
}

export type UpdateVisitDurationBasketResult = { success: boolean; error?: string }

/**
 * CAL-VISIT-DURATION-BASKETS: edycja `durationMinutes`/`isActive` istniejącego koszyka.
 * Lista pól zapisywanych jest ZAMKNIĘTA (walidacja Zod) — `pool`, `code`, `id`, `labelPl`,
 * `sortOrder` przemycone w tym samym żądaniu są ignorowane. Wyłączenie ostatniego aktywnego
 * koszyka w puli (`pool` odczytany z bazy WEWNĄTRZ transakcji) jest odrzucane. Wpis
 * `audit_log` powstaje w TEJ SAMEJ transakcji co zapis, tylko gdy wartość faktycznie się
 * zmienia. Akcja nie dotyka `bookings` ani jednym zapytaniem (AC3).
 */
export async function updateVisitDurationBasketAction(
  id: string,
  input: UpdateVisitDurationBasketInput
): Promise<UpdateVisitDurationBasketResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do edycji koszyka." }
  }
  if (!actorRole || can(actorRole, "visit_duration_baskets", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do edycji koszyka." }
  }

  const parsed = updateVisitDurationBasketSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane koszyka." }
  }
  const values = parsed.data

  let actorEmail: string | undefined
  try {
    const {
      data: { user },
    } = await getCurrentUser()
    actorEmail = user?.email
  } catch (error) {
    console.error("Failed to resolve actor email:", error)
    return { success: false, error: "Nie udało się zapisać zmian koszyka." }
  }
  if (!actorEmail) {
    return { success: false, error: "Nie udało się zapisać zmian koszyka." }
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.visitDurationBasket.findUnique({ where: { id } })
        if (!existing) {
          return { success: false, error: "Koszyk nie został znaleziony." }
        }

        // P-6: liczenie i zapis MUSZĄ być w jednej transakcji — inaczej dwóch administratorów
        // wyłączających równolegle dwa ostatnie koszyki obejdzie blokadę (przypadek brzegowy 8).
        if (values.isActive === false && existing.isActive !== false) {
          const activeCount = await tx.visitDurationBasket.count({
            where: { pool: existing.pool, isActive: true },
          })
          if (activeCount <= 1) {
            throw new LastActiveBasketError(existing.pool)
          }
        }

        const data: { durationMinutes?: number; isActive?: boolean } = {}
        const justificationParts: string[] = []

        if (values.durationMinutes !== undefined && values.durationMinutes !== existing.durationMinutes) {
          data.durationMinutes = values.durationMinutes
          justificationParts.push(
            formatFieldChange(`Zmiana czasu trwania wizyty (${existing.code})`, existing.durationMinutes, values.durationMinutes)
          )
        }

        if (values.isActive !== undefined && values.isActive !== existing.isActive) {
          data.isActive = values.isActive
          justificationParts.push(formatFieldChange("Zmiana aktywności koszyka", existing.isActive, values.isActive))
        }

        // Brak zmiany = brak wpisu. Zapis tej samej wartości drugi raz nie tworzy drugiego
        // wpisu i NIE wywołuje update() (wzorzec `buildBaseLocationJustification` -> null).
        if (justificationParts.length === 0) {
          return { success: true }
        }

        await tx.visitDurationBasket.update({ where: { id }, data })
        await tx.auditLog.create({
          data: {
            operation: "field_update",
            resource: "visit_duration_baskets",
            recordId: id,
            actorEmail,
            actorRole,
            justification: justificationParts.join("; "),
            legalBasis: "OTHER",
          },
        })

        return { success: true }
      },
      { isolationLevel: "Serializable" }
    )

    if (result.success) {
      revalidatePath("/settings/calendar")
    }
    return result
  } catch (error) {
    if (error instanceof LastActiveBasketError) {
      const label = POOL_LABELS[error.pool] ?? error.pool
      return {
        success: false,
        error: `Nie można wyłączyć ostatniego aktywnego koszyka w puli ${label} — kalendarz przestałby proponować jakiekolwiek terminy.`,
      }
    }
    console.error("Failed to update visit duration basket:", error)
    return { success: false, error: "Nie udało się zapisać zmian koszyka." }
  }
}

export type UpdateTravelBufferInput = { travelBufferMinutes: number }
export type UpdateTravelBufferResult = { success: boolean; error?: string }

const SCHEDULING_CONFIG_TYPE = "scheduling_config"

/**
 * CAL-TRAVEL-BUFFER: edycja `travel_buffer_minutes` w `system_config` (wiersz
 * `typ_konfiguracji = 'scheduling_config'`). R-6/D-1 (WO, "NAJWAŻNIEJSZE OGRANICZENIE"):
 * zapis SCALA (merge) tylko klucz `travel_buffer_minutes` — `default_workday_*` i
 * `default_weekdays`, czytane przez `packages/scheduling/src/effective-availability.ts`,
 * pozostają nietknięte. Stara wartość jest czytana z bazy WEWNĄTRZ tej samej transakcji
 * co zapis, nigdy z formularza. Akcja nie dotyka `bookings` ani jednym zapytaniem (AC5).
 */
export async function updateTravelBufferAction(
  input: UpdateTravelBufferInput
): Promise<UpdateTravelBufferResult> {
  let actorRole
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
    return { success: false, error: "Brak uprawnień do edycji bufora dojazdu." }
  }
  if (!actorRole || can(actorRole, "system_config", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do edycji bufora dojazdu." }
  }

  const parsed = updateTravelBufferSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowa wartość bufora dojazdu." }
  }
  const { travelBufferMinutes } = parsed.data

  let actorEmail: string | undefined
  try {
    const {
      data: { user },
    } = await getCurrentUser()
    actorEmail = user?.email
  } catch (error) {
    console.error("Failed to resolve actor email:", error)
    return { success: false, error: "Nie udało się zapisać bufora dojazdu." }
  }
  if (!actorEmail) {
    return { success: false, error: "Nie udało się zapisać bufora dojazdu." }
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.system_config.findUnique({
          where: { typ_konfiguracji: SCHEDULING_CONFIG_TYPE },
        })
        if (!existing) {
          return { success: false, error: "Konfiguracja harmonogramu nie została znaleziona." }
        }

        const currentConfig = (existing.konfiguracja ?? {}) as Record<string, unknown>
        const previousValue = currentConfig.travel_buffer_minutes

        // Brak zmiany = brak wpisu, ale zapis pozostaje sukcesem (no-op, wzorzec
        // `updateAuthorizedUserRoleAction`).
        if (previousValue === travelBufferMinutes) {
          return { success: true }
        }

        // Merge, NIE podmiana całego obiektu (R-6/D-1): default_workday_*/default_weekdays
        // muszą przetrwać zapis nietknięte.
        const nextConfig = { ...currentConfig, travel_buffer_minutes: travelBufferMinutes }

        await tx.system_config.update({
          where: { typ_konfiguracji: SCHEDULING_CONFIG_TYPE },
          data: { konfiguracja: nextConfig },
        })

        await tx.auditLog.create({
          data: {
            operation: "field_update",
            resource: "system_config",
            recordId: existing.id,
            actorEmail,
            actorRole,
            justification: formatFieldChange("Zmiana bufora dojazdu", previousValue, travelBufferMinutes),
            legalBasis: "OTHER",
          },
        })

        return { success: true }
      },
      { isolationLevel: "Serializable" }
    )

    if (result.success) {
      revalidatePath("/settings/calendar")
    }
    return result
  } catch (error) {
    console.error("Failed to update travel buffer:", error)
    return { success: false, error: "Nie udało się zapisać bufora dojazdu." }
  }
}
