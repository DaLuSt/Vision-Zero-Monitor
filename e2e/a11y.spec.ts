import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Automated WCAG 2.1 A/AA scan of every page, in light and dark mode. It catches missing names,
// contrast and ARIA errors; it does not replace testing with a screen reader and the keyboard.
const PAGES = [
  ['overview', '/'],
  ['countries', '/#/countries'],
  ['country', '/#/countries/NL'],
  ['road users', '/#/road-users?geo=NL'],
  ['chart builder', '/#/charts?geo=EU27_2020,NL&measure=rate'],
  ['data explorer', '/#/explorer'],
  ['legislation', '/#/legislation'],
  ['commitments', '/#/commitments'],
  ['methodology', '/#/methodology'],
  ['sources', '/#/sources'],
  ['open data', '/#/data'],
  ['about', '/#/about'],
] as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const [name, url] of PAGES) {
      test(`${name} has no detectable WCAG A/AA violations`, async ({ page }) => {
        await page.goto(url);
        await expect(page.locator('main h2').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')}`);
        expect(summary, summary.join('\n')).toEqual([]);
      });
    }
  });
}

// Found by a structural review of what screen readers announce (#16).
test('each page has its own title, and chart and heading names read correctly', async ({ page }) => {
  const titles = new Set<string>();
  for (const [, url] of PAGES) {
    await page.goto(url);
    await expect(page.locator('main h2').first()).toBeVisible();
    titles.add(await page.title());
  }
  expect(titles.size).toBe(PAGES.length);
  await page.goto('/#/countries/NL');
  await expect(page).toHaveTitle('Netherlands · Vision Zero Monitor');
  await page.goto('/#/road-users?geo=NL');
  await expect(page.getByRole('figure', { name: /^Road deaths by road user: Netherlands ?: \d{4} · / })).toBeVisible();
  await page.goto('/#/legislation');
  const heading = page.getByRole('heading', { level: 3 }).first();
  await expect(heading).toHaveAccessibleName(/^\S.* official text on EUR-Lex \(external\)$/);
  expect((await heading.textContent())?.match(/\d{4}\/\d+/g)?.length).toBe(1); // the citation is not repeated
});
