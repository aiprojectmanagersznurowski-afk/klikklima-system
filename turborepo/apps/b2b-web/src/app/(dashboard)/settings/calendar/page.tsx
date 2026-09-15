import React from "react"
import { notFound } from "next/navigation"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../../utils/supabase/server"
import { CalendarSettingsClient } from "./CalendarSettingsClient"

const SCHEDULING_CONFIG_TYPE = "scheduling_config"

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md.
 * Bramka RBAC PRZED jakimkolwiek zapytaniem Prismy (wzorzec `settings/page.tsx`).
 * `read` na `visit_duration_baskets` jest przyznane wszystkim czterem rolom w kontrakcie —
 * bramką wiążącą EDYCJI jest Server Action, nie ta strona (WO, "Kształt ekranu").
 */
export default async function CalendarSettingsScreen() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
  }

  if (!actorRole || can(actorRole, "visit_duration_baskets", "read") !== "yes") {
    notFound();
    return;
  }

  const [baskets, schedulingConfig] = await Promise.all([
    prisma.visitDurationBasket.findMany({
      orderBy: [{ pool: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.system_config.findUnique({ where: { typ_konfiguracji: SCHEDULING_CONFIG_TYPE } }),
  ]);

  const konfiguracja =
    schedulingConfig && typeof schedulingConfig.konfiguracja === "object" && schedulingConfig.konfiguracja !== null
      ? (schedulingConfig.konfiguracja as Record<string, unknown>)
      : null;
  const travelBufferMinutes =
    konfiguracja && typeof konfiguracja.travel_buffer_minutes === "number" ? konfiguracja.travel_buffer_minutes : null;

  return <CalendarSettingsClient baskets={baskets} travelBufferMinutes={travelBufferMinutes} actorRole={actorRole} />;
}
