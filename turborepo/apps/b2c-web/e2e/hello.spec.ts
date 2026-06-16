import { test, expect } from '@playwright/test';

test('homepage has Hello World', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Hello Klik Klima B2C!');
});
