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
const SILENCE_ICON = '<svg class="icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M5.500 5.500h7v7h-7Z"/></svg>';
const DISMISS_ICON =
  '<svg class="icon" viewBox="0 0 18 18" aria-hidden="true"><path d="m4.500 4.500 9 9m0-9-9 9"/></svg>';
/** How often a finished-but-undismissed timer repeats its alert. */
const ALARM_REPEAT_MS = 2500;
/** How long a dismissed running or paused timer can still be brought back. */
const UNDO_MS = 5000;

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

/** Keep keyboard focus somewhere sensible instead of dropping it to <body>. */
function refocusAfterChip() {
  // Never another chip's Undo: a stray Enter there would bring back a timer the user just dismissed.
  (tray.querySelector<HTMLButtonElement>('.timer-chip:not(.is-dismissed) button:not([hidden])') ?? (cook.open ? $('[data-cook-close]', cook) : cookOpen))?.focus();
}

function removeTimer(timer: Timer) {
  if (timer.alarm) clearInterval(timer.alarm);
  timers.delete(timer);
  persistTimers();
  updateTabTitle();
  if (timer.done) {
    timer.chip.remove();
    refocusAfterChip();
  } else {
    offerUndo(timer);
  }
}

/**
 * A running or paused timer is one small tap from being lost with wet hands, so dismissing it leaves the chip in
 * place for a few seconds with Undo. The timer keeps its absolute end time, so Undo loses no countdown.
 */
function offerUndo(timer: Timer) {
  const { chip, name, label, end, pausedRemaining } = timer;
  chip.classList.add('is-dismissed');

  const note = document.createElement('span');
  note.className = 'timer-chip__label';
  note.textContent = 'Timer dismissed';
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'btn btn--capsule btn--glass btn--sm';
  undo.textContent = 'Undo';
  undo.setAttribute('aria-label', `Undo dismiss timer: ${label}`);
  chip.replaceChildren(note, undo);
  undo.focus();
  announce(`Timer dismissed: ${label}`);

  const expire = window.setTimeout(() => {
    const hadFocus = chip.contains(document.activeElement);
    chip.remove();
    if (hadFocus) refocusAfterChip();
  }, UNDO_MS);

  undo.addEventListener('click', () => {
    clearTimeout(expire);
    chip.remove();
    // Not restored as overdue: if it ran out during the undo window, the next tick finishes it with its alarm.
    const restored = buildTimer(name, label, end, pausedRemaining, false);
    if (pausedRemaining === null) ticking ||= window.setInterval(tick, 250);
    reorderTray();
    persistTimers();
    updateTabTitle();
    restored.pauseButton.focus();
    announce(`Timer restored: ${label}`);
  });
}

/** Stops a finished timer's repeating alarm but keeps its "Done" chip; the dismiss button still removes it. */
function silenceTimer(timer: Timer) {
  if (!timer.alarm) return;
  clearInterval(timer.alarm);
  timer.alarm = 0;
  const hadFocus = document.activeElement === timer.pauseButton;
  timer.pauseButton.hidden = true;
  if (hadFocus) timer.chip.querySelector<HTMLButtonElement>('button:not([hidden])')?.focus();
}

function togglePause(timer: Timer) {
  if (timer.done) return silenceTimer(timer);
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
    // While it rings, the pause slot becomes Stop: a keyboard way to silence it (tapping the chip also works).
    timer.pauseButton.innerHTML = SILENCE_ICON;
    timer.pauseButton.setAttribute('aria-label', `Silence timer: ${timer.label}`);
    timer.pauseButton.hidden = false;
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
  pauseButton.className = 'btn btn--round btn--glass btn--sm timer-chip__control';
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
  dismiss.className = 'btn btn--round btn--glass btn--sm timer-chip__control';
  dismiss.setAttribute('aria-label', `Dismiss timer: ${label}`);
  dismiss.innerHTML = DISMISS_ICON;

  chip.append(pauseButton, body, dismiss);
  tray.append(chip);

  const timer: Timer = { end, pausedRemaining, name, label, chip, clock, pauseButton, done: false, alarm: 0 };
  timers.add(timer);

  pauseButton.addEventListener('click', () => togglePause(timer));
  dismiss.addEventListener('click', () => removeTimer(timer));
  // Tapping anywhere on a ringing chip silences it, as on iOS.
  chip.addEventListener('click', () => {
    if (timer.done) silenceTimer(timer);
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
  // Named by its section ("Make the béchamel, 5 minutes"), so the tray tells running timers apart.
  const section = button.closest<HTMLElement>('[data-section]')?.dataset.section;
  const text = button.textContent!.trim();
  unlockAudio();
  startTimer(Number(button.dataset.timer), text, section ? `${section}, ${text}` : text);
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
  step.addEventListener('click', (event) => {
    if ((event.target as Element).closest('.timer')) return;
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
