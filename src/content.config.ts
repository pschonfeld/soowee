import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { UNITS } from './lib/format';
import type { Locale } from './lib/i18n';
import { directionTimes, plainText } from './lib/inline';
import { checkMentions } from './lib/mentions';

/**
 * A recipe is one Markdown file per language, `recipes/<locale>/<id>.md`, with the same id in each: structured data in the frontmatter
 * (so it can be scaled, timed and exported as JSON-LD), free-form notes
 * in the Markdown body. docs/recipe-model.md explains every field.
 *
 * Inline markup allowed in `heat`, steps and tips:
 *   **bold**                      – ingredient mentions
 *   {timer:20m} {timer:5-10m}     – tappable timer; the label ("5–10 minutes") is generated so wording
 *                                   stays consistent, and a range rings at its lower bound (time to check)
 *   {simmer:1h} {bake:30m} …      – hands-off time while cooking: a timer too, part of time.total but subtracted
 *                                   from it to get the work time (list: HANDS_OFF in lib/inline.ts)
 *   {rest:1h} {rise:2h} …         – a wait the cook can walk away from: a timer, NOT part of time.total, shown
 *                                   after it in the hero ("+ 1 hr resting") (list: WAITS in lib/inline.ts)
 *   {chill:6h} {freeze:4h}        – a wait in the fridge/freezer, at least this long; plain text, not a timer,
 *                                   NOT part of time.total
 *   {25 g} or {2}                 – an amount used in this step, not linked to an ingredient; scales with the recipe
 *   {750 g mascarpone} {6 eggs}   – an ingredient measured out here: the amount scales, the name is bold
 *   {cocoa powder}                – an ingredient used here, without an amount
 * Mentions must name an ingredient, every ingredient must be mentioned, and measured amounts must add up to the
 * list (lib/mentions.ts).
 */
/**
 * The other forms of a noun, for the number in front of it (CLDR plural categories, as Intl.PluralRules names
 * them). The noun itself is the form for 1. English needs `other` ("lemons"); Czech `few` (2–4: "citrony"),
 * `many` (fractions: "½ citronu") and `other` (5 and more: "citronů").
 */
const plural = z.strictObject({
  few: z.string().trim().min(1).optional(),
  many: z.string().trim().min(1).optional(),
  other: z.string().trim().min(1),
});

type Plural = z.infer<typeof plural>;

/** The plural categories each language needs besides `one`. */
const PLURAL_CATEGORIES: Record<Locale, (keyof Plural)[]> = {
  en: ['other'],
  cs: ['few', 'many', 'other'],
};

const ingredient = z.strictObject({
  qty: z.number().positive().optional(),
  unit: z.enum(UNITS).optional(),
  /**
   * What you shop for, name first: "onion", "butter", "mozzarella fior di latte". Written as it reads after the
   * amount: the form for 1 when counted ("lemon", Czech "citron"), and in Czech the genitive after a unit
   * ("35 g másla").
   */
  name: z.string(),
  /** The name's forms for other numbers; required when the ingredient is counted in pieces (a qty, no unit). */
  plural: plural.optional(),
  /**
   * Approximate weight or volume for things counted in pieces: "1 onion (about 150 g)", "36 Savoiardi (about 300 g)".
   * Kept out of `note` so it scales with the recipe.
   */
  about: z
    .strictObject({ qty: z.number().positive(), max: z.number().positive().optional(), unit: z.enum(UNITS) })
    .refine((a) => a.max === undefined || a.max > a.qty, { message: '`about.max` must be larger than `about.qty`' })
    .optional(),
  /** Size, cut or kind, shown after the name in a lighter tone: "medium, diced into small cubes". */
  note: z.string().optional(),
});

const paragraph = z.union([z.string(), z.strictObject({ tip: z.string() })]);

