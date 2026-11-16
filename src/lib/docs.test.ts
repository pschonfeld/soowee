import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UNITS } from './format';
import { DURATION_TOKENS, HANDS_OFF, PLACES, WAITS } from './inline';

/**
 * docs/recipe-model.md documents the recipe schema. These checks fail when the schema or the inline
 * markup gains something the document does not mention, so the two cannot quietly drift apart.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const doc = read('../../docs/recipe-model.md');

describe('docs/recipe-model.md', () => {
  // Every `key: z.…` (or `key: image()`) in the schema is a field a recipe author can write.
  const schemaFields = new Set(
    [...read('../content.config.ts').matchAll(/(\w+):\s*(?:z\b|image\(\))/g)].map(([, key]) => key),
  );
  // The field tables: from "## Field reference" up to the next top-level section.
  const reference = doc.slice(doc.indexOf('## Field reference'), doc.indexOf('## Inline markup'));
  // Plus the time table, which lives in its own section.
  const tables = reference + doc.slice(doc.indexOf('## Time'), doc.indexOf('## Scaling'));
  const rowFields = new Set([...tables.matchAll(/^\| `(\w+)` \|/gm)].map(([, key]) => key));

  it('has a table row for every field of the recipe schema', () => {
    expect(schemaFields.size).toBeGreaterThan(25);
    expect(schemaFields).toContain('image');
    // `tip` is a form of step, documented in the Directions table and the markup table rather than as its own row.
    expect([...schemaFields].filter((f) => f !== 'tip' && !rowFields.has(f))).toEqual([]);
    expect(doc).toContain('`tip`');
  });

  it('has no table row for a field the schema no longer has', () => {
    expect([...rowFields].filter((f) => !schemaFields.has(f))).toEqual([]);
  });

  it('mentions every inline duration token', () => {
    expect(DURATION_TOKENS.length).toBeGreaterThan(3);
    expect(DURATION_TOKENS.filter((token) => !doc.includes(`{${token}:`))).toEqual([]);
  });

  it('lists every hands-off verb with the word used in the time sentence', () => {
    const missing = Object.entries(HANDS_OFF).filter(([token, word]) => !doc.includes(`| \`{${token}:}\` | ${word} |`));
    expect(missing).toEqual([]);
  });

  it('lists every wait verb with the word used in the hero', () => {
    const missing = Object.entries(WAITS).filter(([token, word]) => !doc.includes(`| \`{${token}:}\` | ${word} |`));
    expect(missing).toEqual([]);
  });

  it('lists every fridge and freezer token with the place used in the time sentence', () => {
    const missing = Object.entries(PLACES).filter(([token, place]) => !doc.includes(`| \`{${token}:}\` | ${place} |`));
    expect(missing).toEqual([]);
  });

  it('lists every allowed unit', () => {
    expect(UNITS.filter((unit) => !doc.includes(`\`${unit}\``))).toEqual([]);
  });
});
