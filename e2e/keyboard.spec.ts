import { expect, test, type Page } from '@playwright/test';

// Keyboard-only use (part of #16). A screen-reader review by a person is still needed; these checks
// cover what can be automated: a working skip link, reachable controls, a visible focus indicator
// on every tab stop, and no keyboard traps.
test.skip(({ isMobile }) => isMobile, 'keyboard navigation is checked on the desktop layout');

const PAGES = ['/', '/#/countries', '/#/countries/NL', '/#/road-users?geo=NL', '/#/charts?geo=EU27_2020,NL&measure=rate',
  '/#/explorer', '/#/legislation', '/#/commitments', '/#/methodology', '/#/sources', '/#/data', '/#/about'];

async function focused(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    // A per-element marker: identical links (e.g. one source link per table row) stay distinct.
    const w = window as unknown as { kbNext?: number };
    if (!el.dataset.kb) el.dataset.kb = String((w.kbNext = (w.kbNext ?? 0) + 1));
    return {
      key: `${el.dataset.kb} ${el.tagName} “${el.textContent?.trim().slice(0, 40)}”`,
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
    };
  });
}

test('the skip link is the first tab stop and moves focus to the content', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h2').first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText('Skip to content');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
});

test('the main navigation works with Tab and Enter', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h2').first()).toBeVisible();
  const target = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Road users' });
  for (let i = 0; i < 30 && !(await target.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Who dies on the roads' })).toBeVisible();
});

for (const url of PAGES) {
  test(`every tab stop on ${url} shows focus and there is no keyboard trap`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('main h2').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    const seen = new Set<string>();
    const noOutline: string[] = [];
    let previous = '';
    let repeats = 0;
    for (let i = 0; i < 600; i++) {
      await page.keyboard.press('Tab');
      const f = await focused(page);
      if (!f) { if (seen.size) break; continue; } // focus left the page: the whole tab order was walked
      if (seen.has(f.key) && f.key !== previous) break; // wrapped around to an earlier stop
      repeats = f.key === previous ? repeats + 1 : 0;
      expect(repeats, `keyboard trap at ${f.key}`).toBeLessThan(3);
      if (!f.outline) noOutline.push(f.key);
      seen.add(f.key);
      previous = f.key;
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(noOutline, `tab stops without a visible focus indicator:\n${noOutline.join('\n')}`).toEqual([]);
  });
}

test('the chart builder can be operated with the keyboard', async ({ page }) => {
  await page.goto('/#/charts?geo=EU27_2020&measure=deaths');
  const nl = page.getByRole('checkbox', { name: 'Netherlands' });
  await nl.focus();
  await page.keyboard.press('Space');
  await expect(nl).toBeChecked();
  const rate = page.getByRole('button', { name: /per million/i }).first();
  await rate.focus();
  await page.keyboard.press('Enter');
  await expect(rate).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/geo=[^&]*NL/);
});

test('the legislation filters can be operated with the keyboard', async ({ page }) => {
  await page.goto('/#/legislation');
  const register = page.getByRole('region', { name: 'Register of legal acts' });
  const status = register.getByLabel('Status');
  await status.focus();
  const before = await status.inputValue();
  await page.keyboard.press('ArrowDown');
  await expect(status).not.toHaveValue(before);
  const search = register.getByLabel('Search');
  await search.focus();
  await page.keyboard.type('no such act');
  await expect(register.getByText('No acts match these filters.')).toBeVisible();
});
