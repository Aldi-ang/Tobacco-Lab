export type PrintPaperFormat = 'A4_6' | 'THERMAL_58' | 'THERMAL_80';
export type DuplexMode = 'OFF' | 'LONG_EDGE' | 'SHORT_EDGE';

export interface ThermalProfileSpec {
  id: 'THERMAL_58' | 'THERMAL_80';
  label: string;
  rollWidthMm: number;
  printableWidthMm: number;
  widthDots: number; // Standard 203 DPI thermal head width
}

export const THERMAL_PROFILES: Record<'THERMAL_58' | 'THERMAL_80', ThermalProfileSpec> = {
  THERMAL_58: {
    id: 'THERMAL_58',
    label: 'Thermal 58mm',
    rollWidthMm: 58,
    printableWidthMm: 48,
    widthDots: 384,
  },
  THERMAL_80: {
    id: 'THERMAL_80',
    label: 'Thermal 80mm',
    rollWidthMm: 80,
    printableWidthMm: 72,
    widthDots: 576,
  },
};

export function isThermalPaperFormat(format: PrintPaperFormat): format is 'THERMAL_58' | 'THERMAL_80' {
  return format === 'THERMAL_58' || format === 'THERMAL_80';
}

export const A4_PRINT_PAGE_METRICS = {
  pageHeightMm: 262, // Bounded safely within 297mm A4 even when mobile/desktop browser print adds headers/footers
  marginMm: 8,
  gridGapMm: 3.5,
} as const;

/**
 * Generates @page CSS rules dynamically for A4 vs Thermal Roll (58mm / 80mm)
 * so system printer drivers (USB/Wi-Fi/AirPrint) cut & scale accurately.
 */
export function buildDynamicPrintPageCss(format: PrintPaperFormat): string {
  if (format === 'THERMAL_58') {
    return `@page { size: 58mm auto; margin: 2mm 3mm; }`;
  }
  if (format === 'THERMAL_80') {
    return `@page { size: 80mm auto; margin: 3mm 4mm; }`;
  }
  return `@page { size: A4 portrait; margin: ${A4_PRINT_PAGE_METRICS.marginMm}mm; }`;
}

/**
 * Extracts clean Prefix Code from a Lot number (e.g. "LOT-261115-001" -> "LOT-261115").
 */
export function extractLotPrefixCode(lotNumber: string, customPrefix?: string): string {
  const trimmed = String(lotNumber || '').trim().toUpperCase();
  const explicit = String(customPrefix || '').trim().toUpperCase().replace(/-+$/, '');
  if (explicit && trimmed.startsWith(explicit)) return explicit;
  const hyphenMatch = trimmed.match(/^([A-Z0-9-]+?)-\d+$/);
  if (hyphenMatch && hyphenMatch[1]) return hyphenMatch[1];
  const compactMatch = trimmed.match(/^([A-Z0-9-]*?[A-Z])(\d+)$/);
  if (compactMatch && compactMatch[1]) return compactMatch[1].replace(/-+$/, '');
  const parts = trimmed.split('-');
  if (parts.length > 1) return parts.slice(0, -1).join('-');
  return trimmed || 'LOT';
}

/**
 * Encodes a grader name into a compact Code 39 safe token (max 12 chars, spaces -> '-').
 * Example: "Aldi" -> "ALDI", "Pak Joko" -> "PAK-JOKO".
 */
export function encodeGraderTokenForCode39(graderName?: string): string {
  const cleaned = String(graderName || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9.-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 12).replace(/-+$/g, '');
}

/**
 * Builds the machine-readable Code 39 barcode payload correlating Lot Number + Fixed Grader Name.
 * Uses Code 39's native '/' separator: e.g. "MTL001/ALDI" (or "MTL001" when no fixed grader is set).
 */
