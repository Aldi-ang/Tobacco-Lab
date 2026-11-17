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
  const compactMatch = trimmed.match(/^([A-Z0-9-]*?[A-Z])(\d{2,})$/);
  if (compactMatch && compactMatch[1]) return compactMatch[1].replace(/-+$/, '');
  const parts = trimmed.split('-');
  if (parts.length > 1) return parts.slice(0, -1).join('-');
  return trimmed || 'LOT';
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
  const isNarrow = widthDots <= 400;
  const frontHeightDots = isNarrow ? 760 : 880;
  const barcodeSectionH = includeBackBarcode ? (isNarrow ? 195 : 225) : 0;
  const heightDots = frontHeightDots + barcodeSectionH;
  const pad = isNarrow ? 10 : 14;

  const canvas = document.createElement('canvas');
  canvas.width = widthDots;
  canvas.height = heightDots;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthDots, heightDots);
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';

  // Outer border + corner marks for front slip
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, widthDots - 8, frontHeightDots - 26);

  // Header
  ctx.font = `bold ${isNarrow ? 12 : 14}px monospace`;
  ctx.fillText('TOBACCO LAB • KARTU GRADE', pad, pad + 16);
  ctx.font = `900 ${isNarrow ? 20 : 26}px monospace`;
  ctx.fillText(lotNumber, pad, pad + 44);
  ctx.font = `bold ${isNarrow ? 11 : 13}px sans-serif`;
  ctx.fillText(
    `Tgl: ___/___/${yearLabel}  Grader: ${cleanGrader || '________'}`,
    pad,
    pad + 64
  );

  // Matrix SVG on top-right
  const cells = computeLotMatrixCells(lotNumber);
  const cellSize = isNarrow ? 6 : 8;
  const matrixX = widthDots - pad - cellSize * 7 - 4;
  const matrixY = pad + 4;
  ctx.lineWidth = 2;
  ctx.strokeRect(matrixX - 3, matrixY - 3, cellSize * 7 + 6, cellSize * 7 + 6);
  cells.forEach((on, idx) => {
    if (on) {
      ctx.fillRect(
        matrixX + (idx % 7) * cellSize,
        matrixY + Math.floor(idx / 7) * cellSize,
        cellSize,
        cellSize
      );
    }
  });

  // Identity boxes
  let y = pad + 78;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, y);
  ctx.lineTo(widthDots - 4, y);
  ctx.stroke();

  const drawBox = (label: string, x: number, boxY: number, w: number, h: number) => {
    ctx.lineWidth = 2;
    ctx.strokeRect(x, boxY, w, h);
    ctx.font = `bold ${isNarrow ? 10 : 12}px sans-serif`;
    ctx.fillText(label, x + 6, boxY + 14);
  };

  const innerW = widthDots - pad * 2;
  y += 8;
  drawBox('PENJUAL / PETANI', pad, y, innerW, isNarrow ? 44 : 50);
  y += isNarrow ? 50 : 56;
  drawBox('DAERAH ASAL (MTL / TMG / WDS)', pad, y, innerW, isNarrow ? 44 : 50);
  y += isNarrow ? 50 : 56;
  drawBox('NAMA / JENIS TEMBAKAU', pad, y, innerW, isNarrow ? 44 : 50);
  y += isNarrow ? 52 : 58;

  // Grade checkboxes (SILANG X)
  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
  const gradeBoxH = isNarrow ? 66 : 74;
  drawBox('GRADE WARNA (SILANG X SATU)', pad, y, innerW, gradeBoxH);
  const colW = (innerW - 12) / 6;
  grades.forEach((gr, idx) => {
    const col = idx % 6;
    const row = Math.floor(idx / 6);
    const gx = pad + 6 + col * colW;
    const gy = y + 22 + row * (isNarrow ? 21 : 24);
    ctx.strokeRect(gx, gy, isNarrow ? 14 : 16, isNarrow ? 14 : 16);
    ctx.font = `bold ${isNarrow ? 11 : 13}px monospace`;
    ctx.fillText(gr, gx + (isNarrow ? 18 : 21), gy + (isNarrow ? 12 : 14));
  });
  y += gradeBoxH + 6;

  // Packaging checkboxes
  const pkgs = packagingChoices.slice(0, 4);
  const pkgBoxH = isNarrow ? 66 : 74;
  drawBox('KEMASAN (SILANG X SATU)', pad, y, innerW, pkgBoxH);
  pkgs.forEach((pk, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const px = pad + 6 + col * (innerW / 2 - 4);
    const py = y + 22 + row * (isNarrow ? 21 : 24);
    ctx.strokeRect(px, py, isNarrow ? 14 : 16, isNarrow ? 14 : 16);
    ctx.font = `bold ${isNarrow ? 10 : 12}px sans-serif`;
    ctx.fillText(pk.slice(0, isNarrow ? 16 : 20), px + 20, py + 13);
  });
  y += pkgBoxH + 6;

  // 6 Karakter Rasa — Square numbered boxes [1][2][3][4][5] for easy X crossing!
  const attrs = ['POWER', 'IMPACT', 'BITTER', 'BURN', 'SUGAR', 'AROMA'];
  const attrBoxH = isNarrow ? 166 : 196;
  drawBox('KARAKTER RASA (SILANG X ANGKA 1-5)', pad, y, innerW, attrBoxH);
  const rowStep = isNarrow ? 23 : 27;
  const sqSize = isNarrow ? 19 : 23;
  attrs.forEach((attr, rIdx) => {
    const ry = y + 24 + rIdx * rowStep;
    ctx.font = `bold ${isNarrow ? 11 : 13}px sans-serif`;
    ctx.fillText(attr, pad + 8, ry + 15);
    const labelColumnW = isNarrow ? 74 : 92;
    const startX = pad + 8 + labelColumnW;
    for (let d = 1; d <= 5; d++) {
      const bx = startX + (d - 1) * (sqSize + 5);
      ctx.strokeRect(bx, ry, sqSize, sqSize);
      ctx.font = `bold ${isNarrow ? 12 : 14}px monospace`;
      ctx.fillText(String(d), bx + (isNarrow ? 6 : 7), ry + (isNarrow ? 14 : 17));
    }
  });
  y += attrBoxH + 8;

  // Stage 2 boxes
  const halfW = (innerW - 8) / 2;
  drawBox('TAHAP 2: BRUTO (KG)', pad, y, halfW, isNarrow ? 48 : 54);
  drawBox('HARGA / KG (RP)', pad + halfW + 8, y, halfW, isNarrow ? 48 : 54);

  if (includeBackBarcode) {
    const foldY = frontHeightDots - 8;
    ctx.font = `bold ${isNarrow ? 10 : 11}px monospace`;
    ctx.fillText('--- LIPAT KE BELAKANG / LABEL ---', pad + 18, foldY);

    const bTop = frontHeightDots + 8;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, bTop, widthDots - 8, barcodeSectionH - 30);

    const prefix = extractLotPrefixCode(lotNumber, customPrefix);
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, bTop + 8, innerW, isNarrow ? 24 : 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${isNarrow ? 12 : 15}px monospace`;
    ctx.fillText(`PREFIX: ${prefix}`, pad + 8, bTop + (isNarrow ? 24 : 28));

    // Render big Code 39 1D linear barcode
    ctx.fillStyle = '#000000';
    const runs = encodeCode39Modules(lotNumber);
    const totalUnits = computeCode39TotalUnits(runs);
    const barAreaW = innerW - 12;
    const unitPx = Math.max(1, Math.floor(barAreaW / totalUnits));
    const renderedW = unitPx * totalUnits;
    let curX = pad + Math.floor((innerW - renderedW) / 2);
    const barY = bTop + (isNarrow ? 40 : 46);
    const barH = isNarrow ? 82 : 96;
    for (const run of runs) {
      const w = run.units * unitPx;
      if (run.isBar) {
        ctx.fillRect(curX, barY, w, barH);
      }
      curX += w;
    }

    ctx.font = `900 ${isNarrow ? 18 : 24}px monospace`;
    ctx.fillText(lotNumber, pad + 12, barY + barH + (isNarrow ? 22 : 28));
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
