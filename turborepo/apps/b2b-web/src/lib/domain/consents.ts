import { prisma } from '@repo/database';
import { Prisma } from '@repo/database';
import { can } from '@klikklima/contracts';
import type { FieldActor } from '../field-api/types';

export interface DocumentConsentStatus {
  id: string;
  documentKind: string;
  versionNo: number;
  content: string;
  isCurrent: boolean;
  accepted: boolean;
  acceptedAt?: string;
}

export interface GetActorConsentsStatusResult {
  success: boolean;
  error?: string;
  allAccepted?: boolean;
  documents?: DocumentConsentStatus[];
}

export interface AcceptConsentResult {
  success: boolean;
  error?: string;
  consentId?: string;
  acceptedAt?: string;
}

export interface CanStartJobResult {
  allowed: boolean;
  error?: string;
  missingDocuments?: string[];
}

/**
 * getActorConsentsStatus — sprawdza status akceptacji aktualnych dokumentów prawnych dla danego pracownika.
 * Zgodne z FLD-CONSENT-ENFORCE i FLD-CONSENT-ACCEPT.
 */
export async function getActorConsentsStatus(
  actor: FieldActor
): Promise<GetActorConsentsStatusResult> {
  const access = can(actor.role, 'legal_document_versions', 'read');
  if (access !== 'yes' && access !== 'own') {
    return { success: false, error: 'Brak uprawnień do odczytu dokumentów prawnych' };
  }

  // Pobranie wszystkich aktualnie obowiązujących wersji dokumentów prawnych
  const currentVersions = await prisma.legalDocumentVersion.findMany({
    where: { isCurrent: true },
    orderBy: { createdAt: 'asc' },
  });

  // Pobranie zgód pracownika dla tych wersji
  const consents = await prisma.employeeConsent.findMany({
    where:
      actor.role === 'audytor'
        ? { auditorId: actor.entityId }
        : { crewId: actor.entityId },
  });

  const consentMap = new Map<string, { id: string; acceptedAt: Date }>();
  for (const c of consents) {
    consentMap.set(c.versionId, { id: c.id, acceptedAt: c.acceptedAt });
  }

  const documents: DocumentConsentStatus[] = currentVersions.map((doc) => {
    const existing = consentMap.get(doc.id);
    return {
      id: doc.id,
      documentKind: doc.documentKind,
      versionNo: doc.versionNo,
      content: doc.content,
      isCurrent: doc.isCurrent,
      accepted: !!existing,
      acceptedAt: existing ? existing.acceptedAt.toISOString() : undefined,
    };
  });

  const allAccepted = documents.length > 0 ? documents.every((d) => d.accepted) : true;

  return {
    success: true,
    allAccepted,
    documents,
  };
}

/**
 * executeAcceptLegalDocumentVersion — zapisuje akceptację wersji dokumentu (append-only).
 * Zgodne z FLD-CONSENT-ACCEPT i FLD-CONSENT-ENFORCE.
 */
export async function executeAcceptLegalDocumentVersion(
  actor: FieldActor,
  versionId: string,
  tx?: Prisma.TransactionClient
): Promise<AcceptConsentResult> {
  const access = can(actor.role, 'employee_consents', 'create');
  if (access !== 'yes' && access !== 'own') {
    return { success: false, error: 'Brak uprawnień do zapisu zgody' };
  }

  const db = tx ?? prisma;

  // Weryfikacja czy wersja istnieje i jest obecnie obowiązująca (is_current = true)
  const version = await db.legalDocumentVersion.findUnique({
    where: { id: versionId },
  });

  if (!version || !version.isCurrent) {
    return {
      success: false,
      error: 'Wskazana wersja dokumentu nie istnieje lub nie jest obowiązująca',
    };
  }

  try {
    const consent = await db.employeeConsent.create({
      data: {
        versionId,
        auditorId: actor.role === 'audytor' ? actor.entityId : null,
        crewId: actor.role === 'monter' ? actor.entityId : null,
      },
    });

    return {
      success: true,
      consentId: consent.id,
      acceptedAt: consent.acceptedAt.toISOString(),
    };
  } catch (error: unknown) {
    // Jeśli wpis już istnieje (unikalność pracownik + wersja), traktujemy to idempotentnie jako sukces
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const existing = await db.employeeConsent.findFirst({
        where: {
          versionId,
          ...(actor.role === 'audytor'
            ? { auditorId: actor.entityId }
            : { crewId: actor.entityId }),
        },
      });
      if (existing) {
        return {
          success: true,
          consentId: existing.id,
          acceptedAt: existing.acceptedAt.toISOString(),
        };
      }
    }

    return {
      success: false,
      error: 'Nie udało się zapisać akceptacji dokumentu',
    };
  }
}

/**
 * canStartJobWithConsents — serwerowa bramka wymuszająca komplet aktualnych zgód przed startem zlecenia.
 * Zgodne z FLD-CONSENT-ENFORCE: fail-closed, publikacja nowej wersji natychmiast blokuje start.
 */
export async function canStartJobWithConsents(
  actor: FieldActor,
  jobId: string
): Promise<CanStartJobResult> {
  void jobId;
  const status = await getActorConsentsStatus(actor);
  if (!status.success || !status.documents) {
    return {
      allowed: false,
      error: 'Błąd weryfikacji wymaganych zgód',
    };
  }

  if (!status.allAccepted) {
    const missingDocuments = status.documents
      .filter((d) => !d.accepted)
      .map((d) => d.documentKind);

    return {
      allowed: false,
      error: 'Brak wymaganych aktualnych zgód pracowniczych',
      missingDocuments,
    };
  }

  return { allowed: true };
}