export function buildGradeCardBarcodePayload(lotNumber: string, graderName?: string): string {
  const cleanLot = String(lotNumber || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
  if (!cleanLot) return '';
  const graderToken = encodeGraderTokenForCode39(graderName);
  return graderToken ? `${cleanLot}/${graderToken}` : cleanLot;
}

function toDisplayGraderName(token: string): string {
  return String(token || '')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parses a scanned Code 39 barcode payload (or legacy plain Lot barcode) into
 * normalized `{ lotNumber, embeddedGraderName }`.
 * Examples:
 *  - "*MTL001/ALDI*" -> { lotNumber: "MTL001", embeddedGraderName: "Aldi" }
 *  - "MTL001/PAK-JOKO" -> { lotNumber: "MTL001", embeddedGraderName: "Pak Joko" }
 *  - "MTL001" -> { lotNumber: "MTL001", embeddedGraderName: "" }
 */
export function parseGradeCardBarcodePayload(raw: string): {
  lotNumber: string;
  embeddedGraderName: string;
  rawPayload: string;
} {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/^BC\s*:\s*/i, '')
    .trim()
    .toUpperCase();
  if (!cleaned) {
    return { lotNumber: '', embeddedGraderName: '', rawPayload: '' };
  }

  const slashIdx = cleaned.indexOf('/');
  if (slashIdx > 0) {
    const lotPart = cleaned
      .slice(0, slashIdx)
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9-]/g, '');
    const graderPart = cleaned
      .slice(slashIdx + 1)
      .replace(/[^A-Z0-9.\-\s]/g, '')
      .trim();
    const embeddedGraderName = toDisplayGraderName(graderPart);
    return {
      lotNumber: lotPart,
      embeddedGraderName,
      rawPayload: lotPart && graderPart ? `${lotPart}/${graderPart.replace(/\s+/g, '-')}` : lotPart,
    };
  }

  const lotOnly = cleaned.replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
  return {
    lotNumber: lotOnly,
    embeddedGraderName: '',
    rawPayload: lotOnly,
  };
}

/**
 * Standard ISO/ANSI Code 39 bar/space encoding patterns (9 elements per char: n=narrow 1, w=wide 3).
 * Scannable by handheld laser scanners, mobile camera apps, and optical vision pipelines.
 */
export const CODE39_TABLE: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export interface BarcodeModuleRun {
  isBar: boolean;
  units: number;
}

/**
 * Generates deterministic Code 39 1D barcode module sequence framed by '*' start & stop guards.
 */
export function encodeCode39Modules(rawCode: string): BarcodeModuleRun[] {
  const sanitized = String(rawCode || 'LOT')
    .toUpperCase()
    .split('')
    .map((ch) => (CODE39_TABLE[ch] && ch !== '*' ? ch : '-'))
    .join('');

  const full = `*${sanitized || 'LOT'}*`;
  const runs: BarcodeModuleRun[] = [];

  for (let c = 0; c < full.length; c++) {
    const pattern = CODE39_TABLE[full[c]] || CODE39_TABLE['-'];
    for (let i = 0; i < pattern.length; i++) {
      runs.push({
        isBar: i % 2 === 0,
        units: pattern[i] === 'w' ? 3 : 1,
      });
    }
    // Inter-character narrow white gap
    if (c < full.length - 1) {
      runs.push({ isBar: false, units: 1 });
    }
  }

  return runs;
}

export function computeCode39TotalUnits(runs: BarcodeModuleRun[]): number {
  return runs.reduce((acc, r) => acc + r.units, 0);
}

/**
 * Maps front-side A4 grid slots (2 columns x 2 or 3 rows) onto the exact physical back side
 * for Duplex printing so each Back Barcode lands behind its matching Front Card.
 * - LONG_EDGE (standard upright 2-sided A4): swaps Left <-> Right columns per row.
 * - SHORT_EDGE (tumble 2-sided A4): reverses row order and rotates each slot 180deg.
 */
export function arrangeDuplexBackSlots(
  pageLots: (string | null)[],
  cardsPerPage: 4 | 6,
  flipMode: 'LONG_EDGE' | 'SHORT_EDGE'
): { lot: string | null; rotate180: boolean }[] {
  const cols = 2;
  const rows = cardsPerPage / cols;
  const frontGrid: (string | null)[] = Array.from(
    { length: cardsPerPage },
    (_, idx) => pageLots[idx] ?? null
  );

  const backSlots: { lot: string | null; rotate180: boolean }[] = [];

  if (flipMode === 'LONG_EDGE') {
    for (let r = 0; r < rows; r++) {
      const left = frontGrid[r * cols];
      const right = frontGrid[r * cols + 1];
      backSlots.push({ lot: right, rotate180: false });
      backSlots.push({ lot: left, rotate180: false });
    }
    return backSlots;
  }

  // SHORT_EDGE: top-to-bottom flip + 180deg card orientation
  for (let r = rows - 1; r >= 0; r--) {
    const left = frontGrid[r * cols];
    const right = frontGrid[r * cols + 1];
    backSlots.push({ lot: left, rotate180: true });
    backSlots.push({ lot: right, rotate180: true });
  }
  return backSlots;
}

