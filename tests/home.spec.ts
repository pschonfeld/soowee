import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const RECIPES = [
  { slug: 'bolognese-sauce', title: 'Bolognese Sauce' },
  { slug: 'crepes', title: 'Crêpes' },
  { slug: 'fish-and-chips', title: 'Fish & Chips' },
  { slug: 'lasagna', title: 'Lasagna' },
  { slug: 'marry-me-chicken-pasta', title: 'Marry Me Chicken Pasta' },
  { slug: 'tiramisu', title: 'Tiramisu' },
];
const FEATURED = 'lasagna';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const items = (page: Page) => page.locator('.item');
const visibleTitles = (page: Page) => page.locator('.item:not([hidden]) .item__title').allInnerTexts();
const search = (page: Page) => page.getByRole('searchbox', { name: 'Search recipes' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('lists every recipe once, alphabetically, each linking to its page', async ({ page }) => {
  await expect(items(page)).toHaveCount(RECIPES.length);
  expect(await visibleTitles(page)).toEqual(RECIPES.map((r) => r.title));
  for (const { slug, title } of RECIPES) {
    await expect(page.locator(`.item[data-slug="${slug}"] a`)).toHaveAttribute('href', `/${slug}/`);
    await expect(page.locator(`.item[data-slug="${slug}"] .item__title`)).toHaveText(title);
  }
});

test('the featured recipe leads the page and is also in the list', async ({ page }) => {
  const feature = page.locator('.feature');
  await expect(feature).toHaveAttribute('href', `/${FEATURED}/`);
  await expect(feature.getByRole('heading')).toHaveText('Lasagna');
  await expect(page.locator(`.item[data-slug="${FEATURED}"]`)).toBeVisible();
});

test('each time reads exactly as in its recipe hero', async ({ page }) => {
  for (const { slug } of RECIPES) {
    const listed = (await page.locator(`.item[data-slug="${slug}"] .item__meta`).innerText()).replace(/\s+/g, ' ').trim();
    const hero = await page.context().newPage();
    await hero.goto(`/${slug}/`);
    const time = hero.locator('.meta > div').first().locator('dd');
    const heroText = (await time.innerText()).replace(/\s+/g, ' ').trim();
    await hero.close();
    expect(listed, slug).toBe(heroText);
  }
  // The rule from the time model: a wait follows the cooking time.
  await expect(page.locator('.item[data-slug="crepes"] .item__meta')).toContainText('+ 1 hr resting');
});

test('search filters in place, by word starts, ignoring case and accents', async ({ page }) => {
  await search(page).fill('masc');
  await expect.poll(() => visibleTitles(page)).toEqual(['Tiramisu']);
  await expect(page.locator('.feature')).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('1 recipe');

  await search(page).fill('CREPES');
  await expect.poll(() => visibleTitles(page)).toEqual(['Crêpes']);

  // Every word must match (word starts only: unit-tested in src/lib/search.test.ts).
  await search(page).fill('italian tagliatelle');
  await expect.poll(() => visibleTitles(page)).toEqual(['Bolognese Sauce', 'Marry Me Chicken Pasta']);

  await search(page).press('Escape');
  await expect(search(page)).toHaveValue('');
  await expect(items(page).filter({ visible: true })).toHaveCount(RECIPES.length);
  await expect(page.locator('.feature')).toBeVisible();
});

test('the clear button shows only with text, empties the field and keeps it focused', async ({ page }) => {
  const clear = page.getByRole('button', { name: 'Clear text', exact: true });
  await expect(clear).toBeHidden();
  await search(page).fill('masc');
  await expect(clear).toBeVisible();
  const box = (await clear.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44); // a full tap target
  await clear.click();
  await expect(search(page)).toHaveValue('');
  await expect(search(page)).toBeFocused();
  await expect(clear).toBeHidden();
  await expect(items(page).filter({ visible: true })).toHaveCount(RECIPES.length);
});

test('no results says so and can be cleared', async ({ page }) => {
  await search(page).fill('pho');
  await expect(page.getByText('No recipes match “pho”.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search(page)).toHaveValue('');
  await expect(search(page)).toBeFocused();
  await expect(items(page).filter({ visible: true })).toHaveCount(RECIPES.length);
});

test('the search is re-applied when coming back to the page', async ({ page }) => {
  await search(page).fill('masc');
  await expect.poll(() => visibleTitles(page)).toEqual(['Tiramisu']);
  await page.locator('.item[data-slug="tiramisu"] a').click();
  await expect(page).toHaveURL(/\/tiramisu\/$/);
  await page.goBack();
  // Whether the browser restores the typed query or not, the list must agree with the field.
  const query = await search(page).inputValue();
  await expect.poll(() => visibleTitles(page)).toEqual(query ? ['Tiramisu'] : RECIPES.map((r) => r.title));
});

test('recipes saved on this device show a badge', async ({ page }) => {
  const badge = page.locator('.item[data-slug="tiramisu"] [data-saved]');
  await expect(badge).toBeHidden();
  await page.goto('/tiramisu/');
  await page.locator('[data-save]').click();
  await page.goto('/');
  await expect(badge).toBeVisible();
  await expect(page.locator('.item[data-slug="tiramisu"] a')).toContainText('Saved');
  await expect(page.locator('[data-saved]:visible')).toHaveCount(1);
});

test('the browser bar colour follows the appearance switch, not only the system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  // The theme-color the browser would use: the first one whose media query matches.
  const barColour = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
          .find((m) => !m.media || matchMedia(m.media).matches)
          ?.content,
    );
  expect(await barColour()).toBe('#f2f2f7');

  await page.getByRole('radio', { name: 'Dark' }).check({ force: true });
  expect(await barColour()).toBe('#000000');
  await page.reload(); // applied before first paint by the inline script, too
  expect(await barColour()).toBe('#000000');

  await page.getByRole('radio', { name: 'Auto' }).check({ force: true });
  expect(await barColour()).toBe('#f2f2f7');
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await barColour()).toBe('#000000');
});

test('phones: rows with a square photo beside the text; wider screens: cards with the photo above', async ({ page }) => {
  const boxes = await Promise.all([0, 1, 2].map(async (i) => (await items(page).nth(i).boundingBox())!));
  const photo = (await items(page).first().locator('.item__media').boundingBox())!;
  const text = (await items(page).first().locator('.item__text').boundingBox())!;
  const width = page.viewportSize()!.width;
  if (width < 768) {
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1); // one column
    expect(Math.abs(photo.width - photo.height)).toBeLessThan(1); // square
    expect(photo.x + photo.width).toBeLessThanOrEqual(text.x); // beside the text
  } else {
    expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(1); // second card beside the first
    // Three columns from 1024px wide, two below.
    if (width >= 1024) expect(Math.abs(boxes[2].y - boxes[0].y)).toBeLessThan(1);
    else expect(boxes[2].y).toBeGreaterThan(boxes[0].y + 1);
    expect(Math.abs(photo.width / photo.height - 4 / 3)).toBeLessThan(0.02); // 4:3
    expect(photo.y + photo.height).toBeLessThanOrEqual(text.y); // above the text
  }
});

