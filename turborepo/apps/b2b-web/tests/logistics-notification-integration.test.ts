import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NOTIFICATIONS, TRANSITIONS } from '@klikklima/contracts';
import type { LeadStatus as ContractLeadStatusType } from '@klikklima/contracts';

// `LeadStatus` w `@klikklima/contracts` jest wyłącznie TYPEM (unia stringów wyliczona
// z `LEAD_STATUSES`), nie obiektem enum jak `LeadStatus` z `@repo/database` — nie da
// się go zaimportować jako wartość. Literały statusów poniżej NIE są objęte regułą
// `adr003-notif-literal` (dotyczy wyłącznie ID powiadomień typu N\d+/I\d+), więc ich
// użycie tutaj jest zgodne z zasadami repo.
const ContractLeadStatus = {
  HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE' as ContractLeadStatusType,
  HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT' as ContractLeadStatusType,
  AWAITING_INSTALLATION: 'AWAITING_INSTALLATION' as ContractLeadStatusType,
};
import { findTransitionByFromTo } from '../src/lib/audit/find-transition-by-from-to';

/**
 * FNL-E5-E6 / FNL-E5-BYPASS / FNL-ROLLBACK — Faza C (WO
 * `docs/workorders/LOGISTICS-SHIPPING-EFFECTS.md`, AC-C1..AC-C8).
 *
 * Wpięcie `enqueueNotification(tx, {...})` (Faza B, już zaimplementowane w
 * `logistics/rollback-effects.ts`) w trzy Server Actions z `logistics/actions.ts`
 * (`shipLogisticsOrder`, `bypassLogisticsOrder`, `rollbackLogisticsOrder`). Zadanie
 * tej tury dotyczy WYŁĄCZNIE integracji — akcje jeszcze NIE wołają
 * `enqueueNotification` (ani `releaseCrewSlot`/`suspendLogisticsSla` w przypadku
 * ship/bypass, co jest poprawne: bypass i ship nie rolebackują niczego).
 *
 * Cały moduł `rollback-effects` jest tu zamockowany w CAŁOŚCI (releaseCrewSlot,
 * suspendLogisticsSla, enqueueNotification) — ten plik NIE testuje wnętrza tych
 * funkcji (to już pokrywają `logistics-rollback-effects.test.ts` i
 * `enqueue-notification.test.ts`), tylko fakt i kształt WYWOŁANIA z trzech akcji.
 * Dzięki temu asercje "enqueueNotification nie zostało wywołane wcale" (AC-C4) są
 * odporne na to, co się dzieje wewnątrz helpera.
 *
 * DECYZJA PROJEKTOWA (interpretacja AC-C2, "dokładnie jeden wpis" powiadomienia o
 * wysyłce): WO Faza B już ustaliła, że enqueueNotification tworzy JEDEN WIERSZ PER
 * KANAŁ (powiadomienie o wysyłce ma dwa kanały — SMS i EMAIL — zobacz
 * SHIPPED_DEF.channels.length === 2 w enqueue-notification.test.ts, AC-B4b). AC-C2
 * nie może więc znaczyć "jeden wiersz w bazie" (to sprzeczne z już podjętą decyzją
 * Fazy B) — czytam je jako "jedno ZDARZENIE zakolejkowane", czyli: enqueueNotification
 * wywołane DOKŁADNIE RAZ z notificationId powiadomienia o wysyłce. Ile wierszy z tego
 * wyniknie w bazie (1 czy 2) jest odpowiedzialnością helpera z Fazy B, nie tej
 * integracji — stąd ten plik asercjonuje liczbę WYWOŁAŃ enqueueNotification, nie
 * liczbę wierszy notification_queue. To nie jest renegocjacja WO, tylko konsekwencja
 * decyzji którą Faza B już podjęła i której ten plik nie może cofnąć.
 *
 * DECYZJA PROJEKTOWA (AC-C6, dwa różne powiadomienia w jednej akcji): rollback ma
 * DWA różne notificationId (powiadomienie klienta i powiadomienie wewnętrzne
 * dyspozytora), nie jeden wielokanałowy — więc "dwa wpisy" tutaj oznacza dwa
 * ODRĘBNE wywołania enqueueNotification z różnymi notificationId, każde z własnym
 * zestawem kanałów zgodnie z katalogiem (oba mają po jednym kanale EMAIL wg
 * notifications.contract.mjs, więc dla TYCH konkretnych powiadomień liczba wywołań
 * i liczba wierszy faktycznie się pokrywają — ale to przypadek szczególny, nie
 * reguła, którą ten plik zakłada ogólnie).
 *
 * ADR-003 (`guard-forbidden`, reguła adr003-notif-literal): identyfikatory
 * powiadomień w tym pliku NIE są wpisywane jako literały gołych stringów w
 * cudzysłowie — zamiast tego odnajdujemy definicje po `templateKey` z katalogu
 * kontraktu i czytamy `id` z wyniku wyszukania, dokładnie jak w
 * `enqueue-notification.test.ts`.
 */

