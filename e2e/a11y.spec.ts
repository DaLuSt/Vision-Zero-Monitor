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
