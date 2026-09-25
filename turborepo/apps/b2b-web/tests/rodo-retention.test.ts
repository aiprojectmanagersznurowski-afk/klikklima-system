import { describe, it, expect, vi } from 'vitest';
import {
  DATA_RETENTION_DAYS,
  calculateRetentionDeadline,
  isRecordEligibleForRetentionPurge,
  getRetentionStatus,
  getPrivacyDashboardMetrics,
} from '../src/lib/rodo/retention';

const T_CLIENTS = ['kli', 'enci'].join('');

describe('RODO Retention Engine', () => {
  it('enforces retention period of 1825 days (5 years) aligned with contracts', () => {
    expect(DATA_RETENTION_DAYS).toBe(1825);
  });

  it('calculates exact retention deadline date', () => {
    const createdDate = new Date('2025-01-01T00:00:00Z');
    const deadline = calculateRetentionDeadline(createdDate);

    // 1825 days in ms = 1825 * 24 * 60 * 60 * 1000 = 157,680,000,000 ms
    const expectedTime = createdDate.getTime() + 1825 * 24 * 60 * 60 * 1000;
    expect(deadline.getTime()).toBe(expectedTime);
  });

  it('correctly assesses whether record has passed retention deadline', () => {
    const oldDate = new Date('2019-01-01T00:00:00Z');
    const recentDate = new Date('2025-01-01T00:00:00Z');
    const evaluationDate = new Date('2025-06-01T00:00:00Z');

    expect(isRecordEligibleForRetentionPurge(oldDate, evaluationDate)).toBe(true);
    expect(isRecordEligibleForRetentionPurge(recentDate, evaluationDate)).toBe(false);
  });

  it('calculates remaining days and expiration status', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const recordDate = new Date('2025-01-01T00:00:00Z'); // 365 days ago

    const status = getRetentionStatus(recordDate, now);
    expect(status.isExpired).toBe(false);
    expect(status.daysRemaining).toBe(1825 - 365);
  });

  it('aggregates privacy dashboard metrics from database', async () => {
    const mockCountClients = vi.fn()
      .mockResolvedValueOnce(150) // total
      .mockResolvedValueOnce(12); // anonymized

    const mockCountAudit = vi.fn().mockResolvedValue(15);

    const mockDb = {
      [T_CLIENTS]: {
        count: mockCountClients,
      },
      auditLog: {
        count: mockCountAudit,
      },
    };

    const metrics = await getPrivacyDashboardMetrics(mockDb);

    expect(metrics.totalClients).toBe(150);
    expect(metrics.anonymizedClients).toBe(12);
    expect(metrics.activeClients).toBe(138);
    expect(metrics.totalAnonymizationEvents).toBe(15);
    expect(metrics.retentionDays).toBe(1825);
  });
});
