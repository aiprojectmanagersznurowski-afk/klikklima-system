"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { differenceInDays, startOfDay } from "date-fns"
import { LeadStatus } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"
import { deleteLeadAction } from "../leads/actions"
import type { TriageAnswers } from "@/lib/triage-answers"

export type LogisticsLead = {
  id: string
  leadId: string
  clientName: string
  address: string
  deviceModel: string
  installationDate: string | null
  daysToInstall: number | null
  status: LeadStatus
  trackingNumber: string | null
}

/**
 * SEC-RLS-AUDITOR-SCOPE (D4): /logistics jest zamknięte dla audytora i montera
 * całkowicie — w przeciwieństwie do getLeads() nie ma tu zakresu `:own`, więc
 * jedyne dozwolone role to admin/dyspozytor (`can(role, 'leads', 'read') === 'yes'`).
 * Fail-closed: brak roli albo rzucony wyjątek → odmowa, `prisma.leady.findMany`
 * nie jest wołane wcale.
 */
export async function getLogisticsLeads(): Promise<LogisticsLead[] | { success: false; error: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "read") !== "yes") {
    return { success: false, error: "Brak uprawnień do przeglądania listy logistyki." };
  }

  const leads = await prisma.leady.findMany({
    where: {
      status: {
        in: [
          LeadStatus.HARDWARE_IN_WAREHOUSE,
          LeadStatus.HARDWARE_IN_TRANSIT,
          LeadStatus.ROLLBACK_RESCHEDULING,
        ],
      },
    },
    include: {
      klient: true,
      adres: true,
      logistyka_zamowienia: {
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      data_rezerwacji: 'asc',
    },
  })

  return leads.map((lead) => {
    let daysToInstall = null;
    let installationDateStr = null;

    if (lead.data_rezerwacji) {
      const today = startOfDay(new Date());
      const installDay = startOfDay(new Date(lead.data_rezerwacji));
      daysToInstall = differenceInDays(installDay, today);
      installationDateStr = lead.data_rezerwacji.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    const triage: TriageAnswers = (lead.odpowiedzi_triage as TriageAnswers | null) || {}
    let deviceModel = "Brak modelu"
    
    if (triage.selectedExternalUnit) {
       deviceModel = `${triage.selectedExternalUnit.brand} ${triage.selectedExternalUnit.model_code}`
    } else if (triage.selectedDeviceLine) {
       deviceModel = triage.selectedDeviceLine
    }

    const trackingNumber = lead.logistyka_zamowienia?.[0]?.tracking_id || null

    return {
      id: `LOG-${lead.id.substring(0, 8)}`,
      leadId: lead.id,
      clientName: lead.klient?.imie_i_nazwisko || "Nieznany",
      address: lead.adres?.ulica_miasto || "Brak adresu",
      deviceModel,
      installationDate: installationDateStr,
      daysToInstall,
      status: lead.status as LeadStatus,
      trackingNumber,
    }
  })
}

export async function shipLogisticsOrder(leadId: string, trackingNumber?: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes" || can(actorRole, "shipments", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do wysyłki zamówienia." };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Zmiana statusu na IN_TRANSIT
    await tx.leady.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.HARDWARE_IN_TRANSIT,
      },
    });

    // 2. Dodanie rekordu logistyki, jeśli podano tracking
    if (trackingNumber) {
      await tx.logistyka_zamowienia.create({
        data: {
          lead_id: leadId,
          status_wysylki: "SHIPPED",
          tracking_id: trackingNumber,
          data_wysylki: new Date(),
        },
      });
    }
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function bypassLogisticsOrder(leadId: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes" || can(actorRole, "shipments", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zmiany statusu zamówienia." };
  }

  // Przejście z Magazynu -> Oczekuje instalacji (z pominięciem kuriera)
  await prisma.leady.update({
    where: { id: leadId },
    data: {
      status: LeadStatus.AWAITING_INSTALLATION,
    },
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function markAsDelivered(leadId: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do oznaczenia dostawy." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leady.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.AWAITING_INSTALLATION,
      },
    });

    // Aktualizujemy status_wysylki w ostatnim zleceniu
    const lastOrder = await tx.logistyka_zamowienia.findFirst({
      where: { lead_id: leadId },
      orderBy: { created_at: 'desc' },
    });

    if (lastOrder) {
      await tx.logistyka_zamowienia.update({
        where: { id: lastOrder.id },
        data: { status_wysylki: "DELIVERED" },
      });
    }
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function rollbackLogisticsOrder(leadId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes" || can(actorRole, "shipments", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do rollbacku zamówienia." };
  }

  await prisma.leady.update({
    where: { id: leadId },
    data: {
      status: LeadStatus.ROLLBACK_RESCHEDULING,
      bucket_entered_at: new Date(),
      notatki_wewnetrzne: reason ? `Rollback z logistyki: ${reason}` : undefined,
    },
  });

  // Zwalnianie zasobów - w przyszłości odpinanie ekipy / terminu

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function deleteLogisticsOrderAction(id: string): Promise<{ success: boolean; error?: string }> {
  const result = await deleteLeadAction(id);
  revalidatePath('/logistics');
  return result;
}
