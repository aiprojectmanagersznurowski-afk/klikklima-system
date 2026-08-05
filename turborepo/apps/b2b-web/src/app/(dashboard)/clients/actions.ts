"use server";

import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function getClients(options?: { search?: string, page?: number, limit?: number }) {
  try {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    const where = options?.search ? {
      OR: [
        { imie_i_nazwisko: { contains: options.search, mode: "insensitive" as const } },
        { email: { contains: options.search, mode: "insensitive" as const } },
        { telefon: { contains: options.search, mode: "insensitive" as const } }
      ]
    } : {};

    const [clients, totalCount] = await Promise.all([
      prisma.klienci.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: {
          adresy: true,
          _count: {
            select: {
              leady: true,
              serwisy: true,
            }
          },
          leady: {
            select: {
              id: true,
              status: true,
              instalacje: {
                select: {
                  id: true,
                  status: true
                }
              }
            }
          }
        }
      }),
      prisma.klienci.count({ where })
    ]);

    const formattedClients = clients.map(client => {
      const activeLeadsCount = client._count.leady;
      const totalInstallationsCount = client.leady.reduce((acc, lead) => acc + lead.instalacje.length, 0);
      const mainAddress = client.adresy[0]?.ulica_miasto || "Brak przypisanego adresu";

      return {
        id: client.id,
        imie_i_nazwisko: client.imie_i_nazwisko || "Nieznany klient",
        email: client.email || "Brak email",
        telefon: client.telefon || "Brak telefonu",
        mainAddress,
        activeLeadsCount,
        totalInstallationsCount,
        servicesCount: client._count.serwisy,
        createdAt: client.created_at
      };
    });

    return {
      clients: formattedClients,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    };
  } catch (error) {
    console.error("Failed to fetch clients:", error);
    return { clients: [], totalCount: 0, totalPages: 0 };
  }
}

export async function getClientById(clientId: string) {
  try {
    const client = await prisma.klienci.findUnique({
      where: { id: clientId },
      include: {
        adresy: true,
        leady: {
          include: {
            audytor: true,
            logistyka_zamowienia: true,
            instalacje: {
              include: {
                zespol: true
              }
            }
          },
          orderBy: { created_at: "desc" }
        },
        serwisy: {
          include: {
            zespol: true,
            instalacja: true
          },
          orderBy: { data_zgloszenia: "desc" }
        }
      }
    });

    if (!client) return null;

    // Zbierz wszystkie instalacje przez leady
    const allInstallations = client.leady.flatMap(lead => 
      lead.instalacje.map(inst => ({
        ...inst,
        leadStatus: lead.status,
        wycena: lead.finalna_wycena_pln ? `${lead.finalna_wycena_pln} PLN` : lead.estymowana_wycena || "W trakcie wyceny"
      }))
    );

    // Wyciągnij notatki z leadów (jeśli są)
    const notes = client.leady
      .filter(lead => lead.notatki_wewnetrzne && lead.notatki_wewnetrzne.trim().length > 0)
      .map(lead => ({
        id: lead.id,
        date: lead.created_at,
        content: lead.notatki_wewnetrzne || "",
        author: lead.audytor?.imie_i_nazwisko || "System / Dyspozytor"
      }));

    // Odtwórz historię powiadomień w oparciu o etapy (wg notification_definitions.md)
    const contactLogs: Array<{ id: string; date: Date; type: "EMAIL" | "SMS"; template: string; title: string; recipient: string; status: string }> = [];
    
    if (client.email || client.telefon) {
      contactLogs.push({
        id: "log-1",
        date: client.created_at,
        type: client.email ? "EMAIL" : "SMS",
        template: "N1_NEW_LEAD_CONFIRMATION",
        title: "Potwierdzenie rejestracji zgłoszenia i przypisanie do Triage",
        recipient: client.email || client.telefon || "-",
        status: "Dostarczono (Wysłane z kolejki)"
      });
    }

    client.leady.forEach((lead, index) => {
      if (lead.audytor) {
        contactLogs.push({
          id: `log-aud-${index}`,
          date: lead.updated_at || lead.created_at,
          type: "SMS",
          template: "N2_AUDIT_SCHEDULED",
          title: `Przypisano audytora: ${lead.audytor.imie_i_nazwisko} do Twojego zlecenia`,
          recipient: client.telefon || client.email || "-",
          status: "Dostarczono"
        });
      }
    });

    return {
      id: client.id,
      imie_i_nazwisko: client.imie_i_nazwisko || "Nieznany klient",
      email: client.email || "Brak email",
      telefon: client.telefon || "Brak telefonu",
      createdAt: client.created_at,
      addresses: client.adresy,
      leads: client.leady,
      installations: allInstallations,
      services: client.serwisy,
      notes,
      contactLogs
    };
  } catch (error) {
    console.error("Failed to fetch client details:", error);
    return null;
  }
}

export async function addClientNote(leadId: string, noteContent: string) {
  try {
    const existingLead = await prisma.leady.findUnique({ where: { id: leadId }, select: { notatki_wewnetrzne: true } });
    if (!existingLead) return { success: false, error: "Lead nie istnieje" };

    const timestamp = new Date().toLocaleDateString("pl-PL") + " " + new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    const newNoteFormatted = `[${timestamp}]: ${noteContent}\n` + (existingLead.notatki_wewnetrzne || "");

    await prisma.leady.update({
      where: { id: leadId },
      data: { notatki_wewnetrzne: newNoteFormatted }
    });

    revalidatePath(`/clients`);
    return { success: true };
  } catch (error) {
    console.error("Failed to add client note:", error);
    return { success: false, error: "Błąd podczas zapisu notatki" };
  }
}
