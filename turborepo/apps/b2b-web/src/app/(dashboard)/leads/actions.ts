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

export async function getCrews() {
  try {
    return await prisma.zespoly_monterskie.findMany({
      where: { aktywny: true },
      orderBy: { nazwa: "asc" }
    });
  } catch (error) {
    console.error("Failed to fetch crews:", error);
    return [];
  }
}

/** Map bucket query param to LeadStatus */
function bucketToStatus(bucket: string): LeadStatus | null {
  switch (bucket) {
    case "cold": return "QUOTE_REJECTED";
    case "rejected_auto": return "QUOTE_REJECTED";
    case "rollback": return "ROLLBACK_RESCHEDULING";
    default: return null;
  }
}

export async function getLeads(options?: { 
  status?: LeadStatus | "ALL", 
  bucket?: string,
  page?: number, 
  limit?: number 
}) {
  try {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    // Determine filter: bucket takes priority, then status, then default
    let where: any = {};
    
    if (options?.bucket) {
      if (options.bucket === "rejected_auto") {
        where = { status: "QUOTE_REJECTED", lost_reason: "AUTO_REJECT_14_DAYS" };
      } else {
        const mappedStatus = bucketToStatus(options.bucket);
        if (mappedStatus) {
          where = { status: mappedStatus };
        }
      }
    } else if (options?.status && options.status !== "ALL") {
      where = { status: options.status };
    }
    // If status === "ALL" or no filter → where stays empty (all leads)

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

    // Compute total for "ALL" option
    const allCount = Object.values(stageCounts).reduce((sum, c) => sum + c, 0);
    stageCounts["ALL"] = allCount;

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

/**
 * Dozwolone przejścia statusów w lejku sprzedażowym.
 * Klucz = obecny status, wartość = lista dozwolonych statusów docelowych.
 */
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW_LEAD: ["AWAITING_AUDIT"],
  AWAITING_AUDIT: ["AUDIT_COMPLETED", "NEW_LEAD"],
  AUDIT_COMPLETED: ["AWAITING_CREW_ASSIGNMENT", "QUOTE_REJECTED"],
  AWAITING_CREW_ASSIGNMENT: ["HARDWARE_IN_WAREHOUSE", "ROLLBACK_RESCHEDULING"],
  HARDWARE_IN_WAREHOUSE: ["HARDWARE_IN_TRANSIT", "AWAITING_INSTALLATION", "ROLLBACK_RESCHEDULING"],
  HARDWARE_IN_TRANSIT: ["AWAITING_INSTALLATION", "ROLLBACK_RESCHEDULING"],
  AWAITING_INSTALLATION: ["INSTALLATION_COMPLETED", "ROLLBACK_RESCHEDULING"],
  INSTALLATION_COMPLETED: [],
  QUOTE_REJECTED: ["NEW_LEAD"],
  ROLLBACK_RESCHEDULING: ["AWAITING_CREW_ASSIGNMENT"],
};



/** Przesuwa leada do nowego statusu z walidacją dozwolonych przejść */
export async function advanceLeadStatus(leadId: string, targetStatus: LeadStatus) {
  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      select: { status: true, audytor_id: true }
    });

    if (!lead || !lead.status) {
      return { success: false, error: "Lead nie został znaleziony." };
    }

    const currentStatus = lead.status as LeadStatus;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      return { 
        success: false, 
        error: `Przejście z „${currentStatus}" do „${targetStatus}" nie jest dozwolone.` 
      };
    }

    // Walidacja biznesowa: E1→E2 wymaga audytora
    if (targetStatus === "AWAITING_AUDIT" && !lead.audytor_id) {
      return { success: false, error: "Najpierw przypisz audytora do tego leada." };
    }

    // Bucket timestamp
    const isBucket = targetStatus === "QUOTE_REJECTED" || targetStatus === "ROLLBACK_RESCHEDULING";

    await prisma.leady.update({
      where: { id: leadId },
      data: { 
        status: targetStatus,
        ...(isBucket ? { bucket_entered_at: new Date() } : {}),
        // Wyjście z bucketu rollback → powrót do E4 → wyczyść bucket timestamp
        ...(currentStatus === "ROLLBACK_RESCHEDULING" && targetStatus === "AWAITING_CREW_ASSIGNMENT" 
          ? { bucket_entered_at: null } 
          : {}
        ),
      },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to advance lead status:", error);
    return { success: false, error: "Nie udało się zmienić statusu leada." };
  }
}
