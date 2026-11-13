/** Tiny inline renderer for step text: **bold**, {timer:10m} and {25 g} amounts. Build-time only. */
import { UNITS, formatQty } from './format';

/** {timer:…} needs attention when it rings; {wait:…} is hands-off time (simmering, baking). */
const TIMER = /\{(?:timer|wait):([^}]+)\}/g;
const WAIT = /\{wait:([^}]+)\}/g;
const BOLD = /\*\*(.+?)\*\*/g;
/** {25 g}, {1.5} – the amount used at this point of the recipe (not the ingredient total). */
const AMOUNT = /\{\s*(\d+(?:\.\d+)?)\s*([A-Za-z]*)\s*\}/g;

function amount(qty: string, unit: string, html: boolean): string {
  if (unit && !(UNITS as readonly string[]).includes(unit)) {
    throw new Error(`Unknown unit "${unit}" in {${qty} ${unit}} (allowed: ${UNITS.join(', ')})`);
  }
  const text = formatQty(Number(qty), unit || undefined);
  const value = html ? `<span data-qty="${qty}"${unit ? ` data-unit="${unit}"` : ''}>${text}</span>` : text;
  return unit ? `${value}\u00a0${unit}` : value;
}

const TIMER_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="9" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 6.2V9l1.8 1.2M6.4 1.8h3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const UNIT_SECONDS = { h: 3600, m: 60, s: 1 } as const;
const UNIT_WORDS = { h: 'hour', m: 'minute', s: 'second' } as const;
type Unit = keyof typeof UNIT_SECONDS;

const words = (n: number, unit: Unit) => `${n} ${UNIT_WORDS[unit]}${n === 1 ? '' : 's'}`;

/**
 * "20m" → 20 minutes · "1h30m" → 1 hour 30 minutes · "5-10m" → 5–10 minutes.
 * The label is always generated, so every recipe words durations the same way.
 * A range rings at its lower bound: that is when the cook should start checking.
 */
export function parseTimer(value: string): { seconds: number; label: string } {
  const range = /^(\d+)-(\d+)([hms])$/.exec(value.trim());
  if (range) {
    const [, low, high, unit] = range as unknown as [string, string, string, Unit];
    if (Number(low) > 0 && Number(high) > Number(low)) {
      return {
        seconds: Number(low) * UNIT_SECONDS[unit],
        label: `${low}–${high} ${UNIT_WORDS[unit]}${Number(high) === 1 ? '' : 's'}`,
      };
    }
  }
  const parts = [...value.trim().matchAll(/(\d+)([hms])/g)] as unknown as [string, string, Unit][];
  if (!parts.length || parts.map(([all]) => all).join('') !== value.trim()) {
    throw new Error(`Invalid timer "{timer:${value}}" (use e.g. 20m, 1h30m, 45s or a range like 5-10m)`);
  }
  // Normalised from the total, so 90m and 1h30m both read "1 hour 30 minutes".
  const seconds = parts.reduce((sum, [, n, unit]) => sum + Number(n) * UNIT_SECONDS[unit], 0);
  if (!seconds) throw new Error(`Timer "{timer:${value}}" has no duration`);
  const split: [number, Unit][] = [
    [Math.floor(seconds / 3600), 'h'],
    [Math.floor((seconds % 3600) / 60), 'm'],
    [seconds % 60, 's'],
  ];
  return { seconds, label: split.filter(([n]) => n).map(([n, unit]) => words(n, unit)).join(' ') };
}

export function renderInline(source: string): string {
  return escapeHtml(source)
    .replace(AMOUNT, (_, qty: string, unit: string) => amount(qty, unit, true))
    .replace(BOLD, '<strong>$1</strong>')
    .replace(TIMER, (_, value: string) => {
      const { seconds, label } = parseTimer(value);
      return `<button type="button" class="timer" data-timer="${seconds}" aria-label="Start timer: ${label}">${TIMER_ICON}<span>${label}</span></button>`;
    });
}

/** Hands-off seconds in a piece of step text. */
export function waitSeconds(source: string): number {
  return [...source.matchAll(WAIT)].reduce((sum, [, value]) => sum + parseTimer(value).seconds, 0);
}

export function plainText(source: string): string {
  return source
    .replace(AMOUNT, (_, qty: string, unit: string) => amount(qty, unit, false))
    .replace(BOLD, '$1')
    .replace(TIMER, (_, value: string) => parseTimer(value).label);
}
