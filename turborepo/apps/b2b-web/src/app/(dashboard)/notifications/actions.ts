"use server";

import { can } from "@klikklima/contracts";
import { prisma } from "@repo/database";
import { getCurrentActorRole, getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { retryNotificationRecord, RetryNotAllowedError } from "@/lib/notifications/retry";
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

/// Uzasadnienie ręcznych akcji operatora na kolejce powiadomień (SEC-AUDIT-LOG-MANUAL-STATUS,
/// rozszerzenie 2026-09-24, decyzja Michała po rundzie 3 audytu feat/ntf-gateway). Ani ponowienie,
/// ani ręczne wymuszenie wysyłki nie mają dziś w UI pola na uzasadnienie operatora (w
/// przeciwieństwie do np. bypassu logistyki) — treść stała, ≥10 znaków (CHECK
/// audit_log_justification_min_length), `legalBasis: 'OTHER'` ustalone przez serwer, tym samym
/// wzorcem co przy bypassLogisticsOrder (CLAUDE.md: progi/reguły audytu nie są wymyślane w kodzie,
/// ale to nie próg SLA — to komunikat, a jego stałość jest świadomym, minimalnym wyborem tej tury;
/// pole do wpisania własnego uzasadnienia jest naturalnym następnym krokiem, poza zakresem
/// bloku 5 tej rundy).
const RETRY_JUSTIFICATION = "Ręczne ponowienie wysyłki powiadomienia przez operatora panelu.";
const DISPATCH_JUSTIFICATION = "Ręczne wymuszenie przetworzenia kolejki powiadomień przez operatora panelu.";

async function resolveActorEmail(): Promise<string | undefined> {
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    return user?.email ?? undefined;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return undefined;
  }
}

export async function retryNotificationAction(notificationId: string) {
  const role = await getCurrentActorRole();
  if (!role || !can(role, "notification_queue", "update")) {
    throw new Error("Brak uprawnień do ponawiania powiadomień");
  }

  const actorEmail = await resolveActorEmail();
  if (!actorEmail) {
    return {
      success: false,
      code: "RETRY_NOT_ALLOWED" as const,
      message: "Nie udało się zweryfikować tożsamości operatora.",
    };
  }

  try {
    // Zmiana statusu wiersza kolejki i wpis audytowy w JEDNEJ transakcji (pułapka nr 2
    // z CLAUDE.md w wydaniu audytowym: rozjazd między nimi zostawiałby ponowienie bez śladu).
    // `retryNotificationRecord` przyjmuje wąski interfejs (`notificationQueue.updateMany`) —
    // `tx` z `$transaction` go spełnia strukturalnie, bez rzutowania.
    const updated = await prisma.$transaction(async (tx) => {
      const result = await retryNotificationRecord(tx, notificationId);
      await tx.auditLog.create({
        data: {
          operation: "manual_status_change",
          resource: "notification_queue",
          recordId: notificationId,
          actorEmail,
          actorRole: role,
          justification: RETRY_JUSTIFICATION,
          legalBasis: "OTHER",
        },
      });
      return result;
    });

    revalidatePath("/notifications");

    return {
      success: true,
      item: updated,
    };
  } catch (error) {
    if (error instanceof RetryNotAllowedError) {
      // Błąd domenowy (wiersz nie jest w DEAD_LETTER) — komunikat dla użytkownika,
      // nie wyjątek 500 (CLAUDE.md: błędy domenowe jako wynik).
      return {
        success: false,
        code: "RETRY_NOT_ALLOWED" as const,
        message: error.message,
      };
    }
    throw error;
  }
}

export async function triggerQueueDispatchAction() {
  const role = await getCurrentActorRole();
  if (!role || !can(role, "notification_queue", "update")) {
    throw new Error("Brak uprawnień do uruchamiania wysyłki z kolejki");
  }

  const actorEmail = await resolveActorEmail();

  // NIE w transakcji z `processNotificationQueue`: dispatcher woła zewnętrzne bramki SMS/EMAIL
  // przez sieć, a QUEUE_POLICY w kontrakcie (persistsRenderedBody, notatka ADR-007) wprost
  // zakazuje trzymania transakcji biznesowej otwartej na czas wołania zewnętrznego API. Wpis
  // audytowy dokumentuje ZDARZENIE „operator wymusił przebieg dispatchera", nie mutację
  // pojedynczego rekordu powiązaną z nim transakcyjnie — ten sam podział co przy
  // `releaseCrewSlot`/`suspendLogisticsSla`, które też nie są jednym zdarzeniem do audytu.
  const result = await processNotificationQueue(prisma);

  if (actorEmail) {
    await prisma.auditLog.create({
      data: {
        operation: "manual_status_change",
        resource: "notification_queue",
        recordId: "queue-dispatch-trigger",
        actorEmail,
        actorRole: role,
        justification: DISPATCH_JUSTIFICATION,
        legalBasis: "OTHER",
      },
    });
  } else {
    console.error("triggerQueueDispatchAction: brak actorEmail — wpis audytowy pominięty");
  }

  revalidatePath("/notifications");

  return {
    success: true,
    result,
  };
}
