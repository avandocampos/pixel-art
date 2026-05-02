export interface PixelArtOptions {
  blockSize: number;
  paletteSize: number;
  edgeStrength: number;
  enhanceContrast: boolean;
  outlineEdges: boolean;
  outlineColor: string;
}

export const DEFAULT_OPTIONS: PixelArtOptions = {
  blockSize: 8,
  paletteSize: 32,
  edgeStrength: 0.4,
  enhanceContrast: true,
  outlineEdges: true,
  outlineColor: "#000000",
};

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

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const [l1, a1, b1l] = rgbToLab(r1, g1, b1);
  const [l2, a2, b2l] = rgbToLab(r2, g2, b2);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1l - b2l) ** 2);
}

function buildPalette(
  imageData: ImageData,
  paletteSize: number
): [number, number, number][] {
  const data = imageData.data;
  const step = Math.max(1, Math.floor(data.length / (paletteSize * 400)));
  const samples: [number, number, number][] = [];

  for (let i = 0; i < data.length; i += 4 * step) {
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  const palette: [number, number, number][] = [];
  const used = new Set<number>();

  const firstIdx = Math.floor(Math.random() * samples.length);
  palette.push(samples[firstIdx]);
  used.add(firstIdx);

  while (palette.length < paletteSize && palette.length < samples.length) {
    let maxDist = -1;
    let bestIdx = 0;

    for (let i = 0; i < samples.length; i++) {
      if (used.has(i)) continue;
      const [r, g, b] = samples[i];
      let minDist = Infinity;
      for (const [pr, pg, pb] of palette) {
        const d = colorDistance(r, g, b, pr, pg, pb);
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist) {
        maxDist = minDist;
        bestIdx = i;
      }
    }

    palette.push(samples[bestIdx]);
    used.add(bestIdx);
  }

  return palette;
}

function nearestPaletteColor(
  r: number, g: number, b: number,
  palette: [number, number, number][]
): [number, number, number] {
  let minDist = Infinity;
  let best = palette[0];
  for (const color of palette) {
    const d = colorDistance(r, g, b, color[0], color[1], color[2]);
    if (d < minDist) {
      minDist = d;
      best = color;
    }
  }
  return best;
}

function applySobel(gray: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const val = gray[(y + dy) * width + (x + dx)];
          gx += val * kernelX[k];
          gy += val * kernelY[k];
          k++;
        }
      }
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  let maxEdge = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxEdge) maxEdge = edges[i];
  }
  if (maxEdge > 0) {
    for (let i = 0; i < edges.length; i++) {
      edges[i] /= maxEdge;
    }
  }

  return edges;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function convertToPixelArt(
  sourceCanvas: HTMLCanvasElement,
  options: PixelArtOptions
): HTMLCanvasElement {
  const { blockSize, paletteSize, edgeStrength, enhanceContrast, outlineEdges, outlineColor } = options;

  const srcCtx = sourceCanvas.getContext("2d")!;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const edges = applySobel(gray, width, height);

  const palette = buildPalette(imageData, paletteSize);

  const outCanvas = document.createElement("canvas");
  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  outCanvas.width = blocksX * blockSize;
  outCanvas.height = blocksY * blockSize;
  const outCtx = outCanvas.getContext("2d")!;

  const [orR, orG, orB] = hexToRgb(outlineColor);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const startX = bx * blockSize;
      const startY = by * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      let totalR = 0, totalG = 0, totalB = 0;
      let count = 0;
      let maxEdgeVal = 0;
      let edgeSumR = 0, edgeSumG = 0, edgeSumB = 0, edgeCount = 0;

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = y * width + x;
          const pIdx = idx * 4;
          const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
          const edgeVal = edges[idx];

          totalR += r; totalG += g; totalB += b;
          count++;

          if (edgeVal > maxEdgeVal) maxEdgeVal = edgeVal;

          if (edgeVal > edgeStrength) {
            edgeSumR += r; edgeSumG += g; edgeSumB += b;
            edgeCount++;
          }
        }
      }

      let finalR = Math.round(totalR / count);
      let finalG = Math.round(totalG / count);
      let finalB = Math.round(totalB / count);

      if (edgeCount > 0 && maxEdgeVal > edgeStrength) {
        const blendFactor = Math.min(maxEdgeVal * 1.5, 1);
        const edgeAvgR = Math.round(edgeSumR / edgeCount);
        const edgeAvgG = Math.round(edgeSumG / edgeCount);
        const edgeAvgB = Math.round(edgeSumB / edgeCount);
        finalR = Math.round(finalR * (1 - blendFactor) + edgeAvgR * blendFactor);
        finalG = Math.round(finalG * (1 - blendFactor) + edgeAvgG * blendFactor);
        finalB = Math.round(finalB * (1 - blendFactor) + edgeAvgB * blendFactor);
      }

      if (enhanceContrast) {
        const brightness = (finalR + finalG + finalB) / 3;
        const factor = brightness > 128 ? 1.15 : 0.88;
        finalR = Math.min(255, Math.round(finalR * factor));
        finalG = Math.min(255, Math.round(finalG * factor));
        finalB = Math.min(255, Math.round(finalB * factor));
      }

      const [qR, qG, qB] = nearestPaletteColor(finalR, finalG, finalB, palette);

      const isEdgeBlock = outlineEdges && maxEdgeVal > edgeStrength * 1.3;

      if (isEdgeBlock) {
        const edgeBlend = Math.min((maxEdgeVal - edgeStrength * 1.3) * 3, 0.85);
        const blendedR = Math.round(qR * (1 - edgeBlend) + orR * edgeBlend);
        const blendedG = Math.round(qG * (1 - edgeBlend) + orG * edgeBlend);
        const blendedB = Math.round(qB * (1 - edgeBlend) + orB * edgeBlend);
        outCtx.fillStyle = `rgb(${blendedR},${blendedG},${blendedB})`;
      } else {
        outCtx.fillStyle = `rgb(${qR},${qG},${qB})`;
      }

      outCtx.fillRect(startX, startY, endX - startX, endY - startY);
    }
  }

  return outCanvas;
}
