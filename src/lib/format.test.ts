import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatMinutes as formatMinutesIn,
  formatQty as formatQtyIn,
  formatScale,
  formatUnit,
  formatYield as formatYieldIn,
  isoDuration,
} from './format';
import type { Forms } from './i18n';

// The rounding rules are the same in every language; Czech has its own block at the end.
const formatQty = (qty: number, unit?: string) => formatQtyIn(qty, unit, 'en');
const formatMinutes = (total: number) => formatMinutesIn(total, 'en');
const SERVINGS: Forms = { one: 'serving', other: 'servings' };
const formatYield = (min: number, max: number | undefined, _unit: 'servings', factor?: number) =>
  formatYieldIn(min, max, SERVINGS, 'en', factor);

describe('formatQty', () => {
  it('rounds metric weights and volumes to practical values', () => {
    expect(formatQty(0.25, 'g')).toBe('0.3');
    expect(formatQty(0.04, 'g')).toBe('0.1');
    expect(formatQty(37.4, 'g')).toBe('37');
    expect(formatQty(251, 'g')).toBe('250');
    expect(formatQty(1400, 'ml')).toBe('1400');
  });

  it('keeps two decimals for kg and L', () => {
    expect(formatQty(1.4, 'L')).toBe('1.4');
    expect(formatQty(0.125, 'kg')).toBe('0.13');
  });

  it('uses fraction glyphs for counts and spoons', () => {
    expect(formatQty(1.5, 'tbsp')).toBe('1½');
    expect(formatQty(0.5)).toBe('½');
    expect(formatQty(1 / 3)).toBe('⅓');
    expect(formatQty(2.75, 'tsp')).toBe('2¾');
  });

  it('snaps values close to a whole number', () => {
    expect(formatQty(2.02)).toBe('2');
    expect(formatQty(1.97)).toBe('2');
    expect(formatQty(0.01)).toBe('⅛');
  });
});

describe('formatScale / formatYield', () => {
  it('formats scale factors', () => {
    expect(formatScale(0.5)).toBe('½×');
    expect(formatScale(1)).toBe('1×');
  });

  it('scales single values and ranges', () => {
    expect(formatYield(6, undefined, 'servings')).toBe('6\u00a0servings');
    expect(formatYield(6, 8, 'servings', 0.5)).toBe('3–4\u00a0servings');
    expect(formatYield(4, undefined, 'servings', 1.5)).toBe('6\u00a0servings');
  });
});

describe('durations', () => {
  it('formats minutes', () => {
    expect(formatMinutes(195)).toBe('3\u00a0hr 15\u00a0min');
    expect(formatMinutes(60)).toBe('1\u00a0hr');
    expect(formatMinutes(45)).toBe('45\u00a0min');
    expect(formatMinutes(1440)).toBe('1\u00a0day');
    expect(formatMinutes(1500)).toBe('1\u00a0day 1\u00a0hr');
    expect(formatMinutes(2880 + 5)).toBe('2\u00a0days 5\u00a0min');
  });

  it('formats ISO 8601 durations', () => {
    expect(isoDuration(195)).toBe('PT3H15M');
    expect(isoDuration(240)).toBe('PT4H');
    expect(isoDuration(20)).toBe('PT20M');
  });

  it('formats a countdown clock and never goes negative', () => {
    expect(formatClock(605)).toBe('10:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(0.2)).toBe('00:01');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('Czech', () => {
  it('writes decimals with a comma', () => {
    expect(formatQtyIn(1.5, 'kg', 'cs')).toBe('1,5');
    expect(formatQtyIn(0.25, 'g', 'cs')).toBe('0,3');
    expect(formatQtyIn(1.5, 'tbsp', 'cs')).toBe('1½');
  });

  it('spells units by the number in front of them', () => {
    expect(formatUnit('tbsp', 1, 'cs')).toBe('lžíce');
    expect(formatUnit('tbsp', 6, 'cs')).toBe('lžic');
    expect(formatUnit('tsp', 0.5, 'cs')).toBe('lžičky');
    expect(formatUnit('tsp', 3, 'cs')).toBe('lžičky');
    expect(formatUnit('L', 2, 'cs')).toBe('l');
    expect(formatUnit('g', 2, 'cs')).toBe('g');
    // In a step the amount is the verb's object: "přidejte 1 lžíci", the list keeps "1 lžíce".
    expect(formatUnit('tbsp', 1, 'cs', true)).toBe('lžíci');
    expect(formatUnit('tsp', 1, 'cs', true)).toBe('lžičku');
    expect(formatUnit('tsp', 2, 'cs', true)).toBe('lžičky');
  });

  it('makes the yield agree with the larger number', () => {
    const porce: Forms = { one: 'porce', few: 'porce', many: 'porce', other: 'porcí' };
    expect(formatYieldIn(4, undefined, porce, 'cs')).toBe('4\u00a0porce');
    expect(formatYieldIn(4, 6, porce, 'cs')).toBe('4–6\u00a0porcí');
    const palacinka: Forms = { one: 'palačinka', few: 'palačinky', many: 'palačinky', other: 'palačinek' };
    expect(formatYieldIn(12, 14, palacinka, 'cs', 0.25)).toBe('3–3½\u00a0palačinky');
  });

  it('formats minutes and days', () => {
    expect(formatMinutesIn(195, 'cs')).toBe('3\u00a0h 15\u00a0min');
    expect(formatMinutesIn(1440, 'cs')).toBe('1\u00a0den');
    expect(formatMinutesIn(2880 + 5, 'cs')).toBe('2\u00a0dny 5\u00a0min');
    expect(formatMinutesIn(7200, 'cs')).toBe('5\u00a0dní');
  });
});
