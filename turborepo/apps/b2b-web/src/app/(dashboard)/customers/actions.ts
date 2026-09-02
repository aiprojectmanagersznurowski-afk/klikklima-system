"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"
import { anonymizeClientSchema, ANONYMIZED_NAME_PLACEHOLDER } from "./anonymize-client-schema"

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

export async function anonymizeClientAction(
  id: string,
  input: { justification: string; legalBasis: string }
): Promise<{ success: boolean; error?: string }> {
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

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const actorEmail = data.user?.email;
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia klienta." };
  }

  const parsed = anonymizeClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.klienci.updateMany({
        where: { id, anonymized_at: null },
        data: {
          imie_i_nazwisko: ANONYMIZED_NAME_PLACEHOLDER,
          email: null,
          telefon: null,
          anonymized_at: new Date(),
        },
      });

      if (count === 0) {
        return;
      }

      await tx.adresy.updateMany({
        where: { klient_id: id },
        data: {
          ulica_miasto: 'Adres usunięty',
          latitude: null,
          longitude: null,
        },
      });

      await tx.auditLog.create({
        data: {
          operation: 'anonymize',
          resource: 'clients',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to anonymize customer:", error);
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
