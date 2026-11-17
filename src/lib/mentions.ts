/**
 * Ingredient mentions in step text ({750 g mascarpone}, {cocoa powder}) and the checks that link them to the
 * ingredient list. Run by the recipe schema, so a broken link fails the build with the path of the line.
 * docs/recipe-model.md, "Ingredient mentions", describes the rules.
 */
import { type UNITS } from './format';
import { boldSpans, quantities } from './inline';

type Unit = (typeof UNITS)[number];
interface Ingredient {
  name: string;
  qty?: number;
  unit?: Unit;
  /** The other forms of a counted ingredient's name ("lemons"; Czech "citrony", "citronů"). */
  plural?: Record<string, string>;
}
interface Recipe {
  ingredients: { items: Ingredient[] }[];
  directions: { heat?: string; steps: (string | { tip: string })[] }[];
}
export interface MentionIssue {
  path: (string | number)[];
  message: string;
}

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);
/** "lemon" and "lemons", "potato" and "potatoes" are the same word. */
const sameWord = (a: string, b: string) =>
  a === b || a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a;

/**
 * The ingredient a mention refers to. A mention matches a name it covers completely, or a run of whole words in
 * it ("Provolone" → "Provolone Piccante"). A complete match wins, so {water} is "water", not "sparkling water".
 * Any form of the name counts as the name (`spellings`): {6 vajec} is "vejce", whose forms include "vajec".
 * Throws when nothing or more than one ingredient matches.
 */
export function resolveMention(
  mention: string,
  names: string[],
  spellings: (name: string) => string[] = (n) => [n],
): string {
  const want = words(mention);
  const covers = (spelling: string, complete: boolean) => {
    const have = words(spelling);
    if (complete && have.length !== want.length) return false;
    return have.some((_, start) => want.every((w, i) => have[start + i] !== undefined && sameWord(w, have[start + i])));
  };
  const runs = names.filter((name) => spellings(name).some((spelling) => covers(spelling, false)));
  const complete = runs.filter((name) => spellings(name).some((spelling) => covers(spelling, true)));
  const found = complete.length ? complete : runs;
  if (found.length === 1) return found[0];
  if (!found.length) {
    throw new Error(`"{${mention}}" matches no ingredient (ingredients: ${names.join(', ')})`);
  }
  throw new Error(`"{${mention}}" matches more than one ingredient (${found.join(', ')}); write the full name`);
}

/** Weights and volumes are compared in g and ml; spoons and counts only with themselves. */
const BASE: Record<Unit, [string, number]> = {
  g: ['g', 1],
  kg: ['g', 1000],
  ml: ['ml', 1],
  L: ['ml', 1000],
  tsp: ['tsp', 1],
  tbsp: ['tbsp', 1],
};
const base = (qty: number, unit: Unit | undefined): [string, number] => {
  const [dimension, factor] = unit ? BASE[unit] : ['', 1];
  return [dimension, qty * factor];
};
const show = (qty: number, dimension: string) => `${+qty.toFixed(3)}${dimension ? ` ${dimension}` : ''}`;

export function checkMentions(recipe: Recipe): MentionIssue[] {
  const issues: MentionIssue[] = [];
  const lines = recipe.ingredients.flatMap((group, g) =>
    group.items.map((item, k) => ({ item, path: ['ingredients', g, 'items', k] as (string | number)[] })),
  );
  const names = [...new Set(lines.map(({ item }) => item.name))];
  const forms = new Map(lines.map(({ item }) => [item.name, [item.name, ...Object.values(item.plural ?? {})]]));
  const spellings = (name: string) => forms.get(name) ?? [name];
  const used = new Set<string>();
  const measured = new Map<string, { dimension: string; qty: number; path: (string | number)[] }[]>();

  recipe.directions.forEach((section, i) => {
    const texts: { text: string; path: (string | number)[]; tip: boolean }[] = [];
    if (section.heat !== undefined) texts.push({ text: section.heat, path: ['directions', i, 'heat'], tip: false });
    section.steps.forEach((p, j) =>
      texts.push(
        typeof p === 'string'
          ? { text: p, path: ['directions', i, 'steps', j], tip: false }
          : { text: p.tip, path: ['directions', i, 'steps', j, 'tip'], tip: true },
      ),
    );

    for (const { text, path, tip } of texts) {
      for (const bold of boldSpans(text)) {
        if (names.some((name) => tryResolve(bold, [name], spellings))) {
          issues.push({
            path,
            message: tip
              ? `"**${bold}**" is an ingredient: tips mention ingredients in plain text`
              : `"**${bold}**" is an ingredient: write {${bold}}, or {amount ${bold}} where it is measured out`,
          });
        }
      }
      for (const { qty, unit, name } of quantities(text)) {
        if (name === undefined) continue;
        if (tip) {
          issues.push({ path, message: `"{${name}}": tips mention ingredients in plain text, without {…}` });
          continue;
        }
        let resolved: string;
        try {
          resolved = resolveMention(name, names, spellings);
        } catch (error) {
          issues.push({ path, message: (error as Error).message });
          continue;
        }
        used.add(resolved);
        if (qty !== undefined) {
          const [dimension, amount] = base(qty, unit);
          measured.set(resolved, [...(measured.get(resolved) ?? []), { dimension, qty: amount, path }]);
        }
      }
    }
  });

  for (const name of names) {
    const own = lines.filter(({ item }) => item.name === name);
    if (!used.has(name)) {
      issues.push({
        path: own[0].path,
        message: `"${name}" is never mentioned in the steps: write {${name}} where it is used`,
      });
      continue;
    }
    const portions = measured.get(name);
    if (!portions) continue;
    const listed = own.filter(({ item }) => item.qty !== undefined).map(({ item }) => base(item.qty!, item.unit));
    if (!listed.length) {
      issues.push({
        path: portions[0].path,
        message: `"${name}" has no amount in the list, so the steps cannot measure it out`,
      });
      continue;
    }
    const dimensions = new Set([...listed, ...portions.map((p) => [p.dimension] as const)].map(([d]) => d));
    if (dimensions.size > 1) {
      issues.push({
        path: portions[0].path,
        message: `"${name}" is measured in ${[...dimensions].map((d) => d || 'pieces').join(' and ')}; use one kind of unit`,
      });
      continue;
    }
    const [dimension] = dimensions;
    const total = listed.reduce((sum, [, qty]) => sum + qty, 0);
    const steps = portions.reduce((sum, p) => sum + p.qty, 0);
    if (Math.abs(total - steps) > 1e-6 * Math.max(1, total)) {
      issues.push({
        path: own[0].path,
        message: `The steps measure out ${show(steps, dimension)} of "${name}", the list has ${show(total, dimension)}. Measure each portion once: a portion set aside earlier is {amount} {${name}}, not {amount ${name}}`,
      });
    }
  }
  return issues;
}

function tryResolve(mention: string, names: string[], spellings: (name: string) => string[]): boolean {
  try {
    resolveMention(mention, names, spellings);
    return true;
  } catch {
    return false;
  }
}
