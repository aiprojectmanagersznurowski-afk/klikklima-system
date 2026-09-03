"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, getCurrentUser } from "../../../utils/supabase/server"
import { deleteJustificationSchema, type DeleteJustificationInput, type DeleteActionResult } from "../../../lib/audit/delete-justification-schema"

export type IncidentSummary = {
  id: string;
  numer_zgloszenia: string | null;
  klient_name: string;
  opis_usterki: string;
  priorytet: string;
  status: string;
  created_at: Date;
  zespol_name: string | null;
}

export async function getIncidents(): Promise<IncidentSummary[]> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return [];
  }

  const access = actorRole ? can(actorRole, "incidents", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return [];
  }

  let scopeWhere: object | undefined;
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
    const ownId = matches[0].id;
    scopeWhere = {
      OR: [
        { zespol_id: ownId },
        { AND: [{ zespol_id: null }, { instalacja: { zespol_id: ownId } }] },
      ],
    };
  }

  const incidents = await prisma.usterki_incidents.findMany({
    where: scopeWhere,
    include: {
      klient: true,
      zespol: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  return incidents.map(inc => ({
    id: inc.id,
    numer_zgloszenia: inc.numer_zgloszenia,
    klient_name: inc.klient?.imie_i_nazwisko || "Nieznany Klient",
    opis_usterki: inc.opis_usterki ?? "Brak opisu",
    priorytet: inc.priorytet ?? "NISKI",
    status: inc.status ?? "NOWE",
    created_at: inc.created_at,
    zespol_name: inc.zespol?.nazwa ?? null
  }));
}

export async function deleteIncidentAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteActionResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }
  if (!actorRole || can(actorRole, "incidents", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia usterki." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usterki_incidents.delete({
        where: { id }
      });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'incidents',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
    });
    revalidatePath('/incidents');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete incident:", error);
    return { success: false, error: "Nie udało się usunąć usterki." };
  }
}
