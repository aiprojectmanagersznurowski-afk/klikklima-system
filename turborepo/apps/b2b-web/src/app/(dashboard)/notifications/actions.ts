"use server";

import { can } from "@klikklima/contracts";
import { prisma } from "@repo/database";
import { getCurrentActorRole } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { retryNotificationRecord } from "@/lib/notifications/retry";
import { processNotificationQueue } from "@/lib/notifications/dispatcher";

export async function getNotificationsListAction(params: {
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const role = await getCurrentActorRole();
  if (!role || !can(role, "notification_queue", "read")) {
    throw new Error("Brak uprawnień do przeglądania kolejki powiadomień");
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const whereClause: Record<string, unknown> = {};
  if (params.status && params.status !== "ALL") {
    whereClause.status = params.status;
  }

  const [items, total] = await Promise.all([
    prisma.notificationQueue.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.notificationQueue.count({ where: whereClause }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function retryNotificationAction(notificationId: string) {
  const role = await getCurrentActorRole();
  if (!role || !can(role, "notification_queue", "update")) {
    throw new Error("Brak uprawnień do ponawiania powiadomień");
  }

  const updated = await retryNotificationRecord(prisma, notificationId);
  revalidatePath("/notifications");

  return {
    success: true,
    item: updated,
  };
}

export async function triggerQueueDispatchAction() {
  const role = await getCurrentActorRole();
  if (!role || !can(role, "notification_queue", "update")) {
    throw new Error("Brak uprawnień do uruchamiania wysyłki z kolejki");
  }

  const result = await processNotificationQueue(prisma);
  revalidatePath("/notifications");

  return {
    success: true,
    result,
  };
}
