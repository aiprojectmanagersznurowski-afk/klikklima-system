"use server"

import { prisma, InstallationStatus } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, getCurrentUser } from "../../../utils/supabase/server"
import { deleteJustificationSchema, type DeleteJustificationInput, type DeleteActionResult } from "../../../lib/audit/delete-justification-schema"
import type { TriageAnswers } from "@/lib/triage-answers"

export type InstallationSummary = {
  id: string;
  installationNumber?: string | null;
  projectNumber?: string | null;
  leadId: string;
  clientName: string;
  clientAddress: string | null;
  plannedDate: string | null;
  status: InstallationStatus;
  crewName: string | null;
  deviceModel: string;
}

export async function getInstallations(): Promise<InstallationSummary[]> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return [];
  }

  const access = actorRole ? can(actorRole, "installations", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return [];
  }

  let scopeWhere: { zespol_id: string } | undefined;
  if (access === "own") {
    // Fail-closed spójnie z getCurrentActorRole() powyżej: wyjątek przy odczycie
    // tożsamości (np. Supabase niedostępny) ma dać odmowę, nie wywrócić Server Action.
    let user;
    try {
      ({ data: { user } } = await getCurrentUser());
    } catch (error) {
      console.error("Failed to resolve current user:", error);
      return [];
    }
    if (!user?.email) {
      return [];
    }

    const matches = await prisma.zespoly_monterskie.findMany({
      where: { email: user.email },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].aktywny === false) {
      return [];
    }
    scopeWhere = { zespol_id: matches[0].id };
  }

  const installations = await prisma.instalacje.findMany({
    where: scopeWhere,
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
    const triage: TriageAnswers = (inst.lead.odpowiedzi_triage as TriageAnswers | null) || {}
    let deviceModel = "Brak modelu"
    
    if (triage.selectedExternalUnit) {
       deviceModel = `${triage.selectedExternalUnit.brand} ${triage.selectedExternalUnit.model_code}`
    } else if (triage.selectedDeviceLine) {
       deviceModel = triage.selectedDeviceLine
    }

    return {
      id: inst.id,
      installationNumber: inst.installation_number,
      projectNumber: inst.lead.project_number,
      leadId: inst.lead_id,
      clientName: inst.lead.klient?.imie_i_nazwisko || "Nieznany",
      clientAddress: inst.lead.adres?.ulica_miasto || null,
      plannedDate: inst.data_planowana ? inst.data_planowana.toISOString().split("T")[0] : null,
      status: inst.status,
      crewName: inst.zespol?.nazwa || null,
      deviceModel
    }
  });
}

export async function updateInstallationStatus(id: string, newStatus: InstallationStatus): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do zmiany statusu instalacji." };
  }
  if (!actorRole || can(actorRole, "installations", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zmiany statusu instalacji." };
  }

  try {
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
    return { success: true };
  } catch (error) {
    console.error("Failed to update installation status:", error);
    return { success: false, error: "Nie udało się zaktualizować statusu instalacji." };
  }
}

export async function deleteInstallationAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteActionResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia instalacji." };
  }
  if (!actorRole || can(actorRole, "installations", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia instalacji." };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia instalacji." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia instalacji." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.instalacje.delete({
        where: { id }
      });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'installations',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
    });
    revalidatePath('/installations');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete installation:", error);
    return { success: false, error: "Nie udało się usunąć instalacji." };
  }
}
