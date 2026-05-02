export interface PixelArtOptions {
  blockSize: number;
  paletteSize: number;
  edgeStrength: number;
  enhanceContrast: boolean;
  outlineEdges: boolean;
  outlineColor: string;
  customPalette?: [number, number, number][];
  detailBoost: number;
  minBlockSize: number;
}

export const DEFAULT_OPTIONS: PixelArtOptions = {
  blockSize: 8,
  paletteSize: 32,
  edgeStrength: 0.4,
  enhanceContrast: true,
  outlineEdges: true,
  outlineColor: "#000000",
  customPalette: undefined,
  detailBoost: 0.6,
  minBlockSize: 2,
};

export interface FaceRegion {
  x: number; y: number; width: number; height: number;
  landmarks?: Array<{ type: string; locations: Array<{ x: number; y: number }> }>;
}

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

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const [l1, a1, b1l] = rgbToLab(r1, g1, b1);
  const [l2, a2, b2l] = rgbToLab(r2, g2, b2);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1l - b2l) ** 2);
}

function buildPalette(imageData: ImageData, paletteSize: number): [number, number, number][] {
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
    let maxDist = -1, bestIdx = 0;
    for (let i = 0; i < samples.length; i++) {
      if (used.has(i)) continue;
      const [r, g, b] = samples[i];
      let minDist = Infinity;
      for (const [pr, pg, pb] of palette) {
        const d = colorDistance(r, g, b, pr, pg, pb);
        if (d < minDist) minDist = d;
      }
      if (minDist > maxDist) { maxDist = minDist; bestIdx = i; }
    }
    palette.push(samples[bestIdx]);
    used.add(bestIdx);
  }
  return palette;
}

function nearestPaletteColor(r: number, g: number, b: number, palette: [number, number, number][]): [number, number, number] {
  let minDist = Infinity, best = palette[0];
  for (const color of palette) {
    const d = colorDistance(r, g, b, color[0], color[1], color[2]);
    if (d < minDist) { minDist = d; best = color; }
  }
  return best;
}

function applySobel(gray: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);
  const kX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = gray[(y + dy) * width + (x + dx)];
          gx += v * kX[k]; gy += v * kY[k]; k++;
        }
      }
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  let maxEdge = 0;
  for (let i = 0; i < edges.length; i++) if (edges[i] > maxEdge) maxEdge = edges[i];
  if (maxEdge > 0) for (let i = 0; i < edges.length; i++) edges[i] /= maxEdge;
  return edges;
}

function applyLaplacian(gray: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  const k = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0, ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += gray[(y + dy) * width + (x + dx)] * k[ki++];
        }
      }
      out[y * width + x] = Math.abs(sum);
    }
  }
  let max = 0;
  for (let i = 0; i < out.length; i++) if (out[i] > max) max = out[i];
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

function computeLocalVariance(gray: Float32Array, width: number, height: number, radius: number): Float32Array {
  const variance = new Float32Array(width * height);
  const r = radius;
  for (let y = r; y < height - r; y++) {
    for (let x = r; x < width - r; x++) {
      let sum = 0, sumSq = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const v = gray[(y + dy) * width + (x + dx)];
          sum += v; sumSq += v * v; count++;
        }
      }
      const mean = sum / count;
      variance[y * width + x] = Math.sqrt(Math.max(0, sumSq / count - mean * mean));
    }
  }
  let max = 0;
  for (let i = 0; i < variance.length; i++) if (variance[i] > max) max = variance[i];
  if (max > 0) for (let i = 0; i < variance.length; i++) variance[i] /= max;
  return variance;
}

