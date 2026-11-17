/**
 * The recipes of one language, for pages. Loading also checks that every recipe exists in both languages and that
 * the two tell the same recipe (lib/pairs.ts), so a missing or drifting translation fails the build.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { LOCALES, type Locale } from './i18n';
import { comparePair, missingTranslations } from './pairs';

export type RecipeEntry = CollectionEntry<'recipes_cs'> | CollectionEntry<'recipes_en'>;

/** Loaded and checked once per build; in `astro dev` on every call, so an edited recipe is checked again. */
let checked: Promise<Record<Locale, RecipeEntry[]>> | undefined;

async function load(): Promise<Record<Locale, RecipeEntry[]>> {
  const [cs, en] = await Promise.all([getCollection('recipes_cs'), getCollection('recipes_en')]);
  const all: Record<Locale, RecipeEntry[]> = { cs, en };
  const problems: string[] = [];
  problems.push(...missingTranslations({ cs: cs.map((r) => r.id), en: en.map((r) => r.id) }));
  for (const entry of all.cs) {
    const other = all.en.find((e) => e.id === entry.id);
    if (!other) continue;
    const differences = comparePair(entry.data, other.data, [entry.body ?? '', other.body ?? '']);
    if (differences.length) problems.push(`${entry.id} (cs ≠ en):\n  ${differences.join('\n  ')}`);
  }
  for (const locale of LOCALES) {
    const featured = all[locale].filter((r) => r.data.featured);
    if (featured.length > 1) problems.push(`Only one recipe can be featured; found ${featured.map((r) => r.id).join(', ')} (${locale})`);
  }
  if (problems.length) throw new Error(`The recipes are not consistent:\n${problems.join('\n')}`);
  return all;
}

/** The recipes in a language, sorted by title as that language sorts ("ch" after "h" in Czech). */
export async function getRecipes(locale: Locale): Promise<RecipeEntry[]> {
  const all = import.meta.env.PROD ? (checked ??= load()) : load();
  return [...(await all)[locale]].sort((a, b) => a.data.title.localeCompare(b.data.title, locale));
}
