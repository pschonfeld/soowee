import { describe, expect, it } from 'vitest';
import { comparePair, missingTranslations, type PairedRecipe } from './pairs';

const recipe = (changes: Partial<PairedRecipe> = {}): PairedRecipe => ({
  featured: false,
  image: { src: '/crepes.jpg' },
  yield: { min: 12, max: 14 },
  time: { total: 50 },
  ingredients: [{ items: [{ qty: 35, unit: 'g' }, { qty: 3, about: { qty: 165, max: 180, unit: 'g' } }] }],
  equipment: ['Sieve'],
  directions: [{ steps: ['Melt {35 g butter} for {timer:3-4m}.', { tip: 'Watch it.' }, 'Beat {3 eggs}.'] }],
  ...changes,
});

describe('comparePair', () => {
  it('accepts a translation that changes only the words', () => {
    const cs = recipe({
      equipment: ['Sítko'],
      directions: [{ steps: ['Rozpusťte {35 g másla} a nechte {timer:3-4m} pěnit.', { tip: 'Hlídejte ho.' }, 'Rozšlehejte {3 vejce}.'] }],
    });
    expect(comparePair(recipe(), cs)).toEqual([]);
  });

  it('names the place where the numbers differ', () => {
    expect(comparePair(recipe(), recipe({ time: { total: 45 } }))).toEqual(['time.total: 50  ≠  time.total: 45']);
    const steps = recipe({ directions: [{ steps: ['Rozpusťte {30 g másla} {timer:3-4m}.', { tip: 'x' }, '{3 vejce}'] }] });
    expect(comparePair(recipe(), steps)[0]).toMatch(/^directions\.0\.steps\.0: step 35 g, \{timer:3-4m\}  ≠  .*30 g, \{timer:3-4m\}$/);
  });

  it('compares the numbers written as prose, in any order and with either decimal mark', () => {
    const en = recipe({ equipment: ['Pan, 28 cm'], directions: [{ steps: ['Warm to 35–40 °C, then 1.5 cm {35 g x} {timer:3-4m}.', { tip: 'x' }, '{3 x}'] }] });
    const cs = recipe({ equipment: ['Pánev, 28 cm'], directions: [{ steps: ['{timer:3-4m} {35 g x} 1,5 cm, ohřejte na 35–40 °C.', { tip: 'x' }, '{3 x}'] }] });
    expect(comparePair(en, cs)).toEqual([]);
    const hotter = recipe({ equipment: ['Pánev, 28 cm'], directions: [{ steps: ['{timer:3-4m} {35 g x} 1,5 cm, na 50–55 °C.', { tip: 'x' }, '{3 x}'] }] });
    expect(comparePair(en, hotter)).toHaveLength(1);
    expect(comparePair(recipe(), recipe({ equipment: ['Pan, 24 cm'] }))).not.toEqual([]);
    // Fractions written as glyphs count, the digits of a link's address do not.
    const half = (text: string) => recipe({ equipment: [text] });
    expect(comparePair(half('Rest ½ hour, 1½ cups'), half('Odpočívat ½ hodiny, 1,5 hrnku'))).toEqual([]);
    expect(comparePair(half('Rest ½ hour'), half('Odpočívat ¼ hodiny'))).toHaveLength(1);
    expect(comparePair(half('See [this](https://x.test/2024)'), half('Viz [tohle](https://x.test/cs/7)'))).toEqual([]);
  });

  it('compares the notes: sections, bullets and their numbers', () => {
    const en = '## Chef’s Notes\n\n- **Store:** 2 days in the fridge.\n\n## Allergens\n\n- **Gluten:** flour.\n- **Egg:** eggs.\n';
    const cs = '## Poznámky šéfkuchaře\n\n- **Skladování:** 2 dny v lednici.\n\n## Alergeny\n\n- **Lepek:** mouka.\n- **Vejce:** vejce.\n';
    expect(comparePair(recipe(), recipe(), [en, cs])).toEqual([]);
    expect(comparePair(recipe(), recipe(), [en, cs.replace('2 dny', '3 dny')])).toHaveLength(1);
    expect(comparePair(recipe(), recipe(), [en, cs.replace('- **Vejce:** vejce.\n', '')])).toHaveLength(1);
  });

  it('catches a missing step, tip or heat line and a changed ingredient', () => {
    expect(comparePair(recipe(), recipe({ directions: [{ steps: ['{35 g x} {timer:3-4m}', '{3 x}'] }] }))).not.toEqual([]);
    expect(comparePair(recipe(), recipe({ directions: [{ heat: 'Heat', steps: ['{35 g x} {timer:3-4m}', { tip: 'y' }, '{3 x}'] }] }))).not.toEqual([]);
    expect(comparePair(recipe(), recipe({ ingredients: [{ items: [{ qty: 35, unit: 'g' }, { qty: 3 }] }] }))).not.toEqual([]);
    expect(comparePair(recipe(), recipe({ image: { src: '/other.jpg' } }))).not.toEqual([]);
  });
});

describe('missingTranslations', () => {
  it('names a recipe that exists in one language only, on either side', () => {
    expect(missingTranslations({ cs: ['crepes', 'lasagna'], en: ['crepes', 'lasagna'] })).toEqual([]);
    expect(missingTranslations({ cs: ['crepes'], en: ['crepes', 'tiramisu'] })).toEqual([
      'No cs version of tiramisu: write src/content/recipes/cs/<id>.md',
    ]);
    expect(missingTranslations({ cs: ['crepes', 'guláš'], en: ['crepes'] })).toEqual([
      'No en version of guláš: write src/content/recipes/en/<id>.md',
    ]);
  });
});
