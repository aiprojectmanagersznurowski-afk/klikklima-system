"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/database";
import { can } from "@klikklima/contracts";
import { getCurrentActorRole, getCurrentUser } from "../../../../utils/supabase/server";
import {
  updateStandardInstallationConfigSchema,
  STANDARD_INSTALLATION_CONFIG_TYPE,
  type UpdateStandardInstallationConfigInput,
  type StandardInstallationConfig,
} from "../../../../lib/pricing/standard-installation-schema";

export type UpdateStandardInstallationConfigResult = {
  success: boolean;
  error?: string;
};

/**
 * WO: docs/workorders/STD-INSTALL-CONFIG.md
 * // @REQ: STD-INSTALL-CONFIG
 *
 * Aktualizuje konfigurację montażu standardowego w tabeli `system_config`.
 * Wymaga uprawnienia `system_config` update (wyłącznie rola admin).
 * Tworzy wpis w `audit_log` w TEJ SAMEJ transakcji co zapis (zasada audit trail).
 */
export async function updateStandardInstallationConfigAction(
  input: UpdateStandardInstallationConfigInput
): Promise<UpdateStandardInstallationConfigResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do edycji konfiguracji montażu standardowego." };
  }

  if (!actorRole || can(actorRole, "system_config", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do edycji konfiguracji montażu standardowego." };
  }

  const parsed = updateStandardInstallationConfigSchema.safeParse(input);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return { success: false, error: `Nieprawidłowe dane konfiguracji: ${errorMsg}` };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Nie udało się zapisać konfiguracji montażu standardowego." };
  }

  if (!actorEmail) {
    return { success: false, error: "Nie udało się zidentyfikować autora zmiany." };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Weryfikacja czy podane priceListItemId istnieją w bazie
        const itemIds = parsed.data.items.map((i) => i.priceListItemId);
        const existingItems = await tx.priceListItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true },
        });

        if (existingItems.length !== itemIds.length) {
          const foundIds = new Set(existingItems.map((e) => e.id));
          const missingIds = itemIds.filter((id) => !foundIds.has(id));
          return {
            success: false,
            error: `Część pozycji z cennika nie istnieje w bazie: ${missingIds.join(", ")}`,
          };
        }

        const nextConfig: StandardInstallationConfig = {
          items: parsed.data.items,
          updatedAt: new Date().toISOString(),
          ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
        };

        const existingRecord = await tx.system_config.findUnique({
          where: { typ_konfiguracji: STANDARD_INSTALLATION_CONFIG_TYPE },
        });

        const savedRecord = await tx.system_config.upsert({
          where: { typ_konfiguracji: STANDARD_INSTALLATION_CONFIG_TYPE },
          update: { konfiguracja: nextConfig },
          create: {
            typ_konfiguracji: STANDARD_INSTALLATION_CONFIG_TYPE,
            konfiguracja: nextConfig,
          },
        });

        const perIndoorCount = parsed.data.items.filter((i) => i.multiplier === "PER_INDOOR_UNIT").length;
        const perInstallationCount = parsed.data.items.filter((i) => i.multiplier === "PER_INSTALLATION").length;

        await tx.auditLog.create({
          data: {
            operation: "field_update",
            resource: "system_config",
            recordId: savedRecord.id,
            actorEmail,
            actorRole,
            justification: `Konfiguracja montażu standardowego: ${parsed.data.items.length} pozycji (${perIndoorCount} na jednostkę wewn., ${perInstallationCount} na układ)`,
            legalBasis: "OTHER",
          },
        });

        return { success: true };
      },
      { isolationLevel: "Serializable" }
    );

    if (result.success) {
      revalidatePath("/settings/standard-installation");
      revalidatePath("/settings/pricing");
    }
    return result;
  } catch (error) {
    console.error("Failed to update standard installation config:", error);
    return { success: false, error: "Nie udało się zapisać konfiguracji montażu standardowego." };
  }
}
