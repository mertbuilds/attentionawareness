import { expect, test } from '@playwright/test';

// One path through the whole stack: the landing page renders and hydrates.
test('the landing page loads', async ({ page }) => {
  await page.goto('/');
  // Set by a root effect once React takes over; proves the bundle ran.
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30_000 });
  await expect(page.getByText('Your attention is more valuable than gold in 2026')).toBeVisible();
});
