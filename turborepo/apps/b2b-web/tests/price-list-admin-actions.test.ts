import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md — AC2…AC6.
 * // @REQ: PRICE-LIST-ADMIN
 */

const {
  transactionMock,
  priceListItemFindUniqueMock,
  priceListItemFindManyMock,
  priceListItemCreateMock,
  priceListItemUpdateMock,
  priceListItemVersionCreateMock,
  priceListItemVersionUpdateManyMock,
  auditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  priceListItemFindUniqueMock: vi.fn(),
  priceListItemFindManyMock: vi.fn(),
  priceListItemCreateMock: vi.fn(),
  priceListItemUpdateMock: vi.fn(),
  priceListItemVersionCreateMock: vi.fn(),
  priceListItemVersionUpdateManyMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    priceListItem: {
      findUnique: priceListItemFindUniqueMock,
      findMany: priceListItemFindManyMock,
      create: priceListItemCreateMock,
      update: priceListItemUpdateMock,
    },
    priceListItemVersion: {
      create: priceListItemVersionCreateMock,
      updateMany: priceListItemVersionUpdateManyMock,
    },
    auditLog: {
      create: auditLogCreateMock,
    },
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

// Dynamiczny import actions z modułu administracji cennika
const {
  createPriceListItemAction,
  updatePriceAction,
  togglePriceListItemActiveAction,
} = await import('../src/app/(dashboard)/settings/pricing/actions');

describe('PRICE-LIST-ADMIN — Server Actions w /settings/pricing', () => {
  const ADMIN_EMAIL = 'admin@klikklima.pl';

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
    createClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });

    // Domyślna implementacja transakcji przekazująca mocki Prisma
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        priceListItem: {
          create: priceListItemCreateMock,
          update: priceListItemUpdateMock,
        },
        priceListItemVersion: {
          create: priceListItemVersionCreateMock,
          updateMany: priceListItemVersionUpdateManyMock,
        },
        auditLog: {
          create: auditLogCreateMock,
        },
      };
      return callback(tx);
    });
  });

  describe('AC4 — Odmowa uprawnień dla nie-administratorów', () => {
    const unauthorizedRoles = ['dyspozytor', 'audytor', 'monter', null];

    for (const role of unauthorizedRoles) {
      it(`odmawia utworzenia pozycji dla roli: ${role} bez dotykania bazy`, async () => {
        getCurrentActorRoleMock.mockResolvedValue(role);

        const result = await createPriceListItemAction({
          name: 'Nowa usługa',
          unit: 'szt',
          scope: 'ROOM',
          salePriceNet: '200.00',
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/uprawnień/i);
        expect(transactionMock).not.toHaveBeenCalled();
        expect(priceListItemCreateMock).not.toHaveBeenCalled();
      });

      it(`odmawia zmiany ceny dla roli: ${role} bez dotykania bazy`, async () => {
        getCurrentActorRoleMock.mockResolvedValue(role);

        const result = await updatePriceAction({
          itemId: 'item-123',
          salePriceNet: '250.00',
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/uprawnień/i);
        expect(transactionMock).not.toHaveBeenCalled();
        expect(priceListItemVersionCreateMock).not.toHaveBeenCalled();
      });

      it(`odmawia wycofania pozycji dla roli: ${role} bez dotykania bazy`, async () => {
        getCurrentActorRoleMock.mockResolvedValue(role);

        const result = await togglePriceListItemActiveAction({
          itemId: 'item-123',
          isActive: false,
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/uprawnień/i);
        expect(transactionMock).not.toHaveBeenCalled();
      });
    }
  });

  describe('AC6 — Tworzenie nowej pozycji cennika przez administratora', () => {
    it('tworzy nową pozycję z pierwszą wersją ceny i wpisem audytowym w jednej transakcji', async () => {
      priceListItemCreateMock.mockResolvedValue({
        id: 'new-item-id',
        name: 'Rura miedziana 1/4',
      });
      priceListItemVersionCreateMock.mockResolvedValue({
        id: 'ver-1',
        isCurrent: true,
      });
      auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const result = await createPriceListItemAction({
        name: 'Rura miedziana 1/4',
        unit: 'mb',
        scope: 'ROOM',
        category: 'MATERIAL',
        salePriceNet: '45,50', // Przecinek akceptowany
        crewCostNet: '15.00',
      });

      expect(result.success).toBe(true);
      expect(transactionMock).toHaveBeenCalledTimes(1);

      // Sprawdź wywołanie tworzenia pozycji
      expect(priceListItemCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Rura miedziana 1/4',
            unit: 'mb',
            scope: 'ROOM',
            category: 'MATERIAL',
            isActive: true,
          }),
        })
      );

      // Sprawdź wywołanie pierwszej wersji
      expect(priceListItemVersionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceListItemId: 'new-item-id',
            isCurrent: true,
            salePriceNet: '45.50', // Znormalizowane do kropki
            crewCostNet: '15.00',
          }),
        })
      );

      // Sprawdź wpis w auditLog
      expect(auditLogCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operation: 'field_update',
            resource: 'price_list_items',
            recordId: 'new-item-id',
            actorEmail: ADMIN_EMAIL,
            actorRole: 'admin',
          }),
        })
      );
    });

    it('zwraca błąd domenowy po polsku przy duplikacie nazwy (P2002)', async () => {
      const p2002Error = Object.assign(new Error('Unique constraint failed on the fields: (`name`)'), { code: 'P2002' });
      transactionMock.mockRejectedValue(p2002Error);

      const result = await createPriceListItemAction({
        name: 'Istniejąca nazwa',
        unit: 'szt',
        scope: 'INSTALLATION',
        salePriceNet: '100.00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pozycja o tej nazwie już istnieje.');
    });

    it('odrzuca nieprawidłowe jednostki lub ujemne kwoty bez dotknięcia bazy', async () => {
      const result = await createPriceListItemAction({
        name: 'Zła jednostka',
        unit: 'kg' as unknown as 'szt', // Nieobsługiwana jednostka
        scope: 'ROOM',
        salePriceNet: '-10.00',
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });
  });

  describe('AC3 i AC5 — Zmiana ceny, niemutowalność i audyt', () => {
    it('nie tworzy nowej wersji ani audytu, gdy cena jest identyczna z bieżącą', async () => {
      priceListItemFindUniqueMock.mockResolvedValue({
        id: 'item-1',
        name: 'Przewód zasilający',
        versions: [
          {
            id: 'v1',
            isCurrent: true,
            salePriceNet: 100.0,
            crewCostNet: 20.0,
          },
        ],
      });

      const result = await updatePriceAction({
        itemId: 'item-1',
        salePriceNet: '100.00',
        crewCostNet: '20.00',
      });

      expect(result.success).toBe(true);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(priceListItemVersionCreateMock).not.toHaveBeenCalled();
      expect(auditLogCreateMock).not.toHaveBeenCalled();
    });

    it('tworzy nową wersję isCurrent i zdejmuje isCurrent ze starej w jednej transakcji', async () => {
      priceListItemFindUniqueMock.mockResolvedValue({
        id: 'item-1',
        name: 'Przewód zasilający',
        versions: [
          {
            id: 'v1',
            isCurrent: true,
            salePriceNet: 100.0,
            crewCostNet: 20.0,
          },
        ],
      });

      priceListItemVersionUpdateManyMock.mockResolvedValue({ count: 1 });
      priceListItemVersionCreateMock.mockResolvedValue({ id: 'v2', isCurrent: true });
      auditLogCreateMock.mockResolvedValue({ id: 'audit-2' });

      const result = await updatePriceAction({
        itemId: 'item-1',
        salePriceNet: '120,50',
        crewCostNet: '25.00',
      });

      expect(result.success).toBe(true);
      expect(transactionMock).toHaveBeenCalledTimes(1);

      // Zdejmowanie isCurrent ze starej wersji
      expect(priceListItemVersionUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { priceListItemId: 'item-1', isCurrent: true },
          data: { isCurrent: false },
        })
      );

      // Wstawianie nowej wersji z isCurrent: true
      expect(priceListItemVersionCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priceListItemId: 'item-1',
            salePriceNet: '120.50',
            crewCostNet: '25.00',
            isCurrent: true,
          }),
        })
      );

      // Wpis do auditLog ze szczegółami przed i po
      expect(auditLogCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operation: 'field_update',
            resource: 'price_list_items',
            recordId: 'item-1',
            actorEmail: ADMIN_EMAIL,
            actorRole: 'admin',
            justification: expect.stringMatching(/cena sprzedaży netto: 100\.00 → 120\.50/i),
          }),
        })
      );
    });

    it('wycofuje zmianę ceny, jeśli zapis w audit_log zakończy się błędem', async () => {
      priceListItemFindUniqueMock.mockResolvedValue({
        id: 'item-1',
        name: 'Przewód zasilający',
        versions: [
          {
            id: 'v1',
            isCurrent: true,
            salePriceNet: 100.0,
            crewCostNet: null,
          },
        ],
      });

      transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          priceListItemVersion: {
            updateMany: priceListItemVersionUpdateManyMock,
            create: priceListItemVersionCreateMock,
          },
          auditLog: {
            create: vi.fn().mockRejectedValue(new Error('Błąd zapisu audit_log')),
          },
        };
        return callback(tx);
      });

      const result = await updatePriceAction({
        itemId: 'item-1',
        salePriceNet: '150.00',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/nie udało się zapisać/i);
    });
  });

  describe('AC2 — Przełączanie aktywności (wycofanie/przywrócenie)', () => {
    it('przełącza isActive na false i zostawia wpis w auditLog, nie usuwając pozycji', async () => {
      priceListItemUpdateMock.mockResolvedValue({ id: 'item-1', isActive: false });
      auditLogCreateMock.mockResolvedValue({ id: 'audit-3' });

      const result = await togglePriceListItemActiveAction({
        itemId: 'item-1',
        isActive: false,
      });

      expect(result.success).toBe(true);
      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(priceListItemUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: { isActive: false },
        })
      );
      expect(auditLogCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            operation: 'field_update',
            resource: 'price_list_items',
            recordId: 'item-1',
            justification: expect.stringMatching(/wycofanie pozycji z cennika/i),
          }),
        })
      );
    });
  });
});
