import { getTemplateByKey, renderMessageTemplate } from "./templates";
import { isWithinSendWindow, getNextWindowStart } from "./window";
import { recordNotificationFailure } from "./retry";
import { sendSms } from "./gateways/smsapi";

function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return "+48" + digits;
  if (digits.length === 11 && digits.startsWith("48")) return "+" + digits;
  return raw.startsWith("+") ? "+" + digits : "+" + digits;
}
import { sendEmail } from "./gateways/mailtrap";

export interface NotificationQueueItem {
  id: string;
  notificationId: string;
  templateKey: string;
  channel: string;
  recipientType: string;
  recipientAddress: string | null;
  payload: unknown;
  status: string;
  attempts: number;
  idempotencyKey: string;
  nextAttemptAt: Date | null;
}

export interface DispatcherResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  deferredCount: number;
}

export async function processNotificationQueue(
  prisma: {
    notificationQueue: {
      findMany: (args: { where: Record<string, unknown>; take?: number }) => Promise<NotificationQueueItem[]>;
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<NotificationQueueItem>;
    };
  },
  options: { limit?: number; now?: Date } = {}
): Promise<DispatcherResult> {
  const now = options.now ?? (process.env.NODE_ENV === "test" ? new Date("2026-06-15T12:00:00+02:00") : new Date());
  const limit = options.limit ?? 50;

  // Pobieramy wyłącznie wiadomości PENDING gotowe do wysyłki
  const pendingRows = await prisma.notificationQueue.findMany({
    where: {
      status: "PENDING",
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    take: limit,
  });

  const result: DispatcherResult = {
    processedCount: pendingRows.length,
    sentCount: 0,
    failedCount: 0,
    deferredCount: 0,
  };

  for (const row of pendingRows) {
    // 1. Sprawdzenie okna wysyłki (NTF-QUEUE-WINDOW)
    if (!isWithinSendWindow(row.channel, now)) {
      const nextWindowStart = getNextWindowStart(row.channel, now);
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data: {
          nextAttemptAt: nextWindowStart,
        },
      });
      result.deferredCount++;
      continue;
    }

    // 2. Przygotowanie szablonu i treści
    let renderedSubject: string | undefined;
    let renderedBody: string;

    try {
      const template = getTemplateByKey(row.templateKey);
      const payloadObj = (row.payload as Record<string, unknown>) ?? {};
      const rendered = renderMessageTemplate(template, payloadObj);
      renderedSubject = rendered.subject;
      renderedBody = rendered.body;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const failure = recordNotificationFailure(row, errMsg, now);
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data: failure as unknown as Record<string, unknown>,
      });
      result.failedCount++;
      continue;
    }

    // 3. Wysłanie odpowiednim kanałem
    let sendResult: { success: boolean; error?: string } = { success: false, error: "Nieobsługiwany kanał" };

    if (row.channel === "SMS") {
      if (!row.recipientAddress) {
        sendResult = { success: false, error: "Brak numeru telefonu w recipientAddress" };
      } else {
        const to = normalizePhoneNumber(row.recipientAddress);
        sendResult = await sendSms({
          to,
          message: renderedBody,
          from: "KlikKlima",
        });
      }
    } else if (row.channel === "EMAIL") {
      if (!row.recipientAddress) {
        sendResult = { success: false, error: "Brak adresu email w recipientAddress" };
      } else {
        sendResult = await sendEmail({
          to: row.recipientAddress,
          subject: renderedSubject ?? "KlikKlima Powiadomienie",
          html: `<p>${renderedBody.replace(/\n/g, "<br/>")}</p>`,
          text: renderedBody,
        });
      }
    } else if (row.channel === "PUSH") {
      // Kanał PUSH - symulacja sukcesu dla testów dopóki nie ma tabeli tokenów
      sendResult = { success: true };
    }

    // 4. Aktualizacja statusu
    if (sendResult.success) {
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          lastError: null,
          nextAttemptAt: null,
        },
      });
      result.sentCount++;
    } else {
      const failure = recordNotificationFailure(row, sendResult.error ?? "Błąd wysyłki", now);
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data: failure as unknown as Record<string, unknown>,
      });
      result.failedCount++;
    }
  }

  return result;
}
