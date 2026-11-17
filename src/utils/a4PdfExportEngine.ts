import {
  DuplexMode,
  arrangeDuplexBackSlots,
  computeCode39TotalUnits,
  computeLotMatrixCells,
  encodeCode39Modules,
  extractLotPrefixCode,
} from './thermalPrintEngine';

export interface JpegPdfPageInput {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

const textEncoder = new TextEncoder();

function encodeAscii(str: string): Uint8Array {
  return textEncoder.encode(str);
}

/**
 * Pure TypeScript PDF 1.4 writer wrapping crisp A4 JPEG pages (595.28 x 841.89 pt)
 * using /Filter /DCTDecode — zero external libraries required, deterministic byte output,
 * works across iOS Safari, Android Chrome, Desktop, PWA & sandboxed iframes.
 */
export function buildPdfDocumentFromJpegPages(pages: JpegPdfPageInput[]): Uint8Array {
  if (!pages.length) {
    throw new Error('Tidak ada halaman PDF untuk dibuat.');
  }

  // Standard PDF points for A4 portrait (210mm x 297mm)
  const A4_PT_W = 595.28;
  const A4_PT_H = 841.89;

  // Object numbering:
  // 1: Catalog
  // 2: Pages
  // For each page i (0..N-1):
  //   pageObj = 3 + i * 3
  //   imgObj  = 3 + i * 3 + 1
  //   contObj = 3 + i * 3 + 2
  const pageCount = pages.length;
  const totalObjects = 2 + pageCount * 3;
  const objectChunks: Uint8Array[] = [];
  const offsets: number[] = new Array(totalObjects + 1).fill(0);

  const header = encodeAscii('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  objectChunks.push(header);
  let byteCursor = header.length;

  const pushObject = (objNum: number, parts: (string | Uint8Array)[]) => {
    offsets[objNum] = byteCursor;
    const prefix = encodeAscii(`${objNum} 0 obj\n`);
    const suffix = encodeAscii('\nendobj\n');
    objectChunks.push(prefix);
    byteCursor += prefix.length;
    for (const part of parts) {
      const bytes = typeof part === 'string' ? encodeAscii(part) : part;
      objectChunks.push(bytes);
      byteCursor += bytes.length;
    }
    objectChunks.push(suffix);
    byteCursor += suffix.length;
  };

  const pageKidsRefs = Array.from({ length: pageCount }, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  pushObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  pushObject(2, [`<< /Type /Pages /Kids [ ${pageKidsRefs} ] /Count ${pageCount} >>`]);

  for (let i = 0; i < pageCount; i++) {
    const pageObj = 3 + i * 3;
    const imgObj = pageObj + 1;
    const contObj = pageObj + 2;
    const pg = pages[i];

    pushObject(pageObj, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT_W} ${A4_PT_H}] /Resources << /XObject << /Im${i} ${imgObj} 0 R >> >> /Contents ${contObj} 0 R >>`,
    ]);

    pushObject(imgObj, [
      `<< /Type /XObject /Subtype /Image /Width ${pg.pixelWidth} /Height ${pg.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpegBytes.length} >>\nstream\n`,
      pg.jpegBytes,
      '\nendstream',
    ]);

    const contentStream = `q\n${A4_PT_W} 0 0 ${A4_PT_H} 0 0 cm\n/Im${i} Do\nQ\n`;
    pushObject(contObj, [
      `<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`,
    ]);
  }

  const xrefStart = byteCursor;
  const xrefLines: string[] = [`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`];
  for (let objNum = 1; objNum <= totalObjects; objNum++) {
    xrefLines.push(`${String(offsets[objNum]).padStart(10, '0')} 00000 n \n`);
  }
  const trailer = `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const tailBytes = encodeAscii(xrefLines.join('') + trailer);
  objectChunks.push(tailBytes);
  byteCursor += tailBytes.length;

  const finalPdf = new Uint8Array(byteCursor);
  let writeAt = 0;
  for (const chunk of objectChunks) {
    finalPdf.set(chunk, writeAt);
    writeAt += chunk.length;
  }
  return finalPdf;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.9): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) throw new Error('Gagal mengonversi halaman ke JPEG.');
  return base64ToUint8Array(dataUrl.slice(commaIdx + 1));
}

function drawRegistrationMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const arm = 12;
  const inset = 6;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x + inset, y + inset + arm);
  ctx.lineTo(x + inset, y + inset);
  ctx.lineTo(x + inset + arm, y + inset);
  // Top-right
  ctx.moveTo(x + w - inset - arm, y + inset);
  ctx.lineTo(x + w - inset, y + inset);
  ctx.lineTo(x + w - inset, y + inset + arm);
  // Bottom-left
  ctx.moveTo(x + inset, y + h - inset - arm);
  ctx.lineTo(x + inset, y + h - inset);
  ctx.lineTo(x + inset + arm, y + h - inset);
  // Bottom-right
  ctx.moveTo(x + w - inset - arm, y + h - inset);
  ctx.lineTo(x + w - inset, y + h - inset);
  ctx.lineTo(x + w - inset, y + h - inset - arm);
  ctx.stroke();
  ctx.restore();
}

