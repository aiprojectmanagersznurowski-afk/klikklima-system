import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { getIncidents } from "./actions"
import { IncidentsClient } from "./incidents-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function IncidentsPage() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  const access = actorRole ? can(actorRole, "incidents", "read") : "no";
  if (access === "no") {
    notFound();
    return;
  }

  const incidents = await getIncidents();
  return <IncidentsClient initialIncidents={incidents} />;
}
