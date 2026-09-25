import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../lib/field-api/security-event';
import { executeGetOwnJobs } from '../../../../../lib/domain/jobs';

/**
 * GET /api/field/jobs/own
 * Zwraca listę zleceń przypisanych do zalogowanego pracownika terenowego (audytor / monter).
 * Zgodne z FLD-JOBS-OWN oraz CRM-KLI-AC2.
 */
export async function GET(request: Request): Promise<Response> {
  const verify = await verifyFieldActor(request);
  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const resource = verify.actor.role === 'audytor' ? 'leads' : 'installations';
  const access = can(verify.actor.role, resource, 'read');

  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource,
      attemptedCapability: 'read',
      endpoint: '/api/field/jobs/own',
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do odczytu zleceń' },
      { status: 403 }
    );
  }

  const result = await executeGetOwnJobs(verify.actor);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 403 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
