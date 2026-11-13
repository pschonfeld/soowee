import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const RECIPES = [
  { path: '/lasagna/', title: 'Lasagna', ingredients: 21, steps: 5 },
  { path: '/fish-and-chips/', title: 'Fish & Chips', ingredients: 12, steps: 4 },
];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
}

for (const recipe of RECIPES) {
  test.describe(recipe.title, () => {
    test('renders the whole recipe from its content file', async ({ page }) => {
      await page.goto(recipe.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(recipe.title);
      await expect(page.locator('.ingredient')).toHaveCount(recipe.ingredients);
      await expect(page.locator('.step')).toHaveCount(recipe.steps);
      await expect(page.locator('.hero__media img')).toHaveJSProperty('complete', true);
      expect(await page.locator('.hero__media img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    });

    test('has no horizontal overflow', async ({ page }) => {
      await page.goto(recipe.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    for (const scheme of ['light', 'dark'] as const) {
      test(`passes WCAG 2.2 AA checks (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(recipe.path);
        await expectNoA11yViolations(page);
      });
    }

    test('screenshots for visual review', async ({ page }, testInfo) => {
      const slug = recipe.title.toLowerCase().replace(/[^a-z]+/g, '-');
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.goto(recipe.path);
        // Wait for the hero photo to decode, or the screenshot shows only the blurred backdrop.
        await page.locator('.hero__media img').evaluate((img: HTMLImageElement) => img.decode());
        await page.screenshot({ path: `screenshots/${testInfo.project.name}/${slug}-${scheme}.png`, fullPage: true });
      }
      await page.getByRole('button', { name: 'Cook', exact: true }).click();
      await page.screenshot({ path: `screenshots/${testInfo.project.name}/${slug}-cook.png` });
    });
  });
}

test('hero backdrop is derived from each recipe photo', async ({ page }) => {
  const read = () =>
    page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return {
        backdrop: style.getPropertyValue('--backdrop'),
        edge: style.getPropertyValue('--backdrop-edge'),
        scrim: Number(style.getPropertyValue('--scrim')),
      };
    });
  await page.goto('/lasagna/');
  const lasagna = await read();
  await page.goto('/fish-and-chips/');
  const fish = await read();
  for (const b of [lasagna, fish]) {
    expect(b.backdrop).toMatch(/^url\(data:image\/webp;base64,/);
    expect(b.scrim).toBeGreaterThan(0);
    expect(b.scrim).toBeLessThanOrEqual(0.9);
  }
  expect(lasagna.backdrop).not.toBe(fish.backdrop);
  expect(lasagna.edge).not.toBe(fish.edge);
  // The lasagna photo has bright cheese and bread, so it needs a substantial scrim for white text.
  expect(lasagna.scrim).toBeGreaterThanOrEqual(0.5);
  await expect(page.getByRole('link', { name: 'soowee home' })).toHaveCount(0);
});

test('mirrored backdrop meets the photo at its edge and text stays off the sharp photo', async ({ page }) => {
  await page.goto('/lasagna/');
  const g = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const media = box('.hero__media');
    const photoCopy = box('.hero__backdrop > div:not(.is-mirror)');
    const mirror = box('.hero__backdrop > .is-mirror');
    const title = box('.hero h1');
    const lede = box('.lede');
    return { media, photoCopy, mirror, title, lede, wide: innerWidth >= 768 };
  });
  // The blurred copy has exactly the photo's box, so `cover` crops both the same way.
  for (const k of ['left', 'top', 'width', 'height'] as const) {
    expect(Math.abs(g.photoCopy[k] - g.media[k])).toBeLessThanOrEqual(1);
  }
  if (g.wide) {
    // Within 2px: the mirror deliberately overlaps the photo by 1px to hide the subpixel seam.
    expect(Math.abs(g.mirror.right - g.media.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.mirror.width - g.media.width)).toBeLessThanOrEqual(1);
    // The photo is masked out for its first 18%: text must end before the photo shows.
    expect(g.lede.right).toBeLessThanOrEqual(g.media.left + g.media.width * 0.18 + 1);
  } else {
    expect(Math.abs(g.mirror.top - g.media.bottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.mirror.height - g.media.height)).toBeLessThanOrEqual(1);
    // The photo is fully transparent 5rem above its bottom edge, where the title starts.
    expect(g.title.top).toBeGreaterThanOrEqual(g.media.bottom - 80 - 1);
  }
});

test('home page leads to the featured recipe', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/lasagna\/$/);
});

test('appearance switch overrides the system setting and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/lasagna/');
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await background()).toBe('rgb(242, 242, 247)');

  await page.getByRole('radio', { name: 'Dark' }).check({ force: true });
  expect(await background()).toBe('rgb(0, 0, 0)');
  await page.reload();
  expect(await background()).toBe('rgb(0, 0, 0)');
  await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();

  await page.getByRole('radio', { name: 'Auto' }).check({ force: true });
  expect(await background()).toBe('rgb(242, 242, 247)');
});

test.describe('interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lasagna/');
  });

  test('scaling updates quantities and yield, and stops at its limits', async ({ page }) => {
    const oil = page.locator('.ingredient', { hasText: 'extra virgin olive oil' }).first().locator('[data-qty]');
    const beef = page.locator('.ingredient', { hasText: 'ground beef' }).locator('[data-qty]');
    await expect(oil).toHaveText('2');

    await page.getByRole('button', { name: 'Scale up' }).click();
    await expect(page.locator('[data-scale-output]')).toHaveText('1½×');
    await expect(oil).toHaveText('3');
    await expect(beef).toHaveText('750');
    // Amounts mentioned inside the steps scale too, each from its own base value.
    await expect(page.locator('.step p', { hasText: 'While the ragù finishes' })).toContainText('melt 60\u00a0g butter');
    await expect(page.locator('.step p', { hasText: 'Pour in' })).toContainText('Pour in 360\u00a0ml red wine');
    await expect(page.locator('[data-line]', { hasText: 'While the ragù finishes' })).toContainText('melt 60\u00a0g butter');
    await expect(page.locator('.hero [data-yield]')).toHaveText('9 servings');
    // One ingredient split across steps: 80 g Pecorino in the list, 50 g for the layers and 30 g for the top.
    await expect(page.locator('.ingredient', { hasText: 'Pecorino Romano' }).locator('[data-qty]')).toHaveText('120');
    await expect(page.locator('.step p', { hasText: 'Grate' })).toContainText('Grate 120\u00a0g Pecorino Romano and set 45\u00a0g aside');
    await expect(page.locator('.step p', { hasText: 'reserved' })).toContainText('the reserved 45\u00a0g Pecorino Romano');

    await page.getByRole('button', { name: 'Scale down' }).click();
    await page.getByRole('button', { name: 'Scale down' }).click();
    await expect(page.locator('[data-scale-output]')).toHaveText('½×');
    await expect(oil).toHaveText('1');
    await expect(beef).toHaveText('250');
    await expect(page.getByRole('button', { name: 'Scale down' })).toBeDisabled();

  });

  test('ingredients can be checked off with pointer and keyboard', async ({ page }) => {
    const first = page.locator('.ingredient').first();
    await first.click();
    await expect(first.locator('input')).toBeChecked();
    await first.locator('input').focus();
    await page.keyboard.press('Space');
    await expect(first.locator('input')).not.toBeChecked();
  });

  test('shows how much of the total time is active work', async ({ page }) => {
    // 4 hr total, minus the hands-off simmering, baking and resting (1 h + 1 h + 20 min + 15 min + 15 min).
    await expect(page.locator('.meta')).toContainText(/Active\s*1 hr 10 min/);
    await expect(page.locator('.directions .section-sub')).toContainText('1 hr 10 min active, 2 hr 50 min hands-off');
    await page.goto('/fish-and-chips/');
    await expect(page.locator('.meta')).not.toContainText('Active');
  });

  test('preheating is the first, highlighted line of its step', async ({ page }) => {
    const step = page.locator('.step', { hasText: 'Assemble the lasagna' });
    await expect(step.locator('p').first()).toHaveClass(/heat/);
    await expect(step.locator('.heat')).toHaveText(
      'Preheat the oven to 180 °C, conventional top and bottom heat, with a rack in the lower-middle position.',
    );
    await expect(page.locator('#panel-directions [data-step="4"]').first()).toContainText('Preheat the oven');
  });

  test('ingredient names lead, qualifiers follow', async ({ page }) => {
    const names = await page.locator('.ingredient > span:nth-of-type(2)').allInnerTexts();
    expect(names).toContain('onion, medium, diced into small cubes');
    expect(names).toContain('g butter, unsalted');
    expect(names.some((n) => /^(medium|dry|whole|unsalted|fresh|shredded|grated)\b/i.test(n.replace(/^(g|ml|L|tbsp|tsp) /, '')))).toBe(false);
  });

  test('timer wording is generated and consistent', async ({ page }) => {
    const labels = await page.locator('.step .timer').allInnerTexts();
    expect(labels.map((l) => l.trim())).toEqual([
      '30 minutes',
      '5–10 minutes',
      '2–3 minutes',
      '1 hour',
      '1 hour',
      '1–2 minutes',
      '20 minutes',
      '15–20 minutes',
      '15–20 minutes',
    ]);
  });

  test('scale and checked ingredients survive a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Scale up' }).click();
    await page.locator('.ingredient').nth(4).click();
    await page.reload();
    await expect(page.locator('[data-scale-output]')).toHaveText('1½×');
    await expect(page.locator('.ingredient', { hasText: 'ground beef' }).locator('[data-qty]')).toHaveText('750');
    await expect(page.locator('.ingredient').nth(4).locator('input')).toBeChecked();
    await expect(page.locator('.ingredient').nth(3).locator('input')).not.toBeChecked();
  });

  test('save persists across reloads', async ({ page }) => {
    const save = page.locator('[data-save]');
    await expect(save).toHaveText('Save');
    await save.click();
    await expect(save).toHaveText('Saved');
    await page.reload();
    await expect(page.locator('[data-save]')).toHaveText('Saved');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-save]')).toHaveText('Save');
  });

  test('cook mode: opens, moves focus, steps, switches tabs, closes with Escape', async ({ page }) => {
    const open = page.getByRole('button', { name: 'Cook', exact: true });
    await open.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close cook mode' })).toBeFocused();
    await expect(page.locator('main')).toHaveJSProperty('inert', true);

    const lines = page.locator('[data-line]');
    await expect(lines.nth(0)).toHaveClass(/is-active/);
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(lines.nth(1)).toHaveClass(/is-active/);
    await expect(lines.nth(1)).toBeInViewport();
    await expect(lines.nth(0)).not.toHaveClass(/is-active/);

    await page.getByRole('tab', { name: 'Ingredients' }).click();
    await expect(page.locator('#panel-ingredients')).toBeVisible();
    await expect(page.locator('#panel-directions')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Next step' })).toBeHidden();
    await expectNoA11yViolations(page);

    // Safari leaves focus on <body> after a mouse click; Escape must still close cook mode.
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await expect(page.locator('main')).toHaveJSProperty('inert', false);
  });

  test('cook mode passes WCAG checks on the directions view', async ({ page }) => {
    await page.getByRole('button', { name: 'Cook', exact: true }).click();
    await expectNoA11yViolations(page);
  });

  test('timers count down, finish and can be dismissed', async ({ page }) => {
    await page.clock.install();
    await page.goto('/lasagna/');
    await page.getByRole('button', { name: 'Start timer: 5–10 minutes' }).first().click();

    await page.getByRole('button', { name: 'Start timer: 1 hour' }).first().click();
    await expect(page.locator('.timer-chip')).toHaveCount(2);
    await page.getByRole('button', { name: 'Dismiss timer: Step 2, 1 hour' }).click();

    const chip = page.locator('.timer-chip');
    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText('5–10 minutes');
    // A range rings at its lower bound (5 of "5–10 minutes"): time to start checking.
    await page.clock.fastForward('02:00');
    await expect(chip.locator('time')).toHaveText(/^0[23]:\d\d$/);
    await page.clock.fastForward('03:01');
    await expect(chip.locator('time')).toHaveText('Done');
    await expect(page.locator('[data-toast]')).toHaveText('Timer finished: Step 2, 5–10 minutes');

    await page.getByRole('button', { name: 'Dismiss timer: Step 2, 5–10 minutes' }).click();
    await expect(chip).toHaveCount(0);
  });

  test('the whole page is reachable by keyboard in a sensible order', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari only tabs to buttons/links with "Full Keyboard Access" enabled');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to recipe' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('a.story')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Cook', exact: true })).toBeFocused();
  });
});
