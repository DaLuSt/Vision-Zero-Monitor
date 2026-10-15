import { expect, test } from '@playwright/test';

test('overview renders real data without console errors or horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Vision Zero Monitor' })).toBeVisible();
  await expect(page.locator('.kpi').first()).toContainText(/\d/);
  await expect(page.getByRole('figure').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('navigation to countries and a country detail works', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: /menu/i }).click();
  await page.getByRole('link', { name: 'Countries', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Member State comparison' })).toBeVisible();
  await page.getByRole('link', { name: 'Netherlands' }).click();
  await expect(page.getByRole('heading', { name: 'Netherlands', level: 2 })).toBeVisible();
});

test('chart builder plots a comparison and exports a PNG', async ({ page }) => {
  await page.goto('/#/charts?geo=EU27_2020,NL&measure=rate&layout=combined');
  const fig = page.getByRole('figure', { name: /2 geographies compared/ });
  await expect(fig.locator('svg.recharts-surface')).toBeVisible();
  await expect(fig.locator('.recharts-line')).toHaveCount(2);
  const [download] = await Promise.all([page.waitForEvent('download'), fig.getByRole('button', { name: /^PNG/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole('checkbox', { name: 'Belgium' }).check();
  const fig3 = page.getByRole('figure', { name: /3 geographies compared/ });
  await expect(fig3.locator('.recharts-line')).toHaveCount(3);
  await expect(page).toHaveURL(/geo=EU27_2020,BE,NL/);
});

test('road users page shows both breakdowns for a country', async ({ page }) => {
  await page.goto('/#/road-users?geo=NL');
  await expect(page.getByRole('heading', { name: 'By road user' })).toBeVisible();
  const vehicle = page.getByRole('region', { name: 'By mode of transport' });
  await expect(vehicle.getByRole('rowheader', { name: /Cyclists/ })).toBeVisible();
  await expect(vehicle.locator('.recharts-bar-rectangle')).toHaveCount(8);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
