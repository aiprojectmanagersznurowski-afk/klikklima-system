import { describe, it, expect, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';
import { NOTIFICATIONS } from '@klikklima/contracts';
import { processNotificationQueue } from '../src/lib/notifications/dispatcher';
import { enqueueNotificationEx } from '../src/lib/notifications/enqueue';

/**
 * NTF-TEMPLATE-STORE + NTF-QUEUE-RENDERED-BODY — decyzja Michała 2026-09-24 (patrz
 * contracts/requirements.contract.mjs). Dwa splecione, ale ODRĘBNE kryteria:
 *
 *  (A) NTF-TEMPLATE-STORE: treść szablonu mieszka w wersjonowanej tabeli
 *      `message_templates`, edytowalnej z panelu, a NIE w stałej TypeScript.
 *      Test poniżej dowodzi tego wprost tak, jak żąda kryterium: zmiana treści
 *      w bazie (przez fixture, bez redeployu kodu) musi zmienić to, co
 *      dispatcher faktycznie wysyła. Dzisiejszy `dispatcher.ts` czyta z
 *      `TEMPLATE_DEFINITIONS` w `templates.ts` (stała TS) — ten test biegnie na
 *      ŻYWYM Postgresie właśnie po to, żeby dowieść, że zmiana wiersza w bazie
 *      NIE MA dziś żadnego wpływu (a powinna mieć).
 *
 *  (B) NTF-QUEUE-RENDERED-BODY: wiersz kolejki zapisuje wyrenderowaną treść W
 *      MOMENCIE KOLEJKOWANIA (`enqueueNotificationEx`), nie w momencie wysyłki.
 *      Kolumny `rendered_body`/`rendered_subject`/`template_version_id` istnieją
 *      w schemacie (migracja 20260926093000) — ten test dowodzi, że
 *      `enqueueNotificationEx` ich jeszcze NIE wypełnia.
 *
 * Migracja 20260926093000 (kolumny rendered_body/rendered_subject/template_version_id,
 * status SENDING, tabela message_templates z 20260926092000) nie była jeszcze
 * uruchomiona na ŻADNEJ bazie w chwili pisania tego pliku (nagłówek migracji) —
 * ten plik zakłada, że `supabase start` (D-2) ją zaaplikuje przed przebiegiem.
 */

const AUDITOR_ASSIGNED_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'funnel.auditor_assigned')!;

const smsSendMock = vi.fn();
vi.mock('../src/lib/notifications/gateways/smsapi', () => ({
  sendSms: (...args: unknown[]) => smsSendMock(...args),
}));
vi.mock('../src/lib/notifications/gateways/mailtrap', () => ({
  sendEmail: vi.fn(),
}));

let createdQueueIds: string[] = [];
let createdTemplateIds: string[] = [];

afterEach(async () => {
  if (createdQueueIds.length > 0) {
    await prisma.notificationQueue.deleteMany({ where: { id: { in: createdQueueIds } } });
  }
  if (createdTemplateIds.length > 0) {
    // Wersje szablonów nie mają FK z notification_queue skierowanego DO nich w
    // sposób blokujący usunięcie tutaj — wiersze kolejki testowej są usuwane
    // wyżej PRZED usunięciem wersji (FK RESTRICT na template_version_id).
    await prisma.messageTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
  }
  createdQueueIds = [];
  createdTemplateIds = [];
  smsSendMock.mockReset();
});

describe('NTF-TEMPLATE-STORE — treść z bazy, nie ze stałej TypeScript (żywy Postgres)', () => {
  // @REQ: NTF-TEMPLATE-STORE
  it('zmiana treści szablonu w message_templates (fixture, bez redeployu) zmienia to, co dispatcher faktycznie wysyła', async () => {
    smsSendMock.mockResolvedValue({ success: true, messageId: 'itest-template-store-ok' });

    const marker = randomUUID().slice(0, 8);
    const customBody = `WERSJA-Z-BAZY-${marker} {{first_name}} TEST-NTF-TEMPLATE-STORE`;

    const version = await prisma.messageTemplate.create({
      data: {
        templateKey: AUDITOR_ASSIGNED_DEF.templateKey,
        versionNo: 1,
        channel: 'SMS',
        subject: null,
        body: customBody,
        publishedAt: new Date(),
        isCurrent: true,
      },
    });
    createdTemplateIds.push(version.id);

    const queueRow = await prisma.notificationQueue.create({
      data: {
        notificationId: AUDITOR_ASSIGNED_DEF.id,
        templateKey: AUDITOR_ASSIGNED_DEF.templateKey,
        channel: 'SMS',
        recipientType: 'CLIENT',
        recipientAddress: '+48500111222',
        payload: { first_name: 'Jan', order_number: 'ORD-ITEST' },
        status: 'PENDING',
        attempts: 0,
        idempotencyKey: `itest-template-store-${marker}`,
        nextAttemptAt: null,
        leadId: randomUUID(),
      },
    });
    createdQueueIds.push(queueRow.id);

    await processNotificationQueue(prisma as never, { limit: 10 });

    expect(smsSendMock).toHaveBeenCalledTimes(1);
    const [sentArgs] = smsSendMock.mock.calls[0];
    // Treść faktycznie wysłana pochodzi z BAZY (marker unikalny per test), nie
    // z TEMPLATE_DEFINITIONS zaszytego w templates.ts.
    expect(sentArgs.message).toContain(`WERSJA-Z-BAZY-${marker}`);
    expect(sentArgs.message).toContain('Jan');
  });
});

