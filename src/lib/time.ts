/**
 * Recipe time in words, for the hero and the Directions header.
 *
 * One rule on every recipe: first the cooking time (time.total: everything the cook is in the process for,
 * hands-off simmering and baking included), then the wait (resting, rising, chilling …), which the cook can
 * walk away from and which is never part of time.total. The hero shows both, cooking time first; the
 * sentence under Directions says how they break down.
 */
import { formatMinutes } from './format';
import { HANDS_OFF, PLACES, WAITS, isPlace, type DirectionTimes } from './inline';

/** A piece of the sentence; `strong` marks the numbers. */
export type Segment = { text: string; strong?: true };

/** ["a"] → "a", ["a", "b", "c"] → "a, b and c" */
export function listJoin(words: readonly string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** The hero's Time: { cook: "30 min", wait: "8 hr chilling" }; `wait` only when the method has one. */
export function heroTime(totalMinutes: number, times: DirectionTimes): { cook: string; wait?: string } {
  const cook = formatMinutes(totalMinutes);
  if (!times.waits.length) return { cook };
  const minutes = times.waits.reduce((sum, w) => sum + w.minutes, 0);
  return { cook, wait: `${formatMinutes(minutes)} ${listJoin(times.waits.map((w) => WAITS[w.token]))}` };
}

/** All of it, until the dish can be served: cooking time plus every wait, for schema.org's totalTime. */
export function readyMinutes(totalMinutes: number, times: DirectionTimes): number {
  return times.waits.reduce((sum, w) => sum + w.minutes, totalMinutes);
}

/**
 * e.g. "4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and cooling." or
 * "30 min of work, plus at least 8 hr in the fridge." "In total" only when nothing is waited on after it.
 */
export function describeTime(totalMinutes: number, times: DirectionTimes): Segment[] {
  const n = (minutes: number): Segment => ({ text: formatMinutes(minutes), strong: true });
  const waits = times.waits;

  const sentence: Segment[] = [];
  if (times.handsOff > 0) {
    const activities = listJoin(times.activities.map((token) => HANDS_OFF[token]));
    sentence.push(n(totalMinutes), { text: waits.length ? ' of cooking: ' : ' in total: ' });
    sentence.push(n(totalMinutes - times.handsOff), { text: ' of work and ' }, n(times.handsOff), { text: ` of ${activities}` });
  } else if (waits.length > 0) {
    sentence.push(n(totalMinutes), { text: ' of work' });
  } else {
    sentence.push(n(totalMinutes), { text: ' from start to finish' });
  }
  waits.forEach(({ token, minutes }, i) => {
    sentence.push({ text: i === 0 ? ', plus ' : i === waits.length - 1 ? ' and ' : ', ' });
    // "At least" only for the fridge and freezer, where longer is fine.
    if (isPlace(token)) sentence.push({ text: 'at least ' }, n(minutes), { text: ` ${PLACES[token]}` });
    else sentence.push(n(minutes), { text: ` of ${WAITS[token]}` });
  });
  sentence.push({ text: '.' });
  return sentence;
}
