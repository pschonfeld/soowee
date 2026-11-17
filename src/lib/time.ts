/**
 * Recipe time in words, for the hero and the Directions header.
 *
 * One rule on every recipe: first the cooking time (time.total: everything the cook is in the process for,
 * hands-off simmering and baking included), then the wait (resting, rising, chilling …), which the cook can
 * walk away from and which is never part of time.total. The hero shows both, cooking time first; the
 * sentence under Directions says how they break down.
 */
import { formatMinutes } from './format';
import type { Locale } from './i18n';
import { HANDS_OFF, PLACES, WAITS, isPlace, type DirectionTimes } from './inline';

/** A piece of the sentence; `strong` marks the numbers. */
export type Segment = { text: string; strong?: true };

/** The words of the time sentence around its numbers, per language. */
const PHRASES: Record<
  Locale,
  {
    and: string;
    ofCooking: string;
    inTotal: string;
    ofWork: string;
    of: string;
    fromStartToFinish: string;
    plus: string;
    atLeast: string;
  }
> = {
  en: {
    and: ' and ',
    ofCooking: ' of cooking: ',
    inTotal: ' in total: ',
    ofWork: ' of work',
    of: ' of ',
    fromStartToFinish: ' from start to finish',
    plus: ', plus ',
    atLeast: 'at least ',
  },
  // Czech puts the activity in the genitive after the number, so "of" is just a space: "3 h dušení".
  cs: {
    and: ' a ',
    ofCooking: ' přípravy: ',
    inTotal: ' celkem: ',
    ofWork: ' práce',
    of: ' ',
    fromStartToFinish: ' od začátku do konce',
    plus: ', k tomu ',
    atLeast: 'nejméně ',
  },
};

/** ["a"] → "a", ["a", "b", "c"] → "a, b and c"; a word named twice (Czech bakes and roasts alike) is said once. */
export function listJoin(words: readonly string[], locale: Locale): string {
  const unique = [...new Set(words)];
  return unique.length < 2
    ? (unique[0] ?? '')
    : `${unique.slice(0, -1).join(', ')}${PHRASES[locale].and}${unique.at(-1)}`;
}

/** The hero's Time: { cook: "30 min", wait: "8 hr chilling" }; `wait` only when the method has one. */
export function heroTime(totalMinutes: number, times: DirectionTimes, locale: Locale): { cook: string; wait?: string } {
  const cook = formatMinutes(totalMinutes, locale);
  if (!times.waits.length) return { cook };
  const minutes = times.waits.reduce((sum, w) => sum + w.minutes, 0);
  return {
    cook,
    wait: `${formatMinutes(minutes, locale)} ${listJoin(
      times.waits.map((w) => WAITS[w.token][locale]),
      locale,
    )}`,
  };
}

/** All of it, until the dish can be served: cooking time plus every wait, for schema.org's totalTime. */
export function readyMinutes(totalMinutes: number, times: DirectionTimes): number {
  return times.waits.reduce((sum, w) => sum + w.minutes, totalMinutes);
}

/**
 * e.g. "4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and cooling." or
 * "30 min of work, plus at least 8 hr in the fridge." "In total" only when nothing is waited on after it.
 */
export function describeTime(totalMinutes: number, times: DirectionTimes, locale: Locale): Segment[] {
  const n = (minutes: number): Segment => ({ text: formatMinutes(minutes, locale), strong: true });
  const p = PHRASES[locale];
  const waits = times.waits;

  const sentence: Segment[] = [];
  if (times.handsOff > 0) {
    const activities = listJoin(
      times.activities.map((token) => HANDS_OFF[token][locale]),
      locale,
    );
    sentence.push(n(totalMinutes), { text: waits.length ? p.ofCooking : p.inTotal });
    sentence.push(n(totalMinutes - times.handsOff), { text: `${p.ofWork}${p.and}` }, n(times.handsOff), {
      text: `${p.of}${activities}`,
    });
  } else if (waits.length > 0) {
    sentence.push(n(totalMinutes), { text: p.ofWork });
  } else {
    sentence.push(n(totalMinutes), { text: p.fromStartToFinish });
  }
  waits.forEach(({ token, minutes }, i) => {
    sentence.push({ text: i === 0 ? p.plus : i === waits.length - 1 ? p.and : ', ' });
    // "At least" only for the fridge and freezer, where longer is fine.
    if (isPlace(token)) sentence.push({ text: p.atLeast }, n(minutes), { text: ` ${PLACES[token][locale]}` });
    else sentence.push(n(minutes), { text: `${p.of}${WAITS[token][locale]}` });
  });
  sentence.push({ text: '.' });
  return sentence;
}
