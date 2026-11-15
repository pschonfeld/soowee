import { describe, expect, it } from 'vitest';
import { stepTimes } from './inline';
import { describeTime, listJoin, type Segment } from './time';

const sentence = (total: number, ...paragraphs: string[]) => describeTime(total, stepTimes([{ text: paragraphs }]));
const text = (segments: Segment[]) => segments.map((s) => s.text).join('');
const bold = (segments: Segment[]) => segments.filter((s) => s.strong).map((s) => s.text);

describe('listJoin', () => {
  it('joins with commas and a final "and"', () => {
    expect(listJoin([])).toBe('');
    expect(listJoin(['resting'])).toBe('resting');
    expect(listJoin(['soaking', 'drying'])).toBe('soaking and drying');
    expect(listJoin(['simmering', 'baking', 'resting'])).toBe('simmering, baking and resting');
  });
});

describe('describeTime', () => {
  it('only work: start to finish', () => {
    const s = sentence(25, 'Fry for {timer:5m}.');
    expect(text(s)).toBe('25 min from start to finish.');
    expect(bold(s)).toEqual(['25 min']);
  });

  it('hands-off time: split into work and the named activities, in order of first appearance', () => {
    // Lasagna: 2 × simmer 1h, bake 30m + 20-25m, rest 15-20m = 185 min hands-off.
    const s = sentence(
      270,
      'Simmer {simmer:1h}.',
      'Simmer {simmer:1h} more.',
      'Bake {bake:30m}.',
      'Bake {bake:20-25m}.',
      'Rest {rest:15-20m}.',
    );
    expect(text(s)).toBe('4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and resting.');
    expect(bold(s)).toEqual(['4 hr 30 min', '1 hr 25 min', '3 hr 5 min']);
  });

  it('one activity reads naturally', () => {
    expect(text(sentence(45, 'Rest {rest:15m}.'))).toBe('45 min in total: 30 min of work and 15 min of resting.');
  });

  it('time in the fridge: work, then at least the chilling, outside the total', () => {
    const s = sentence(30, 'Whisk {timer:4-5m}.', 'Refrigerate for at least {chill:8h}.');
    expect(text(s)).toBe('30 min of work, then at least 8 hr in the fridge.');
    expect(bold(s)).toEqual(['30 min', '8 hr']);
  });

  it('hands-off and fridge time together', () => {
    expect(text(sentence(45, 'Cool {cool:15m}.', 'Chill {chill:4h}.'))).toBe(
      '45 min in total: 30 min of work and 15 min of cooling, then at least 4 hr in the fridge.',
    );
  });

  it('fridge and freezer: both listed, the fridge first whatever the order in the method', () => {
    const expected = '40 min of work, then at least 2 hr in the fridge and 6 hr in the freezer.';
    expect(text(sentence(40, 'Chill {chill:2h}.', 'Freeze {freeze:6h}.'))).toBe(expected);
    expect(text(sentence(40, 'Freeze {freeze:6h}.', 'Chill {chill:2h}.'))).toBe(expected);
  });

  it('writes a day or more in days', () => {
    expect(text(sentence(20, 'Freeze {freeze:24h}.'))).toBe('20 min of work, then at least 1 day in the freezer.');
  });
});
