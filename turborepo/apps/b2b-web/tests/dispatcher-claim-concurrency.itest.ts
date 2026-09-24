import { describe, it, expect, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';
import { NOTIFICATIONS } from '@klikklima/contracts';
import { processNotificationQueue } from '../src/lib/notifications/dispatcher';

/**
 * NTF-QUEUE-CLAIM — recenzja gałęzi feat/ntf-gateway (2026-09-24, bloker BLOCKER 1):
 * dispatcher dzisiejszy pobiera oczekujące wiadomości (`findMany` status=PENDING),
 * wysyła, DOPIERO POTEM oznacza jako wysłane (`update` status=SENT). Między odczytem
 * a zapisem mieści się DRUGI proces, który przeczyta ten sam wiersz jako PENDING i
 * wyśle tę samą wiadomość drugi raz.
 *
 * Sprawdzenie na atrapie Prismy NIE JEST w stanie tego dowieść — atrapa dowodzi
 * wyłącznie tego, jak została zaprogramowana (dwa wywołania `findMany` na atrapie
 * mogą "przypadkiem" zwrócić różne rzeczy, jeżeli tak ją zaprogramujemy — co nie mówi
 * nic o tym, czy PRAWDZIWA baza pod dwoma równoległymi połączeniami rozstrzyga
 * wyścig atomowo). Wymaganie explicite: "Test współbieżności uruchamia DWA
 * dispatchery równolegle na tej samej kolejce i oczekuje DOKŁADNIE JEDNEJ wysyłki
 * na wiadomość — test musi biec na żywym Postgresie".
 *
 * Wzorzec pliku: apps/b2b-web/tests/create-booking-concurrency.itest.ts (D-2).
 *
 * Bramy zewnętrzne (SMSAPI/Mailtrap) są zamockowane — to, co dowodzimy tutaj, jest
 * WŁASNOŚCIĄ BAZY (atomowe przejęcie wiersza), nie zachowaniem dostawcy SMS.
 */

// ADR-003 (adr003-notif-literal): odnajdujemy ID z katalogu po templateKey,
// nie wpisujemy gołego literału ID lejka.
const AUDITOR_ASSIGNED_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'funnel.auditor_assigned')!;

const smsSendMock = vi.fn();

vi.mock('../src/lib/notifications/gateways/smsapi', () => ({
  sendSms: (...args: unknown[]) => smsSendMock(...args),
}));
vi.mock('../src/lib/notifications/gateways/mailtrap', () => ({
  sendEmail: vi.fn(),
}));

let createdQueueIds: string[] = [];

afterEach(async () => {
  if (createdQueueIds.length > 0) {
    await prisma.notificationQueue.deleteMany({ where: { id: { in: createdQueueIds } } });
  }
  createdQueueIds = [];
  smsSendMock.mockReset();
});

async function createPendingQueueRow(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const row = await prisma.notificationQueue.create({
    data: {
      notificationId: AUDITOR_ASSIGNED_DEF.id,
      templateKey: AUDITOR_ASSIGNED_DEF.templateKey,
      channel: 'SMS',
      recipientType: 'CLIENT',
      recipientAddress: '+48500111222',
      payload: { first_name: 'Jan', order_number: 'ORD-ITEST' },
      status: 'PENDING',
      attempts: 0,
      idempotencyKey: `itest-dispatcher-claim-${suffix}`,
      nextAttemptAt: null,
      leadId: randomUUID(),
    },
  });
  createdQueueIds.push(row.id);
  return row;
}

describe('NTF-QUEUE-CLAIM — przejęcie wiersza kolejki pod współbieżnością (żywy Postgres)', () => {
  // @REQ: NTF-QUEUE-CLAIM
  it('dwa równoległe uruchomienia dispatchera na tej samej kolejce wysyłają wiadomość DOKŁADNIE JEDEN raz', async () => {
    smsSendMock.mockResolvedValue({ success: true, messageId: 'itest-sms-ok' });

    const row = await createPendingQueueRow();

    // Bez await między wywołaniami — dokładnie ten scenariusz, którego atrapa
    // Prismy nie może udowodnić: dwa procesy pytają bazę "PENDING?" w tym samym
    // oknie czasowym.
    const run1 = processNotificationQueue(prisma as never, { limit: 10 });
    const run2 = processNotificationQueue(prisma as never, { limit: 10 });

    const [result1, result2] = await Promise.all([run1, run2]);

    // Żadna z dwóch odpowiedzi nie jest błędem 500 / wyjątkiem — Promise.all
    // powyżej już to gwarantuje (odrzucenie przerwałoby test), ale sedno tego
    // kryterium jest w LICZBIE wysyłek, nie w tym, że coś się zwróciło.
    expect(result1.sentCount + result2.sentCount).toBe(1);
    expect(smsSendMock).toHaveBeenCalledTimes(1);

    const finalRow = await prisma.notificationQueue.findUnique({ where: { id: row.id } });
    expect(finalRow?.status).toBe('SENT');
  });
});
