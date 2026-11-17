/** Formatting shared by the build (Astro) and the browser (scaling). */
import { pluralForm, type Forms, type Locale } from './i18n';

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

export type Unit = (typeof UNITS)[number];

/**
 * How a unit reads in each language, by the number in front of it. The data always uses the symbols in UNITS;
 * Czech writes litres in lower case and spells the spoons out ("2 lžíce", "5 lžic", "½ lžičky").
 */
const UNIT_FORMS: Record<Locale, Partial<Record<Unit, Forms>>> = {
  en: {},
  cs: {
    L: { one: 'l' },
    tsp: { one: 'lžička', few: 'lžičky', many: 'lžičky', other: 'lžiček' },
    tbsp: { one: 'lžíce', few: 'lžíce', many: 'lžíce', other: 'lžic' },
  },
};

/**
 * In a step a Czech amount is usually the object of the verb, so the form for 1 is in the accusative: "přidejte
 * 1 lžíci oleje", while the ingredient list reads "1 lžíce oleje". The other forms are the same in both.
 */
const IN_TEXT: Partial<Record<Unit, string>> = { tsp: 'lžičku', tbsp: 'lžíci' };

/** The unit's forms in a language; a symbol reads the same for every number. `inText`: as used in a step. */
export const unitForms = (unit: string, locale: Locale, inText = false): Forms => {
  const forms = UNIT_FORMS[locale][unit as Unit] ?? { one: unit };
  const one = inText && locale === 'cs' ? IN_TEXT[unit as Unit] : undefined;
  return one ? { ...forms, one } : forms;
};

/** "2" + tbsp → "lžíce" in Czech, "tbsp" in English. */
export const formatUnit = (unit: string, qty: number, locale: Locale, inText = false) =>
  pluralForm(locale, qty, unitForms(unit, locale, inText));

/** A decimal number as the language writes it: 1.5 → "1,5" in Czech. */
const decimal = (n: number, locale: Locale) => (locale === 'cs' ? String(n).replace('.', ',') : String(n));

/** 1.5 → "1½"; metric weights and volumes are rounded to practical values. */
export function formatQty(qty: number, unit: string | undefined, locale: Locale): string {
  if (unit === 'g' || unit === 'ml') {
    if (qty < 1) return decimal(+qty.toFixed(1) || 0.1, locale);
    return String(qty >= 100 ? Math.round(qty / 5) * 5 : Math.round(qty));
  }
  if (unit === 'kg' || unit === 'L') return decimal(+qty.toFixed(2), locale);

  const whole = Math.floor(qty + 1e-9);
  const rest = qty - whole;
  if (rest < 0.06) return whole ? String(whole) : '⅛';
  if (rest > 0.94) return String(whole + 1);
  const [, glyph] = FRACTIONS.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
  return (whole ? String(whole) : '') + glyph;
}

export function formatScale(factor: number): string {
  return `${formatQty(factor, undefined, 'en')}×`;
}

/** A single serving or piece count, with its noun agreeing with the scaled number. */
export function formatYield(qty: number, unit: Forms, locale: Locale, factor = 1): string {
  const count = qty * factor;
  return `${formatQty(count, undefined, locale)}\u00a0${pluralForm(locale, count, unit)}`;
}

const DURATION_UNITS: Record<Locale, { day: Forms; hr: string; min: string }> = {
  en: { day: { one: 'day', other: 'days' }, hr: 'hr', min: 'min' },
  cs: { day: { one: 'den', few: 'dny', many: 'dne', other: 'dní' }, hr: 'h', min: 'min' },
};

/** 195 → "3 hr 15 min", 1500 → "1 day 1 hr"; Czech "3 h 15 min", "2 dny 5 min". */
export function formatMinutes(total: number, locale: Locale): string {
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const units = DURATION_UNITS[locale];
  // A no-break space keeps each number on its unit's line ("3 hr" never splits); groups can still wrap.
  return [
    d && `${d}\u00a0${pluralForm(locale, d, units.day)}`,
    h && `${h}\u00a0${units.hr}`,
    m && `${m}\u00a0${units.min}`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** 195 → "PT3H15M" (schema.org) */
export function isoDuration(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}
