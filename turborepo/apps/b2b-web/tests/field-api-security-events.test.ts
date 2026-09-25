import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAccessDenied } from '../src/lib/field-api/security-event';

// @REQ: SEC-ACCESS-DENIED-LOG
// Testy rejestrowania odmów dostępu uwierzytelnionych aktorów w security_events

const mockCreateSecurityEvent = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock('@repo/database', () => ({
  prisma: {
    securityEvent: {
      create: (...args: unknown[]) => mockCreateSecurityEvent(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockCreateAuditLog(...args),
    },
  },
}));

describe('SEC-ACCESS-DENIED-LOG: recordAccessDenied', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('odmowa dostępu dla uwierzytelnionego aktora zapisuje zdarzenie w security_events', async () => {
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
    // Ślad NIE trafia do audit_log
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it('żądanie bez uwierzytelnienia (brak e-maila) NIE zapisuje rekordu w security_events (ochrona przed DoS)', async () => {
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

  it('awaria zapisu do security_events nie wywraca działania systemu ani nie rzuca wyjątkiem', async () => {
    mockCreateSecurityEvent.mockRejectedValueOnce(new Error('Baza tymczasowo niedostępna'));

    // Nie powinno rzucić wyjątkiem
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
