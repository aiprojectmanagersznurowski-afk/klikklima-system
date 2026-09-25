import { prisma } from '@repo/database';
import type { SecurityEventParams } from './types';

/**
 * recordAccessDenied — Zapisuje fakt odmowy dostępu uwierzytelnionemu aktorowi
 * w dedykowanym dzienniku `security_events` (zgodnie z SEC-ACCESS-DENIED-LOG i ADR-013).
 *
 * Ważne założenia architektoniczne:
 * - Ślad NIE trafia do `audit_log` (dziennik RODO nie zawiera atrap)
 * - Odmowy dla ruchu anonimowego (brak e-maila) są pomijane, aby zapobiec atakom Denial of Service / zapełnieniu dysku
 * - Awaria zapisu do `security_events` jest bezpiecznie logowana i NIGDY nie rzuca błędu ani nie odwraca odmowy
 */
export async function recordAccessDenied(params: SecurityEventParams): Promise<void> {
  const { actorEmail, actorRole, resource, attemptedCapability, endpoint } = params;

  // Granica bezpieczeństwa: rejestrujemy wyłącznie odmowy dla uwierzytelnionego aktora
  if (!actorEmail || !actorRole) {
    return;
  }

  try {
    await prisma.securityEvent.create({
      data: {
        actorEmail,
        actorRole,
        resource,
        attemptedCapability,
        endpoint,
        decision: 'DENIED',
      },
    });
  } catch (error) {
    console.error('Błąd podczas zapisywania zdarzenia bezpieczeństwa w security_events:', error);
  }
}
