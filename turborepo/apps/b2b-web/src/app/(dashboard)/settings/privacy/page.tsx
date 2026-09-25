import React from "react";
import { notFound } from "next/navigation";
import { can } from "@klikklima/contracts";
import { getCurrentActorRole } from "../../../../utils/supabase/server";
import { getPrivacyDashboardMetrics } from "../../../../lib/rodo/retention";
import { prisma } from "@repo/database";
import { PrivacyClient } from "./PrivacyClient";

export default async function PrivacySettingsPage() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  if (!actorRole || can(actorRole, "audit_log", "read") !== "yes") {
    notFound();
    return;
  }

  const [metrics, recentAuditLogs] = await Promise.all([
    getPrivacyDashboardMetrics(prisma),
    prisma.auditLog.findMany({
      where: {
        operation: "anonymize",
        resource: "clients",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
      select: {
        id: true,
        operation: true,
        resource: true,
        recordId: true,
        actorEmail: true,
        actorRole: true,
        justification: true,
        legalBasis: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <PrivacyClient
      metrics={metrics}
      recentAuditLogs={recentAuditLogs}
      actorRole={actorRole}
    />
  );
}
