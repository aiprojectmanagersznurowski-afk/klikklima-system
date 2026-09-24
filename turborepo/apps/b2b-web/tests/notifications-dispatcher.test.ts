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

function makePendingRow(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe("P1 — Silnik wysyłki powiadomień (Dispatcher, SMSAPI, Mailtrap)", () => {
  it("wysyła SMS przez bramkę SMSAPI z poprawnym nadawcą i numerem", async () => {
    smsSendMock.mockResolvedValue({ success: true, messageId: "sms-msg-123" });

    const queueRow = makePendingRow();
    const updateMock = vi.fn().mockResolvedValue({ ...queueRow, status: "SENT" });

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([queueRow]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: updateMock,
      },
    };

    const result = await processNotificationQueue(mockPrisma as never);

    expect(result.sentCount).toBe(1);
    expect(smsSendMock).toHaveBeenCalledTimes(1);
    const smsArgs = smsSendMock.mock.calls[0][0];
    expect(smsArgs.to).toBe("+48500123456");
    expect(smsArgs.from).toBe("KlikKlima");
    expect(smsArgs.message).toContain("Jan");

    // Udana wysyłka musi zapisać status SENT w wywołaniu `update`, które
    // KOŃCZY przetwarzanie wiersza (nie przejęcie SENDING — to updateMany,
    // sprawdzone osobno w teście NTF-QUEUE-CLAIM). Zweryfikowane mutacją:
    // zamiana `SENT` -> `PENDING` w kodzie produkcyjnym przechodziła cały
    // zestaw jednostkowy bez czerwieni, dopóki tej asercji nie było.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0].data).toMatchObject({ status: "SENT" });
  });

  it("wysyła Email przez bramkę Mailtrap z poprawnym szablonem i odbiorcą", async () => {
    emailSendMock.mockResolvedValue({ success: true, messageId: "mail-msg-456" });

    const queueRow = makePendingRow({
      id: "q-2",
      notificationId: QUOTE_READY_ID,
      templateKey: "funnel.quote_ready",
      channel: "EMAIL",
      recipientAddress: "jan.kowalski@example.com",
      payload: { first_name: "Jan", link: "https://klikklima.pl/w/123", total_price: "15 000 zł" },
      idempotencyKey: "key-email-1",
    });

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([queueRow]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

  // @REQ: NTF-QUEUE-CLAIM
  it("przejęcie wiersza jest atomowe: updateMany z warunkiem { id, status: PENDING } -> { status: SENDING }, wysyłka wyłącznie po count === 1", async () => {
    smsSendMock.mockResolvedValue({ success: true, messageId: "sms-msg-999" });

    const queueRow = makePendingRow();
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([queueRow]),
        updateMany: updateManyMock,
        update: vi.fn().mockResolvedValue({ ...queueRow, status: "SENT" }),
      },
    };

    const result = await processNotificationQueue(mockPrisma as never);

    // Nie sprawdzamy zwrotki atrapy — sprawdzamy DOSŁOWNE argumenty przekazane
    // do bazy: przejęcie musi iść przez updateMany z warunkiem na POPRZEDNIM
    // statusie, nie przez bezwarunkowy update.
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const [claimArgs] = updateManyMock.mock.calls[0];
    expect(claimArgs.where).toMatchObject({ id: queueRow.id, status: "PENDING" });
    expect(claimArgs.data).toMatchObject({ status: "SENDING" });

    // Wysyłka nastąpiła TYLKO dlatego, że przejęcie zwróciło count === 1.
    expect(smsSendMock).toHaveBeenCalledTimes(1);
    expect(result.sentCount).toBe(1);
  });

  // @REQ: NTF-QUEUE-CLAIM
  it("przegrany wyścig o przejęcie wiersza (updateMany zwraca count: 0) nie wysyła nic i nie ustawia SENT", async () => {
    // Zwrotka bramki jest tu nieistotna dla sedna testu (asercja jest o tym,
    // czy dispatcher W OGÓLE spróbował wysłać) — ale musi być zdefiniowana,
    // inaczej dzisiejszy dispatcher (który NIE sprawdza count z przejęcia i
    // wysyła zawsze) wywali się na czytaniu `.success` z `undefined`, co
    // maskowałoby prawdziwą asercję wyjątkiem technicznym.
    smsSendMock.mockResolvedValue({ success: true, messageId: "should-not-happen" });
    const queueRow = makePendingRow();
    const updateMock = vi.fn();

    const mockPrisma = {
      notificationQueue: {
        findMany: vi.fn().mockResolvedValue([queueRow]),
        // Drugi proces przejął wiersz pierwszy — nasze updateMany trafia na
        // status już zmieniony na SENDING i zwraca count: 0.
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: updateMock,
      },
    };

    const result = await processNotificationQueue(mockPrisma as never);

    expect(smsSendMock).not.toHaveBeenCalled();
    expect(emailSendMock).not.toHaveBeenCalled();
    // Zero skutków ubocznych — żaden update statusu (a więc żadne SENT) dla
    // wiersza, którego nie przejęliśmy.
    expect(updateMock).not.toHaveBeenCalled();
    expect(result.sentCount).toBe(0);
  });
});
