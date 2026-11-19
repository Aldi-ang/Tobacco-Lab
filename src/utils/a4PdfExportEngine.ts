import {
  DuplexMode,
  arrangeDuplexBackSlots,
  buildGradeCardBarcodePayload,
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
  ctx.lineWidth = 3.5;
  ctx.strokeRect(x, y, w, h);
  drawRegistrationMarks(ctx, x, y, w, h);

  const pad = 16;
  const innerW = w - pad * 2;
  let curY = y + pad;

  const rawY = Number(options?.printYear);
  const yearLabel =
    Number.isFinite(rawY) && rawY >= 2020 && rawY <= 2099
      ? Math.round(rawY)
      : new Date().getFullYear();
  const cleanGrader = String(options?.graderName || '').trim().slice(0, 26);
  const barcodePayload = buildGradeCardBarcodePayload(lotNumber, cleanGrader) || lotNumber;

  // 1. Header: Lot + Date on left, crisp Front Code 39 Barcode (Lot + Fixed Grader) on right
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('TOBACCO LAB · KARTU GRADE (A4 4-KARTU BESAR)', x + pad, curY + 13);
  ctx.fillStyle = '#000000';
  ctx.font = '900 30px monospace';
  ctx.fillText(lotNumber, x + pad, curY + 45);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 14.5px monospace';
  ctx.fillText(`TGL: ____ / ____ / ${yearLabel}`, x + pad, curY + 68);

  // Front Code 39 Barcode block (right side of header)
  const frontBcBoxW = Math.min(395, Math.floor(innerW * 0.54));
  const frontBcX = x + w - pad - frontBcBoxW;
  const frontRuns = encodeCode39Modules(barcodePayload);
  const frontTotalUnits = computeCode39TotalUnits(frontRuns);
  const frontUnitPx = Math.max(1, (frontBcBoxW - 14) / frontTotalUnits);
  const frontBarW = frontUnitPx * frontTotalUnits;
  let fbx = frontBcX + Math.max(4, (frontBcBoxW - frontBarW) / 2);
  const fby = curY + 4;
  const fbh = 44;
  ctx.fillStyle = '#000000';
  for (const run of frontRuns) {
    const rw = run.units * frontUnitPx;
    if (run.isBar) {
      ctx.fillRect(fbx, fby, Math.max(1, rw), fbh);
    }
    fbx += rw;
  }
  ctx.font = 'bold 12.5px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`BC: ${barcodePayload}`, frontBcX + frontBcBoxW / 2, fby + fbh + 17);
  ctx.textAlign = 'left';

  curY += 78;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x + pad, curY);
  ctx.lineTo(x + w - pad, curY);
  ctx.stroke();
  curY += 10;

  // 2. Spacious 2-Row Identity Handwriting Boxes (68px tall each so handwriting is effortless!)
  const idRowH = 68;
  const graderColW = Math.floor(innerW * 0.41);
  const sellerColW = innerW - graderColW - 10;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(x + pad, curY, graderColW, idRowH);
  ctx.strokeRect(x + pad + graderColW + 10, curY, sellerColW, idRowH);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(cleanGrader ? 'NAMA GRADER (BARCODE)' : 'NAMA GRADER', x + pad + 9, curY + 17);
  ctx.fillText('PENJUAL / PETANI', x + pad + graderColW + 19, curY + 17);
  if (cleanGrader) {
    ctx.fillStyle = '#000000';
    ctx.font = '900 22px sans-serif';
    ctx.fillText(cleanGrader, x + pad + 9, curY + 50);
  }
  curY += idRowH + 7;

  const originColW = Math.floor(innerW * 0.44);
  const nameColW = innerW - originColW - 10;
  ctx.strokeRect(x + pad, curY, originColW, idRowH);
  ctx.strokeRect(x + pad + originColW + 10, curY, nameColW, idRowH);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('DAERAH ASAL (MTL/TMG/WDS)', x + pad + 9, curY + 17);
  ctx.fillText('NAMA / JENIS TEMBAKAU', x + pad + originColW + 19, curY + 17);
  curY += idRowH + 8;

  // 3. GRADE WARNA — Vertical pairs 2 rows x 7 columns (BIG 28x28 checkboxes!)
  // Row 1: A  B  C  D  E  F  G
  // Row 2: A+ B+ C+ D+ E+ F+ G+
  const gradeBoxH = 108;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x + pad, curY, innerW, gradeBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 13px sans-serif';
  ctx.fillText('GRADE WARNA (SILANG X SATU KOTAK)', x + pad + 10, curY + 18);
  const gradeRows: string[][] = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['A+', 'B+', 'C+', 'D+', 'E+', 'F+', 'G+'],
  ];
  const gColW = (innerW - 20) / 7;
  const gBoxSize = 27;
  gradeRows.forEach((rowGrades, rIdx) => {
    rowGrades.forEach((gr, cIdx) => {
      const gx = x + pad + 10 + cIdx * gColW;
      const gy = curY + 28 + rIdx * 40;
      ctx.lineWidth = 2.6;
      ctx.strokeRect(gx, gy, gBoxSize, gBoxSize);
      ctx.font = '900 19.5px monospace';
      ctx.fillText(gr, gx + gBoxSize + 7, gy + 21);
    });
  });
  curY += gradeBoxH + 8;

  // 4. KEMASAN — Dynamic ALL Master Kemasan types (zero hard truncation!) + Lainnya
  const normalizedPkgs = Array.from(
    new Set(
      (packagingChoices || [])
        .map((p) => String(p || '').trim())
        .filter(Boolean)
    )
  );
  const pkgItems = [...normalizedPkgs, 'Lainnya: ________'];
  const pkgCols = pkgItems.length <= 4 ? 2 : pkgItems.length <= 9 ? 3 : 4;
  const pkgRows = Math.max(1, Math.ceil(pkgItems.length / pkgCols));
  const pkgRowStep = pkgRows <= 2 ? 32 : pkgRows === 3 ? 27 : 23;
  const pkgBoxH = Math.min(138, 28 + pkgRows * pkgRowStep);
  const pkgSq = pkgRows <= 2 ? 21 : 18;

  ctx.lineWidth = 2.4;
  ctx.strokeRect(x + pad, curY, innerW, pkgBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 13px sans-serif';
  ctx.fillText('KEMASAN (SILANG X SATU KOTAK)', x + pad + 10, curY + 18);
  const pColW = (innerW - 20) / pkgCols;
  const maxLabelChars = pkgCols === 2 ? 28 : pkgCols === 3 ? 18 : 13;
  pkgItems.forEach((pk, idx) => {
    const col = idx % pkgCols;
    const row = Math.floor(idx / pkgCols);
    const py = curY + 27 + row * pkgRowStep;
    if (py + pkgSq > curY + pkgBoxH - 3) return;
    const px = x + pad + 10 + col * pColW;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(px, py, pkgSq, pkgSq);
    ctx.font = `bold ${pkgCols >= 4 ? 12 : 13}px sans-serif`;
    const label = pk.length > maxLabelChars ? `${pk.slice(0, maxLabelChars - 1)}…` : pk;
    ctx.fillText(label, px + pkgSq + 7, py + pkgSq - 3);
  });
  curY += pkgBoxH + 8;

  // 5. KARAKTER RASA & BAKAR — Single-column 6 rows with BIG wide-spaced [1][2][3][4][5] boxes!
  // Reserve 224px at the bottom for Tahap 2:
  // - Compact Row 1 (58px): BRUTO (KG) + HARGA / KG (RP)
  // - Giant Full-Width Row 2 (148px): CATATAN / KETERANGAN DETAIL (TAHAP 2) with 3 writing lines!
  const brutoHargaRowH = 58;
  const catatanFullBoxH = 148;
  const stage2Reserved = brutoHargaRowH + 8 + catatanFullBoxH + 18 + pad;
  const attrBoxH = Math.max(228, y + h - stage2Reserved - curY);

  ctx.lineWidth = 2.4;
  ctx.strokeRect(x + pad, curY, innerW, attrBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 13px sans-serif';
  ctx.fillText(
    'KARAKTER RASA & BAKAR (SILANG X SATU ANGKA 1–5 PER BARIS)',
    x + pad + 10,
    curY + 19
  );

  const attrs = ['POWER', 'IMPACT', 'BITTER', 'BURN', 'SUGAR', 'AROMA'];
  const rowsTop = curY + 27;
  const rowsAvailH = attrBoxH - 32;
  const rowStep = rowsAvailH / attrs.length;
  const sqSize = Math.max(27, Math.min(34, Math.floor(rowStep - 6)));
  const labelColW = 136;
  const boxesAvailW = innerW - 20 - labelColW;
  const sqGap = Math.max(18, Math.min(54, Math.floor((boxesAvailW - sqSize * 5) / 4)));
  const startX = x + pad + 12 + labelColW;

  attrs.forEach((label, rIdx) => {
    const rowTop = rowsTop + rIdx * rowStep;
    const boxY = rowTop + Math.max(2, (rowStep - sqSize) / 2);

    if (rIdx > 0) {
      ctx.save();
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + pad + 8, rowTop);
      ctx.lineTo(x + w - pad - 8, rowTop);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#000000';
    ctx.font = '900 17px sans-serif';
    ctx.fillText(label, x + pad + 12, boxY + sqSize * 0.72);

    for (let d = 1; d <= 5; d++) {
      const bx = startX + (d - 1) * (sqSize + sqGap);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, boxY, sqSize, sqSize);
      ctx.fillStyle = '#000000';
      ctx.font = '900 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(d), bx + sqSize / 2, boxY + sqSize * 0.72);
      ctx.textAlign = 'left';
    }
  });
  curY += attrBoxH + 8;

  // 6. TAHAP 2 — Compact Bruto + Harga row on top, GIANT Full-Width Multi-Line Catatan box below!
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + pad, curY);
  ctx.lineTo(x + w - pad, curY);
  ctx.stroke();
  ctx.restore();
  curY += 8;

  // Row 6A: Compact Bruto (42%) & Harga/Kg (58%)
  const brutoW = Math.floor(innerW * 0.42);
  const hargaW = innerW - brutoW - 10;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(x + pad, curY, brutoW, brutoHargaRowH);
  ctx.strokeRect(x + pad + brutoW + 10, curY, hargaW, brutoHargaRowH);
  ctx.fillStyle = '#18181b';
  ctx.font = '900 11.5px sans-serif';
  ctx.fillText('BRUTO (KG)', x + pad + 9, curY + 16);
  ctx.fillText('HARGA / KG (RP)', x + pad + brutoW + 19, curY + 16);
  curY += brutoHargaRowH + 8;

  // Row 6B: Giant Full-Width Multi-Line CATATAN / KETERANGAN DETAIL (TAHAP 2)
  const finalCatatanH = Math.max(115, y + h - pad - curY);
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x + pad, curY, innerW, finalCatatanH);
  ctx.fillStyle = '#18181b';
  ctx.font = '900 12px sans-serif';
  ctx.fillText('CATATAN / KETERANGAN DETAIL (TAHAP 2)', x + pad + 10, curY + 18);
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 10.5px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('RUANG TULIS EKSTRA LUAS', x + w - pad - 10, curY + 18);
  ctx.textAlign = 'left';

  // Draw 2 subtle dashed horizontal writing guide lines inside Catatan box (creates 3 full-width writing lines)
  ctx.save();
  ctx.strokeStyle = '#d4d4d8';
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.4;
  const lineAreaTop = curY + 26;
  const lineAreaH = finalCatatanH - 32;
  for (let l = 1; l <= 2; l++) {
    const ly = lineAreaTop + (lineAreaH * l) / 3;
    ctx.beginPath();
    ctx.moveTo(x + pad + 10, ly);
    ctx.lineTo(x + w - pad - 10, ly);
    ctx.stroke();
  }
  ctx.restore();

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
  blankUnusedSlots: boolean = false,
  graderName: string = ''
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
  ctx.lineWidth = 3.5;
  ctx.strokeRect(x, y, w, h);
  drawRegistrationMarks(ctx, x, y, w, h);

  const pad = 22;
  const innerW = w - pad * 2;
  const prefixCode = extractLotPrefixCode(lotNumber, customPrefix);
  const cleanGrader = String(graderName || '').trim().slice(0, 26);
  const barcodePayload = buildGradeCardBarcodePayload(lotNumber, cleanGrader) || lotNumber;

  // Header + Prefix Badge
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('TOBACCO LAB · SISI BELAKANG (A4 4-KARTU)', x + pad, y + pad + 18);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(
    cleanGrader ? `BARCODE LOT · GRADER: ${cleanGrader.toUpperCase()}` : 'BARCODE SCANNER LOT GUDANG',
    x + pad,
    y + pad + 45
  );

  const badgeW = Math.max(136, Math.min(220, prefixCode.length * 17 + 36));
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w - pad - badgeW, y + pad, badgeW, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('PREFIX CODE', x + w - pad - badgeW + 14, y + pad + 19);
  ctx.font = 'bold 23px monospace';
  ctx.fillText(prefixCode, x + w - pad - badgeW + 14, y + pad + 47);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad + 68);
  ctx.lineTo(x + w - pad, y + pad + 68);
  ctx.stroke();

  // Center Barcode Frame
  const frameY = y + pad + 110;
  const frameH = h - pad * 2 - 180;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + pad, frameY, innerW, frameH);

  // 1D Code 39 Barcode (correlates Lot + Fixed Grader Name)
  const runs = encodeCode39Modules(barcodePayload);
  const totalUnits = computeCode39TotalUnits(runs);
  const matrixSize = 112;
  const barBoxW = innerW - matrixSize - 48;
  const unitPx = Math.max(1, barBoxW / totalUnits);
  const barW = unitPx * totalUnits;
  let barX = x + pad + 16 + Math.max(0, Math.floor((barBoxW - barW) / 2));
  const barY = frameY + 46;
  const barH = Math.max(120, frameH - 185);

  ctx.fillStyle = '#000000';
  for (const run of runs) {
    const rw = run.units * unitPx;
    if (run.isBar) {
      ctx.fillRect(barX, barY, Math.max(1, rw), barH);
    }
    barX += rw;
  }

  // 2D Anchor
  drawMatrixCells(ctx, lotNumber, x + w - pad - matrixSize - 16, barY, matrixSize);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('2D ANCHOR', x + w - pad - matrixSize - 4, barY + matrixSize + 22);

  // Lot + Grader Barcode label
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x + pad + 16, frameY + frameH - 74);
  ctx.lineTo(x + w - pad - 16, frameY + frameH - 74);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${barcodePayload.length > 14 ? 30 : 38}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(barcodePayload, x + w / 2, frameY + frameH - 22);
  ctx.textAlign = 'left';

  // Bottom footer
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + h - pad - 34);
  ctx.lineTo(x + w - pad, y + h - pad - 34);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(
    cleanGrader ? `PREFIX: ${prefixCode} · GRD: ${cleanGrader.toUpperCase()}` : `PREFIX: ${prefixCode}`,
    x + pad,
    y + h - pad - 8
  );
  ctx.textAlign = 'right';
  ctx.fillText('SCAN BARCODE UNTUK TAHAP 2 / CARI LOT', x + w - pad, y + h - pad - 8);
  ctx.textAlign = 'left';

  ctx.restore();
}

