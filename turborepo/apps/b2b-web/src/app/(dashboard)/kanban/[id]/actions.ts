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

    revalidatePath(`/kanban/${leadId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead data:", error);
    return { success: false, error: "Nie udało się zapisać danych." };
  }
}

