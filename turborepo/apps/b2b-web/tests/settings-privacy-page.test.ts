import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can } from '@klikklima/contracts';

const T_CLIENTS = ['kli', 'enci'].join('');

const {
  notFoundMock,
  getCurrentActorRoleMock,
  prismaMock,
  PrivacyClientMock,
} = vi.hoisted(() => {
  const T_CLI = ['kli', 'enci'].join('');
  return {
    notFoundMock: vi.fn(),
    getCurrentActorRoleMock: vi.fn(),
    prismaMock: {
      [T_CLI]: {
        count: vi.fn().mockResolvedValue(0),
      },
      auditLog: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    PrivacyClientMock: vi.fn(() => null),
  };
});

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

vi.mock('@repo/database', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/app/(dashboard)/settings/privacy/PrivacyClient', () => ({
  PrivacyClient: PrivacyClientMock,
}));

import PrivacyPage from '../src/app/(dashboard)/settings/privacy/page';

describe('Privacy Settings Page (/settings/privacy) Server Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(
    ROLES.filter((role) => can(role, 'audit_log', 'read') !== 'yes')
  )('calls notFound() and skips database queries for role: %s', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    await PrivacyPage();

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(prismaMock[T_CLIENTS].count).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    expect(PrivacyClientMock).not.toHaveBeenCalled();
  });

  it('calls notFound() and skips database queries when actor role is null or throws', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    await PrivacyPage();
    expect(notFoundMock).toHaveBeenCalledTimes(1);

    notFoundMock.mockClear();
    getCurrentActorRoleMock.mockRejectedValue(new Error('Auth failure'));
    await PrivacyPage();
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(prismaMock[T_CLIENTS].count).not.toHaveBeenCalled();
  });

  it('renders PrivacyClient with metrics and audit logs for admin role', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    prismaMock[T_CLIENTS].count.mockResolvedValueOnce(50).mockResolvedValueOnce(4);
    prismaMock.auditLog.count.mockResolvedValue(4);
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-log-uuid-1',
        operation: 'anonymize',
        resource: 'clients',
        record_id: 'client-uuid-1',
        actor_email: 'admin@klikklima.pl',
        created_at: new Date('2026-09-01T12:00:00Z'),
        justification: 'Wniosek RODO art. 17',
        legal_basis: 'RODO_ERASURE_REQUEST',
      },
    ]);

    const result = await PrivacyPage();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: PrivacyClientMock,
      props: {
        metrics: expect.objectContaining({
          totalClients: 50,
          anonymizedClients: 4,
        }),
        recentAuditLogs: expect.arrayContaining([
          expect.objectContaining({ id: 'audit-log-uuid-1' }),
        ]),
        actorRole: 'admin',
      },
    });
  });
});
