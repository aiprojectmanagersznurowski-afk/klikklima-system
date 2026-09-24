import { NOTIFICATIONS, byId } from "@klikklima/contracts";
import type { Prisma } from "@repo/database";
import type { EnqueueNotificationParams, EnqueuedResult } from "./types";
import { calculateInitialAttemptTime } from "./window";
import { resolveCurrentTemplateContent, renderMessageTemplate, type MessageTemplateStore } from "./templates";

export interface EnqueueTx extends MessageTemplateStore {
  notificationQueue: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

export async function enqueueNotificationEx(
  tx: EnqueueTx,
  params: EnqueueNotificationParams
): Promise<EnqueuedResult[]> {
  const ownerIds = [params.leadId, params.installationId, params.serviceId, params.incidentId];
  const providedOwnerCount = ownerIds.filter((v) => v !== undefined && v !== null && v !== "").length;

  if (providedOwnerCount !== 1) {
    throw new Error(
      "enqueueNotificationEx: dokładnie jedno z leadId/installationId/serviceId/incidentId musi być podane (NTF-POLY)"
    );
  }

  const definition = NOTIFICATIONS.find((n) => n.id === params.notificationId);
  if (!definition) {
    throw new Error(`enqueueNotificationEx: brak definicji w katalogu dla id "${params.notificationId}"`);
  }

  // Wymuszenie powiązań domenowych (NTF-POLY)
  if (definition.domain === "SERVICE" && !params.serviceId) {
    throw new Error(
      `Powiadomienie ${definition.id} z domeny SERVICE musi być powiązane z serviceId`
    );
  }

  if (definition.domain === "INCIDENT" && !params.incidentId) {
    throw new Error(
      `Powiadomienie ${definition.id} z domeny INCIDENT musi być powiązane z incidentId`
    );
  }

  if (definition.domain === "FUNNEL" && !params.leadId && !params.installationId) {
    throw new Error(
      `Powiadomienie ${definition.id} z domeny FUNNEL musi być powiązane z leadId lub installationId`
    );
  }

  const results: EnqueuedResult[] = [];

  for (const channel of definition.channels) {
    const channelIdempotencyKey = `${params.idempotencyKey}:${channel}`;
    const initialAttemptAt = calculateInitialAttemptTime(channel);

    // NTF-QUEUE-RENDERED-BODY: treść WYRENDEROWANA w chwili kolejkowania, z
    // AKTUALNEJ wersji szablonu — nie w chwili wysyłki. Odtworzenie treści z
    // payloadu + gita przestało działać, odkąd szablon mieszka w edytowalnej
    // tabeli (NTF-TEMPLATE-STORE): odtworzenie dałoby treść AKTUALNĄ, nie tę,
    // która realnie miałaby zostać wysłana w chwili zakolejkowania.
    const payloadObj = (params.payload as Record<string, unknown>) ?? {};
    const content = await resolveCurrentTemplateContent(tx, definition.templateKey, channel);
    const rendered = renderMessageTemplate(content, payloadObj);

    try {
      const row = await tx.notificationQueue.create({
        data: {
          notificationId: definition.id,
          templateKey: definition.templateKey,
          channel,
          recipientType: definition.recipient,
          recipientAddress: params.recipientOverride ?? null,
          payload: (params.payload as Prisma.InputJsonValue) ?? {},
          renderedBody: rendered.body,
          renderedSubject: rendered.subject ?? null,
          templateVersionId: content.templateVersionId,
          status: "PENDING",
          attempts: 0,
          idempotencyKey: channelIdempotencyKey,
          nextAttemptAt: initialAttemptAt,
          leadId: params.leadId ?? null,
          installationId: params.installationId ?? null,
          serviceId: params.serviceId ?? null,
          incidentId: params.incidentId ?? null,
        },
      });

      results.push({ id: row.id, created: true, channel });
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as { code: unknown }).code === "P2002") {
        results.push({ id: channelIdempotencyKey, created: false, channel });
      } else {
        throw error;
      }
    }
  }

  return results;
}
