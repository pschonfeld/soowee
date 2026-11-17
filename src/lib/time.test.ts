import { describe, expect, it } from 'vitest';
import { directionTimes } from './inline';
import { describeTime as describeTimeIn, heroTime as heroTimeIn, listJoin as listJoinIn, readyMinutes, type Segment } from './time';

const describeTime = (...args: [number, ReturnType<typeof directionTimes>]) => describeTimeIn(...args, 'en');
const heroTimeRaw = (...args: [number, ReturnType<typeof directionTimes>]) => heroTimeIn(...args, 'en');
const listJoin = (words: string[]) => listJoinIn(words, 'en');

const times = (...paragraphs: string[]) => directionTimes([{ steps: paragraphs }]);
const sentence = (total: number, ...paragraphs: string[]) => describeTime(total, times(...paragraphs));
// Durations use no-break spaces (format.test.ts checks them); these tests are about wording, so read them as spaces.
const sp = (s: string) => s.replace(/\u00a0/g, ' ');
const text = (segments: Segment[]) => sp(segments.map((s) => s.text).join(''));
const bold = (segments: Segment[]) => segments.filter((s) => s.strong).map((s) => sp(s.text));
const heroTime = (...args: Parameters<typeof heroTimeRaw>) =>
  Object.fromEntries(Object.entries(heroTimeRaw(...args)).map(([k, v]) => [k, typeof v === 'string' ? sp(v) : v]));

describe('listJoin', () => {
  it('joins with commas and a final "and"', () => {
    expect(listJoin([])).toBe('');
    expect(listJoin(['resting'])).toBe('resting');
    expect(listJoin(['soaking', 'drying'])).toBe('soaking and drying');
    expect(listJoin(['simmering', 'baking', 'cooling'])).toBe('simmering, baking and cooling');
  });
});

describe('describeTime', () => {
  it('only work: start to finish', () => {
    const s = sentence(25, 'Fry for {timer:5m}.');
    expect(text(s)).toBe('25 min from start to finish.');
    expect(bold(s)).toEqual(['25 min']);
  });

  it('hands-off time: split into work and the named activities, in order of first appearance', () => {
    // Lasagna: 2 × simmer 1h, bake 30m + 20-25m, cool 15-20m = 185 min hands-off.
    const s = sentence(
      270,
      'Simmer {simmer:1h}.',
      'Simmer {simmer:1h} more.',
      'Bake {bake:30m}.',
      'Bake {bake:20-25m}.',
      'Cool {cool:15-20m}.',
    );
    expect(text(s)).toBe('4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and cooling.');
    expect(bold(s)).toEqual(['4 hr 30 min', '1 hr 25 min', '3 hr 5 min']);
  });

  it('one activity reads naturally', () => {
    expect(text(sentence(45, 'Cool {cool:15m}.'))).toBe('45 min in total: 30 min of work and 15 min of cooling.');
  });

  it('a wait in the middle of the method: work, plus the wait, outside the cooking time', () => {
    const s = sentence(50, 'Whisk {timer:1m}.', 'Rest {rest:1h}.', 'Cook {timer:45-60s}.');
    expect(text(s)).toBe('50 min of work, plus 1 hr of resting.');
    expect(bold(s)).toEqual(['50 min', '1 hr']);
  });

  it('time in the fridge: at least, named by the place', () => {
    const s = sentence(30, 'Whisk {timer:4-5m}.', 'Refrigerate for at least {chill:8h}.');
    expect(text(s)).toBe('30 min of work, plus at least 8 hr in the fridge.');
    expect(bold(s)).toEqual(['30 min', '8 hr']);
  });

  it('hands-off time and a wait together: "of cooking", since it is not the whole time', () => {
    expect(text(sentence(45, 'Cool {cool:15m}.', 'Chill {chill:4h}.'))).toBe(
      '45 min of cooking: 30 min of work and 15 min of cooling, plus at least 4 hr in the fridge.',
    );
  });

  it('several waits: others first, then the fridge and the freezer, whatever the order in the method', () => {
    const expected = '40 min of work, plus 2 hr of rising, at least 2 hr in the fridge and at least 6 hr in the freezer.';
    expect(text(sentence(40, 'Rise {rise:2h}.', 'Chill {chill:2h}.', 'Freeze {freeze:6h}.'))).toBe(expected);
    expect(text(sentence(40, 'Freeze {freeze:6h}.', 'Chill {chill:2h}.', 'Rise {rise:2h}.'))).toBe(expected);
  });

  it('writes a day or more in days', () => {
    expect(text(sentence(20, 'Freeze {freeze:24h}.'))).toBe('20 min of work, plus at least 1 day in the freezer.');
  });
});

describe('heroTime', () => {
  it('no wait: only the cooking time, hands-off time included', () => {
    expect(heroTime(270, times('Simmer {simmer:2h}.', 'Bake {bake:50m}.'))).toEqual({ cook: '4 hr 30 min' });
  });

  it('one wait: its time and verb', () => {
    expect(heroTime(30, times('Chill {chill:8h}.'))).toEqual({ cook: '30 min', wait: '8 hr chilling' });
    expect(heroTime(50, times('Rest {rest:1h}.'))).toEqual({ cook: '50 min', wait: '1 hr resting' });
  });

  it('several waits: one sum, named by every verb', () => {
    expect(heroTime(40, times('Chill {chill:6h}.', 'Rise {rise:2h}.'))).toEqual({
      cook: '40 min',
      wait: '8 hr rising and chilling',
    });
  });

  it('a range counts at its lower bound', () => {
    expect(heroTime(30, times('Chill {chill:8-12h}.')).wait).toBe('8 hr chilling');
  });
});

describe('readyMinutes', () => {
  it('is the cooking time plus every wait', () => {
    expect(readyMinutes(30, times('Chill {chill:8h}.'))).toBe(510);
    expect(readyMinutes(270, times('Simmer {simmer:2h}.'))).toBe(270);
  });
});

describe('Czech', () => {
  const text = (segments: Segment[]) => segments.map((s) => s.text).join('').replace(/\u00a0/g, ' ');
  const times = (...paragraphs: string[]) => directionTimes([{ steps: paragraphs }]);

  it('names the activities in the genitive after the number, each word once', () => {
    expect(text(describeTimeIn(270, times('{simmer:2h}', '{bake:50m}', '{roast:15m}'), 'cs'))).toBe(
      '4 h 30 min celkem: 1 h 25 min práce a 3 h 5 min dušení a pečení.',
    );
    expect(text(describeTimeIn(25, times('{timer:5m}'), 'cs'))).toBe('25 min od začátku do konce.');
  });

  it('adds the waits after "k tomu", the fridge with "nejméně"', () => {
    expect(text(describeTimeIn(45, times('{cool:15m}', '{chill:4h}'), 'cs'))).toBe(
      '45 min přípravy: 30 min práce a 15 min chladnutí, k tomu nejméně 4 h v lednici.',
    );
    expect(text(describeTimeIn(50, times('{rest:1h}'), 'cs'))).toBe('50 min práce, k tomu 1 h odležení.');
  });

  it('shows the wait in the hero', () => {
    expect(heroTimeIn(40, times('{rise:2h}', '{chill:6h}'), 'cs').wait?.replace(/\u00a0/g, ' ')).toBe('8 h kynutí a chlazení');
  });
});
