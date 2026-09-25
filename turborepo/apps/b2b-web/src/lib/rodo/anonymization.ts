import { AUDIT_REQUIREMENTS } from '@klikklima/contracts';
import type { AnonymizationResult } from './types';

export type LegalBasis = (typeof AUDIT_REQUIREMENTS.legalBases)[number];

export const ANONYMIZED_NAME_PLACEHOLDER = 'Klient usunięty';
export const ANONYMIZED_ADDRESS_PLACEHOLDER = 'Adres usunięty';

export function isClientAnonymized(
  customer: { anonymized_at?: Date | null; imie_i_nazwisko?: string | null } | null | undefined
): boolean {
  if (!customer) {
    return false;
  }
  if (customer.anonymized_at !== null && customer.anonymized_at !== undefined) {
    return true;
  }
  return customer.imie_i_nazwisko === ANONYMIZED_NAME_PLACEHOLDER;
}

export interface ExecuteClientAnonymizationParams {
  clientId: string;
  actorEmail: string;
  actorRole: string;
  justification: string;
  legalBasis: string;
}

export async function executeClientAnonymization(
  tx: unknown,
  params: ExecuteClientAnonymizationParams
): Promise<AnonymizationResult> {
  const { clientId, actorEmail, actorRole, justification, legalBasis } = params;

  const trimmedJustification = (justification || '').trim();
  if (trimmedJustification.length < 10) {
    throw new Error('Justification must be at least 10 characters long.');
  }

  const validLegalBases: readonly string[] = AUDIT_REQUIREMENTS.legalBases;
  if (!validLegalBases.includes(legalBasis)) {
    throw new Error(`Invalid legal basis provided: ${legalBasis}.`);
  }

  const db = tx as {
    klienci: {
      updateMany: (args: { where: { id: string; anonymized_at: null }; data: Record<string, unknown> }) => Promise<{ count: number }>;
    };
    adresy: {
      updateMany: (args: { where: { klient_id: string }; data: Record<string, unknown> }) => Promise<{ count: number }>;
    };
    auditLog: {
      create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    };
  };

  const clientUpdateResult = await db.klienci.updateMany({
    where: { id: clientId, anonymized_at: null },
    data: {
      imie_i_nazwisko: ANONYMIZED_NAME_PLACEHOLDER,
      email: null,
      telefon: null,
      anonymized_at: new Date(),
    },
  });

  if (clientUpdateResult.count === 0) {
    return {
      success: true,
      clientAnonymized: false,
      addressesAnonymizedCount: 0,
    };
  }

  const addressUpdateResult = await db.adresy.updateMany({
    where: { klient_id: clientId },
    data: {
      ulica_miasto: ANONYMIZED_ADDRESS_PLACEHOLDER,
      latitude: null,
      longitude: null,
    },
  });

  await db.auditLog.create({
    data: {
      operation: 'anonymize',
      resource: 'clients',
      recordId: clientId,
      actorEmail,
      actorRole,
      justification: trimmedJustification,
      legalBasis,
    },
  });

  return {
    success: true,
    clientAnonymized: true,
    addressesAnonymizedCount: addressUpdateResult.count,
  };
}
