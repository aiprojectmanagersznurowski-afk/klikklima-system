import { createHash } from 'node:crypto';
import { prisma } from '@repo/database';
import type { IdempotencyParams } from './types';

/**
 * hashRequestBody — Oblicza deterministyczny hash SHA-256 z ciała żądania.
 * Sortuje klucze obiektów, aby permutacja kolejności pól w JSON nie wpływała na hash.
 */
export function hashRequestBody(body: unknown): string {
  if (body === undefined || body === null) {
    return createHash('sha256').update('').digest('hex');
  }

  function canonicalize(val: unknown): unknown {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(canonicalize);
    }
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((val as Record<string, unknown>)[key]);
    }
    return result;
  }

  const normalizedJson = JSON.stringify(canonicalize(body));
  return createHash('sha256').update(normalizedJson).digest('hex');
}

export interface IdempotencyResult {
  status: number;
  body: unknown;
}

/**
 * executeWithIdempotency — Obsługuje atomowe egzekwowanie klucza idempotencji
 * w centralnym rejestrze `field_request_idempotency` (FLD-API-IDEMPOTENCY-REGISTRY).
 */
export async function executeWithIdempotency(params: IdempotencyParams): Promise<IdempotencyResult> {
  const { idempotencyKey, actorEmail, endpoint, body, operation } = params;

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Wymagany jest nagłówek Idempotency-Key dla operacji zapisu',
      },
    };
  }

  const requestHash = hashRequestBody(body);

  // 1. Sprawdzenie, czy klucz już istnieje w rejestrze
  const existing = await prisma.fieldRequestIdempotency.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    if (existing.requestHash === requestHash) {
      // Replay z tą samą treścią żądania -> oddajemy zapisaną odpowiedź
      return {
        status: 200,
        body: existing.responseBody,
      };
    } else {
      // Ten sam klucz z inną treścią -> błąd konfliktu 409
      return {
        status: 409,
        body: {
          success: false,
          error: 'Konflikt klucza idempotencji: podano inną treść żądania dla użytego wcześniej klucza',
        },
      };
    }
  }

  // 2. Nowe wykonanie w transakcji bazy danych
  return (await prisma.$transaction(async (tx) => {
    // Rejestracja klucza jako pierwszy krok transakcji
    await tx.fieldRequestIdempotency.create({
      data: {
        idempotencyKey,
        actorEmail,
        endpoint,
        requestHash,
      },
    });

    // Wykonanie operacji domenowej
    const result = await operation(tx);

    // Zapisanie odpowiedzi w rejestrze
    await tx.fieldRequestIdempotency.update({
      where: { idempotencyKey },
      data: {
        responseBody: result.body as object,
      },
    });

    return result;
  })) as IdempotencyResult;
}