function drawMatrixCells(
  ctx: CanvasRenderingContext2D,
  lotNumber: string,
  x: number,
  y: number,
  size: number
) {
  const cells = computeLotMatrixCells(lotNumber);
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
  const pad = 4;
  const cell = (size - pad * 2) / 7;
  ctx.fillStyle = '#000000';
  cells.forEach((on, idx) => {
    if (on) {
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      ctx.fillRect(x + pad + col * cell, y + pad + row * cell, Math.ceil(cell), Math.ceil(cell));
    }
  });
  ctx.restore();
}

function drawFrontGradeCardSlot(
  ctx: CanvasRenderingContext2D,
  lotNumber: string,
  packagingChoices: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  options?: { graderName?: string; printYear?: number }
) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  drawRegistrationMarks(ctx, x, y, w, h);

  const pad = 16;
  const innerW = w - pad * 2;
  let curY = y + pad;

  // Header
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('TOBACCO LAB • KARTU GRADE', x + pad, curY + 13);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(lotNumber, x + pad, curY + 42);

  drawMatrixCells(ctx, lotNumber, x + w - pad - 50, curY + 1, 50);
  curY += 56;

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + pad, curY);
  ctx.lineTo(x + w - pad, curY);
  ctx.stroke();
  curY += 8;

  // Dedicated spacious Tanggal & Nama Grader boxes for effortless handwriting / pre-filled grader & year
  const halfW = (innerW - 10) / 2;
  const rawY = Number(options?.printYear);
  const yearLabel =
    Number.isFinite(rawY) && rawY >= 2020 && rawY <= 2099
      ? Math.round(rawY)
      : new Date().getFullYear();
  const cleanGrader = String(options?.graderName || '').trim().slice(0, 26);

  ctx.lineWidth = 1.6;
  ctx.strokeRect(x + pad, curY, halfW, 48);
  ctx.strokeRect(x + pad + halfW + 10, curY, halfW, 48);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 11.5px sans-serif';
  ctx.fillText('TANGGAL (TGL / BLN / THN)', x + pad + 8, curY + 15);
  ctx.fillText('NAMA GRADER', x + pad + halfW + 18, curY + 15);
  ctx.fillStyle = '#52525b';
  ctx.font = 'bold 13.5px monospace';
  ctx.fillText(`____ / ____ / ${yearLabel}`, x + pad + 8, curY + 38);
  if (cleanGrader) {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(cleanGrader, x + pad + halfW + 18, curY + 38);
  }
  curY += 55;

  // Identity boxes
  ctx.strokeRect(x + pad, curY, halfW, 50);
  ctx.strokeRect(x + pad + halfW + 10, curY, halfW, 50);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 11.5px sans-serif';
  ctx.fillText('PENJUAL / PETANI', x + pad + 8, curY + 15);
  ctx.fillText('DAERAH ASAL (MTL/TMG/WDS)', x + pad + halfW + 18, curY + 15);
  curY += 57;

  ctx.strokeRect(x + pad, curY, innerW, 48);
  ctx.fillText('NAMA / JENIS TEMBAKAU', x + pad + 8, curY + 15);
  curY += 56;

  // Grade Warna box
  const gradeBoxH = 70;
  ctx.strokeRect(x + pad, curY, innerW, gradeBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11.5px sans-serif';
  ctx.fillText('GRADE WARNA (SILANG X / CENTANG 1)', x + pad + 8, curY + 16);
  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
  const gColW = (innerW - 16) / 6;
  grades.forEach((gr, idx) => {
    const col = idx % 6;
    const row = Math.floor(idx / 6);
    const gx = x + pad + 8 + col * gColW;
    const gy = curY + 24 + row * 22;
    ctx.strokeRect(gx, gy, 15, 15);
    ctx.font = 'bold 14px monospace';
    ctx.fillText(gr, gx + 20, gy + 13);
  });
  curY += gradeBoxH + 8;

  // Kemasan box (clean 2-column layout so packaging labels aren't cut mid-parenthesis)
  const pkgBoxH = 58;
  ctx.strokeRect(x + pad, curY, innerW, pkgBoxH);
  ctx.font = 'bold 11.5px sans-serif';
  ctx.fillText('KEMASAN (SILANG X / CENTANG 1)', x + pad + 8, curY + 16);
  const pkgs = packagingChoices.slice(0, 3);
  const pkgItems = [...pkgs, 'Lainnya: ______'];
  const pColW = (innerW - 16) / 2;
  pkgItems.forEach((pk, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    if (row > 1) return;
    const px = x + pad + 8 + col * pColW;
    const py = curY + 24 + row * 18;
    ctx.strokeRect(px, py - 2, 13, 13);
    ctx.font = 'bold 11px sans-serif';
    const label = pk.length > 26 ? `${pk.slice(0, 24)}…` : pk;
    ctx.fillText(label, px + 18, py + 9);
  });
  curY += pkgBoxH + 8;

  // Karakter Rasa & Bakar box (2 cols x 3 rows, boxes placed right next to labels with zero dead void)
  const attrBoxH = 108;
  ctx.strokeRect(x + pad, curY, innerW, attrBoxH);
  ctx.font = 'bold 11.5px sans-serif';
  ctx.fillText('KARAKTER RASA & BAKAR (SILANG X ANGKA 1–5 • BULAT)', x + pad + 8, curY + 16);
  const attrs = ['POWER', 'IMPACT', 'BITTER', 'BURN', 'SUGAR', 'AROMA'];
  const aColW = (innerW - 24) / 2;
  attrs.forEach((label, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const ax = x + pad + 8 + col * (aColW + 10);
    const ay = curY + 26 + row * 26;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, ax, ay + 16);
    const labelColW = 70;
    const sqSize = 22;
    const sqGap = 5;
    const startX = ax + labelColW;
    for (let d = 1; d <= 5; d++) {
      const bx = startX + (d - 1) * (sqSize + sqGap);
      ctx.strokeRect(bx, ay, sqSize, sqSize);
      ctx.font = 'bold 13px monospace';
      ctx.fillText(String(d), bx + 7, ay + 16);
    }
  });
  curY += attrBoxH + 10;

  // Stage 2: Timbangan & Harga
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + pad, curY);
  ctx.lineTo(x + w - pad, curY);
  ctx.stroke();
  ctx.restore();
  curY += 14;

  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('TAHAP 2 (MENYUSUL — ISI & SCAN ULANG KARTU INI)', x + pad, curY);
  curY += 8;

  const remainingH = Math.max(48, y + h - pad - curY);
  const col3W = (innerW - 12) / 3;
  ['BRUTO (KG)', 'HARGA / KG (RP)', 'CATATAN'].forEach((title, idx) => {
    const bx = x + pad + idx * (col3W + 6);
    ctx.strokeRect(bx, curY, col3W, remainingH);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(title, bx + 7, curY + 15);
  });

  ctx.restore();
}

