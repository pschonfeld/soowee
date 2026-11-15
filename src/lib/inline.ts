/** Tiny inline renderer for step text: **bold**, {timer:10m}, {simmer:1h} and {25 g} amounts. Build-time only. */
import { UNITS, formatQty } from './format';

/**
 * Hands-off time: the dish works on its own while the cook is free. Rendered as a timer like {timer:…},
 * counted in time.total, subtracted from it to get the work time, and named in the time summary
 * ("3 hr 5 min of simmering, baking and resting"). The value is the word used in that sentence.
 * Add a verb here when a recipe needs one; an unknown token fails the build.
 */
export const HANDS_OFF = {
  simmer: 'simmering',
  bake: 'baking',
  roast: 'roasting',
  rest: 'resting',
  rise: 'rising',
  cool: 'cooling',
  dry: 'drying',
  drain: 'draining',
  soak: 'soaking',
  marinate: 'marinating',
} as const;

/**
 * Time after the dish is finished, when it only has to set: plain text (not a timer), kept OUT of
 * time.total and named in the time summary ("then at least 8 hr in the fridge"). The value is that place.
 */
export const AFTER = {
  chill: 'in the fridge',
  freeze: 'in the freezer',
} as const;

export type HandsOffToken = keyof typeof HANDS_OFF;
export type AfterToken = keyof typeof AFTER;

/** Every duration token, for error messages and the docs check. */
export const DURATION_TOKENS = ['timer', ...Object.keys(HANDS_OFF), ...Object.keys(AFTER)] as const;

// Each duration pattern captures (token, value), so errors name the token that was mistyped.
// The value may be empty, so `{bake:}` reaches parseTimer and fails instead of being printed raw.
const alternation = (tokens: readonly string[]) => new RegExp(`\\{(${tokens.join('|')}):([^}]*)\\}`, 'g');
/** {timer:…} needs attention when it rings; the hands-off verbs ring too. */
const TIMER = alternation(['timer', ...Object.keys(HANDS_OFF)]);
const WAIT = alternation(Object.keys(HANDS_OFF));
const AFTER_PATTERN = alternation(Object.keys(AFTER));
/**
 * Anything that looks like a duration token, so a misspelt or retired one ({wait:1h}, {Bake:5m}, {pre-heat:5m},
 * { bake :5m}) is not printed raw. Amounts ({25 g}) have no colon and never match.
 */
const ANY_TOKEN = /\{\s*([A-Za-z][\w-]*)\s*:[^}]*\}/g;
const BOLD = /\*\*(.+?)\*\*/g;
/** {25 g}, {1.5} – the amount used at this point of the recipe (not the ingredient total). */
const AMOUNT = /\{\s*(\d+(?:\.\d+)?)\s*([A-Za-z]*)\s*\}/g;

function amount(qty: string, unit: string, html: boolean): string {
  if (unit && !(UNITS as readonly string[]).includes(unit)) {
    throw new Error(`Unknown unit "${unit}" in {${qty} ${unit}} (allowed: ${UNITS.join(', ')})`);
  }
  const text = formatQty(Number(qty), unit || undefined);
  const value = html ? `<span data-qty="${qty}"${unit ? ` data-unit="${unit}"` : ''}>${text}</span>` : text;
  return unit ? `${value}\u00a0${unit}` : value;
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
  for (const [token, name] of source.matchAll(ANY_TOKEN)) {
    // Known name, written exactly as the renderer expects it: no spaces, lower case.
    if (!(DURATION_TOKENS as readonly string[]).includes(name) || !token.startsWith(`{${name}:`)) {
      throw new Error(`Unknown token "${token}" (allowed: ${DURATION_TOKENS.join(', ')})`);
    }
  }
}

export function renderInline(source: string): string {
  rejectUnknownTokens(source);
  return escapeHtml(source)
    .replace(AMOUNT, (_, qty: string, unit: string) => amount(qty, unit, true))
    .replace(BOLD, '<strong>$1</strong>')
    .replace(AFTER_PATTERN, (_, token: string, value: string) => parseTimer(value, token).label)
    .replace(TIMER, (_, token: string, value: string) => {
      const { seconds, label } = parseTimer(value, token);
      return `<button type="button" class="timer" data-timer="${seconds}" aria-label="Start timer: ${label}">${TIMER_ICON}<span>${label}</span></button>`;
    });
}

export function plainText(source: string): string {
  rejectUnknownTokens(source);
  return source
    .replace(AMOUNT, (_, qty: string, unit: string) => amount(qty, unit, false))
    .replace(BOLD, '$1')
    .replace(AFTER_PATTERN, (_, token: string, value: string) => parseTimer(value, token).label)
    .replace(TIMER, (_, token: string, value: string) => parseTimer(value, token).label);
}

type Steps = { text: (string | { tip: string })[] }[];

/** What the step paragraphs say about time. Tips and `heat` are not counted. */
export interface StepTimes {
  /** Minutes of hands-off time, part of time.total. */
  handsOff: number;
  /** The hands-off verbs used, in the order they first appear, without repeats. */
  activities: HandsOffToken[];
  /** Time after the dish is finished, outside time.total, in the order of AFTER (fridge before freezer). */
  after: { token: AfterToken; minutes: number }[];
}

/** Sums are made in seconds and rounded to minutes once, as shown on the page. A range counts at its lower bound. */
export function stepTimes(steps: Steps): StepTimes {
  const paragraphs = steps.flatMap((s) => s.text).filter((p): p is string => typeof p === 'string');
  let handsOff = 0;
  const activities = new Set<HandsOffToken>();
  const after = new Map<AfterToken, number>();
  for (const p of paragraphs) {
    for (const [, token, value] of p.matchAll(WAIT)) {
      handsOff += parseTimer(value, token).seconds;
      activities.add(token as HandsOffToken);
    }
    for (const [, token, value] of p.matchAll(AFTER_PATTERN)) {
      after.set(token as AfterToken, (after.get(token as AfterToken) ?? 0) + parseTimer(value, token).seconds);
    }
  }
  return {
    handsOff: Math.round(handsOff / 60),
    activities: [...activities],
    after: (Object.keys(AFTER) as AfterToken[])
      .map((token) => ({ token, minutes: Math.round((after.get(token) ?? 0) / 60) }))
      .filter(({ minutes }) => minutes > 0),
  };
}
