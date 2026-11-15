/**
 * Recipe time in words for the Directions header.
 *
 * The hero shows only "Total time" (time.total, start to finish). Everything else about time lives in
 * one generated sentence: how much of the total is work, what the dish does on its own ({simmer:},
 * {bake:} …), and what comes after the dish is finished ({chill:}, {freeze:}), which is never part of
 * the total.
 */
import { formatMinutes } from './format';
import { AFTER, HANDS_OFF, type StepTimes } from './inline';

/** A piece of the sentence; `strong` marks the numbers. */
export type Segment = { text: string; strong?: true };

/** ["a"] → "a", ["a", "b", "c"] → "a, b and c" */
export function listJoin(words: readonly string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** e.g. "4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and resting." */
export function describeTime(totalMinutes: number, times: StepTimes): Segment[] {
  const n = (minutes: number): Segment => ({ text: formatMinutes(minutes), strong: true });

  const sentence: Segment[] = [];
  if (times.handsOff > 0) {
    const activities = listJoin(times.activities.map((token) => HANDS_OFF[token]));
    sentence.push(n(totalMinutes), { text: ' in total: ' }, n(totalMinutes - times.handsOff), { text: ' of work and ' });
    sentence.push(n(times.handsOff), { text: ` of ${activities}` });
  } else if (times.after.length > 0) {
    sentence.push(n(totalMinutes), { text: ' of work' });
  } else {
    sentence.push(n(totalMinutes), { text: ' from start to finish' });
  }
  times.after.forEach(({ token, minutes }, i) => {
    sentence.push({ text: i === 0 ? ', then at least ' : ' and ' }, n(minutes), { text: ` ${AFTER[token]}` });
  });
  sentence.push({ text: '.' });
  return sentence;
}
