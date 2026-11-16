/**
 * Tiny inline renderer for step text: **bold**, {timer:10m}, {simmer:1h}, {25 g} amounts and ingredient mentions
 * ({750 g mascarpone}, {cocoa powder}). Build-time only. Mentions are only parsed here; lib/mentions.ts checks that
 * they name an ingredient of the recipe.
 */
import { UNITS, formatQty } from './format';

/**
 * Hands-off time while cooking: the dish works on its own, but the cook is still in the process and nearby.
 * Rendered as a timer like {timer:…}, counted in time.total (the cooking time), subtracted from it to get the
 * work time, and named in the time summary ("3 hr 5 min of simmering, baking and cooling"). The value is the
 * word used in that sentence. Add a verb here when a recipe needs one; an unknown token fails the build.
 */
export const HANDS_OFF = {
  simmer: 'simmering',
  bake: 'baking',
  roast: 'roasting',
  cool: 'cooling',
  dry: 'drying',
  drain: 'draining',
  soak: 'soaking',
} as const;

/**
 * Waiting: time the cook can walk away from (a batter resting, a dough rising, a tiramisu setting). Kept OUT of
 * time.total and shown after it: "30 min + 8 hr chilling" in the hero, "plus at least 8 hr in the fridge" in
 * the time summary. The value is the word used in the hero, and in the summary for waits without a place.
 */
export const WAITS = {
  rest: 'resting',
  rise: 'rising',
  marinate: 'marinating',
  chill: 'chilling',
  freeze: 'freezing',
} as const;

/**
 * Waits in the fridge or freezer: plain text (not a timer, since longer is fine), named by the place in the time
 * summary ("at least 8 hr in the fridge") and listed after the other waits, the fridge first.
 */
export const PLACES = {
  chill: 'in the fridge',
  freeze: 'in the freezer',
} as const;

export type HandsOffToken = keyof typeof HANDS_OFF;
export type WaitToken = keyof typeof WAITS;
export type PlaceToken = keyof typeof PLACES;

export const isPlace = (token: WaitToken): token is PlaceToken => token in PLACES;

/** Every duration token, for error messages and the docs check. */
export const DURATION_TOKENS = ['timer', ...Object.keys(HANDS_OFF), ...Object.keys(WAITS)] as const;

// Each duration pattern captures (token, value), so errors name the token that was mistyped.
// The value may be empty, so `{bake:}` reaches parseTimer and fails instead of being printed raw.
const alternation = (tokens: readonly string[]) => new RegExp(`\\{(${tokens.join('|')}):([^}]*)\\}`, 'g');
const TIMED_WAITS = Object.keys(WAITS).filter((token) => !(token in PLACES));
/** {timer:…} needs attention when it rings; the hands-off verbs and the waits outside the fridge ring too. */
const TIMER = alternation(['timer', ...Object.keys(HANDS_OFF), ...TIMED_WAITS]);
/** A timer token plus the punctuation that directly follows it, matched per timer (never across two). */
const TIMER_WITH_PUNCTUATION = new RegExp(`${TIMER.source}([,.;:!?)…]*)`, TIMER.flags);
const HANDS_OFF_PATTERN = alternation(Object.keys(HANDS_OFF));
const WAIT_PATTERN = alternation(Object.keys(WAITS));
const PLACE_PATTERN = alternation(Object.keys(PLACES));
/**
 * Anything that looks like a duration token, so a misspelt or retired one ({wait:1h}, {Bake:5m}, {pre-heat:5m},
 * { bake :5m}) is not printed raw. Amounts ({25 g}) have no colon and never match.
 */
const ANY_TOKEN = /\{\s*([A-Za-z][\w-]*)\s*:[^}]*\}/g;
const BOLD = /\*\*(.+?)\*\*/g;
/**
 * Braces without a colon: an amount, a mention or both.
 *   {25 g} {1.5}              – an amount used at this point, not linked to an ingredient (an intermediate
 *                               preparation, or a portion measured out earlier)
 *   {750 g mascarpone} {6 eggs} – an amount measured out from the ingredient list here, plus the mention
 *   {cocoa powder}            – an ingredient used here, without an amount
 */
const QUANTITY = /\{([^{}:]*)\}/g;

export interface Quantity {
  qty?: number;
  unit?: (typeof UNITS)[number];
  /** The ingredient as written in the text; resolved against the ingredient list by lib/mentions.ts. */
  name?: string;
}

