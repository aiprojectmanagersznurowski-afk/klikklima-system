import { test, expect } from '@playwright/test';

test('homepage has correct heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('przez cały rok');
});
