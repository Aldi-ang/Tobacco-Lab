import { CODE39_TABLE } from './thermalPrintEngine';

const PATTERN_TO_CHAR: Record<string, string> = Object.fromEntries(
  Object.entries(CODE39_TABLE).map(([ch, pattern]) => [pattern, ch])
);

interface RawRun {
  isBar: boolean;
  len: number;
}

/**
 * Classifies a 9-element Code 39 character slice into 'n' (narrow) and 'w' (wide).
 * Because every Code 39 character has EXACTLY 3 wide elements and 6 narrow elements,
 * ranking lengths is scale-invariant across webcam resolutions and distances.
 */
function decode9ElementGroup(runs: RawRun[], startIdx: number): string | null {
  if (startIdx + 9 > runs.length) return null;

  // Verify alternating bar, space, bar, space...
  const slice = runs.slice(startIdx, startIdx + 9);
  if (!slice[0].isBar) return null;

  const lengths = slice.map((r, i) => ({ len: r.len, i }));
  lengths.sort((a, b) => b.len - a.len);

  // Top 3 widest must be clearly wider than the 4th (narrowest wide vs widest narrow)
  const thirdWidest = lengths[2].len;
  const fourthWidest = lengths[3].len;
  const smallestNarrow = lengths[8].len;

  if (smallestNarrow <= 0 || thirdWidest < fourthWidest * 1.35) {
    return null;
  }

  // Reject huge anomalies (e.g. outer border gap mistaken for a wide space)
  if (lengths[0].len > fourthWidest * 7.5) {
    return null;
  }

  const wideIndices = new Set([lengths[0].i, lengths[1].i, lengths[2].i]);
  let pattern = '';
  for (let k = 0; k < 9; k++) {
    pattern += wideIndices.has(k) ? 'w' : 'n';
  }
  return PATTERN_TO_CHAR[pattern] || null;
}

function scanRunsForCode39(runs: RawRun[]): string[] {
  const found: string[] = [];
  if (runs.length < 29) return found;

  for (let i = 0; i <= runs.length - 9; i++) {
    if (!runs[i].isBar) continue;
    const startChar = decode9ElementGroup(runs, i);
    if (startChar !== '*') continue;

    // Estimate narrow unit width from this start guard
    const startNarrowAvg =
      runs
        .slice(i, i + 9)
        .map((r) => r.len)
        .sort((a, b) => a - b)
        .slice(0, 6)
        .reduce((acc, v) => acc + v, 0) / 6;

    let cursor = i + 9;
    let decoded = '';
    let validClose = false;

    while (cursor + 9 <= runs.length) {
      const gap = runs[cursor];
      if (!gap || gap.isBar) break;
      // Inter-character gap should be narrow (<= 4.2x narrow unit, definitely not outer whitespace)
      if (gap.len > startNarrowAvg * 4.2) break;

      const nextChar = decode9ElementGroup(runs, cursor + 1);
      if (!nextChar) break;

      if (nextChar === '*') {
        validClose = true;
        cursor += 10;
        break;
      }
      decoded += nextChar;
      cursor += 10;
    }

    if (validClose && decoded.length >= 2) {
      found.push(decoded);
      i = Math.max(i, cursor - 1);
    }
  }

  return found;
}

function extractBinaryRunsFromRow(
  lumaRow: Uint8Array | number[],
  width: number
): RawRun[] {
  // Compute min/max over row to derive local contrast threshold
  let minL = 255;
  let maxL = 0;
  for (let x = 0; x < width; x++) {
    const v = lumaRow[x];
    if (v < minL) minL = v;
    if (v > maxL) maxL = v;
  }
  if (maxL - minL < 45) return [];

  // Slightly favor white threshold bias to keep sharp crisp edges on thin narrow bars
  const threshold = minL + (maxL - minL) * 0.54;
  const runs: RawRun[] = [];
  let currentBar = lumaRow[0] < threshold;
  let count = 1;

  for (let x = 1; x < width; x++) {
    const isBar = lumaRow[x] < threshold;
    if (isBar === currentBar) {
      count++;
    } else {
      runs.push({ isBar: currentBar, len: count });
      currentBar = isBar;
      count = 1;
    }
  }
  runs.push({ isBar: currentBar, len: count });
  return runs;
}

/**
 * Pure TypeScript 1D Code 39 Barcode Decoder from raw RGBA pixel buffer.
 * Supports multi-barcode strips, upside-down (180deg) barcodes, and browsers without BarcodeDetector (iOS Safari / Firefox).
 */
export function decodeCode39FromRgba(
  rgba: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number
): string[] {
  if (width < 40 || height < 10) return [];

  const voteCounts = new Map<string, number>();
  const rowBuffer = new Uint8Array(width);
  const sampleFractions = 32;

  for (let s = 2; s < sampleFractions - 2; s++) {
    const y = Math.min(height - 1, Math.floor((s / sampleFractions) * height));
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const r = rgba[idx] ?? 255;
      const g = rgba[idx + 1] ?? 255;
      const b = rgba[idx + 2] ?? 255;
      rowBuffer[x] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    const runs = extractBinaryRunsFromRow(rowBuffer, width);
    if (runs.length < 29) continue;

    // Forward horizontal scan + Reversed scan (handles 180-degree rotated cards)
    const forwardHits = scanRunsForCode39(runs);
    const reversedHits = scanRunsForCode39([...runs].reverse());

    for (const hit of [...forwardHits, ...reversedHits]) {
      voteCounts.set(hit, (voteCounts.get(hit) || 0) + 1);
    }
  }

  return Array.from(voteCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => code);
}

/**
 * Decodes 1D Code 39 barcodes directly from an HTMLCanvasElement.
 */
export function decodeCode39FromCanvas(canvas: HTMLCanvasElement): string[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return [];
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return decodeCode39FromRgba(imgData.data, canvas.width, canvas.height);
}

/**
 * Captures current live video frame onto a reusable offscreen canvas and runs local Code 39 decoding.
 */
export function decodeCode39FromVideoElement(
  video: HTMLVideoElement,
  scratchCanvas?: HTMLCanvasElement | null
): string[] {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return [];

  const targetW = Math.min(1280, vw);
  const targetH = Math.max(1, Math.round((vh / vw) * targetW));
  const canvas = scratchCanvas || document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(video, 0, 0, targetW, targetH);
  return decodeCode39FromCanvas(canvas);
}
