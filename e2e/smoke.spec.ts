import { expect, test } from '@playwright/test';

// One path through the whole stack: the landing page renders and hydrates.
test('the landing page loads', async ({ page }) => {
  await page.goto('/');
  // Set by a root effect once React takes over; proves the bundle ran.
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: /daily average screen time/i }),
  ).toBeVisible();
});
