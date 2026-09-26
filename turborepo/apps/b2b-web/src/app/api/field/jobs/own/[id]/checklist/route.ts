import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../../../lib/field-api/security-event';
import { executeWithIdempotency } from '../../../../../../../lib/field-api/idempotency';
import {
  getInstallationChecklist,
  updateInstallationChecklist,
} from '../../../../../../../lib/domain/install-path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/field/jobs/own/[id]/checklist
 * Zwraca stan checklisty przedmontażowej (FLD-CHECKLIST-PREINSTALL).
 */
export async function GET(request: Request, context: RouteParams): Promise<Response> {
  const { id } = await context.params;
  const verify = await verifyFieldActor(request);

  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const access = can(verify.actor.role, 'installations', 'read');
  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource: 'installations',
      attemptedCapability: 'read',
      endpoint: `/api/field/jobs/own/${id}/checklist`,
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do odczytu checklisty instalacji' },
      { status: 403 }
    );
  }

  const result = await getInstallationChecklist(id, verify.actor);
  return NextResponse.json(result, { status: 200 });
}

/**
 * POST /api/field/jobs/own/[id]/checklist
 * Aktualizuje odhaczone pozycje checklisty ze znacznikiem czasu i ID montera (FLD-CHECKLIST-PREINSTALL).
 */
export async function POST(request: Request, context: RouteParams): Promise<Response> {
  const { id } = await context.params;
  const verify = await verifyFieldActor(request);

  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const access = can(verify.actor.role, 'installations', 'update');
  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource: 'installations',
      attemptedCapability: 'update',
      endpoint: `/api/field/jobs/own/${id}/checklist`,
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do aktualizacji checklisty instalacji' },
      { status: 403 }
    );
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Wymagany jest nagłówek Idempotency-Key dla zapisu checklisty' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Nieprawidłowy format JSON ciała żądania' },
      { status: 400 }
    );
  }

  const payload = body as { items?: Array<{ id: string; checked: boolean }> };
  if (!payload || !Array.isArray(payload.items)) {
    return NextResponse.json(
      { success: false, error: 'Ciało żądania musi zawierać tablicę items' },
      { status: 400 }
    );
  }

  const idempotencyResult = await executeWithIdempotency({
    idempotencyKey,
    actorEmail: verify.actor.email,
    endpoint: `/api/field/jobs/own/${id}/checklist`,
    body: payload,
    operation: async () => {
      const updateResult = await updateInstallationChecklist({
        installationId: id,
        actor: verify.actor,
        items: payload.items ?? [],
      });
      return {
        status: 200,
        body: updateResult,
      };
    },
  });

  return NextResponse.json(idempotencyResult.body, { status: idempotencyResult.status });
}
