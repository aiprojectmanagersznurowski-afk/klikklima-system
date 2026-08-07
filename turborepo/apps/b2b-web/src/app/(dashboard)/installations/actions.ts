"use server"

import { prisma, InstallationStatus } from "@repo/database"
import { revalidatePath } from "next/cache"

export type InstallationSummary = {
  id: string;
  leadId: string;
  clientName: string;
  clientAddress: string;
  plannedDate: string | null;
  status: InstallationStatus;
  crewName: string | null;
  deviceModel: string;
}

export async function getInstallations(): Promise<InstallationSummary[]> {
  const installations = await prisma.instalacje.findMany({
    include: {
      lead: {
        include: {
          klient: true,
          adres: true,
        }
      },
      zespol: true
    },
    orderBy: {
      data_planowana: 'asc', // Najbliższe na górze
    }
  });

  return installations.map(inst => {
    const triage = (inst.lead.odpowiedzi_triage as any) || {}
    let deviceModel = "Brak modelu"
    
    if (triage.selectedExternalUnit) {
       deviceModel = `${triage.selectedExternalUnit.brand} ${triage.selectedExternalUnit.model_code}`
    } else if (triage.selectedDeviceLine) {
       deviceModel = triage.selectedDeviceLine
    }

    return {
      id: inst.id,
      leadId: inst.lead_id,
      clientName: inst.lead.klient?.imie_i_nazwisko || "Nieznany",
      clientAddress: inst.lead.adres?.ulica_miasto || "Brak adresu",
      plannedDate: inst.data_planowana ? inst.data_planowana.toISOString().split("T")[0] : null,
      status: inst.status,
      crewName: inst.zespol?.nazwa || null,
      deviceModel
    }
  });
}

export async function updateInstallationStatus(id: string, newStatus: InstallationStatus) {
  const inst = await prisma.instalacje.update({
    where: { id },
    data: { 
      status: newStatus,
      data_zakonczenia: newStatus === "COMPLETED" ? new Date() : undefined
    }
  });

  // Jeżeli zakończona instalacja, możemy też zaktualizować status Leada na INSTALLATION_COMPLETED
  if (newStatus === "COMPLETED") {
    await prisma.leady.update({
      where: { id: inst.lead_id },
      data: { status: "INSTALLATION_COMPLETED" }
    });
  }

  revalidatePath('/installations');
  revalidatePath('/customers');
}

export async function assignCrew(installationId: string, crewId: string) {
  await prisma.instalacje.update({
    where: { id: installationId },
    data: { zespol_id: crewId }
  });
  
  revalidatePath('/installations');
}

export async function deleteInstallationAction(id: string) {
  await prisma.instalacje.delete({
    where: { id }
  });
  revalidatePath('/installations');
}
