/**
 * The site's two languages and every piece of interface text in them. Czech is the default (served at `/`),
 * English is served under `/en/`. Recipes are not here: each recipe is a Markdown file per language.
 *
 * Shared by the build and the browser; the browser imports only the types and `pluralForm`, and gets the strings
 * it needs from the page (see `clientStrings`), so the dictionary is never shipped as JavaScript.
 */

export const LOCALES = ['cs', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'cs';

export const isLocale = (value: unknown): value is Locale => (LOCALES as readonly unknown[]).includes(value);

/** The language of a page, from Astro.currentLocale (set by the i18n routing in astro.config.mjs). */
export const localeOf = (current: string | undefined): Locale => (isLocale(current) ? current : DEFAULT_LOCALE);

/**
 * A noun in every form a number can ask for, after CLDR's plural categories (what `Intl.PluralRules` returns):
 * English needs `one` and `other`; Czech `one` (1), `few` (2–4), `many` (fractions: ½ citronu) and `other`
 * (0 and 5+). A form left out falls back to `other`, then to `one`.
 */
export type Forms = { one: string; few?: string; many?: string; other?: string };

/**
 * The form of a noun for a number as it is shown (1.5 → "1½" → Czech `many`).
 * English uses the singular up to 1, so a fraction reads "½ lemon", not "½ lemons".
 */
export function pluralForm(locale: Locale, n: number, forms: Forms): string {
  const shown = Math.abs(n - Math.round(n)) < 0.06 ? Math.round(n) : n;
  const category = locale === 'en' ? (shown <= 1 ? 'one' : 'other') : new Intl.PluralRules(locale).select(shown);
  return forms[category as keyof Forms] ?? forms.other ?? forms.one;
}

const en = {
  siteDescription: 'A personal cookbook, shared with friends and family.',
  languageName: 'English',
  /** The link to the other language, in that language. */
  switchTo: 'Česky',
  skipToRecipes: 'Skip to recipes',
  skipToRecipe: 'Skip to recipe',
  appearance: 'Appearance',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeAuto: 'Auto',
  searchRecipes: 'Search recipes',
  clearText: 'Clear text',
  allRecipes: 'All recipes',
  /** Before and after the query, in the language's quotation marks. */
  noMatchBefore: 'No recipes match “',
  noMatchAfter: '”.',
  clearSearch: 'Clear search',
  recipeCount: { one: 'recipe', other: 'recipes' } as Forms,
  saved: 'Saved',
  save: 'Save',
  time: 'Time',
  yield: 'Yield',
  yields: 'Yields',
  cook: 'Cook',
  share: 'Share',
  ingredients: 'Ingredients',
  scaleRecipe: 'Scale recipe',
  scaleDown: 'Scale down',
  scaleUp: 'Scale up',
  equipment: 'Equipment',
  directions: 'Directions',
  tip: 'Tip:',
  notes: 'Notes',
  photo: 'Photo:',
  closeCook: 'Close cook mode',
  cookView: 'Cook mode view',
  timers: 'Timers',
  /** "2 of 5": the section counter in cook mode. */
  of: 'of',
  about: 'about',
  /** Before the timer's duration ("Start timer: 5 minutes"; Czech "Spustit minutku na 5 minut"). */
  startTimer: 'Start timer:',
  /** The default yield unit, when a recipe gives none. */
  servings: { one: 'serving', other: 'servings' } as Forms,
  /** Strings the recipe page's script needs; `{label}` and `{n}` are filled in by recipe.ts. */
  client: {
    savingUnavailable: 'Saving is not available in this browser',
    recipeSaved: 'Recipe saved',
    recipeUnsaved: 'Removed from saved recipes',
    linkCopied: 'Link copied',
    sharingUnavailable: 'Sharing is not available',
    timerDismissed: 'Timer dismissed',
    undo: 'Undo',
    undoDismiss: 'Undo dismiss timer: {label}',
    timerDismissedNamed: 'Timer dismissed: {label}',
    timerRestored: 'Timer restored: {label}',
    pauseTimer: 'Pause timer: {label}',
    resumeTimer: 'Resume timer: {label}',
    timerPaused: 'Timer paused: {label}',
    timerResumed: 'Timer resumed: {label}',
    silenceTimer: 'Silence timer: {label}',
    dismissTimer: 'Dismiss timer: {label}',
    timerStarted: 'Timer started: {label}',
    timerFinished: 'Timer finished: {label}',
    done: 'Done',
    doneAgo: 'Done {n}m ago',
  },
};

export type Strings = typeof en;
/** What recipe.ts gets from the page: the client strings plus the Save button's two labels. */
export type ClientStrings = Strings['client'] & Pick<Strings, 'save' | 'saved'>;

const cs: Strings = {
  siteDescription: 'Osobní kuchařka pro rodinu a přátele.',
  languageName: 'Čeština',
  switchTo: 'English',
  skipToRecipes: 'Přejít na recepty',
  skipToRecipe: 'Přejít na recept',
  appearance: 'Vzhled',
  themeLight: 'Světlý',
  themeDark: 'Tmavý',
  themeAuto: 'Auto',
  searchRecipes: 'Hledat recepty',
  clearText: 'Smazat text',
  allRecipes: 'Všechny recepty',
  noMatchBefore: 'Výrazu „',
  noMatchAfter: '“ neodpovídá žádný recept.',
  clearSearch: 'Zrušit hledání',
  recipeCount: { one: 'recept', few: 'recepty', many: 'receptu', other: 'receptů' },
  saved: 'Uloženo',
  save: 'Uložit',
  time: 'Čas',
  yield: 'Vydá na',
  yields: 'Vydá na',
  cook: 'Vařit',
  share: 'Sdílet',
  ingredients: 'Suroviny',
  scaleRecipe: 'Upravit množství',
  scaleDown: 'Méně',
  scaleUp: 'Více',
  equipment: 'Vybavení',
  directions: 'Postup',
  tip: 'Tip:',
  notes: 'Poznámky',
  photo: 'Foto:',
  closeCook: 'Zavřít režim vaření',
  cookView: 'Zobrazení režimu vaření',
  timers: 'Minutky',
  of: 'z',
  about: 'cca',
  startTimer: 'Spustit minutku na',
  servings: { one: 'porci', few: 'porce', many: 'porce', other: 'porcí' },
  client: {
    savingUnavailable: 'V tomto prohlížeči nejde ukládat',
    recipeSaved: 'Recept uložen',
    recipeUnsaved: 'Odebráno z uložených',
    linkCopied: 'Odkaz zkopírován',
    sharingUnavailable: 'Sdílení není k dispozici',
    timerDismissed: 'Minutka zrušena',
    undo: 'Vrátit',
    undoDismiss: 'Vrátit minutku: {label}',
    timerDismissedNamed: 'Minutka zrušena: {label}',
    timerRestored: 'Minutka obnovena: {label}',
    pauseTimer: 'Pozastavit minutku: {label}',
    resumeTimer: 'Pokračovat: {label}',
    timerPaused: 'Minutka pozastavena: {label}',
    timerResumed: 'Minutka běží dál: {label}',
    silenceTimer: 'Ztlumit minutku: {label}',
    dismissTimer: 'Zrušit minutku: {label}',
    timerStarted: 'Minutka spuštěna: {label}',
    timerFinished: 'Minutka doběhla: {label}',
    done: 'Hotovo',
    doneAgo: 'Hotovo před {n} min',
  },
};

const STRINGS: Record<Locale, Strings> = { cs, en };

export const strings = (locale: Locale): Strings => STRINGS[locale];

/** The other language: the site has two, so the switch is a single link. */
export const otherLocale = (locale: Locale): Locale => (locale === 'cs' ? 'en' : 'cs');

/** "/" for Czech, "/en" for English: the prefix of every path in that language (before sitePath adds the base). */
export const localePrefix = (locale: Locale): '' | `/${Locale}` => (locale === DEFAULT_LOCALE ? '' : `/${locale}`);

/** "{label} done" → "Pasta done". */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
