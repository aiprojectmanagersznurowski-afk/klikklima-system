import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Role } from '@klikklima/contracts';
import { can } from '@klikklima/contracts';
import {
  updateStandardInstallationConfigSchema,
  calculateStandardInstallation,
  type StandardInstallationItemConfig,
  type PricingItemForStandardCalculation,
} from '../src/lib/pricing/standard-installation-schema';
import { isStandardInstallationNavItemVisible } from '../src/lib/pricing/nav-visibility';
import { getNavItemsForRole } from '../src/navigation/sidebar-items';

/**
 * WO: docs/workorders/STD-INSTALL-CONFIG.md
 * // @REQ: STD-INSTALL-CONFIG
 */

const {
  transactionMock,
  txFindUniqueMock,
  txFindManyMock,
  txUpsertMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
  txFindManyMock: vi.fn(),
  txUpsertMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    system_config: {
      findUnique: vi.fn(),
    },
    priceListItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const LAYOUT_PATH = path.resolve(__dirname, '../src/app/(dashboard)/layout.tsx');

describe('STD-INSTALL-CONFIG — Schemat walidacji Zod', () => {
  it('akceptuje poprawny zestaw pozycji z mnożnikami PER_INDOOR_UNIT i PER_INSTALLATION', () => {
    const validData = {
      items: [
        {
          priceListItemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
          multiplier: 'PER_INDOOR_UNIT',
          quantity: 1,
        },
        {
          priceListItemId: 'aa5d50df-8167-465c-8015-9736f336bfd8',
          multiplier: 'PER_INSTALLATION',
          quantity: 1,
        },
      ],
      notes: 'Testowa konfiguracja',
    };

    const parsed = updateStandardInstallationConfigSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it('odrzuca nieprawidłowy UUID w priceListItemId', () => {
    const invalidData = {
      items: [
        {
          priceListItemId: 'nie-jest-to-poprawny-uuid',
          multiplier: 'PER_INDOOR_UNIT',
          quantity: 1,
        },
      ],
    };

    const parsed = updateStandardInstallationConfigSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });

  it('odrzuca ujemne i zerowe ilości', () => {
    const zeroQuantity = {
      items: [
        {
          priceListItemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
          multiplier: 'PER_INDOOR_UNIT',
          quantity: 0,
        },
      ],
    };
    expect(updateStandardInstallationConfigSchema.safeParse(zeroQuantity).success).toBe(false);

    const negativeQuantity = {
      items: [
        {
          priceListItemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
          multiplier: 'PER_INDOOR_UNIT',
          quantity: -2,
        },
      ],
    };
    expect(updateStandardInstallationConfigSchema.safeParse(negativeQuantity).success).toBe(false);
  });

  it('odrzuca nieprawidłowy mnożnik', () => {
    const invalidMultiplier = {
      items: [
        {
          priceListItemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
          multiplier: 'PER_ROOM', // nieobsługiwany enum
          quantity: 1,
        },
      ],
    };
    expect(updateStandardInstallationConfigSchema.safeParse(invalidMultiplier).success).toBe(false);
  });
});

describe('STD-INSTALL-CONFIG — Kalkulator montażu standardowego', () => {
  const mockPriceItemsMap = new Map<string, PricingItemForStandardCalculation>([
    // PER_INDOOR_UNIT
    ['uuid-1', { id: 'uuid-1', name: 'podłączenie ściennej', unit: 'szt', salePriceNet: 1000, crewCostNet: 600 }],
    ['uuid-2', { id: 'uuid-2', name: 'instalacja freonowa 1/4 i 3/8', unit: 'mb', salePriceNet: 130, crewCostNet: 70 }],
    ['uuid-3', { id: 'uuid-3', name: 'koryta na instalację freonową', unit: 'mb', salePriceNet: 40, crewCostNet: 20 }],
    ['uuid-4', { id: 'uuid-4', name: 'przewiert', unit: 'szt', salePriceNet: 300, crewCostNet: 150 }],
    ['uuid-5', { id: 'uuid-5', name: 'skropliny grawitacyjnie giętkie', unit: 'mb', salePriceNet: 6, crewCostNet: 3 }],
    // PER_INSTALLATION
    ['uuid-6', { id: 'uuid-6', name: 'uruchomienie', unit: 'szt', salePriceNet: 400, crewCostNet: 250 }],
    ['uuid-7', { id: 'uuid-7', name: 'dł przewodu zasilającego', unit: 'mb', salePriceNet: 15, crewCostNet: 8 }],
    ['uuid-8', { id: 'uuid-8', name: 'wpięcie zasilania do gniazda na sztywno', unit: 'szt', salePriceNet: 60, crewCostNet: 35 }],
    ['uuid-9', { id: 'uuid-9', name: 'jedn zew stoi na podstawach kauczukowych', unit: 'szt', salePriceNet: 120, crewCostNet: 70 }],
  ]);

  const mockConfig: StandardInstallationItemConfig[] = [
    { priceListItemId: 'uuid-1', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    { priceListItemId: 'uuid-2', multiplier: 'PER_INDOOR_UNIT', quantity: 3 },
    { priceListItemId: 'uuid-3', multiplier: 'PER_INDOOR_UNIT', quantity: 3 },
    { priceListItemId: 'uuid-4', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    { priceListItemId: 'uuid-5', multiplier: 'PER_INDOOR_UNIT', quantity: 3 },
    { priceListItemId: 'uuid-6', multiplier: 'PER_INSTALLATION', quantity: 1 },
    { priceListItemId: 'uuid-7', multiplier: 'PER_INSTALLATION', quantity: 5 },
    { priceListItemId: 'uuid-8', multiplier: 'PER_INSTALLATION', quantity: 1 },
    { priceListItemId: 'uuid-9', multiplier: 'PER_INSTALLATION', quantity: 1 },
  ];

  it('wylicza dokładnie 2483.00 zł netto dla 1 jednostki wewnętrznej (Single-Split)', () => {
    // 1000 + 3*130(390) + 3*40(120) + 300 + 3*6(18) = 1828 zł (indoor)
    // 400 + 5*15(75) + 60 + 120 = 655 zł (installation)
    // Razem: 1828 + 655 = 2483.00 zł
    const result = calculateStandardInstallation(mockConfig, mockPriceItemsMap, 1);
    expect(result.indoorUnitsCount).toBe(1);
    expect(result.totalSalePriceNet).toBe(2483.0);
    expect(result.marginNet).toBeGreaterThan(0);
    expect(result.marginPercent).toBeGreaterThan(0);
  });

  it('wylicza dokładnie 4311.00 zł netto dla 2 jednostek wewnętrznych (Multi-Split 2x)', () => {
    // 1828 * 2 + 655 = 3656 + 655 = 4311.00 zł
    const result = calculateStandardInstallation(mockConfig, mockPriceItemsMap, 2);
    expect(result.indoorUnitsCount).toBe(2);
    expect(result.totalSalePriceNet).toBe(4311.0);
  });

  it('wylicza dokładnie 6139.00 zł netto dla 3 jednostek wewnętrznych (Multi-Split 3x)', () => {
    // 1828 * 3 + 655 = 5484 + 655 = 6139.00 zł
    const result = calculateStandardInstallation(mockConfig, mockPriceItemsMap, 3);
    expect(result.indoorUnitsCount).toBe(3);
    expect(result.totalSalePriceNet).toBe(6139.0);
  });
});

describe('STD-INSTALL-CONFIG — Uprawnienia RBAC i nawigacja', () => {
  it('isStandardInstallationNavItemVisible zwraca true dla admin, dyspozytor, audytor i false dla montera', () => {
    expect(isStandardInstallationNavItemVisible('admin')).toBe(true);
    expect(isStandardInstallationNavItemVisible('dyspozytor')).toBe(true);
    expect(isStandardInstallationNavItemVisible('audytor')).toBe(true);
    expect(isStandardInstallationNavItemVisible('monter')).toBe(false);
    expect(isStandardInstallationNavItemVisible(null)).toBe(false);
  });

  it('getNavItemsForRole zawiera pozycję Montaż standardowy dla ról cennika i ukrywa dla montera', () => {
    const allowedRoles: Role[] = ['admin', 'dyspozytor', 'audytor'];
    for (const role of allowedRoles) {
      const items = getNavItemsForRole(role);
      const settings = items.find((i) => i.id === 'settings');
      expect(settings).toBeDefined();
      const std = settings?.subItems?.find((s) => s.href === '/settings/standard-installation');
      expect(std).toBeDefined();
      expect(std?.label).toBe('Montaż standardowy');
    }

    const monterItems = getNavItemsForRole('monter');
    const monterSettings = monterItems.find((i) => i.id === 'settings');
    const monterStd = monterSettings?.subItems?.find((s) => s.href === '/settings/standard-installation');
    expect(monterStd).toBeUndefined();
  });

  it('layout.tsx importuje isStandardInstallationNavItemVisible i zawiera pozycję /settings/standard-installation', () => {
    const layoutContent = readFileSync(LAYOUT_PATH, 'utf-8');
    expect(layoutContent).toMatch(/isStandardInstallationNavItemVisible/);
    expect(layoutContent).toMatch(/\/settings\/standard-installation/);
    expect(layoutContent).toMatch(/Montaż standardowy/);
  });
});

describe('STD-INSTALL-CONFIG — Server Action updateStandardInstallationConfigAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('odrzuca wykonanie przez rolę bez uprawnień system_config update', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    const { updateStandardInstallationConfigAction } = await import(
      '../src/app/(dashboard)/settings/standard-installation/actions'
    );

    const result = await updateStandardInstallationConfigAction({
      items: [
        {
          priceListItemId: '09837abe-bd4c-4622-8869-4eb3fb0b1fd9',
          multiplier: 'PER_INDOOR_UNIT',
          quantity: 1,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Brak uprawnień');
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('pozwala roli admin na aktualizację i tworzy wpis w audit_log', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getCurrentUserMock.mockResolvedValue({
      data: { user: { email: 'admin@klikklima.pl' } },
    });

    const itemUuid = '09837abe-bd4c-4622-8869-4eb3fb0b1fd9';
    const fakeTx = {
      priceListItem: {
        findMany: vi.fn().mockResolvedValue([{ id: itemUuid, name: 'podłączenie ściennej' }]),
      },
      system_config: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cfg-uuid-1', typ_konfiguracji: 'standard_installation' }),
        upsert: vi.fn().mockResolvedValue({ id: 'cfg-uuid-1', typ_konfiguracji: 'standard_installation' }),
      },
      auditLog: {
        create: txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' }),
      },
    };

    transactionMock.mockImplementation(async (callback: any) => {
      return callback(fakeTx);
    });

    const { updateStandardInstallationConfigAction } = await import(
      '../src/app/(dashboard)/settings/standard-installation/actions'
    );

    const result = await updateStandardInstallationConfigAction({
      items: [
        {
          priceListItemId: itemUuid,
          multiplier: 'PER_INDOOR_UNIT',
          quantity: 1,
        },
      ],
      notes: 'Notatka testowa',
    });

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalled();
    expect(fakeTx.system_config.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { typ_konfiguracji: 'standard_installation' },
      })
    );
    expect(fakeTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operation: 'field_update',
          resource: 'system_config',
          actorRole: 'admin',
          actorEmail: 'admin@klikklima.pl',
        }),
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/settings/standard-installation');
  });
});
