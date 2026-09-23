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

export async function getCustomerCommunicationHistory(
  prisma: {
    notificationQueue: {
      findMany: (args: {
        where: Record<string, unknown>;
        orderBy?: Record<string, "asc" | "desc">;
      }) => Promise<CustomerHistoryItem[]>;
    };
  },
  params: CustomerHistoryParams
): Promise<CustomerHistoryItem[]> {
  const orConditions: Record<string, unknown>[] = [];

  if (params.leadIds && params.leadIds.length > 0) {
    orConditions.push({ leadId: { in: params.leadIds } });
  }

  if (params.installationIds && params.installationIds.length > 0) {
    orConditions.push({ installationId: { in: params.installationIds } });
  }

  if (params.serviceIds && params.serviceIds.length > 0) {
    orConditions.push({ serviceId: { in: params.serviceIds } });
  }

  if (params.incidentIds && params.incidentIds.length > 0) {
    orConditions.push({ incidentId: { in: params.incidentIds } });
  }

  const whereClause: Record<string, unknown> = {
    // NTF-HISTORY: Powiadomienia wewnętrzne (I1–I7) nie pojawiają się w historii klienta
    recipientType: "CLIENT",
  };

  if (orConditions.length > 0) {
    whereClause.OR = orConditions;
  }

  const rows = await prisma.notificationQueue.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  return rows;
}
