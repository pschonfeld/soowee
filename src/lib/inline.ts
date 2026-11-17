/**
 * Tiny inline renderer for step text: **bold**, {timer:10m}, {simmer:1h}, {25 g} amounts and ingredient mentions
 * ({750 g mascarpone}, {cocoa powder}). Build-time only. Mentions are only parsed here; lib/mentions.ts checks that
 * they name an ingredient of the recipe.
 */
import { UNITS, formatQty, formatUnit, unitForms } from './format';
import { pluralForm, type Forms, type Locale } from './i18n';

/**
 * Hands-off time while cooking: the dish works on its own, but the cook is still in the process and nearby.
 * Rendered as a highlighted duration like {timer:…}, counted in time.total (the cooking time), subtracted from it to get the
 * work time, and named in the time summary ("3 hr 5 min of simmering, baking and cooling"). The value is the
 * word used in that sentence, per language. Add a verb here when a recipe needs one; an unknown token fails the
 * build.
 */
export const HANDS_OFF = {
  simmer: { en: 'simmering', cs: 'dušení' },
  bake: { en: 'baking', cs: 'pečení' },
  roast: { en: 'roasting', cs: 'pečení' },
  cool: { en: 'cooling', cs: 'chladnutí' },
  dry: { en: 'drying', cs: 'osychání' },
  drain: { en: 'draining', cs: 'odkapávání' },
  soak: { en: 'soaking', cs: 'namáčení' },
} as const satisfies Record<string, Record<Locale, string>>;

/**
 * Waiting: time the cook can walk away from (a batter resting, a dough rising, a tiramisu setting). Kept OUT of
 * time.total and shown after it: "30 min + 8 hr chilling" in the hero, "plus at least 8 hr in the fridge" in
 * the time summary. The value is the word used in the hero, and in the summary for waits without a place, per
 * language. Czech uses verbal nouns, which read the same in both places ("+ 1 h odležení", "1 h odležení").
 */
export const WAITS = {
  rest: { en: 'resting', cs: 'odležení' },
  rise: { en: 'rising', cs: 'kynutí' },
  marinate: { en: 'marinating', cs: 'marinování' },
  chill: { en: 'chilling', cs: 'chlazení' },
  freeze: { en: 'freezing', cs: 'mražení' },
} as const satisfies Record<string, Record<Locale, string>>;

/**
 * Waits in the fridge or freezer: plain text (without highlighting, since longer is fine), named by the place in the time
 * summary ("at least 8 hr in the fridge") and listed after the other waits, the fridge first.
 */
export const PLACES = {
  chill: { en: 'in the fridge', cs: 'v lednici' },
  freeze: { en: 'in the freezer', cs: 'v mrazáku' },
} as const satisfies Record<string, Record<Locale, string>>;

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
/** Highlight active durations, hands-off verbs and waits outside the fridge. */
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
  /** The ingredient it refers to; resolved against the ingredient list by lib/mentions.ts. */
  name?: string;
  /**
   * The words shown on the page. The same as `name`, unless the mention gives both: `{máslem|máslo}` shows
   * "máslem" and refers to "máslo", for a Czech case the ingredient's own forms don't cover.
   */
  text?: string;
}

/** `{máslem|máslo}` → shown "máslem", refers to "máslo"; `{máslo}` → both "máslo". */
function mention(words: string, inner: string): Pick<Quantity, 'name' | 'text'> {
  const parts = words.split('|').map((part) => part.trim());
  if (parts.length > 2 || parts.some((part) => !part)) {
    throw new Error(`Malformed mention "{${inner}}" (write {name}, or {shown|name} for another form of the name)`);
  }
  return { text: parts[0], name: parts.at(-1) };
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
      return { qty, unit: word as Quantity['unit'], ...(rest && mention(rest, inner)) };
    }
    // {25gr}: a word stuck to the number is meant as a unit. With a space, {6 eggs}, it is an ingredient.
    if (!space) throw new Error(`Unknown unit "${word}" in {${inner}} (allowed: ${UNITS.join(', ')})`);
    return { qty, ...mention(rest ? `${word} ${rest}` : word, inner) };
  }
  if (/^\p{L}/u.test(text)) return mention(text, inner);
  throw new Error(
    `Malformed token "{${inner}}" (use an amount like {25 g}, an ingredient like {butter}, or both: {25 g butter})`,
  );
}

/** Every amount and mention in a piece of step text, in order. */
export function quantities(source: string): Quantity[] {
  return [...source.matchAll(QUANTITY)].map(([, inner]) => parseQuantity(inner));
}

