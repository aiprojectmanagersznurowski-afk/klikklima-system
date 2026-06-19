import { test, expect } from '@playwright/test';

const combinations = [
  { location: 'Mieszkanie', rooms: 1, sizes: ['Do 25 m²'], state: 'Wykończony / Zamieszkany', balcony: 'Tak' },
  { location: 'Mieszkanie', rooms: 2, sizes: ['26-35 m²', 'Do 25 m²'], state: 'W trakcie remontu', balcony: 'Nie', floor: 'Parter, 1 lub 2' },
  { location: 'Dom', rooms: 3, sizes: ['36-50 m²', '26-35 m²', 'Do 25 m²'], state: 'Stan deweloperski' },
  { location: 'Lokal komercyjny', rooms: 1, sizes: ['Powyżej 50 m²'], state: 'W trakcie remontu' }
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
      if (combo.location === 'Mieszkanie') {
        await clickOption(combo.balcony);
        if (combo.balcony === 'Nie' && combo.floor) {
          await clickOption(combo.floor);
        }
      }

      // Step 6 & 7: Wait for AI Loader and Results
      await expect(page.locator('text=Rekomendowane klimatyzatory')).toBeVisible({ timeout: 20000 });
      
      const products = page.locator('.grid > div');
      await expect(products.first()).toBeVisible();

      await expect(page.locator('text=Szacunkowy koszt inwestycji')).toBeVisible();
      await expect(page.locator('text="Rezerwuj termin audytu"')).toBeVisible();
    });
  }
});
