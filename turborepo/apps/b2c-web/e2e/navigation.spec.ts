import { test, expect } from '@playwright/test';

test.describe('Navigation & Back Button State', () => {
  test('should restore scroll position when going back from Catalog', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto('/');

    const bestsellerySection = page.locator('#bestsellery');
    await expect(bestsellerySection).toBeInViewport({ timeout: 15000 }).catch(() => {});
    await bestsellerySection.scrollIntoViewIfNeeded();
    
    await page.waitForTimeout(1000);

    const initialScrollY = await page.evaluate(() => window.scrollY);
    
    // Using an href selector or specific text
    await page.click('a[href="/katalog"]');
    await expect(page).toHaveURL(/.*\/katalog/);

    await page.click('button:has-text("Wstecz")');
    await expect(page).toHaveURL(/\/$/);

    await page.waitForTimeout(1000);
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(finalScrollY - initialScrollY)).toBeLessThan(150);
  });

  test('should restore scroll position when going back from Knowledge Base', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto('/');
    
    const procesSection = page.locator('#proces');
    await procesSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    
    const initialScrollY = await page.evaluate(() => window.scrollY);
    
    // Go to Baza Wiedzy via navbar. We can just navigate directly or click the nav link
    const navLink = page.locator('nav a[href="/baza-wiedzy"]').first();
    await navLink.click();
    await expect(page).toHaveURL(/.*\/baza-wiedzy/);

    await page.click('button:has-text("Wstecz")');
    await expect(page).toHaveURL(/\/$/);

    await page.waitForTimeout(1000);
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(finalScrollY - initialScrollY)).toBeLessThan(150);
  });
});
