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
  await expect(page.locator('.meta [data-yield]')).toHaveText('12–14 palačinek');
  await expect(page.getByText('½ lžičky')).toHaveCount(2); // the list and the step

  const up = page.getByRole('button', { name: 'Více' });
  await up.click(); // 1½×
  await expect(eggs).toContainText(/^4½\s*vejce/);
  await up.click(); // 2×
  await up.click(); // 3×
  await expect(eggs).toContainText(/^9\s*vajec/);
  await expect(step).toContainText('9 vajec');
  await expect(page.locator('.meta [data-yield]')).toHaveText('36–42 palačinek');
  await expect(page.getByText('1½ lžičky').first()).toBeVisible();
});

test('generated Czech text: time sentence, timers and announcements', async ({ page }) => {
  await page.goto('/crepes/');
  await expect(page.locator('.section-sub--time')).toHaveText('50 min práce, k tomu 1 h odležení.');
  await expect(page.locator('.meta')).toContainText('+ 1 h odležení');
  const timer = page.locator('.directions .timer', { hasText: '1 minutu' });
  await expect(timer).toHaveAttribute('aria-label', 'Spustit minutku na 1 minutu');
  await page.getByRole('button', { name: 'Uložit' }).click();
  await expect(page.locator('[data-toast]')).toHaveText('Recept uložen');
  await expect(page.locator('[data-save-label]')).toHaveText('Uloženo');
});
