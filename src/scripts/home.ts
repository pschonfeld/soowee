/* Home page: search, the Saved badge and the logo's eyes. Everything else on the page works without JavaScript. */
import { matches } from '../lib/search';

const input = document.querySelector<HTMLInputElement>('#search')!;
const items = [...document.querySelectorAll<HTMLElement>('[data-search]')].map((item) => ({
  item,
  words: item.dataset.search!.split(' '),
  featured: 'featured' in item.dataset,
}));
const feature = document.querySelector<HTMLElement>('.feature');
const count = document.querySelector<HTMLElement>('[data-count]')!;
const empty = document.querySelector<HTMLElement>('[data-empty]')!;
const emptyQuery = document.querySelector<HTMLElement>('[data-empty-query]')!;
const clearButton = document.querySelector<HTMLButtonElement>('[data-search-clear]')!;

/* ── Search: filters the list in place ── */
let announceTimer = 0;

function filter() {
  const query = input.value.trim();
  let shown = 0;
  for (const { item, words, featured } of items) {
    // The featured recipe is already the card above the list; it joins the list only as a search result.
    const hit = matches(words, query) && !(featured && query === '');
    item.hidden = !hit;
    // Position among the visible rows: the first row (two on wide screens) draws no separator.
    if (hit) item.dataset.pos = String(shown++);
  }
  if (feature) feature.hidden = query !== '';
  clearButton.hidden = input.value === '';
  empty.hidden = shown > 0;
  emptyQuery.textContent = query;

  // Debounced, so a screen reader hears the result once typing pauses, not on every key.
  clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    // With no results the message under the heading says it; the count is then for screen readers only.
    count.textContent = !query ? '' : shown ? `${shown} ${shown === 1 ? 'recipe' : 'recipes'}` : `No recipes match “${query}”`;
    count.classList.toggle('sr-only', query !== '' && shown === 0);
  }, 300);
}

input.addEventListener('input', filter);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') input.blur(); // closes the phone keyboard; the results are already showing
  if (event.key === 'Escape' && input.value) {
    input.value = '';
    filter();
  }
});
// Both clear controls (in the capsule, and under "No recipes match") empty the field and keep typing going.
for (const button of [clearButton, document.querySelector<HTMLButtonElement>('[data-clear]')!]) {
  button.addEventListener('click', () => {
    input.value = '';
    filter();
    input.focus();
  });
}

/* ── Saved badge: recipes saved on this device (the recipe page's Save button) ── */
function readSaved(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('soowee:saved') ?? '[]');
    return Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function markSaved() {
  const saved = new Set(readSaved());
  for (const { item } of items) item.querySelector<HTMLElement>('[data-saved]')!.hidden = !saved.has(item.dataset.slug!);
}

// Now, and on every pageshow: it fires after the browser restores a typed query on a normal back navigation,
// and when the page comes back from the back/forward cache with a stale Saved state.
function sync() {
  filter();
  markSaved();
}
sync();
addEventListener('pageshow', sync);

/* ── Logo: the eyes follow the mouse, eased so they trail a little; on hover the onion leans toward it ── */
const logo = document.querySelector<SVGSVGElement>('.home__logo')!;
const bulb = logo.querySelector<SVGPathElement>('.logo__bulb')!;
const still = matchMedia('(prefers-reduced-motion: reduce)');
let pointer = { x: 0, y: 0 };
let eye = { x: 0, y: 0 };
let frame = 0;

addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse' || still.matches) return;
  pointer = { x: event.clientX, y: event.clientY };
  frame ||= requestAnimationFrame(follow);
});

function follow() {
  frame = 0;
  const box = bulb.getBoundingClientRect();
  if (box.bottom < 0) return; // scrolled away: nothing to look at
  const dx = pointer.x - (box.left + box.width / 2);
  const dy = pointer.y - (box.top + box.height * 0.62); // the eyes sit below the bulb's middle
  const distance = Math.hypot(dx, dy) || 1;
  const reach = Math.min(1, distance / 160); // close to the onion the eyes look less far
  const target = { x: (dx / distance) * 2.4 * reach, y: (dy / distance) * 1.8 * reach };
  eye = { x: eye.x + (target.x - eye.x) * 0.22, y: eye.y + (target.y - eye.y) * 0.22 };
  logo.style.setProperty('--eye-x', eye.x.toFixed(2));
  logo.style.setProperty('--eye-y', eye.y.toFixed(2));
  logo.style.setProperty('--tilt', Math.max(-7, Math.min(7, (dx / box.width) * 9)).toFixed(1));
  if (Math.abs(target.x - eye.x) + Math.abs(target.y - eye.y) > 0.02) frame = requestAnimationFrame(follow);
}
