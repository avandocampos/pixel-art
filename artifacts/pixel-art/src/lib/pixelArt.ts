export interface PixelArtOptions {
  blockSize: number;
  paletteSize: number;
  enhanceContrast: number;
  brightness: number;
  dithering: boolean;
  customPalette?: [number, number, number][];
}

export const DEFAULT_OPTIONS: PixelArtOptions = {
  blockSize: 8,
  paletteSize: 32,
  enhanceContrast: 50,
  brightness: 0,
  dithering: false,
  customPalette: undefined,
};

// ─── Color space utilities ────────────────────────────────────────────────────

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rr = r / 255, gg = g / 255, bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;
  let x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  let y = (rr * 0.2126 + gg * 0.7152 + bb * 0.0722) / 1.00000;
  let z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// ─── Palette building (median cut in Lab space) ──────────────────────────────
//
// Splitting on perceptual (Lab) ranges instead of raw RGB produces palettes
// whose colors are more evenly spaced as the eye sees them — fewer near-duplicate
// dark tones, better coverage of mid-range hues.

interface Sample { rgb: [number, number, number]; lab: [number, number, number]; }

function medianCut(samples: Sample[], depth: number): [number, number, number][] {
  if (samples.length === 0) return [];
  if (depth === 0 || samples.length === 1) {
    // Representative = average color of the bucket (averaged in RGB).
    let r = 0, g = 0, b = 0;
    for (const s of samples) { r += s.rgb[0]; g += s.rgb[1]; b += s.rgb[2]; }
    const n = samples.length;
    return [[Math.round(r / n), Math.round(g / n), Math.round(b / n)]];
  }
  // Find the Lab channel with the widest spread and split there.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const s of samples) {
    for (let c = 0; c < 3; c++) {
      if (s.lab[c] < min[c]) min[c] = s.lab[c];
      if (s.lab[c] > max[c]) max[c] = s.lab[c];
    }
  }
  const range = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const ch = range[0] >= range[1] && range[0] >= range[2] ? 0 : range[1] >= range[2] ? 1 : 2;
  samples.sort((a, b) => a.lab[ch] - b.lab[ch]);
  const mid = Math.floor(samples.length / 2);
  return [
    ...medianCut(samples.slice(0, mid), depth - 1),
    ...medianCut(samples.slice(mid), depth - 1),
  ];
}

function buildPalette(imageData: ImageData, paletteSize: number): [number, number, number][] {
  const data = imageData.data;
  // Sample at most ~12 000 pixels, distributed evenly
  const step = Math.max(1, Math.floor(data.length / (4 * 12_000)));
  const samples: Sample[] = [];
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 128) continue;
    const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
    samples.push({ rgb, lab: rgbToLab(rgb[0], rgb[1], rgb[2]) });
  }
  // Use the exact depth that produces a palette at least as large as requested,
  // then trim to the requested size by merging the two closest entries.
  const depth = Math.ceil(Math.log2(Math.max(2, paletteSize)));
  let palette = medianCut(samples, depth);
  // Trim excess entries by collapsing the two perceptually closest colors
  while (palette.length > paletteSize) {
    let minD = Infinity, ai = 0, bi = 1;
    for (let i = 0; i < palette.length; i++) {
      for (let j = i + 1; j < palette.length; j++) {
        const [la, aa, ba] = rgbToLab(...palette[i]);
        const [lb, ab, bb] = rgbToLab(...palette[j]);
        const d = (la - lb) ** 2 + (aa - ab) ** 2 + (ba - bb) ** 2;
        if (d < minD) { minD = d; ai = i; bi = j; }
      }
    }
    // Replace the two entries with their average
    const merged: [number, number, number] = [
      Math.round((palette[ai][0] + palette[bi][0]) / 2),
      Math.round((palette[ai][1] + palette[bi][1]) / 2),
      Math.round((palette[ai][2] + palette[bi][2]) / 2),
    ];
    palette = palette.filter((_, i) => i !== ai && i !== bi);
    palette.push(merged);
  }
  return palette;
}

// ─── Palette lookup (pre-computed Lab, squared distance for speed) ────────────

/**
 * Finds the index of the nearest palette color to (r,g,b) using pre-computed
 * Lab values. Uses squared CIELab distance — no sqrt needed for comparison.
 */
function nearestIndex(
  l: number, a: number, bv: number,
  paletteLab: [number, number, number][]
): number {
  let minD = Infinity, best = 0;
  for (let i = 0; i < paletteLab.length; i++) {
    const [pl, pa, pb] = paletteLab[i];
    const d = (l - pl) ** 2 + (a - pa) ** 2 + (bv - pb) ** 2;
    if (d < minD) { minD = d; best = i; }
  }
  return best;
}

// ─── Contrast enhancement (stronger curve for visible impact) ───────────────

