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

/**
 * P1-3 (audyt wydajności 2026-09-02): zagnieżdżony `include: { leady: { include: {
 * instalacje: true } } }` rozbijał się na ~8 roundtripów (1275 ms na pustej tabeli),
 * żeby policzyć wyłącznie dwie liczby. `_count` liczony po stronie bazy zamiast
 * pełnego `include` + `.length` w JS, paginacja wzorem `getLeads()` (`leads/actions.ts`)
 * dla spójności wzorca.
 */
export async function getCustomers(
  options?: { page?: number; limit?: number }
): Promise<{ customers: CustomerSummary[]; totalPages: number }> {
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;

  const [customers, totalCount] = await Promise.all([
    prisma.klienci.findMany({
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        imie_i_nazwisko: true,
        email: true,
        telefon: true,
        created_at: true,
        _count: { select: { leady: true } },
        leady: {
          select: {
            _count: { select: { instalacje: true } },
          },
        },
      },
    }),
    prisma.klienci.count(),
  ]);

  return {
    customers: customers.map(c => {
      const installationsCount = c.leady.reduce(
        (sum, lead) => sum + lead._count.instalacje,
        0
      );

      return {
        id: c.id,
        name: c.imie_i_nazwisko || "Nieznany",
        email: c.email,
        phone: c.telefon,
        createdAt: c.created_at,
        leadsCount: c._count.leady,
        installationsCount,
      }
    }),
    totalPages: Math.ceil(totalCount / limit),
  };
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
