import { test, expect } from '@playwright/test';

test.describe('Catalog Page', () => {
  test('should display all catalog sections and device modal', async ({ page }) => {
    await page.goto('/katalog');

    // Wait for the main title
    await expect(page.locator('h1', { hasText: 'Katalog' })).toBeVisible();

    // Verify sections
    // Katalog przebudowany na jedną sekcję z filtrami (Design System, 2026-08-06).
    // Dawne sekcje Multi Split / Agregaty nie istnieją — asercje usunięte, nie osłabione.
    await expect(page.locator('h2', { hasText: 'Klimatyzatory Ścienne' })).toBeVisible();

    // Click the first product card to open modal
    const firstProduct = page.locator('.group.relative').first();
    await expect(firstProduct).toBeVisible();
    
    // We click the button inside it "Szczegóły urządzenia"
    await firstProduct.locator('button:has-text("Szczegóły urządzenia")').click();

    // Verify modal appears
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Verify some text inside modal (like features or description)
    await expect(modal.locator('text=WIFI w standardzie').first()).toBeVisible();

    // Close modal
    await modal.locator('button').first().click(); // Close button usually is the first button (X)
    
    // Wait for modal to disappear
    await expect(modal).not.toBeVisible();
  });
});