/** Parses the inside of a brace token without a colon; throws on anything that is neither an amount nor a name. */
export function parseQuantity(inner: string): Quantity {
  const text = inner.trim().replace(/\s+/g, ' ');
  const amount = /^(\d+(?:\.\d+)?)(?:( ?)(\S+)(?: (.+))?)?$/.exec(text);
  if (amount) {
    const [, digits, space, word, rest] = amount;
    const qty = Number(digits);
    if (!(qty > 0)) throw new Error(`"{${inner}}" needs an amount above zero`);
    if (word === undefined) return { qty };
    if ((UNITS as readonly string[]).includes(word)) {
      return { qty, unit: word as Quantity['unit'], ...(rest && { name: rest }) };
    }
    // {25gr}: a word stuck to the number is meant as a unit. With a space, {6 eggs}, it is an ingredient.
    if (!space) throw new Error(`Unknown unit "${word}" in {${inner}} (allowed: ${UNITS.join(', ')})`);
    return { qty, name: rest ? `${word} ${rest}` : word };
  }
  if (/^\p{L}/u.test(text)) return { name: text };
  throw new Error(`Malformed token "{${inner}}" (use an amount like {25 g}, an ingredient like {butter}, or both: {25 g butter})`);
}

/** Every amount and mention in a piece of step text, in order. */
export function quantities(source: string): Quantity[] {
  return [...source.matchAll(QUANTITY)].map(([, inner]) => parseQuantity(inner));
}

function renderQuantity({ qty, unit, name }: Quantity, html: boolean): string {
  let value = '';
  if (qty !== undefined) {
    const text = formatQty(qty, unit);
    value = html ? `<span data-qty="${qty}"${unit ? ` data-unit="${unit}"` : ''}>${text}</span>` : text;
    if (unit) value += `\u00a0${unit}`;
  }
  if (name) value += (value ? ' ' : '') + (html ? `<strong>${name}</strong>` : name);
  return value;
}

const TIMER_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="9" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 6.2V9l1.8 1.2M6.4 1.8h3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const UNIT_SECONDS = { h: 3600, m: 60, s: 1 } as const;
const UNIT_WORDS = { h: 'hour', m: 'minute', s: 'second' } as const;
type Unit = keyof typeof UNIT_SECONDS;

const words = (n: number, unit: Unit) => `${n} ${UNIT_WORDS[unit]}${n === 1 ? '' : 's'}`;

/**
 * "20m" → 20 minutes · "1h30m" → 1 hour 30 minutes · "5-10m" → 5–10 minutes.
 * The label is always generated, so every recipe words durations the same way.
 * A range rings at its lower bound: that is when the cook should start checking.
 */
export function parseTimer(value: string, token = 'timer'): { seconds: number; label: string } {
  const range = /^(\d+)-(\d+)([hms])$/.exec(value.trim());
  if (range) {
    const [, low, high, unit] = range as unknown as [string, string, string, Unit];
    if (Number(low) > 0 && Number(high) > Number(low)) {
      return {
        seconds: Number(low) * UNIT_SECONDS[unit],
        label: `${low}–${high} ${UNIT_WORDS[unit]}${Number(high) === 1 ? '' : 's'}`,
      };
    }
  }
  const parts = [...value.trim().matchAll(/(\d+)([hms])/g)] as unknown as [string, string, Unit][];
  if (!parts.length || parts.map(([all]) => all).join('') !== value.trim()) {
    throw new Error(`Invalid duration "{${token}:${value}}" (use e.g. 20m, 1h30m, 45s or a range like 5-10m)`);
  }
  // Normalised from the total, so 90m and 1h30m both read "1 hour 30 minutes".
  const seconds = parts.reduce((sum, [, n, unit]) => sum + Number(n) * UNIT_SECONDS[unit], 0);
  if (!seconds) throw new Error(`"{${token}:${value}}" has no duration`);
  const split: [number, Unit][] = [
    [Math.floor(seconds / 3600), 'h'],
    [Math.floor((seconds % 3600) / 60), 'm'],
    [seconds % 60, 's'],
  ];
  return { seconds, label: split.filter(([n]) => n).map(([n, unit]) => words(n, unit)).join(' ') };
}

