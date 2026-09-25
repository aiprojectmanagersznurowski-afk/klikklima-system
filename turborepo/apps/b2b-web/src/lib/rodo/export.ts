import { prisma } from '@repo/database';
import { ANONYMIZED_NAME_PLACEHOLDER, ANONYMIZED_ADDRESS_PLACEHOLDER, isClientAnonymized } from './anonymization';
import type { CustomerRodoExport } from './types';

export async function generateCustomerRodoExport(
  clientId: string,
  clientDb?: unknown
): Promise<CustomerRodoExport | null> {
  const db = (clientDb || prisma) as {
    klienci: {
      findUnique: (args: {
        where: { id: string };
        include?: Record<string, unknown>;
      }) => Promise<any>;
    };
  };

  const client = await db.klienci.findUnique({
    where: { id: clientId },
    include: {
      adresy: {
        orderBy: { created_at: 'desc' },
      },
      leady: {
        include: {
          instalacje: true,
        },
        orderBy: { created_at: 'desc' },
      },
      serwisy: {
        orderBy: { created_at: 'desc' },
      },
      usterki_incidents: {
        orderBy: { created_at: 'desc' },
      },
    },
  });

  if (!client) {
    return null;
  }

  const isAnon = isClientAnonymized(client);

  const addresses = (client.adresy || []).map((addr: any) => ({
    id: addr.id,
    address: addr.ulica_miasto,
    isAnonymized: addr.ulica_miasto === ANONYMIZED_ADDRESS_PLACEHOLDER,
    createdAt: addr.created_at ? new Date(addr.created_at).toISOString() : new Date().toISOString(),
  }));

  const projects = (client.leady || []).map((lead: any) => ({
    id: lead.id,
    projectNumber: lead.project_number,
    status: lead.status,
    createdAt: lead.created_at ? new Date(lead.created_at).toISOString() : new Date().toISOString(),
  }));

  const installations: any[] = [];
  (client.leady || []).forEach((lead: any) => {
    (lead.instalacje || []).forEach((inst: any) => {
      installations.push({
        id: inst.id,
        status: inst.status,
        scheduledDate: inst.montaz_data ? new Date(inst.montaz_data).toISOString() : null,
      });
    });
  });

  const services = (client.serwisy || []).map((srv: any) => ({
    id: srv.id,
    issueDescription: srv.opis_usterki,
    status: srv.status,
    serviceDate: srv.data_serwisu ? new Date(srv.data_serwisu).toISOString() : null,
  }));

  const incidents = (client.usterki_incidents || []).map((inc: any) => ({
    id: inc.id,
    issueDescription: inc.opis_usterki,
    status: inc.status,
    createdAt: inc.created_at ? new Date(inc.created_at).toISOString() : new Date().toISOString(),
  }));

  return {
    exportedAt: new Date().toISOString(),
    subject: {
      id: client.id,
      clientNumber: client.client_number || null,
      name: client.imie_i_nazwisko || null,
      email: client.email || null,
      phone: client.telefon || null,
      isAnonymized: isAnon,
      anonymizedAt: client.anonymized_at ? new Date(client.anonymized_at).toISOString() : null,
      createdAt: client.created_at ? new Date(client.created_at).toISOString() : new Date().toISOString(),
    },
    addresses,
    projects,
    installations,
    services,
    incidents,
  };
}
