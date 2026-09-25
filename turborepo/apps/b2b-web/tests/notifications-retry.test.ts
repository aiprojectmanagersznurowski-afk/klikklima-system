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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    expect(mockPrisma.notificationQueue.updateMany).toHaveBeenCalledTimes(1);
    expect(updated.status).toBe("PENDING");
    expect(updated.deadLetteredAt).toBeNull();
  });

  // @REQ: NTF-RETRY
  it("ponowienie wiersza, który NIE jest w DEAD_LETTER (np. już SENT), jest odmawiane bez żadnej zmiany w bazie", async () => {
    // Odmowa jest dostrzegalna WYŁĄCZNIE przez to, co poszło do bazy: przejęcie
    // musi iść przez updateMany z warunkiem na POPRZEDNIM statusie (analogicznie
    // do NTF-QUEUE-CLAIM w dispatcherze) — „sprawdzenie w JS, czy rekord jest
    // SENT" nie wystarcza, bo klient serwer-akcji może podać dowolne
    // notificationId niezależnie od tego, co faktycznie widzi w bazie.
    const updateManyMock = vi.fn().mockResolvedValue({ count: 0 });
    const mockPrisma = {
      notificationQueue: {
        updateMany: updateManyMock,
        create: vi.fn(),
      },
    };

    const sentRecordId = "ntf-already-sent-1";

    await expect(retryNotificationRecord(mockPrisma as never, sentRecordId)).rejects.toThrow();

    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const [args] = updateManyMock.mock.calls[0];
    expect(args.where).toMatchObject({ id: sentRecordId, status: "DEAD_LETTER" });
    expect(mockPrisma.notificationQueue.create).not.toHaveBeenCalled();
  });

  // @REQ: NTF-RETRY
  it("dwa równoległe ponowienia tego samego rekordu skutkują JEDNĄ faktyczną zmianą (count sumaryczny === 1)", async () => {
    // Baza-atrapa ze stanem: pierwsze updateMany, które trafia na DEAD_LETTER,
    // przełącza rekord na PENDING i zwraca count: 1; drugie trafia na rekord
    // już zmieniony (nie jest już DEAD_LETTER) i zwraca count: 0. Suma zwróconych
    // count-ów jest jedynym wiarygodnym dowodem „jedna operacja wygrała" —
    // liczenie samych WYWOŁAŃ update (jak w poprzedniej wersji tego testu)
    // nie odróżnia bezwarunkowego update od atomowego przejęcia.
    let currentStatus: string = "DEAD_LETTER";
    let totalAppliedCount = 0;

    const updateManyMock = vi.fn().mockImplementation(async ({ where }: { where: { status?: string } }) => {
      if (where.status && where.status !== currentStatus) {
        return { count: 0 };
      }
      currentStatus = "PENDING";
      totalAppliedCount += 1;
      return { count: 1 };
    });

    const mockPrisma = {
      notificationQueue: {
        updateMany: updateManyMock,
        create: vi.fn(),
      },
    };

    const [res1, res2] = await Promise.allSettled([
      retryNotificationRecord(mockPrisma as never, "ntf-concurrency-1"),
      retryNotificationRecord(mockPrisma as never, "ntf-concurrency-1"),
    ]);

    expect(mockPrisma.notificationQueue.create).not.toHaveBeenCalled();
    expect(totalAppliedCount).toBe(1);

    // Dokładnie jeden z dwóch woływanych zwraca sukces (PENDING), drugi jest
    // odmową — nigdy oba jako sukces.
    const successCount = [res1, res2].filter(
      (r) => r.status === "fulfilled" && r.value.status === "PENDING",
    ).length;
    expect(successCount).toBe(1);
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
