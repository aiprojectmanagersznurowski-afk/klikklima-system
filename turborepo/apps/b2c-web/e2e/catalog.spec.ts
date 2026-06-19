import { test, expect } from '@playwright/test';

test.describe('Catalog Page', () => {
  test('should display all catalog sections and device modal', async ({ page }) => {
    await page.goto('/katalog');

    // Wait for the main title
    await expect(page.locator('h1', { hasText: 'Katalog' })).toBeVisible();

    // Verify sections
    await expect(page.locator('h2', { hasText: 'Klimatyzatory Ścienne (Single Split)' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Jednostki Wewnętrzne (Multi Split)' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Agregaty Zewnętrzne (Multi Split)' })).toBeVisible();

    // Click the first product card to open modal
    const firstProduct = page.locator('.group.relative').first();
    await expect(firstProduct).toBeVisible();
    
    // We click the button inside it "Zobacz szczegóły"
    await firstProduct.locator('button:has-text("Zobacz szczegóły")').click();

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