/** What the renderer needs besides the text: the language, and the forms of the counted ingredients. */
export interface RenderContext {
  locale: Locale;
  /** The forms of the ingredient a mention refers to, when it is counted in pieces ("3 eggs"); else undefined. */
  forms?: (name: string) => Forms | undefined;
}

/**
 * A noun that follows a number which scales: rendered for the number as written, with every form in `data-forms`
 * so recipe.ts can pick the right one when the recipe is scaled ("1 lemon" → "2 lemons", "2 lžíce" → "6 lžic").
 */
export function nounHtml(forms: Forms, count: number, locale: Locale, tag = 'span'): string {
  const text = escapeHtml(pluralForm(locale, count, forms));
  const variable = new Set(Object.values(forms)).size > 1;
  if (!variable) return tag === 'span' ? text : `<${tag}>${text}</${tag}>`;
  return `<${tag} data-forms="${escapeHtml(JSON.stringify(forms))}" data-count="${count}">${text}</${tag}>`;
}

function renderQuantity({ qty, unit, name, text }: Quantity, html: boolean, ctx: RenderContext): string {
  const { locale } = ctx;
  let value = '';
  if (qty !== undefined) {
    const number = formatQty(qty, unit, locale);
    value = html ? `<span data-qty="${qty}"${unit ? ` data-unit="${unit}"` : ''}>${number}</span>` : number;
    if (unit) {
      const noun = html ? nounHtml(unitForms(unit, locale, true), qty, locale) : formatUnit(unit, qty, locale, true);
      value += `\u00a0${noun}`;
    }
  }
  if (name && text) {
    // A counted ingredient measured out here ("{6 eggs}") follows the number when the recipe is scaled. The words
    // as written win at their own number, so a Czech case ("{1 cibuli}") is kept wherever it applies.
    const forms = qty !== undefined && !unit ? ctx.forms?.(name) : undefined;
    const written = forms && { ...forms, [categoryOf(qty!, locale)]: text };
    const noun = html ? (written ? nounHtml(written, qty!, locale) : escapeHtml(text)) : text;
    value += (value ? ' ' : '') + noun;
    if (html) value = `<strong>${value}</strong>`;
  }
  return value;
}

/** The plural category of a number in a language, as pluralForm() picks it. */
function categoryOf(n: number, locale: Locale): keyof Forms {
  return pluralForm(locale, n, { one: 'one', few: 'few', many: 'many', other: 'other' }) as keyof Forms;
}


function unescapeHtml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"' })[name]!);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const UNIT_SECONDS = { h: 3600, m: 60, s: 1 } as const;
type Unit = keyof typeof UNIT_SECONDS;
const UNIT_WORDS: Record<Locale, Record<Unit, Forms>> = {
  en: {
    h: { one: 'hour', other: 'hours' },
    m: { one: 'minute', other: 'minutes' },
    s: { one: 'second', other: 'seconds' },
  },
  // Czech in the accusative: a duration sits in a sentence ("nechte 1 hodinu odležet"), and the pill shows it there.
  cs: {
    h: { one: 'hodinu', few: 'hodiny', many: 'hodiny', other: 'hodin' },
    m: { one: 'minutu', few: 'minuty', many: 'minuty', other: 'minut' },
    s: { one: 'sekundu', few: 'sekundy', many: 'sekundy', other: 'sekund' },
  },
};

const words = (n: number, unit: Unit, locale: Locale) => `${n} ${pluralForm(locale, n, UNIT_WORDS[locale][unit])}`;

/**
 * "20m" → 20 minutes · "1h30m" → 1 hour 30 minutes · "5-10m" → 5–10 minutes.
 * The label is always generated, so every recipe words durations the same way.
 * A range uses its lower bound for derived totals and keeps both bounds in its label.
 */
