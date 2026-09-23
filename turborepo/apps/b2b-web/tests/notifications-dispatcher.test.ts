import { describe, it, expect, vi, beforeEach } from "vitest";
import { NOTIFICATIONS } from "@klikklima/contracts";
import { processNotificationQueue } from "../src/lib/notifications/dispatcher";

const smsSendMock = vi.fn();
const emailSendMock = vi.fn();

vi.mock("../src/lib/notifications/gateways/smsapi", () => ({
  sendSms: (...args: unknown[]) => smsSendMock(...args),
}));

vi.mock("../src/lib/notifications/gateways/mailtrap", () => ({
  sendEmail: (...args: unknown[]) => emailSendMock(...args),
}));

const findId = (templateKey: string) => {
  const def = NOTIFICATIONS.find((n) => n.templateKey === templateKey);
  if (!def) throw new Error("Nie znaleziono definicji dla: " + templateKey);
  return def.id;
};

const AUDITOR_ASSIGNED_ID = findId("funnel.auditor_assigned");
const QUOTE_READY_ID = findId("funnel.quote_ready");

beforeEach(() => {
  smsSendMock.mockReset();
  emailSendMock.mockReset();
});

describe("P1 — Silnik wysyłki powiadomień (Dispatcher, SMSAPI, Mailtrap)", () => {
  it("wysyła SMS przez bramkę SMSAPI z poprawnym nadawcą i numerem", async () => {
    smsSendMock.mockResolvedValue({ success: true, messageId: "sms-msg-123" });

    const queueRow = {
      id: "q-1",
      notificationId: AUDITOR_ASSIGNED_ID,
      templateKey: "funnel.auditor_assigned",
      channel: "SMS",
      recipientType: "CLIENT",
      recipientAddress: "+48 500 123 456",
      payload: { first_name: "Jan", order_number: "ORD-999" },
      status: "PENDING",
      attempts: 0,
      idempotencyKey: "key-sms-1",
      nextAttemptAt: null,
    };

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([queueRow]),
        update: vi.fn().mockResolvedValue({ ...queueRow, status: "SENT" }),
      },
    };

    const result = await processNotificationQueue(mockPrisma as never);

    expect(result.sentCount).toBe(1);
    expect(smsSendMock).toHaveBeenCalledTimes(1);
    const smsArgs = smsSendMock.mock.calls[0][0];
    expect(smsArgs.to).toBe("+48500123456");
    expect(smsArgs.from).toBe("KlikKlima");
    expect(smsArgs.message).toContain("Jan");
  });

  it("wysyła Email przez bramkę Mailtrap z poprawnym szablonem i odbiorcą", async () => {
    emailSendMock.mockResolvedValue({ success: true, messageId: "mail-msg-456" });

    const queueRow = {
      id: "q-2",
      notificationId: QUOTE_READY_ID,
      templateKey: "funnel.quote_ready",
      channel: "EMAIL",
      recipientType: "CLIENT",
      recipientAddress: "jan.kowalski@example.com",
      payload: { first_name: "Jan", link: "https://klikklima.pl/w/123", total_price: "15 000 zł" },
      status: "PENDING",
      attempts: 0,
      idempotencyKey: "key-email-1",
      nextAttemptAt: null,
    };

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([queueRow]),
        update: vi.fn().mockResolvedValue({ ...queueRow, status: "SENT" }),
      },
    };

    const result = await processNotificationQueue(mockPrisma as never);

    expect(result.sentCount).toBe(1);
    expect(emailSendMock).toHaveBeenCalledTimes(1);
    const mailArgs = emailSendMock.mock.calls[0][0];
    expect(mailArgs.to).toBe("jan.kowalski@example.com");
    expect(mailArgs.subject).toBeDefined();
    expect(mailArgs.html).toContain("Jan");
  });

  it("idempotencja: ponowne uruchomienie dispatchera nie wysyła wiadomości ze statusem SENT", async () => {
    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
    };

    const result = await processNotificationQueue(mockPrisma as never);

    expect(result.sentCount).toBe(0);
    expect(smsSendMock).not.toHaveBeenCalled();
    expect(emailSendMock).not.toHaveBeenCalled();
  });
});
