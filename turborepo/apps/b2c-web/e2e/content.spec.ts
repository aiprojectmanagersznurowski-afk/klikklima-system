import { test, expect } from '@playwright/test';

test.describe('Content and Legal Pages', () => {
  test('should render Knowledge Base list and article properly', async ({ page }) => {
    await page.goto('/baza-wiedzy');

    // Wait for the main heading
    await expect(page.locator('h1', { hasText: 'Baza' })).toBeVisible();

    // Verify there is at least one article card
    const articleCards = page.locator('a[href^="/baza-wiedzy/"]');
    await expect(articleCards.first()).toBeVisible();

    // Click the first article
    await articleCards.first().click();
    await expect(page).toHaveURL(/.*\/baza-wiedzy\/.+/);

    // Verify article page
    // Poprzednia wersja szukała `button:has-text("Wstecz")`, ale
    // `app/baza-wiedzy/[slug]/page.tsx` renderuje `<Link href="/baza-wiedzy">`
    // (next/link -> <a>), więc lokator nigdy nie trafiał. `<Link>` jest tu
    // poprawnym wyborem produkcyjnym — poprawka jest wyłącznie w selektorze testu.
    await expect(page.getByRole('link', { name: 'Wstecz' })).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
    
    // There should be some markdown rendered content
    await expect(page.locator('.max-w-none')).toBeVisible();
  });

  test('should render About Us page', async ({ page }) => {
    await page.goto('/o-nas');
    await expect(page.locator('h1', { hasText: 'Zmieniamy standardy' })).toBeVisible();
  });

  test('should render Privacy Policy without 404', async ({ page }) => {
    await page.goto('/polityka-prywatnosci');
    await expect(page.locator('h1', { hasText: 'Polityka Prywatności' })).toBeVisible();
  });

  test('should render Terms of Service without 404', async ({ page }) => {
    await page.goto('/regulamin');
    await expect(page.locator('h1', { hasText: 'Regulamin' })).toBeVisible();
  });
});