/**
 * Converts a raw RGBA pixel buffer into a standard ESC/POS monochrome raster command (`GS v 0`)
 * compatible with 58mm (384 dots) and 80mm (576 dots) Bluetooth/USB thermal printers.
 */
export function encodeMonochromePixelsToEscPos(params: {
  widthDots: number;
  heightDots: number;
  rgbaPixels: Uint8ClampedArray | number[];
  threshold?: number;
  feedLines?: number;
  autoCut?: boolean;
}): Uint8Array {
  const {
    widthDots,
    heightDots,
    rgbaPixels,
    threshold = 165,
    feedLines = 4,
    autoCut = true,
  } = params;

  const widthBytes = Math.ceil(widthDots / 8);
  const rasterDataSize = widthBytes * heightDots;

  // Header: ESC @ (Init) + GS v 0 0 xL xH yL yH
  const header = [
    0x1b, 0x40,
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    heightDots & 0xff,
    (heightDots >> 8) & 0xff,
  ];

  // Footer: ESC d n (Feed lines) + optional GS V 66 0 (Partial cut)
  const footer = [0x1b, 0x64, Math.max(1, Math.min(20, feedLines))];
  if (autoCut) {
    footer.push(0x1d, 0x56, 0x42, 0x00);
  }

  const out = new Uint8Array(header.length + rasterDataSize + footer.length);
  out.set(header, 0);

  let offset = header.length;
  for (let y = 0; y < heightDots; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < widthDots) {
          const pxIdx = (y * widthDots + x) * 4;
          const r = rgbaPixels[pxIdx] ?? 255;
          const g = rgbaPixels[pxIdx + 1] ?? 255;
          const b = rgbaPixels[pxIdx + 2] ?? 255;
          const a = rgbaPixels[pxIdx + 3] ?? 255;
          // Composite over white if semi-transparent
          const lum =
            a < 255
              ? Math.round(((0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (255 - a)) / 255)
              : 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < threshold) {
            byteVal |= 0x80 >> bit;
          }
        }
      }
      out[offset++] = byteVal;
    }
  }

  out.set(footer, offset);
  return out;
}

/**
 * Deterministic 7x7 matrix grid helper shared by SVG cards, thermal canvas rasterizer & simulator.
 */
export function computeLotMatrixCells(lotCode: string): boolean[] {
  let seed = 2166136261;
  for (let i = 0; i < lotCode.length; i++) {
    seed ^= lotCode.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const grid: boolean[] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isCorner = (r < 2 && c < 2) || (r < 2 && c >= 5) || (r >= 5 && c < 2);
      if (isCorner) {
        grid.push(true);
      } else {
        seed ^= (r * 7 + c + 1) * 2654435761;
        seed = Math.imul(seed, 1597334677);
        grid.push((seed >>> 28) % 2 === 0);
      }
    }
  }
  return grid;
}

/**
 * Renders a crisp high-contrast monochrome Kartu Grade onto an offscreen canvas
 * sized for 58mm (384 dots) or 80mm (576 dots) ESC/POS thermal printers.
 */
