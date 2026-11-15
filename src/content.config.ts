import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { UNITS } from './lib/format';
import { plainText, stepTimes } from './lib/inline';

/**
 * A recipe is one Markdown file: structured data in the frontmatter
 * (so it can be scaled, timed and exported as JSON-LD), free-form notes
 * in the Markdown body. docs/recipe-model.md explains every field.
 *
 * Inline markup allowed in step text:
 *   **bold**                      – ingredient mentions
 *   {timer:20m} {timer:5-10m}     – tappable timer; the label ("5–10 minutes") is generated so wording
 *                                   stays consistent, and a range rings at its lower bound (time to check)
 *   {simmer:1h} {bake:30m} …      – hands-off time: a timer too, but subtracted from the total to get the
 *                                   work time and named in the time summary (list: HANDS_OFF in lib/inline.ts)
 *   {chill:6h} {freeze:4h}        – minimum time in the fridge/freezer after the dish is finished; plain text,
 *                                   not a timer, and NOT part of time.total (named in the Directions sentence)
 *   {25 g} or {2}                 – an amount used in this step; scales with the recipe
 */
const ingredient = z.strictObject({
  qty: z.number().positive().optional(),
  unit: z.enum(UNITS).optional(),
  /** What you shop for, name first: "onion", "butter", "mozzarella fior di latte". */
  name: z.string(),
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

const recipes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/recipes' }),
  schema: ({ image }) =>
    z.strictObject({
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
      tint: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
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
        unit: z.string().default('servings'),
      }),
      /** Minutes, start to finish: includes hands-off time ({simmer:…}), excludes {chill:…}/{freeze:…}. */
      time: z.strictObject({
        total: z.number().int().positive(),
      }),
      ingredients: z
        .array(z.strictObject({ group: z.string().optional(), items: z.array(ingredient).min(1) }))
        .min(1),
      equipment: z.array(z.string()).default([]),
      steps: z
        .array(
          z
            .strictObject({
              title: z.string().optional(),
              /** Oven or oil to get hot: shown first and highlighted, so it is started in time. */
              heat: z.string().optional(),
              text: z.array(paragraph).min(1),
            })
            // Cook mode scrolls/highlights by step using its non-tip lines (`heat` plus string `text`
            // entries) as anchors; a step made only of `tip:` paragraphs would have none to land on.
            .refine((step) => step.heat !== undefined || step.text.some((p) => typeof p === 'string'), {
              message: 'A step needs a `heat` line or at least one non-tip `text` entry to anchor cook mode on',
            }),
        )
        .min(1),
    })
      // Reported against the recipe file at validation time, not while rendering the page.
      .superRefine((r, ctx) => {
        // Every piece of step text: unknown tokens, malformed durations and units are reported with their path.
        let valid = true;
        r.steps.forEach((step, i) => {
          const texts: [string, (string | number)[]][] = step.heat !== undefined ? [[step.heat, ['heat']]] : [];
          step.text.forEach((p, j) => texts.push(typeof p === 'string' ? [p, ['text', j]] : [p.tip, ['text', j, 'tip']]));
          for (const [text, path] of texts) {
            try {
              plainText(text);
            } catch (error) {
              valid = false;
              ctx.addIssue({ code: 'custom', path: ['steps', i, ...path], message: (error as Error).message });
            }
          }
        });
        if (!valid) return;
        const { handsOff } = stepTimes(r.steps);
        if (r.time.total - handsOff <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['time', 'total'],
            message: `Hands-off time ({simmer:…}, {bake:…} …) adds up to ${handsOff} min, but time.total is ${r.time.total} min`,
          });
        }
      }),
});

export const collections = { recipes };
