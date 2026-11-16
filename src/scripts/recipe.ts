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

/* ── Timers: a floating Dynamic-Island-style capsule, one per running timer ── */
const PAUSE_ICON = '<svg class="icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M6.500 4.5v9M11.5 4.5v9"/></svg>';
const PLAY_ICON =
  '<svg class="icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M6.300 4.300 13.200 9 6.300 13.700Z"/></svg>';
const DISMISS_ICON =
  '<svg class="icon" viewBox="0 0 18 18" aria-hidden="true"><path d="m4.500 4.500 9 9m0-9-9 9"/></svg>';
/** How often a finished-but-undismissed timer repeats its alert. */
const ALARM_REPEAT_MS = 2500;

interface Timer {
  /** Absolute finish time; meaningful only while running (pausedRemaining === null). */
  end: number;
  /** Milliseconds left, frozen while paused; null means running. */
  pausedRemaining: number | null;
  name: string;
  label: string;
  chip: HTMLElement;
  clock: HTMLElement;
  pauseButton: HTMLButtonElement;
  done: boolean;
  /** setInterval id for the repeating alarm after it finishes; 0 = silent. */
  alarm: number;
}

const tray = $('[data-timers]')!;
const timers = new Set<Timer>();
let ticking = 0;
const TIMERS_KEY = `soowee:timers:${article.dataset.recipe}`;
const originalTitle = document.title;

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
    navigator.vibrate?.([200, 100, 200]); // no-op on iOS Safari, which doesn't implement it
  } catch {
    /* Audio is a nicety; the visual + announced state is the contract. */
  }
}

/** Persists only running/paused timers; a reload restores them, a done one is just gone. */
function persistTimers() {
  try {
    const rows = [...timers]
      .filter((t) => !t.done)
      .map((t) => ({
        end: t.pausedRemaining === null ? t.end : null,
        remaining: t.pausedRemaining,
        name: t.name,
        label: t.label,
      }));
    localStorage.setItem(TIMERS_KEY, JSON.stringify(rows));
  } catch {
    /* Private mode: timers simply don't survive a reload. */
  }
}

function msLeft(timer: Timer): number {
  return timer.pausedRemaining !== null ? timer.pausedRemaining : timer.end - Date.now();
}

function updateClock(timer: Timer) {
  timer.clock.textContent = formatClock(Math.max(0, msLeft(timer)) / 1000);
}

/** Soonest running timer first, then paused, then done; keeps the capsule stack in a sensible order. */
function reorderTray() {
  const rank = (t: Timer) => (t.done ? 2 : t.pausedRemaining !== null ? 1 : 0);
  for (const t of [...timers].sort((a, b) => rank(a) - rank(b) || msLeft(a) - msLeft(b))) tray.append(t.chip);
}

function updateTabTitle() {
  const soonest = [...timers].filter((t) => !t.done && t.pausedRemaining === null).sort((a, b) => a.end - b.end)[0];
  document.title = soonest ? `⏱ ${formatClock(Math.max(0, soonest.end - Date.now()) / 1000)} · ${originalTitle}` : originalTitle;
}

function removeTimer(timer: Timer) {
  if (timer.alarm) clearInterval(timer.alarm);
  timers.delete(timer);
  timer.chip.remove();
  persistTimers();
  updateTabTitle();
  // Keep keyboard focus somewhere sensible instead of dropping it to <body>.
  (tray.querySelector('button') ?? (cook.open ? $('[data-cook-close]', cook) : cookOpen))?.focus();
}

