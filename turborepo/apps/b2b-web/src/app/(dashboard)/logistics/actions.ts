"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { differenceInDays, startOfDay } from "date-fns"
import { LeadStatus } from "@repo/database"

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

export async function getLogisticsLeads(): Promise<LogisticsLead[]> {
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

    const triage = (lead.odpowiedzi_triage as any) || {}
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

export async function shipLogisticsOrder(leadId: string, trackingNumber?: string) {
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
}

export async function bypassLogisticsOrder(leadId: string) {
  // Przejście z Magazynu -> Oczekuje instalacji (z pominięciem kuriera)
  await prisma.leady.update({
    where: { id: leadId },
    data: {
      status: LeadStatus.AWAITING_INSTALLATION,
    },
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
}

export async function markAsDelivered(leadId: string) {
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
}

export async function rollbackLogisticsOrder(leadId: string, reason?: string) {
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
}
