import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NOTIFICATIONS } from '@klikklima/contracts';

/**
 * NTF-QUEUE-TABLE — helper `enqueueNotification(tx, params)` (Faza B,
 * `docs/workorders/LOGISTICS-SHIPPING-EFFECTS.md`, AC-B1..AC-B5).
 *
 * `enqueueNotification` NIE ISTNIEJE jeszcze (zadanie `notification-architect`,
 * następny krok). Ten plik jest fazą RED: importuje z modułu, który jeszcze nie
 * eksportuje tej funkcji.
 *
 * Miejsce: obok `releaseCrewSlot`/`suspendLogisticsSla` w
 * `logistics/rollback-effects.ts` — ten sam styl sygnatury `(tx, ...)`, ten sam
 * poziom abstrakcji (funkcja pomocnicza wołana WEWNĄTRZ `$transaction` przez
 * Server Action, nie sama Server Action). D3 WO wymaga jednej transakcji z
 * `leady.update`, a `rollback-effects.ts` to dokładnie miejsce, gdzie taki
 * współdzielony helper transakcyjny już mieszka.
 *
 * Sygnatura zaprojektowana na podstawie D3 + kształtu modelu Prisma
 * `NotificationQueue` (`packages/database/prisma/schema.prisma:741-780`, pola
 * potwierdzone przez `contract-steward` w tej samej turze):
 *
 *   enqueueNotification(tx, {
 *     notificationId,       // klucz do NOTIFICATIONS w @klikklima/contracts — jedyne źródło
 *                            // channel/templateKey/recipientType (AC-B4, zero literałów)
 *     idempotencyKey,       // D3: `${notificationId}:${leadId}:${transitionId}:${bucketKey}`
 *     leadId? | installationId? | serviceId? | incidentId?, // dokładnie jedno (NTF-POLY / AC-B3)
 *     recipientOverride?,   // -> recipientAddress; helper NIE zgaduje adresu klienta
 *     payload?,             // dowolny Json do wiersza (helper nie waliduje `vars` w tej fazie)
 *   }) => Promise<{ id: string; created: boolean }>
 *
 * DECYZJA PROJEKTOWA (AC-B3 — kto waliduje "dokładnie jedno pole"):
 * Helper sam wymusza tę regułę PRZED jakąkolwiek próbą zapisu, analogicznie do
 * CHECK `notification_queue_one_owner` w bazie (migracja
 * `20260908065000_notification_queue.sql:115-117`) — podwójna warstwa obrony,
 * ten sam wzorzec co `availability_declarations_one_owner`. Powód: helper jest
 * wołany z TRZECH różnych Server Actions (Faza C: ship/bypass/rollback), więc
 * błąd wywołującego (przekazanie zera lub dwóch ID) musi zostać złapany
 * NATYCHMIAST, zanim cokolwiek trafi do `tx`, żeby nie polegać wyłącznie na
 * CHECK bazy (który i tak nie jest jeszcze zaaplikowany na żywej bazie — patrz
 * nagłówek migracji). Test dowodzi tego przez brak wywołania
 * `tx.notificationQueue.create` przy złej liczbie ID, nie przez oczekiwanie na
 * błąd Prisma.
 *
 * DECYZJA PROJEKTOWA (mapowanie `channels` [tablica w kontrakcie] -> `channel`
 * [pojedyncza kolumna w schemacie]): kontrakt (`notifications.contract.mjs`)
 * daje `channels: string[]` (np. dla powiadomienia o wysyłce dwa kanały), a
 * kolumna `notification_queue.channel` jest pojedynczym `TEXT`. WO nie
 * rozstrzyga tej niejednoznaczności wprost. Test NIE zakłada konkretnej
 * konwencji (np. "pierwszy kanał") — sprawdza WYŁĄCZNIE, że zapisany `channel`
 * należy do zbioru `channels` z definicji kontraktowej, czyli że wartość
 * pochodzi z kontraktu, a nie jest literałem w helperze. Rozstrzygnięcie
 * "który konkretnie kanał" należy do `notification-architect` przy implementacji.
 *
 * UWAGA (ADR-003 / `guard-forbidden`): identyfikatory powiadomień poniżej
 * celowo nie są wpisywane jako literały gołych stringów typu ID-lejka — reguła
 * `adr003-notif-literal` blokuje dokładnie taki zapis w `apps/**`. Zamiast
 * tego odnajdujemy definicje po `templateKey`, który jednoznacznie
 * identyfikuje wpis w katalogu, i czytamy `id` z wyniku wyszukania.
 */