export function parseTimer(value: string, token: string, locale: Locale): { seconds: number; label: string } {
  const range = /^(\d+)-(\d+)([hms])$/.exec(value.trim());
  if (range) {
    const [, low, high, unit] = range as unknown as [string, string, string, Unit];
    if (Number(low) > 0 && Number(high) > Number(low)) {
      return {
        seconds: Number(low) * UNIT_SECONDS[unit],
        // The noun agrees with the upper bound: "1–2 minutes", "5–10 minut".
        label: `${low}–${words(Number(high), unit, locale)}`,
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
  return {
    seconds,
    label: split
      .filter(([n]) => n)
      .map(([n, unit]) => words(n, unit, locale))
      .join(' '),
  };
}

function rejectUnknownTokens(source: string): void {
  // {25 g: butter}, {5:00}: a colon makes it a duration token, but no duration token starts like that.
  const stray = /\{[^{}A-Za-z]*[^{}\sA-Za-z][^{}]*:[^{}]*\}/.exec(source);
  if (stray && !/^\{\s*[A-Za-z]/.test(stray[0])) {
    throw new Error(
      `Unknown token "${stray[0]}" (allowed: ${DURATION_TOKENS.join(', ')}, or an amount like {25 g butter})`,
    );
  }
  for (const [token, name] of source.matchAll(ANY_TOKEN)) {
    // Known name, written exactly as the renderer expects it: no spaces, lower case.
    if (!(DURATION_TOKENS as readonly string[]).includes(name) || !token.startsWith(`{${name}:`)) {
      throw new Error(`Unknown token "${token}" (allowed: ${DURATION_TOKENS.join(', ')})`);
    }
  }
}

/** A number and the unit after it ("190 °C", "2 minutes") never part at a line end. */
const NUMBER_UNIT =
  /(\d)[ \u00a0](°[CF]|%|g|kg|ml|L|l|cm|mm|tsp|tbsp|minutes?|min|hours?|hr|h|seconds?|servings?|lžičk[ay]|lžiček|lžíce|lžic|minut[ay]?|hodin[ay]?|sekund[ay]?|porc[eií]|den|dny|dní)(?![\p{L}\d])/gu;
/** Nor do the two ends of a range ("60-63", "1–2"): a word joiner on each side of the dash keeps the glyphs as written. */
const NUMBER_RANGE = /(\d)([–-])(?=\d)/g;

/**
 * Keeps amounts whole in running text: a no-break space before the unit, word joiners around a range's dash.
 * Works on HTML, touching text only (never tags or attributes), so it runs last over rendered markup.
 * Duration labels are left as generated: their wrapper keeps each label together.
 */
export function keepAmountsWhole(html: string): string {
  let inDuration = 0;
  return html
    .split(/(<[^>]*>)/)
    .map((part, i) => {
      if (i % 2) {
        if (/^<span class="duration"/.test(part) || (inDuration && /^<span\b/.test(part))) inDuration++;
        else if (inDuration && /^<\/span>/.test(part)) inDuration--;
        return part;
      }
      return inDuration
        ? part
        : part.replace(NUMBER_UNIT, '$1\u00a0$2').replace(NUMBER_RANGE, '$1\u2060$2\u2060').replace(/⌀ (?=\d)/g, '⌀\u00a0');
    })
    .join('');
}

export function renderInline(source: string, ctx: RenderContext): string {
  return keepAmountsWhole(renderMarkup(source, ctx));
}

function renderMarkup(source: string, ctx: RenderContext): string {
  const { locale } = ctx;
  rejectUnknownTokens(source);
  return escapeHtml(source)
    // The source is escaped first; a token is parsed as written (an ingredient name may hold "&"), and escaped on output.
    .replace(QUANTITY, (_, inner: string) => renderQuantity(parseQuantity(unescapeHtml(inner)), true, ctx))
    .replace(BOLD, '<strong>$1</strong>')
    .replace(PLACE_PATTERN, (_, token: string, value: string) => parseTimer(value, token, locale).label)
    .replace(TIMER_WITH_PUNCTUATION, (_, token: string, value: string, punctuation: string) => {
      const { label } = parseTimer(value, token, locale);
      const highlight = `<span class="duration"><span>${label}</span></span>`;
      // Punctuation right after a timer stays on its line (", until soft" never starts a line); see .duration-wrap.
      return punctuation ? `<span class="duration-wrap">${highlight}${punctuation}</span>` : highlight;
    });
}

export function plainText(source: string, locale: Locale): string {
  rejectUnknownTokens(source);
  return source
    .replace(QUANTITY, (_, inner: string) => renderQuantity(parseQuantity(inner), false, { locale }))
    .replace(BOLD, '$1')
    .replace(PLACE_PATTERN, (_, token: string, value: string) => parseTimer(value, token, locale).label)
    .replace(TIMER, (_, token: string, value: string) => parseTimer(value, token, locale).label);
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
      handsOff += parseTimer(value, token, 'en').seconds; // seconds are the same in every language
      activities.add(token as HandsOffToken);
    }
    for (const [, token, value] of p.matchAll(WAIT_PATTERN)) {
      waits.set(token as WaitToken, (waits.get(token as WaitToken) ?? 0) + parseTimer(value, token, 'en').seconds);
    }
  }
  const order: WaitToken[] = [
    ...[...waits.keys()].filter((token) => !isPlace(token)),
    ...(Object.keys(PLACES) as PlaceToken[]),
  ];
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