export function buildDetailMap(
  gray: Float32Array,
  width: number,
  height: number,
  faceRegions: FaceRegion[] = []
): Float32Array {
  const sobelMap = applySobel(gray, width, height);
  const lapMap = applyLaplacian(gray, width, height);
  const varMap = computeLocalVariance(gray, width, height, 3);

  const detail = new Float32Array(width * height);
  for (let i = 0; i < detail.length; i++) {
    detail[i] = sobelMap[i] * 0.45 + lapMap[i] * 0.35 + varMap[i] * 0.2;
  }

  for (const face of faceRegions) {
    const fx = Math.floor(face.x);
    const fy = Math.floor(face.y);
    const fw = Math.ceil(face.width);
    const fh = Math.ceil(face.height);

    for (let y = Math.max(0, fy); y < Math.min(height, fy + fh); y++) {
      for (let x = Math.max(0, fx); x < Math.min(width, fx + fw); x++) {
        detail[y * width + x] = Math.min(1, detail[y * width + x] * 1.5 + 0.15);
      }
    }

    if (face.landmarks) {
      for (const landmark of face.landmarks) {
        for (const loc of landmark.locations) {
          const lx = Math.floor(loc.x);
          const ly = Math.floor(loc.y);
          const featureRadius = Math.floor(Math.max(fw, fh) * 0.12);
          for (let dy = -featureRadius; dy <= featureRadius; dy++) {
            for (let dx = -featureRadius; dx <= featureRadius; dx++) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist > featureRadius) continue;
              const ny = ly + dy, nx = lx + dx;
              if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
              const weight = 1 - dist / featureRadius;
              detail[ny * width + nx] = Math.min(1, detail[ny * width + nx] + weight * 0.6);
            }
          }
        }
      }
    }
  }

  let max = 0;
  for (let i = 0; i < detail.length; i++) if (detail[i] > max) max = detail[i];
  if (max > 0) for (let i = 0; i < detail.length; i++) detail[i] /= max;

  return detail;
}

export async function detectFaceRegions(canvas: HTMLCanvasElement): Promise<FaceRegion[]> {
  try {
    if (!("FaceDetector" in window)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).FaceDetector({ maxDetectedFaces: 20, fastMode: false });
    const faces = await detector.detect(canvas);
    return faces.map((f: {
      boundingBox: { x: number; y: number; width: number; height: number };
      landmarks?: Array<{ type: string; locations: Array<{ x: number; y: number }> }>;
    }) => ({
      x: f.boundingBox.x,
      y: f.boundingBox.y,
      width: f.boundingBox.width,
      height: f.boundingBox.height,
      landmarks: f.landmarks,
    }));
  } catch {
    return [];
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function renderBlock(
  data: Uint8ClampedArray,
  outCtx: CanvasRenderingContext2D,
  edges: Float32Array,
  palette: [number, number, number][],
  options: PixelArtOptions,
  outlineRgb: [number, number, number],
  imgWidth: number,
  imgHeight: number,
  startX: number, startY: number,
  bw: number, bh: number
) {
  const { edgeStrength, enhanceContrast, outlineEdges } = options;
  const [orR, orG, orB] = outlineRgb;
  const endX = Math.min(startX + bw, imgWidth);
  const endY = Math.min(startY + bh, imgHeight);

  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  let maxEdgeVal = 0;
  let edgeSumR = 0, edgeSumG = 0, edgeSumB = 0, edgeCount = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = y * imgWidth + x;
      const pIdx = idx * 4;
      const r = data[pIdx], g = data[pIdx + 1], b = data[pIdx + 2];
      const ev = edges[idx];
      totalR += r; totalG += g; totalB += b; count++;
      if (ev > maxEdgeVal) maxEdgeVal = ev;
      if (ev > edgeStrength) { edgeSumR += r; edgeSumG += g; edgeSumB += b; edgeCount++; }
    }
  }

  if (count === 0) return;

  let finalR = Math.round(totalR / count);
  let finalG = Math.round(totalG / count);
  let finalB = Math.round(totalB / count);

  if (edgeCount > 0 && maxEdgeVal > edgeStrength) {
    const bf = Math.min(maxEdgeVal * 1.5, 1);
    finalR = Math.round(finalR * (1 - bf) + Math.round(edgeSumR / edgeCount) * bf);
    finalG = Math.round(finalG * (1 - bf) + Math.round(edgeSumG / edgeCount) * bf);
    finalB = Math.round(finalB * (1 - bf) + Math.round(edgeSumB / edgeCount) * bf);
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
    const blend = Math.min((maxEdgeVal - edgeStrength * 1.3) * 3, 0.85);
    outCtx.fillStyle = `rgb(${Math.round(qR * (1 - blend) + orR * blend)},${Math.round(qG * (1 - blend) + orG * blend)},${Math.round(qB * (1 - blend) + orB * blend)})`;
  } else {
    outCtx.fillStyle = `rgb(${qR},${qG},${qB})`;
  }

  outCtx.fillRect(startX, startY, endX - startX, endY - startY);
}

