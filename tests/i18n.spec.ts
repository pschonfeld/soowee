import { expect, test } from '@playwright/test';

// Czech is the default language at `/`, English lives under `/en/` (AGENTS.md, decision 6). The rest of the suite
// runs on the English pages; this file covers what differs by language.

test('Czech is the default, English is one link away, both ways', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page.getByRole('heading', { name: 'Všechny recepty' })).toBeVisible();
  const toEnglish = page.locator('.footer__language');
  await expect(toEnglish).toHaveAttribute('hreflang', 'en');
  await toEnglish.click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('.footer__language').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
});

test('a recipe links to the same recipe in the other language', async ({ page }) => {
  await page.goto('/crepes/');
  await expect(page.locator('h1')).toHaveText('Palačinky');
  await page.locator('.footer__language').click();
  await expect(page).toHaveURL(/\/en\/crepes\/$/);
  await expect(page.locator('h1')).toHaveText('Crêpes');
  await expect(page.locator('.back')).toHaveAttribute('href', '/en/');
});

test('Czech nouns follow the number when the recipe is scaled', async ({ page }) => {
  await page.goto('/crepes/');
  const eggs = page.locator('.ingredients li', { hasText: 'vejce' }).or(page.locator('.ingredients li', { hasText: 'vajec' }));
  const step = page.locator('.directions__steps p', { hasText: 'V odměrce' });
  // The number and the name are separate boxes in the list, so their text has no space between them.
  await expect(eggs).toContainText(/^3\s*vejce/);
  await expect(page.locator('.meta [data-yield]')).toHaveText('4 porce');
  await expect(page.getByText('½ lžičky')).toHaveCount(2); // the list and the step

  const up = page.getByRole('button', { name: 'Více' });
  await up.click(); // 1½×
  await expect(eggs).toContainText(/^4½\s*vejce/);
  await up.click(); // 2×
  await up.click(); // 3×
  await expect(eggs).toContainText(/^9\s*vajec/);
  await expect(step).toContainText('9 vajec');
  await expect(page.locator('.meta [data-yield]')).toHaveText('12 porcí');
  await expect(page.getByText('1½ lžičky').first()).toBeVisible();
});

test('generated Czech text: time sentence and timers', async ({ page }) => {
  await page.goto('/crepes/');
  await expect(page.locator('.section-sub--time')).toHaveText('50 min práce, k tomu 1 h odležení.');
  await expect(page.locator('.meta')).toContainText('+ 1 h odležení');
  const timer = page.locator('.directions .duration', { hasText: '1 minutu' });
  await expect(timer).toHaveText('1 minutu');
  await expect(timer).not.toHaveAttribute('role', 'button');
});

for (const locale of ['cs', 'en'] as const) {
  test(`${locale}: servings and approximate pieces scale together and survive reload`, async ({ page }) => {
    await page.goto(`${locale === 'cs' ? '' : '/en'}/crepes/`);
    const servings = page.locator('.ingredients [data-yield]');
    const pieces = page.locator('.ingredients [data-yield-pieces]');
    const cookPieces = page.locator('#panel-ingredients [data-yield-pieces]');
    const count = (n: number) => `${n} ${locale === 'cs' ? 'palačinek' : 'crêpes'}`;
    await expect(servings).toHaveText(locale === 'cs' ? '4 porce' : '4 servings');
    await expect(pieces).toHaveText(count(12));
    await expect(pieces.locator('..')).toContainText(locale === 'cs' ? 'cca' : 'about');
    await page.locator('[data-scale="1"]').click();
    await page.locator('[data-scale="1"]').click();
    await expect(servings).toHaveText(locale === 'cs' ? '8 porcí' : '8 servings');
    await expect(pieces).toHaveText(count(24));
    await expect(cookPieces).toHaveText(count(24));
    await page.reload();
    await expect(pieces).toHaveText(count(24));
    await expect(cookPieces).toHaveText(count(24));
    for (let i = 0; i < 3; i++) await page.locator('[data-scale="-1"]').click();
    await expect(servings).toHaveText(locale === 'cs' ? '2 porce' : '2 servings');
    await expect(pieces).toHaveText(count(6));
    // A larger batch makes more pancakes, not larger pancakes.
    await expect(page.locator('.directions')).toContainText('65');
    await expect(page.locator('.equipment')).toContainText('28 cm');
  });
}
