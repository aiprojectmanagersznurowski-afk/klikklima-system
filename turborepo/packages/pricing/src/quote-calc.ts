import { z } from "zod";
import { roundToCents } from "./rounding";
import { resolveVatRate, type PropertyKind } from "./vat-rate";

/**
 * WO: docs/workorders/FLD-QUOTE-CALC.md — FLD-QUOTE-CALC.
 * Silnik obliczeń wyceny wariantu oferty.
 */

export const quoteItemInputSchema = z.object({
  quantity: z.number().positive("Ilość musi być większa od 0."),
  unitPriceNet: z.number().nonnegative("Cena jednostkowa netto musi być nieujemna."),
  crewCostNet: z.number().nonnegative("Koszt ekipy netto musi być nieujemny.").optional().nullable(),
  description: z.string().optional().nullable(),
});

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;

export const quoteCalculationInputSchema = z.object({
  propertyKind: z.enum([
    "RESIDENTIAL_UP_TO_THRESHOLD",
    "RESIDENTIAL_ABOVE_THRESHOLD",
    "COMMERCIAL",
  ]),
  equipmentNetAmount: z.number().nonnegative().default(0),
  items: z.array(quoteItemInputSchema).default([]),
});

export type QuoteCalculationInput = z.infer<typeof quoteCalculationInputSchema>;

export type CalculatedQuoteItem = QuoteItemInput & {
  lineTotalNet: number;
  marginNet: number | null;
};

export type CalculatedQuoteVariant = {
  propertyKind: PropertyKind;
  vatRatePercent: 8 | 23;
  equipmentNetAmount: number;
  itemsNet: number;
  totalNet: number;
  vatAmount: number;
  totalGross: number;
  depositAmountGross: number;
  totalMarginNet: number;
  unknownMarginItemsCount: number;
  calculatedItems: CalculatedQuoteItem[];
};

/**
 * AC-C1…AC-C5 — Główna funkcja silnika wyceny.
 * Liczy pozycje razy ilości, sumę netto i brutto, marżę na pozycji oraz kwotę zaliczki.
 */
export function calculateQuoteVariant(rawInput: QuoteCalculationInput): CalculatedQuoteVariant {
  const input = quoteCalculationInputSchema.parse(rawInput);
  const vatRatePercent = resolveVatRate(input.propertyKind);
  const equipmentNet = roundToCents(input.equipmentNetAmount);

  let itemsNetAcc = 0;
  let marginNetAcc = 0;
  let unknownMarginCount = 0;

  const calculatedItems: CalculatedQuoteItem[] = input.items.map((item) => {
    const lineTotalNet = roundToCents(item.quantity * item.unitPriceNet);
    itemsNetAcc += lineTotalNet;

    let marginNet: number | null = null;
    if (item.crewCostNet !== null && item.crewCostNet !== undefined) {
      marginNet = roundToCents((item.unitPriceNet - item.crewCostNet) * item.quantity);
      marginNetAcc += marginNet;
    } else {
      unknownMarginCount += 1;
    }

    return {
      ...item,
      lineTotalNet,
      marginNet,
    };
  });

  const itemsNet = roundToCents(itemsNetAcc);
  const totalNet = roundToCents(itemsNet + equipmentNet);

  // AC-C5 — VAT liczony raz, od sumy całkowitej netto, zaokrąglony do grosza
  const vatAmount = roundToCents(totalNet * (vatRatePercent / 100));
  const totalGross = roundToCents(totalNet + vatAmount);

  // AC-C3 — Zaliczka = cena netto zestawu × (1 + stawka) × 1,1
  let depositAmountGross = 0;
  if (equipmentNet > 0) {
    depositAmountGross = roundToCents(equipmentNet * (1 + vatRatePercent / 100) * 1.1);
  }

  return {
    propertyKind: input.propertyKind,
    vatRatePercent,
    equipmentNetAmount: equipmentNet,
    itemsNet,
    totalNet,
    vatAmount,
    totalGross,
    depositAmountGross,
    totalMarginNet: roundToCents(marginNetAcc),
    unknownMarginItemsCount: unknownMarginCount,
    calculatedItems,
  };
}
