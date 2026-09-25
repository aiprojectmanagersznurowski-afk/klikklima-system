"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/database";
import { can, AUDIT_REQUIREMENTS } from "@klikklima/contracts";
import { getCurrentActorRole, createClient } from "../../../../utils/supabase/server";
import { executeClientAnonymization } from "../../../../lib/rodo/anonymization";
import { generateCustomerRodoExport } from "../../../../lib/rodo/export";
import { getPrivacyDashboardMetrics } from "../../../../lib/rodo/retention";
import type { PrivacyMetrics, CustomerRodoExport } from "../../../../lib/rodo/types";

const anonymizeClientSchema = z.object({
  justification: z.string().trim().min(10, "Uzasadnienie musi mieć minimum 10 znaków."),
  legalBasis: z.string().refine(
    (val) => (AUDIT_REQUIREMENTS.legalBases as readonly string[]).includes(val),
    { message: "Nieprawidłowa podstawa prawna." }
  ),
});

export interface PrivacyAuditLogEntry {
  id: string;
  operation: string;
  resource: string;
  recordId: string;
  actorEmail: string;
  actorRole: string;
  justification: string;
  legalBasis: string;
  createdAt: Date;
}

export interface PrivacyDashboardData {
  success: boolean;
  error?: string;
  metrics?: PrivacyMetrics;
  recentAuditLogs?: PrivacyAuditLogEntry[];
}

export async function getPrivacyDashboardAction(): Promise<PrivacyDashboardData> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do przeglądania rejestru prywatności." };
  }

  if (!actorRole || can(actorRole, "audit_log", "read") !== "yes") {
    return { success: false, error: "Brak uprawnień do rejestru audytu prywatności." };
  }

  try {
    const metrics = await getPrivacyDashboardMetrics(prisma);
    const recentAuditLogs = await prisma.auditLog.findMany({
      where: {
        operation: "anonymize",
        resource: "clients",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
      select: {
        id: true,
        operation: true,
        resource: true,
        recordId: true,
        actorEmail: true,
        actorRole: true,
        justification: true,
        legalBasis: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      metrics,
      recentAuditLogs,
    };
  } catch (error) {
    console.error("Failed to get privacy dashboard data:", error);
    return { success: false, error: "Nie udało się pobrać danych prywatności i RODO." };
  }
}

export async function anonymizeClientPrivacyAction(
  clientId: string,
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
    return { success: false, error: parsed.error.issues[0]?.message || "Nieprawidłowe dane uzasadnienia." };
  }

  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await executeClientAnonymization(tx, {
        clientId,
        actorEmail,
        actorRole,
        justification,
        legalBasis,
      });
    });

    revalidatePath("/settings/privacy");
    revalidatePath("/customers");
    revalidatePath(`/customers/${clientId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to anonymize client from privacy settings:", error);
    return { success: false, error: "Nie udało się przeprowadzić anonimizacji klienta." };
  }
}

export async function exportClientRodoAction(
  clientId: string
): Promise<{ success: boolean; error?: string; data?: CustomerRodoExport }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do eksportu danych." };
  }

  if (!actorRole || can(actorRole, "clients", "read") !== "yes") {
    return { success: false, error: "Brak uprawnień do eksportu danych." };
  }

  try {
    const exportData = await generateCustomerRodoExport(clientId, prisma);
    if (!exportData) {
      return { success: false, error: "Klient nie został znaleziony." };
    }

    return { success: true, data: exportData };
  } catch (error) {
    console.error("Failed to export client RODO data:", error);
    return { success: false, error: "Nie udało się wygenerować eksportu danych klienta." };
  }
}

export interface ClientSearchResult {
  id: string;
  clientNumber: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  isAnonymized: boolean;
  createdAt: Date;
}

export async function searchClientsForPrivacyAction(
  query: string
): Promise<{ success: boolean; error?: string; clients: ClientSearchResult[] }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do wyszukiwania klientów.", clients: [] };
  }

  if (!actorRole || can(actorRole, "clients", "read") !== "yes") {
    return { success: false, error: "Brak uprawnień do wyszukiwania klientów.", clients: [] };
  }

  const trimmed = (query || "").trim();
  if (!trimmed) {
    return { success: true, clients: [] };
  }

  try {
    const clients = await prisma.klienci.findMany({
      where: {
        OR: [
          { imie_i_nazwisko: { contains: trimmed, mode: "insensitive" } },
          { email: { contains: trimmed, mode: "insensitive" } },
          { telefon: { contains: trimmed, mode: "insensitive" } },
          { client_number: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        client_number: true,
        imie_i_nazwisko: true,
        email: true,
        telefon: true,
        anonymized_at: true,
        created_at: true,
      },
      take: 10,
      orderBy: { created_at: "desc" },
    });

    return {
      success: true,
      clients: clients.map((c) => ({
        id: c.id,
        clientNumber: c.client_number,
        name: c.imie_i_nazwisko,
        email: c.email,
        phone: c.telefon,
        isAnonymized: c.anonymized_at !== null,
        createdAt: c.created_at,
      })),
    };
  } catch (error) {
    console.error("Failed to search clients for privacy:", error);
    return { success: false, error: "Błąd podczas wyszukiwania klientów.", clients: [] };
  }
}
