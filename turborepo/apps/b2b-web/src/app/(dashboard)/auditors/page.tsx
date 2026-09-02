import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { getAuditors } from "./actions"
import { AuditorsClient } from "./auditors-client"
import { getCurrentActorRole } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function AuditorsPage() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  if (!actorRole || can(actorRole, "auditors", "read") !== "yes") {
    notFound();
    return;
  }

  const auditors = await getAuditors();
  return <AuditorsClient initialAuditors={auditors} actorRole={actorRole} />;
}
