import React from "react"
import { notFound } from "next/navigation"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsScreen() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
  }

  if (!actorRole || can(actorRole, 'authorized_users', 'read') !== 'yes') {
    notFound();
    return;
  }

  const users = await prisma.authorizedUser.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return <SettingsClient users={users} />;
}
