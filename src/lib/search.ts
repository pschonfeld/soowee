/**
 * Home page search, shared by the build (which writes each recipe's words into `data-search`) and the browser.
 * Matching is by the start of words, so "masc" finds mascarpone but "oil" does not find "boil".
 */

/** Lowercase, without accents: "Crêpes" → "crepes". */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** Normalized words of a text: "Fish & Chips" → ["fish", "chips"]. */
export function words(text: string): string[] {
  return normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The searchable words of a recipe, space-separated and without repeats, for `data-search`. */
export function haystack(parts: readonly (string | undefined)[]): string {
  return [...new Set(words(parts.filter(Boolean).join(' ')))].join(' ');
}

/** True when every word of the query starts some word of the haystack. An empty query matches everything. */
export function matches(haystackWords: readonly string[], query: string): boolean {
  return words(query).every((q) => haystackWords.some((w) => w.startsWith(q)));
}
