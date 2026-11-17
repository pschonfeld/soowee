import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from './i18n';

/**
 * The Markdown body of a recipe (its notes) is free text, but its sections are fixed so every recipe
 * reads the same way: only these headings, in this order, in the recipe's language. docs/recipe-model.md
 * describes them.
 */
const SECTIONS: { heading: Record<Locale, string>; required: boolean }[] = [
  { heading: { en: 'Chef’s Notes', cs: 'Poznámky šéfkuchaře' }, required: true },
  { heading: { en: 'Allergens', cs: 'Alergeny' }, required: true },
  { heading: { en: 'Source', cs: 'Zdroj' }, required: false },
];

const root = new URL('../content/recipes/', import.meta.url);
/** "en/lasagna.md", "cs/lasagna.md" … */
const recipes: string[] = LOCALES.flatMap((locale) =>
  readdirSync(new URL(`${locale}/`, root))
    .filter((file: string) => file.endsWith('.md'))
    .map((file: string) => `${locale}/${file}`),
);
const localeOf = (file: string) => file.split('/')[0] as Locale;
const body = (file: string) => readFileSync(new URL(file, root), 'utf8').split(/^---$/m).slice(2).join('---');
const headings = (file: string) => [...body(file).matchAll(/^(#{1,6}) (.+)$/gm)].map(([, hashes, text]) => `${hashes} ${text.trim()}`);

describe('recipe notes', () => {
  it('finds the recipes', () => {
    expect(recipes.length).toBeGreaterThan(0);
  });

  it.each(recipes)('%s uses only the fixed sections, in order', (file: string) => {
    const allowed = SECTIONS.map((s) => `## ${s.heading[localeOf(file)]}`);
    const found = headings(file);
    expect(found.filter((h) => !allowed.includes(h)), 'unknown heading').toEqual([]);
    const inOrder = allowed.filter((h) => found.includes(h));
    expect(found, 'order or duplicates').toEqual(inOrder);
  });

  it.each(recipes)('%s has every required section', (file: string) => {
    const found = headings(file);
    const missing = SECTIONS.filter((s) => s.required && !found.includes(`## ${s.heading[localeOf(file)]}`)).map(
      (s) => s.heading[localeOf(file)],
    );
    expect(missing).toEqual([]);
  });

  it('every section is described in docs/recipe-model.md', () => {
    const doc = readFileSync(new URL('../../docs/recipe-model.md', import.meta.url), 'utf8');
    const headings = SECTIONS.flatMap((s) => LOCALES.map((locale) => s.heading[locale]));
    expect(headings.filter((heading) => !doc.includes(`\`## ${heading}\``))).toEqual([]);
  });
});
