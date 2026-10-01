import { describe, it, expect, vi } from 'vitest';
import {
  calculateStandardInstallation,
  type StandardInstallationItemConfig,
  type PricingItemForStandardCalculation,
} from '@repo/pricing';

/**
 * WO: B2C-TRIAGE-PRICE-FROM-PRICE-LIST
 * // @REQ: B2C-TRIAGE-PRICE-FROM-PRICE-LIST
 * // @REQ: B2C-PRICE-FROM
 *
 * Kryteria akceptacji:
 * 1. Cena montażu w Triage pochodzi z price_list_items i STD-INSTALL-CONFIG.
 * 2. Ilości pozycji bierze się z konfiguracji montażu standardowego, a klient nic nie wpisuje.
 * 3. WDROŻENIE WYMAGA PORÓWNANIA CEN PRZED I PO dla konfiguracji 1, 2 i 3 pomieszczeń:
 *    - PRZED (stary model cennik_uslug z literałem 1200 zł netto / pokój):
 *      • 1 pokój: 1200 zł netto (1296 zł brutto z 8% VAT)
 *      • 2 pokoje: 2400 zł netto (2592 zł brutto z 8% VAT)
 *      • 3 pokoje: 3600 zł netto (3888 zł brutto z 8% VAT)
 *    - PO (nowy model z cennika robocizny 39 pozycji i podziału PER_INDOOR_UNIT vs PER_INSTALLATION):
 *      • 1 pokój (układ 1:1 Split): 1120 zł + 1150 zł = 2270 zł netto (2451.60 zł brutto)
 *      • 2 pokoje (układ 2:1 Multisplit 2x): (2 * 1120 zł) + 1150 zł = 3390 zł netto (3661.20 zł brutto)
 *      • 3 pokoje (układ 3:1 Multisplit 3x): (3 * 1120 zł) + 1150 zł = 4510 zł netto (4870.80 zł brutto)
 */

describe('B2C-TRIAGE-PRICE-FROM-PRICE-LIST — Wyliczanie ceny montażu standardowego w Triage', () => {
  const blueprintConfig: StandardInstallationItemConfig[] = [
    // PER_INDOOR_UNIT: 450 + 120 + 270 (3x90) + 80 + 90 + 110 = 1120 zł / pokój
    { priceListItemId: '11111111-1111-1111-1111-111111111111', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    { priceListItemId: '22222222-2222-2222-2222-222222222222', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    { priceListItemId: '33333333-3333-3333-3333-333333333333', multiplier: 'PER_INDOOR_UNIT', quantity: 3 },
    { priceListItemId: '44444444-4444-4444-4444-444444444444', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    { priceListItemId: '55555555-5555-5555-5555-555555555555', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    { priceListItemId: '66666666-6666-6666-6666-666666666666', multiplier: 'PER_INDOOR_UNIT', quantity: 1 },
    // PER_INSTALLATION: 600 + 250 + 300 = 1150 zł / układ
    { priceListItemId: '77777777-7777-7777-7777-777777777777', multiplier: 'PER_INSTALLATION', quantity: 1 },
    { priceListItemId: '88888888-8888-8888-8888-888888888888', multiplier: 'PER_INSTALLATION', quantity: 1 },
    { priceListItemId: '99999999-9999-9999-9999-999999999999', multiplier: 'PER_INSTALLATION', quantity: 1 },
  ];

  const priceMap = new Map<string, PricingItemForStandardCalculation>([
    ['11111111-1111-1111-1111-111111111111', { id: '1', name: 'Montaż jednostki wewn.', unit: 'szt', salePriceNet: 450, crewCostNet: 220 }],
    ['22222222-2222-2222-2222-222222222222', { id: '2', name: 'Wykonanie przewiertu', unit: 'szt', salePriceNet: 120, crewCostNet: 50 }],
    ['33333333-3333-3333-3333-333333333333', { id: '3', name: 'Instalacja chłodnicza', unit: 'mb', salePriceNet: 90, crewCostNet: 35 }],
    ['44444444-4444-4444-4444-444444444444', { id: '4', name: 'Odprowadzenie skroplin', unit: 'kpl', salePriceNet: 80, crewCostNet: 30 }],
    ['55555555-5555-5555-5555-555555555555', { id: '5', name: 'Połączenie elektryczne', unit: 'kpl', salePriceNet: 90, crewCostNet: 40 }],
    ['66666666-6666-6666-6666-666666666666', { id: '6', name: 'Próba ciśnieniowa', unit: 'kpl', salePriceNet: 110, crewCostNet: 45 }],
    ['77777777-7777-7777-7777-777777777777', { id: '7', name: 'Montaż jedn. zewn.', unit: 'szt', salePriceNet: 600, crewCostNet: 300 }],
    ['88888888-8888-8888-8888-888888888888', { id: '8', name: 'Zasilanie główne', unit: 'kpl', salePriceNet: 250, crewCostNet: 100 }],
    ['99999999-9999-9999-9999-999999999999', { id: '9', name: 'Uruchomienie i pomiary', unit: 'kpl', salePriceNet: 300, crewCostNet: 120 }],
  ]);

  it('wylicza poprawną cenę montażu dla 1 pomieszczenia (Split 1:1) — dokładnie 2270 zł netto', () => {
    const res = calculateStandardInstallation(blueprintConfig, priceMap, 1);
    expect(res.indoorUnitsCount).toBe(1);
    expect(res.totalSalePriceNet).toBe(2270);
    // Sprawdzenie, że cena nie jest starym literałem 1200 zł
    expect(res.totalSalePriceNet).not.toBe(1200);
  });

  it('wylicza poprawną cenę montażu dla 2 pomieszczeń (Multi-Split 2x) — dokładnie 3390 zł netto', () => {
    const res = calculateStandardInstallation(blueprintConfig, priceMap, 2);
    expect(res.indoorUnitsCount).toBe(2);
    expect(res.totalSalePriceNet).toBe(3390);
    expect(res.totalSalePriceNet).not.toBe(2400);
  });

  it('wylicza poprawną cenę montażu dla 3 pomieszczeń (Multi-Split 3x) — dokładnie 4510 zł netto', () => {
    const res = calculateStandardInstallation(blueprintConfig, priceMap, 3);
    expect(res.indoorUnitsCount).toBe(3);
    expect(res.totalSalePriceNet).toBe(4510);
    expect(res.totalSalePriceNet).not.toBe(3600);
  });

  it('weryfikacja porównania cen PRZED vs PO zgodnie z kryterium akceptacji AC3', () => {
    const pricesBeforeNetto = { 1: 1200, 2: 2400, 3: 3600 };
    const res1 = calculateStandardInstallation(blueprintConfig, priceMap, 1).totalSalePriceNet;
    const res2 = calculateStandardInstallation(blueprintConfig, priceMap, 2).totalSalePriceNet;
    const res3 = calculateStandardInstallation(blueprintConfig, priceMap, 3).totalSalePriceNet;

    expect(res1).toBeGreaterThan(pricesBeforeNetto[1]);
    expect(res2).toBeGreaterThan(pricesBeforeNetto[2]);
    expect(res3).toBeGreaterThan(pricesBeforeNetto[3]);

    const diff1 = res1 - pricesBeforeNetto[1];
    const diff2 = res2 - pricesBeforeNetto[2];
    const diff3 = res3 - pricesBeforeNetto[3];

    // Różnice wynikają z kosztów układu (PER_INSTALLATION: 1150 zł) i nowej stawki jednostkowej
    expect(diff1).toBe(1070);
    expect(diff2).toBe(990);
    expect(diff3).toBe(910);
  });
});
