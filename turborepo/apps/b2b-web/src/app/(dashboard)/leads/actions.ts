"use server";

import { prisma, LeadStatus } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function getAuditors() {
  try {
    return await prisma.audytorzy.findMany({
      orderBy: { imie_i_nazwisko: "asc" }
    });
  } catch (error) {
    console.error("Failed to fetch auditors:", error);
    return [];
  }
}

export async function getLeads() {
  try {
    const leads = await prisma.leady.findMany({
      orderBy: { created_at: "desc" },
      include: {
        klient: true,
        adres: true,
        instalacje: {
          include: {
            zespol: true
          }
        },
        audytor: true
      }
    });
    return leads;
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return [];
  }
}

export async function updateLeadStatus(leadId: string, newStatus: LeadStatus) {
  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      select: { audytor_id: true }
    });

    if (newStatus !== "NEW_LEAD" && !lead?.audytor_id) {
      return { success: false, error: "Nie można przenieść leada bez przypisanego audytora. Najpierw przypisz audytora." };
    }

    if (newStatus === "NEW_LEAD" && lead?.audytor_id) {
      // Jeśli status to NEW_LEAD, odepnij audytora, żeby zachować spójność z regułą (opcjonalne, ale użyteczne)
      await prisma.leady.update({
        where: { id: leadId },
        data: { status: newStatus, audytor_id: null },
      });
    } else {
      await prisma.leady.update({
        where: { id: leadId },
        data: { status: newStatus },
      });
    }
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead status:", error);
    return { success: false, error: "Nie udało się zaktualizować statusu." };
  }
}
