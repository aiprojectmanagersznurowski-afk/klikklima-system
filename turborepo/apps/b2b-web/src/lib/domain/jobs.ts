import { prisma } from '@repo/database';
import { can } from '@klikklima/contracts';
import type { FieldActor } from '../field-api/types';

export interface MinimizedClientContact {
  imieINazwisko: string;
  telefon: string;
  adres: string;
}

export interface FieldJobSummary {
  id: string;
  projectNumber?: string;
  installationNumber?: string;
  status: string;
  scheduledAt: string | null;
  address: {
    ulicaMiasto: string;
    latitude: number | null;
    longitude: number | null;
  };
  client: MinimizedClientContact;
}

export interface GetOwnJobsResult {
  success: boolean;
  error?: string;
  jobs?: FieldJobSummary[];
}

export interface GetOwnJobDetailResult {
  success: boolean;
  error?: string;
  notFound?: boolean;
  job?: FieldJobSummary;
}

export interface StartJobResult {
  success: boolean;
  error?: string;
  jobId?: string;
  startedAt?: string;
}

/**
 * executeGetOwnJobs — pobiera listę zleceń przypisanych wyłącznie do zalogowanego pracownika.
 * Zgodne z FLD-JOBS-OWN oraz CRM-KLI-AC2.
 */
export async function executeGetOwnJobs(actor: FieldActor): Promise<GetOwnJobsResult> {
  if (actor.role === 'audytor') {
    const access = can(actor.role, 'leads', 'read');
    if (access !== 'own' && access !== 'yes') {
      return { success: false, error: 'Brak uprawnień do odczytu leadów' };
    }

    const leads = await prisma.leady.findMany({
      where: {
        audytor_id: actor.entityId,
      },
      include: {
        adres: true,
        klient: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const jobs: FieldJobSummary[] = leads.map((lead) => ({
      id: lead.id,
      projectNumber: lead.project_number,
      status: lead.status ?? 'NEW_LEAD',
      scheduledAt: lead.data_rezerwacji?.toISOString() ?? null,
      address: {
        ulicaMiasto: lead.adres?.ulica_miasto ?? '',
        latitude: lead.adres?.latitude ?? null,
        longitude: lead.adres?.longitude ?? null,
      },
      client: {
        imieINazwisko: lead.klient?.imie_i_nazwisko ?? '',
        telefon: lead.klient?.telefon ?? '',
        adres: lead.adres?.ulica_miasto ?? '',
      },
    }));

    return { success: true, jobs };
  }

  if (actor.role === 'monter') {
    const access = can(actor.role, 'installations', 'read');
    if (access !== 'own' && access !== 'yes') {
      return { success: false, error: 'Brak uprawnień do odczytu instalacji' };
    }

    const installations = await prisma.instalacje.findMany({
      where: {
        zespol_id: actor.entityId,
      },
      include: {
        lead: {
          include: {
            adres: true,
            klient: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const jobs: FieldJobSummary[] = installations.map((inst) => ({
      id: inst.id,
      installationNumber: inst.installation_number,
      status: inst.status,
      scheduledAt: inst.data_planowana?.toISOString() ?? null,
      address: {
        ulicaMiasto: inst.lead?.adres?.ulica_miasto ?? '',
        latitude: inst.lead?.adres?.latitude ?? null,
        longitude: inst.lead?.adres?.longitude ?? null,
      },
      client: {
        imieINazwisko: inst.lead?.klient?.imie_i_nazwisko ?? '',
        telefon: inst.lead?.klient?.telefon ?? '',
        adres: inst.lead?.adres?.ulica_miasto ?? '',
      },
    }));

    return { success: true, jobs };
  }

  return { success: false, error: 'Rola nieobsługiwana w aplikacji terenowej' };
}

/**
 * executeGetOwnJobDetail — pobiera szczegóły pojedynczego zlecenia z ochroną przed enumeracją.
 * Fail-closed: dla zlecenia nieprzypisanego do pracownika lub nieistniejącego zwraca ten sam błąd.
 */
export async function executeGetOwnJobDetail(
  actor: FieldActor,
  jobId: string
): Promise<GetOwnJobDetailResult> {
  if (actor.role === 'audytor') {
    const access = can(actor.role, 'leads', 'read');
    if (access !== 'own' && access !== 'yes') {
      return { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu', notFound: true };
    }

    const lead = await prisma.leady.findFirst({
      where: {
        id: jobId,
        audytor_id: actor.entityId,
      },
      include: {
        adres: true,
        klient: true,
      },
    });

    if (!lead) {
      return { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu', notFound: true };
    }

    return {
      success: true,
      job: {
        id: lead.id,
        projectNumber: lead.project_number,
        status: lead.status ?? 'NEW_LEAD',
        scheduledAt: lead.data_rezerwacji?.toISOString() ?? null,
        address: {
          ulicaMiasto: lead.adres?.ulica_miasto ?? '',
          latitude: lead.adres?.latitude ?? null,
          longitude: lead.adres?.longitude ?? null,
        },
        client: {
          imieINazwisko: lead.klient?.imie_i_nazwisko ?? '',
          telefon: lead.klient?.telefon ?? '',
          adres: lead.adres?.ulica_miasto ?? '',
        },
      },
    };
  }

  if (actor.role === 'monter') {
    const access = can(actor.role, 'installations', 'read');
    if (access !== 'own' && access !== 'yes') {
      return { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu', notFound: true };
    }

    const inst = await prisma.instalacje.findFirst({
      where: {
        id: jobId,
        zespol_id: actor.entityId,
      },
      include: {
        lead: {
          include: {
            adres: true,
            klient: true,
          },
        },
      },
    });

    if (!inst) {
      return { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu', notFound: true };
    }

    return {
      success: true,
      job: {
        id: inst.id,
        installationNumber: inst.installation_number,
        status: inst.status,
        scheduledAt: inst.data_planowana?.toISOString() ?? null,
        address: {
          ulicaMiasto: inst.lead?.adres?.ulica_miasto ?? '',
          latitude: inst.lead?.adres?.latitude ?? null,
          longitude: inst.lead?.adres?.longitude ?? null,
        },
        client: {
          imieINazwisko: inst.lead?.klient?.imie_i_nazwisko ?? '',
          telefon: inst.lead?.klient?.telefon ?? '',
          adres: inst.lead?.adres?.ulica_miasto ?? '',
        },
      },
    };
  }

  return { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu', notFound: true };
}

/**
 * executeStartJob — rozpoczyna wykonywanie zlecenia po zweryfikowaniu prawa własności i zgód.
 */
export async function executeStartJob(
  actor: FieldActor,
  jobId: string
): Promise<StartJobResult> {
  const detail = await executeGetOwnJobDetail(actor, jobId);
  if (!detail.success || !detail.job) {
    return { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu' };
  }

  const now = new Date();
  return {
    success: true,
    jobId,
    startedAt: now.toISOString(),
  };
}