function drawBackGradeCardSlot(
  ctx: CanvasRenderingContext2D,
  lotNumber: string | null,
  customPrefix: string,
  rotate180: boolean,
  x: number,
  y: number,
  w: number,
  h: number,
  blankUnusedSlots: boolean = false
) {
  ctx.save();
  if (!lotNumber) {
    if (!blankUnusedSlots) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#71717a';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SLOT KOSONG (PENYEIMBANG DUPLEX)', x + w / 2, y + h / 2);
    }
    ctx.restore();
    return;
  }

  if (rotate180) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  drawRegistrationMarks(ctx, x, y, w, h);

  const pad = 20;
  const innerW = w - pad * 2;
  const prefixCode = extractLotPrefixCode(lotNumber, customPrefix);

  // Header + Prefix Badge
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('TOBACCO LAB • SISI BELAKANG', x + pad, y + pad + 16);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('BARCODE SCANNER LOT GUDANG', x + pad, y + pad + 40);

  const badgeW = Math.max(126, Math.min(200, prefixCode.length * 16 + 34));
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w - pad - badgeW, y + pad, badgeW, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('PREFIX CODE', x + w - pad - badgeW + 12, y + pad + 17);
  ctx.font = 'bold 21px monospace';
  ctx.fillText(prefixCode, x + w - pad - badgeW + 12, y + pad + 42);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad + 62);
  ctx.lineTo(x + w - pad, y + pad + 62);
  ctx.stroke();

  // Center Barcode Frame
  const frameY = y + pad + 90;
  const frameH = h - pad * 2 - 140;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + pad, frameY, innerW, frameH);

  // 1D Code 39 Barcode
  const runs = encodeCode39Modules(lotNumber);
  const totalUnits = computeCode39TotalUnits(runs);
  const matrixSize = 96;
  const barBoxW = innerW - matrixSize - 44;
  const unitPx = Math.max(1, Math.floor(barBoxW / totalUnits));
  const barW = unitPx * totalUnits;
  let barX = x + pad + 14 + Math.max(0, Math.floor((barBoxW - barW) / 2));
  const barY = frameY + 26;
  const barH = Math.max(85, frameH - 135);

  ctx.fillStyle = '#000000';
  for (const run of runs) {
    const rw = run.units * unitPx;
    if (run.isBar) {
      ctx.fillRect(barX, barY, rw, barH);
    }
    barX += rw;
  }

  // 2D Anchor
  drawMatrixCells(ctx, lotNumber, x + w - pad - matrixSize - 14, barY, matrixSize);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('2D ANCHOR', x + w - pad - matrixSize - 4, barY + matrixSize + 18);

  // Lot label
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + pad + 14, frameY + frameH - 58);
  ctx.lineTo(x + w - pad - 14, frameY + frameH - 58);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(lotNumber, x + w / 2, frameY + frameH - 18);
  ctx.textAlign = 'left';

  // Bottom footer
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + h - pad - 28);
  ctx.lineTo(x + w - pad, y + h - pad - 28);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`PREFIX: ${prefixCode}`, x + pad, y + h - pad - 6);
  ctx.textAlign = 'right';
  ctx.fillText('SCAN BARCODE UNTUK TAHAP 2 / CARI LOT', x + w - pad, y + h - pad - 6);
  ctx.textAlign = 'left';

  ctx.restore();
}

