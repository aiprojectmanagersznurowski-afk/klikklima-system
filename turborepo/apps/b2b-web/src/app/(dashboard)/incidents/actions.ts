"use server"

import { prisma } from "@repo/database"

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
