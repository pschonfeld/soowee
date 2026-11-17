import { SCALES, formatQty, formatScale, formatYield } from '../lib/format';
import { localeOf, pluralForm, type ClientStrings, type Forms } from '../lib/i18n';

const $ = <T extends HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];

const article = $('article[data-recipe]')!;
const locale = localeOf(document.documentElement.lang);
/** This page's strings (Recipe.astro writes them). */
const t: ClientStrings = JSON.parse($('#strings')!.textContent!);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ── Toast (also the polite live region) ── */
const toast = $('[data-toast]')!;
let toastTimer = 0;
function announce(message: string) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.textContent = ''), 2600);
}

/* ── Scale recipe ── */
const scaleOutput = $('[data-scale-output]')!;
const scaleButtons = $$<HTMLButtonElement>('[data-scale]');
let scaleIndex = SCALES.indexOf(1);

function applyScale() {
  const factor = SCALES[scaleIndex];
  for (const el of $$('[data-qty]')) {
    el.textContent = formatQty(Number(el.dataset.qty) * factor, el.dataset.unit, locale);
  }
  // Nouns that agree with a scaled number: "2 lemons", "6 lžic" (lib/inline.ts, nounHtml).
  for (const el of $$('[data-forms]')) {
    el.textContent = pluralForm(locale, Number(el.dataset.count) * factor, JSON.parse(el.dataset.forms!) as Forms);
  }
  const { yieldServings, yieldForms, pieceQty, pieceForms } = article.dataset;
  const text = formatYield(Number(yieldServings), JSON.parse(yieldForms!) as Forms, locale, factor);
  for (const el of $$('[data-yield]')) el.textContent = text;
  if (pieceQty && pieceForms) {
    const pieces = formatYield(Number(pieceQty), JSON.parse(pieceForms) as Forms, locale, factor);
    for (const el of $$('[data-yield-pieces]')) el.textContent = pieces;
  }
  scaleOutput.textContent = formatScale(factor);
  scaleButtons[0].disabled = scaleIndex === 0;
  scaleButtons[1].disabled = scaleIndex === SCALES.length - 1;
}

for (const button of scaleButtons) {
  button.addEventListener('click', () => {
    scaleIndex = Math.min(SCALES.length - 1, Math.max(0, scaleIndex + Number(button.dataset.scale)));
    applyScale();
    // A button that just became disabled loses focus; hand it to its neighbour.
    if (button.disabled) scaleButtons.find((b) => !b.disabled)?.focus();
    saveProgress();
  });
}

/* ── Progress survives a reload or a locked phone, for this visit only ── */
const PROGRESS_KEY = `soowee:progress:${article.dataset.recipe}`;
const ingredientChecks = $$<HTMLInputElement>('.ingredient input');

function saveProgress() {
  try {
    const checked = ingredientChecks.flatMap((input, i) => (input.checked ? [i] : []));
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ scale: scaleIndex, checked }));
  } catch {
    /* Private mode: progress simply isn't kept. */
  }
}

try {
  const saved = JSON.parse(sessionStorage.getItem(PROGRESS_KEY) ?? 'null');
  if (saved && Number.isInteger(saved.scale) && SCALES[saved.scale] !== undefined) {
    scaleIndex = saved.scale;
    if (SCALES[scaleIndex] !== 1) applyScale();
  }
  if (Array.isArray(saved?.checked)) {
    ingredientChecks.forEach((input, i) => (input.checked = saved.checked.includes(i)));
  }
} catch {
  /* Nothing stored, or storage is unavailable. */
}

for (const input of ingredientChecks) input.addEventListener('change', saveProgress);

/* ── Share ── */
$('[data-share]')!.addEventListener('click', async () => {
  const data = { title: document.title, url: location.href };
  try {
    if (navigator.share) return await navigator.share(data);
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') return; // the user closed the share sheet
  }
  // No share sheet (most desktops) or it was refused: copy the link instead.
  try {
    await navigator.clipboard.writeText(data.url);
    announce(t.linkCopied);
  } catch {
    announce(t.sharingUnavailable);
  }
});

/* ── Cook mode ── */
const cook = $<HTMLDialogElement>('#cook')!;
const cookOpen = $('[data-cook-open]')!;
const tabs = $$<HTMLButtonElement>('[role="tab"]', cook);
const directions = $('#panel-directions')!;
/** Where cook mode stops, in order: each section's `heat` line, then each step with its tips. */
const steps = $$<HTMLElement>('[data-step]', cook);
const context = $('[data-cook-context]', cook)!;
const contextTitle = $('[data-context-title]', context)!;
const contextCount = $('[data-context-count]', context)!;
const background = [$('main')!, $('.footer')!, $('.skip')!];
/** Distance from the top of the panel to the active step; mirrors scroll-margin-top of .cook__step in CSS. */
const READING_OFFSET = 24;
let activeStepIndex = 0;
let followScrollAfter = 0;
let wakeLock: WakeLockSentinel | null = null;
let scrollFrame = 0;

async function keepAwake() {
  try {
    const lock = (await navigator.wakeLock?.request('screen')) ?? null;
    if (cook.open) wakeLock = lock;
    else void lock?.release(); // closed while the request was pending
  } catch {
    wakeLock = null; // Unsupported or denied: cook mode still works, the screen may dim.
  }
}

/**
 * Moves cook mode to one step: a screenful that belongs together, as the reference highlights one part of a step at
 * a time. The section it belongs to is shown above the text.
 */
