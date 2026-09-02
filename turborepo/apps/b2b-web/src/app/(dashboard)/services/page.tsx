import { notFound } from "next/navigation"
import { can } from "@klikklima/contracts"
import { getUpcomingServices } from "./actions"
import { ServicesClient } from "./services-client"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function ServicesPage() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
  }

  const access = actorRole ? can(actorRole, "services", "read") : "no";
  if (access === "no") {
    notFound();
    return;
  }

  const services = await getUpcomingServices();
  return <ServicesClient initialServices={services} />;
}
