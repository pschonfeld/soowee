import { expect, test, type Page } from '@playwright/test';

/*
 * The button system (Buttons in src/styles/global.css), checked on every control the pages can show:
 * - every <button> and every link styled as one (a.btn) is a .btn with one shape and one surface, or a
 *   .segmented__item; the only exception is .timer, the inline timer in step text;
 * - every visible control's hit area, including the ::after that grows small ones, is at least 44 × 44;
 * - and it is really this control that a tap there reaches: no neighbour's hit area or overlay covers it.
 *   Controls under an inert ancestor (the page behind cook mode) are left out of that last check.
 */

const SHAPES = ['btn--round', 'btn--capsule'];
const SURFACES = ['btn--glass', 'btn--scrim', 'btn--fill', 'btn--plain'];
const MIN_HIT = 44;

type Control = { name: string; classes: string[]; visible: boolean; hitW: number; hitH: number; stolen: string[] };

const controls = (page: Page): Promise<Control[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a.btn, .segmented__item')]
      .filter((el) => !el.matches('.timer'))
      .map((el) => {
        const visible = el.checkVisibility({ visibilityProperty: true });
        if (visible && !el.closest('[inert]')) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect();
        const after = getComputedStyle(el, '::after');
        const grows = after.content !== 'none' && after.position === 'absolute';
        // A negative inset on ::after extends the hit area beyond the box.
        const out = (v: string) => (grows ? Math.max(0, -(parseFloat(v) || 0)) : 0);
        const [l, t] = [r.left - out(after.left), r.top - out(after.top)];
        const [w, h] = [r.width + out(after.left) + out(after.right), r.height + out(after.top) + out(after.bottom)];
        // Probe the centre and 2px inside each edge of the hit area: whatever is hit must be this control.
        const stolen =
          visible && !el.closest('[inert]')
            ? [
                [l + w / 2, t + h / 2],
                [l + 2, t + h / 2],
                [l + w - 2, t + h / 2],
                [l + w / 2, t + 2],
                [l + w / 2, t + h - 2],
              ]
                .map(([x, y]) => document.elementFromPoint(x, y))
                .filter((hit) => !hit || !(el === hit || el.contains(hit) || (el.closest('label')?.contains(hit) ?? false)))
                .map((hit) => (hit ? `${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')}` : 'nothing'))
            : [];
        return {
          name: el.getAttribute('aria-label') || el.textContent!.trim() || el.className,
          classes: [...el.classList],
          visible: visible && r.width > 0 && r.height > 0,
          hitW: w,
          hitH: h,
          stolen,
        };
      }),
  );

function check(all: Control[]) {
  expect(all.length).toBeGreaterThan(0);
  for (const c of all) {
    if (c.classes.includes('segmented__item')) continue;
    expect(c.classes, `${c.name}: .btn`).toContain('btn');
    expect(c.classes.filter((k) => SHAPES.includes(k)), `${c.name}: one shape`).toHaveLength(1);
    expect(c.classes.filter((k) => SURFACES.includes(k)), `${c.name}: one surface`).toHaveLength(1);
  }
  for (const c of all.filter((c) => c.visible)) {
    expect(c.hitW, `${c.name}: hit width`).toBeGreaterThanOrEqual(MIN_HIT - 0.5);
    expect(c.hitH, `${c.name}: hit height`).toBeGreaterThanOrEqual(MIN_HIT - 0.5);
    expect(c.stolen, `${c.name}: taps inside its hit area reach something else`).toEqual([]);
  }
}

test('home: every control follows the button system', async ({ page }) => {
  await page.goto('/en/');
  check(await controls(page));
  // The search clear and the "no results" clear only exist while searching.
  await page.getByRole('searchbox', { name: 'Search recipes' }).fill('zzzz');
  const searching = await controls(page);
  expect(searching.filter((c) => c.visible).map((c) => c.name)).toEqual(
    expect.arrayContaining(['Clear text', 'Clear search']),
  );
  check(searching);
});

test('recipe page, cook mode and timers: every control follows the button system', async ({ page }) => {
  await page.goto('/en/lasagna/');
  check(await controls(page));

  // Timer chip: pause and dismiss, then the Undo state.
  await page.getByRole('button', { name: 'Start timer: 1 hour' }).first().click();
  await page.getByRole('button', { name: 'Start timer: 12–15 minutes' }).first().click();
  check(await controls(page));
  // Once the toast clears, the chips move up to the top of the screen.
  await expect(page.locator('[data-toast]')).toHaveText('', { timeout: 5000 });
  check(await controls(page));
  await page.getByRole('button', { name: 'Dismiss timer: Simmer the ragù, 1 hour' }).click();
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeVisible();
  check(await controls(page));

  await page.getByRole('button', { name: 'Cook', exact: true }).click();
  check(await controls(page));
});
