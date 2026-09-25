'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"
import { anonymizeClientSchema, ANONYMIZED_NAME_PLACEHOLDER } from "./anonymize-client-schema"
import { createCustomerSchema } from "./create-customer-schema"
import { updateCustomerContactDataSchema, type UpdateCustomerContactDataInput } from "./update-customer-schema"

export type CustomerSummary = {
  id: string;
  clientNumber: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  leadsCount: number;
  installationsCount: number;
}

/**
 * Pobiera listę klientów z agregacją liczby leadów oraz instalacji.
 *
 * @PERF: zamiast pobierać całe kolekcje leadów i instalacji przez `include`,
 * używamy `select` z `_count` — eliminujemy pobieranie setek niepotrzebnych wierszy
 * żeby policzyć wyłącznie dwie liczby. `_count` liczony po stronie bazy zamiast
 * pełnego `include` + `.length` w JS, paginacja wzorem `getLeads()` (`leads/actions.ts`)
 * dla spójności wzorca.
 *
 * @REQ: CRM-KLI-AC1 — obsługa wyszukiwania częściowego query po imieniu, nazwisku,
 * telefonie, e-mailu oraz client_number z zachowaniem bramki clients.read.
 */
export async function getCustomers(
  options?: { page?: number; limit?: number; query?: string }
): Promise<{ customers: CustomerSummary[]; totalPages: number }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { customers: [], totalPages: 0 };
  }
  if (!actorRole || can(actorRole, "clients", "read") !== "yes") {
    return { customers: [], totalPages: 0 };
  }

  const page = options?.page || 1;
  // MAJOR (audyt bezpieczeństwa 2026-09-24): limit górny — Server Action jest osiągalna
  // z klienta jak dowolne RPC, więc `limit: 100000` z konsoli nie może zwrócić całej tabeli.
  const REASONABLE_MAX_LIMIT = 100;
  const limit = Math.min(options?.limit || 50, REASONABLE_MAX_LIMIT);
  const skip = (page - 1) * limit;
  const query = options?.query?.trim();

  const where = query
    ? {
        OR: [
          { imie_i_nazwisko: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { telefon: { contains: query, mode: "insensitive" as const } },
          { client_number: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [customers, totalCount] = await Promise.all([
    prisma.klienci.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        client_number: true,
        imie_i_nazwisko: true,
        email: true,
        telefon: true,
        created_at: true,
        _count: { select: { leady: true } },
        leady: {
          select: {
            _count: { select: { instalacje: true } },
          },
        },
      },
    }),
    prisma.klienci.count({ where }),
  ]);

  return {
    customers: customers.map((c) => {
      const installationsCount = c.leady.reduce(
        (sum, lead) => sum + (lead._count?.instalacje || 0),
        0
      );

      return {
        id: c.id,
        clientNumber: c.client_number ?? null,
        name: c.imie_i_nazwisko || "Nieznany",
        email: c.email ?? null,
        phone: c.telefon ?? null,
        createdAt: c.created_at,
        leadsCount: c._count.leady,
        installationsCount,
      };
    }),
    totalPages: Math.ceil(totalCount / limit),
  };
}

/**
 * @REQ: CRM-KLI-AC2 — zmiana danych kontaktowych klienta na Karcie 360
 * propaguje się do aktywnych leadów. Leady w stanach terminalnych
 * (INSTALLATION_COMPLETED, ARCHIVED_LOST) oraz bucketach (QUOTE_REJECTED,
 * ROLLBACK_RESCHEDULING) NIE są modyfikowane.
 */
export async function updateCustomerContactDataAction(
  id: string,
  input: UpdateCustomerContactDataInput
): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do edycji klienta." };
  }
  if (!actorRole || can(actorRole, "clients", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do edycji klienta." };
  }

  const parsed = updateCustomerContactDataSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Nieprawidłowe dane kontaktowe klienta.",
    };
  }

  const { imieINazwisko, email, telefon } = parsed.data;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const actorEmail = data.user?.email;
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do edycji klienta." };
  }

  try {
    let updateCount = 0;
    await prisma.$transaction(async (tx) => {
      // BLOCKER 2 (audyt bezpieczeństwa 2026-09-24): wzorem anonymizeClientAction —
      // `updateMany` z `where: { id, anonymized_at: null }` jest bramką współbieżności
      // w bazie, nie sprawdzeniem w JS. `.update` przyjmuje wyłącznie unikalne pola w
      // `where` i nie mógłby wyrazić tego warunku — rekord raz zanonimizowany zostaje
      // zanonimizowany.
      const { count } = await tx.klienci.updateMany({
        where: { id, anonymized_at: null },
        data: {
          imie_i_nazwisko: imieINazwisko,
          email: email || null,
          telefon: telefon || null,
        },
      });
      updateCount = count;

      if (count === 0) {
        return;
      }

      await tx.auditLog.create({
        data: {
          operation: 'field_update',
          resource: 'clients',
          recordId: id,
          actorEmail,
          actorRole,
          justification: 'Aktualizacja danych kontaktowych klienta z Karty 360.',
          legalBasis: 'OTHER',
        },
      });
    });

    if (updateCount === 0) {
      return {
        success: false,
        error: "Klient został zanonimizowany — edycja danych kontaktowych jest niedostępna.",
      };
    }

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update customer contact data:", error);
    return { success: false, error: "Nie udało się zaktualizować danych klienta." };
  }
}

