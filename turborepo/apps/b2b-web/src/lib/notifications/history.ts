export interface CustomerHistoryParams {
  clientId: string;
  leadIds?: string[];
  installationIds?: string[];
  serviceIds?: string[];
  incidentIds?: string[];
}

export interface CustomerHistoryItem {
  id: string;
  notificationId: string;
  templateKey?: string;
  channel: string;
  recipientType: string;
  recipientAddress: string | null;
  status: string;
  createdAt: Date;
  leadId?: string | null;
  installationId?: string | null;
  serviceId?: string | null;
  incidentId?: string | null;
}

/// Klienci (`leady`/`serwisy`/`usterki_incidents` mają `klient_id` bezpośrednio;
/// `instalacje` NIE mają `klient_id` — tylko `lead_id`, stąd rozwiązanie w dwóch
/// krokach: najpierw leady klienta, potem instalacje TYCH leadów) — patrz relacje
/// w packages/database/prisma/schema.prisma (modele `klienci`, `leady`, `instalacje`,
/// `serwisy`, `usterki_incidents`).
export interface CustomerHistoryPrisma {
  notificationQueue: {
    findMany: (args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
    }) => Promise<CustomerHistoryItem[]>;
  };
  leady?: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<{ id: string }[]>;
  };
  instalacje?: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<{ id: string }[]>;
  };
  serwisy?: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<{ id: string }[]>;
  };
  usterki_incidents?: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<{ id: string }[]>;
  };
}

export async function getCustomerCommunicationHistory(
  prisma: CustomerHistoryPrisma,
  params: CustomerHistoryParams
): Promise<CustomerHistoryItem[]> {
  let leadIds = params.leadIds ?? [];
  let installationIds = params.installationIds ?? [];
  let serviceIds = params.serviceIds ?? [];
  let incidentIds = params.incidentIds ?? [];

  const noExplicitScope =
    leadIds.length === 0 && installationIds.length === 0 && serviceIds.length === 0 && incidentIds.length === 0;

  if (noExplicitScope) {
    // Wołający (np. Karta 360) nie znał jeszcze leadów/instalacji/serwisów/usterek
    // tego klienta — rozwiązujemy przez REALNĄ relację w bazie, nie przez
    // domysł. Brak dostępnego modelu (np. atrapa Prismy bez `leady`) traktujemy
    // jak "zero powiązań znalezionych", NIGDY jak "brak filtra" (patrz niżej:
    // brak jakiegokolwiek powiązania -> pusta lista, nie cała tabela).
    const leads = (await prisma.leady?.findMany?.({
      where: { klient_id: params.clientId },
    })) ?? [];
    leadIds = leads.map((l) => l.id);

    if (leadIds.length > 0) {
      const installations = (await prisma.instalacje?.findMany?.({
        where: { lead_id: { in: leadIds } },
      })) ?? [];
      installationIds = installations.map((i) => i.id);
    }

    const services = (await prisma.serwisy?.findMany?.({
      where: { klient_id: params.clientId },
    })) ?? [];
    serviceIds = services.map((s) => s.id);

    const incidents = (await prisma.usterki_incidents?.findMany?.({
      where: { klient_id: params.clientId },
    })) ?? [];
    incidentIds = incidents.map((u) => u.id);
  }

  const orConditions: Record<string, unknown>[] = [];

  if (leadIds.length > 0) {
    orConditions.push({ leadId: { in: leadIds } });
  }
  if (installationIds.length > 0) {
    orConditions.push({ installationId: { in: installationIds } });
  }
  if (serviceIds.length > 0) {
    orConditions.push({ serviceId: { in: serviceIds } });
  }
  if (incidentIds.length > 0) {
    orConditions.push({ incidentId: { in: incidentIds } });
  }

  if (orConditions.length === 0) {
    // Brak JAKIEGOKOLWIEK powiązania (leady/instalacje/serwisy/usterki) z tym
    // klientem -> pusta historia, NIGDY cała tabela notification_queue.
    return [];
  }

  const whereClause: Record<string, unknown> = {
    // NTF-HISTORY: Powiadomienia wewnętrzne (I1–I7) nie pojawiają się w historii klienta
    recipientType: "CLIENT",
    OR: orConditions,
  };

  return prisma.notificationQueue.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });
}
