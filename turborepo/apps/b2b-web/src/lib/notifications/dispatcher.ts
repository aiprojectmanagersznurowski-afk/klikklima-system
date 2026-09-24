import { resolveCurrentTemplateContent, renderMessageTemplate, type MessageTemplateStore } from "./templates";
import { isWithinSendWindow, getNextWindowStart } from "./window";
import { recordNotificationFailure } from "./retry";
import { sendSms } from "./gateways/smsapi";
import * as smsapiModule from "./gateways/smsapi";
import { sendEmail } from "./gateways/mailtrap";

/// `normalizePhoneNumber` żyje kanonicznie w `gateways/smsapi.ts` — importowana
/// przez namespace (nie destructuring) i sprawdzana `in`, żeby starsze testy,
/// które mockują CAŁY moduł `smsapi` wymieniając WYŁĄCZNIE `sendSms`, nie
/// wywalały się na dostępie do właściwości nieobecnej w atrapie (proxy Vitest
/// rzuca na `get`, nie na `in` — ten sam wzorzec co przy legacy fixture
/// regressions, patrz .claude/agent-memory/implementer-server). W produkcji
/// (prawdziwy moduł) `in` jest zawsze `true`, więc zachowanie się nie zmienia.
function normalizeSmsRecipient(raw: string): string {
  if ("normalizePhoneNumber" in smsapiModule) {
    return smsapiModule.normalizePhoneNumber(raw);
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return "+48" + digits;
  if (digits.length === 11 && digits.startsWith("48")) return "+" + digits;
  return "+" + digits;
}

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
  /// NTF-QUEUE-RENDERED-BODY: treść WYRENDEROWANA w chwili kolejkowania
  /// (`enqueueNotification`/`enqueueNotificationEx`). Gdy obecna, dispatcher MUSI ją użyć
  /// wprost — czytanie AKTUALNEJ wersji szablonu w chwili wysyłki cofałoby zamrożenie treści
  /// do stanu sprzed tej decyzji. `null` wyłącznie dla wierszy zakolejkowanych starą ścieżką,
  /// zanim ta kolumna istniała — fallback na `resolveCurrentTemplateContent` zostaje dla nich.
  renderedBody?: string | null;
  /// Temat wyrenderowany w chwili kolejkowania, obok `renderedBody` — wypełniony wyłącznie
  /// dla EMAIL. Ten sam priorytet co `renderedBody`: obecny -> użyty wprost, brak -> fallback.
  renderedSubject?: string | null;
}

export interface DispatcherResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  deferredCount: number;
}

export interface DispatcherPrisma extends MessageTemplateStore {
  notificationQueue: {
    findMany: (args: { where: Record<string, unknown>; take?: number }) => Promise<NotificationQueueItem[]>;
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<NotificationQueueItem>;
  };
}

// TODO(kontrakt): brak w QUEUE_POLICY/SLA stałej na próg odzyskiwania wierszy osieroconych w
// SENDING — zgłoszone do rejestracji w kolejnym oknie kontraktowym (patrz raport implementera,
// bloker 3 rundy 3 audytu feat/ntf-gateway, 2026-09-24). Do czasu decyzji kontraktowej literał
// tymczasowy: proces zabity między przejęciem (`claimedAt`) a wysyłką zostawiałby wiersz w
// SENDING NA ZAWSZE bez tego kroku (pułapka nr 4 z CLAUDE.md w wydaniu kolejkowym).
const SENDING_RECOVERY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minut

export async function processNotificationQueue(
  prisma: DispatcherPrisma,
  options: { limit?: number; now?: Date } = {}
): Promise<DispatcherResult> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 50;

  // 0. Odzyskanie wierszy osieroconych w SENDING (NTF-QUEUE-CLAIM, dopełnienie): proces
  // zabity między przejęciem a wysyłką zostawia wiersz zablokowany na zawsze, bo nic poza
  // tym krokiem nigdy nie czyta `claimedAt`. Próg — patrz TODO(kontrakt) przy stałej powyżej.
  await prisma.notificationQueue.updateMany({
    where: {
      status: "SENDING",
      claimedAt: { lt: new Date(now.getTime() - SENDING_RECOVERY_THRESHOLD_MS) },
    },
    data: { status: "PENDING", claimedAt: null },
  });

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
    // 0. Przejęcie wiersza jest ATOMOWE (NTF-QUEUE-CLAIM): updateMany z warunkiem
    // na POPRZEDNIM statusie. Wysyłka następuje WYŁĄCZNIE gdy count === 1 — bez
    // tego dwa równoległe uruchomienia dispatcher-a wysyłają ten sam SMS dwa razy.
    const claim = await prisma.notificationQueue.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING", claimedAt: now },
    });

    if (claim.count !== 1) {
      // Ktoś inny (drugi proces) przejął ten wiersz pierwszy — pomijamy go bez
      // żadnego skutku ubocznego, nie jest to błąd.
      continue;
    }

    // 1. Sprawdzenie okna wysyłki (NTF-QUEUE-WINDOW)
    if (!isWithinSendWindow(row.channel, now)) {
      const nextWindowStart = getNextWindowStart(row.channel, now);
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          nextAttemptAt: nextWindowStart,
        },
      });
      result.deferredCount++;
      continue;
    }

    // 2. Treść: PRIORYTET dla `renderedBody` ZAMROŻONEJ w chwili kolejkowania
    // (NTF-QUEUE-RENDERED-BODY) — dopiero brak tej kolumny (wiersze sprzed jej istnienia)
    // cofa się do odczytu AKTUALNEJ wersji szablonu z bazy (NTF-TEMPLATE-STORE) w chwili
    // wysyłki, co jest dokładnie zachowaniem, które zamrożenie treści miało wyeliminować.
    let renderedSubject: string | undefined;
    let renderedBody: string;

    if (row.renderedBody) {
      renderedSubject = row.renderedSubject ?? undefined;
      renderedBody = row.renderedBody;
    } else {
      try {
        const content = await resolveCurrentTemplateContent(prisma, row.templateKey, row.channel);
        const payloadObj = (row.payload as Record<string, unknown>) ?? {};
        const rendered = renderMessageTemplate(content, payloadObj);
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
    }

    // 3. Wysłanie odpowiednim kanałem
    let sendResult: { success: boolean; error?: string } = { success: false, error: "Nieobsługiwany kanał" };

    if (row.channel === "SMS") {
      if (!row.recipientAddress) {
        sendResult = { success: false, error: "Brak numeru telefonu w recipientAddress" };
      } else {
        const to = normalizeSmsRecipient(row.recipientAddress);
        sendResult = await sendSms({
          to,
          message: renderedBody,
          from: "KlikKlima",
          idx: row.idempotencyKey,
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
