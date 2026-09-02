import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { getInstallations } from "./actions"
import { InstallationsClient } from "./installations-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function InstallationsPage() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  const access = actorRole ? can(actorRole, "installations", "read") : "no";
  if (access === "no") {
    notFound();
    return;
  }

  const installations = await getInstallations();

  return <InstallationsClient initialInstallations={installations} />;
}