const recipes = (locale: Locale) =>
  defineCollection({
    loader: glob({ pattern: '*.md', base: `./src/content/recipes/${locale}` }),
    schema: ({ image }) =>
      z
        .strictObject({
          title: z.string(),
          description: z.string(),
          featured: z.boolean().default(false),
          cuisine: z.string().optional(),
          byline: z.string().optional(),
          image: image(),
          imageAlt: z.string(),
          imageCredit: z
            .strictObject({
              author: z.string(),
              license: z.string(),
              url: z.url(),
            })
            .optional(),
          /** Optional override for the hero colour, otherwise derived from the photo. */
          tint: z
            .string()
            .regex(/^#[0-9a-f]{6}$/i)
            .optional(),
          source: z
            .strictObject({
              label: z.string(),
              title: z.string(),
              url: z.url().optional(),
            })
            .optional(),
          yield: z.strictObject({
            min: z.number().positive(),
            max: z.number().positive().optional(),
            /** What is counted, in the form for 1 ("crêpe", "palačinka"); servings when left out. */
            unit: z.string().optional(),
            /** The unit's forms for other numbers; required with `unit`. */
            plural: plural.optional(),
          }),
          /** Cooking time in minutes: includes hands-off time ({simmer:…}), excludes waits ({rest:…}, {chill:…} …). */
          time: z.strictObject({
            total: z.number().int().positive(),
          }),
          ingredients: z
            .array(z.strictObject({ group: z.string().optional(), items: z.array(ingredient).min(1) }))
            .min(1),
          /**
           * What the recipe needs beyond the basics, in the order of first use: a name, or a name and its size or
           * spec ("Crêpe pan" + "⌀ 28 cm"), shown after the name in a lighter tone, like an ingredient's note.
           */
          equipment: z.array(z.union([z.string(), z.strictObject({ name: z.string(), note: z.string() })])).default([]),
          /**
           * The method, in sections: a section is a phase with a title ("Make the béchamel"), a step is one action that
           * ends in a state the cook can check. Cook mode stops on `heat` and on each step; a tip belongs to the step
           * before it, so a section starts with a step.
           */
          directions: z
            .array(
              z.strictObject({
                title: z.string(),
                /** Oven or oil to get hot: shown first and highlighted, so it is started in time. */
                heat: z.string().optional(),
                steps: z
                  .array(paragraph)
                  .min(1)
                  .refine((steps) => typeof steps[0] === 'string', {
                    message: 'A section starts with a step, not a tip: a tip belongs to the step before it',
                    path: [0],
                  }),
              }),
            )
            .min(1),
        })
        // Reported against the recipe file at validation time, not while rendering the page.
        .superRefine((r, ctx) => {
          // Every piece of method text: unknown tokens, malformed durations and units are reported with their path.
          let valid = true;
          r.directions.forEach((section, i) => {
            const texts: [string, (string | number)[]][] = section.heat !== undefined ? [[section.heat, ['heat']]] : [];
            section.steps.forEach((p, j) =>
              texts.push(typeof p === 'string' ? [p, ['steps', j]] : [p.tip, ['steps', j, 'tip']]),
            );
            for (const [text, path] of texts) {
              try {
                plainText(text, locale);
              } catch (error) {
                valid = false;
                ctx.addIssue({ code: 'custom', path: ['directions', i, ...path], message: (error as Error).message });
              }
            }
          });
          // Section titles name the timers ("Make the béchamel, 5 minutes"), so two equal ones could not be told apart.
          const titles = new Set<string>();
          r.directions.forEach((section, i) => {
            if (titles.has(section.title)) {
              ctx.addIssue({
                code: 'custom',
                path: ['directions', i, 'title'],
                message: `Another section is already called "${section.title}"`,
              });
            }
            titles.add(section.title);
          });
          // A counted noun needs its forms for every number the language distinguishes, or scaling would print
          // "2 lemon"; nothing else has forms to need.
          const needs = PLURAL_CATEGORIES[locale];
          const checkForms = (
            given: Plural | undefined,
            counted: boolean,
            path: (string | number)[],
            what: string,
          ) => {
            const missing = needs.filter((category) => !given?.[category]);
            if (counted && missing.length) {
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'plural'],
                message: `${what} is counted, so it needs \`plural\` with ${missing.join(', ')} (${locale})`,
              });
            }
            if (!counted && given)
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'plural'],
                message: `${what} is not counted, so it has no \`plural\``,
              });
            const extra = Object.keys(given ?? {}).filter((category) => !(needs as string[]).includes(category));
            if (extra.length)
              ctx.addIssue({
                code: 'custom',
                path: [...path, 'plural'],
                message: `${locale} has no ${extra.join(', ')} form`,
              });
          };
          r.ingredients.forEach((group, g) =>
            group.items.forEach((item, k) =>
              checkForms(
                item.plural,
                item.qty !== undefined && item.unit === undefined,
                ['ingredients', g, 'items', k],
                `"${item.name}"`,
              ),
            ),
          );
          checkForms(r.yield.plural, r.yield.unit !== undefined, ['yield'], 'The yield unit');
          if (!valid) return;
          for (const issue of checkMentions(r)) ctx.addIssue({ code: 'custom', ...issue });
          const { handsOff } = directionTimes(r.directions);
          if (r.time.total - handsOff <= 0) {
            ctx.addIssue({
              code: 'custom',
              path: ['time', 'total'],
              message: `Hands-off time ({simmer:…}, {bake:…} …) adds up to ${handsOff} min, but time.total is ${r.time.total} min`,
            });
          }
        }),
  });

/** One collection per language, so the schema knows the language it validates (plural forms). */
export const collections = { recipes_cs: recipes('cs'), recipes_en: recipes('en') };
