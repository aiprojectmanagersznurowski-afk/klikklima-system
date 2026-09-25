import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../lib/field-api/security-event';
import { getActorConsentsStatus } from '../../../../lib/domain/consents';

/**
 * GET /api/field/consents
 * Pobiera listę obowiązujących dokumentów prawnych wraz ze statusem ich akceptacji przez pracownika.
 * Zgodne z FLD-CONSENT-ENFORCE i FLD-CONSENT-ACCEPT.
 */
export async function GET(request: Request): Promise<Response> {
  const verify = await verifyFieldActor(request);
  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const access = can(verify.actor.role, 'legal_document_versions', 'read');
  if (access !== 'yes' && access !== 'own') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource: 'legal_document_versions',
      attemptedCapability: 'read',
      endpoint: '/api/field/consents',
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do odczytu dokumentów prawnych' },
      { status: 403 }
    );
  }

  const result = await getActorConsentsStatus(verify.actor);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
