import { test, expect } from '@playwright/test';

test.describe('Booking Form Validations', () => {
  test('should validate empty inputs and incorrect formats in booking form', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto('/triage');
    
    const clickOption = async (text: string) => {
      const locator = page.locator(`button:has-text("${text}")`).first();
      await expect(locator).toBeVisible({ timeout: 15000 });
      await locator.click({ force: true });
      await page.waitForTimeout(500);
    };

    // Fast path triage
    await clickOption('Mieszkanie');
    await clickOption('1 pomieszczenie');
    await clickOption('Do 20 m²');
    await clickOption('Wykończony');
    await clickOption('Tak');

    // Wait for results
    await expect(page.locator('text=Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania')).toBeVisible({ timeout: 20000 });
    
    // Open Booking form (Step8Booking) — "Rezerwuj termin audytu" nigdy nie
    // istniał w produkcji; realny przycisk w Step7Success.tsx to "Wybieram ten zestaw".
    await clickOption('Wybieram ten zestaw');

    // Step8Booking jest ekranem inline w kreatorze, nie modalem; StepWrapper renderuje
    // tytuł jako <h2>, a realny tekst to "Wybierz termin darmowej wyceny" (Step8Booking.tsx:225).
    await expect(page.locator('h2:has-text("Wybierz termin darmowej wyceny")')).toBeVisible();

    // Select a date — "button.bg-primary/5" nie odpowiada żadnej klasie przycisku dnia
    // w Step8Booking.tsx; ten sam kalendarz jest już poprawnie celowany w
    // triage-disqualify.spec.ts (AC19) tym wzorcem.
    const dateButton = page.locator('div.grid-cols-7 button:not([disabled])').first();
    await dateButton.click({ force: true });
    
    // Select a time slot
    const timeSlot = page.locator('button:has-text(":")').first();
    await timeSlot.click({ force: true });

    // Now on contact form
    // Try to submit empty form
    await clickOption('Potwierdź rezerwację');

    // Should see validation errors for name, email, phone, address, zip code, city
    await expect(page.locator('text=Imię i nazwisko jest wymagane')).toBeVisible();
    await expect(page.locator('text=Niepoprawny format adresu e-mail')).toBeVisible();
    await expect(page.locator('text=Adres montażu jest wymagany')).toBeVisible();

    // Fill incorrect email and phone
    await page.fill('input[name="email"]', 'not-an-email');
    await page.fill('input[name="phone"]', '123'); // Too short
    await clickOption('Potwierdź rezerwację');

    await expect(page.locator('text=Niepoprawny format adresu e-mail')).toBeVisible();
    await expect(page.locator('text=Podaj poprawny polski numer')).toBeVisible();

    // Fill correct values
    await page.fill('input[name="name"]', 'Jan Kowalski');
    await page.fill('input[name="email"]', 'jan.kowalski@example.com');
    await page.fill('input[name="phone"]', '123456789');
    await page.fill('input[name="address"]', 'Kwiatowa 1');
    await page.fill('input[name="zipCode"]', '00-001');
    await page.fill('input[name="city"]', 'Warszawa');

    // We do NOT click submit to avoid polluting the DB, just verify errors disappear
    await clickOption('Potwierdź rezerwację');
    
    await expect(page.locator('text=Imię i nazwisko jest wymagane')).not.toBeVisible();
    await expect(page.locator('text=Niepoprawny format adresu e-mail')).not.toBeVisible();
  });
});
