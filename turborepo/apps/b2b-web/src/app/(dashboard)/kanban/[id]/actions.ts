"use server";
import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function updateLeadAuditor(leadId: string, audytorId: string | null) {
  try {
    await prisma.leady.update({
      where: { id: leadId },
      data: { audytor_id: audytorId },
    });
    revalidatePath(`/kanban/${leadId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to assign auditor:", error);
    return { success: false, error: "Nie udało się przypisać audytora." };
  }
}
