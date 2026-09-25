import { describe, it, expect } from 'vitest';
import {
  calculateQuoteVariant,
  resolveVatRate,
  inferPropertyKindFromTriage,
  getPropertyKindLabels,
  quoteCalculationInputSchema,
  roundToCents,
  type PropertyKind,
  type QuoteItemInput,
} from '@repo/pricing';

/**
 * WO: docs/workorders/FLD-QUOTE-CALC.md — WO-P3.
 * // @REQ: FLD-QUOTE-CALC
 * // @REQ: PRICE-VAT-RATE
 */

describe('FLD-QUOTE-CALC & PRICE-VAT-RATE — Silnik wyceny i stawka VAT', () => {
  describe('AC-C1 & AC-V2 — Stawka VAT z obiektu i kwoty wariantu', () => {
    const items: QuoteItemInput[] = [
      { quantity: 1, unitPriceNet: 1000.0, crewCostNet: null },
      { quantity: 3, unitPriceNet: 130.0, crewCostNet: 18.72 },
      { quantity: 1, unitPriceNet: 400.0, crewCostNet: 50.0 },
    ];

    it('dla RESIDENTIAL_UP_TO_THRESHOLD liczy stawkę 8%: netto 1790.00, brutto 1933.20', () => {
      const result = calculateQuoteVariant({
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        equipmentNetAmount: 0,
        items,
      });

      expect(result.vatRatePercent).toBe(8);
      expect(result.itemsNet).toBe(1790.0);
      expect(result.totalNet).toBe(1790.0);
      expect(result.vatAmount).toBe(143.2);
      expect(result.totalGross).toBe(1933.2);
    });

    it('dla COMMERCIAL liczy stawkę 23%: netto 1790.00, brutto 2201.70', () => {
      const result = calculateQuoteVariant({
        propertyKind: 'COMMERCIAL',
        equipmentNetAmount: 0,
        items,
      });

      expect(result.vatRatePercent).toBe(23);
      expect(result.itemsNet).toBe(1790.0);
      expect(result.totalNet).toBe(1790.0);
      expect(result.vatAmount).toBe(411.7);
      expect(result.totalGross).toBe(2201.7);
    });

    it('dla RESIDENTIAL_ABOVE_THRESHOLD liczy stawkę 23%: netto 1790.00, brutto 2201.70', () => {
      const result = calculateQuoteVariant({
        propertyKind: 'RESIDENTIAL_ABOVE_THRESHOLD',
        equipmentNetAmount: 0,
        items,
      });

      expect(result.vatRatePercent).toBe(23);
      expect(result.itemsNet).toBe(1790.0);
      expect(result.totalNet).toBe(1790.0);
      expect(result.vatAmount).toBe(411.7);
      expect(result.totalGross).toBe(2201.7);
    });
  });

  describe('AC-C2 — Marża pozycji i wariantu', () => {
    it('liczy marżę pozycji dla znanych kosztów i zwraca null dla kosztu ekipy null', () => {
      const items: QuoteItemInput[] = [
        { quantity: 3, unitPriceNet: 130.0, crewCostNet: 18.72 }, // (130 - 18.72) * 3 = 333.84
        { quantity: 1, unitPriceNet: 1000.0, crewCostNet: null }, // brak danych o koszcie
        { quantity: 2, unitPriceNet: 50.0, crewCostNet: 0.0 }, // (50 - 0) * 2 = 100.00
      ];

      const result = calculateQuoteVariant({
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        equipmentNetAmount: 0,
        items,
      });

      expect(result.calculatedItems[0]?.marginNet).toBe(333.84);
      expect(result.calculatedItems[1]?.marginNet).toBeNull();
      expect(result.calculatedItems[2]?.marginNet).toBe(100.0);

      // Podsumowanie wariantu zwraca sumę znanych marż oraz liczbę pozycji z marżą nieznaną
      expect(result.totalMarginNet).toBe(433.84);
      expect(result.unknownMarginItemsCount).toBe(1);
    });
  });

  describe('AC-C3 — Zaliczka na urządzenia', () => {
    it('zaliczka = equipment_net_amount * (1 + stawka) * 1.1', () => {
      const items: QuoteItemInput[] = [
        { quantity: 1, unitPriceNet: 500.0, crewCostNet: 100.0 },
      ];

      // 10 000 * 1.08 * 1.1 = 11 880.00
      const res8 = calculateQuoteVariant({
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        equipmentNetAmount: 10000.0,
        items,
      });
      expect(res8.depositAmountGross).toBe(11880.0);

      // 10 000 * 1.23 * 1.1 = 13 530.00
      const res23 = calculateQuoteVariant({
        propertyKind: 'COMMERCIAL',
        equipmentNetAmount: 10000.0,
        items,
      });
      expect(res23.depositAmountGross).toBe(13530.0);
    });

    it('brak urządzeń (equipmentNetAmount 0 lub brak) daje zaliczkę 0.00', () => {
      const result = calculateQuoteVariant({
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        equipmentNetAmount: 0,
        items: [{ quantity: 1, unitPriceNet: 500.0, crewCostNet: 100.0 }],
      });
      expect(result.depositAmountGross).toBe(0.0);
    });
  });

  describe('AC-C4 — Schemat wejścia operacji wyceny', () => {
    it('ignoruje lub odrzuca przemycone pola kwot wynikowych (totalNet, totalGross)', () => {
      const rawInput = {
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        equipmentNetAmount: 5000.0,
        items: [{ quantity: 1, unitPriceNet: 1000.0, crewCostNet: 200.0 }],
        totalNet: 999999.0, // Przemycone pole
        totalGross: 999999.0, // Przemycone pole
      };

      const parsed = quoteCalculationInputSchema.parse(rawInput);
      const result = calculateQuoteVariant(parsed);

      expect(result.totalNet).toBe(6000.0); // 5000 + 1000, a nie przemycone 999999
    });
  });

  describe('AC-C5 — Reguła zaokrągleń', () => {
    it('dwie pozycje po 1.50 netto przy 23% -> VAT liczony od sumy 3.00 wynosi 0.69 (nie 0.70)', () => {
      const result = calculateQuoteVariant({
        propertyKind: 'COMMERCIAL',
        equipmentNetAmount: 0,
        items: [
          { quantity: 1, unitPriceNet: 1.5 },
          { quantity: 1, unitPriceNet: 1.5 },
        ],
      });
      expect(result.totalNet).toBe(3.0);
      expect(result.vatAmount).toBe(0.69);
      expect(result.totalGross).toBe(3.69);
    });

    it('1.50 netto przy 23% daje VAT 0.35 (zaokrąglenie połówek w górę: 0.345 -> 0.35)', () => {
      const result = calculateQuoteVariant({
        propertyKind: 'COMMERCIAL',
        equipmentNetAmount: 0,
        items: [{ quantity: 1, unitPriceNet: 1.5 }],
      });
      expect(result.vatAmount).toBe(0.35);
    });

    it('3 × 40.10 daje dokładnie 120.30 bez błędów zmiennoprzecinkowych', () => {
      expect(roundToCents(3 * 40.1)).toBe(120.3);
    });

    it('ilość ułamkowa: 0.333 × 130.00 daje 43.29', () => {
      expect(roundToCents(0.333 * 130.0)).toBe(43.29);
    });
  });

  describe('AC-V3 — resolveVatRate', () => {
    it('zwraca 8 dla RESIDENTIAL_UP_TO_THRESHOLD, 23 dla RESIDENTIAL_ABOVE_THRESHOLD i COMMERCIAL', () => {
      expect(resolveVatRate('RESIDENTIAL_UP_TO_THRESHOLD')).toBe(8);
      expect(resolveVatRate('RESIDENTIAL_ABOVE_THRESHOLD')).toBe(23);
      expect(resolveVatRate('COMMERCIAL')).toBe(23);
    });

    it('wyrzuca błąd domenowy dla nieprawidłowego rodzaju obiektu', () => {
      expect(() => resolveVatRate('RESIDENTIAL' as PropertyKind)).toThrow(/wymagany rodzaj obiektu/i);
      expect(() => resolveVatRate(null as unknown as PropertyKind)).toThrow(/wymagany rodzaj obiektu/i);
    });
  });

  describe('AC-V4 — inferPropertyKindFromTriage', () => {
    it('mapuje Mieszkanie/Dom z UP_TO_300 na RESIDENTIAL_UP_TO_THRESHOLD', () => {
      expect(inferPropertyKindFromTriage({ location: 'Mieszkanie', propertyAreaBand: 'UP_TO_300' })).toBe('RESIDENTIAL_UP_TO_THRESHOLD');
      expect(inferPropertyKindFromTriage({ location: 'Dom', propertyAreaBand: 'UP_TO_300' })).toBe('RESIDENTIAL_UP_TO_THRESHOLD');
    });

    it('mapuje Mieszkanie/Dom z ABOVE_300 na RESIDENTIAL_ABOVE_THRESHOLD', () => {
      expect(inferPropertyKindFromTriage({ location: 'Mieszkanie', propertyAreaBand: 'ABOVE_300' })).toBe('RESIDENTIAL_ABOVE_THRESHOLD');
      expect(inferPropertyKindFromTriage({ location: 'Dom', propertyAreaBand: 'ABOVE_300' })).toBe('RESIDENTIAL_ABOVE_THRESHOLD');
    });

    it('mapuje Lokal komercyjny na COMMERCIAL niezależnie od powierzchni', () => {
      expect(inferPropertyKindFromTriage({ location: 'Lokal komercyjny' })).toBe('COMMERCIAL');
      expect(inferPropertyKindFromTriage({ location: 'Lokal komercyjny', propertyAreaBand: 'UP_TO_300' })).toBe('COMMERCIAL');
    });

    it('zwraca null dla leadów mieszkalnych bez propertyAreaBand', () => {
      expect(inferPropertyKindFromTriage({ location: 'Mieszkanie' })).toBeNull();
      expect(inferPropertyKindFromTriage({ location: 'Dom' })).toBeNull();
    });
  });

  describe('AC-V6 — getPropertyKindLabels', () => {
    it('generuje etykiety z progiem pochodzącym z kontraktu SLA', () => {
      const labels = getPropertyKindLabels();
      expect(labels.RESIDENTIAL_UP_TO_THRESHOLD).toMatch(/do 300 m²/);
      expect(labels.RESIDENTIAL_ABOVE_THRESHOLD).toMatch(/powyżej 300 m²/);
      expect(labels.COMMERCIAL).toMatch(/komercyjny/);
    });

    it('pozwala wygenerować etykiety z innym progiem bez zmiany kodu', () => {
      const labels = getPropertyKindLabels(250);
      expect(labels.RESIDENTIAL_UP_TO_THRESHOLD).toMatch(/do 250 m²/);
      expect(labels.RESIDENTIAL_ABOVE_THRESHOLD).toMatch(/powyżej 250 m²/);
    });
  });
});
