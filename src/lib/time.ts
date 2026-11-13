/**
 * Recipe time in words, shared by the hero and the Directions header so the two cannot disagree.
 *
 * Terms: "Total time" is start to finish, written by hand in time.total. "Active" is the part of it
 * the cook is busy: total minus the hands-off verbs ({simmer:}, {bake:} …). Time after the dish is
 * finished ({chill:}, {freeze:}) is not part of the total and is shown on its own.
 */
import { formatMinutes } from './format';
import { AFTER, HANDS_OFF, type StepTimes } from './inline';

/** A piece of the sentence; `strong` marks the numbers. */
export type Segment = { text: string; strong?: true };

export interface TimeSummary {
  /** Hero: "Total time". */
  total: string;
  /** Hero: "Active", only when some of the total is hands-off. */
  active?: string;
  /** Hero: "Chill +8 hr", one entry per kind. */
  after: { label: string; value: string }[];
  /** Directions header, e.g. "4 hr 30 min in total: 1 hr 25 min of work and 3 hr 5 min of simmering, baking and resting." */
  sentence: Segment[];
}

/** ["a"] → "a", ["a", "b", "c"] → "a, b and c" */
export function listJoin(words: readonly string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

export function describeTime(totalMinutes: number, times: StepTimes): TimeSummary {
  const total = formatMinutes(totalMinutes);
  const active = totalMinutes - times.handsOff;
  const n = (minutes: number): Segment => ({ text: formatMinutes(minutes), strong: true });

  const sentence: Segment[] = [];
  if (times.handsOff > 0) {
    const activities = listJoin(times.activities.map((token) => HANDS_OFF[token]));
    sentence.push(n(totalMinutes), { text: ' in total: ' }, n(active), { text: ' of work and ' });
    sentence.push(n(times.handsOff), { text: ` of ${activities}` });
  } else if (times.after.length > 0) {
    sentence.push(n(totalMinutes), { text: ' of work' });
  } else {
    sentence.push(n(totalMinutes), { text: ' from start to finish' });
  }
  times.after.forEach(({ token, minutes }, i) => {
    sentence.push({ text: i === 0 ? ', then at least ' : ' and ' }, n(minutes), { text: ` ${AFTER[token].place}` });
  });
  sentence.push({ text: '.' });

  return {
    total,
    active: times.handsOff > 0 ? formatMinutes(active) : undefined,
    after: times.after.map(({ token, minutes }) => ({ label: AFTER[token].label, value: `+${formatMinutes(minutes)}` })),
    sentence,
  };
}
