import { QUEUE_POLICY } from "@klikklima/contracts";
import { getNextWindowStart, isWithinSendWindow } from "./window";

export interface NotificationQueueRecord {
  id: string;
  channel: string;
  attempts: number;
  status: string;
  lastError?: string | null;
  nextAttemptAt?: Date | null;
  deadLetteredAt?: Date | null;
  idempotencyKey?: string;
}

export interface FailureUpdateResult {
  status: "PENDING" | "DEAD_LETTER";
  attempts: number;
  lastError: string;
  nextAttemptAt: Date | null;
  deadLetteredAt: Date | null;
}

export function calculateBackoffSeconds(attempts: number): number {
  const baseSeconds = QUEUE_POLICY.backoffBaseSeconds;
  const factor = Math.pow(2, Math.max(0, attempts - 1));
  return baseSeconds * factor;
}

export function calculateNextAttemptAt(
  channel: string,
  attempts: number,
  baseDate: Date = new Date()
): Date {
  const backoffSec = calculateBackoffSeconds(attempts);
  const plannedTime = new Date(baseDate.getTime() + backoffSec * 1000);

  if (isWithinSendWindow(channel, plannedTime)) {
    return plannedTime;
  }

  return getNextWindowStart(channel, plannedTime);
}

export function recordNotificationFailure(
  record: NotificationQueueRecord,
  errorMsg: string,
  now: Date = new Date()
): FailureUpdateResult {
  const nextAttempts = record.attempts + 1;

  if (nextAttempts >= QUEUE_POLICY.deadLetterAfterAttempts) {
    return {
      status: "DEAD_LETTER",
      attempts: nextAttempts,
      lastError: errorMsg,
      nextAttemptAt: null,
      deadLetteredAt: now,
    };
  }

  const nextAttemptAt = calculateNextAttemptAt(record.channel, nextAttempts, now);

  return {
    status: "PENDING",
    attempts: nextAttempts,
    lastError: errorMsg,
    nextAttemptAt,
    deadLetteredAt: null,
  };
}

export async function retryNotificationRecord(
  prisma: {
    notificationQueue: {
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<NotificationQueueRecord>;
    };
  },
  notificationQueueId: string,
  now: Date = new Date()
): Promise<NotificationQueueRecord> {
  return await prisma.notificationQueue.update({
    where: { id: notificationQueueId },
    data: {
      status: "PENDING",
      deadLetteredAt: null,
      lastError: null,
      nextAttemptAt: now,
    },
  });
}
