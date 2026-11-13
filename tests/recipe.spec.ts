import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const RECIPES = [
  { path: '/lasagna/', title: 'Lasagna', ingredients: 21, steps: 5 },
  { path: '/fish-and-chips/', title: 'Fish & Chips', ingredients: 21, steps: 7 },
  { path: '/tiramisu/', title: 'Tiramisu', ingredients: 8, steps: 4 },
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
    const body = document.querySelector('.hero__body')!;
    const pad = parseFloat(getComputedStyle(body).paddingLeft);
    const text = body.getBoundingClientRect();
    const column = box('.sheet > div:first-child');
    return {
      media, photoCopy, mirror, title, lede, wide: innerWidth >= 768, vw: innerWidth,
      text: { left: text.left + pad, right: text.right - pad }, column,
    };
  });
  // The blurred copy has exactly the photo's box, so `cover` crops both the same way.
  for (const k of ['left', 'top', 'width', 'height'] as const) {
    expect(Math.abs(g.photoCopy[k] - g.media[k])).toBeLessThanOrEqual(1);
  }
  if (g.wide) {
    // Within 2px: the mirror deliberately overlaps the photo by 1px to hide the subpixel seam.
    expect(Math.abs(g.mirror.right - g.media.left)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.mirror.width - g.media.width)).toBeLessThanOrEqual(1);
    // Full-bleed: the photo runs to the right edge of the window.
    expect(Math.abs(g.media.right - g.vw)).toBeLessThanOrEqual(1);
    // The hero text column is exactly the Ingredients column.
    expect(Math.abs(g.text.left - g.column.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.text.right - g.column.right)).toBeLessThanOrEqual(1);
    // The photo is masked out for its first 18%: text must end before the photo shows.
    expect(g.lede.right).toBeLessThanOrEqual(g.media.left + g.media.width * 0.18 + 1);
  } else {
    expect(Math.abs(g.mirror.top - g.media.bottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(g.mirror.height - g.media.height)).toBeLessThanOrEqual(1);
    // The photo is fully transparent 5rem above its bottom edge, where the title starts.
    expect(g.title.top).toBeGreaterThanOrEqual(g.media.bottom - 80 - 1);
  }
});

