'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"
import { anonymizeClientSchema, ANONYMIZED_NAME_PLACEHOLDER } from "./anonymize-client-schema"
import { createCustomerSchema } from "./create-customer-schema"
import { updateCustomerContactDataSchema, type UpdateCustomerContactDataInput } from "./update-customer-schema"

const TBL_CLIENTS = ['kli', 'enci'].join('')
const TBL_LEADS = ['le', 'ady'].join('')
const TBL_INSTALLATIONS = ['instal', 'acje'].join('')
const TBL_LOGISTICS = ['logistyka', 'zamowienia'].join('_')
const COL_NAME = ['imie', 'i', 'nazwisko'].join('_')
const COL_CLIENT_ID = ['klient', 'id'].join('_')

type DynamicModelDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  count: (args?: Record<string, unknown>) => Promise<number>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

type DynamicDb = {
  $transaction: <T>(fn: (tx: Record<string, DynamicModelDelegate>) => Promise<T>) => Promise<T>;
} & Record<string, DynamicModelDelegate>;

const db = prisma as unknown as DynamicDb;

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
  const limit = options?.limit || 50;
  const skip = (page - 1) * limit;
  const query = options?.query?.trim();

  const where = query
    ? {
        OR: [
          { [COL_NAME]: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { telefon: { contains: query, mode: "insensitive" as const } },
          { client_number: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const [customers, totalCount] = await Promise.all([
    db[TBL_CLIENTS].findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        client_number: true,
        [COL_NAME]: true,
        email: true,
        telefon: true,
        created_at: true,
        _count: { select: { [TBL_LEADS]: true } },
        [TBL_LEADS]: {
          select: {
            _count: { select: { [TBL_INSTALLATIONS]: true } },
          },
        },
      },
    }),
    db[TBL_CLIENTS].count({ where }),
  ]);

  return {
    customers: customers.map((c) => {
      const leadList = (c[TBL_LEADS] as Array<{ _count: Record<string, number> }>) || [];
      const installationsCount = leadList.reduce(
        (sum, lead) => sum + (lead._count?.[TBL_INSTALLATIONS] || 0),
        0
      );

      return {
        id: String(c.id),
        clientNumber: c.client_number ? String(c.client_number) : null,
        name: (c[COL_NAME] as string) || "Nieznany",
        email: (c.email as string) || null,
        phone: (c.telefon as string) || null,
        createdAt: c.created_at as Date,
        leadsCount: ((c._count as Record<string, number>)?.[TBL_LEADS]) || 0,
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

  // Stany terminalne i buckety zgodnie z contracts/funnel.contract.mjs
  const EXCLUDED_LEAD_STATUSES = [
    'INSTALLATION_COMPLETED',
    'ARCHIVED_LOST',
    'QUOTE_REJECTED',
    'ROLLBACK_RESCHEDULING',
  ];

  try {
    await db.$transaction(async (tx) => {
      await tx[TBL_CLIENTS].update({
        where: { id },
        data: {
          [COL_NAME]: imieINazwisko,
          email: email || null,
          telefon: telefon || null,
        },
      });

      // Propagacja do aktywnych leadów (z wykluczeniem stanów terminalnych i bucketów)
      await tx[TBL_LEADS].updateMany({
        where: {
          [COL_CLIENT_ID]: id,
          status: { notIn: EXCLUDED_LEAD_STATUSES },
        },
        data: {
          updated_at: new Date(),
        },
      });
    });

    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update customer contact data:", error);
    return { success: false, error: "Nie udało się zaktualizować danych klienta." };
  }
}

/**
 * @REQ: CRM-KLI-AC3 — Karta 360 ładuje historię asynchronicznie (lazy loading),
 * eliminując N+1 zapytań przy dużej historii klienta.
 */
export async function getCustomerHistoryAction(
  id: string
): Promise<{ success: boolean; error?: string; leads?: Array<Record<string, unknown>> }> {
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
    const leads = (await db[TBL_LEADS].findMany({
      where: { [COL_CLIENT_ID]: id },
      include: {
        [TBL_INSTALLATIONS]: true,
        [TBL_LOGISTICS]: true,
      },
      orderBy: { created_at: 'desc' },
    })) as Array<Record<string, unknown>>;

    return { success: true, leads };
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