function renderAdaptive(
  data: Uint8ClampedArray,
  outCtx: CanvasRenderingContext2D,
  edges: Float32Array,
  detailMap: Float32Array,
  palette: [number, number, number][],
  options: PixelArtOptions,
  outlineRgb: [number, number, number],
  imgWidth: number,
  imgHeight: number,
  startX: number, startY: number,
  blockW: number, blockH: number,
  depth: number = 0
) {
  const { detailBoost, minBlockSize } = options;
  const endX = Math.min(startX + blockW, imgWidth);
  const endY = Math.min(startY + blockH, imgHeight);
  const halfW = Math.ceil(blockW / 2);
  const halfH = Math.ceil(blockH / 2);

  const canSubdivide = blockW > minBlockSize && blockH > minBlockSize && depth < 2;

  if (canSubdivide) {
    let maxDetail = 0;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const d = detailMap[y * imgWidth + x];
        if (d > maxDetail) maxDetail = d;
      }
    }

    const threshold = 0.55 - detailBoost * 0.25;
    if (maxDetail > threshold) {
      renderAdaptive(data, outCtx, edges, detailMap, palette, options, outlineRgb, imgWidth, imgHeight, startX, startY, halfW, halfH, depth + 1);
      renderAdaptive(data, outCtx, edges, detailMap, palette, options, outlineRgb, imgWidth, imgHeight, startX + halfW, startY, blockW - halfW, halfH, depth + 1);
      renderAdaptive(data, outCtx, edges, detailMap, palette, options, outlineRgb, imgWidth, imgHeight, startX, startY + halfH, halfW, blockH - halfH, depth + 1);
      renderAdaptive(data, outCtx, edges, detailMap, palette, options, outlineRgb, imgWidth, imgHeight, startX + halfW, startY + halfH, blockW - halfW, blockH - halfH, depth + 1);
      return;
    }
  }

  renderBlock(data, outCtx, edges, palette, options, outlineRgb, imgWidth, imgHeight, startX, startY, blockW, blockH);
}

export function convertToPixelArt(
  sourceCanvas: HTMLCanvasElement,
  options: PixelArtOptions,
  faceRegions: FaceRegion[] = []
): HTMLCanvasElement {
  const { blockSize, paletteSize, outlineColor, customPalette } = options;

  const srcCtx = sourceCanvas.getContext("2d")!;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const imageData = srcCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }

  const edges = applySobel(gray, width, height);
  const detailMap = buildDetailMap(gray, width, height, faceRegions);

  const palette: [number, number, number][] =
    customPalette && customPalette.length > 0
      ? customPalette
      : buildPalette(imageData, paletteSize);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d")!;
  const outlineRgb = hexToRgb(outlineColor);

  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      renderAdaptive(
        data, outCtx, edges, detailMap, palette, options, outlineRgb,
        width, height,
        bx * blockSize, by * blockSize,
        blockSize, blockSize,
        0
      );
    }
  }

  return outCanvas;
}
