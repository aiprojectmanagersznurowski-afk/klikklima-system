import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIT_REQUIREMENTS, can, ROLES } from '@klikklima/contracts';
import { recordAccessDenied, getSecurityEvents } from '../src/lib/field-api/security-event';

// @REQ: SEC-ACCESS-DENIED-LOG
// Testy rejestrowania odmów dostępu uwierzytelnionych aktorów w security_events,
// nienaruszalności dziennika (append-only) oraz kontroli uprawnień (AC1 - AC6).

const mockCreateSecurityEvent = vi.fn();
const mockFindManySecurityEvents = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock('@repo/database', () => ({
  prisma: {
    securityEvent: {
      create: (...args: unknown[]) => mockCreateSecurityEvent(...args),
      findMany: (...args: unknown[]) => mockFindManySecurityEvents(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockCreateAuditLog(...args),
    },
  },
}));

function readMigration(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const migrationPath = join(
    currentDir,
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20260926091000_security_events.sql'
  );
  return readFileSync(migrationPath, 'utf-8');
}

describe('SEC-ACCESS-DENIED-LOG: Dziennik odmów dostępu security_events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Kolumny opisujące fakt odmowy (bez atrap z audit_log)', () => {
    // @REQ: SEC-ACCESS-DENIED-LOG
    it('odmowa dostępu dla uwierzytelnionego aktora zapisuje zdarzenie z kompletem kolumn faktu odmowy', async () => {
      mockCreateSecurityEvent.mockResolvedValueOnce({ id: 'sec-event-1' });

      await recordAccessDenied({
        actorEmail: 'auditor@klikklima.pl',
        actorRole: 'audytor',
        resource: 'installations',
        attemptedCapability: 'delete',
        endpoint: '/api/field/installations/inst-1',
      });

      expect(mockCreateSecurityEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateSecurityEvent).toHaveBeenCalledWith({
        data: {
          actorEmail: 'auditor@klikklima.pl',
          actorRole: 'audytor',
          resource: 'installations',
          attemptedCapability: 'delete',
          endpoint: '/api/field/installations/inst-1',
          decision: 'DENIED',
        },
      });
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('tabela security_events w migracji nie zawiera kolumn record_id, justification, legal_basis', () => {
      const sql = readMigration();

      // Kolumny, które MUSZĄ istnieć dla faktu odmowy
      expect(sql).toContain('actor_email');
      expect(sql).toContain('actor_role');
      expect(sql).toContain('resource');
      expect(sql).toContain('attempted_capability');
      expect(sql).toContain('decision');
      expect(sql).toContain('endpoint');
      expect(sql).toContain('occurred_at');

      // Kolumny RODO z audit_log, których odmowa NIE MA i nie powinna mieć atrap
      const tableDefMatch = sql.match(/CREATE TABLE IF NOT EXISTS public\.security_events \(([\s\S]*?)\);/);
      expect(tableDefMatch).not.toBeNull();
      const tableBody = tableDefMatch ? tableDefMatch[1] : '';

      expect(tableBody).not.toMatch(/\brecord_id\b/);
      expect(tableBody).not.toMatch(/\bjustification\b/);
      expect(tableBody).not.toMatch(/\blegal_basis\b/);
    });
  });

  describe('AC2: Ślad NIE trafia do audit_log i brak access_denied w mustLog', () => {
    // @REQ: SEC-ACCESS-DENIED-LOG
    it('odmowa dostępu nie wywołuje zapisu do audit_log', async () => {
      mockCreateSecurityEvent.mockResolvedValueOnce({ id: 'sec-event-2' });

      await recordAccessDenied({
        actorEmail: 'monter@klikklima.pl',
        actorRole: 'monter',
        resource: 'services',
        attemptedCapability: 'delete',
        endpoint: '/api/field/services/srv-1',
      });

      expect(mockCreateSecurityEvent).toHaveBeenCalledTimes(1);
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('access_denied NIE JEST wartością w AUDIT_REQUIREMENTS.mustLog', () => {
      const mustLogList = AUDIT_REQUIREMENTS.mustLog as readonly string[];
      expect(mustLogList).not.toContain('access_denied');
    });
  });

  describe('AC3: Mechanizm APPEND-ONLY wymuszony wyzwalaczem w bazie', () => {
    // @REQ: SEC-ACCESS-DENIED-LOG
    it('migracja zawiera funkcję security_events_append_only() z kodem błędu restrict_violation', () => {
      const sql = readMigration();
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.security_events_append_only()');
      expect(sql).toContain("USING ERRCODE = 'restrict_violation'");
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('migracja zawiera trigger security_events_append_only_trg na BEFORE UPDATE OR DELETE', () => {
      const sql = readMigration();
      expect(sql).toContain('CREATE TRIGGER security_events_append_only_trg');
      expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.security_events');
      expect(sql).toContain('EXECUTE FUNCTION public.security_events_append_only();');
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('migracja włącza ROW LEVEL SECURITY i nie definiuje polityk UPDATE/DELETE/ALL', () => {
      const sql = readMigration();
      expect(sql).toContain('ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;');

      const policyChunks = sql.split('CREATE POLICY').slice(1);
      const forbiddenPolicies = policyChunks.filter((chunk) => {
        const header = chunk.split('\n\n')[0] ?? chunk.slice(0, 200);
        return (
          (/FOR UPDATE/.test(header) || /FOR DELETE/.test(header) || /FOR ALL/.test(header)) &&
          /ON public\.security_events\b/.test(header)
        );
      });
      expect(forbiddenPolicies).toEqual([]);
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('w kontrakcie RBAC żadna rola (w tym admin) nie posiada uprawnień update ani delete na security_events', () => {
      for (const role of ROLES) {
        expect(can(role, 'security_events', 'update')).toBe('no');
        expect(can(role, 'security_events', 'delete')).toBe('no');
      }
    });
  });

  describe('AC4: Granica anty-DoS (ruch anonimowy ignorowany)', () => {
    // @REQ: SEC-ACCESS-DENIED-LOG
    it('pojedyncze żądanie bez uwierzytelnienia NIE tworzy rekordu w security_events', async () => {
      await recordAccessDenied({
        actorEmail: null,
        actorRole: null,
        resource: 'availability_declarations',
        attemptedCapability: 'update',
        endpoint: '/api/field/availability/self',
      });

      expect(mockCreateSecurityEvent).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('seria zapytań anonimowych generuje dokładnie 0 wierszy w security_events', async () => {
      const anonymousRequests = Array.from({ length: 10 }, (_, i) => ({
        actorEmail: null,
        actorRole: null,
        resource: 'pricing_tiers',
        attemptedCapability: 'read',
        endpoint: `/api/field/pricing-test-${i}`,
      }));

      for (const req of anonymousRequests) {
        await recordAccessDenied(req);
      }

      expect(mockCreateSecurityEvent).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('AC5: Fail-safe: awaria zapisu śladu nie wywraca operacji odmawiającej', () => {
    // @REQ: SEC-ACCESS-DENIED-LOG
    it('błąd bazy danych przy zapisie do security_events jest połykany i nie rzuca wyjątkiem', async () => {
      mockCreateSecurityEvent.mockRejectedValueOnce(new Error('Baza tymczasowo niedostępna (connection pool timeout)'));

      await expect(
        recordAccessDenied({
          actorEmail: 'monter@klikklima.pl',
          actorRole: 'monter',
          resource: 'quotes',
          attemptedCapability: 'read',
          endpoint: '/api/field/quotes',
        })
      ).resolves.not.toThrow();

      expect(mockCreateSecurityEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC6: Odczyt dziennika wyłącznie dla roli admin', () => {
    // @REQ: SEC-ACCESS-DENIED-LOG
    it('kontrakt RBAC zezwala na odczyt security_events wyłącznie roli admin', () => {
      expect(can('admin', 'security_events', 'read')).toBe('yes');

      const nonAdminRoles = ROLES.filter((r) => r !== 'admin');
      for (const role of nonAdminRoles) {
        expect(can(role, 'security_events', 'read')).toBe('no');
      }
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('getSecurityEvents zwraca dane, gdy aktorem jest administrator', async () => {
      const mockEvents = [
        {
          id: 'ev-1',
          actorEmail: 'audytor@klikklima.pl',
          actorRole: 'audytor',
          resource: 'installations',
          attemptedCapability: 'delete',
          decision: 'DENIED',
          endpoint: '/api/field/installations',
          occurredAt: new Date('2026-09-26T10:00:00Z'),
        },
      ];
      mockFindManySecurityEvents.mockResolvedValueOnce(mockEvents);

      const result = await getSecurityEvents({
        actorRole: 'admin',
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockEvents);
      }
      expect(mockFindManySecurityEvents).toHaveBeenCalledTimes(1);
      expect(mockFindManySecurityEvents).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        orderBy: { occurredAt: 'desc' },
      });
    });

    // @REQ: SEC-ACCESS-DENIED-LOG
    it('getSecurityEvents odmawia dostępu dla ról innych niż admin bez odpytywania bazy', async () => {
      const deniedRoles = ['dyspozytor', 'audytor', 'monter', 'klient', null, undefined];

      for (const role of deniedRoles) {
        const result = await getSecurityEvents({
          actorRole: role,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Brak uprawnień');
        }
      }

      expect(mockFindManySecurityEvents).not.toHaveBeenCalled();
    });
  });
});
