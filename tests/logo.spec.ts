import { expect, test, type Locator } from '@playwright/test';

const header = '.home__logo';
const footer = '.footer__logo';
const fill = (logo: Locator, part: string) => logo.locator(part).first().evaluate((el) => getComputedStyle(el).fill);

test('the home heading is the logo, named soowee; the footer onion has no face', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByRole('heading', { level: 1, name: 'soowee' })).toBeVisible();
  await expect(page.locator(header).locator('.logo__eye')).toHaveCount(2);
  await expect(page.locator(footer)).toHaveAttribute('aria-label', 'soowee');
  await expect(page.locator(footer).locator('.logo__eye')).toHaveCount(0);
});

test('the logo follows the theme: the system setting and the appearance switch', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/en/');
  const logo = page.locator(header);
  expect(await fill(logo, '.logo__bulb')).toBe('rgb(28, 28, 30)');
  expect(await fill(logo, '.logo__eye')).toBe('rgb(242, 242, 247)'); // the page, seen through the bulb

  await page.getByRole('radio', { name: 'Dark' }).check({ force: true });
  expect(await fill(logo, '.logo__bulb')).toBe('rgb(255, 255, 255)');
  expect(await fill(logo, '.logo__eye')).toBe('rgb(0, 0, 0)');

  await page.getByRole('radio', { name: 'Auto' }).check({ force: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await fill(logo, '.logo__bulb')).toBe('rgb(255, 255, 255)');
});

test('with reduced motion the logo stands still (an endless blink would flicker)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/');
  const logo = page.locator(header);
  await logo.hover(); // hover would hop and lean
  const style = (part: string) => logo.locator(part).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.animationName, s.rotate, s.translate];
  });
  expect(await style('.logo__eye')).toEqual(['none', 'none', 'none']);
  expect(await style('.logo__body')).toEqual(['none', 'none', 'none']);
  expect(await style('.logo__eyes')).toEqual(['none', 'none', 'none']);
});

test('the eyes follow the mouse', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'no pointer to follow on touch screens');
  await page.goto('/en/');
  const logo = page.locator(header);
  const box = (await logo.locator('.logo__bulb').boundingBox())!;
  const look = () => logo.evaluate((el: SVGElement) => [el.style.getPropertyValue('--eye-x'), el.style.getPropertyValue('--eye-y')].map(Number));

  await page.mouse.move(box.x + 600, box.y + box.height / 2, { steps: 4 });
  await expect.poll(async () => (await look())[0]).toBeGreaterThan(2); // looks right
  await page.mouse.move(box.x + box.width / 2, box.y + 500, { steps: 4 });
  await expect.poll(async () => (await look())[1]).toBeGreaterThan(1.5); // looks down
});
