import { describe, expect, it } from 'vitest';
import { formatClock, formatMinutes, formatQty, formatScale, formatYield, isoDuration } from './format';

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
