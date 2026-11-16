import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { UNITS } from './lib/format';
import { directionTimes, plainText } from './lib/inline';
import { checkMentions } from './lib/mentions';

/**
 * A recipe is one Markdown file: structured data in the frontmatter
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
      /** Cooking time in minutes: includes hands-off time ({simmer:…}), excludes waits ({rest:…}, {chill:…} …). */
      time: z.strictObject({
        total: z.number().int().positive(),
      }),
      ingredients: z
        .array(z.strictObject({ group: z.string().optional(), items: z.array(ingredient).min(1) }))
        .min(1),
      equipment: z.array(z.string()).default([]),
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
          section.steps.forEach((p, j) => texts.push(typeof p === 'string' ? [p, ['steps', j]] : [p.tip, ['steps', j, 'tip']]));
          for (const [text, path] of texts) {
            try {
              plainText(text);
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
            ctx.addIssue({ code: 'custom', path: ['directions', i, 'title'], message: `Another section is already called "${section.title}"` });
          }
          titles.add(section.title);
        });
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

export const collections = { recipes };
