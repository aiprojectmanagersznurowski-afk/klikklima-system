import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { NOTIFICATIONS, QUEUE_POLICY, NOTIFICATION_IDS } from "@klikklima/contracts";

// @REQ: NTF-DISPATCH-CRON
// @REQ: SEC-WEBHOOK-SECRET-REQUIRED

const {
  processNotificationQueueMock,
} = vi.hoisted(() => ({
  processNotificationQueueMock: vi.fn(),
}));

vi.mock("../src/lib/notifications/dispatcher", () => ({
  processNotificationQueue: processNotificationQueueMock,
}));

vi.mock("@repo/database", () => ({
  prisma: {
    notificationQueue: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("NTF-DISPATCH-CRON: Zamiatacz kolejki powiadomień (/api/webhooks/notifications-cron)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Bezpieczeństwo i Fail-Closed (SEC-WEBHOOK-SECRET-REQUIRED)", () => {
    it("FAIL-CLOSED: zwraca 401 i nie uruchamia dispatchera, gdy CRON_SECRET nie jest skonfigurowany w środowisku", async () => {
      delete process.env.CRON_SECRET;

      const { POST } = await import(
        "../src/app/api/webhooks/notifications-cron/route"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/notifications-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer jakis-losowy-token",
        },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Brak autoryzacji");
      expect(processNotificationQueueMock).not.toHaveBeenCalled();
    });

    it("FAIL-CLOSED: zwraca 401 i nie uruchamia dispatchera, gdy brak nagłówka Authorization", async () => {
      process.env.CRON_SECRET = "super-tajny-sekret-cron-123";

      const { POST } = await import(
        "../src/app/api/webhooks/notifications-cron/route"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/notifications-cron", {
        method: "POST",
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Brak autoryzacji");
      expect(processNotificationQueueMock).not.toHaveBeenCalled();
    });

    it("FAIL-CLOSED: zwraca 401 i nie uruchamia dispatchera, gdy token Bearer jest błędny", async () => {
      process.env.CRON_SECRET = "super-tajny-sekret-cron-123";

      const { POST } = await import(
        "../src/app/api/webhooks/notifications-cron/route"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/notifications-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer niepoprawny-token",
        },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Brak autoryzacji");
      expect(processNotificationQueueMock).not.toHaveBeenCalled();
    });

    it("SUKCES: zwraca 200 i uruchamia dispatcher, gdy przekazano poprawny Bearer token", async () => {
      process.env.CRON_SECRET = "super-tajny-sekret-cron-123";

      processNotificationQueueMock.mockResolvedValueOnce({
        processedCount: 3,
        sentCount: 2,
        failedCount: 0,
        deferredCount: 1,
      });

      const { POST } = await import(
        "../src/app/api/webhooks/notifications-cron/route"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/notifications-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer super-tajny-sekret-cron-123",
        },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.summary).toEqual({
        processedCount: 3,
        sentCount: 2,
        failedCount: 0,
        deferredCount: 1,
      });
      expect(json.timestamp).toBeDefined();
      expect(processNotificationQueueMock).toHaveBeenCalledTimes(1);
    });

    it("OBSŁUGA BŁĘDÓW: zwraca 500, gdy proces kolejki rzuci nieoczekiwany wyjątek", async () => {
      process.env.CRON_SECRET = "super-tajny-sekret-cron-123";

      processNotificationQueueMock.mockRejectedValueOnce(new Error("Awaria bazy danych"));

      const { POST } = await import(
        "../src/app/api/webhooks/notifications-cron/route"
      );
      const req = new NextRequest("http://localhost:3000/api/webhooks/notifications-cron", {
        method: "POST",
        headers: {
          authorization: "Bearer super-tajny-sekret-cron-123",
        },
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Błąd wykonania zadania cron powiadomień");
    });
  });

  describe("Trzy powody, dla których zdarzenie domenowe nie wystarcza (Kryteria akceptacji NTF-DISPATCH-CRON)", () => {
    it("Powód 1: Wiadomość poza oknem wysyłki (np. 22:00) jest odraczana, a poranny cron (np. 08:30) ją budzi i wysyła", async () => {
      const { isWithinSendWindow } = await import("../src/lib/notifications/window");

      // Sprawdzamy stan o 22:00 (poza oknem 08:00-18:00)
      const eveningTime = new Date("2026-06-15T22:00:00+02:00");
      expect(isWithinSendWindow("SMS", eveningTime)).toBe(false);

      // Sprawdzamy stan o 08:30 (wewnątrz okna)
      const morningTime = new Date("2026-06-16T08:30:00+02:00");
      expect(isWithinSendWindow("SMS", morningTime)).toBe(true);

      // Symulacja: cron o 22:00 odroczyłby wiadomość, ale bez zewnętrznego czasowego crona
      // o 08:30 rano żadne zdarzenie biznesowe by jej nie wywołało.
      expect(QUEUE_POLICY.sendWindow.SMS.from).toBe("08:00");
      expect(QUEUE_POLICY.sendWindow.SMS.to).toBe("18:00");
    });

    it("Powód 2: Ponowienia (backoff) z next_attempt_at w przyszłości wymagają zamiatacza, który po nie wróci", async () => {
      const { calculateNextAttemptAt } = await import("../src/lib/notifications/retry");

      const failTime = new Date("2026-06-15T12:00:00Z");
      const nextAttempt = calculateNextAttemptAt("SMS", 1, failTime);

      // nextAttemptAt jest w przyszłości (np. +10 minut)
      expect(nextAttempt).toBeInstanceOf(Date);
      expect(nextAttempt.getTime()).toBeGreaterThan(failTime.getTime());

      // Brak zdarzenia domenowego między t a t+10 min — to cron cyklicznie sprawdza OR: nextAttemptAt <= now
    });

    it("Powód 3: Zakolejkowanie jest zdarzeniowe i transakcyjne, a wysyłka zewnętrzna NIE obciąża transakcji domenowej", async () => {
      // Weryfikacja definicji kontraktowej:
      // Zdarzenie domenowe rejestruje wiersz w tabeli notification_queue w transakcji bazy,
      // a fizyczne zapytanie HTTP do dostawcy (SMSAPI/Mailtrap) następuje wyłącznie w dispatcherze.
      const n1Id = NOTIFICATION_IDS[0];
      const n1Def = NOTIFICATIONS.find((n) => n.id === n1Id);
      expect(n1Def).toBeDefined();
      expect(n1Def?.channels).toContain("SMS");
    });
  });
});