export function renderThermalCardToCanvas(params: {
  lotNumber: string;
  packagingChoices: string[];
  widthDots: number;
  includeBackBarcode?: boolean;
  customPrefix?: string;
  graderName?: string;
  printYear?: number;
}): HTMLCanvasElement {
  const {
    lotNumber,
    packagingChoices,
    widthDots,
    includeBackBarcode = false,
    customPrefix,
    graderName,
    printYear,
  } = params;
  const yearLabel =
    Number.isFinite(printYear) && Number(printYear) >= 2020 && Number(printYear) <= 2099
      ? Math.round(Number(printYear))
      : new Date().getFullYear();
  const cleanGrader = String(graderName || '').trim().slice(0, 22);
  const barcodePayload = buildGradeCardBarcodePayload(lotNumber, cleanGrader) || lotNumber;
  const isNarrow = widthDots <= 400;
  const pad = isNarrow ? 10 : 14;
  const innerW = widthDots - pad * 2;

  // Dynamic Kemasan choices: include ALL packaging master types + Lainnya
  const normalizedPkgs = Array.from(
    new Set(
      (packagingChoices || [])
        .map((p) => String(p || '').trim())
        .filter(Boolean)
    )
  );
  const pkgItems = [...normalizedPkgs, 'Lainnya: ______'];
  const pkgCols = isNarrow ? 2 : pkgItems.length >= 7 ? 3 : 2;
  const pkgRows = Math.max(1, Math.ceil(pkgItems.length / pkgCols));
  const pkgRowStep = isNarrow ? 24 : 28;
  const pkgBoxH = 26 + pkgRows * pkgRowStep;

  const gradeBoxH = isNarrow ? 82 : 96;
  const attrRowStep = isNarrow ? 29 : 35;
  const attrSqSize = isNarrow ? 24 : 30;
  const attrBoxH = 28 + 7 * attrRowStep;
  const stage2H = isNarrow ? 38 : 44; // Front Tahap 2 strip: Bruto + Harga only
  const catatanBoxH = isNarrow ? 92 : 110;

  const headerH = isNarrow ? 102 : 114;
  const identityH = (isNarrow ? 42 : 46) * 3 + 18;
  const frontCatatanExtra = includeBackBarcode ? 0 : catatanBoxH + 8;
  const frontHeightDots =
    pad +
    headerH +
    identityH +
    gradeBoxH +
    8 +
    pkgBoxH +
    8 +
    attrBoxH +
    8 +
    stage2H +
    frontCatatanExtra +
    34;
  const barcodeSectionH = includeBackBarcode ? (isNarrow ? 185 + catatanBoxH : 210 + catatanBoxH) : 0;
  const heightDots = frontHeightDots + barcodeSectionH;

  const canvas = document.createElement('canvas');
  canvas.width = widthDots;
  canvas.height = heightDots;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthDots, heightDots);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';

  // Outer border for front slip
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, widthDots - 8, frontHeightDots - 22);

  // Header + Front Code 39 Barcode (correlates Lot + Fixed Grader)
  ctx.font = `bold ${isNarrow ? 11 : 13}px monospace`;
  ctx.fillText('TOBACCO LAB · KARTU GRADE', pad, pad + 14);
  ctx.font = `900 ${isNarrow ? 21 : 27}px monospace`;
  ctx.fillText(lotNumber, pad, pad + 40);
  ctx.font = `bold ${isNarrow ? 11 : 13}px sans-serif`;
  ctx.fillText(
    `Tgl: ___/___/${yearLabel}  Grader: ${cleanGrader || '________'}`,
    pad,
    pad + 58
  );

  // Front Header Code 39 strip
  const frontRuns = encodeCode39Modules(barcodePayload);
  const frontTotalUnits = computeCode39TotalUnits(frontRuns);
  const frontBarAreaW = innerW - 8;
  const frontUnitPx = Math.max(1, frontBarAreaW / frontTotalUnits);
  const frontRenderedW = frontUnitPx * frontTotalUnits;
  let frontBarX = pad + Math.max(0, (innerW - frontRenderedW) / 2);
  const frontBarY = pad + 64;
  const frontBarH = isNarrow ? 24 : 30;
  for (const run of frontRuns) {
    const w = run.units * frontUnitPx;
    if (run.isBar) {
      ctx.fillRect(frontBarX, frontBarY, Math.max(1, w), frontBarH);
    }
    frontBarX += w;
  }
  ctx.font = `bold ${isNarrow ? 9 : 11}px monospace`;
  ctx.fillText(`BC: ${barcodePayload}`, pad, frontBarY + frontBarH + (isNarrow ? 11 : 13));

  // Identity boxes
  let y = pad + headerH;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, y);
  ctx.lineTo(widthDots - 4, y);
  ctx.stroke();

  const drawBox = (label: string, x: number, boxY: number, w: number, h: number) => {
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x, boxY, w, h);
    ctx.font = `bold ${isNarrow ? 10 : 12}px sans-serif`;
    ctx.fillText(label, x + 6, boxY + 14);
  };

  y += 6;
  const idBoxH = isNarrow ? 40 : 44;
  drawBox('PENJUAL / PETANI', pad, y, innerW, idBoxH);
  y += idBoxH + 5;
  drawBox('DAERAH ASAL (MTL / TMG / WDS)', pad, y, innerW, idBoxH);
  y += idBoxH + 5;
  drawBox('NAMA / JENIS TEMBAKAU', pad, y, innerW, idBoxH);
  y += idBoxH + 7;

  // Grade checkboxes — 2 rows x 7 vertical pairs:
  // Row 1: A  B  C  D  E  F  G
  // Row 2: A+ B+ C+ D+ E+ F+ G+
  const gradeRows: string[][] = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['A+', 'B+', 'C+', 'D+', 'E+', 'F+', 'G+'],
  ];
  drawBox('GRADE WARNA (SILANG X SATU)', pad, y, innerW, gradeBoxH);
  const colW = (innerW - 10) / 7;
  const gSq = isNarrow ? 16 : 20;
  gradeRows.forEach((rowGrades, rIdx) => {
    rowGrades.forEach((gr, cIdx) => {
      const gx = pad + 5 + cIdx * colW;
      const gy = y + 22 + rIdx * (isNarrow ? 28 : 34);
      ctx.lineWidth = 2.2;
      ctx.strokeRect(gx, gy, gSq, gSq);
      ctx.font = `900 ${isNarrow ? 12 : 15}px monospace`;
      ctx.fillText(gr, gx + gSq + (isNarrow ? 3 : 5), gy + (isNarrow ? 13 : 16));
    });
  });
  y += gradeBoxH + 7;

  // Dynamic ALL Packaging checkboxes
  drawBox('KEMASAN (SILANG X SATU)', pad, y, innerW, pkgBoxH);
  const pkgColW = (innerW - 10) / pkgCols;
  const pSq = isNarrow ? 16 : 18;
  pkgItems.forEach((pk, idx) => {
    const col = idx % pkgCols;
    const row = Math.floor(idx / pkgCols);
    const px = pad + 6 + col * pkgColW;
    const py = y + 22 + row * pkgRowStep;
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pSq, pSq);
    ctx.font = `bold ${isNarrow ? 10 : 12}px sans-serif`;
    const maxChars = pkgCols >= 3 ? 13 : isNarrow ? 15 : 22;
    ctx.fillText(pk.slice(0, maxChars), px + pSq + 5, py + (isNarrow ? 13 : 14));
  });
  y += pkgBoxH + 7;

  // 7 Attributes (Power..Aroma + Maturity) — wide-spaced square numbered boxes [1][2][3][4][5]
  const attrs = ['POWER', 'IMPACT', 'BITTER', 'BURN', 'SUGAR', 'AROMA', 'MATURITY'];
  drawBox('KARAKTER RASA & MATURITY (1-5)', pad, y, innerW, attrBoxH);
  const labelColumnW = isNarrow ? 82 : 114;
  const startX = pad + 8 + labelColumnW;
  const boxGap = isNarrow ? 5 : 10;
  attrs.forEach((attr, rIdx) => {
    const ry = y + 22 + rIdx * attrRowStep;
    ctx.font = `900 ${isNarrow ? 11.5 : 13.5}px sans-serif`;
    ctx.fillText(attr, pad + 8, ry + Math.round(attrSqSize * 0.72));
    for (let d = 1; d <= 5; d++) {
      const bx = startX + (d - 1) * (attrSqSize + boxGap);
      ctx.lineWidth = 2.2;
      ctx.strokeRect(bx, ry, attrSqSize, attrSqSize);
      ctx.font = `900 ${isNarrow ? 14 : 17}px monospace`;
      ctx.fillText(
        String(d),
        bx + Math.round(attrSqSize * 0.32),
        ry + Math.round(attrSqSize * 0.72)
      );
    }
  });
  y += attrBoxH + 7;

  // Stage 2 — Compact bottom strip (Bruto + Harga)
  const halfW = (innerW - 6) / 2;
  drawBox('BRUTO (KG)', pad, y, halfW, stage2H);
  drawBox('HARGA / KG (RP)', pad + halfW + 6, y, halfW, stage2H);
  y += stage2H + 8;

  const drawCatatanBox = (boxY: number) => {
    drawBox('CATATAN / KETERANGAN DETAIL (TAHAP 2)', pad, boxY, innerW, catatanBoxH);
    ctx.save();
    ctx.strokeStyle = '#9ca3af';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    for (let l = 1; l <= 3; l++) {
      const ly = boxY + 22 + ((catatanBoxH - 28) * l) / 4;
      ctx.beginPath();
      ctx.moveTo(pad + 6, ly);
      ctx.lineTo(widthDots - pad - 6, ly);
      ctx.stroke();
    }
    ctx.restore();
  };

  if (!includeBackBarcode) {
    drawCatatanBox(y);
  } else {
    const foldY = frontHeightDots - 6;
    ctx.font = `bold ${isNarrow ? 10 : 11}px monospace`;
    ctx.fillText('--- SISI BELAKANG: BARCODE & CATATAN ---', pad + 8, foldY);

    const bTop = frontHeightDots + 8;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, bTop, widthDots - 8, barcodeSectionH - 30);

    const prefix = extractLotPrefixCode(lotNumber, customPrefix);
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, bTop + 8, innerW, isNarrow ? 24 : 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${isNarrow ? 11 : 14}px monospace`;
    ctx.fillText(
      cleanGrader ? `PREFIX: ${prefix} · GRD: ${cleanGrader.toUpperCase()}` : `PREFIX: ${prefix}`,
      pad + 8,
      bTop + (isNarrow ? 24 : 28)
    );

    // Render normal-size Code 39 1D linear barcode encoding Lot + Fixed Grader
    ctx.fillStyle = '#000000';
    const runs = encodeCode39Modules(barcodePayload);
    const totalUnits = computeCode39TotalUnits(runs);
    const barAreaW = innerW - 12;
    const unitPx = Math.max(1, barAreaW / totalUnits);
    const renderedW = unitPx * totalUnits;
    let curX = pad + Math.floor((innerW - renderedW) / 2);
    const barY = bTop + (isNarrow ? 38 : 44);
    const barH = isNarrow ? 54 : 66;
    for (const run of runs) {
      const w = run.units * unitPx;
      if (run.isBar) {
        ctx.fillRect(curX, barY, Math.max(1, w), barH);
      }
      curX += w;
    }

    ctx.font = `900 ${isNarrow ? 14 : 18}px monospace`;
    ctx.fillText(barcodePayload, pad + 8, barY + barH + (isNarrow ? 18 : 22));

    // Place large multi-line Catatan directly below the barcode!
    drawCatatanBox(barY + barH + (isNarrow ? 28 : 34));
  }

  // Cut line at bottom
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${isNarrow ? 10 : 11}px monospace`;
  ctx.fillText('--- POTONG DISINI (THERMAL) ---', pad + 18, heightDots - 6);

  return canvas;
}

