import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { UNITS } from './lib/format';
import { totalWaitMinutes } from './lib/inline';

/**
 * A recipe is one Markdown file: structured data in the frontmatter
 * (so it can be scaled, timed and exported as JSON-LD), free-form notes
 * in the Markdown body.
 *
 * Inline markup allowed in step text:
 *   **bold**                      – ingredient mentions
 *   {wait:1h}                     – same as a timer, but hands-off: it is subtracted from the total
 *                                   to show the cook how much of the time is active work
 *   {timer:20m} {timer:5-10m}     – tappable timer; the label ("5–10 minutes") is generated so wording
 *                                   stays consistent, and a range rings at its lower bound (time to check)
 *   {25 g} or {2}                 – an amount used in this step; scales with the recipe
 */
const ingredient = z.object({
  qty: z.number().positive().optional(),
  unit: z.enum(UNITS).optional(),
  /** What you shop for, name first: "onion", "butter", "mozzarella fior di latte". */
  name: z.string(),
  /** Size, cut or kind, shown after the name in a lighter tone: "medium, diced into small cubes". */
  note: z.string().optional(),
});

const paragraph = z.union([z.string(), z.object({ tip: z.string() })]);

const recipes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/recipes' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      featured: z.boolean().default(false),
      cuisine: z.string().optional(),
      byline: z.string().optional(),
      image: image(),
      imageAlt: z.string(),
      imageCredit: z
        .object({
          author: z.string(),
          license: z.string(),
          url: z.url(),
        })
        .optional(),
      /** Optional override for the hero colour, otherwise derived from the photo. */
      tint: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      source: z
        .object({
          label: z.string(),
          title: z.string(),
          url: z.url().optional(),
        })
        .optional(),
      yield: z.object({
        min: z.number().positive(),
        max: z.number().positive().optional(),
        unit: z.string().default('servings'),
      }),
      /** Minutes. */
      time: z.object({
        prep: z.number().int().positive().optional(),
        cook: z.number().int().positive().optional(),
        total: z.number().int().positive(),
      }),
      ingredients: z
        .array(z.object({ group: z.string().optional(), items: z.array(ingredient).min(1) }))
        .min(1),
      equipment: z.array(z.string()).default([]),
      steps: z
        .array(
          z.object({
            title: z.string().optional(),
            /** Oven or oil to get hot: shown first and highlighted, so it is started in time. */
            heat: z.string().optional(),
            text: z.array(paragraph).min(1),
          }),
        )
        .min(1),
    })
      // Reported against the recipe file at validation time, not while rendering the page.
      .superRefine((r, ctx) => {
        const wait = totalWaitMinutes(r.steps);
        if (r.time.total - wait <= 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['time', 'total'],
            message: `{wait:…} timers add up to ${wait} min, but time.total is ${r.time.total} min`,
          });
        }
      }),
});

export const collections = { recipes };
