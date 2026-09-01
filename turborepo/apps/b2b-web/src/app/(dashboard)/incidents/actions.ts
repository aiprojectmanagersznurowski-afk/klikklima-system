"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export type IncidentSummary = {
  id: string;
  numer_zgloszenia: string | null;
  klient_name: string;
  opis_usterki: string;
  priorytet: string;
  status: string;
  created_at: Date;
  zespol_name: string | null;
}

export async function getIncidents(): Promise<IncidentSummary[]> {
  const incidents = await prisma.usterki_incidents.findMany({
    include: {
      klient: true,
      zespol: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  return incidents.map(inc => ({
    id: inc.id,
    numer_zgloszenia: inc.numer_zgloszenia,
    klient_name: inc.klient?.imie_i_nazwisko || "Nieznany Klient",
    opis_usterki: inc.opis_usterki ?? "Brak opisu",
    priorytet: inc.priorytet ?? "NISKI",
    status: inc.status ?? "NOWE",
    created_at: inc.created_at,
    zespol_name: inc.zespol?.nazwa ?? null
  }));
}

export async function deleteIncidentAction(id: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }
  if (!actorRole || can(actorRole, "incidents", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }

  try {
    await prisma.usterki_incidents.delete({
      where: { id }
    });
    revalidatePath('/incidents');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete incident:", error);
    return { success: false, error: "Nie udało się usunąć usterki." };
  }
}
