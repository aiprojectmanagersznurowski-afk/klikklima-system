"use server";
import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";

/**
 * BLOCKER 4 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1, AC1.6): pula wyboru w UI
 * (getAuditors() w leads/actions.ts) już wyklucza zablokowanych audytorów, ale
 * to nie chroni przed żądaniem wysłanym wprost do tej Server Action z pominięciem
 * UI — trzeba odrzucić przypisanie zablokowanego audytora również tutaj.
 */
export async function updateLeadAuditor(leadId: string, audytorId: string | null) {
  try {
    const lead = await prisma.leady.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, error: "Lead not found" };

    if (audytorId) {
      const audytor = await prisma.audytorzy.findUnique({
        where: { id: audytorId },
        select: { is_active: true },
      });
      if (!audytor || !audytor.is_active) {
        return { success: false, error: "Audytor jest zablokowany — nie można go przypisać." };
      }
    }

    let newStatus = lead.status;
    if (audytorId && lead.status === "NEW_LEAD") {
      newStatus = "AWAITING_AUDIT";
    } else if (!audytorId && lead.status === "AWAITING_AUDIT") {
      newStatus = "NEW_LEAD";
    }

    await prisma.leady.update({
      where: { id: leadId },
      data: { 
        audytor_id: audytorId,
        status: newStatus 
      },
    });
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads`);
    return { success: true };
  } catch (error) {
    console.error("Failed to assign auditor:", error);
    return { success: false, error: "Nie udało się przypisać audytora." };
  }
}

export async function updateLeadData(
  leadId: string, 
  data: { 
    name: string; 
    phone: string; 
    email: string; 
    address: string; 
    estimatedQuote: string; 
  }
) {
  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      include: { klient: true, adres: true }
    });

    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    // Upsert Klient
    let klientId = lead.klient_id;
    if (klientId) {
      await prisma.klienci.update({
        where: { id: klientId },
        data: {
          imie_i_nazwisko: data.name,
          telefon: data.phone,
          email: data.email,
        }
      });
    } else {
      const newKlient = await prisma.klienci.create({
        data: {
          imie_i_nazwisko: data.name,
          telefon: data.phone,
          email: data.email,
        }
      });
      klientId = newKlient.id;
    }

    // Upsert Adres
    let adresId = lead.adres_id;
    if (adresId) {
      await prisma.adresy.update({
        where: { id: adresId },
        data: {
          ulica_miasto: data.address,
        }
      });
    } else {
      const newAdres = await prisma.adresy.create({
        data: {
          klient_id: klientId,
          ulica_miasto: data.address,
        }
      });
      adresId = newAdres.id;
    }

    // Update Lead
    await prisma.leady.update({
      where: { id: leadId },
      data: {
        klient_id: klientId,
        adres_id: adresId,
        estymowana_wycena: data.estimatedQuote,
      }
    });

    revalidatePath(`/leads/${leadId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead data:", error);
    return { success: false, error: "Nie udało się zapisać danych." };
  }
}

export async function deleteLead(leadId: string) {
  try {
    await prisma.leady.delete({
      where: { id: leadId },
    });
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete lead:", error);
    return { success: false, error: "Nie udało się usunąć leada." };
  }
}

