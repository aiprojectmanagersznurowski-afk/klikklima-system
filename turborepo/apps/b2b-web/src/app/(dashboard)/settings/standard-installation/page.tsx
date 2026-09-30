import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { can } from "@klikklima/contracts";
import { getCurrentActorRole } from "../../../../utils/supabase/server";
import { StandardInstallationClient } from "./StandardInstallationClient";
import {
  STANDARD_INSTALLATION_CONFIG_TYPE,
  standardInstallationConfigSchema,
  type StandardInstallationConfig,
} from "../../../../lib/pricing/standard-installation-schema";

/**
 * WO: docs/workorders/STD-INSTALL-CONFIG.md
 * // @REQ: STD-INSTALL-CONFIG
 *
 * Ekran konfiguracji montażu standardowego (/settings/standard-installation).
 * Pozwala administratorowi definiować skład i ilości pozycji cennika wchodzących
 * w skład standardu z podziałem na "na każdą jednostkę wewnętrzną" oraz "na układ".
 *
 * Bramka RBAC: odczyt konfiguracji systemowej wymaga uprawnienia system_config read (rola admin).
 */
export default async function StandardInstallationSettingsScreen() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  if (
    !actorRole ||
    (can(actorRole, "system_config", "read") !== "yes" &&
      can(actorRole, "price_list_items", "read") !== "yes")
  ) {
    notFound();
    return;
  }

  const [priceItems, configRecord] = await Promise.all([
    prisma.priceListItem.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { isCurrent: true },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.system_config.findUnique({
      where: { typ_konfiguracji: STANDARD_INSTALLATION_CONFIG_TYPE },
    }),
  ]);

  const parsedConfig = standardInstallationConfigSchema.safeParse(
    configRecord?.konfiguracja
  );
  const initialConfig: StandardInstallationConfig | null = parsedConfig.success
    ? parsedConfig.data
    : null;

  return (
    <StandardInstallationClient
      availablePriceItems={priceItems}
      initialConfig={initialConfig}
      actorRole={actorRole}
    />
  );
}
