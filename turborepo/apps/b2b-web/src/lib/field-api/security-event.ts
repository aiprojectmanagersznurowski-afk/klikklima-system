import { prisma } from '@repo/database';
import { can, ROLES } from '@klikklima/contracts';
import type { Role } from '@klikklima/contracts';
import type { SecurityEventParams } from './types';

function isRole(role: unknown): role is Role {
  return typeof role === 'string' && (ROLES as readonly string[]).includes(role);
}

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

export interface GetSecurityEventsParams {
  actorRole: string | null | undefined;
  limit?: number;
  offset?: number;
}

export interface SecurityEventItem {
  id: string;
  actorEmail: string;
  actorRole: string;
  resource: string;
  attemptedCapability: string;
  decision: string;
  endpoint: string | null;
  occurredAt: Date;
}

export type GetSecurityEventsResult =
  | { success: true; data: SecurityEventItem[] }
  | { success: false; error: string };

/**
 * getSecurityEvents — Pobiera wpisy z dziennika security_events.
 * Zgodnie z kryterium 6 SEC-ACCESS-DENIED-LOG oraz macierzą RBAC,
 * odczyt dziennika ma WYŁĄCZNIE administrator (can(actorRole, 'security_events', 'read') === 'yes').
 */
export async function getSecurityEvents(
  params: GetSecurityEventsParams
): Promise<GetSecurityEventsResult> {
  const { actorRole, limit = 50, offset = 0 } = params;

  if (!actorRole || !isRole(actorRole) || can(actorRole, 'security_events', 'read') !== 'yes') {
    return {
      success: false,
      error: 'Brak uprawnień do odczytu dziennika zdarzeń bezpieczeństwa (wymagana rola administratora).',
    };
  }

  try {
    const events = await prisma.securityEvent.findMany({
      take: limit,
      skip: offset,
      orderBy: { occurredAt: 'desc' },
    });
    return { success: true, data: events };
  } catch (error) {
    console.error('Błąd podczas odczytu zdarzeń bezpieczeństwa z security_events:', error);
    return {
      success: false,
      error: 'Błąd bazy danych podczas odczytu zdarzeń bezpieczeństwa.',
    };
  }
}

