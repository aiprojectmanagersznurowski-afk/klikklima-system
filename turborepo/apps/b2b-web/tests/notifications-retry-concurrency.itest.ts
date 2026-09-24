import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';
import { NOTIFICATIONS } from '@klikklima/contracts';
import { retryNotificationRecord } from '../src/lib/notifications/retry';

/**
 * NTF-RETRY — "Dwa ponowienia z tym samym idempotency_key skutkują jedną wysyłką —
 * test uruchamia je równolegle" (contracts/requirements.contract.mjs).
 *
 * Dzisiejszy `retryNotificationRecord` wykonuje BEZWARUNKOWY `update` — nie sprawdza
 * bieżącego statusu rekordu przed przełączeniem na PENDING. Dwa równoległe wywołania
 * na tym samym `id` po prostu nadpiszą się nawzajem BEZ ŻADNEGO rozstrzygnięcia przez
 * bazę — atrapa Prismy w `notifications-retry.test.ts` może to udowodnić WYŁĄCZNIE
 * dla argumentów przekazanych do wywołania (co dokładnie robimy w tamtym pliku), ale
 * nie dla PRAWDZIWEJ współbieżności dwóch połączeń do jednej bazy. Ten plik biegnie
 * na żywym Postgresie z tego samego powodu co
 * `apps/b2b-web/tests/create-booking-concurrency.itest.ts` (D-2).
 */

const DEAD_LETTER_TEMPLATE = NOTIFICATIONS.find((n) => n.templateKey === 'incident.received')!;

let createdQueueIds: string[] = [];

afterEach(async () => {
  if (createdQueueIds.length > 0) {
    await prisma.notificationQueue.deleteMany({ where: { id: { in: createdQueueIds } } });
  }
  createdQueueIds = [];
});

async function createDeadLetterRow(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const row = await prisma.notificationQueue.create({
    data: {
      notificationId: DEAD_LETTER_TEMPLATE.id,
      templateKey: DEAD_LETTER_TEMPLATE.templateKey,
      channel: 'SMS',
      recipientType: 'CLIENT',
      recipientAddress: '+48500111222',
      payload: {},
      status: 'DEAD_LETTER',
      attempts: 5,
      idempotencyKey: `itest-retry-concurrency-${suffix}`,
      nextAttemptAt: null,
      deadLetteredAt: new Date(),
      incidentId: randomUUID(),
    },
  });
  createdQueueIds.push(row.id);
  return row;
}

describe('NTF-RETRY — ponowienie tego samego wiersza DEAD_LETTER pod współbieżnością (żywy Postgres)', () => {
  // @REQ: NTF-RETRY
  it('dwa równoległe ponowienia tego samego wiersza: dokładnie jedno kończy się sukcesem (PENDING), drugie odmową — zero wyjątku 500', async () => {
    const row = await createDeadLetterRow();

    const attempt1 = retryNotificationRecord(prisma as never, row.id);
    const attempt2 = retryNotificationRecord(prisma as never, row.id);

    const [outcome1, outcome2] = await Promise.allSettled([attempt1, attempt2]);

    const fulfilled = [outcome1, outcome2].filter(
      (o) => o.status === 'fulfilled',
    ) as PromiseFulfilledResult<{ status: string }>[];
    const rejected = [outcome1, outcome2].filter((o) => o.status === 'rejected');

    // Odmowa jest DOMENOWA (błąd zgłoszony przez retryNotificationRecord, np.
    // "rekord nie jest w DEAD_LETTER"), nie awarią 500 nieznanego kształtu —
    // sam fakt odrzucenia obiecanego wyniku jest tu wystarczającym dowodem
    // odmowy; sedno kryterium jest w tym, że NIE MOŻE być dwóch sukcesów.
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(fulfilled[0].value.status).toBe('PENDING');

    const finalRow = await prisma.notificationQueue.findUnique({ where: { id: row.id } });
    expect(finalRow?.status).toBe('PENDING');
    expect(finalRow?.deadLetteredAt).toBeNull();
  });
});