/**
 * Generates an exact A4 portrait PDF Blob (4 large cards per A4 page in a 2x2 grid + optional Duplex back barcode pages)
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

  // 200 DPI crisp A4 dimensions (210mm x 297mm) — 2 columns x 2 rows = 4 large cards per A4 page
  const PAGE_W = 1654;
  const PAGE_H = 2339;
  const MARGIN_X = 64;
  const MARGIN_Y = 72;
  const GAP_X = 32;
  const GAP_Y = 34;

  const cardW = Math.floor((PAGE_W - MARGIN_X * 2 - GAP_X) / 2);
  const cardH = Math.floor((PAGE_H - MARGIN_Y * 2 - GAP_Y) / 2);

  const pages: JpegPdfPageInput[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas PDF renderer tidak tersedia.');

  for (let start = 0; start < lotBatchNumbers.length; start += 4) {
    const pageLots = lotBatchNumbers.slice(start, start + 4);

    // Front A4 sheet (always 2 cols x 2 rows = 4 large cards max per sheet; null slots stay 100% pure white)
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

    // Optional Duplex Back A4 sheet (mirrored / rotated per LONG_EDGE or SHORT_EDGE for 2x2 grid)
    if (duplexMode !== 'OFF') {
      const backSlots = arrangeDuplexBackSlots(pageLots, 4, duplexMode);
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
          blankUnusedSlots,
          graderName
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
