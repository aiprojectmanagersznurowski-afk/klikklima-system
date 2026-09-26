import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../../../lib/field-api/security-event';
import { canStartJobWithConsents } from '../../../../../../../lib/domain/consents';
import { executeStartJob } from '../../../../../../../lib/domain/jobs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/field/jobs/own/[id]/start
 * Rozpoczęcie wykonywania zlecenia przez pracownika terenowego z serwerową bramką zgód.
 * Zgodne z FLD-CONSENT-ENFORCE oraz FLD-JOBS-OWN.
 */
export async function POST(
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
  const access = can(verify.actor.role, resource, 'update');

  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource,
      attemptedCapability: 'update',
      endpoint: `/api/field/jobs/own/${id}/start`,
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do zmiany statusu zlecenia' },
      { status: 403 }
    );
  }

  try {
    // Serwerowa bramka wymuszenia kompletu aktualnych zgód (FLD-CONSENT-ENFORCE)
    const consentGate = await canStartJobWithConsents(verify.actor, id);
    if (!consentGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: consentGate.error,
          missingDocuments: consentGate.missingDocuments,
        },
        { status: 403 }
      );
    }
  } catch (err) {
    console.error('Błąd weryfikacji zgód przy startowaniu zlecenia:', err);
    return NextResponse.json(
      { success: false, error: 'Błąd weryfikacji wymaganych zgód' },
      { status: 500 }
    );
  }

  const result = await executeStartJob(verify.actor, id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
