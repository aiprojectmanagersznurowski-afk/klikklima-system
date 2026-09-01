"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"

export type CustomerSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  leadsCount: number;
  installationsCount: number;
}

export async function getCustomers(): Promise<CustomerSummary[]> {
  const customers = await prisma.klienci.findMany({
    include: {
      leady: {
        include: {
          instalacje: true
        }
      },
    },
    orderBy: {
      created_at: 'desc',
    }
  });

  return customers.map(c => {
    let installationsCount = 0;
    c.leady.forEach(lead => {
      installationsCount += lead.instalacje.length;
    });

    return {
      id: c.id,
      name: c.imie_i_nazwisko || "Nieznany",
      email: c.email,
      phone: c.telefon,
      createdAt: c.created_at,
      leadsCount: c.leady.length,
      installationsCount,
    }
  });
}

export async function deleteCustomerAction(id: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia klienta." };
  }
  if (!actorRole || can(actorRole, "clients", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia klienta." };
  }

  try {
    // UWAGA: Twarde usunięcie klienta (tylko admin)
    // W Prisma dzięki onDelete: Cascade (jeśli jest) powiązane encje by zniknęły.
    // Jeśli nie ma cascade, musimy zrobić to ręcznie.
    // Na razie polegamy na constraintach Prisma (np. setNull).
    await prisma.klienci.delete({
      where: { id }
    });

    revalidatePath('/customers');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return { success: false, error: "Nie udało się usunąć klienta." };
  }
}

export async function addCustomerAddress(klientId: string, ulicaMiasto: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do dodania adresu." };
  }
  if (!actorRole || can(actorRole, "clients", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do dodania adresu." };
  }

  try {
    await prisma.adresy.create({
      data: {
        klient_id: klientId,
        ulica_miasto: ulicaMiasto
      }
    });

    revalidatePath(`/customers/${klientId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to add customer address:", error);
    return { success: false, error: "Nie udało się dodać adresu." };
  }
}
