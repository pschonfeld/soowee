import { describe, expect, it } from 'vitest';
import { checkMentions, resolveMention } from './mentions';

type Item = { name: string; qty?: number; unit?: 'g' | 'kg' | 'ml' | 'L' | 'tsp' | 'tbsp' };
const recipe = (items: Item[], ...text: (string | { tip: string })[]) => ({
  ingredients: [{ items }],
  steps: [{ text }],
});
const messages = (r: Parameters<typeof checkMentions>[0]) => checkMentions(r).map((i) => i.message);

describe('resolveMention', () => {
  const names = ['fine sea salt', 'flaky sea salt', 'water', 'sparkling water', 'Provolone Piccante', 'lemon', 'floury potatoes'];

  it('matches the full name, whole words of it, and plurals', () => {
    expect(resolveMention('fine sea salt', names)).toBe('fine sea salt');
    expect(resolveMention('Provolone', names)).toBe('Provolone Piccante');
    expect(resolveMention('lemons', names)).toBe('lemon');
    expect(resolveMention('potato', names)).toBe('floury potatoes');
  });

  it('prefers a complete match over a partial one', () => {
    expect(resolveMention('water', names)).toBe('water');
  });

  it('fails on an ambiguous or unknown mention', () => {
    expect(() => resolveMention('salt', names)).toThrow(/more than one ingredient \(fine sea salt, flaky sea salt\)/);
    expect(() => resolveMention('sea', ['seasoning'])).toThrow(/matches no ingredient/);
    expect(() => resolveMention('cups', names)).toThrow(/matches no ingredient/);
  });
});

describe('checkMentions', () => {
  it('accepts a recipe whose portions add up', () => {
    const r = recipe(
      [{ name: 'ground beef', qty: 500, unit: 'g' }, { name: 'passata', qty: 1.4, unit: 'L' }, { name: 'black pepper' }],
      'Brown {250 g ground beef}, then the remaining {250 g beef}.',
      'Add {1400 ml passata} and season with {black pepper}.',
    );
    expect(checkMentions(r)).toEqual([]);
  });

  it('adds up lines of the same name in different groups', () => {
    const r = {
      ingredients: [
        { items: [{ name: 'all-purpose flour', qty: 120, unit: 'g' as const }] },
        { items: [{ name: 'all-purpose flour', qty: 40, unit: 'g' as const }] },
      ],
      steps: [{ heat: 'Dust with {40 g flour}.', text: ['Whisk {120 g all-purpose flour}.'] }],
    };
    expect(checkMentions(r)).toEqual([]);
  });

  it('reports portions that do not add up, with the ingredient path', () => {
    const r = recipe([{ name: 'Pecorino Romano', qty: 80, unit: 'g' }], 'Grate {80 g Pecorino Romano}.', 'Top with {30 g Pecorino}.');
    expect(checkMentions(r)).toEqual([
      { path: ['ingredients', 0, 'items', 0], message: expect.stringMatching(/measure out 110 g .* the list has 80 g/) },
    ]);
  });

  it('does not count a portion measured out earlier', () => {
    const r = recipe([{ name: 'Pecorino Romano', qty: 80, unit: 'g' }], 'Grate {80 g Pecorino Romano}.', 'Top with the reserved {30 g} {Pecorino}.');
    expect(checkMentions(r)).toEqual([]);
  });

  it('reports mixed kinds of units and amounts for an ingredient without one', () => {
    expect(messages(recipe([{ name: 'sugar', qty: 6, unit: 'tbsp' }], 'Add {75 g sugar}.'))).toEqual([
      expect.stringMatching(/measured in tbsp and g/),
    ]);
    expect(messages(recipe([{ name: 'salt' }], 'Add {2 g salt}.'))).toEqual([expect.stringMatching(/no amount in the list/)]);
  });

  it('reports an ingredient that is never mentioned, ignoring tips', () => {
    const r = recipe([{ name: 'butter', qty: 10, unit: 'g' }, { name: 'nutmeg' }], 'Melt {10 g butter}.', { tip: 'A little nutmeg is nice.' });
    expect(checkMentions(r)).toEqual([
      { path: ['ingredients', 0, 'items', 1], message: expect.stringMatching(/"nutmeg" is never mentioned/) },
    ]);
  });

  it('reports unknown and ambiguous mentions with the step path', () => {
    const r = recipe([{ name: 'fine sea salt', qty: 3, unit: 'g' }, { name: 'flaky sea salt' }], 'Add {3 g salt}, {flaky sea salt}, {fine sea salt} and {2 cups}.');
    expect(checkMentions(r).map((i) => i.path)).toEqual([['steps', 0, 'text', 0], ['steps', 0, 'text', 0]]);
    expect(messages(r)).toEqual([expect.stringMatching(/more than one ingredient/), expect.stringMatching(/"\{cups\}" matches no ingredient/)]);
  });

  it('rejects ingredients written in bold, and mentions in tips', () => {
    const r = recipe(
      [{ name: 'butter', qty: 10, unit: 'g' }],
      'Melt {10 g butter} in the **oven** at **180 °C**, then add more **butter**.',
      { tip: 'Cold **butter** works too.' },
      { tip: 'Or use {butter} from the fridge, {5 g} at a time.' },
    );
    expect(messages(r)).toEqual([
      expect.stringMatching(/"\*\*butter\*\*" is an ingredient: write \{butter\}/),
      expect.stringMatching(/tips mention ingredients in plain text$/),
      expect.stringMatching(/"\{butter\}": tips mention ingredients in plain text/),
    ]);
  });
});