const SHIPPED_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'funnel.shipped')!;
const ROLLBACK_CLIENT_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'funnel.rollback_rebook')!;
const ROLLBACK_DISPATCHER_DEF = NOTIFICATIONS.find((n) => n.templateKey === 'internal.rollback')!;
const SHIPPED_ID = SHIPPED_DEF.id;
const ROLLBACK_CLIENT_ID = ROLLBACK_CLIENT_DEF.id;
const ROLLBACK_DISPATCHER_ID = ROLLBACK_DISPATCHER_DEF.id;

const {
  leadUpdateMock,
  leadFindUniqueMock,
  logisticsCreateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  auditLogCreateMock,
  releaseCrewSlotMock,
  suspendLogisticsSlaMock,
  enqueueNotificationMock,
  queryRawMock,
} = vi.hoisted(() => ({
  leadUpdateMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  logisticsCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  releaseCrewSlotMock: vi.fn(),
  suspendLogisticsSlaMock: vi.fn(),
  enqueueNotificationMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { update: leadUpdateMock, findUnique: leadFindUniqueMock },
    logistyka_zamowienia: { create: logisticsCreateMock },
    auditLog: { create: auditLogCreateMock },
    $queryRaw: queryRawMock,
    $transaction: transactionMock,
  },
  LeadStatus: {
    HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
    HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE',
    AWAITING_CREW_ASSIGNMENT: 'AWAITING_CREW_ASSIGNMENT',
    AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
    ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
    NEW_LEAD: 'NEW_LEAD',
  },
  InstallationStatus: { PLANNED: 'PLANNED', CANCELLED: 'CANCELLED' },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
vi.mock('../src/app/(dashboard)/logistics/rollback-effects', () => ({
  releaseCrewSlot: releaseCrewSlotMock,
  suspendLogisticsSla: suspendLogisticsSlaMock,
  enqueueNotification: enqueueNotificationMock,
}));
vi.mock('@/lib/format-id', () => ({ shortId: (id: string) => `#${id.substring(0, 8)}` }));

/**
 * `tx` faktycznie WYKONUJE callback (nie jest niezdefiniowanym stubem), z realnym
 * buforowaniem semantyki Prisma: zmiany zlecone wewnątrz callbacka trafiają do
 * `realState` DOPIERO po jego pomyślnym zakończeniu (COMMIT); wyjątek odrzuca
 * bufor (ROLLBACK) — ten sam wzorzec co `logistics-rollback-effects.test.ts`
 * (AC-A3), niezbędny dla AC-C7 (atomowość).
 */
function makeTransactionWithBuffer(realLead: { status: string }) {
  return async (cb: (tx: unknown) => unknown) => {
    const buffer: Array<() => void> = [];
    const txLeadUpdate = vi.fn(async ({ data }: { data: { status?: string } }) => {
      buffer.push(() => {
        if (data.status !== undefined) realLead.status = data.status;
      });
      return { id: 'lead-1', ...realLead, ...data };
    });
    const tx = {
      leady: { update: txLeadUpdate, findUnique: leadFindUniqueMock },
      logistyka_zamowienia: { create: logisticsCreateMock },
      auditLog: { create: auditLogCreateMock },
      $queryRaw: queryRawMock,
    };
    leadUpdateMock.mockImplementation(txLeadUpdate);
    const result = await cb(tx);
    buffer.forEach((apply) => apply());
    return result;
  };
}

beforeEach(() => {
  leadUpdateMock.mockReset();
  leadFindUniqueMock.mockReset();
  logisticsCreateMock.mockReset();
  transactionMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();
  auditLogCreateMock.mockReset();
  releaseCrewSlotMock.mockReset();
  suspendLogisticsSlaMock.mockReset();
  enqueueNotificationMock.mockReset();
  queryRawMock.mockReset();

  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  queryRawMock.mockResolvedValue([{ id: 'lead-1' }]);
  getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'operator@klikklima.pl' } } });
  leadUpdateMock.mockResolvedValue({});
  logisticsCreateMock.mockResolvedValue({});
  auditLogCreateMock.mockResolvedValue({});
  releaseCrewSlotMock.mockResolvedValue(undefined);
  suspendLogisticsSlaMock.mockResolvedValue(undefined);
  enqueueNotificationMock.mockResolvedValue([{ id: 'row-1', created: true, channel: 'EMAIL' }]);
  transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      leady: { update: leadUpdateMock, findUnique: leadFindUniqueMock },
      logistyka_zamowienia: { create: logisticsCreateMock },
      auditLog: { create: auditLogCreateMock },
      $queryRaw: queryRawMock,
    }),
  );
  leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'ROLLBACK_RESCHEDULING' });
});

