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
