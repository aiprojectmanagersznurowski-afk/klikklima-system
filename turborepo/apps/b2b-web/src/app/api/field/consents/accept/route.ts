import { NextResponse } from 'next/server';
import { z } from 'zod';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../lib/field-api/security-event';
import { executeWithIdempotency } from '../../../../../lib/field-api/idempotency';
import { executeAcceptLegalDocumentVersion } from '../../../../../lib/domain/consents';

const acceptConsentSchema = z.object({
  versionId: z.string({
    required_error: 'Pole versionId jest wymagane',
    invalid_type_error: 'Pole versionId musi być tekstem',
  }).min(1, 'Pole versionId nie może być puste'),
});

/**
 * POST /api/field/consents/accept
 * Zapis akceptacji wersji dokumentu prawnego z ochroną idempotencji.
 * Zgodne z FLD-CONSENT-ENFORCE i FLD-CONSENT-ACCEPT.
 */
export async function POST(request: Request): Promise<Response> {
  const verify = await verifyFieldActor(request);
  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const access = can(verify.actor.role, 'employee_consents', 'create');
  if (access !== 'yes' && access !== 'own') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource: 'employee_consents',
      attemptedCapability: 'create',
      endpoint: '/api/field/consents/accept',
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do zapisu zgody' },
      { status: 403 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Nieprawidłowy format JSON ciała żądania' },
      { status: 400 }
    );
  }

  const parsed = acceptConsentSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(', ');
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 400 }
    );
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');

  const result = await executeWithIdempotency({
    idempotencyKey,
    actorEmail: verify.actor.email,
    endpoint: '/api/field/consents/accept',
    body: parsed.data,
    operation: async (tx) => {
      const domainResult = await executeAcceptLegalDocumentVersion(
        verify.actor,
        parsed.data.versionId,
        tx
      );
      if (!domainResult.success) {
        return { status: 400, body: domainResult };
      }
      return { status: 200, body: domainResult };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
