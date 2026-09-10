import { expect, test, type Page } from '@playwright/test';

// Vite dev SSR renders forms before React hydrates; a native submit would
// GET-navigate with credentials in the query. Wait for the root effect marker.
async function goHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30_000 });
}

// One path through the whole stack: signup → dashboard → logout → login →
// subscribe attempt. Serial: later steps reuse the account created first.
test.describe.configure({ mode: 'serial' });

const email = `smoke-${Date.now()}@example.com`;
const password = 'password1234';

test('signup lands on the dashboard', async ({ page }) => {
  await goHydrated(page, '/signup');
  await page.getByLabel('Name').fill('Smoke Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test('logout then login returns to the dashboard', async ({ page }) => {
  await goHydrated(page, '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL(/\/$/);

  await goHydrated(page, '/dashboard');
  await page.waitForURL('**/login');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test('subscribe attempt surfaces a localized error, not a crash', async ({ page }) => {
  // Known local gap (ADR-0001): emulate has no /v1/subscriptions, so the
  // Better Auth upgrade call 500s. The UI must degrade to a friendly message.
  await goHydrated(page, '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('button', { name: 'Subscribe to Pro' }).click();
  await expect(page.getByRole('alert')).toContainText('Something went wrong');
  await expect(page.getByText('Signed in as', { exact: false })).toBeVisible();
});
