import { test, expect } from '@playwright/test';

test.describe('Home Page & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display main navigation links', async ({ page }) => {
    const navbar = page.locator('nav').first();
    await expect(navbar.locator('a[href="/#oferta"]')).toBeVisible();
    await expect(navbar.locator('a[href="/#proces"]')).toBeVisible();
    await expect(navbar.locator('a[href="/#bestsellery"]')).toBeVisible();
    await expect(navbar.locator('a[href="/baza-wiedzy"]')).toBeVisible();
    await expect(navbar.locator('a[href="/o-nas"]')).toBeVisible();
  });

  test('anchor links should scroll to correct sections', async ({ page }) => {
    // Click the anchor links
    await page.locator('nav').first().locator('a[href="/#oferta"]').click({ force: true });
    await expect(page).toHaveURL(/.*#oferta/);

    await page.locator('nav').first().locator('a[href="/#bestsellery"]').click({ force: true });
    await expect(page).toHaveURL(/.*#bestsellery/);

    await page.locator('nav').first().locator('a[href="/#proces"]').click({ force: true });
    await expect(page).toHaveURL(/.*#proces/);
  });

  test('CTA buttons should redirect to triage', async ({ page }) => {
    const cta = page.locator('a[href="/triage"]').first();
    await expect(cta).toBeVisible();
    await cta.click({ force: true });
    await expect(page).toHaveURL(/.*\/triage/);
  });

  test('footer should contain legal links', async ({ page }) => {
    const footer = page.locator('footer#kontakt').first();
    const privacy = footer.locator('a[href="/polityka-prywatnosci"]');
    const terms = footer.locator('a[href="/regulamin"]');

    await expect(privacy).toBeVisible();
    await expect(terms).toBeVisible();
  });
});