describe('NTF-QUEUE-RENDERED-BODY — treść wyrenderowana w momencie kolejkowania (żywy Postgres)', () => {
  // @REQ: NTF-QUEUE-RENDERED-BODY
  it('enqueueNotificationEx zapisuje w wierszu kolejki treść WYRENDEROWANĄ w momencie kolejkowania, nie tylko payload', async () => {
    const leadId = randomUUID();
    const idempotencyKey = `itest-rendered-body-${randomUUID()}`;

    const results = await enqueueNotificationEx(prisma as never, {
      notificationId: AUDITOR_ASSIGNED_DEF.id,
      idempotencyKey,
      leadId,
      payload: { first_name: 'Ola', order_number: 'ORD-RENDER-1' },
    });
    createdQueueIds.push(...results.map((r) => r.id));

    const smsResult = results.find((r) => r.channel === 'SMS')!;
    const storedRow = await prisma.notificationQueue.findUnique({ where: { id: smsResult.id } });

    expect(storedRow?.renderedBody).not.toBeNull();
    expect(storedRow?.renderedBody).toContain('Ola');
    // Payload zostaje OBOK treści (ponowienie po błędzie kanału musi mieć z
    // czego odtworzyć wiadomość) — nie jest zastępowany.
    expect(storedRow?.payload).toMatchObject({ first_name: 'Ola', order_number: 'ORD-RENDER-1' });
  });

  // @REQ: NTF-QUEUE-RENDERED-BODY
  it('edycja szablonu PO zakolejkowaniu NIE zmienia treści już zapisanej w wierszu kolejki', async () => {
    const marker = randomUUID().slice(0, 8);
    const originalBody = `ORYGINAL-${marker} {{first_name}}`;

    const originalVersion = await prisma.messageTemplate.create({
      data: {
        templateKey: AUDITOR_ASSIGNED_DEF.templateKey,
        versionNo: 100,
        channel: 'SMS',
        subject: null,
        body: originalBody,
        publishedAt: new Date(),
        isCurrent: true,
      },
    });
    createdTemplateIds.push(originalVersion.id);

    const leadId = randomUUID();
    const results = await enqueueNotificationEx(prisma as never, {
      notificationId: AUDITOR_ASSIGNED_DEF.id,
      idempotencyKey: `itest-rendered-body-frozen-${marker}`,
      leadId,
      payload: { first_name: 'Piotr', order_number: 'ORD-RENDER-2' },
    });
    createdQueueIds.push(...results.map((r) => r.id));
    const smsResult = results.find((r) => r.channel === 'SMS')!;

    // Edycja PO zakolejkowaniu: nowa wersja obowiązująca, treść całkowicie inna.
    await prisma.messageTemplate.update({
      where: { id: originalVersion.id },
      data: { isCurrent: false },
    });
    const editedVersion = await prisma.messageTemplate.create({
      data: {
        templateKey: AUDITOR_ASSIGNED_DEF.templateKey,
        versionNo: 101,
        channel: 'SMS',
        subject: null,
        body: `EDYTOWANA-PO-FAKCIE-${marker} {{first_name}}`,
        publishedAt: new Date(),
        isCurrent: true,
      },
    });
    createdTemplateIds.push(editedVersion.id);

    const storedRow = await prisma.notificationQueue.findUnique({ where: { id: smsResult.id } });
    expect(storedRow?.renderedBody).toContain(`ORYGINAL-${marker}`);
    expect(storedRow?.renderedBody).not.toContain('EDYTOWANA-PO-FAKCIE');
  });
});
