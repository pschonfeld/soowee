import { localePrefix, type Locale } from './i18n';

/**
 * A path inside the site, with the base path the site is served under: `/lasagna/` becomes `/soowee/lasagna/` on
 * GitHub Pages and stays `/lasagna/` locally. Every internal link and file in /public goes through this.
 */
export const sitePath = (path: `/${string}`) => import.meta.env.BASE_URL.replace(/\/$/, '') + path;

/** A page in a language: `/lasagna/` is `/lasagna/` in Czech and `/en/lasagna/` in English, then through sitePath. */
export const localePath = (locale: Locale, path: `/${string}`) => sitePath(`${localePrefix(locale)}${path}`);
