import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The Markdown body of a recipe (its notes) is free text, but its sections are fixed so every recipe
 * reads the same way: only these headings, in this order. docs/recipe-model.md describes them.
 */
const SECTIONS = [
  { heading: 'Chef’s Notes', required: true },
  { heading: 'Allergens', required: true },
  { heading: 'Source', required: false },
];

const dir = new URL('../content/recipes/', import.meta.url);
const recipes: string[] = readdirSync(dir).filter((file: string) => file.endsWith('.md'));
const body = (file: string) => readFileSync(new URL(file, dir), 'utf8').split(/^---$/m).slice(2).join('---');
const headings = (file: string) => [...body(file).matchAll(/^(#{1,6}) (.+)$/gm)].map(([, hashes, text]) => `${hashes} ${text.trim()}`);

describe('recipe notes', () => {
  it('finds the recipes', () => {
    expect(recipes.length).toBeGreaterThan(0);
  });

  it.each(recipes)('%s uses only the fixed sections, in order', (file: string) => {
    const allowed = SECTIONS.map((s) => `## ${s.heading}`);
    const found = headings(file);
    expect(found.filter((h) => !allowed.includes(h)), 'unknown heading').toEqual([]);
    const inOrder = allowed.filter((h) => found.includes(h));
    expect(found, 'order or duplicates').toEqual(inOrder);
  });

  it.each(recipes)('%s has every required section', (file: string) => {
    const found = headings(file);
    const missing = SECTIONS.filter((s) => s.required && !found.includes(`## ${s.heading}`)).map((s) => s.heading);
    expect(missing).toEqual([]);
  });

  it('every section is described in docs/recipe-model.md', () => {
    const doc = readFileSync(new URL('../../docs/recipe-model.md', import.meta.url), 'utf8');
    expect(SECTIONS.filter((s) => !doc.includes(`\`## ${s.heading}\``)).map((s) => s.heading)).toEqual([]);
  });
});
