import sharp from 'sharp';
import { hslToHex, weightedHueSat, type LocalImage } from './tint';

/**
 * Hero and cook-mode backdrop, after Apple's background extension effect:
 * the photo continues past its edge as a mirrored, heavily blurred copy of itself,
 * so every recipe gets the colours of its own dish instead of one flat tint.
 *
 * Built once per recipe: a tiny blurred copy of the photo (inlined as a data URI,
 * mirrored in CSS) plus the darkest scrim that still keeps every text style on it
 * at WCAG AA. Axe cannot check text over images, so this is where contrast is enforced.
 */
export interface Backdrop {
  /** Blurred photo as a data URI, a few kB. */
  image: string;
  /** Colour shown past the end of the mirrored copy (the photo's top edge, blurred). */
  edge: string;
  /** Black overlay opacity under hero text. */
  scrim: number;
  /** Black overlay opacity in cook mode, where inactive lines are dimmed further. */
  cookScrim: number;
  /** A light tint of the photo's own hue for the eyebrow/byline, when it reads at WCAG AA; otherwise unset. */
  accent?: string;
}

const WIDTH = 200;
const BLUR_SIGMA = 12;

/** Text styles on the backdrop: [white opacity, minimum contrast, glass fill under it]. */
const HERO_TEXT: [number, number, number][] = [
  [1, 4.5, 0], // title, values
  [0.78, 4.5, 0], // labels, byline (and the eyebrow/byline accent-colour fallback)
  [1, 4.5, 0.12], // button and card labels on glass (--glass-fill)
  [0.85, 4.5, 0.12], // card eyebrow on glass
];
const COOK_TEXT: [number, number, number][] = [
  ...HERO_TEXT,
  [0.58, 3, 0], // inactive cook-mode steps: large text (≥ 26 px)
  [1, 4.5, 0.24], // selected segment of the Ingredients / Directions control (--glass-selected)
];

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (r: number, g: number, b: number) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Browsers composite in sRGB, so blending is done on the 0–255 channel values. */
const over = (channel: number, white: number) => channel * (1 - white) + 255 * white;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Smallest scrim (in steps of 0.05) under which every text style passes on the brightest backdrop pixel. */
function scrimFor(brightest: [number, number, number], styles: [number, number, number][]): number {
  for (let scrim = 0.1; scrim <= 0.9 + 1e-9; scrim += 0.05) {
    const bg = brightest.map((c) => c * (1 - scrim)) as [number, number, number];
    const passes = styles.every(([text, min, glass]) => {
      const surface = bg.map((c) => over(c, glass)) as [number, number, number];
      const fg = surface.map((c) => over(c, text)) as [number, number, number];
      return contrast(luminance(...fg), luminance(...surface)) >= min;
    });
    if (passes) return Math.round(scrim * 100) / 100;
  }
  throw new Error('Backdrop is too bright for white text even under a 90% scrim');
}

export async function backdropFor(image: LocalImage): Promise<Backdrop | undefined> {
  if (!image.fsPath) return undefined;

  const blurred = sharp(image.fsPath)
    .rotate() // honour EXIF orientation, as Astro does for the photo itself
    .resize({ width: WIDTH })
    .removeAlpha()
    .toColourspace('srgb')
    .blur(BLUR_SIGMA)
    .modulate({ saturation: 1.15 });

  const [file, { data, info }] = await Promise.all([
    blurred.clone().webp({ quality: 60 }).toBuffer(),
    blurred.clone().raw().toBuffer({ resolveWithObject: true }),
  ]);

  // Same low-res sample used for the brightest pixel below, re-used instead of a second sharp pass.
  const hueSat = weightedHueSat(data);

  // Brightest pixel the text could sit on, and the photo's top edge (where the mirror ends) for the edge colour.
  let brightest: [number, number, number] = [0, 0, 0];
  let brightestLum = -1;
  const edge = [0, 0, 0];
  const edgeRows = 2;
  for (let i = 0; i < data.length; i += 3) {
    const pixel: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
    const lum = luminance(...pixel);
    if (lum > brightestLum) [brightest, brightestLum] = [pixel, lum];
    if (i / 3 < edgeRows * info.width) pixel.forEach((c, k) => (edge[k] += c));
  }
  const hex = edge
    .map((sum) => Math.round(sum / (edgeRows * info.width)).toString(16).padStart(2, '0'))
    .join('');

  const scrim = scrimFor(brightest, HERO_TEXT);

  // A light tint of the photo's hue, checked against the same scrim already picked for everything
  // else: eyebrow/byline sit straight on the backdrop (no glass), so this is a plain-text contrast
  // check against the worst-case (brightest) pixel, darkened by that scrim. Soft-fails to the
  // existing var(--on-tint-secondary) white when the photo's hue can't clear 4.5:1 there.
  let accent: string | undefined;
  if (hueSat) {
    const candidate = hslToHex(hueSat.hue, Math.min(0.55, hueSat.sat + 0.1), 0.84);
    const darkened = brightest.map((c) => c * (1 - scrim)) as [number, number, number];
    if (contrast(luminance(...hexToRgb(candidate)), luminance(...darkened)) >= 4.5) accent = candidate;
  }

  return {
    image: `data:image/webp;base64,${file.toString('base64')}`,
    edge: `#${hex}`,
    scrim,
    cookScrim: scrimFor(brightest, COOK_TEXT),
    accent,
  };
}