test('the search bar scrolls away with the wordmark instead of covering the list', async ({ page }) => {
  const before = (await search(page).boundingBox())!;
  // `instant`: the site uses smooth scrolling, which WebKit would animate.
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const scrolled = await page.evaluate(() => scrollY);
  expect(scrolled).toBeGreaterThan(before.y + 300);
  const bar = (await search(page).boundingBox())!;
  expect(bar.y + bar.height).toBeLessThan(0); // above the viewport
});

test('the first visible row has no separator, also while searching', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, 'Wider screens use cards separated by space, not lines');
  const separator = (slug: string) =>
    page.locator(`.item[data-slug="${slug}"] > a`).evaluate((a) => getComputedStyle(a, '::before').content);
  expect(await separator('bolognese-sauce')).toBe('none');
  expect(await separator('fish-and-chips')).not.toBe('none');
  await search(page).fill('tiramisu');
  await expect.poll(() => visibleTitles(page)).toEqual(['Tiramisu']);
  expect(await separator('tiramisu')).toBe('none');
});

test('has no horizontal overflow', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('photo credits live on the recipe page each item links to', async ({ page }) => {
  await expect(page.locator('.footer')).not.toContainText('Photo');
  // Fish & Chips is CC BY-SA 4.0: attributed on the page its item links to.
  await page.locator('.item[data-slug="fish-and-chips"] a').click();
  await expect(page.locator('.footer').getByRole('link', { name: 'Matthias Meckel' })).toBeVisible();
  await expect(page.locator('.footer')).toContainText('CC BY-SA 4.0');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`passes WCAG 2.2 AA checks (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  });
}

test('screenshots for visual review', async ({ page }, testInfo) => {
  const dir = `screenshots/${testInfo.project.name}`;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.reload();
    // Lazy photos: scroll each into view and wait for it, or the full-page shot shows empty tiles.
    for (const img of await page.locator('.feature img, .item img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((el: HTMLImageElement) => el.decode());
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${dir}/home-${scheme}.png`, fullPage: true });
    // Scrolled into the list: how rows look mid-page (the search bar has scrolled away with the wordmark).
    await page.locator('#all').evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY + 40));
    await page.screenshot({ path: `${dir}/home-scrolled-${scheme}.png` });
    await page.evaluate(() => scrollTo(0, 0));
  }
  await search(page).fill('it');
  await page.screenshot({ path: `${dir}/home-search.png` });
});