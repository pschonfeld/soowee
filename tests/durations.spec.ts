import { expect, test } from '@playwright/test';

for (const path of ['/en/lasagna/', '/lasagna/']) {
  test(`durations are readable text with no countdown at ${path}`, async ({ page }) => {
    await page.goto(path);
    const title = await page.title();
    const duration = page.locator('.directions .duration').first();
    await expect(duration).toBeVisible();
    expect(await duration.evaluate((el) => el.tagName)).toBe('SPAN');
    await expect(page.locator('[data-timer], [data-timers], .timer-chip')).toHaveCount(0);
    await duration.click();
    await expect(page).toHaveTitle(title);
    await expect(page.locator('[data-toast]')).toHaveText('');
    // Old saved countdowns are ignored after upgrading.
    await page.evaluate(() => {
      const recipe = document.querySelector<HTMLElement>('[data-recipe]')!.dataset.recipe;
      localStorage.setItem(`soowee:timers:${recipe}`, JSON.stringify([
        { end: Date.now() + 60000, remaining: null, name: '1 minute', label: 'Old timer' },
      ]));
    });
    await page.reload();
    await expect(page.locator('[data-timers], .timer-chip')).toHaveCount(0);
    await page.locator('[data-cook-open]').click();
    await expect(page.locator('#cook .duration').first()).toBeVisible();
    await expect(page.locator('#cook .duration button, #cook button.duration')).toHaveCount(0);
  });
}
