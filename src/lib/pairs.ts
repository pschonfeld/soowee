/**
 * A recipe is written once per language, and the two files must tell the same recipe: every number, unit,
 * duration and image the reader can act on is compared, so a translation can never contradict the original.
 * Only words differ. Pure, so it is unit-tested; lib/recipes.ts runs it on every build.
 */
import { DURATION_TOKENS, quantities } from './inline';

type Text = string | { tip: string };
export interface PairedRecipe {
  featured: boolean;
  image: { src: string };
  tint?: string;
  imageCredit?: { url: string };
  source?: { url?: string };
  yield: { min: number; max?: number; unit?: string };
  time: { total: number };
  ingredients: {
    group?: string;
    items: { qty?: number; unit?: string; about?: { qty: number; max?: number; unit: string }; note?: string }[];
  }[];
  equipment: (string | { name: string; note: string })[];
  directions: { heat?: string; steps: Text[] }[];
}

const DURATION = new RegExp(`\\{(${DURATION_TOKENS.join('|')}):([^}]*)\\}`, 'g');

const TOKEN = /\{[^{}]*\}/g;
/** A link's target: its digits are an address, not a fact of the recipe. */
const LINK_TARGET = /\]\([^)]*\)/g;
const GLYPHS: Record<string, number> = { '⅛': 0.125, '¼': 0.25, '⅓': 1 / 3, '⅜': 0.375, '½': 0.5, '⅝': 0.625, '⅔': 2 / 3, '¾': 0.75, '⅞': 0.875 };
/** A number in prose: "35", "1.5", "1,5", "½", "1½". A range gives two: "35–40". */
const NUMBER = /(\d+(?:[.,]\d+)?)?([⅛¼⅓⅜½⅝⅔¾⅞])?/g;

/** The numbers written as prose (temperatures, sizes, hours), outside tokens and link targets; "1,5" is "1.5". */
const proseNumbers = (text: string) =>
  [...text.replace(TOKEN, ' ').replace(LINK_TARGET, ']').matchAll(NUMBER)]
    .filter(([all]) => all)
    .map(([, digits, glyph]) => String(+(Number((digits ?? '0').replace(',', '.')) + (glyph ? GLYPHS[glyph] : 0)).toFixed(3)));

/**
 * What a piece of text says that does not depend on the language: its durations, amounts and the numbers in its
 * prose. Sorted, because a translation may reorder a sentence ("milk and water" → "vodu a mléko").
 */
function facts(text: string): string {
  const durations = [...text.matchAll(DURATION)].map(([token]) => token);
  const amounts = quantities(text)
    .filter((q) => q.qty !== undefined)
    .map((q) => `${q.qty}${q.unit ? ` ${q.unit}` : ''}`);
  return [...durations, ...amounts, ...proseNumbers(text)].sort().join(', ');
}

/** The language-independent shape of a recipe, as flat "path: value" lines, so a difference names its place. */
function shape(r: PairedRecipe): string[] {
  const lines = [
    `featured: ${r.featured}`,
    `image: ${r.image.src}`,
    `tint: ${r.tint ?? ''}`,
    `imageCredit.url: ${r.imageCredit?.url ?? ''}`,
    `source.url: ${r.source?.url ?? ''}`,
    `yield: ${r.yield.min}–${r.yield.max ?? ''} ${r.yield.unit === undefined ? 'servings' : 'own unit'}`,
    `time.total: ${r.time.total}`,
    `equipment: ${r.equipment.length} items`,
    ...r.equipment.map((item, i) => `equipment.${i}: ${facts(typeof item === 'string' ? item : `${item.name} ${item.note}`)}`),
  ];
  r.ingredients.forEach((group, g) => {
    lines.push(`ingredients.${g}: ${group.items.length} items, ${group.group === undefined ? 'no title' : 'titled'}`);
    group.items.forEach((item, k) => {
      const about = item.about ? ` (about ${item.about.qty}–${item.about.max ?? ''} ${item.about.unit})` : '';
      lines.push(`ingredients.${g}.items.${k}: ${item.qty ?? '–'} ${item.unit ?? ''}${about}; note ${facts(item.note ?? '')}`);
    });
  });
  r.directions.forEach((section, i) => {
    lines.push(`directions.${i}: ${section.steps.length} entries, ${section.heat === undefined ? 'no heat' : 'heat'}`);
    if (section.heat !== undefined) lines.push(`directions.${i}.heat: ${facts(section.heat)}`);
    section.steps.forEach((step, j) => {
      const tip = typeof step !== 'string';
      lines.push(`directions.${i}.steps.${j}: ${tip ? 'tip' : 'step'} ${facts(tip ? step.tip : step)}`);
    });
  });
  return lines;
}

/**
 * The notes (Markdown body): the same sections with the same number of bullets, and the same numbers in each
 * section ("keeps 2 days in the fridge"), so a translation cannot drop an allergen or change a storage time.
 */
function bodyShape(body: string): string[] {
  return body
    .split(/^## .*$/m)
    .slice(1)
    .map((section, i) => {
      const bullets = section.match(/^- /gm)?.length ?? 0;
      return `notes.${i}: ${bullets} bullets; ${facts(section)}`;
    });
}

/** Every recipe exists in both languages: the ids missing on either side, as messages. */
export function missingTranslations(ids: Record<'cs' | 'en', string[]>): string[] {
  return (
    [
      ['cs', 'en'],
      ['en', 'cs'],
    ] as const
  ).flatMap(([from, to]) => {
    const missing = ids[from].filter((id) => !ids[to].includes(id));
    return missing.length ? [`No ${to} version of ${missing.join(', ')}: write src/content/recipes/${to}/<id>.md`] : [];
  });
}

/** The first differences between two language versions of a recipe, or none when they agree. */
export function comparePair(a: PairedRecipe, b: PairedRecipe, bodies: [string, string] = ['', '']): string[] {
  const left = [...shape(a), ...bodyShape(bodies[0])];
  const right = [...shape(b), ...bodyShape(bodies[1])];
  const differences: string[] = [];
  for (let i = 0; i < Math.max(left.length, right.length) && differences.length < 5; i++) {
    if (left[i] !== right[i]) differences.push(`${left[i] ?? '(nothing)'}  ≠  ${right[i] ?? '(nothing)'}`);
  }
  return differences;
}
