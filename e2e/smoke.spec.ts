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

test('legislation page lists acts with links to EUR-Lex and filters them', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/legislation');
  await expect(page.getByRole('heading', { name: 'EU road safety legislation' })).toBeVisible();
  const register = page.getByRole('region', { name: 'Register of legal acts' });
  await expect(register.getByRole('article').first()).toBeVisible();
  await register.getByLabel('Search').fill('2015/413');
  const act = register.getByRole('article', { name: /Directive \(EU\) 2015\/413/ });
  await expect(act).toBeVisible();
  await expect(act.getByRole('link').first()).toHaveAttribute('href', /eur-lex\.europa\.eu.*CELEX:32015L0413/);
  await act.getByText('Lifecycle and related acts').click();
  await expect(act.getByText('COM(2014) 476')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('about page explains who is behind the site and how to report errors', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: /menu/i }).click();
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About Vision Zero Monitor' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'open an issue on GitHub' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('commitments page quotes official documents and draws targets against official data', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: /menu/i }).click();
  await page.getByRole('link', { name: 'Commitments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Policy commitments' })).toBeVisible();
  const card = page.getByRole('article', { name: /Halve road deaths and serious injuries between 2020 and 2030/ });
  await expect(card.getByText(/between 2020 and 2030/).first()).toBeVisible();
  await expect(card.getByRole('link', { name: 'SWD(2019) 283 final' })).toHaveAttribute('href', /op\.europa\.eu/);
  await expect(page.locator('figure .recharts-line')).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
