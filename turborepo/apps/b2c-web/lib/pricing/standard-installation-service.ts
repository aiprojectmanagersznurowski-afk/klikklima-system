import { prisma } from '@repo/database';
import {
  calculateStandardInstallation,
  STANDARD_INSTALLATION_CONFIG_TYPE,
  standardInstallationConfigSchema,
  type PricingItemForStandardCalculation,
  type StandardInstallationCalculationResult,
  type StandardInstallationItemConfig,
} from '@repo/pricing';

/**
 * WO: B2C-TRIAGE-PRICE-FROM-PRICE-LIST
 * // @REQ: B2C-TRIAGE-PRICE-FROM-PRICE-LIST
 * // @REQ: B2C-PRICE-FROM
 *
 * Pobiera konfigurację montażu standardowego z `system_config` oraz aktualne ceny
 * z `price_list_items` i wylicza dynamiczną kwotę montażu dla wybranej liczby pomieszczeń.
 */

// Awaryjny fallback (stawki ze wzorca), gdyby baza nie miała jeszcze rekordu system_config
const FALLBACK_DEFAULT_SPLIT_NETTO = 2270;
const FALLBACK_PER_ROOM_NETTO = 1120;
const FALLBACK_SYSTEM_FIXED_NETTO = 1150;

export async function getStandardInstallationPriceNetto(
  roomCount: number
): Promise<number> {
  const result = await getStandardInstallationCalculation(roomCount);
  return result.totalSalePriceNet;
}

export async function getStandardInstallationCalculation(
  roomCount: number
): Promise<StandardInstallationCalculationResult> {
  const count = Math.max(1, Math.floor(roomCount));

  try {
    const [configRecord, priceItems] = await Promise.all([
      prisma.system_config.findUnique({
        where: { typ_konfiguracji: STANDARD_INSTALLATION_CONFIG_TYPE },
      }),
      prisma.priceListItem.findMany({
        where: { isActive: true },
        include: {
          versions: {
            where: { isCurrent: true },
          },
        },
      }),
    ]);

    if (!configRecord?.konfiguracja || priceItems.length === 0) {
      return getFallbackCalculation(count);
    }

    const parsedConfig = standardInstallationConfigSchema.safeParse(configRecord.konfiguracja);
    if (!parsedConfig.success || parsedConfig.data.items.length === 0) {
      return getFallbackCalculation(count);
    }

    const priceItemsMap = new Map<string, PricingItemForStandardCalculation>();
    for (const item of priceItems) {
      const currentVersion = item.versions[0];
      if (currentVersion) {
        priceItemsMap.set(item.id, {
          id: item.id,
          name: item.name,
          unit: item.unit,
          salePriceNet: Number(currentVersion.salePriceNet),
          crewCostNet: Number(currentVersion.crewCostNet),
        });
      }
    }

    return calculateStandardInstallation(parsedConfig.data.items, priceItemsMap, count);
  } catch (error) {
    console.error('Błąd pobierania konfiguracji montażu standardowego:', error);
    return getFallbackCalculation(count);
  }
}

function getFallbackCalculation(count: number): StandardInstallationCalculationResult {
  const totalSalePriceNet = count * FALLBACK_PER_ROOM_NETTO + FALLBACK_SYSTEM_FIXED_NETTO;
  const totalCrewCostNet = Math.round(totalSalePriceNet * 0.45);
  const marginNet = totalSalePriceNet - totalCrewCostNet;
  const marginPercent = Math.round((marginNet / totalSalePriceNet) * 1000) / 10;

  return {
    indoorUnitsCount: count,
    items: [],
    totalSalePriceNet,
    totalCrewCostNet,
    marginNet,
    marginPercent,
  };
}
