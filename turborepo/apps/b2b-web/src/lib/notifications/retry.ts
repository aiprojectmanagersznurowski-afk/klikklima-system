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

export interface RetryOutcome {
  id: string;
  status: "PENDING";
  deadLetteredAt: null;
  lastError: null;
  nextAttemptAt: Date;
}

/// Odrzucenie ponowienia wiersza, który NIE jest (już) w DEAD_LETTER — błąd DOMENOWY
/// (CLAUDE.md: błędy domenowe jako wynik, nie wyjątek 500), łapany przez wołający
/// Server Action i zwracany użytkownikowi jako komunikat.
export class RetryNotAllowedError extends Error {
  constructor(notificationQueueId: string) {
    super(
      `Ponowienie odrzucone: wiersz ${notificationQueueId} nie jest w statusie DEAD_LETTER (albo nie istnieje) — mógł już zostać ponowiony przez inny proces.`
    );
    this.name = "RetryNotAllowedError";
  }
}

export async function retryNotificationRecord(
  prisma: {
    notificationQueue: {
      updateMany: (args: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => Promise<{ count: number }>;
    };
  },
  notificationQueueId: string,
  now: Date = new Date()
): Promise<RetryOutcome> {
  // Przejęcie jest ATOMOWE (analogicznie do NTF-QUEUE-CLAIM w dispatcherze):
  // updateMany z warunkiem na POPRZEDNIM statusie (DEAD_LETTER). Sprawdzenie w JS
  // "czy rekord jest DEAD_LETTER" nie wystarcza — dwa równoległe ponowienia tego
  // samego wiersza muszą skutkować JEDNĄ faktyczną zmianą, rozstrzygniętą w bazie.
  const claim = await prisma.notificationQueue.updateMany({
    where: { id: notificationQueueId, status: "DEAD_LETTER" },
    data: {
      status: "PENDING",
      deadLetteredAt: null,
      lastError: null,
      nextAttemptAt: now,
    },
  });

  if (claim.count !== 1) {
    throw new RetryNotAllowedError(notificationQueueId);
  }

  return {
    id: notificationQueueId,
    status: "PENDING",
    deadLetteredAt: null,
    lastError: null,
    nextAttemptAt: now,
  };
}
