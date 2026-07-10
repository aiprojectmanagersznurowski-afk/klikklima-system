import React from "react"
import { prisma } from "@repo/database"
import { SettingsClient } from "./SettingsClient"

export default async function SettingsScreen() {
  const users = await prisma.authorizedUser.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return <SettingsClient users={users} />;
}
