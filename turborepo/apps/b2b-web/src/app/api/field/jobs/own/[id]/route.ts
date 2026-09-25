import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../../lib/field-api/security-event';
import { executeGetOwnJobDetail } from '../../../../../../lib/domain/jobs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/field/jobs/own/[id]
 * Odczyt szczegółów pojedynczego zlecenia z ochroną przed enumeracją (fail-closed).
 * Zgodne z FLD-JOBS-OWN oraz CRM-KLI-AC2.
 */
export async function GET(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const verify = await verifyFieldActor(request);
  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const { id } = await context.params;

  const resource = verify.actor.role === 'audytor' ? 'leads' : 'installations';
  const access = can(verify.actor.role, resource, 'read');

  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource,
      attemptedCapability: 'read',
      endpoint: `/api/field/jobs/own/${id}`,
    });
    return NextResponse.json(
      { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu' },
      { status: 404 }
    );
  }

  const result = await executeGetOwnJobDetail(verify.actor, id);
  if (!result.success || !result.job) {
    return NextResponse.json(
      { success: false, error: 'Nie znaleziono zlecenia lub brak dostępu' },
      { status: 404 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
