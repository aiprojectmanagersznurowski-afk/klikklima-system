"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { z } from "zod"
import { getCurrentActorRole } from "../../../utils/supabase/server"

// D1 (WO SRV-SOURCE-OF-TRUTH-SERVICES-VIEW): wiersz widoku ma dwa mozliwe
// pochodzenia. `service_id` jest kluczem `serwisy.id` (nigdy `instalacje.id`).
// `id` przestal byc uzywany jako klucz akcji.
export type ServiceSummary = {
  source: "service" | "forecast";
  service_id: string | null;
  installation_id: string | null;
  next_service_date: Date;
  date_undetermined?: boolean;
  status: string;
  lead_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  installation_date: Date | null;
}

const uuidSchema = z.string().uuid();

export async function getUpcomingServices(): Promise<ServiceSummary[]> {
  const services = await prisma.serwisy.findMany({
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
      installation_id: service.instalacja_id ?? null,
      next_service_date: (service.data_realizacji ?? service.instalacja?.next_service_date) as Date,
      date_undetermined: !service.data_realizacji,
      status: service.status,
      lead_id: service.instalacja?.lead_id ?? null,
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
      installation_id: inst.id,
      next_service_date: inst.next_service_date,
      status: inst.status,
      lead_id: inst.lead_id ?? null,
      customer_name: inst.lead?.klient?.imie_i_nazwisko || "Nieznany Klient",
      customer_phone: inst.lead?.klient?.telefon ?? null,
      address: inst.lead?.adres?.ulica_miasto ?? "Brak adresu",
      installation_date: inst.data_zakonczenia ?? null,
    });
  }

  rows.sort((a, b) => a.next_service_date.getTime() - b.next_service_date.getTime());

  return rows;
}

export async function deleteServiceAction(id: string): Promise<{ success: boolean; error?: string }> {
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

  try {
    const existing = await prisma.serwisy.findUnique({ where: { id: parsedId.data } });
    if (!existing) {
      return { success: false, error: "Rekord serwisu nie istnieje (mogl zostac juz usuniety)." };
    }

    await prisma.serwisy.delete({
      where: { id: parsedId.data },
    });
    revalidatePath('/services');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete service:", error);
    return { success: false, error: "Nie udało się usunąć serwisu." };
  }
}