function rejectUnknownTokens(source: string): void {
  // {25 g: butter}, {5:00}: a colon makes it a duration token, but no duration token starts like that.
  const stray = /\{[^{}A-Za-z]*[^{}\sA-Za-z][^{}]*:[^{}]*\}/.exec(source);
  if (stray && !/^\{\s*[A-Za-z]/.test(stray[0])) {
    throw new Error(`Unknown token "${stray[0]}" (allowed: ${DURATION_TOKENS.join(', ')}, or an amount like {25 g butter})`);
  }
  for (const [token, name] of source.matchAll(ANY_TOKEN)) {
    // Known name, written exactly as the renderer expects it: no spaces, lower case.
    if (!(DURATION_TOKENS as readonly string[]).includes(name) || !token.startsWith(`{${name}:`)) {
      throw new Error(`Unknown token "${token}" (allowed: ${DURATION_TOKENS.join(', ')})`);
    }
  }
}

/** A number and the unit after it ("190 °C", "2 minutes") never part at a line end. */
const NUMBER_UNIT = /(\d)[ \u00a0](°[CF]|%|g|kg|ml|L|cm|mm|tsp|tbsp|minutes?|min|hours?|hr|seconds?|servings?)(?![\p{L}\d])/gu;
/** Nor do the two ends of a range ("60-63", "1–2"): a word joiner on each side of the dash keeps the glyphs as written. */
const NUMBER_RANGE = /(\d)([–-])(?=\d)/g;

/**
 * Keeps amounts whole in running text: a no-break space before the unit, word joiners around a range's dash.
 * Works on HTML, touching text only (never tags or attributes), so it runs last over rendered markup.
 * Text inside a <button> (the timer pill) is left exactly as generated: recipe.ts reads that label back for the
 * timer's name and announcements, and the pill already moves as one box.
 */
export function keepAmountsWhole(html: string): string {
  let inButton = 0;
  return html
    .split(/(<[^>]*>)/)
    .map((part, i) => {
      if (i % 2) {
        if (/^<button\b/i.test(part)) inButton++;
        else if (/^<\/button>/i.test(part)) inButton--;
        return part;
      }
      return inButton ? part : part.replace(NUMBER_UNIT, '$1\u00a0$2').replace(NUMBER_RANGE, '$1\u2060$2\u2060');
    })
    .join('');
}

export function renderInline(source: string): string {
  return keepAmountsWhole(renderMarkup(source));
}

function renderMarkup(source: string): string {
  rejectUnknownTokens(source);
  return escapeHtml(source)
    .replace(QUANTITY, (_, inner: string) => renderQuantity(parseQuantity(inner), true))
    .replace(BOLD, '<strong>$1</strong>')
    .replace(PLACE_PATTERN, (_, token: string, value: string) => parseTimer(value, token).label)
    .replace(TIMER_WITH_PUNCTUATION, (_, token: string, value: string, punctuation: string) => {
      const { seconds, label } = parseTimer(value, token);
      const button = `<button type="button" class="timer" data-timer="${seconds}" aria-label="Start timer: ${label}">${TIMER_ICON}<span>${label}</span></button>`;
      // Punctuation right after a timer stays on its line (", until soft" never starts a line); see .timer-wrap.
      return punctuation ? `<span class="timer-wrap">${button}${punctuation}</span>` : button;
    });
}

export function plainText(source: string): string {
  rejectUnknownTokens(source);
  return source
    .replace(QUANTITY, (_, inner: string) => renderQuantity(parseQuantity(inner), false))
    .replace(BOLD, '$1')
    .replace(PLACE_PATTERN, (_, token: string, value: string) => parseTimer(value, token).label)
    .replace(TIMER, (_, token: string, value: string) => parseTimer(value, token).label);
}

type Directions = { steps: (string | { tip: string })[] }[];

/** What the steps say about time. Tips and `heat` are not counted. */
export interface DirectionTimes {
  /** Minutes of hands-off time, part of time.total. */
  handsOff: number;
  /** The hands-off verbs used, in the order they first appear, without repeats. */
  activities: HandsOffToken[];
  /**
   * Waits, outside time.total, one entry per verb: those without a place in the order they first appear, then
   * the fridge, then the freezer.
   */
  waits: { token: WaitToken; minutes: number }[];
}

/** Sums are made in seconds and rounded to minutes once, as shown on the page. A range counts at its lower bound. */
export function directionTimes(directions: Directions): DirectionTimes {
  const steps = directions.flatMap((s) => s.steps).filter((p): p is string => typeof p === 'string');
  let handsOff = 0;
  const activities = new Set<HandsOffToken>();
  const waits = new Map<WaitToken, number>();
  for (const p of steps) {
    for (const [, token, value] of p.matchAll(HANDS_OFF_PATTERN)) {
      handsOff += parseTimer(value, token).seconds;
      activities.add(token as HandsOffToken);
    }
    for (const [, token, value] of p.matchAll(WAIT_PATTERN)) {
      waits.set(token as WaitToken, (waits.get(token as WaitToken) ?? 0) + parseTimer(value, token).seconds);
    }
  }
  const order: WaitToken[] = [...[...waits.keys()].filter((token) => !isPlace(token)), ...(Object.keys(PLACES) as PlaceToken[])];
  return {
    handsOff: Math.round(handsOff / 60),
    activities: [...activities],
    waits: order
      .map((token) => ({ token, minutes: Math.round((waits.get(token) ?? 0) / 60) }))
      .filter(({ minutes }) => minutes > 0),
  };
}

/** The text of every **bold** span, for the check that ingredients are mentioned with {…}, not bold. */
export function boldSpans(source: string): string[] {
  return [...source.matchAll(BOLD)].map(([, text]) => text);
}