function setActive(index: number, scroll = true) {
  if (!steps.length) return;
  activeStepIndex = Math.min(steps.length - 1, Math.max(0, index));
  const active = steps[activeStepIndex];
  for (const step of steps) {
    const current = step === active;
    step.classList.toggle('is-active', current);
    if (current) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  }
  const section = active.closest<HTMLElement>('[data-section]')!;
  contextTitle.textContent = section.dataset.section!;
  contextCount.textContent = section.dataset.count!;
  if (scroll) {
    followScrollAfter = performance.now() + 700; // don't let our own smooth scroll re-pick the step
    active.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
}

function selectTab(tab: HTMLButtonElement) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`)!.hidden = !selected;
  }
  context.hidden = directions.hidden;
}

/** The browser bar colour: the darkened backdrop edge while cooking (--cook-edge in recipe.css), the hero's otherwise. */
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const pageThemeColor = themeColor?.content;

/** color-mix() computes to `color(srgb 0–1 …)` (or `rgb(0–255, …)`), which theme-color may not accept; hex always is. */
function toHex(color: string): string {
  const unit = color.startsWith('color(srgb') ? 255 : 1;
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (channels?.length !== 3) return color;
  return `#${channels.map((c) => Math.round(c * unit).toString(16).padStart(2, '0')).join('')}`;
}

/** Where the page was scrolled to: cook mode shrinks the body to one screen, which would reset it. */
let pageScroll = 0;

function openCook() {
  pageScroll = window.scrollY;
  cook.show();
  document.documentElement.classList.add('is-cooking');
  if (themeColor) themeColor.content = toHex(getComputedStyle(document.body).backgroundColor);
  for (const el of background) el.inert = true;
  selectTab(tabs[1]);
  setActive(activeStepIndex, false);
  steps[activeStepIndex]?.scrollIntoView({ block: 'start', behavior: 'auto' });
  // Focus the title, not the Close button: Safari would draw a focus ring after a tap or click.
  // Tab from here reaches Close first, as before.
  $('#cook-title', cook)!.focus();
  void keepAwake();
}

function closeCook() {
  cook.close();
  document.documentElement.classList.remove('is-cooking');
  window.scrollTo({ top: pageScroll, behavior: 'instant' });
  if (themeColor && pageThemeColor) themeColor.content = pageThemeColor;
  for (const el of background) el.inert = false;
  void wakeLock?.release();
  wakeLock = null;
  cookOpen.focus();
}

cookOpen.addEventListener('click', openCook);
$('[data-cook-close]', cook)!.addEventListener('click', closeCook);

// On the document, not the dialog: Safari does not focus buttons on click, so focus can sit on <body>.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cook.open) {
    event.preventDefault();
    closeCook();
    return;
  }
  if (cook.open) cookKeys(event);
});

/** One arrow press in the ingredients list: about a row. */
const LINE_STEP = 48;

/**
 * Keyboard reading in cook mode, wherever focus is (it starts on the title, outside the scrolling panel, so the
 * browser's own arrow scrolling would do nothing). ←/→ switch to Ingredients/Directions, as the tabs sit on screen
 * (focus follows only if it was on a tab). Directions: ↑/↓ move a step; Home/End go to the first/last step;
 * Page Up/Down and Space scroll by a screen and the step follows the scroll. Ingredients: ↑/↓ scroll the list.
 * Keys meant for the focused control are left alone.
 */
function cookKeys(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement;
  if (target.closest('input, textarea, select, [contenteditable]')) return;
  const onButton = !!target.closest('button');
  const panel = directions.hidden ? $('#panel-ingredients')! : directions;
  const behavior: ScrollBehavior = reducedMotion.matches ? 'auto' : 'smooth';
  const page = panel.clientHeight * 0.85;
  const space = event.key === ' ' && !onButton; // Space on a button presses it
  const down = event.key === 'PageDown' || (space && !event.shiftKey);
  const up = event.key === 'PageUp' || (space && event.shiftKey);

  let handled = true;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const tab = tabs[event.key === 'ArrowLeft' ? 0 : tabs.length - 1];
    if (tab.getAttribute('aria-selected') !== 'true') selectTab(tab);
    if (target.closest('[role="tab"]')) tab.focus();
  } else if (!directions.hidden && event.key === 'ArrowDown') setActive(activeStepIndex + 1);
  else if (!directions.hidden && event.key === 'ArrowUp') setActive(activeStepIndex - 1);
  else if (!directions.hidden && event.key === 'Home') setActive(0);
  else if (!directions.hidden && event.key === 'End') setActive(steps.length - 1);
  else if (event.key === 'ArrowDown') panel.scrollBy({ top: LINE_STEP, behavior });
  else if (event.key === 'ArrowUp') panel.scrollBy({ top: -LINE_STEP, behavior });
  else if (event.key === 'Home') panel.scrollTo({ top: 0, behavior });
  else if (event.key === 'End') panel.scrollTo({ top: panel.scrollHeight, behavior });
  else if (down) panel.scrollBy({ top: page, behavior });
  else if (up) panel.scrollBy({ top: -page, behavior });
  else handled = false;
  if (handled) event.preventDefault();
}

for (const tab of tabs) tab.addEventListener('click', () => selectTab(tab));

steps.forEach((step, index) => {
  step.addEventListener('click', () => {
    setActive(index);
  });
});

/* Follow manual scrolling: the step whose top sits nearest the reading position becomes active. */
directions.addEventListener(
  'scroll',
  () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      if (performance.now() < followScrollAfter) return;
      const anchor = directions.getBoundingClientRect().top + READING_OFFSET;
      let best = 0;
      let distance = Infinity;
      steps.forEach((step, i) => {
        const d = Math.abs(step.getBoundingClientRect().top - anchor);
        if (d < distance) [best, distance] = [i, d];
      });
      if (best !== activeStepIndex) setActive(best, false);
    });
  },
  { passive: true },
);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cook.open) void keepAwake();
});
