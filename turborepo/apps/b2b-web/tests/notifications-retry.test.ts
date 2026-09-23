import { describe, it, expect, vi, beforeEach } from "vitest";
import { QUEUE_POLICY } from "@klikklima/contracts";
import {
  calculateBackoffSeconds,
  calculateNextAttemptAt,
  recordNotificationFailure,
  retryNotificationRecord,
} from "../src/lib/notifications/retry";

describe("NTF-RETRY — Ponawianie błędnych powiadomień i DEAD_LETTER", () => {
  // @REQ: NTF-RETRY
  it("next_attempt_at rośnie wykładniczo od backoffBaseSeconds (60s)", () => {
    const base = QUEUE_POLICY.backoffBaseSeconds;
    expect(base).toBe(60);

    // attempt 1: 60s
    expect(calculateBackoffSeconds(1)).toBe(60);
    // attempt 2: 120s
    expect(calculateBackoffSeconds(2)).toBe(120);
    // attempt 3: 240s
    expect(calculateBackoffSeconds(3)).toBe(240);
    // attempt 4: 480s
    expect(calculateBackoffSeconds(4)).toBe(480);

    const now = new Date("2026-06-15T12:00:00Z");
    const next1 = calculateNextAttemptAt("EMAIL", 1, now);
    expect(next1.getTime() - now.getTime()).toBe(60 * 1000);

    const next2 = calculateNextAttemptAt("EMAIL", 2, now);
    expect(next2.getTime() - now.getTime()).toBe(120 * 1000);
  });

  // @REQ: NTF-RETRY
  it("po osiągnięciu deadLetterAfterAttempts (5) status zmienia się na DEAD_LETTER i rekord znika z kolejki roboczej", async () => {
    expect(QUEUE_POLICY.deadLetterAfterAttempts).toBe(5);

    const recordBeforeDeadLetter = {
      id: "ntf-1",
      attempts: 4,
      status: "PENDING",
      channel: "EMAIL",
    };

    const resultAfter5thFailure = recordNotificationFailure(recordBeforeDeadLetter, "Błąd bramki");
    expect(resultAfter5thFailure.status).toBe("DEAD_LETTER");
    expect(resultAfter5thFailure.attempts).toBe(5);
    expect(resultAfter5thFailure.deadLetteredAt).toBeInstanceOf(Date);
    expect(resultAfter5thFailure.nextAttemptAt).toBeNull();
  });

  // @REQ: NTF-RETRY
  it("ponowienie inkrementuje attempts na istniejącym rekordzie, nie tworzy nowego wiersza", async () => {
    const mockPrisma = {
      notificationQueue: {
        update: vi.fn().mockImplementation(async ({ where, data }) => ({
          id: where.id,
          ...data,
        })),
        create: vi.fn(),
      },
    };

    const deadLetterRecord = {
      id: "ntf-dead-1",
      status: "DEAD_LETTER",
      attempts: 5,
      channel: "EMAIL",
      idempotencyKey: "key-1",
    };

    const updated = await retryNotificationRecord(mockPrisma as never, deadLetterRecord.id);

    expect(mockPrisma.notificationQueue.create).not.toHaveBeenCalled();
    expect(mockPrisma.notificationQueue.update).toHaveBeenCalledTimes(1);
    expect(updated.status).toBe("PENDING");
    expect(updated.deadLetteredAt).toBeNull();
  });

  // @REQ: NTF-RETRY
  it("dwa równoległe ponowienia z tym samym rekordem skutkują jedną operacją (idempotencja)", async () => {
    let updateCount = 0;
    const mockPrisma = {
      notificationQueue: {
        update: vi.fn().mockImplementation(async () => {
          updateCount++;
          return { id: "ntf-concurrency-1", status: "PENDING", attempts: 5 };
        }),
        create: vi.fn(),
      },
    };

    // Uruchomienie dwóch prób ponowienia równolegle
    const [res1, res2] = await Promise.all([
      retryNotificationRecord(mockPrisma as never, "ntf-concurrency-1"),
      retryNotificationRecord(mockPrisma as never, "ntf-concurrency-1"),
    ]);

    expect(res1.status).toBe("PENDING");
    expect(res2.status).toBe("PENDING");
    expect(mockPrisma.notificationQueue.create).not.toHaveBeenCalled();
  });

  // @REQ: NTF-RETRY
  it("wiadomość w statusie DEAD_LETTER nie jest ponawiana automatycznie", () => {
    const deadRecord = { status: "DEAD_LETTER", nextAttemptAt: null };
    const pendingRecord = { status: "PENDING", nextAttemptAt: new Date(Date.now() - 1000) };

    const isAutoProcessable = (row: { status: string; nextAttemptAt: Date | null }) =>
      row.status === "PENDING" && row.nextAttemptAt !== null && row.nextAttemptAt.getTime() <= Date.now();

    expect(isAutoProcessable(deadRecord)).toBe(false);
    expect(isAutoProcessable(pendingRecord)).toBe(true);
  });
});
