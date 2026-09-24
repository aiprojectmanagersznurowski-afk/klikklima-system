import type { NotificationId } from "@klikklima/contracts";

export type NotificationChannel = "SMS" | "EMAIL" | "PUSH";
export type NotificationRecipient = "CLIENT" | "DISPATCHER" | "AUDITOR" | "CREW" | "ADMIN";
export type NotificationDomain = "FUNNEL" | "SERVICE" | "INCIDENT" | "INTERNAL";

export interface MessageTemplate {
  templateKey: string;
  notificationId: NotificationId;
  domain: NotificationDomain;
  channels: readonly NotificationChannel[];
  recipient: NotificationRecipient;
  subject?: string;
  bodyTemplate: string;
  requiredVars: readonly string[];
  attachments?: readonly string[];
}

export interface EnqueueNotificationParams {
  notificationId: string;
  idempotencyKey: string;
  leadId?: string | null;
  installationId?: string | null;
  serviceId?: string | null;
  incidentId?: string | null;
  recipientOverride?: string | null;
  payload?: Record<string, unknown>;
}

export interface EnqueuedResult {
  id: string;
  created: boolean;
  channel: string;
}

export interface SmsSendParams {
  to: string;
  message: string;
  from?: string;
  /// Klucz idempotencji SMSAPI (`idx`, dokumentacja SMSAPI REST). Bez niego SMSAPI nie ma jak
  /// odróżnić ponowionej wysyłki (retry po timeoucie sieciowym, drugi bieg cron) od nowej
  /// wiadomości — dwa wywołania z tym samym `idx` w oknie deduplikacji SMSAPI wysyłają SMS
  /// RAZ. `notification_queue.idempotency_key` jest już unikalny w naszej bazie (NTF-QUEUE-TABLE);
  /// to przekazuje tę samą gwarancję na stronę dostawcy, która jest poza naszą kontrolą.
  idx?: string;
}

export interface EmailSendParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface GatewaySendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
