import { describe, expect, it } from 'vitest';
import { stepTimes } from './inline';
import { describeTime, listJoin, type Segment } from './time';

const text = (sentence: Segment[]) => sentence.map((s) => s.text).join('');
const bold = (sentence: Segment[]) => sentence.filter((s) => s.strong).map((s) => s.text);
const describe_ = (total: number, ...paragraphs: string[]) => describeTime(total, stepTimes([{ text: paragraphs }]));

describe('listJoin', () => {
  it('joins with commas and a final "and"', () => {
    expect(listJoin([])).toBe('');
    expect(listJoin(['resting'])).toBe('resting');
    expect(listJoin(['soaking', 'drying'])).toBe('soaking and drying');
    expect(listJoin(['simmering', 'baking', 'resting'])).toBe('simmering, baking and resting');
  });
});

describe('describeTime', () => {
  it('only work: start to finish, no Active in the hero', () => {
    const t = describe_(25, 'Fry for {timer:5m}.');
    expect(text(t.sentence)).toBe('25 min from start to finish.');
    expect(bold(t.sentence)).toEqual(['25 min']);
    expect(t).toMatchObject({ total: '25 min', active: undefined, after: [] });
  });

  it('hands-off time: split into work and the named activities, in order of first appearance', () => {
    // Lasagna: 2 × simmer 1h, bake 30m + 20-25m, rest 15-20m = 185 min hands-off.
    const t = describe_(
      270,
      'Simmer {simmer:1h}.',
      'Simmer {simmer:1h} more.',
      'Bake {bake:30m}.',
      'Bake {bake:20-25m}.',
      'Rest {rest:15-20m}.',
    );
    expect(text(t.sentence)).toBe('4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and resting.');
    expect(bold(t.sentence)).toEqual(['4 hr 30 min', '1 hr 25 min', '3 hr 5 min']);
    expect(t.active).toBe('1 hr 25 min');
  });

  it('one activity reads naturally', () => {
    expect(text(describe_(45, 'Rest {rest:15m}.').sentence)).toBe('45 min in total: 30 min of work and 15 min of resting.');
  });

  it('time in the fridge: work, then at least the chilling, outside the total', () => {
    const t = describe_(30, 'Whisk {timer:4-5m}.', 'Refrigerate for at least {chill:8h}.');
    expect(text(t.sentence)).toBe('30 min of work, then at least 8 hr in the fridge.');
    expect(t).toMatchObject({ total: '30 min', active: undefined, after: [{ label: 'Chill', value: '+8 hr' }] });
  });

  it('hands-off and fridge time together', () => {
    const t = describe_(45, 'Cool {cool:15m}.', 'Chill {chill:4h}.');
    expect(text(t.sentence)).toBe('45 min in total: 30 min of work and 15 min of cooling, then at least 4 hr in the fridge.');
    expect(t.active).toBe('30 min');
  });

  it('fridge and freezer: both listed, both in the hero', () => {
    const t = describe_(40, 'Chill {chill:2h}.', 'Freeze {freeze:6h}.');
    expect(text(t.sentence)).toBe('40 min of work, then at least 2 hr in the fridge and 6 hr in the freezer.');
    expect(t.after).toEqual([
      { label: 'Chill', value: '+2 hr' },
      { label: 'Freeze', value: '+6 hr' },
    ]);
  });

  it('always lists the fridge before the freezer, whatever the order in the method', () => {
    const t = describe_(40, 'Freeze {freeze:6h}.', 'Chill {chill:2h}.');
    expect(text(t.sentence)).toBe('40 min of work, then at least 2 hr in the fridge and 6 hr in the freezer.');
    expect(t.after.map((a) => a.label)).toEqual(['Chill', 'Freeze']);
  });

  it('writes a day or more in days', () => {
    expect(text(describe_(20, 'Freeze {freeze:24h}.').sentence)).toBe('20 min of work, then at least 1 day in the freezer.');
  });
});
