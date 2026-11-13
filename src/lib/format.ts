/** Formatting shared by the build (Astro) and the browser (scaling). */

/** Metric only. */
export const UNITS = ['g', 'kg', 'ml', 'L', 'tsp', 'tbsp'] as const;

export const SCALES = [0.5, 1, 1.5, 2, 3, 4] as const;

const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

/** 1.5 → "1½"; metric weights and volumes are rounded to practical values. */
export function formatQty(qty: number, unit?: string): string {
  if (unit === 'g' || unit === 'ml') {
    if (qty < 1) return String(+qty.toFixed(1) || 0.1);
    return String(qty >= 100 ? Math.round(qty / 5) * 5 : Math.round(qty));
  }
  if (unit === 'kg' || unit === 'L') return String(+qty.toFixed(2));

  const whole = Math.floor(qty + 1e-9);
  const rest = qty - whole;
  if (rest < 0.06) return whole ? String(whole) : '⅛';
  if (rest > 0.94) return String(whole + 1);
  const [, glyph] = FRACTIONS.reduce((best, f) =>
    Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best,
  );
  return (whole ? String(whole) : '') + glyph;
}

export function formatScale(factor: number): string {
  return `${formatQty(factor)}×`;
}

export function formatYield(min: number, max: number | undefined, unit: string, factor = 1): string {
  const n = (v: number) => formatQty(v * factor);
  return `${max ? `${n(min)}–${n(max)}` : n(min)} ${unit}`;
}

/** 195 → "3 hr 15 min", 1500 → "1 day 1 hr" */
export function formatMinutes(total: number): string {
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return [d && `${d} day${d === 1 ? '' : 's'}`, h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
}

/** 195 → "PT3H15M" (schema.org) */
export function isoDuration(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}

/** 605 → "10:05", 3725 → "1:02:05" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
