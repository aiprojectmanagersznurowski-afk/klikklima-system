import { prisma } from '@repo/database';
import { can, type Role } from '@klikklima/contracts';
import type { FieldActor } from '../field-api/types';
import { executeGetOwnJobDetail } from './jobs';
import {
  computeDocumentHash,
  verifyDocumentHash,
  validateSignatureCapture,
  buildSignatureCard,
  verifyAuditChain,
  requestTsaTimestamp,
  verifyTsaPair,
  type TsaProvider,
  type SignatureCaptureInput,
  type DocumentType,
  type SignatureMode,
} from '../../../../../packages/signature/src';

// Re-eksportujemy funkcje regułowe z pakietu @repo/signature
export {
  computeDocumentHash,
  verifyDocumentHash,
  validateSignatureCapture,
  buildSignatureCard,
  verifyAuditChain,
  requestTsaTimestamp,
  verifyTsaPair,
};
export type { DocumentType, SignatureMode };

// @REQ: FLD-SIGN-DOC-FREEZE
// @REQ: FLD-SIGN-CAPTURE
// @REQ: FLD-SIGN-AUDIT-TRAIL
// @REQ: FLD-SIGN-TSA

export interface DocumentSigningInfo {
  documentId: string;
  documentType: DocumentType;
  contentHash: string;
  templateVersion: string;
  isSigned: boolean;
}

export interface SaveOnsiteSignatureInput {
  installationId: string;
  documentType: DocumentType;
  documentId: string;
  documentHash: string;
  signatureImage: string;
  captureMetadata?: Record<string, unknown>;
  actor: FieldActor;
  tsaProvider?: TsaProvider;
}

export interface SaveOnsiteSignatureResult {
  success: boolean;
  code?: string;
  error?: string;
  signature?: {
    id: string;
    documentType: string;
    documentId: string;
    documentHash: string;
    mode: string;
    signedAt: string;
    tsaStatus: 'APPLIED' | 'PENDING';
    tsaTimestampAt: string | null;
  };
}

/**
 * Pobiera dokument do podpisania dla zalogowanego pracownika.
 * Sprawdza uprawnienia i przypisanie do zlecenia (fail-closed).
 */