function enhanceContrastSCurve(v: number, strength: number): number {
  const normalized = v / 255;
  const curve = normalized < 0.5
    ? Math.pow(normalized * 2, 1.35) / 2
    : 1 - (Math.pow((1 - normalized) * 2, 1.35) / 2);
  const t = strength / 100;
  const mixed = normalized * (1 - t) + curve * t;
  const boosted = mixed > 0.5
    ? 0.5 + (mixed - 0.5) * (1 + t * 0.6)
    : 0.5 - (0.5 - mixed) * (1 + t * 0.6);
  return Math.min(255, Math.max(0, boosted * 255));
}

// 4×4 Bayer matrix for ordered dithering (values 0..15).
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ─── Main conversion ──────────────────────────────────────────────────────────

export function convertToPixelArt(
  sourceCanvas: HTMLCanvasElement,
  options: PixelArtOptions
): HTMLCanvasElement {
  const { blockSize, paletteSize, enhanceContrast, brightness, dithering, customPalette } = options;

  const srcCtx = sourceCanvas.getContext("2d")!;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const numBlocks = blocksX * blocksY;

  // ── Palette (custom or auto-built) ────────────────────────────────────────
  const palette: [number, number, number][] =
    customPalette && customPalette.length > 0
      ? customPalette
      : buildPalette(imageData, paletteSize);

  // Pre-compute Lab values for every palette entry (avoid repeating in each block)
  const paletteLab: [number, number, number][] = palette.map(([r, g, b]) => rgbToLab(r, g, b));

  // ── Phase 1: block averages ───────────────────────────────────────────────
  const bR = new Float32Array(numBlocks);
  const bG = new Float32Array(numBlocks);
  const bB = new Float32Array(numBlocks);
  const bTransparent = new Uint8Array(numBlocks); // 1 = block is fully transparent

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const bi = by * blocksX + bx;
      const x0 = bx * blockSize, y0 = by * blockSize;
      const x1 = Math.min(x0 + blockSize, width);
      const y1 = Math.min(y0 + blockSize, height);

      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * width + x;
          const pIdx = idx * 4;
          if (data[pIdx + 3] < 128) continue;
          sumR += data[pIdx]; sumG += data[pIdx + 1]; sumB += data[pIdx + 2];
          count++;
        }
      }
      if (count === 0) { bTransparent[bi] = 1; continue; }
      bR[bi] = sumR / count;
      bG[bi] = sumG / count;
      bB[bi] = sumB / count;
    }
  }

  // ── Phase 2: contrast enhancement (smooth S-curve) ────────────────────────
  if (enhanceContrast > 0) {
    for (let i = 0; i < numBlocks; i++) {
      bR[i] = enhanceContrastSCurve(bR[i], enhanceContrast);
      bG[i] = enhanceContrastSCurve(bG[i], enhanceContrast);
      bB[i] = enhanceContrastSCurve(bB[i], enhanceContrast);
    }
  }

  // ── Phase 2b: brightness adjustment ─────────────────────────────────────────
  if (brightness !== 0) {
    const shift = (brightness / 100) * 128;
    for (let i = 0; i < numBlocks; i++) {
      bR[i] = Math.min(255, Math.max(0, bR[i] + shift));
      bG[i] = Math.min(255, Math.max(0, bG[i] + shift));
      bB[i] = Math.min(255, Math.max(0, bB[i] + shift));
    }
  }

  // ── Phase 3: quantization to palette ──────────────────────────────────────
  // Optional ordered (Bayer) dithering nudges each block's color by a fixed,
  // position-dependent offset before the nearest-color lookup. Because the
  // offset is deterministic per block (not propagated like error diffusion) it
  // smooths gradients without smearing color across the image.
  const outPalIdx = new Uint16Array(numBlocks);
  const ditherAmp = dithering ? Math.min(60, Math.max(10, (255 / paletteSize) * 1.2)) : 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const i = by * blocksX + bx;
      if (bTransparent[i]) continue; // preserve transparency
      let r = bR[i], g = bG[i], b = bB[i];
      if (ditherAmp > 0) {
        const t = (BAYER4[(by & 3) * 4 + (bx & 3)] / 15 - 0.5) * ditherAmp;
        r = Math.min(255, Math.max(0, r + t));
        g = Math.min(255, Math.max(0, g + t));
        b = Math.min(255, Math.max(0, b + t));
      }
      const [l, a, bv] = rgbToLab(r, g, b);
      outPalIdx[i] = nearestIndex(l, a, bv, paletteLab);
    }
  }

  // ── Phase 4: render ───────────────────────────────────────────────────────
  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d")!;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const bi = by * blocksX + bx;

      // Skip fully transparent blocks — leave canvas pixel transparent
      if (bTransparent[bi]) continue;

      const [r, g, b] = palette[outPalIdx[bi]];

      outCtx.fillStyle = `rgb(${r},${g},${b})`;
      outCtx.fillRect(
        bx * blockSize, by * blockSize,
        Math.min(blockSize, width - bx * blockSize),
        Math.min(blockSize, height - by * blockSize)
      );
    }
  }

  return outCanvas;
}