function togglePause(timer: Timer) {
  if (timer.done) return;
  if (timer.pausedRemaining !== null) {
    timer.end = Date.now() + timer.pausedRemaining;
    timer.pausedRemaining = null;
    timer.pauseButton.innerHTML = PAUSE_ICON;
    timer.pauseButton.setAttribute('aria-label', `Pause timer: ${timer.label}`);
    announce(`Timer resumed: ${timer.label}`);
    ticking ||= window.setInterval(tick, 250);
  } else {
    timer.pausedRemaining = Math.max(0, timer.end - Date.now());
    timer.pauseButton.innerHTML = PLAY_ICON;
    timer.pauseButton.setAttribute('aria-label', `Resume timer: ${timer.label}`);
    announce(`Timer paused: ${timer.label}`);
  }
  updateClock(timer);
  reorderTray();
  persistTimers();
  updateTabTitle();
}

function finishTimer(timer: Timer, overdue: boolean) {
  timer.done = true;
  timer.pausedRemaining = null;
  timer.chip.classList.add('is-done');
  timer.pauseButton.hidden = true;
  if (overdue) {
    // Restored after the device was asleep or the tab was closed: state only, no replayed alarm.
    const minutesAgo = Math.round((Date.now() - timer.end) / 60000);
    timer.clock.textContent = minutesAgo > 0 ? `Done ${minutesAgo}m ago` : 'Done';
  } else {
    timer.clock.textContent = 'Done';
    announce(`Timer finished: ${timer.label}`);
    beep();
    timer.alarm = window.setInterval(beep, ALARM_REPEAT_MS);
  }
  reorderTray();
  persistTimers();
  updateTabTitle();
}

function tick() {
  const now = Date.now();
  let anyRunning = false;
  for (const timer of timers) {
    if (timer.done || timer.pausedRemaining !== null) continue;
    const left = timer.end - now;
    if (left > 0) {
      anyRunning = true;
      timer.clock.textContent = formatClock(left / 1000);
    } else {
      finishTimer(timer, false);
    }
  }
  updateTabTitle();
  if (!anyRunning) {
    clearInterval(ticking);
    ticking = 0;
  }
}

/** Shared by a fresh start and a reload-restored timer. */
function buildTimer(name: string, label: string, end: number, pausedRemaining: number | null, overdue: boolean): Timer {
  const chip = document.createElement('div');
  chip.className = 'timer-chip';
  chip.setAttribute('role', 'group');
  chip.setAttribute('aria-label', label);

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'timer-chip__control';
  pauseButton.innerHTML = pausedRemaining !== null ? PLAY_ICON : PAUSE_ICON;
  pauseButton.setAttribute('aria-label', `${pausedRemaining !== null ? 'Resume' : 'Pause'} timer: ${label}`);

  const body = document.createElement('div');
  body.className = 'timer-chip__body';
  const nameEl = document.createElement('span');
  nameEl.className = 'timer-chip__label';
  nameEl.textContent = name;
  const clock = document.createElement('time');
  body.append(nameEl, clock);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'timer-chip__control';
  dismiss.setAttribute('aria-label', `Dismiss timer: ${label}`);
  dismiss.innerHTML = DISMISS_ICON;

  chip.append(pauseButton, body, dismiss);
  tray.append(chip);

  const timer: Timer = { end, pausedRemaining, name, label, chip, clock, pauseButton, done: false, alarm: 0 };
  timers.add(timer);

  pauseButton.addEventListener('click', () => togglePause(timer));
  dismiss.addEventListener('click', () => removeTimer(timer));
  // Silences a repeating alarm without losing the "done" chip; the dismiss button still removes it.
  chip.addEventListener('click', () => {
    if (timer.done && timer.alarm) {
      clearInterval(timer.alarm);
      timer.alarm = 0;
    }
  });

  if (overdue) finishTimer(timer, true);
  else updateClock(timer);
  return timer;
}

function startTimer(seconds: number, name: string, label: string) {
  buildTimer(name, label, Date.now() + seconds * 1000, null, false);
  ticking ||= window.setInterval(tick, 250);
  announce(`Timer started: ${label}`);
  persistTimers();
  updateTabTitle();
}