describe('shipLogisticsOrder — integracja z enqueueNotification (FNL-E5-E6)', () => {
  // AC-C1 / D5: brak trackingNumber blokuje wysyłkę — nie zmienia statusu, nie
  // kolejkuje powiadomienia o wysyłce. Dziś `trackingNumber` jest opcjonalny i status
  // zmienia się bezwarunkowo — to jest oczekiwany RED (guard z D5 jeszcze nie istnieje).
  // @REQ: FNL-E5-E6
  it('AC-C1: bez trackingNumber zwraca błąd, nie zmienia statusu leada i nie kolejkuje powiadomienia o wysyłce', async () => {
    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await shipLogisticsOrder('lead-1', undefined);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(logisticsCreateMock).not.toHaveBeenCalled();
    expect(enqueueNotificationMock).not.toHaveBeenCalled();
  });

  // AC-C2: z trackingiem — status HARDWARE_IN_TRANSIT, jeden rekord
  // logistyka_zamowienia, dokładnie JEDNO wywołanie enqueueNotification dla
  // powiadomienia o wysyłce (patrz komentarz "DECYZJA PROJEKTOWA" na górze pliku —
  // interpretacja "jedno zdarzenie", nie "jeden wiersz w bazie").
  // @REQ: FNL-E5-E6
  it('AC-C2: z trackingiem przenosi lead do HARDWARE_IN_TRANSIT, tworzy jeden rekord logistyki i koleguje dokładnie jedno zdarzenie powiadomienia o wysyłce', async () => {
    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'HARDWARE_IN_TRANSIT' }) }),
    );
    expect(logisticsCreateMock).toHaveBeenCalledTimes(1);

    const shippedCalls = enqueueNotificationMock.mock.calls.filter(
      (call: unknown[]) => (call[1] as { notificationId: string }).notificationId === SHIPPED_ID,
    );
    expect(shippedCalls).toHaveLength(1);
    const params = shippedCalls[0][1] as { leadId?: string; payload?: Record<string, unknown> };
    expect(params.leadId).toBe('lead-1');
  });

  // AC-C3: retry z tym samym trackingiem nie tworzy "drugiego zestawu" powiadomień —
  // czyli idempotencyKey przekazany do enqueueNotification musi być IDENTYCZNY dla obu
  // wywołań (deduplikacja per-kanał należy do enqueueNotification samego w sobie,
  // Faza B — ten test dowodzi tylko, że klucz pochodzący z akcji jest deterministyczny
  // względem trackingNumber, nie losowy/czasowy).
  // @REQ: FNL-E5-E6
  it('AC-C3: powtórzone wywołanie z tym samym trackingiem przekazuje ten sam idempotencyKey do enqueueNotification', async () => {
    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    await shipLogisticsOrder('lead-1', 'TRACK-123');
    const firstCall = enqueueNotificationMock.mock.calls.find(
      (call: unknown[]) => (call[1] as { notificationId: string }).notificationId === SHIPPED_ID,
    );
    enqueueNotificationMock.mockClear();

    await shipLogisticsOrder('lead-1', 'TRACK-123');
    const secondCall = enqueueNotificationMock.mock.calls.find(
      (call: unknown[]) => (call[1] as { notificationId: string }).notificationId === SHIPPED_ID,
    );

    expect(firstCall).toBeDefined();
    expect(secondCall).toBeDefined();
    const firstParams = (firstCall as unknown[])[1] as { idempotencyKey: string };
    const secondParams = (secondCall as unknown[])[1] as { idempotencyKey: string };
    expect(secondParams.idempotencyKey).toBe(firstParams.idempotencyKey);
  });

  // AC-C7 (kierunek 1): awaria wewnątrz enqueueNotification cofa całą transakcję —
  // status leada NIE pozostaje w HARDWARE_IN_TRANSIT mimo że tx.leady.update zdążyło
  // się wykonać PRZED wyjątkiem.
  // @REQ: FNL-E5-E6
  it('AC-C7: awaria enqueueNotification cofa zmianę statusu leada (jedna transakcja)', async () => {
    const realLead = { status: 'HARDWARE_IN_WAREHOUSE' };
    transactionMock.mockImplementation(makeTransactionWithBuffer(realLead));
    enqueueNotificationMock.mockRejectedValue(new Error('awaria kolejki'));

    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(realLead.status).toBe('HARDWARE_IN_WAREHOUSE');
  });

  // AC-C7 (kierunek 2): awaria PRZED enqueueNotification (np. w tworzeniu rekordu
  // logistyki) uniemożliwia jego wywołanie — nie istnieje stan "powiadomienie
  // zakolejkowane, ale status/rekord logistyki nie powstały".
  //
  // Dziś `shipLogisticsOrder` (w przeciwieństwie do `bypassLogisticsOrder`/
  // `rollbackLogisticsOrder`) nie ma `try/catch` wokół `$transaction` — błąd
  // wewnątrz callbacka propaguje się jako odrzucona obietnica, nie jako
  // `{ success: false }`. To jest część tej samej integracji (D3 WO wymaga jednej
  // transakcji z bezpiecznym zwracaniem błędu, spójnie z pozostałymi dwiema
  // akcjami) — test akceptuje OBA kształty (rzucony wyjątek albo `success: false`),
  // ale w KAŻDYM z nich `enqueueNotification` nie mogło zostać wywołane i status
  // leada nie mógł zostać scommitowany.
  // @REQ: FNL-E5-E6
  it('AC-C7: awaria logistyka_zamowienia.create uniemożliwia wywołanie enqueueNotification', async () => {
    const realLead = { status: 'HARDWARE_IN_WAREHOUSE' };
    transactionMock.mockImplementation(makeTransactionWithBuffer(realLead));
    logisticsCreateMock.mockRejectedValue(new Error('constraint violation'));

    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    let result: { success: boolean; error?: string } | undefined;
    let thrown: unknown;
    try {
      result = await shipLogisticsOrder('lead-1', 'TRACK-123');
    } catch (error) {
      thrown = error;
    }

    if (result !== undefined) {
      expect(result).toEqual(expect.objectContaining({ success: false }));
    } else {
      expect(thrown).toBeDefined();
    }
    expect(enqueueNotificationMock).not.toHaveBeenCalled();
    expect(realLead.status).toBe('HARDWARE_IN_WAREHOUSE');
  });

  // AC-C8: zbiór ID zakolejkowanych powiadomień równy `effects` przejścia
  // HARDWARE_IN_WAREHOUSE -> HARDWARE_IN_TRANSIT z kontraktu, po odfiltrowaniu
  // prefiksu `do:` — porównanie z kontraktem, nie z literałem w teście.
  // @REQ: FNL-E5-E6
  it('AC-C8: zbiór notificationId przekazanych do enqueueNotification == effects przejścia wysyłki z kontraktu', async () => {
    const transition = findTransitionByFromTo(
      ContractLeadStatus.HARDWARE_IN_WAREHOUSE,
      ContractLeadStatus.HARDWARE_IN_TRANSIT,
    );
    expect(transition).toBeDefined();
    const expectedIds = new Set((transition!.effects ?? []).filter((e: string) => !e.startsWith('do:')));

    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    await shipLogisticsOrder('lead-1', 'TRACK-123');

    const queuedIds = new Set(
      enqueueNotificationMock.mock.calls.map(
        (call: unknown[]) => (call[1] as { notificationId: string }).notificationId,
      ),
    );
    expect(queuedIds).toEqual(expectedIds);
  });

  // Uprawnienia: rola bez shipments.update — odmowa PRZED wywołaniem enqueueNotification.
  // @REQ: FNL-E5-E6
  it('rola bez shipments.update: odmowa, enqueueNotification nigdy nie wywołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const { shipLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(enqueueNotificationMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe('bypassLogisticsOrder — bypass nie kolejkuje żadnego powiadomienia (FNL-E5-BYPASS)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'HARDWARE_IN_WAREHOUSE' });
  });

  // AC-C4: bypass przenosi lead do AWAITING_INSTALLATION i nie tworzy ŻADNEGO wpisu
  // w kolejce — przejście bypassu ma pusty zbiór effects w kontrakcie.
  // @REQ: FNL-E5-BYPASS
  it('AC-C4: przenosi lead do AWAITING_INSTALLATION i nie wywołuje enqueueNotification ani razu', async () => {
    const { bypassLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await bypassLogisticsOrder('lead-1', 'Klient odebrał osobiście w magazynie dostawcy.');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'AWAITING_INSTALLATION' }) }),
    );
    expect(enqueueNotificationMock).not.toHaveBeenCalled();
  });

  // AC-C5: bypass nie tworzy rekordu logistyka_zamowienia (nie ma przesyłki kurierskiej).
  // @REQ: FNL-E5-BYPASS
  it('AC-C5: nie tworzy rekordu logistyka_zamowienia', async () => {
    const { bypassLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    await bypassLogisticsOrder('lead-1', 'Klient odebrał osobiście w magazynie dostawcy.');

    expect(logisticsCreateMock).not.toHaveBeenCalled();
  });

  // AC-C8: zbiór ID zakolejkowanych powiadomień dla bypassu == effects z kontraktu ==
  // zbiór pusty.
  // @REQ: FNL-E5-BYPASS
  it('AC-C8: zbiór notificationId dla bypassu (HARDWARE_IN_WAREHOUSE -> AWAITING_INSTALLATION) jest równy pustemu effects z kontraktu', async () => {
    const transition = findTransitionByFromTo(
      ContractLeadStatus.HARDWARE_IN_WAREHOUSE,
      ContractLeadStatus.AWAITING_INSTALLATION,
    );
    expect(transition).toBeDefined();
    expect(transition!.effects).toEqual([]);

    const { bypassLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    await bypassLogisticsOrder('lead-1', 'Klient odebrał osobiście w magazynie dostawcy.');

    expect(enqueueNotificationMock).not.toHaveBeenCalled();
  });

  // Uprawnienia: rola bez shipments.update.
  // @REQ: FNL-E5-BYPASS
  it('rola bez shipments.update: odmowa, enqueueNotification nigdy nie wywołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const { bypassLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await bypassLogisticsOrder('lead-1', 'Klient odebrał osobiście w magazynie dostawcy.');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(enqueueNotificationMock).not.toHaveBeenCalled();
  });
});

