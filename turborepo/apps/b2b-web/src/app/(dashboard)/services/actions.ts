"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { z } from "zod"
import { getCurrentActorRole, getCurrentUser } from "../../../utils/supabase/server"
import { deleteJustificationSchema, type DeleteJustificationInput, type DeleteActionResult } from "../../../lib/audit/delete-justification-schema"

// D1 (WO SRV-SOURCE-OF-TRUTH-SERVICES-VIEW): wiersz widoku ma dwa mozliwe
// pochodzenia. `service_id` jest kluczem `serwisy.id` (nigdy `instalacje.id`).
// `id` przestal byc uzywany jako klucz akcji.
export type ServiceSummary = {
  source: "service" | "forecast";
  service_id: string | null;
  service_number?: string | null;
  installation_id: string | null;
  installation_number?: string | null;
  next_service_date: Date;
  date_undetermined?: boolean;
  status: string;
  lead_id: string | null;
  project_number?: string | null;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  installation_date: Date | null;
}

const uuidSchema = z.string().uuid();

// Sentinel error used to distinguish "record already gone" from other
// transaction failures in deleteServiceAction's outer catch block.
class ServiceNotFoundError extends Error {}

export async function getUpcomingServices(): Promise<ServiceSummary[]> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return [];
  }

  const access = actorRole ? can(actorRole, "services", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return [];
  }

  let serviceScopeWhere: object | undefined;
  let installationScopeZespolId: string | undefined;
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
    serviceScopeWhere = {
      OR: [
        { zespol_id: ownId },
        { AND: [{ zespol_id: null }, { instalacja: { zespol_id: ownId } }] },
      ],
    };
    installationScopeZespolId = ownId;
  }

  const services = await prisma.serwisy.findMany({
    where: serviceScopeWhere,
    include: {
      instalacja: {
        include: {
          lead: {
            include: {
              klient: true,
              adres: true,
            },
          },
        },
      },
      klient: true,
      adres: true,
    },
  });

  const rows: ServiceSummary[] = [];
  const installationIdsWithService = new Set<string>();

  for (const service of services) {
    if (service.instalacja_id) {
      installationIdsWithService.add(service.instalacja_id);
    }

    // D2: brak daty realizacji ORAZ brak terminu instalacji (np. serwis
    // osierocony bez instalacji) => wiersz jest pomijany calkowicie.
    if (!service.data_realizacji && !service.instalacja?.next_service_date) {
      continue;
    }

    const klient = service.instalacja ? service.instalacja.lead?.klient : service.klient;
    const adres = service.instalacja ? service.instalacja.lead?.adres : service.adres;

    rows.push({
      source: "service",
      service_id: service.id,
      service_number: service.service_number,
      installation_id: service.instalacja_id ?? null,
      installation_number: service.instalacja?.installation_number ?? null,
      next_service_date: (service.data_realizacji ?? service.instalacja?.next_service_date) as Date,
      date_undetermined: !service.data_realizacji,
      status: service.status,
      lead_id: service.instalacja?.lead_id ?? null,
      project_number: service.instalacja?.lead?.project_number ?? null,
      customer_name: klient?.imie_i_nazwisko || "Nieznany Klient",
      customer_phone: klient?.telefon ?? null,
      address: adres?.ulica_miasto ?? "Brak adresu",
      installation_date: service.instalacja?.data_zakonczenia ?? null,
    });
  }

  const installations = await prisma.instalacje.findMany({
    where: {
      next_service_date: {
        not: null,
      },
      zespol_id: installationScopeZespolId,
    },
    include: {
      lead: {
        include: {
          klient: true,
          adres: true,
        },
      },
    },
  });

  for (const inst of installations) {
    // D2/D4: instalacja z co najmniej jednym rekordem serwisu jest wypierana
    // przez ten rekord - dedup wykonany po stronie aplikacji, bo zapytanie
    // instalacje.findMany jest surowe (nieodfiltrowane).
    if (installationIdsWithService.has(inst.id)) {
      continue;
    }
    if (!inst.next_service_date) {
      continue;
    }

    rows.push({
      source: "forecast",
      service_id: null,
      service_number: null,
      installation_id: inst.id,
      installation_number: inst.installation_number ?? null,
      next_service_date: inst.next_service_date,
      status: inst.status,
      lead_id: inst.lead_id ?? null,
      project_number: inst.lead?.project_number ?? null,
      customer_name: inst.lead?.klient?.imie_i_nazwisko || "Nieznany Klient",
      customer_phone: inst.lead?.klient?.telefon ?? null,
      address: inst.lead?.adres?.ulica_miasto ?? "Brak adresu",
      installation_date: inst.data_zakonczenia ?? null,
    });
  }

  rows.sort((a, b) => a.next_service_date.getTime() - b.next_service_date.getTime());

  return rows;
}

export async function deleteServiceAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteActionResult> {
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: "Nieprawidlowy format identyfikatora serwisu." };
  }

  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>>;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia serwisu." };
  }

  if (!actorRole || can(actorRole, "services", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia serwisu." };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia serwisu." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia serwisu." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.serwisy.findUnique({ where: { id: parsedId.data } });
      if (!existing) {
        throw new ServiceNotFoundError();
      }

      await tx.serwisy.delete({
        where: { id: parsedId.data },
      });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'services',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
    });
    revalidatePath('/services');
    return { success: true };
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      return { success: false, error: "Rekord serwisu nie istnieje (mogl zostac juz usuniety)." };
    }
    console.error("Failed to delete service:", error);
    return { success: false, error: "Nie udało się usunąć serwisu." };
  }
}
