import { AUDIT_REQUIREMENTS } from '@klikklima/contracts';
import { prisma } from '@repo/database';
import type { PrivacyMetrics } from './types';

export const DATA_RETENTION_DAYS = AUDIT_REQUIREMENTS.retentionDays || 1825;

export function calculateRetentionDeadline(createdAt: Date): Date {
  const retentionMs = DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(createdAt.getTime() + retentionMs);
}

export function isRecordEligibleForRetentionPurge(createdAt: Date, now: Date = new Date()): boolean {
  const deadline = calculateRetentionDeadline(createdAt);
  return now.getTime() >= deadline.getTime();
}

export function getRetentionStatus(
  createdAt: Date,
  now: Date = new Date()
): { daysRemaining: number; isExpired: boolean; deadline: Date } {
  const deadline = calculateRetentionDeadline(createdAt);
  const diffMs = deadline.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  const isExpired = diffMs <= 0;

  return {
    daysRemaining,
    isExpired,
    deadline,
  };
}

export async function getPrivacyDashboardMetrics(dbClient?: unknown): Promise<PrivacyMetrics> {
  const db = (dbClient || prisma) as {
    klienci: {
      count: (args?: { where?: Record<string, unknown> }) => Promise<number>;
    };
    auditLog: {
      count: (args?: { where?: Record<string, unknown> }) => Promise<number>;
    };
  };

  const [totalClients, anonymizedClients, totalAnonymizationEvents] = await Promise.all([
    db.klienci.count(),
    db.klienci.count({ where: { anonymized_at: { not: null } } }),
    db.auditLog.count({ where: { operation: 'anonymize' } }),
  ]);

  const activeClients = Math.max(0, totalClients - anonymizedClients);

  return {
    totalClients,
    anonymizedClients,
    activeClients,
    totalAnonymizationEvents,
    retentionDays: DATA_RETENTION_DAYS,
  };
}
