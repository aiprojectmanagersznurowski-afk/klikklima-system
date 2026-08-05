import { test, expect } from '@playwright/test';

test.describe('Moduł Klienci B2B i Karta 360', () => {
  test('Powinien wyświetlić listę klientów i pozwolić otworzyć kartę szczegółową w nowej karcie', async ({ page, context }) => {
    // 1. Przejdź na stronę klientów
    await page.goto('/clients');
    await expect(page.locator('h1')).toContainText('Klienci w Systemie');
    await expect(page.getByPlaceholder('Szukaj po imieniu, emailu, telefonie...')).toBeVisible();

    // 2. Sprawdź czy atrybut target="_blank" i rel="noopener noreferrer" jest obecny w przycisku do otwarcia
    const firstClientLink = page.locator('table tbody tr:first-child text="Karta 360"').locator('..').locator('..');
    
    if (await firstClientLink.count() > 0) {
      await expect(firstClientLink).toHaveAttribute('target', '_blank');
      await expect(firstClientLink).toHaveAttribute('rel', 'noopener noreferrer');

      // 3. Oczekuj na nową kartę (page) w kontekście po kliknięciu
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        firstClientLink.click(),
      ]);

      await newPage.waitForLoadState();

      // 4. Zweryfikuj zakładki i sekcje w karcie 360
      await expect(newPage.getByRole('tab', { name: /Szczegóły Klienta/ })).toBeVisible();
      await expect(newPage.getByRole('tab', { name: /Powiązane Leady/ })).toBeVisible();
      await expect(newPage.getByRole('tab', { name: /Instalacje/ })).toBeVisible();
      await expect(newPage.getByRole('tab', { name: /Serwisy i Usterki/ })).toBeVisible();
      await expect(newPage.getByRole('tab', { name: /Dokumenty i Faktury/ })).toBeVisible();
      await expect(newPage.getByRole('tab', { name: /Notatki/ })).toBeVisible();
      await expect(newPage.getByRole('tab', { name: /Ostatnie Kontakty/ })).toBeVisible();
    }
  });
});
