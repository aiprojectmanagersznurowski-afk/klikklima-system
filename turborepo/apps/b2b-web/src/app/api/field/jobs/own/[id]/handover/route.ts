import { NextResponse } from 'next/server';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../../../lib/field-api/actor';
import { recordAccessDenied } from '../../../../../../../lib/field-api/security-event';
import { executeWithIdempotency } from '../../../../../../../lib/field-api/idempotency';
import {
  submitHandoverProtocol,
  type HandoverProtocolInput,
} from '../../../../../../../lib/domain/install-path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/field/jobs/own/[id]/handover
 * Zapisuje protokół zdawczo-odbiorczy montażu (FLD-HANDOVER-PROTOCOL).
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
      endpoint: `/api/field/jobs/own/${id}/handover`,
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do sporządzenia protokołu odbioru instalacji' },
      { status: 403 }
    );
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Wymagany jest nagłówek Idempotency-Key dla protokołu odbioru' },
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

  const payload = body as Partial<HandoverProtocolInput>;

  if (
    typeof payload?.nitrogen_test_bar !== 'number' ||
    payload.nitrogen_test_bar <= 0 ||
    typeof payload?.vacuum_test_mbar !== 'number' ||
    payload.vacuum_test_mbar <= 0 ||
    typeof payload?.test_duration_min !== 'number' ||
    payload.test_duration_min <= 0
  ) {
    return NextResponse.json(
      { success: false, error: 'Parametry prób ciśnienia i próżni muszą być dodatnimi liczbami' },
      { status: 400 }
    );
  }

  if (payload?.client_trained !== true) {
    return NextResponse.json(
      { success: false, error: 'Wymagane jest potwierdzenie, że przeprowadzono instruktaż klienta' },
      { status: 400 }
    );
  }

  if (
    !payload?.outdoor_unit ||
    typeof payload.outdoor_unit.serial_number !== 'string' ||
    payload.outdoor_unit.serial_number.trim().length < 3
  ) {
    return NextResponse.json(
      { success: false, error: 'Wymagany jest poprawny numer seryjny jednostki zewnętrznej' },
      { status: 400 }
    );
  }

  const idempotencyResult = await executeWithIdempotency({
    idempotencyKey,
    actorEmail: verify.actor.email,
    endpoint: `/api/field/jobs/own/${id}/handover`,
    body: payload,
    operation: async () => {
      const submitResult = await submitHandoverProtocol({
        installationId: id,
        actor: verify.actor,
        protocol: payload as HandoverProtocolInput,
      });

      if (!submitResult.success) {
        return {
          status: 400,
          body: { success: false, error: submitResult.error },
        };
      }

      return {
        status: 200,
        body: submitResult,
      };
    },
  });

  return NextResponse.json(idempotencyResult.body, { status: idempotencyResult.status });
}
