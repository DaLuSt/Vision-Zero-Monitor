import { expect, test } from '@playwright/test';

test('overview renders real data without console errors or horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'EU Road Safety Vision Zero Observatory' })).toBeVisible();
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