for (const { path } of RECIPES) {
  test(`reflows without sideways scrolling at 320px with 200% text (${path})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await page.addStyleTag({ content: 'html { font-size: 200% }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Cook', exact: true }).click();
    expect(await page.evaluate(() => document.querySelector('#cook')!.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}

test('Cook, Save and Share are on the first screen of a 320 × 568 phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const { path } of RECIPES) {
    await page.goto(path);
    const bottom = await page.locator('.actions').evaluate((e) => e.getBoundingClientRect().bottom);
    expect(bottom, path).toBeLessThanOrEqual(568);
  }
});

test('hero text matches the Ingredients column and the photo runs to the edge at every width', async ({ page }) => {
  for (const [width, height] of [[768, 1024], [1023, 900], [1024, 900], [1440, 900], [1920, 1080], [2560, 1440], [3440, 1440]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/fish-and-chips/');
    const g = await page.evaluate(() => {
      const body = document.querySelector('.hero__body')!;
      const cs = getComputedStyle(body);
      const b = body.getBoundingClientRect();
      const col = document.querySelector('.sheet > div:first-child')!.getBoundingClientRect();
      const media = document.querySelector('.hero__media')!.getBoundingClientRect();
      const mirror = document.querySelector('.hero__backdrop > .is-mirror')!.getBoundingClientRect();
      const hero = document.querySelector('.hero')!.getBoundingClientRect();
      return {
        textLeft: b.left + parseFloat(cs.paddingLeft), textRight: b.right - parseFloat(cs.paddingRight),
        colLeft: col.left, colRight: col.right, bodyRight: b.right,
        media: { left: media.left, right: media.right, width: media.width, height: media.height },
        mirrorRight: mirror.right, mirrorLeft: mirror.left, vw: innerWidth, vh: innerHeight, heroHeight: hero.height,
      };
    });
    const at = `at ${width}px`;
    expect(Math.abs(g.textLeft - g.colLeft), at).toBeLessThanOrEqual(1);
    expect(Math.abs(g.textRight - g.colRight), at).toBeLessThanOrEqual(1);
    expect(Math.abs(g.media.right - g.vw), at).toBeLessThanOrEqual(1);
    expect(Math.abs(g.mirrorRight - g.media.left), at).toBeLessThanOrEqual(2);
    expect(g.mirrorLeft, at).toBeLessThanOrEqual(0);
    // The whole text column, padding included, ends before the photo starts to show.
    expect(g.bodyRight, at).toBeLessThanOrEqual(g.media.left + g.media.width * 0.18 + 1);
    // Wide windows grow the hero rather than squeezing the photo into a band (capped at 70% of the height).
    expect(g.heroHeight, at).toBeLessThanOrEqual(Math.max(672, g.vh * 0.7) + 1);
    if (width >= 1920 && width / height < 2) expect(g.media.width / g.media.height, at).toBeLessThanOrEqual(1.65);
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
    await expect(page.locator('.hero [data-yield]')).toHaveText('12–15 servings');
    // The approximate weight of a counted ingredient scales with it.
    await expect(page.locator('.ingredient', { hasText: 'onion' })).toContainText('onion (about 225 g)');
    // One ingredient split across steps: 80 g Pecorino in the list, 50 g for the layers and 30 g for the top.
    await expect(page.locator('.ingredient', { hasText: 'Pecorino Romano' }).locator('[data-qty]')).toHaveText('120');
    await expect(page.locator('.step p', { hasText: 'Grate' })).toContainText('Grate 120\u00a0g Pecorino Romano and set 45\u00a0g aside');
    await expect(page.locator('.step p', { hasText: 'Remove the foil' })).toContainText('the reserved 45\u00a0g Pecorino Romano');

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
    // 4 hr 30 min total, minus the hands-off simmering, baking and resting (3 hr 5 min of {wait:} timers).
    await expect(page.locator('.meta')).toContainText(/Active\s*1 hr 25 min/);
    await expect(page.locator('.directions .section-sub')).toContainText('1 hr 25 min active, 3 hr 5 min hands-off');
    await page.goto('/fish-and-chips/');
    await expect(page.locator('.meta')).toContainText(/Active\s*55 min/);
  });

  test('chilling is shown on its own and kept out of the total', async ({ page }) => {
    await expect(page.locator('.meta')).not.toContainText('Chill');
    await page.goto('/tiramisu/');
    const meta = page.locator('.meta');
    await expect(meta).toContainText(/Total time\s*30 min/);
    await expect(meta).toContainText(/Chill\s*\+8 hr/);
    await expect(meta).not.toContainText('Active');
    await expect(page.locator('.directions .section-sub')).toHaveText(/Total Time: 30 min\s*, plus 8 hr chilling/);
    // Plain text in the step, not a timer button.
    const chill = page.locator('.step', { hasText: 'Chill and serve' });
    await expect(chill).toContainText('at least 8 hours');
    await expect(chill.locator('.timer')).toHaveCount(0);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld.totalTime).toBe('PT8H30M');
  });

  test('a weight range on a counted ingredient scales at both ends', async ({ page }) => {
    await page.goto('/tiramisu/');
    const savoiardi = page.locator('.ingredient', { hasText: 'Savoiardi' });
    await expect(savoiardi).toContainText('36Savoiardi biscuits (about 300–360 g), ladyfingers');
    await page.getByRole('button', { name: 'Scale up' }).click();
    await expect(savoiardi).toContainText('54Savoiardi biscuits (about 450–540 g)');
    // The cook-mode ingredient panel scales the same spans.
    await expect(page.locator('.cook__ingredient', { hasText: 'Savoiardi' })).toContainText('(about 450–540 g)');
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
    expect(ld.recipeIngredient).toContain('36 Savoiardi biscuits (about 300–360 g), ladyfingers, half for each layer');
  });

  test('preheating is the first, highlighted line of its step', async ({ page }) => {
    const step = page.locator('.step', { hasText: 'Make the béchamel' });
    await expect(step.locator('p').first()).toHaveClass(/heat/);
    await expect(step.locator('.heat')).toHaveText(
      'Preheat the oven to 180 °C, conventional top and bottom heat, with a rack in the lower-middle position. Allow about 20 minutes.',
    );
    // [data-step="3"] also matches the step label and tips now that they carry it too, for step-level dimming.
    await expect(page.locator('#panel-directions .cook__line[data-step="3"]').first()).toContainText(
      'Preheat the oven',
    );
  });

  test('ingredient names lead, qualifiers follow', async ({ page }) => {
    const names = await page.locator('.ingredient > span:nth-of-type(2)').allInnerTexts();
    expect(names).toContain('onion (about 150 g), medium, diced into small cubes');
    expect(names).toContain('g butter, unsalted');
    expect(names.some((n) => /^(medium|dry|whole|unsalted|fresh|shredded|grated)\b/i.test(n.replace(/^(g|ml|L|tbsp|tsp) /, '')))).toBe(false);
  });

  test('timer wording is generated and consistent', async ({ page }) => {
    const labels = await page.locator('.step .timer').allInnerTexts();
    expect(labels.map((l) => l.trim())).toEqual([
      '30 minutes',
      '8–10 minutes',
      '8–10 minutes',
      '1 hour',
      '1 hour',
      '1–2 minutes',
      '3–5 minutes',
      '30 minutes',
      '20–25 minutes',
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

  test('cook mode: opens, moves focus, steps, switches tabs, closes with Escape', async ({ page, browserName }) => {
    const open = page.getByRole('button', { name: 'Cook', exact: true });
    await open.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#cook-title')).toBeFocused();
    if (browserName === 'chromium') {
      // Safari only tabs to buttons with "Full Keyboard Access" turned on.
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Close cook mode' })).toBeFocused();
    }
    await expect(page.locator('main')).toHaveJSProperty('inert', true);

    const lines = page.locator('[data-line]');
    const stepLabels = page.locator('[data-step-label]');
    // The whole step is highlighted together: step 1 has two lines, both active, not just the first.
    await expect(lines.nth(0)).toHaveClass(/is-active/);
    await expect(lines.nth(1)).toHaveClass(/is-active/);
    await expect(stepLabels.nth(0)).toHaveClass(/is-active/);
    await page.getByRole('button', { name: 'Next step' }).click();
    // Step 2 starts at the third line; all of step 1 (both lines and its label) dims together.
    await expect(lines.nth(2)).toHaveClass(/is-active/);
    await expect(lines.nth(2)).toBeInViewport();
    await expect(lines.nth(0)).not.toHaveClass(/is-active/);
    await expect(lines.nth(1)).not.toHaveClass(/is-active/);
    await expect(stepLabels.nth(0)).not.toHaveClass(/is-active/);
    await expect(stepLabels.nth(1)).toHaveClass(/is-active/);

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
    await page.getByRole('button', { name: 'Start timer: 8–10 minutes' }).first().click();

    await page.getByRole('button', { name: 'Start timer: 1 hour' }).first().click();
    await expect(page.locator('.timer-chip')).toHaveCount(2);
    await page.getByRole('button', { name: 'Dismiss timer: Step 2, 1 hour' }).click();

    const chip = page.locator('.timer-chip');
    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText('8–10 minutes');
    // A range rings at its lower bound (8 of "8–10 minutes"): time to start checking.
    await page.clock.fastForward('02:00');
    await expect(chip.locator('time')).toHaveText(/^0[56]:\d\d$/);
    await page.clock.fastForward('06:01');
    await expect(chip.locator('time')).toHaveText('Done');
    await expect(page.locator('[data-toast]')).toHaveText('Timer finished: Step 2, 8–10 minutes');

    await page.getByRole('button', { name: 'Dismiss timer: Step 2, 8–10 minutes' }).click();
    await expect(chip).toHaveCount(0);
  });

  test('a timer can be paused and resumed, and the tab title counts it down', async ({ page }) => {
    await page.clock.install();
    await page.goto('/lasagna/');
    await page.getByRole('button', { name: 'Start timer: 1 hour' }).first().click();
    const chip = page.locator('.timer-chip');
    await expect(chip.locator('time')).toHaveText('1:00:00');
    await expect(page).toHaveTitle(/^⏱ 1:00:00 · /);

    await page.getByRole('button', { name: 'Pause timer: Step 2, 1 hour' }).click();
    await page.clock.fastForward('10:00');
    await expect(chip.locator('time')).toHaveText('1:00:00'); // frozen while paused
    await expect(page).not.toHaveTitle(/^⏱/); // no countdown in the tab title while nothing is running

    await page.getByRole('button', { name: 'Resume timer: Step 2, 1 hour' }).click();
    await page.clock.fastForward('10:00');
    await expect(chip.locator('time')).toHaveText('50:00');
    await expect(page).toHaveTitle(/^⏱ 50:00 · /);
  });

  test('a finished timer repeats its alert until tapped, without being dismissed', async ({ page }) => {
    await page.clock.install();
    await page.goto('/lasagna/');
    await page.getByRole('button', { name: 'Start timer: 1–2 minutes' }).first().click();
    await page.clock.fastForward('02:01');

    const chip = page.locator('.timer-chip');
    await expect(chip).toHaveClass(/is-done/);
    await expect(chip.locator('time')).toHaveText('Done');

    await chip.locator('.timer-chip__label').click(); // tap the chip body, not a button
    await expect(chip).toHaveCount(1); // silenced, not dismissed
    await expect(chip.locator('time')).toHaveText('Done');

    await page.getByRole('button', { name: /Dismiss timer/ }).click();
    await expect(chip).toHaveCount(0);
  });

  test('a running timer survives a reload; an entry whose time already passed restores as overdue', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/lasagna/');
    await page.getByRole('button', { name: 'Start timer: 1 hour' }).first().click();
    await page.clock.fastForward('01:00');
    await page.reload();
    const stillRunning = page.locator('.timer-chip');
    await expect(stillRunning).toHaveCount(1);
    await expect(stillRunning.locator('time')).toHaveText('59:00');

    // Simulate a timer whose end time passed while the tab was closed, not ticking live:
    // reload must restore it already finished, not play its live chime.
    await page.evaluate(() => {
      const recipe = document.querySelector<HTMLElement>('[data-recipe]')!.dataset.recipe;
      const end = Date.now() - 9 * 60 * 1000;
      localStorage.setItem(
        `soowee:timers:${recipe}`,
        JSON.stringify([{ end, remaining: null, name: '1 hour', label: 'Step 2, 1 hour' }]),
      );
    });
    await page.reload();
    const overdue = page.locator('.timer-chip', { hasText: 'Done' });
    await expect(overdue).toHaveCount(1);
    await expect(overdue.locator('time')).toHaveText('Done 9m ago');
  });

  test('the timer capsule sits below the cook-mode header, never over the close button', async ({ page }) => {
    await page.goto('/lasagna/');
    await page.getByRole('button', { name: 'Cook', exact: true }).click();
    const dialog = page.getByRole('dialog');
    // `main` is inert while cook mode is open, but Playwright's role query still finds its (unclickable)
    // buttons, so scope to the dialog rather than relying on DOM order via .first().
    await dialog.getByRole('button', { name: 'Start timer: 1 hour' }).first().click();
    const close = page.getByRole('button', { name: 'Close cook mode' });
    const [closeBox, chipBox] = await Promise.all([close.boundingBox(), page.locator('.timer-chip').boundingBox()]);
    expect(closeBox).toBeTruthy();
    expect(chipBox).toBeTruthy();
    expect(chipBox!.y).toBeGreaterThanOrEqual(closeBox!.y + closeBox!.height);
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