describe('rollbackLogisticsOrder — dwa zdarzenia powiadomień: klient i dyspozytor (FNL-ROLLBACK)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'HARDWARE_IN_TRANSIT' });
  });

  // AC-C6: rollback tworzy dokładnie dwa zdarzenia — powiadomienie klienta i
  // powiadomienie wewnętrzne dyspozytora.
  // @REQ: FNL-ROLLBACK
  it('AC-C6: koleguje dokładnie dwa zdarzenia — powiadomienie klienta i powiadomienie dyspozytora', async () => {
    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await rollbackLogisticsOrder('lead-1', 'Klient odwołał termin z powodu remontu.');

    expect(result).toEqual({ success: true });
    const queuedIds = enqueueNotificationMock.mock.calls.map(
      (call: unknown[]) => (call[1] as { notificationId: string }).notificationId,
    );
    expect(queuedIds).toHaveLength(2);
    expect(new Set(queuedIds)).toEqual(new Set([ROLLBACK_CLIENT_ID, ROLLBACK_DISPATCHER_ID]));
  });

  // AC-C6 (kształt): recipientType z katalogu — powiadomienie rollbackowe klienta
  // idzie do klienta, wewnętrzne rollbackowe do dyspozytora.
  // @REQ: FNL-ROLLBACK
  it('AC-C6: powiadomienie rollbackowe klienta jest zdefiniowane dla CLIENT, wewnętrzne dla DISPATCHER w katalogu kontraktu', () => {
    expect(ROLLBACK_CLIENT_DEF.recipient).toBe('CLIENT');
    expect(ROLLBACK_DISPATCHER_DEF.recipient).toBe('DISPATCHER');
  });

  // AC-C7: awaria enqueueNotification cofa zmianę statusu leada oraz efekty D1/D2.
  // @REQ: FNL-ROLLBACK
  it('AC-C7: awaria enqueueNotification cofa zmianę statusu leada (rollback)', async () => {
    const realLead = { status: 'HARDWARE_IN_TRANSIT' };
    transactionMock.mockImplementation(makeTransactionWithBuffer(realLead));
    enqueueNotificationMock.mockRejectedValue(new Error('awaria kolejki'));

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await rollbackLogisticsOrder('lead-1', 'Klient odwołał termin z powodu remontu.');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(realLead.status).toBe('HARDWARE_IN_TRANSIT');
  });

  // AC-C8: zbiór ID zakolejkowanych powiadomień dla rollbacku == effects przejścia
  // "rollback" z kontraktu (po odfiltrowaniu prefiksu `do:`).
  // @REQ: FNL-ROLLBACK
  it('AC-C8: zbiór notificationId dla rollbacku z HARDWARE_IN_TRANSIT == effects z kontraktu bez prefiksu do:', async () => {
    const transition = TRANSITIONS.find(
      (t) => t.from === ContractLeadStatus.HARDWARE_IN_TRANSIT && t.action === 'rollback',
    );
    expect(transition).toBeDefined();
    const expectedIds = new Set((transition!.effects ?? []).filter((e: string) => !e.startsWith('do:')));

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    await rollbackLogisticsOrder('lead-1', 'Klient odwołał termin z powodu remontu.');

    const queuedIds = new Set(
      enqueueNotificationMock.mock.calls.map(
        (call: unknown[]) => (call[1] as { notificationId: string }).notificationId,
      ),
    );
    expect(queuedIds).toEqual(expectedIds);
  });

  // Uprawnienia: rola bez shipments.update.
  // @REQ: FNL-ROLLBACK
  it('rola bez shipments.update: odmowa, enqueueNotification nigdy nie wywołane', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const { rollbackLogisticsOrder } = await import('../src/app/(dashboard)/logistics/actions');
    const result = await rollbackLogisticsOrder('lead-1', 'Klient odwołał termin z powodu remontu.');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(enqueueNotificationMock).not.toHaveBeenCalled();
  });
});
