import { describe, expect, it } from 'vitest';
import { haystack, matches, normalize, words } from './search';

describe('normalize', () => {
  it('lowercases and removes accents', () => {
    expect(normalize('Crêpes')).toBe('crepes');
    expect(normalize('RAGÙ')).toBe('ragu');
  });
});

describe('words', () => {
  it('splits on anything that is not a letter or digit', () => {
    expect(words('Fish & Chips')).toEqual(['fish', 'chips']);
    expect(words('Italian-American')).toEqual(['italian', 'american']);
    expect(words('  ')).toEqual([]);
  });
});

describe('haystack', () => {
  it('joins the parts, skips missing ones and drops repeats', () => {
    expect(haystack(['Tiramisu', undefined, 'Italian', 'eggs', 'sugar', 'eggs'])).toBe('tiramisu italian eggs sugar');
  });
});

describe('matches', () => {
  const tiramisu = words('Tiramisu Italian mascarpone Savoiardi biscuits cocoa powder');
  const bolognese = words('Bolognese Sauce Italian extra virgin olive oil');

  it('matches the start of words, ignoring case and accents', () => {
    expect(matches(tiramisu, 'masc')).toBe(true);
    expect(matches(tiramisu, 'SAVOI')).toBe(true);
    expect(matches(words('Crêpes French'), 'crepes')).toBe(true);
    expect(matches(words('Crepes French'), 'crêpes')).toBe(true);
  });

  it('does not match inside a word', () => {
    expect(matches(words('boil foil'), 'oil')).toBe(false);
    expect(matches(bolognese, 'oil')).toBe(true);
  });

  it('needs every word of the query', () => {
    expect(matches(tiramisu, 'italian cocoa')).toBe(true);
    expect(matches(bolognese, 'italian cocoa')).toBe(false);
  });

  it('matches everything for an empty query', () => {
    expect(matches(tiramisu, '')).toBe(true);
    expect(matches(tiramisu, '  ')).toBe(true);
  });
});

describe('Czech inflection', () => {
  it('finds another case of a word when asked to', () => {
    const hay = haystack(['Palačinky', '225 g hladké mouky', 'másla']);
    expect(hay.split(' ')).toContain('mouky');
    expect(matches(hay.split(' '), 'mouka')).toBe(false);
    expect(matches(hay.split(' '), 'mouka', true)).toBe(true);
    expect(matches(hay.split(' '), 'maslo', true)).toBe(true);
    expect(matches(hay.split(' '), 'pala', true)).toBe(true);
  });
});
