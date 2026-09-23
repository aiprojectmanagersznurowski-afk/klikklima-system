import { test, expect } from '@playwright/test';

test.describe('Navigation & Back Button State', () => {
  // @REQ: B2C-NAV-STATE
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

  // @REQ: B2C-NAV-STATE
  test('should restore scroll position when going back from Knowledge Base', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto('/');
    
    const procesSection = page.locator('#proces');
    await procesSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    
    const initialScrollY = await page.evaluate(() => window.scrollY);
    
    const navLink = page.locator('nav a[href="/baza-wiedzy"]').first();
    await navLink.click();
    await expect(page).toHaveURL(/.*\/baza-wiedzy/);

    await page.click('button:has-text("Wstecz")');
    await expect(page).toHaveURL(/\/$/);

    await page.waitForTimeout(1000);
    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(finalScrollY - initialScrollY)).toBeLessThan(150);
  });

  // @REQ: B2C-NAV-STATE
  test('zamknięcie modala urządzenia przywraca adres sprzed otwarcia i nie przewija strony na górę', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto('/');

    const bestsellerySection = page.locator('#bestsellery');
    await bestsellerySection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const initialScrollY = await page.evaluate(() => window.scrollY);
    const initialUrl = page.url();

    // Otwarcie modala z pierwszej karty produktu
    const firstProductBtn = page.locator('#bestsellery button:has-text("Zobacz szczegóły")').first();
    await firstProductBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();

    // Zamknięcie modala przyciskiem zamknięcia (X)
    const closeBtn = modal.locator('button[aria-label="Zamknij"], button:has-text("Zamknij"), button').first();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();

    // Weryfikacja: przywrócony adres URL i scroll nie skoczył na górę (scrollY > 0 i bliski initial)
    expect(page.url()).toBe(initialUrl);
    const afterCloseScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterCloseScrollY - initialScrollY)).toBeLessThan(200);
  });
});