export async function getJobDocumentForSigning(
  jobId: string,
  actor: FieldActor
): Promise<DocumentSigningInfo | null> {
  // Sprawdzenie uprawnień RBAC
  const readPerm = can(actor.role as Role, 'signatures', 'read');
  if (readPerm === 'no') {
    return null;
  }

  // Wyszukaj zlecenie i sprawdź przypisanie do pracownika przez domenę zleceń
  const jobDetail = await executeGetOwnJobDetail(actor, jobId);
  if (!jobDetail.success || !jobDetail.job) {
    return null;
  }

  // Szukamy dokumentu protokołu zdawczo-odbiorczego lub umowy powiązanej z montażem
  const document = await prisma.document.findFirst({
    where: {
      sourceId: jobId,
      kind: { in: ['HANDOVER_PROTOCOL', 'INSTALLATION_CONTRACT'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!document || !document.contentHash) {
    return null;
  }

  // Sprawdzamy czy dokument został już podpisany
  const existingSignature = await prisma.signature.findFirst({
    where: {
      documentId: document.id,
      documentType: document.kind,
    },
  });

  return {
    documentId: document.id,
    documentType: document.kind as DocumentType,
    contentHash: document.contentHash,
    templateVersion: document.templateVersion || 'v1.0',
    isSigned: !!existingSignature,
  };
}

/**
 * Zapisuje podpis klienta na miejscu (On-site) z zachowaniem reguł FLD-SIGN-*.
 */
export async function saveOnsiteSignature(
  params: SaveOnsiteSignatureInput
): Promise<SaveOnsiteSignatureResult> {
  const { installationId, documentType, documentId, documentHash, signatureImage, captureMetadata, actor, tsaProvider } = params;

  // 1. Sprawdzenie uprawnień RBAC: can(role, 'signatures', 'create')
  const createPerm = can(actor.role as Role, 'signatures', 'create');
  if (createPerm === 'no') {
    return {
      success: false,
      code: 'FORBIDDEN',
      error: 'Brak uprawnień do rejestracji podpisu klienta',
    };
  }

  // 2. Walidacja formatu podpisu i metadanych (FLD-SIGN-CAPTURE)
  const validation = validateSignatureCapture({
    mode: 'ON_SITE',
    documentType,
    documentHash,
    signatureImage,
    captureMetadata,
  });

  if (!validation.isValid) {
    return {
      success: false,
      code: 'INVALID_SIGNATURE',
      error: validation.errors.join(', '),
    };
  }

  // 3. Weryfikacja przypisania pracownika do zlecenia (fail-closed) przez domenę zleceń
  const jobDetail = await executeGetOwnJobDetail(actor, installationId);
  if (!jobDetail.success || !jobDetail.job) {
    return {
      success: false,
      code: 'JOB_NOT_FOUND',
      error: 'Zlecenie montażowe nie zostało odnalezione lub brak dostępu',
    };
  }

  // 4. Weryfikacja istnienia dokumentu i zamrożenia skrótu (FLD-SIGN-DOC-FREEZE)
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    return {
      success: false,
      code: 'DOCUMENT_NOT_FOUND',
      error: 'Wskazany dokument do podpisu nie istnieje',
    };
  }

  if (document.contentHash !== documentHash.trim().toLowerCase()) {
    return {
      success: false,
      code: 'DOCUMENT_HASH_MISMATCH',
      error: 'Podany skrót dokumentu nie zgadza się z zamrożoną treścią dokumentu',
    };
  }

  // 5. Pobranie kwalifikowanego znacznika czasu EuroCert TSA (FLD-SIGN-TSA)
  const tsaResult = await requestTsaTimestamp(documentHash, tsaProvider);

  // 6. Transakcyjny zapis w signatures oraz audit_log
  const savedSignature = await prisma.$transaction(async (tx) => {
    const signature = await tx.signature.create({
      data: {
        documentType,
        documentId,
        mode: 'ON_SITE',
        documentHash: documentHash.trim().toLowerCase(),
        signatureImagePath: signatureImage.trim(),
        captureMetadata: captureMetadata ? JSON.parse(JSON.stringify(captureMetadata)) : undefined,
        tsaTimestampAt: tsaResult.timestampAt,
        tsaToken: tsaResult.token,
      },
    });

    // Rejestracja w audit_log (FLD-SIGN-AUDIT-TRAIL)
    await tx.auditLog.create({
      data: {
        actorEmail: actor.email,
        actorRole: actor.role,
        operation: 'field_update',
        resource: 'signatures',
        recordId: signature.id,
        justification: 'Elektroniczny podpis klienta na miejscu (FLD-SIGN-CAPTURE)',
        legalBasis: 'OTHER',
      },
    });

    return signature;
  });

  return {
    success: true,
    signature: {
      id: savedSignature.id,
      documentType: savedSignature.documentType,
      documentId: savedSignature.documentId,
      documentHash: savedSignature.documentHash,
      mode: savedSignature.mode,
      signedAt: savedSignature.signedAt.toISOString(),
      tsaStatus: tsaResult.success ? 'APPLIED' : 'PENDING',
      tsaTimestampAt: savedSignature.tsaTimestampAt ? savedSignature.tsaTimestampAt.toISOString() : null,
    },
  };
}

/**
 * Uzupełnia brakujący znacznik czasu TSA dla podpisu złożonego offline (FLD-SIGN-TSA).
 */
export async function stampTsaSignature(
  signatureId: string,
  provider?: TsaProvider
): Promise<{ success: boolean; error?: string }> {
  const signature = await prisma.signature.findUnique({
    where: { id: signatureId },
  });

  if (!signature) {
    return { success: false, error: 'Podpis nie istnieje' };
  }

  if (signature.tsaTimestampAt && signature.tsaToken) {
    return { success: true };
  }

  const tsaRes = await requestTsaTimestamp(signature.documentHash, provider);
  if (!tsaRes.success || !tsaRes.timestampAt || !tsaRes.token) {
    return { success: false, error: tsaRes.error || 'Dostawca TSA jest nadal niedostępny' };
  }

  // Aktualizacja nullowalnych kolumn TSA (jeden dozwolony wyjątek w signatures_append_only_trg)
  await prisma.signature.update({
    where: { id: signatureId },
    data: {
      tsaTimestampAt: tsaRes.timestampAt,
      tsaToken: tsaRes.token,
    },
  });

  return { success: true };
}
