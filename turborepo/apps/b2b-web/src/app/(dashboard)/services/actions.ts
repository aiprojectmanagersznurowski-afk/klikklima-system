"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"

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
          adres: true
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
    customer_name: inst.lead.klient?.imie_i_nazwisko || "Nieznany Klient",
    customer_phone: inst.lead.klient?.telefon ?? null,
    address: inst.lead.adres?.ulica_miasto ?? "Brak adresu",
    installation_date: inst.data_zakonczenia
  }));
}

export async function deleteServiceAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actorRole = await getCurrentActorRole();
    if (!actorRole || can(actorRole, "services", "delete") !== "yes") {
      return { success: false, error: "Brak uprawnień do usunięcia serwisu." };
    }

    await prisma.serwisy.delete({
      where: { id }
    });
    revalidatePath('/services');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { success: false, error: "Nie udało się usunąć serwisu." };
  }
}
