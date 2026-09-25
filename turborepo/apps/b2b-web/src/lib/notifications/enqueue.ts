import type { EnqueueNotificationParams, EnqueuedResult } from "./types";
import type { MessageTemplateStore } from "./templates";
// Import WZGLĘDNY, nie `@/...` — patrz komentarz przy tym samym problemie w
// `rollback-effects.ts` (vitest.config.mts nie zna aliasu `@/*` dla importów wartości).
import { enqueueNotification } from "../../app/(dashboard)/logistics/rollback-effects";

export interface EnqueueTx extends MessageTemplateStore {
  notificationQueue: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
}

/**
 * ALIAS CIENKI (runda 3 audytu feat/ntf-gateway, 2026-09-24, BLOCKER 2): to była druga,
 * osobna implementacja renderowania i zapisu wiersza kolejki, wołana WYŁĄCZNIE przez testy —
 * żadna z ośmiu Server Actions produkcyjnych nigdy jej nie wołała, wszystkie wołają
 * `enqueueNotification` z `logistics/rollback-effects.ts`. Cała logika (walidacja NTF-POLY,
 * renderowanie NTF-QUEUE-RENDERED-BODY, okno wysyłki) mieszka teraz WYŁĄCZNIE tam — ten plik
 * zostaje jako stabilny punkt importu dla testów, które już na niego wskazują
 * (`enqueue-notification.test.ts`, `notifications-poly.test.ts`,
 * `notifications-template-store-and-rendered-body.itest.ts` wołają
 * `../src/lib/notifications/enqueue`), zamiast dwóch rozjeżdżających się źródeł prawdy o tym,
 * co faktycznie trafia do `notification_queue`.
 *
 * Bez rzutowania `tx` przez `unknown` (zablokowane hookiem `gate-evasion-prisma-recast`,
 * i słusznie): `EnqueueTx` jest DOKŁADNIE interfejsem, którego oczekuje `enqueueNotification`
 * (patrz `EnqueueNotificationTx` w `rollback-effects.ts`) — realny `Prisma.TransactionClient`
 * (produkcja, itesty) spełnia go strukturalnie, atrapy testów jednostkowych bez
 * `messageTemplate` trafiają w gałąź fallbacku (`?.` w `resolveCurrentTemplateContent`), nie w
 * wyjątek.
 */
export async function enqueueNotificationEx(
  tx: EnqueueTx,
  params: EnqueueNotificationParams
): Promise<EnqueuedResult[]> {
  return enqueueNotification(tx, params);
}