/**
 * Generates an exact A4 portrait PDF Blob (6 cards per A4 page + optional Duplex back barcode pages)
 * ready for reliable direct file download across mobile & desktop browsers.
 */
export function generateA4GradeCardsPdf(params: {
  lotBatchNumbers: (string | null)[];
  packagingChoices: string[];
  duplexMode: DuplexMode;
  customPrefix?: string;
  graderName?: string;
  printYear?: number;
  blankUnusedSlots?: boolean;
}): {
  blob: Blob;
  filename: string;
  physicalPageCount: number;
} {
  const {
    lotBatchNumbers,
    packagingChoices,
    duplexMode,
    customPrefix = '',
    graderName = '',
    printYear,
    blankUnusedSlots = false,
  } = params;
  const validLots = lotBatchNumbers.filter((l): l is string => Boolean(l));
  if (!validLots.length) {
    throw new Error('Tidak ada seri kartu untuk dibuat PDF.');
  }

  // 200 DPI crisp A4 dimensions (210mm x 297mm)
  const PAGE_W = 1654;
  const PAGE_H = 2339;
  const MARGIN_X = 64;
  const MARGIN_Y = 72;
  const GAP_X = 28;
  const GAP_Y = 26;

  const cardW = Math.floor((PAGE_W - MARGIN_X * 2 - GAP_X) / 2);
  const cardH = Math.floor((PAGE_H - MARGIN_Y * 2 - GAP_Y * 2) / 3);

  const pages: JpegPdfPageInput[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas PDF renderer tidak tersedia.');

  for (let start = 0; start < lotBatchNumbers.length; start += 6) {
    const pageLots = lotBatchNumbers.slice(start, start + 6);

    // Front A4 sheet (always 2 cols x 3 rows = 6 cards max per sheet; null slots stay 100% pure white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    pageLots.forEach((lot, idx) => {
      if (!lot) return;
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = MARGIN_X + col * (cardW + GAP_X);
      const y = MARGIN_Y + row * (cardH + GAP_Y);
      drawFrontGradeCardSlot(ctx, lot, packagingChoices, x, y, cardW, cardH, {
        graderName,
        printYear,
      });
    });
    pages.push({
      jpegBytes: canvasToJpegBytes(canvas, 0.9),
      pixelWidth: PAGE_W,
      pixelHeight: PAGE_H,
    });

    // Optional Duplex Back A4 sheet (mirrored / rotated per LONG_EDGE or SHORT_EDGE)
    if (duplexMode !== 'OFF') {
      const backSlots = arrangeDuplexBackSlots(pageLots, 6, duplexMode);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
      backSlots.forEach((slot, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = MARGIN_X + col * (cardW + GAP_X);
        const y = MARGIN_Y + row * (cardH + GAP_Y);
        drawBackGradeCardSlot(
          ctx,
          slot.lot,
          customPrefix,
          slot.rotate180,
          x,
          y,
          cardW,
          cardH,
          blankUnusedSlots
        );
      });
      pages.push({
        jpegBytes: canvasToJpegBytes(canvas, 0.9),
        pixelWidth: PAGE_W,
        pixelHeight: PAGE_H,
      });
    }
  }

  const pdfBytes = buildPdfDocumentFromJpegPages(pages);
  const blobBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(blobBuffer).set(pdfBytes);
  const blob = new Blob([blobBuffer], { type: 'application/pdf' });
  const first = validLots[0];
  const last = validLots[validLots.length - 1];
  const filename =
    validLots.length === 1
      ? `Kartu-Grade-CetakUlang-${first}.pdf`
      : `Kartu-Grade-${first}-sd-${last}.pdf`;

  return {
    blob,
    filename,
    physicalPageCount: pages.length,
  };
}
