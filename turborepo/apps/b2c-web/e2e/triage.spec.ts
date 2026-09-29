import { test, expect } from '@playwright/test';
import { isTriageFieldVisible, BUILDING_TYPE_PL, PROPERTY_CONDITION_PL, SLA, type BuildingTypeId, type TriageAnswers } from '@klikklima/contracts';

// B2C-PROPERTY-AREA-BAND (2026-09-25): Step1Location.tsx dokłada dodatkowy krok wyboru
// metrażu na tym samym ekranie, tuż po wyborze lokalizacji, dla BUILDING_TYPE APARTMENT/HOUSE
// (isTriageFieldVisible('PROPERTY_AREA_BAND', ...) — packages/contracts/src/generated/triage.ts).
// Mapowanie etykiety PL -> id budowane tak samo jak w Step1Location.tsx, żeby warunek
// widoczności kroku był identyczny z produkcją, nie zgadywany.
const BUILDING_TYPE_ID_BY_PL: Record<string, BuildingTypeId> = Object.fromEntries(
  (Object.entries(BUILDING_TYPE_PL) as [BuildingTypeId, string][]).map(([id, pl]) => [pl, id])
);

// TEST-DEFECT usunięty (WO: docs/workorders/B2C-TRIAGE-DISQUALIFY.md, sekcja
// "TEST-DEFECT: apps/b2c-web/e2e/triage.spec.ts"): kombinacja `{ location: 'Lokal
// komercyjny', rooms: 1, ... }` oczekiwała ekranu wyceny dla konfiguracji, którą
// kontrakt (`DISQUALIFICATION_RULES[0]`, COMMERCIAL_PROPERTY) każe kierować na ekran
// Eksperta bez ceny. Ten plik zostaje testem WYŁĄCZNIE ścieżki kwalifikującej — kontrola
// negatywna dla multisplitu (2 i 3 pokoje) to główny przypadek biznesowy i zostaje bez
// zmian. Kombinacja z lokalem komercyjnym (z odwróconymi, poprawnymi asercjami — ekran
// Eksperta zamiast wyceny) żyje teraz w apps/b2c-web/e2e/triage-disqualify.spec.ts,
// test "AC1 — Lokal komercyjny (1 pomieszczenie) kończy się ekranem Eksperta...".
// @REQ: B2C-TRIAGE-DISQUALIFY
const combinations = [
  { location: 'Mieszkanie', rooms: 1, sizes: ['Do 20 m²'], state: PROPERTY_CONDITION_PL.FINISHED, balcony: 'Tak' },
  { location: 'Mieszkanie', rooms: 2, sizes: ['21-25 m²', 'Do 20 m²'], state: 'W trakcie remontu', balcony: 'Nie', floor: 'Parter, 1 lub 2' },
  { location: 'Dom', rooms: 3, sizes: ['26-35 m²', '21-25 m²', 'Do 20 m²'], state: 'Stan deweloperski' },
];

test.describe('Triage Flow Combinations', () => {
  for (const combo of combinations) {
    test(`Testing: ${combo.location} -> ${combo.rooms} rooms`, async ({ page }) => {
      test.setTimeout(45000);
      await page.goto('/triage');
      
      // Wait for page to fully load and hydrate
      await page.waitForLoadState('networkidle');

      // Click helper
      const clickOption = async (text: string) => {
        const locator = page.locator(`text="${text}"`).first();
        await expect(locator).toBeVisible({ timeout: 15000 });
        await locator.click({ force: true });
        await page.waitForTimeout(600); // Give Framer Motion time to swap components
      };

      // Step 1: Location
      await clickOption(combo.location);

      // Step 1b: Property area band (B2C-PROPERTY-AREA-BAND) — nowy krok, dodawany na
      // tym samym ekranie co lokalizacja, wyłącznie dla Mieszkania/Domu. Wybór pasma nie
      // wpływa na dalsze kroki tej kombinacji, więc klikamy stałe pasmo "Do X m²"
      // (etykieta złożona z SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm, nie pierwszy z listy ID).
      const buildingType = BUILDING_TYPE_ID_BY_PL[combo.location];
      const areaBandAnswers: TriageAnswers = buildingType ? { BUILDING_TYPE: buildingType } : {};
      if (isTriageFieldVisible('PROPERTY_AREA_BAND', areaBandAnswers)) {
        await clickOption(`Do ${SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm} m²`);
      }

      // Step 2: Rooms count
      const roomsText = `${combo.rooms} ${combo.rooms === 1 ? 'pomieszczenie' : combo.rooms >= 5 ? 'pomieszczeń' : 'pomieszczenia'}`;
      await clickOption(roomsText);

      // Step 3: Sizes
      if (combo.rooms === 1) {
        await clickOption(combo.sizes[0]);
      } else {
        for (let i = 0; i < combo.rooms; i++) {
          const roomContainer = page.locator(`text=Pokój ${i + 1}`).locator('..');
          const btn = roomContainer.locator(`text="${combo.sizes[i]}"`).first();
          await expect(btn).toBeVisible();
          await btn.click({ force: true });
        }
        await clickOption('Dalej');
      }

      // Step 4: State
      await clickOption(combo.state);

      // Step 5: Conditions (only if Mieszkanie)
      if (combo.location === 'Mieszkanie' && combo.balcony) {
        await clickOption(combo.balcony);
        if (combo.balcony === 'Nie' && combo.floor) {
          await clickOption(combo.floor);
        }
      }

      // Step 6 & 7: Wait for AI Loader and Results
      await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible({ timeout: 20000 });
      
      const products = page.locator('.grid > div');
      await expect(products.first()).toBeVisible();

      await expect(page.locator('text=Cena z montażem (brutto)').first()).toBeVisible();
      await expect(page.locator('text="Wybieram ten zestaw"').first()).toBeVisible();
    });
  }
});
