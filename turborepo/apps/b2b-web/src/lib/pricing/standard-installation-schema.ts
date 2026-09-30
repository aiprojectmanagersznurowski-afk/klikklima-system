import { z } from 'zod';

export const STANDARD_INSTALLATION_CONFIG_TYPE = 'standard_installation';

/**
 * WO: docs/workorders/STD-INSTALL-CONFIG.md
 * // @REQ: STD-INSTALL-CONFIG
 *
 * Mnożnik pozycji w montażu standardowym:
 * - PER_INDOOR_UNIT: ilość mnożona przez liczbę jednostek wewnętrznych (pomieszczeń)
 * - PER_INSTALLATION: ilość stała dla całego układu (jednorazowa, np. uruchomienie, zasilanie)
 */
export const standardInstallationMultiplierSchema = z.enum([
  'PER_INDOOR_UNIT',
  'PER_INSTALLATION',
]);

export type StandardInstallationMultiplier = z.infer<
  typeof standardInstallationMultiplierSchema
>;

export const standardInstallationItemSchema = z.object({
  priceListItemId: z.string().uuid(),
  multiplier: standardInstallationMultiplierSchema,
  quantity: z.number().positive('Ilość musi być większa od zera').max(1000, 'Ilość zbyt duża'),
});

export type StandardInstallationItemConfig = z.infer<
  typeof standardInstallationItemSchema
>;

export const updateStandardInstallationConfigSchema = z.object({
  items: z.array(standardInstallationItemSchema),
  notes: z.string().max(500, 'Notatka może mieć maksymalnie 500 znaków').optional(),
});

export type UpdateStandardInstallationConfigInput = z.infer<
  typeof updateStandardInstallationConfigSchema
>;

export const standardInstallationConfigSchema = z.object({
  items: z.array(standardInstallationItemSchema),
  updatedAt: z.string().optional(),
  notes: z.string().optional(),
});

export type StandardInstallationConfig = z.infer<
  typeof standardInstallationConfigSchema
>;

export type PricingItemForStandardCalculation = {
  id: string;
  name: string;
  unit: string;
  salePriceNet: number;
  crewCostNet: number;
};

export type CalculatedItemBreakdown = {
  priceListItemId: string;
  name: string;
  unit: string;
  multiplier: StandardInstallationMultiplier;
  baseQuantity: number;
  effectiveQuantity: number;
  unitSalePriceNet: number;
  totalSalePriceNet: number;
  unitCrewCostNet: number;
  totalCrewCostNet: number;
};

export type StandardInstallationCalculationResult = {
  indoorUnitsCount: number;
  items: CalculatedItemBreakdown[];
  totalSalePriceNet: number;
  totalCrewCostNet: number;
  marginNet: number;
  marginPercent: number;
};

/**
 * Wylicza całkowitą cenę montażu standardowego dla danej liczby jednostek wewnętrznych (pokoi).
 * Zgodnie z regułą z STD-INSTALL-CONFIG:
 * - pozycje PER_INDOOR_UNIT mają ilość = baseQuantity * indoorUnitsCount
 * - pozycje PER_INSTALLATION mają ilość = baseQuantity
 */
export function calculateStandardInstallation(
  configItems: StandardInstallationItemConfig[],
  priceItemsMap: Map<string, PricingItemForStandardCalculation>,
  indoorUnitsCount: number = 1
): StandardInstallationCalculationResult {
  const count = Math.max(1, Math.floor(indoorUnitsCount));
  const breakdown: CalculatedItemBreakdown[] = [];

  let totalSalePriceNet = 0;
  let totalCrewCostNet = 0;

  for (const item of configItems) {
    const priceInfo = priceItemsMap.get(item.priceListItemId);
    const name = priceInfo?.name ?? `Pozycja [${item.priceListItemId}]`;
    const unit = priceInfo?.unit ?? 'szt';
    const unitSalePriceNet = priceInfo?.salePriceNet ?? 0;
    const unitCrewCostNet = priceInfo?.crewCostNet ?? 0;

    const effectiveQuantity =
      item.multiplier === 'PER_INDOOR_UNIT' ? item.quantity * count : item.quantity;

    const itemTotalSale = Math.round(unitSalePriceNet * effectiveQuantity * 100) / 100;
    const itemTotalCost = Math.round(unitCrewCostNet * effectiveQuantity * 100) / 100;

    totalSalePriceNet += itemTotalSale;
    totalCrewCostNet += itemTotalCost;

    breakdown.push({
      priceListItemId: item.priceListItemId,
      name,
      unit,
      multiplier: item.multiplier,
      baseQuantity: item.quantity,
      effectiveQuantity,
      unitSalePriceNet,
      totalSalePriceNet: itemTotalSale,
      unitCrewCostNet,
      totalCrewCostNet: itemTotalCost,
    });
  }

  totalSalePriceNet = Math.round(totalSalePriceNet * 100) / 100;
  totalCrewCostNet = Math.round(totalCrewCostNet * 100) / 100;
  const marginNet = Math.round((totalSalePriceNet - totalCrewCostNet) * 100) / 100;
  const marginPercent =
    totalSalePriceNet > 0
      ? Math.round((marginNet / totalSalePriceNet) * 1000) / 10
      : 0;

  return {
    indoorUnitsCount: count,
    items: breakdown,
    totalSalePriceNet,
    totalCrewCostNet,
    marginNet,
    marginPercent,
  };
}
