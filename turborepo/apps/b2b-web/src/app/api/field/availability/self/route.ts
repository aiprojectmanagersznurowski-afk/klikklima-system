import { NextResponse } from 'next/server';
import { z } from 'zod';
import { can } from '@klikklima/contracts';
import { verifyFieldActor } from '../../../../../lib/field-api/actor';
import { executeWithIdempotency } from '../../../../../lib/field-api/idempotency';
import { recordAccessDenied } from '../../../../../lib/field-api/security-event';
import {
  executeSetSelfAvailability,
  executeGetEffectiveAvailability,
} from '../../../../../lib/domain/availability';

const selfAvailabilitySchema = z.object({
  isAvailable: z.boolean({
    required_error: 'Pole isAvailable jest wymagane',
    invalid_type_error: 'Pole isAvailable musi być typu boolean',
  }),
});

/**
 * GET /api/field/availability/self
 * Odczyt efektywnej dostępności zalogowanego pracownika terenowego (audytor / monter).
 */
export async function GET(request: Request): Promise<Response> {
  const verify = await verifyFieldActor(request);
  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  const access = can(verify.actor.role, 'availability_rules', 'read');
  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource: 'availability_rules',
      attemptedCapability: 'read',
      endpoint: '/api/field/availability/self',
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do odczytu dostępności' },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const options = {
    from: fromParam ? new Date(fromParam) : undefined,
    to: toParam ? new Date(toParam) : undefined,
  };

  const result = await executeGetEffectiveAvailability(verify.actor, options);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 403 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}

/**
 * POST /api/field/availability/self
 * Zapis deklaracji dostępności pracownika terenowego z ochroną idempotencji (FLD-API-LAYER).
 */
export async function POST(request: Request): Promise<Response> {
  const verify = await verifyFieldActor(request);
  if (!verify.success) {
    return NextResponse.json(
      { success: false, error: verify.error },
      { status: verify.status }
    );
  }

  // Weryfikacja zdolności w macierzy RBAC
  const access = can(verify.actor.role, 'availability_declarations', 'update');
  if (access !== 'own' && access !== 'yes') {
    await recordAccessDenied({
      actorEmail: verify.actor.email,
      actorRole: verify.actor.role,
      resource: 'availability_declarations',
      attemptedCapability: 'update',
      endpoint: '/api/field/availability/self',
    });
    return NextResponse.json(
      { success: false, error: 'Brak uprawnień do zmiany dostępności' },
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

  const parsed = selfAvailabilitySchema.safeParse(rawBody);
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
    endpoint: '/api/field/availability/self',
    body: parsed.data,
    operation: async (tx) => {
      const domainResult = await executeSetSelfAvailability(
        verify.actor,
        parsed.data.isAvailable,
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