/**
 * Connects via Web Bluetooth GATT to common 58mm/80mm ESC/POS printers and transmits raster bytes.
 */
export async function printCanvasViaWebBluetooth(canvas: HTMLCanvasElement): Promise<void> {
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (opts: any) => Promise<any>;
    };
  };
  if (!nav.bluetooth) {
    throw new Error(
      'Browser/perangkat ini belum mendukung Web Bluetooth. Gunakan tombol "Cetak Thermal (Driver / PDF)" untuk mencetak lewat driver printer.'
    );
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak valid.');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const escPosBytes = encodeMonochromePixelsToEscPos({
    widthDots: canvas.width,
    heightDots: canvas.height,
    rgbaPixels: imgData.data,
  });

  // Standard BLE Serial / ESC-POS Printer UUIDs
  const PRINTER_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  ];

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error('Gagal terhubung ke printer Bluetooth.');

  const services = await server.getPrimaryServices();
  let writableChar: any = null;
  for (const svc of services) {
    try {
      const chars = await svc.getCharacteristics();
      const candidate = chars.find(
        (c: any) => c.properties?.write || c.properties?.writeWithoutResponse
      );
      if (candidate) {
        writableChar = candidate;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!writableChar) {
    throw new Error('Karakteristik cetak ESC/POS tidak ditemukan pada perangkat Bluetooth ini.');
  }

  // Chunk payload to safe BLE MTU (180 bytes per write)
  const CHUNK_SIZE = 180;
  for (let i = 0; i < escPosBytes.length; i += CHUNK_SIZE) {
    const chunk = escPosBytes.slice(i, i + CHUNK_SIZE);
    if (writableChar.properties?.writeWithoutResponse && writableChar.writeValueWithoutResponse) {
      await writableChar.writeValueWithoutResponse(chunk);
    } else {
      await writableChar.writeValue(chunk);
    }
  }
}