// Kształt zwracany przez getCustomerHistoryAction — dokładnie te pola, które renderuje
// zakładka "Historia" w tabs-client.tsx. Eksportowany, żeby klient nie musiał rzutować
// przez `unknown` na własny typ (patrz `Customer360Tabs`).
export type CustomerHistoryLeadItem = {
  id: string;
  lead_number: string | null;
  status: string | null;
  created_at: Date;
};

/**
 * @REQ: CRM-KLI-AC3 — Karta 360 ładuje historię asynchronicznie (lazy loading),
 * eliminując N+1 zapytań przy dużej historii klienta.
 */
export async function getCustomerHistoryAction(
  id: string
): Promise<{ success: boolean; error?: string; leads?: CustomerHistoryLeadItem[] }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do historii klienta." };
  }
  if (!actorRole || can(actorRole, "clients", "read") !== "yes") {
    return { success: false, error: "Brak uprawnień do historii klienta." };
  }

  try {
    // MAJOR (audyt bezpieczeństwa 2026-09-24): minimalizacja danych — `tabs-client.tsx`
    // (zakładka „Historia") renderuje wyłącznie id, lead_number (numer projektu), status
    // i created_at. Poprzednie `include: true` na instalacjach/logistyce i brak `select`
    // na leadzie serializowały do przeglądarki cały wiersz (notatki wewnętrzne, finalną
    // wycenę, odpowiedzi triage) i całe zagnieżdżone relacje.
    const leads = await prisma.leady.findMany({
      where: { klient_id: id },
      select: {
        id: true,
        project_number: true,
        status: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      success: true,
      leads: leads.map((lead) => ({
        id: lead.id,
        lead_number: lead.project_number,
        status: lead.status,
        created_at: lead.created_at,
      })),
    };
  } catch (error) {
    console.error("Failed to get customer history:", error);
    return { success: false, error: "Nie udało się pobrać historii klienta." };
  }
}

export async function anonymizeClientAction(
  id: string,
  input: { justification: string; legalBasis: string }
): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia klienta." };
  }
  if (!actorRole || can(actorRole, "clients", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia klienta." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const actorEmail = data.user?.email;
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia klienta." };
  }

  const parsed = anonymizeClientSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.klienci.updateMany({
        where: { id, anonymized_at: null },
        data: {
          imie_i_nazwisko: ANONYMIZED_NAME_PLACEHOLDER,
          email: null,
          telefon: null,
          anonymized_at: new Date(),
        },
      });

      if (count === 0) {
        return;
      }

      await tx.adresy.updateMany({
        where: { klient_id: id },
        data: {
          ulica_miasto: 'Adres usunięty',
          latitude: null,
          longitude: null,
        },
      });

      await tx.auditLog.create({
        data: {
          operation: 'anonymize',
          resource: 'clients',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to anonymize customer:", error);
    return { success: false, error: "Nie udało się usunąć klienta." };
  }
}

export async function createCustomerAction(
  input: { imieINazwisko: string; email?: string; telefon?: string }
): Promise<{ success: boolean; error?: string; customerId?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do dodania klienta." };
  }
  if (!actorRole || can(actorRole, "clients", "create") !== "yes") {
    return { success: false, error: "Brak uprawnień do dodania klienta." };
  }

  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Nieprawidłowe dane klienta." };
  }
  const { imieINazwisko, email, telefon } = parsed.data;

  try {
    const customer = await prisma.klienci.create({
      data: {
        imie_i_nazwisko: imieINazwisko,
        email: email || null,
        telefon: telefon || null,
      },
    });

    revalidatePath('/customers');
    return { success: true, customerId: customer.id };
  } catch (error) {
    console.error("Failed to create customer:", error);
    return { success: false, error: "Nie udało się dodać klienta." };
  }
}

export async function addCustomerAddress(klientId: string, ulicaMiasto: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do dodania adresu." };
  }
  if (!actorRole || can(actorRole, "clients", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do dodania adresu." };
  }

  try {
    await prisma.adresy.create({
      data: {
        klient_id: klientId,
        ulica_miasto: ulicaMiasto
      }
    });

    revalidatePath(`/customers/${klientId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to add customer address:", error);
    return { success: false, error: "Nie udało się dodać adresu." };
  }
}
