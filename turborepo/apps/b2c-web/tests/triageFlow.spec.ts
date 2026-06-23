import { test, expect } from '@playwright/test';

test.describe('B2C Catalog & Triage Flow', () => {

  // Definiujemy przypadki testowe dla różnych ilości pomieszczeń
  const testCases = [
    { rooms: 1, sizes: ['26-35 m²'], shouldHaveMatch: true },
    { rooms: 3, sizes: ['26-35 m²', '36-50 m²', 'Do 25 m²'], shouldHaveMatch: true },
    { rooms: 5, sizes: ['26-35 m²', '26-35 m²', '26-35 m²', '26-35 m²', '26-35 m²'], shouldHaveMatch: true }
  ];

  for (const { rooms, sizes, shouldHaveMatch } of testCases) {
    test(`Should test KJCAL flow for ${rooms} rooms`, async ({ page }) => {
      // 1. Otwieramy stronę główną katalogu
      await page.goto('/');

      // 2. Klikamy pierwszą kartę z serii KJCAL
      // Czekamy aż lista się załaduje i szukamy KJCAL
      await page.waitForSelector('text=KJCAL');
      await page.click('text=KJCAL');

      // 3. Modal z konfiguracją powinien się otworzyć
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // 4. Wybieramy liczbę pomieszczeń
      if (rooms > 1) {
        await page.click(`button:has-text("${rooms}")`);
      }

      // 5. Wybieramy metraże dla poszczególnych pokoi
      for (let i = 0; i < rooms; i++) {
        // Find the room section (e.g. Pokój 1, Pokój 2)
        const roomSection = modal.locator('div').filter({ hasText: `Pokój ${i + 1}` }).first();
        const sizeText = sizes[i];
        
        // Klikamy metraż w sekcji pokoju
        await roomSection.locator('button', { hasText: sizeText }).click();
      }

      // 6. Czekamy na załadowanie dopasowanego agregatu lub jego brak
      // Używamy timeoutu żeby dać zapytaniu do bazy czas
      await page.waitForTimeout(2000); 

      if (shouldHaveMatch) {
        // Oczekujemy przycisku z napisem "Umów termin audytu" i nie chcemy żeby był disabled
        const auditBtn = modal.locator('button:has-text("Umów termin audytu")');
        await expect(auditBtn).toBeEnabled();
        
        // Przechodzimy do Triage
        await auditBtn.click();
        
        // Oczekujemy że jesteśmy na kroku 7 i widać warianty
        await page.waitForURL('**/triage**');
        
        // Powinno się pokazać podsumowanie "Znaleźliśmy X świetnych wariantów"
        await expect(page.locator('text=Znaleźliśmy')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('text=Niestety, nie znaleźliśmy wariantów')).not.toBeVisible();
      } else {
        // Jeśli nie powinno być matchu, to modal wyświetla 'Brak agregatu' i blokuje przycisk
        const auditBtn = modal.locator('button:has-text("Umów termin audytu")');
        await expect(auditBtn).toBeDisabled();
        await expect(modal.locator('text=Brak agregatu')).toBeVisible();
      }
    });
  }
});