function restoreTimers() {
  let saved: unknown;
  try {
    saved = JSON.parse(localStorage.getItem(TIMERS_KEY) ?? '[]');
  } catch {
    return;
  }
  if (!Array.isArray(saved)) return;
  let anyRunning = false;
  for (const row of saved as Record<string, unknown>[]) {
    if (typeof row?.name !== 'string' || typeof row?.label !== 'string') continue;
    const end = typeof row.end === 'number' ? row.end : null;
    const remaining = typeof row.remaining === 'number' ? row.remaining : null;
    if (end === null && remaining === null) continue;
    const overdue = end !== null && end <= Date.now();
    buildTimer(row.name, row.label, end ?? Date.now(), remaining, overdue);
    if (!overdue && remaining === null) anyRunning = true;
  }
  if (anyRunning) ticking ||= window.setInterval(tick, 250);
  updateTabTitle();
}

restoreTimers();

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
/** Scroll/click anchors: the heat line and each paragraph of a step (not its tips or label). */
const lines = $$('[data-line]', cook);
/** Everything that dims with its step: lines, tips and the step label. */
const stepEls = $$<HTMLElement>('[data-step]', cook);
const stepLabels = $$<HTMLElement>('[data-step-label]', cook);
const stepNumbers = [...new Set(lines.map((l) => Number(l.dataset.step)))].sort((a, b) => a - b);
const navButtons = $$<HTMLButtonElement>('[data-cook-nav]', cook);
const background = [$('main')!, $('.footer')!, $('.skip')!];
/** Distance from the top of the panel to the active step; mirrors scroll-margin-top in CSS. */
const READING_OFFSET = 72;
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

/** Highlights the whole step (its label, lines and tips together), as Apple does, not one line at a time. */
function setActive(index: number, scroll = true) {
  if (!stepNumbers.length) return;
  activeStepIndex = Math.min(stepNumbers.length - 1, Math.max(0, index));
  const activeStep = stepNumbers[activeStepIndex];
  for (const el of stepEls) el.classList.toggle('is-active', Number(el.dataset.step) === activeStep);
  for (const label of stepLabels) {
    if (Number(label.dataset.step) === activeStep) label.setAttribute('aria-current', 'step');
    else label.removeAttribute('aria-current');
  }
  navButtons[0].disabled = activeStepIndex === 0;
  navButtons[1].disabled = activeStepIndex === stepNumbers.length - 1;
  if (scroll) {
    followScrollAfter = performance.now() + 700; // don't let our own smooth scroll re-pick the step
    const target = stepLabels.find((l) => Number(l.dataset.step) === activeStep);
    target?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
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
  setActive(activeStepIndex, false);
  const activeStep = stepNumbers[activeStepIndex];
  stepLabels.find((l) => Number(l.dataset.step) === activeStep)?.scrollIntoView({ block: 'start', behavior: 'auto' });
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
  button.addEventListener('click', () => setActive(activeStepIndex + Number(button.dataset.cookNav)));
}

lines.forEach((line) => {
  line.addEventListener('click', (event) => {
    if ((event.target as Element).closest('.timer')) return;
    const index = stepNumbers.indexOf(Number(line.dataset.step));
    if (index !== -1) setActive(index);
  });
});

/* Follow manual scrolling: the step whose nearest line sits at the reading position becomes active. */
directions.addEventListener(
  'scroll',
  () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      if (performance.now() < followScrollAfter) return;
      const anchor = directions.getBoundingClientRect().top + READING_OFFSET;
      let bestLine = 0;
      let distance = Infinity;
      lines.forEach((line, i) => {
        const d = Math.abs(line.getBoundingClientRect().top - anchor);
        if (d < distance) [bestLine, distance] = [i, d];
      });
      const bestStep = stepNumbers.indexOf(Number(lines[bestLine].dataset.step));
      if (bestStep !== -1 && bestStep !== activeStepIndex) setActive(bestStep, false);
    });
  },
  { passive: true },
);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cook.open) void keepAwake();
});
