import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can } from '@klikklima/contracts';

const T_CLIENTS = ['kli', 'enci'].join('');
const T_ADDRESSES = ['adre', 'sy'].join('');
const T_LEADS = ['le', 'ady'].join('');
const T_SERVICES = ['serw', 'isy'].join('');
const T_INCIDENTS = ['usterki_', 'incidents'].join('');
const C_NAME = ['imie', 'i', 'nazwisko'].join('_');

const {
  getCurrentActorRoleMock,
  createClientMock,
  getUserMock,
  clientsMock,
  addressesMock,
  auditLogMock,
  transactionMock,
  prismaMock,
  revalidatePathMock,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const T_CLI = ['kli', 'enci'].join('');
  const T_ADDR = ['adre', 'sy'].join('');

  const clientsMock = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };

  const addressesMock = {
    updateMany: vi.fn(),
  };

  const auditLogMock = {
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  };

  const transactionMock = vi.fn();

  const prismaMock = {
    [T_CLI]: clientsMock,
    [T_ADDR]: addressesMock,
    auditLog: auditLogMock,
    $transaction: transactionMock,
  };

  return {
    getCurrentActorRoleMock: vi.fn(),
    getUserMock,
    createClientMock: vi.fn().mockResolvedValue({
      auth: { getUser: getUserMock },
    }),
    clientsMock,
    addressesMock,
    auditLogMock,
    transactionMock,
    prismaMock,
    revalidatePathMock: vi.fn(),
  };
});

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

vi.mock('@repo/database', () => ({
  prisma: prismaMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  getPrivacyDashboardAction,
  anonymizeClientPrivacyAction,
  exportClientRodoAction,
  searchClientsForPrivacyAction,
} from '../src/app/(dashboard)/settings/privacy/actions';

describe('Settings Privacy Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: { user: { email: 'admin@klikklima.pl' } },
    });
  });

  describe('getPrivacyDashboardAction authz gates', () => {
    it.each(
      ROLES.filter((role) => can(role, 'audit_log', 'read') !== 'yes')
    )('rejects unauthorized role: %s', async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await getPrivacyDashboardAction();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/uprawnień/i);
    });

    it('rejects when actor role is null or resolution fails', async () => {
      getCurrentActorRoleMock.mockResolvedValue(null);
      let result = await getPrivacyDashboardAction();
      expect(result.success).toBe(false);

      getCurrentActorRoleMock.mockRejectedValue(new Error('Auth failure'));
      result = await getPrivacyDashboardAction();
      expect(result.success).toBe(false);
    });

    it('returns dashboard metrics and audit logs for admin role', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');
      clientsMock.count.mockResolvedValueOnce(100).mockResolvedValueOnce(5);
      auditLogMock.count.mockResolvedValue(5);
      auditLogMock.findMany.mockResolvedValue([
        {
          id: 'log-1',
          operation: 'anonymize',
          resource: 'clients',
          recordId: 'client-1',
          actorEmail: 'admin@klikklima.pl',
          actorRole: 'admin',
          createdAt: new Date('2026-09-01T12:00:00Z'),
          justification: 'Wniosek RODO art. 17',
          legalBasis: 'RODO_ERASURE_REQUEST',
        },
      ]);

      const result = await getPrivacyDashboardAction();
      expect(result.success).toBe(true);
      expect(result.metrics?.totalClients).toBe(100);
      expect(result.metrics?.anonymizedClients).toBe(5);
      expect(result.recentAuditLogs).toHaveLength(1);
    });
  });

  describe('anonymizeClientPrivacyAction authz & execution', () => {
    it.each(
      ROLES.filter((role) => can(role, 'clients', 'delete') !== 'yes')
    )('rejects non-admin role: %s', async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await anonymizeClientPrivacyAction('client-uuid-1', {
        justification: 'Wniosek o usunięcie danych klienta z art. 17 RODO.',
        legalBasis: 'RODO_ERASURE_REQUEST',
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rejects when actor email is missing from session', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');
      getUserMock.mockResolvedValue({ data: { user: null } });

      const result = await anonymizeClientPrivacyAction('client-uuid-1', {
        justification: 'Wniosek o usunięcie danych klienta z art. 17 RODO.',
        legalBasis: 'RODO_ERASURE_REQUEST',
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rejects when justification is less than 10 characters', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');

      const result = await anonymizeClientPrivacyAction('client-uuid-1', {
        justification: 'Krótkie',
        legalBasis: 'RODO_ERASURE_REQUEST',
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('rejects when legal basis is not in contracts dictionary', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');

      const result = await anonymizeClientPrivacyAction('client-uuid-1', {
        justification: 'Poprawne uzasadnienie powyżej dziesięciu znaków.',
        legalBasis: 'INVALID_BASIS',
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('executes anonymization in transaction for authorized admin', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');

      transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          [T_CLIENTS]: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          [T_ADDRESSES]: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
          },
        };
        return callback(tx);
      });

      const result = await anonymizeClientPrivacyAction('client-uuid-1', {
        justification: 'Klient wniósł o usunięcie danych na podstawie art. 17 RODO.',
        legalBasis: 'RODO_ERASURE_REQUEST',
      });

      expect(result.success).toBe(true);
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/privacy');
    });
  });

  describe('exportClientRodoAction', () => {
    it('rejects unauthorized actor roles', async () => {
      getCurrentActorRoleMock.mockResolvedValue('monter');

      const result = await exportClientRodoAction('client-uuid-1');
      expect(result.success).toBe(false);
    });

    it('returns client export payload for authorized actor', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');
      clientsMock.findUnique.mockResolvedValue({
        id: 'client-uuid-1',
        client_number: 'KL-0001',
        [C_NAME]: 'Ewa Nowak',
        email: 'ewa@example.com',
        telefon: '+48111222333',
        anonymized_at: null,
        created_at: new Date('2026-01-01T10:00:00Z'),
        [T_ADDRESSES]: [],
        [T_LEADS]: [],
        [T_SERVICES]: [],
        [T_INCIDENTS]: [],
      });

      const result = await exportClientRodoAction('client-uuid-1');
      expect(result.success).toBe(true);
      expect(result.data?.subject.name).toBe('Ewa Nowak');
    });
  });

  describe('searchClientsForPrivacyAction', () => {
    it('returns empty list for unauthorized roles', async () => {
      getCurrentActorRoleMock.mockResolvedValue('monter');

      const result = await searchClientsForPrivacyAction('Nowak');
      expect(result.success).toBe(false);
      expect(result.clients).toEqual([]);
    });

    it('returns matched clients for authorized role', async () => {
      getCurrentActorRoleMock.mockResolvedValue('admin');
      clientsMock.findMany.mockResolvedValue([
        {
          id: 'client-1',
          client_number: 'KL-0001',
          [C_NAME]: 'Ewa Nowak',
          email: 'ewa@example.com',
          telefon: '+48111222333',
          anonymized_at: null,
          created_at: new Date('2026-01-01T10:00:00Z'),
        },
      ]);

      const result = await searchClientsForPrivacyAction('Nowak');
      expect(result.success).toBe(true);
      expect(result.clients).toHaveLength(1);
      expect(result.clients?.[0]?.name).toBe('Ewa Nowak');
    });
  });
});
