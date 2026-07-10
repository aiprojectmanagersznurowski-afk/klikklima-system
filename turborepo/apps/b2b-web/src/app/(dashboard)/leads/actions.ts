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

export async function getLeads(options?: { status?: LeadStatus, page?: number, limit?: number }) {
  try {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where = options?.status ? { status: options.status } : {};

    const [leads, totalCount, statusGroups] = await Promise.all([
      prisma.leady.findMany({
        where,
        orderBy: [
          { data_rezerwacji: "asc" },
          { created_at: "desc" }
        ],
        skip,
        take: limit,
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
      }),
      prisma.leady.count({ where }),
      prisma.leady.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      })
    ]);

    const stageCounts = statusGroups.reduce((acc, curr) => {
      if (curr.status) {
        acc[curr.status] = curr._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      leads,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      stageCounts
    };
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return { leads: [], totalCount: 0, totalPages: 0, stageCounts: {} };
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
