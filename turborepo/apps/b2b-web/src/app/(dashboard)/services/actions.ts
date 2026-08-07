"use server"

import { prisma } from "@repo/database"

export type ServiceSummary = {
  id: string;
  next_service_date: Date;
  status: string;
  lead_id: string;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  installation_date: Date | null;
}

export async function getUpcomingServices(): Promise<ServiceSummary[]> {
  const installations = await prisma.instalacje.findMany({
    where: {
      next_service_date: {
        not: null
      }
    },
    include: {
      lead: {
        include: {
          klient: true,
          wyceny: {
            where: { is_final: true },
            take: 1
          }
        }
      }
    },
    orderBy: {
      next_service_date: 'asc'
    }
  });

  return installations.map(inst => ({
    id: inst.id,
    next_service_date: inst.next_service_date as Date,
    status: inst.status,
    lead_id: inst.lead_id,
    customer_name: inst.lead.klient ? `${inst.lead.klient.imie} ${inst.lead.klient.nazwisko}` : "Nieznany Klient",
    customer_phone: inst.lead.klient?.telefon ?? null,
    address: inst.lead.wyceny[0]?.ulica_miasto ?? "Brak adresu",
    installation_date: inst.data_zakonczenia
  }));
}
