import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@repo/database";
import { can } from "@klikklima/contracts";
import { getCurrentActorRole } from "../../../../utils/supabase/server";
import { PricingSettingsClient } from "./PricingSettingsClient";

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md — AC1.
 * // @REQ: PRICE-LIST-ADMIN
 *
 * Server Component ekranu cennika wyceny.
 * Bramka RBAC sprawdza can(actorRole, 'price_list_items', 'read') PRZED jakimkolwiek
 * zapytaniem Prismy (wymóg kk-authz-gate). Dla ról bez uprawnień zwraca notFound().
 */
export default async function PricingSettingsScreen() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  if (!actorRole || can(actorRole, "price_list_items", "read") !== "yes") {
    notFound();
    return;
  }

  const items = await prisma.priceListItem.findMany({
    include: {
      versions: {
        where: { isCurrent: true },
      },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return <PricingSettingsClient items={items} actorRole={actorRole} />;
}
