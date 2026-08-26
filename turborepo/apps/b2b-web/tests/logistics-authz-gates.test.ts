import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, PERMISSIONS, can } from '@klikklima/contracts';

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
  leadDeleteMock,
  logisticsCreateMock,
  logisticsFindFirstMock,
  logisticsUpdateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  deleteLeadActionMock,
} = vi.hoisted(() => ({
  leadUpdateMock: vi.fn(),
  leadDeleteMock: vi.fn(),
  logisticsCreateMock: vi.fn(),
  logisticsFindFirstMock: vi.fn(),
  logisticsUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  deleteLeadActionMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      update: leadUpdateMock,
      delete: leadDeleteMock,
    },
    logistyka_zamowienia: {
      create: logisticsCreateMock,
      findFirst: logisticsFindFirstMock,
      update: logisticsUpdateMock,
    },
    $transaction: transactionMock,
  },
  LeadStatus: {
    HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
    AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
    ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
    HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE',
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));
vi.mock('../src/app/(dashboard)/leads/actions', () => ({
  deleteLeadAction: deleteLeadActionMock,
}));

const {
  shipLogisticsOrder,
  bypassLogisticsOrder,
  markAsDelivered,
  rollbackLogisticsOrder,
  deleteLogisticsOrderAction,
} = await import('../src/app/(dashboard)/logistics/actions');

const LEADS_UPDATE_ALLOWED = ROLES.filter((r) => can(r, 'leads', 'update') === 'yes');
const LEADS_UPDATE_DENIED = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');

// `tx` faktycznie wykonuje callback z tym samym zestawem mockow co `prisma` — jesli
// bramka nie stoi przed $transaction, callback faktycznie odpali i zapisy beda
// widoczne w asercjach ponizej (dowod prawdziwego RED, nie fałszywie zielonego testu
// przez nieuruchomiony callback).
function makeTxImplementation() {
  return async (cb: (tx: unknown) => unknown) =>
    cb({
      leady: { update: leadUpdateMock },
      logistyka_zamowienia: {
        create: logisticsCreateMock,
        findFirst: logisticsFindFirstMock,
        update: logisticsUpdateMock,
      },
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
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_DENIED)(
    'rola %s jest odrzucona, leady.update nie jest wywolane ani razu',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await bypassLogisticsOrder('lead-1');

      expect(leadUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Fail-closed: brak roli.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await bypassLogisticsOrder('lead-1');

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await bypassLogisticsOrder('lead-1');

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla admin i dyspozytor OSOBNO.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_ALLOWED)('rola %s jest dozwolona, leady.update faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    leadUpdateMock.mockResolvedValue({});

    const result = await bypassLogisticsOrder('lead-1');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await bypassLogisticsOrder('lead-1');

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
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
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

    const result = await rollbackLogisticsOrder('lead-1');

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Fail-closed: blad samego zapytania o role.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('blad zapytania o role daje odmowe, nie nieobslugowany wyjatek', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('blad zapytania o role'));

    const result = await rollbackLogisticsOrder('lead-1');

    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  // Kontrola pozytywna dla admin i dyspozytor OSOBNO.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it.each(LEADS_UPDATE_ALLOWED)('rola %s jest dozwolona, leady.update faktycznie wywolane', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);
    leadUpdateMock.mockResolvedValue({});

    const result = await rollbackLogisticsOrder('lead-1', 'uszkodzona paczka');

    expect(result).toEqual({ success: true });
    expect(leadUpdateMock).toHaveBeenCalled();
  });

  // Odmowa ma jawny, odroznialny ksztalt.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('odmowa ma jawny, odroznialny ksztalt (obiekt z success:false), nie wyjatek ani void', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');

    const result = await rollbackLogisticsOrder('lead-1');

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(typeof result?.error).toBe('string');
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

    const result = await deleteLogisticsOrderAction('lead-1');

    expect(deleteLeadActionMock).toHaveBeenCalledWith('lead-1');
    expect(result).toEqual({ success: true });
  });

  // AC13: wynik odmowy z deleteLeadAction jest przekazywany dalej bez zmian, a
  // WLASNY prisma.leady.delete tego pliku (jesli w ogole istnieje po naprawie) nie
  // jest wywolany.
  // @REQ: SEC-AUTHZ-B2B-MUTATIONS
  it('przekazuje dalej wynik odmowy z deleteLeadAction, nie wola wlasnego prisma.leady.delete', async () => {
    deleteLeadActionMock.mockResolvedValue({ success: false, error: 'Brak uprawnień do usunięcia leada.' });

    const result = await deleteLogisticsOrderAction('lead-1');

    expect(deleteLeadActionMock).toHaveBeenCalledWith('lead-1');
    expect(leadDeleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'Brak uprawnień do usunięcia leada.' });
  });
});
