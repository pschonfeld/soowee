import { SCALES, formatClock, formatQty, formatScale, formatYield } from '../lib/format';

const $ = <T extends HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends HTMLElement>(selector: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(selector),
];

const article = $('article[data-recipe]')!;
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
    el.textContent = formatQty(Number(el.dataset.qty) * factor, el.dataset.unit);
  }
  const { yieldMin, yieldMax, yieldUnit } = article.dataset;
  const text = formatYield(Number(yieldMin), yieldMax ? Number(yieldMax) : undefined, yieldUnit!, factor);
  for (const el of $$('[data-yield]')) el.textContent = text;
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

/* ── Appearance: Light / Dark / Auto (Auto follows the system) ── */
const THEME_KEY = 'soowee:theme';
const themeInputs = $$<HTMLInputElement>('input[name="theme"]');
const storedTheme = document.documentElement.dataset.theme ?? 'auto';
for (const input of themeInputs) {
  input.checked = input.value === storedTheme;
  input.addEventListener('change', () => {
    if (input.value === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = input.value;
    try {
      if (input.value === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, input.value);
    } catch {
      /* The choice still applies for this visit. */
    }
  });
}

/* ── Save (kept on this device) ── */
const SAVED_KEY = 'soowee:saved';
const saveButton = $('[data-save]')!;
const saveLabel = $('[data-save-label]')!;

function readSaved(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function renderSaved(saved: boolean) {
  saveButton.toggleAttribute('data-saved', saved);
  saveLabel.textContent = saved ? 'Saved' : 'Save';
}

renderSaved(readSaved().includes(article.dataset.recipe!));

saveButton.addEventListener('click', () => {
  const id = article.dataset.recipe!;
  const saved = readSaved();
  const next = saved.includes(id) ? saved.filter((s) => s !== id) : [...saved, id];
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    announce('Saving is not available in this browser');
    return;
  }
  renderSaved(next.includes(id));
  announce(next.includes(id) ? 'Recipe saved' : 'Removed from saved recipes');
});

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
    announce('Link copied');
  } catch {
    announce('Sharing is not available');
  }
});

/* ── Timers ── */
interface Timer {
  end: number;
  chip: HTMLElement;
  clock: HTMLElement;
  label: string;
  done: boolean;
}

const tray = $('[data-timers]')!;
const timers = new Set<Timer>();
let ticking = 0;

let audio: AudioContext | undefined;

/** Safari only lets audio start from a user gesture, so the context is unlocked when a timer is started. */
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = undefined;
  }
}

function beep() {
  try {
    const ctx = audio;
    if (!ctx) return;
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.25);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* Audio is a nicety; the visual + announced state is the contract. */
  }
}

function tick() {
  const now = Date.now();
  for (const timer of timers) {
    if (timer.done) continue;
    const left = (timer.end - now) / 1000;
    if (left > 0) {
      timer.clock.textContent = formatClock(left);
    } else {
      timer.done = true;
      timer.clock.textContent = 'Done';
      timer.chip.classList.add('is-done');
      announce(`Timer finished: ${timer.label}`);
      beep();
    }
  }
  if (![...timers].some((t) => !t.done)) {
    clearInterval(ticking);
    ticking = 0;
  }
}

/** `name` is shown on the chip; `label` (step + duration) is what assistive tech hears. */
function startTimer(seconds: number, name: string, label: string) {
  const chip = document.createElement('div');
  chip.className = 'timer-chip';
  const title = document.createElement('span');
  title.textContent = name;
  const clock = document.createElement('time');
  clock.textContent = formatClock(seconds);
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', `Dismiss timer: ${label}`);
  dismiss.innerHTML =
    '<svg class="icon" viewBox="0 0 18 18" aria-hidden="true"><path d="m4.500 4.500 9 9m0-9-9 9"/></svg>';
  chip.append(title, clock, dismiss);
  tray.append(chip);

  const timer: Timer = { end: Date.now() + seconds * 1000, chip, clock, label, done: false };
  timers.add(timer);
  dismiss.addEventListener('click', () => {
    timers.delete(timer);
    chip.remove();
    // Keep keyboard focus somewhere sensible instead of dropping it to <body>.
    (tray.querySelector('button') ?? (cook.open ? $('[data-cook-close]', cook) : cookOpen))?.focus();
  });
  ticking ||= window.setInterval(tick, 250);
  announce(`Timer started: ${label}`);
}

document.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLElement>('.timer');
  if (!button) return;
  const step = button.closest<HTMLElement>('[data-step]')?.dataset.step;
  const text = button.textContent!.trim();
  unlockAudio();
  startTimer(Number(button.dataset.timer), text, step ? `Step ${step}, ${text}` : text);
});

/* ── Cook mode ── */
const cook = $<HTMLDialogElement>('#cook')!;
const cookOpen = $('[data-cook-open]')!;
const tabs = $$<HTMLButtonElement>('[role="tab"]', cook);
const directions = $('#panel-directions')!;
const lines = $$('[data-line]', cook);
const navButtons = $$<HTMLButtonElement>('[data-cook-nav]', cook);
const background = [$('main')!, $('.footer')!, $('.skip')!];
/** Distance from the top of the panel to the active line; mirrors scroll-margin-top in CSS. */
const READING_OFFSET = 72;
let activeLine = 0;
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

function setActive(index: number, scroll = true) {
  if (!lines.length) return;
  activeLine = Math.min(lines.length - 1, Math.max(0, index));
  lines.forEach((line, i) => {
    line.classList.toggle('is-active', i === activeLine);
    if (i === activeLine) line.setAttribute('aria-current', 'step');
    else line.removeAttribute('aria-current');
  });
  navButtons[0].disabled = activeLine === 0;
  navButtons[1].disabled = activeLine === lines.length - 1;
  if (scroll) {
    followScrollAfter = performance.now() + 700; // don't let our own smooth scroll re-pick the line
    lines[activeLine].scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
}

function selectTab(tab: HTMLButtonElement) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`)!.hidden = !selected;
  }
  $('.cook__nav', cook)!.hidden = tab.id !== 'tab-directions';
}

function openCook() {
  cook.show();
  document.documentElement.classList.add('is-cooking');
  for (const el of background) el.inert = true;
  selectTab(tabs[1]);
  setActive(activeLine, false);
  lines[activeLine]?.scrollIntoView({ block: 'start', behavior: 'auto' });
  // Focus the title, not the Close button: Safari would draw a focus ring after a tap or click.
  // Tab from here reaches Close first, as before.
  $('#cook-title', cook)!.focus();
  void keepAwake();
}

function closeCook() {
  cook.close();
  document.documentElement.classList.remove('is-cooking');
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
  }
});

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
    selectTab(next);
    next.focus();
  });
}

for (const button of navButtons) {
  button.addEventListener('click', () => setActive(activeLine + Number(button.dataset.cookNav)));
}

lines.forEach((line, i) => {
  line.addEventListener('click', (event) => {
    if (!(event.target as Element).closest('.timer')) setActive(i);
  });
});

/* Follow manual scrolling: the line nearest the reading position (just below the top) becomes active. */
directions.addEventListener(
  'scroll',
  () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      if (performance.now() < followScrollAfter) return;
      const anchor = directions.getBoundingClientRect().top + READING_OFFSET;
      let best = activeLine;
      let distance = Infinity;
      lines.forEach((line, i) => {
        const d = Math.abs(line.getBoundingClientRect().top - anchor);
        if (d < distance) [best, distance] = [i, d];
      });
      if (best !== activeLine) setActive(best, false);
    });
  },
  { passive: true },
);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cook.open) void keepAwake();
});