const { txCreateMock, txFindUniqueMock } = vi.hoisted(() => ({
  txCreateMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
}));

function makeTx() {
  return {
    notificationQueue: {
      create: txCreateMock,
      findUnique: txFindUniqueMock,
    },
  };
}

function prismaKnownRequestError(code: string) {
  const err = new Error(`Prisma error ${code}`) as Error & { code: string };
  err.code = code;
  return err;
}

beforeEach(() => {
  txCreateMock.mockReset();
  txFindUniqueMock.mockReset();
});

// Dwie różne definicje z kontraktu (wysyłka T06 vs rollback T10-T13) — różne
// templateKey i recipient, więc "wynik się różni" dowodzi braku hardkodowania
// (AC-B4). Odnalezione po templateKey, nie po literale ID (ADR-003).
const SHIPPED_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'funnel.shipped')!;
const ROLLBACK_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'funnel.rollback_rebook')!;
const SHIPPED_ID = SHIPPED_DEF.id;
const ROLLBACK_ID = ROLLBACK_DEF.id;

describe('enqueueNotification(tx, params) — NTF-QUEUE-TABLE (Faza B)', () => {
  // @REQ: NTF-QUEUE-TABLE
  it('AC-B1: dwa wywołania z tym samym idempotencyKey — jeden wiersz utworzony, drugie nie rzuca', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );

    // SHIPPED_DEF (N5) ma 2 kanały (SMS + EMAIL) — jedno PEŁNE wywołanie
    // `enqueueNotification` tworzy jeden wiersz PER KANAŁ, więc 2 wywołania
    // funkcji = maksymalnie 4 próby `tx.notificationQueue.create`. Pierwsze
    // wywołanie: oba kanały tworzą nowy wiersz. Drugie wywołanie (ten sam
    // `idempotencyKey` bazowy): oba kanały łapią kolizję P2002 — dowód
    // idempotencji per kanał, nie tylko per wywołanie.
    expect(SHIPPED_DEF.channels.length).toBe(2);
    txCreateMock.mockResolvedValueOnce({ id: 'row-1-sms', status: 'PENDING', attempts: 0 });
    txCreateMock.mockResolvedValueOnce({ id: 'row-1-email', status: 'PENDING', attempts: 0 });
    txCreateMock.mockRejectedValueOnce(prismaKnownRequestError('P2002'));
    txCreateMock.mockRejectedValueOnce(prismaKnownRequestError('P2002'));

    const tx = makeTx();
    const params = {
      notificationId: SHIPPED_ID,
      idempotencyKey: `${SHIPPED_ID}:lead-1:T06:tracking-abc`,
      leadId: 'lead-1',
    };

    await expect(enqueueNotification(tx as never, params)).resolves.toBeDefined();
    await expect(enqueueNotification(tx as never, params)).resolves.not.toThrow();

    expect(txCreateMock).toHaveBeenCalledTimes(4);
  });

  // @REQ: NTF-QUEUE-TABLE
  it('AC-B2: wpis powstaje przez tx.notificationQueue.create, nie prisma.notificationQueue.create', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );

    // ROLLBACK_DEF (N_ROLLBACK) ma jeden kanał (EMAIL) — dowód wiązania z `tx`
    // bez wpływu wielokanałowości (osobny test AC-B4b poniżej dowodzi kształtu
    // wielokanałowego dla SHIPPED_DEF).
    expect(ROLLBACK_DEF.channels).toEqual(['EMAIL']);
    txCreateMock.mockResolvedValueOnce({ id: 'row-1', status: 'PENDING', attempts: 0 });
    const tx = makeTx();

    await enqueueNotification(tx as never, {
      notificationId: ROLLBACK_ID,
      idempotencyKey: `${ROLLBACK_ID}:lead-1:T10:bucket-1`,
      leadId: 'lead-1',
    });

    expect(txCreateMock).toHaveBeenCalledTimes(1);
    // Dowód wiązania z tym konkretnym `tx`: `this` wywołania to `tx.notificationQueue`,
    // nie jakiś inny obiekt (ten sam wzorzec co BLOCKER 2 w logistics-rollback-effects.test.ts).
    txCreateMock.mock.contexts.forEach((ctx) => {
      expect(ctx).toBe(tx.notificationQueue);
    });
  });

  // @REQ: NTF-QUEUE-TABLE
  it('AC-B4b: powiadomienie z dwoma kanałami (SMS + EMAIL) tworzy dokładnie dwa wiersze z różnymi idempotencyKey per kanał', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    expect(SHIPPED_DEF.channels).toEqual(expect.arrayContaining(['SMS', 'EMAIL']));
    expect(SHIPPED_DEF.channels.length).toBe(2);

    txCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `row-${data.channel}`,
      ...data,
    }));
    const tx = makeTx();

    const baseKey = `${SHIPPED_ID}:lead-1:T06:tracking-abc`;
    const result = await enqueueNotification(tx as never, {
      notificationId: SHIPPED_ID,
      idempotencyKey: baseKey,
      leadId: 'lead-1',
    });

    expect(txCreateMock).toHaveBeenCalledTimes(2);
    expect(Array.isArray(result)).toBe(true);
    const created = result as { id: string; created: boolean; channel: string }[];
    expect(created).toHaveLength(2);

    const calls = txCreateMock.mock.calls as unknown as [{ data: Record<string, unknown> }][];
    const calledChannels = calls.map(([{ data }]) => data.channel);
    expect(calledChannels.sort()).toEqual(['EMAIL', 'SMS']);

    const calledKeys = calls.map(([{ data }]) => data.idempotencyKey as string);
    expect(new Set(calledKeys).size).toBe(2);
    calledKeys.forEach((key) => {
      expect(key.startsWith(baseKey)).toBe(true);
    });
  });

  // AC-B3: dokładnie jedno z lead/installation/service/incident. Zob. komentarz
  // "DECYZJA PROJEKTOWA" na górze pliku — helper waliduje PRZED zapisem.
  // @REQ: NTF-QUEUE-TABLE
  it('AC-B3: brak żadnego z lead/installation/service/incidentId odrzuca wywołanie bez zapisu', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    const tx = makeTx();

    await expect(
      enqueueNotification(tx as never, {
        notificationId: SHIPPED_ID,
        idempotencyKey: `${SHIPPED_ID}:lead-1:T06:tracking-abc`,
      } as never),
    ).rejects.toThrow();

    expect(txCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: NTF-QUEUE-TABLE
  it('AC-B3: dwa jednocześnie przekazane ID (leadId i installationId) odrzuca wywołanie bez zapisu', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    const tx = makeTx();

    await expect(
      enqueueNotification(tx as never, {
        notificationId: ROLLBACK_ID,
        idempotencyKey: `${ROLLBACK_ID}:lead-1:T10:bucket-1`,
        leadId: 'lead-1',
        installationId: 'inst-1',
      } as never),
    ).rejects.toThrow();

    expect(txCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: NTF-QUEUE-TABLE
  it('AC-B4: channel/templateKey/recipientType pochodzą z NOTIFICATIONS kontraktu (powiadomienie o wysyłce)', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    txCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'row-1',
      ...data,
    }));
    const tx = makeTx();

    await enqueueNotification(tx as never, {
      notificationId: SHIPPED_ID,
      idempotencyKey: `${SHIPPED_ID}:lead-1:T06:tracking-abc`,
      leadId: 'lead-1',
    });

    const [{ data }] = txCreateMock.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.templateKey).toBe(SHIPPED_DEF.templateKey);
    expect(data.recipientType).toBe(SHIPPED_DEF.recipient);
    expect(SHIPPED_DEF.channels).toContain(data.channel);
  });

  // @REQ: NTF-QUEUE-TABLE
  it('AC-B4: channel/templateKey/recipientType pochodzą z NOTIFICATIONS kontraktu (powiadomienie rollback) i różnią się od wysyłki', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    txCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'row-2',
      ...data,
    }));
    const tx = makeTx();

    await enqueueNotification(tx as never, {
      notificationId: ROLLBACK_ID,
      idempotencyKey: `${ROLLBACK_ID}:lead-1:T10:bucket-1`,
      leadId: 'lead-1',
    });

    const [{ data }] = txCreateMock.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.templateKey).toBe(ROLLBACK_DEF.templateKey);
    expect(data.recipientType).toBe(ROLLBACK_DEF.recipient);
    expect(ROLLBACK_DEF.channels).toContain(data.channel);

    // Dowód nie-hardkodowania: dwa różne powiadomienia dają różny templateKey
    // (recipientType celowo identyczny — oba idą do CLIENT wg katalogu NOTIFICATIONS).
    expect(data.templateKey).not.toBe(SHIPPED_DEF.templateKey);
  });

  // @REQ: NTF-QUEUE-TABLE
  it('AC-B5: nowy wiersz jest tworzony ze status=PENDING i attempts=0', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    txCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'row-1',
      ...data,
    }));
    const tx = makeTx();

    await enqueueNotification(tx as never, {
      notificationId: SHIPPED_ID,
      idempotencyKey: `${SHIPPED_ID}:lead-1:T06:tracking-abc`,
      leadId: 'lead-1',
    });

    const [{ data }] = txCreateMock.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.status).toBe('PENDING');
    expect(data.attempts).toBe(0);
  });

  // R4: powiadomienie rollbackowe ma w kontrakcie `bind.transition: 'T10|T11|T12|T13'`
  // — string z pipe'ami, nie tablica. `enqueueNotification` samo w sobie nie
  // dopasowuje przejść (to robi wywołujący przez `findTransition(...).effects`),
  // ale musi umieć odnaleźć definicję po `id` bez łamania się na tym formacie
  // `bind.transition` — ten test dowodzi, że samo wyszukanie po `id` (nie po
  // `bind.transition`) działa niezależnie od kształtu `bind`.
  // @REQ: NTF-QUEUE-TABLE
  it("R4: odnajduje definicję powiadomienia rollback mimo bind.transition w formacie z pipe'ami \"T10|T11|T12|T13\"", async () => {
    expect(ROLLBACK_DEF.bind.transition).toBe('T10|T11|T12|T13');

    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );
    txCreateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'row-3',
      ...data,
    }));
    const tx = makeTx();

    await enqueueNotification(tx as never, {
      notificationId: ROLLBACK_ID,
      idempotencyKey: `${ROLLBACK_ID}:lead-2:T12:bucket-2`,
      leadId: 'lead-2',
    });

    const [{ data }] = txCreateMock.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data.templateKey).toBe(ROLLBACK_DEF.templateKey);
  });

  // BLOCKER (reviewer): `enqueueNotification` musi łapać WYŁĄCZNIE `P2002`
  // (kolizję idempotencji) jako "sukces" — pułapka 3/idempotencja z CLAUDE.md
  // ("cron musi być idempotentny, ale nie wolno połykać prawdziwych awarii pod
  // przykrywką duplikatu"). Błąd Prisma o innym kodzie (tu: `P2003`, naruszenie
  // klucza obcego — np. `leadId` wskazujący na nieistniejący wiersz) musi zostać
  // przepuszczony dalej, nie zamieniony w cichy `{ created: false }`.
  // @REQ: NTF-QUEUE-TABLE
  it('błąd Prisma inny niż P2002 (np. P2003 — naruszenie klucza obcego) jest przepuszczany dalej, nie połykany jako duplikat', async () => {
    const { enqueueNotification } = await import(
      '../src/app/(dashboard)/logistics/rollback-effects'
    );

    const fkError = prismaKnownRequestError('P2003');
    txCreateMock.mockRejectedValueOnce(fkError);
    const tx = makeTx();

    await expect(
      enqueueNotification(tx as never, {
        notificationId: SHIPPED_ID,
        idempotencyKey: `${SHIPPED_ID}:lead-1:T06:tracking-abc`,
        leadId: 'lead-1',
      }),
    ).rejects.toThrow('Prisma error P2003');

    expect(txCreateMock).toHaveBeenCalledTimes(1);
  });
});
