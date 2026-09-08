import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * SEC-AUTHZ-B2B-MUTATIONS — pokrycie dla `logistics/actions.ts`
 * (`docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`, findings #9-13).
 *
 * `shipLogisticsOrder`, `bypassLogisticsOrder`, `markAsDelivered`,
 * `rollbackLogisticsOrder` — bramka `can(role, 'leads', 'update') === 'yes'`
 * (decyzja Z1 z WO: pelny zestaw `['admin', 'dyspozytor']`, NIE sam dyspozytor —
 * pole `actor` w `funnel.contract.mjs` opisuje typowego wykonawce przejscia, nie
 * liste uprawnionych rol; zawezenie do samego dyspozytora odebraloby adminowi
 * prawa, ktore ma wszedzie indziej w macierzy).
 *
 * `shipLogisticsOrder` i `markAsDelivered` mutuja DWA zasoby
 * (`leads` przez `tx.leady.update` + `shipments` przez
 * `tx.logistyka_zamowienia.create`/`.update`) WEWNATRZ `$transaction` — AC8 wymaga,
 * zeby sprawdzenie stalo PRZED otwarciem transakcji, wiec mock `$transaction`
 * MUSI faktycznie wykonac przekazany callback (nie zostac nieuruchomiony), inaczej
 * "prisma nie wolane gdy odrzucone" byloby fałszywie zielone przez nieuruchomiony
 * callback, a nie przez realna bramke.
 *
 * `deleteLogisticsOrderAction` (AC13) — konsolidacja: ciało deleguje do
 * `deleteLeadAction` zaimportowanej z `leads/actions.ts`, zamiast wlasnej bramki i
 * wlasnego `prisma.leady.delete()`. Rola JEST juz wyczerpujaco przetestowana w
 * `leads-delete-admin-only.test.ts` — ten plik NIE testuje roli bezposrednio dla tej
 * funkcji, tylko delegacje.
 *
 * Sygnatura docelowa pozostalych czterech funkcji: dzis `void`, po naprawie
 * `{ success: boolean; error?: string }` (edge case WO "Odmowa odroznialna od
 * sukcesu" — `logistics-client.tsx:270,290,297,309`).
 *
 * Mockujemy @repo/database (w tym `$transaction` jako realne wykonanie callbacka z
 * tx = ten sam obiekt co `prisma`, zgodnie z wzorcem `crews-admin-gates.test.ts`),
 * next/cache (revalidatePath) i ../src/utils/supabase/server (getCurrentActorRole).
 * `deleteLeadAction` z `leads/actions.ts` jest mockowana jako modul dla testu AC13.
 */

const {
  leadUpdateMock,
  leadFindUniqueMock,
  leadDeleteMock,
  logisticsCreateMock,
  logisticsFindFirstMock,
  logisticsUpdateMock,
  instalacjeUpdateMock,
  instalacjeFindManyMock,
  queryRawMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  deleteLeadActionMock,
  auditLogCreateMock,
  notificationQueueCreateMock,
} = vi.hoisted(() => ({
  leadUpdateMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  leadDeleteMock: vi.fn(),
  logisticsCreateMock: vi.fn(),
  logisticsFindFirstMock: vi.fn(),
  logisticsUpdateMock: vi.fn(),
  instalacjeUpdateMock: vi.fn(),
  instalacjeFindManyMock: vi.fn(),
  queryRawMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  deleteLeadActionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  notificationQueueCreateMock: vi.fn().mockResolvedValue({ id: 'nq-mock-id' }),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      update: leadUpdateMock,
      findUnique: leadFindUniqueMock,
      delete: leadDeleteMock,
    },
    // Wymagane od rollbackLogisticsOrder (FNL-ROLLBACK, D1/D2) — releaseCrewSlot
    // czyta/mutuje `instalacje` przez blokade FOR UPDATE wewnatrz $transaction.
    // Ten plik NIE testuje efektow rollbacku (to `logistics-rollback-effects.test.ts`),
    // tylko bramke roli — mocki tutaj sa minimalne, zeby callback nie wyrzucal wyjatku.
    instalacje: {
      update: instalacjeUpdateMock,
      findMany: instalacjeFindManyMock,
    },
    logistyka_zamowienia: {
      create: logisticsCreateMock,
      findFirst: logisticsFindFirstMock,
      update: logisticsUpdateMock,
    },
    // SEC-AUDIT-LOG-MANUAL-STATUS (Fala B): bypassLogisticsOrder/rollbackLogisticsOrder
    // pisza wpis audytowy WEWNATRZ tej samej transakcji co zmiane statusu — mockowany
    // tu i w `makeTxImplementation()`, zeby callback $transaction sie nie wywalil.
    auditLog: { create: auditLogCreateMock },
    // LOGISTICS-SHIPPING-EFFECTS (Faza C): shipLogisticsOrder/rollbackLogisticsOrder
    // wolaja odtad enqueueNotification(tx, {...}) wewnatrz $transaction, ktora
    // uzywa tx.notificationQueue.create. Ten plik nie testuje efektow powiadomien
    // (patrz enqueue-notification.test.ts, logistics-notification-integration.test.ts),
    // wiec mock jest neutralnym, zawsze-sukces fixture'em.
    notificationQueue: { create: notificationQueueCreateMock },
    $queryRaw: queryRawMock,
    $transaction: transactionMock,
  },
  LeadStatus: {
    HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
    AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
    ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
    HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE',
    AWAITING_CREW_ASSIGNMENT: 'AWAITING_CREW_ASSIGNMENT',
  },
  InstallationStatus: {
    CANCELLED: 'CANCELLED',
    PLANNED: 'PLANNED',
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
vi.mock('../src/app/(dashboard)/leads/actions', () => ({
  deleteLeadAction: deleteLeadActionMock,
}));
// `logistics/actions.ts` importuje `shortId` z `@/lib/format-id` (nierozwiązywalne bez
// aliasu `@/*` w vitest.config.mts). Ten plik nie asercjonuje pola `id` zwróconego przez
// `getLogisticsLeads`, więc mock powtarza prawdziwą implementację zamiast zerować
// zachowanie produkcyjne.
vi.mock('@/lib/format-id', () => ({ shortId: (id: string) => `#${id.substring(0, 8)}` }));

const {
  shipLogisticsOrder,
  bypassLogisticsOrder,
  markAsDelivered,
  rollbackLogisticsOrder,
  deleteLogisticsOrderAction,
} = await import('../src/app/(dashboard)/logistics/actions');

// Mechanicznie zaktualizowane pod SEC-AUDIT-LOG-DELETE: deleteLeadAction (do ktorej
// deleteLogisticsOrderAction deleguje) przyjmuje odtad drugi parametr
// input: { justification, legalBasis } — ten plik dowodzi WYLACZNIE delegacji (AC13),
// wiec VALID_INPUT jest tu przekazywane bez wlasnej walidacji.
const VALID_INPUT = {
  justification: 'Duplikat zamowienia logistycznego utworzony przez pomylke operatora.',
  legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
};

// Mechanicznie zaktualizowane pod SEC-AUDIT-LOG-MANUAL-STATUS (Fala B):
// bypassLogisticsOrder/rollbackLogisticsOrder wymagaja odtad obowiazkowego
// `reason: string` (>=10 znakow po trim, `deleteJustificationSchema.shape.justification`).
// Ten plik dowodzi WYLACZNIE bramki roli tych funkcji (efekty audytu pokrywa
// `sec-audit-log-manual-status-wave-b.test.ts`), wiec VALID_REASON jest tu
// przekazywany bez wlasnej walidacji progu.
const VALID_REASON = 'Uzasadnienie operatora na potrzeby testu bramki roli.';

const LEADS_UPDATE_ALLOWED = ROLES.filter((r) => can(r, 'leads', 'update') === 'yes');
const LEADS_UPDATE_DENIED = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');

// `tx` faktycznie wykonuje callback z tym samym zestawem mockow co `prisma` — jesli
// bramka nie stoi przed $transaction, callback faktycznie odpali i zapisy beda
// widoczne w asercjach ponizej (dowod prawdziwego RED, nie fałszywie zielonego testu
// przez nieuruchomiony callback).
function makeTxImplementation() {
  return async (cb: (tx: unknown) => unknown) =>
    cb({
      leady: { update: leadUpdateMock, findUnique: leadFindUniqueMock },
      logistyka_zamowienia: {
        create: logisticsCreateMock,
        findFirst: logisticsFindFirstMock,
        update: logisticsUpdateMock,
      },
      instalacje: {
        update: instalacjeUpdateMock,
        findMany: instalacjeFindManyMock,
      },
      auditLog: { create: auditLogCreateMock },
      notificationQueue: { create: notificationQueueCreateMock },
      $queryRaw: queryRawMock,
    });
}

describe('shipLogisticsOrder — bramka roli, dwa zasoby w jednej transakcji (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    leadUpdateMock.mockReset();
    logisticsCreateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    transactionMock.mockImplementation(makeTxImplementation());
  });

  // AC8: sprawdzenie stoi PRZED $transaction — dla roli bez leads.update ANI status
  // leada, ANI rekord logistyki nie moga powstac (brak stanu posredniego).
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_DENIED)(
    'rola %s jest odrzucona, ani leady.update ani logistyka_zamowienia.create nie sa wywolane, transakcja sie nie otwiera',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'leads', 'update')).not.toBe('yes');

      const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

      expect(getCurrentActorRoleMock).toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(logisticsCreateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(transactionMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(transactionMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla admin i dyspozytor OSOBNO (AC3, Z1) — bez tego test
  // przechodzilby tez dla bramki blednie zawezonej do samego dyspozytora.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_ALLOWED)('rola %s jest dozwolona, transakcja wykonuje obie mutacje', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    leadUpdateMock.mockResolvedValue({});
    logisticsCreateMock.mockResolvedValue({});

    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalled();
    expect(logisticsCreateMock).toHaveBeenCalled();
  });

  // Kontrola pozytywna kontraktu (Z1) — pelny zestaw admin+dyspozytor, nie sam
  // dyspozytor.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('kontrola pozytywna kontraktu — admin i dyspozytor maja update na leads (Z1)', () => {
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);
    expect(can('admin', 'leads', 'update')).toBe('yes');
    expect(can('dyspozytor', 'leads', 'update')).toBe('yes');
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await shipLogisticsOrder('lead-1', 'TRACK-123');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

describe('bypassLogisticsOrder — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    leadUpdateMock.mockReset();
    leadFindUniqueMock.mockReset();
    transactionMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentUserMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    // Fail-closed domyślny: ten plik nie testuje ścieżek zależnych od e-maila
    // poza jedną kontrolą pozytywną poniżej, która nadpisuje ten mock lokalnie.
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });
    transactionMock.mockImplementation(makeTxImplementation());
    // Wymagane wyłącznie przez kontrolę pozytywną (SEC-AUDIT-LOG-MANUAL-STATUS,
    // Fala B): bypassLogisticsOrder odrzuca bypass dla statusu innego niż
    // HARDWARE_IN_WAREHOUSE — testy odmowy roli kończą się przed tym sprawdzeniem,
    // więc wartość domyślna jest tu neutralna (nieużywana) dla nich.
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'HARDWARE_IN_WAREHOUSE' });
    auditLogCreateMock.mockResolvedValue({});
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_DENIED)(
    'rola %s jest odrzucona, leady.update nie jest wywolane ani razu',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await bypassLogisticsOrder('lead-1', VALID_REASON);

      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await bypassLogisticsOrder('lead-1', VALID_REASON);

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await bypassLogisticsOrder('lead-1', VALID_REASON);

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla admin i dyspozytor OSOBNO.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_ALLOWED)('rola %s jest dozwolona, leady.update faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'operator@klikklima.pl' } } });
    leadUpdateMock.mockResolvedValue({});

    const result = await bypassLogisticsOrder('lead-1', VALID_REASON);

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await bypassLogisticsOrder('lead-1', VALID_REASON);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

describe('markAsDelivered — bramka roli, dwa zasoby w jednej transakcji (SEC-AUTHZ-B2B-MUTATIONS, Z2)', () => {
  beforeEach(() => {
    leadUpdateMock.mockReset();
    logisticsFindFirstMock.mockReset();
    logisticsUpdateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    transactionMock.mockImplementation(makeTxImplementation());
  });

  // AC8: dla roli bez leads.update ani status leada, ani status zlecenia logistyki
  // nie moga sie zmienic — transakcja sie nie otwiera.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_DENIED)(
    'rola %s jest odrzucona, ani leady.update ani logistyka_zamowienia.update nie sa wywolane, transakcja sie nie otwiera',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await markAsDelivered('lead-1');

      expect(transactionMock).not.toHaveBeenCalled();
      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(logisticsUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await markAsDelivered('lead-1');

    expect(transactionMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await markAsDelivered('lead-1');

    expect(transactionMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla admin i dyspozytor OSOBNO.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_ALLOWED)('rola %s jest dozwolona, transakcja wykonuje obie mutacje', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    leadUpdateMock.mockResolvedValue({});
    logisticsFindFirstMock.mockResolvedValue({ id: 'order-1' });
    logisticsUpdateMock.mockResolvedValue({});

    const result = await markAsDelivered('lead-1');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalled();
    expect(logisticsUpdateMock).toHaveBeenCalled();
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    const result = await markAsDelivered('lead-1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

describe('rollbackLogisticsOrder — bramka roli (SEC-AUTHZ-B2B-MUTATIONS)', () => {
  beforeEach(() => {
    leadUpdateMock.mockReset();
    leadFindUniqueMock.mockReset();
    instalacjeUpdateMock.mockReset();
    instalacjeFindManyMock.mockReset();
    queryRawMock.mockReset();
    transactionMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentUserMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    // Fail-closed domyślny: nadpisywany lokalnie w kontroli pozytywnej poniżej.
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });
    auditLogCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(makeTxImplementation());
    // Lead w stanie z zakresu T10-T13 (`funnel.contract.mjs`), zeby
    // findTransition(status, 'rollback') faktycznie znalazlo przejscie — ten plik
    // testuje WYLACZNIE bramke roli (patrz `logistics-rollback-effects.test.ts` dla
    // efektow releaseCrewSlot/suspendLogisticsSla), wiec brak wierszy `instalacje`
    // jest tu celowo neutralny (petla w releaseCrewSlot po prostu nic nie zrobi).
    leadFindUniqueMock.mockResolvedValue({ id: 'lead-1', status: 'HARDWARE_IN_TRANSIT' });
    queryRawMock.mockResolvedValue([]);
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_DENIED)(
    'rola %s jest odrzucona, leady.update nie jest wywolane ani razu',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await rollbackLogisticsOrder('lead-1', VALID_REASON);

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await rollbackLogisticsOrder('lead-1', VALID_REASON);

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla admin i dyspozytor OSOBNO.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_ALLOWED)('rola %s jest dozwolona, leady.update faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'operator@klikklima.pl' } } });
    leadUpdateMock.mockResolvedValue({});

    const result = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await rollbackLogisticsOrder('lead-1', VALID_REASON);

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
  });
});

describe('shipLogisticsOrder/bypassLogisticsOrder/rollbackLogisticsOrder — koniunkcja z shipments.update (punkt 17, BATCH-MEDIUM-LOW-CLEANUP)', () => {
  /**
   * Dziś te trzy funkcje sprawdzają wyłącznie `can(role, 'leads', 'update')`.
   * Docelowo: `can(role, 'leads', 'update') === 'yes' && can(role, 'shipments',
   * 'update') === 'yes'`. Macierz kontraktu ma dziś te same role na obu
   * zasobach (`shipments` lustrzane do `leads`), więc bez podmiany `can` ten
   * test nie miałby szansy odróżnić bramki jednoresursowej od koniunkcji —
   * stąd mock modułu `@klikklima/contracts`, w którym `leads.update` przechodzi,
   * a `shipments.update` jest jawnie odrzucone dla tej samej roli. Jeżeli
   * funkcja sprawdza tylko `leads`, akcja się powiedzie mimo odmowy na
   * `shipments` — to jest oczekiwany, dzisiejszy RED.
   */
  beforeEach(() => {
    leadUpdateMock.mockReset();
    logisticsCreateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    transactionMock.mockImplementation(makeTxImplementation());
    leadUpdateMock.mockResolvedValue({});
    logisticsCreateMock.mockResolvedValue({});
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('shipLogisticsOrder odmawia, gdy leads.update przechodzi, ale shipments.update jest odrzucone dla tej roli', async () => {
    vi.doMock('@klikklima/contracts', async () => {
      const actual = await vi.importActual<typeof import('@klikklima/contracts')>('@klikklima/contracts');
      return {
        ...actual,
        can: (role: import('@klikklima/contracts').Role, resource: string, action: import('@klikklima/contracts').Capability) =>
          resource === 'shipments' && action === 'update' ? 'no' : actual.can(role, resource, action),
      };
    });
    vi.resetModules();
    const { shipLogisticsOrder: patchedShip } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await patchedShip('lead-1', 'TRACK-123');

    expect(result?.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
    vi.doUnmock('@klikklima/contracts');
    vi.resetModules();
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('bypassLogisticsOrder odmawia, gdy leads.update przechodzi, ale shipments.update jest odrzucone dla tej roli', async () => {
    vi.doMock('@klikklima/contracts', async () => {
      const actual = await vi.importActual<typeof import('@klikklima/contracts')>('@klikklima/contracts');
      return {
        ...actual,
        can: (role: import('@klikklima/contracts').Role, resource: string, action: import('@klikklima/contracts').Capability) =>
          resource === 'shipments' && action === 'update' ? 'no' : actual.can(role, resource, action),
      };
    });
    vi.resetModules();
    const { bypassLogisticsOrder: patchedBypass } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await patchedBypass('lead-1', VALID_REASON);

    expect(result?.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
    vi.doUnmock('@klikklima/contracts');
    vi.resetModules();
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('rollbackLogisticsOrder odmawia, gdy leads.update przechodzi, ale shipments.update jest odrzucone dla tej roli', async () => {
    vi.doMock('@klikklima/contracts', async () => {
      const actual = await vi.importActual<typeof import('@klikklima/contracts')>('@klikklima/contracts');
      return {
        ...actual,
        can: (role: import('@klikklima/contracts').Role, resource: string, action: import('@klikklima/contracts').Capability) =>
          resource === 'shipments' && action === 'update' ? 'no' : actual.can(role, resource, action),
      };
    });
    vi.resetModules();
    const { rollbackLogisticsOrder: patchedRollback } = await import('../src/app/(dashboard)/logistics/actions');

    const result = await patchedRollback('lead-1', 'powod');

    expect(result?.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
    vi.doUnmock('@klikklima/contracts');
    vi.resetModules();
  });
});

describe('deleteLogisticsOrderAction — konsolidacja do deleteLeadAction (SEC-AUTHZ-B2B-MUTATIONS, AC13)', () => {
  beforeEach(() => {
    leadDeleteMock.mockReset();
    revalidatePathMock.mockReset();
    deleteLeadActionMock.mockReset();
  });

  // AC13: ciało deleguje do deleteLeadAction zaimportowanej z leads/actions.ts, NIE
  // zawiera wlasnej bramki ani wlasnego prisma.leady.delete(). Rola jest juz
  // przetestowana wyczerpujaco gdzie indziej — ten test dowodzi WYLACZNIE delegacji.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('woła zaimportowana deleteLeadAction z leadId i zwraca jej wynik (sukces)', async () => {
    deleteLeadActionMock.mockResolvedValue({ success: true });

    const result = await deleteLogisticsOrderAction('lead-1', VALID_INPUT);

    expect(deleteLeadActionMock).toHaveBeenCalledWith('lead-1', VALID_INPUT);
    expect(result).toEqual({ success: true });
  });

  // AC13: wynik odmowy z deleteLeadAction jest przekazywany dalej bez zmian, a
  // WLASNY prisma.leady.delete tego pliku (jesli w ogole istnieje po naprawie) nie
  // jest wywolany.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('przekazuje dalej wynik odmowy z deleteLeadAction, nie wola wlasnego prisma.leady.delete', async () => {
    deleteLeadActionMock.mockResolvedValue({ success: false, error: 'Brak uprawnień do usunięcia leada.' });

    const result = await deleteLogisticsOrderAction('lead-1', VALID_INPUT);

    expect(deleteLeadActionMock).toHaveBeenCalledWith('lead-1', VALID_INPUT);
    expect(leadDeleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'Brak uprawnień do usunięcia leada.' });
  });
});
