/* Home page: search and the Saved badge. Everything else on the page works without JavaScript. */
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
