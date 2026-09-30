import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updatePriceListItemSchema,
  type UpdatePriceListItemInput,
} from '../src/lib/pricing/pricing-schema';

/**
 * WO: docs/workorders/PRICE-LIST-ADMIN.md — Pełna edycja pozycji cennika.
 * // @REQ: PRICE-LIST-ADMIN
 */

const {
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

describe('PRICE-LIST-ADMIN — updatePriceListItemSchema walidacja', () => {
  it('akceptuje poprawny zestaw danych ze wszystkimi polami', () => {
    const input = {
      itemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
      name: 'Przejście przez ścianę żelbetową',
      unit: 'szt',
      scope: 'ROOM',
      category: 'LABOR',
      description: 'Przewiert wiertnicą diamentową w betonie zbrojonym',
      salePriceNet: '350.00',
      crewCostNet: '180.00',
    };

    const parsed = updatePriceListItemSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('odrzuca brakującą lub pustą nazwę pozycji', () => {
    const input = {
      itemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
      name: '   ',
      unit: 'szt',
      scope: 'ROOM',
      salePriceNet: '100.00',
    };

    const parsed = updatePriceListItemSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it('odrzuca nieprawidłową jednostkę i nieprawidłowy zakres', () => {
    expect(
      updatePriceListItemSchema.safeParse({
        itemId: 'uuid-1',
        name: 'Test',
        unit: 'kg', // nieobsługiwana jednostka
        scope: 'ROOM',
        salePriceNet: '10.00',
      }).success
    ).toBe(false);

    expect(
      updatePriceListItemSchema.safeParse({
        itemId: 'uuid-1',
        name: 'Test',
        unit: 'szt',
        scope: 'GLOBAL', // nieobsługiwany zakres
        salePriceNet: '10.00',
      }).success
    ).toBe(false);
  });
});

describe('PRICE-LIST-ADMIN — updatePriceListItemAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('odrzuca edycję przez rolę bez uprawnień price_list_items update (np. monter, audytor)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    const { updatePriceListItemAction } = await import(
      '../src/app/(dashboard)/settings/pricing/actions'
    );

    const result = await updatePriceListItemAction({
      itemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
      name: 'Nowa nazwa',
      unit: 'szt',
      scope: 'ROOM',
      salePriceNet: '100.00',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Brak uprawnień');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('pozwala administratorowi zaktualizować wszystkie pola pozycji i utrwala wersję cenową w audit_log', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({
      data: { user: { email: 'admin@klikklima.pl' } },
    });

    const fakeItem = {
      id: 'item-uuid-1',
      name: 'Stara nazwa',
      unit: 'szt',
      scope: 'ROOM',
      category: 'LABOR',
      description: 'Stary opis',
      versions: [
        {
          id: 'ver-1',
          salePriceNet: '100.00',
          crewCostNet: '50.00',
          isCurrent: true,
        },
      ],
    };

    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const createVersionMock = vi.fn().mockResolvedValue({ id: 'ver-2' });
    const updateItemMock = vi.fn().mockResolvedValue({ id: 'item-uuid-1' });
    const auditLogCreateMock = vi.fn().mockResolvedValue({ id: 'audit-1' });

    const fakeTx = {
      priceListItem: {
        findUnique: vi.fn().mockResolvedValue(fakeItem),
        findFirst: vi.fn().mockResolvedValue(null), // brak duplikatu
        update: updateItemMock,
      },
      priceListItemVersion: {
        updateMany: updateManyMock,
        create: createVersionMock,
      },
      auditLog: {
        create: auditLogCreateMock,
      },
    };

    transactionMock.mockImplementation(async (cb: any) => cb(fakeTx));

    const { updatePriceListItemAction } = await import(
      '../src/app/(dashboard)/settings/pricing/actions'
    );

    const result = await updatePriceListItemAction({
      itemId: 'item-uuid-1',
      name: 'Zaktualizowana nazwa',
      unit: 'mb',
      scope: 'INSTALLATION',
      category: 'MATERIAL_LABOR',
      description: 'Zaktualizowany opis pozycji',
      salePriceNet: '150.00',
      crewCostNet: '80.00',
    });

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalled();
    expect(fakeTx.priceListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-uuid-1' },
        data: expect.objectContaining({
          name: 'Zaktualizowana nazwa',
          unit: 'mb',
          scope: 'INSTALLATION',
          category: 'MATERIAL_LABOR',
          description: 'Zaktualizowany opis pozycji',
        }),
      })
    );
    // Zmiana ceny -> nowa wersja
    expect(fakeTx.priceListItemVersion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { priceListItemId: 'item-uuid-1', isCurrent: true },
        data: { isCurrent: false },
      })
    );
    expect(fakeTx.priceListItemVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceListItemId: 'item-uuid-1',
          salePriceNet: '150.00',
          crewCostNet: '80.00',
          isCurrent: true,
        }),
      })
    );
    expect(fakeTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operation: 'field_update',
          resource: 'price_list_items',
          recordId: 'item-uuid-1',
          actorRole: 'admin',
          actorEmail: 'admin@klikklima.pl',
        }),
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/settings/pricing');
    expect(revalidatePathMock).toHaveBeenCalledWith('/settings/standard-installation');
  });

  it('odrzuca zmianę nazwy na nazwę już zajętą przez inną pozycję', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({
      data: { user: { email: 'admin@klikklima.pl' } },
    });

    const fakeItem = {
      id: 'item-uuid-1',
      name: 'Pozycja A',
      versions: [],
    };

    const fakeTx = {
      priceListItem: {
        findUnique: vi.fn().mockResolvedValue(fakeItem),
        findFirst: vi.fn().mockResolvedValue({ id: 'item-uuid-2', name: 'Pozycja B' }), // zajęta
      },
    };

    transactionMock.mockImplementation(async (cb: any) => cb(fakeTx));

    const { updatePriceListItemAction } = await import(
      '../src/app/(dashboard)/settings/pricing/actions'
    );

    const result = await updatePriceListItemAction({
      itemId: 'item-uuid-1',
      name: 'Pozycja B',
      unit: 'szt',
      scope: 'ROOM',
      salePriceNet: '100.00',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('już istnieje');
  });
});
