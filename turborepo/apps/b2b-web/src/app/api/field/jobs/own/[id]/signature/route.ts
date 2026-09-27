import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../../../lib/field-api/security-event';
import { executeWithIdempotency } from '../../../../../../../lib/field-api/idempotency';
import { getJobDocumentForSigning, saveOnsiteSignature, type DocumentType } from '../../../../../../../lib/domain/signature';
import type { FieldActor, FieldActorRole } from '../../../../../../../lib/field-api/types';

// @REQ: FLD-SIGN-DOC-FREEZE
// @REQ: FLD-SIGN-CAPTURE
// @REQ: FLD-SIGN-AUDIT-TRAIL
// @REQ: FLD-SIGN-TSA

type RouteParams = {
  params: Promise<{ id: string }>;
};

type GenericVerifyResult = {
  success: boolean;
  status?: number;
  httpStatus?: number;
  error?: string;
  reason?: string;
  actor?: FieldActor;
  role?: FieldActorRole;
  email?: string;
  entityId?: string;
  isActive?: boolean;
};

export async function GET(
  request: Request,
  context: RouteParams
): Promise<Response> {
  const { id: jobId } = await context.params;

  const verifyRaw = (await verifyFieldActor(request)) as unknown;
  const verify = verifyRaw as GenericVerifyResult;
  if (!verify || !verify.success) {
    const status = verify?.status || verify?.httpStatus || 401;
    const error = verify?.error || verify?.reason || 'Brak autoryzacji';
    return NextResponse.json(
      { success: false, error },
      { status }
    );
  }

  const actor: FieldActor = verify.actor || {
    role: verify.role!,
    email: verify.email!,
    entityId: verify.entityId!,
    isActive: typeof verify.isActive === 'boolean' ? verify.isActive : true,
  };

  const access = can(actor.role, 'signatures', 'read');
  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: actor.email,
      actorRole: actor.role,
      resource: 'signatures',
      attemptedCapability: 'read',
      endpoint: `/api/field/jobs/own/${jobId}/signature`,
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do odczytu dokumentu do podpisu' },
      { status: 403 }
    );
  }

  const documentInfo = await getJobDocumentForSigning(jobId, actor);

  if (!documentInfo) {
    return NextResponse.json(
      {
        success: false,
        error: 'Zlecenie lub dokument do podpisu nie zostały odnalezione',
      },
      { status: 404 }
    );
  }

  return NextResponse.json(documentInfo, { status: 200 });
}

export async function POST(
  request: Request,
  context: RouteParams
): Promise<Response> {
  const { id: jobId } = await context.params;

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Wymagany jest nagłówek Idempotency-Key dla podpisu' },
      { status: 400 }
    );
  }

  const verifyRaw = (await verifyFieldActor(request)) as unknown;
  const verify = verifyRaw as GenericVerifyResult;
  if (!verify || !verify.success) {
    const status = verify?.status || verify?.httpStatus || 401;
    const error = verify?.error || verify?.reason || 'Brak autoryzacji';
    return NextResponse.json(
      { success: false, error },
      { status }
    );
  }

  const actor: FieldActor = verify.actor || {
    role: verify.role!,
    email: verify.email!,
    entityId: verify.entityId!,
    isActive: typeof verify.isActive === 'boolean' ? verify.isActive : true,
  };

  const access = can(actor.role, 'signatures', 'create');
  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: actor.email,
      actorRole: actor.role,
      resource: 'signatures',
      attemptedCapability: 'create',
      endpoint: `/api/field/jobs/own/${jobId}/signature`,
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do rejestracji podpisu' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Nieprawidłowy format treści JSON żądania' },
      { status: 400 }
    );
  }

  const payload = body as {
    documentType?: DocumentType;
    documentId?: string;
    documentHash?: string;
    signatureImage?: string;
    captureMetadata?: Record<string, unknown>;
  };

  if (
    !payload?.signatureImage ||
    typeof payload.signatureImage !== 'string' ||
    payload.signatureImage.trim().length === 0
  ) {
    return NextResponse.json(
      { success: false, error: 'Signature image cannot be empty' },
      { status: 400 }
    );
  }

  if (!payload?.documentId || !payload?.documentType || !payload?.documentHash) {
    return NextResponse.json(
      {
        success: false,
        error: 'Wymagane są pola documentId, documentType oraz documentHash',
      },
      { status: 400 }
    );
  }

  const idempotencyResult = await executeWithIdempotency({
    idempotencyKey,
    actorEmail: actor.email,
    endpoint: `/api/field/jobs/own/${jobId}/signature`,
    body: payload,
    operation: async () => {
      const result = await saveOnsiteSignature({
        installationId: jobId,
        documentType: payload.documentType!,
        documentId: payload.documentId!,
        documentHash: payload.documentHash!,
        signatureImage: payload.signatureImage!,
        captureMetadata: payload.captureMetadata,
        actor,
      });

      if (!result.success) {
        const httpStatus = result.code === 'DOCUMENT_HASH_MISMATCH' ? 422 : 400;
        return {
          status: httpStatus,
          body: {
            success: false,
            code: result.code,
            error: result.error,
          },
        };
      }

      return {
        status: 201,
        body: result,
      };
    },
  });

  return NextResponse.json(idempotencyResult.body, { status: idempotencyResult.status });
}
