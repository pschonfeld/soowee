import sharp from 'sharp';

/**
 * Derives the hero backdrop from the recipe photo: its dominant hue,
 * darkened so white text always clears WCAG AA (≥ 7:1 in practice).
 */
export interface Tint {
  base: string;
  deep: string;
}

const FALLBACK: Tint = { base: '#4a3b2f', deep: '#2e241c' };

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function fromRgb(r: number, g: number, b: number): Tint {
  const [h, s] = rgbToHsl(r, g, b);
  const sat = s < 0.12 ? s : Math.min(0.7, Math.max(0.42, s));
  return { base: hslToHex(h, sat, 0.25), deep: hslToHex(h, sat, 0.16) };
}

export async function tintFor(image: { fsPath?: string }, override?: string): Promise<Tint> {
  if (override) {
    const n = parseInt(override.slice(1), 16);
    return fromRgb(n >> 16, (n >> 8) & 255, n & 255);
  }
  if (!image.fsPath) return FALLBACK;

  // Average hue of the photo, weighted towards vivid pixels, so the backdrop
  // picks up the food rather than a grey plate or a dark table.
  const { data } = await sharp(image.fsPath)
    .resize(64, 64, { fit: 'cover' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x = 0;
  let y = 0;
  let satSum = 0;
  let weightSum = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const weight = s * s * (1 - Math.abs(2 * l - 1));
    x += Math.cos((h * Math.PI) / 180) * weight;
    y += Math.sin((h * Math.PI) / 180) * weight;
    satSum += s * weight;
    weightSum += weight;
  }
  if (weightSum < 1) return FALLBACK;
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const sat = Math.min(0.7, Math.max(0.42, satSum / weightSum));
  return { base: hslToHex(hue, sat, 0.25), deep: hslToHex(hue, sat, 0.16) };
}
