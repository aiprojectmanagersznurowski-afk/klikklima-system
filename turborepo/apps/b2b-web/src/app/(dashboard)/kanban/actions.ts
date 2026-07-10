"use server";

import { prisma, LeadStatus } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function getLeads() {
  try {
    const leads = await prisma.leady.findMany({
      orderBy: { created_at: "desc" },
      include: {
        klient: true,
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
    await prisma.leady.update({
      where: { id: leadId },
      data: { status: newStatus },
    });
    revalidatePath("/kanban");
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead status:", error);
    return { success: false, error: "Nie udało się zaktualizować statusu." };
  }
}
