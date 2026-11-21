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
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  drawRegistrationMarks(ctx, x, y, w, h);

  const pad = 12;
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
  ctx.font = 'bold 10.5px sans-serif';
  ctx.fillText('TOBACCO LAB · KARTU GRADE', x + pad, curY + 11);
  ctx.fillStyle = '#000000';
  ctx.font = '900 24px monospace';
  ctx.fillText(lotNumber, x + pad, curY + 37);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`TGL: ____ / ____ / ${yearLabel}`, x + pad, curY + 54);

  // Front Code 39 Barcode block (right side of header)
  const frontBcBoxW = Math.min(365, Math.floor(innerW * 0.54));
  const frontBcX = x + w - pad - frontBcBoxW;
  const frontRuns = encodeCode39Modules(barcodePayload);
  const frontTotalUnits = computeCode39TotalUnits(frontRuns);
  const frontUnitPx = Math.max(1, (frontBcBoxW - 12) / frontTotalUnits);
  const frontBarW = frontUnitPx * frontTotalUnits;
  let fbx = frontBcX + Math.max(4, (frontBcBoxW - frontBarW) / 2);
  const fby = curY + 2;
  const fbh = 33;
  ctx.fillStyle = '#000000';
  for (const run of frontRuns) {
    const rw = run.units * frontUnitPx;
    if (run.isBar) {
      ctx.fillRect(fbx, fby, Math.max(1, rw), fbh);
    }
    fbx += rw;
  }
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`BC: ${barcodePayload}`, frontBcX + frontBcBoxW / 2, fby + fbh + 14);
  ctx.textAlign = 'left';

  curY += 60;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + pad, curY);
  ctx.lineTo(x + w - pad, curY);
  ctx.stroke();
  curY += 6;

  // 2. 2-Row Identity Handwriting Boxes
  const idRowH = 44;
  const graderColW = Math.floor(innerW * 0.41);
  const sellerColW = innerW - graderColW - 8;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(x + pad, curY, graderColW, idRowH);
  ctx.strokeRect(x + pad + graderColW + 8, curY, sellerColW, idRowH);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(cleanGrader ? 'NAMA GRADER (BARCODE)' : 'NAMA GRADER', x + pad + 7, curY + 14);
  ctx.fillText('PENJUAL / PETANI', x + pad + graderColW + 15, curY + 14);
  if (cleanGrader) {
    ctx.fillStyle = '#000000';
    ctx.font = '900 17px sans-serif';
    ctx.fillText(cleanGrader, x + pad + 7, curY + 35);
  }
  curY += idRowH + 5;

  const originColW = Math.floor(innerW * 0.44);
  const nameColW = innerW - originColW - 8;
  ctx.strokeRect(x + pad, curY, originColW, idRowH);
  ctx.strokeRect(x + pad + originColW + 8, curY, nameColW, idRowH);
  ctx.fillStyle = '#27272a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('DAERAH ASAL (MTL/TMG/WDS)', x + pad + 7, curY + 14);
  ctx.fillText('NAMA / JENIS TEMBAKAU', x + pad + originColW + 15, curY + 14);
  curY += idRowH + 6;

  // 3. GRADE WARNA — Vertical pairs 2 rows x 7 columns (A..G over A+..G+)
  const gradeBoxH = 78;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + pad, curY, innerW, gradeBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 10.5px sans-serif';
  ctx.fillText('GRADE WARNA (SILANG X SATU KOTAK)', x + pad + 8, curY + 14);
  const gradeRows: string[][] = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['A+', 'B+', 'C+', 'D+', 'E+', 'F+', 'G+'],
  ];
  const gColW = (innerW - 16) / 7;
  const gBoxSize = 21;
  gradeRows.forEach((rowGrades, rIdx) => {
    rowGrades.forEach((gr, cIdx) => {
      const gx = x + pad + 8 + cIdx * gColW;
      const gy = curY + 21 + rIdx * 28;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(gx, gy, gBoxSize, gBoxSize);
      ctx.font = '900 15.5px monospace';
      ctx.fillText(gr, gx + gBoxSize + 6, gy + 16.5);
    });
  });
  curY += gradeBoxH + 6;

  // 4. KEMASAN — Dynamic ALL Master Kemasan types + Lainnya
  const normalizedPkgs = Array.from(
    new Set(
      (packagingChoices || [])
        .map((p) => String(p || '').trim())
        .filter(Boolean)
    )
  );
  const pkgItems = [...normalizedPkgs, 'Lainnya: ______'];
  const pkgCols = pkgItems.length <= 4 ? 2 : pkgItems.length <= 9 ? 3 : 4;
  const pkgRows = Math.max(1, Math.ceil(pkgItems.length / pkgCols));
  const pkgRowStep = pkgRows <= 2 ? 23 : pkgRows === 3 ? 20 : 17.5;
  const pkgBoxH = Math.min(92, 22 + pkgRows * pkgRowStep);
  const pkgSq = pkgRows <= 2 ? 16 : 14;

  ctx.lineWidth = 2;
  ctx.strokeRect(x + pad, curY, innerW, pkgBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 10.5px sans-serif';
  ctx.fillText('KEMASAN (SILANG X SATU KOTAK)', x + pad + 8, curY + 14);
  const pColW = (innerW - 16) / pkgCols;
  const maxLabelChars = pkgCols === 2 ? 28 : pkgCols === 3 ? 18 : 13;
  pkgItems.forEach((pk, idx) => {
    const col = idx % pkgCols;
    const row = Math.floor(idx / pkgCols);
    const py = curY + 21 + row * pkgRowStep;
    if (py + pkgSq > curY + pkgBoxH - 2) return;
    const px = x + pad + 8 + col * pColW;
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pkgSq, pkgSq);
    ctx.font = `bold ${pkgCols >= 4 ? 10.5 : 11.5}px sans-serif`;
    const label = pk.length > maxLabelChars ? `${pk.slice(0, maxLabelChars - 1)}…` : pk;
    ctx.fillText(label, px + pkgSq + 6, py + pkgSq - 2);
  });
  curY += pkgBoxH + 6;

  // 5. KARAKTER RASA, BAKAR & MATURITY — 7 rows with crisp [1][2][3][4][5] boxes!
  // Reserve 62px at bottom ONLY for BRUTO (KG) & HARGA / KG (RP) — Notes live on the back below Barcode!
  const brutoHargaRowH = 44;
  const stage2Reserved = brutoHargaRowH + 14 + pad;
  const attrBoxH = Math.max(220, y + h - stage2Reserved - curY);

  ctx.lineWidth = 2;
  ctx.strokeRect(x + pad, curY, innerW, attrBoxH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 10.5px sans-serif';
  ctx.fillText(
    'KARAKTER RASA, BAKAR & MATURITY (SILANG X SATU ANGKA 1–5 PER BARIS)',
    x + pad + 8,
    curY + 15
  );

  const attrs: { label: string; hint?: string }[] = [
    { label: 'POWER' },
    { label: 'IMPACT' },
    { label: 'BITTER' },
    { label: 'BURN' },
    { label: 'SUGAR' },
    { label: 'AROMA' },
    { label: 'MATURITY', hint: '1:TdkMtg 2:Lmy 3:Matang 4:Klw 5:Busuk' },
  ];
  const rowsTop = curY + 22;
  const rowsAvailH = attrBoxH - 25;
  const rowStep = rowsAvailH / attrs.length;
  const sqSize = Math.max(22, Math.min(28, Math.floor(rowStep - 6)));
  const labelColW = 195;
  const boxesAvailW = innerW - 18 - labelColW;
  const sqGap = Math.max(16, Math.min(48, Math.floor((boxesAvailW - sqSize * 5) / 4)));
  const startX = x + pad + 10 + labelColW;

  attrs.forEach((attr, rIdx) => {
    const rowTop = rowsTop + rIdx * rowStep;
    const boxY = rowTop + Math.max(2, (rowStep - sqSize) / 2);

    if (rIdx > 0) {
      ctx.save();
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + pad + 6, rowTop);
      ctx.lineTo(x + w - pad - 6, rowTop);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#000000';
    ctx.font = '900 14.5px sans-serif';
    if (attr.hint) {
      ctx.fillText(attr.label, x + pad + 10, boxY + sqSize * 0.56);
      ctx.fillStyle = '#52525b';
      ctx.font = 'bold 8.5px sans-serif';
      ctx.fillText(attr.hint, x + pad + 10, boxY + sqSize * 0.98);
    } else {
      ctx.fillText(attr.label, x + pad + 10, boxY + sqSize * 0.72);
    }

    for (let d = 1; d <= 5; d++) {
      const bx = startX + (d - 1) * (sqSize + sqGap);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(bx, boxY, sqSize, sqSize);
      ctx.fillStyle = '#000000';
      ctx.font = '900 17px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(d), bx + sqSize / 2, boxY + sqSize * 0.72);
      ctx.textAlign = 'left';
    }
  });
  curY += attrBoxH + 6;

  // 6. TAHAP 2 — Front Strip ONLY contains Bruto (Kg) + Harga/Kg (Rp)
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x + pad, curY);
  ctx.lineTo(x + w - pad, curY);
  ctx.stroke();
  ctx.restore();
  curY += 6;

  const finalRowH = Math.max(36, y + h - pad - curY);
  const brutoW = Math.floor(innerW * 0.42);
  const hargaW = innerW - brutoW - 8;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + pad, curY, brutoW, finalRowH);
  ctx.strokeRect(x + pad + brutoW + 8, curY, hargaW, finalRowH);
  ctx.fillStyle = '#18181b';
  ctx.font = '900 10.5px sans-serif';
  ctx.fillText('BRUTO (KG)', x + pad + 8, curY + 14);
  ctx.fillText('HARGA / KG (RP)', x + pad + brutoW + 16, curY + 14);

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
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  drawRegistrationMarks(ctx, x, y, w, h);

  const pad = 16;
  const innerW = w - pad * 2;
  const prefixCode = extractLotPrefixCode(lotNumber, customPrefix);
  const cleanGrader = String(graderName || '').trim().slice(0, 26);
  const barcodePayload = buildGradeCardBarcodePayload(lotNumber, cleanGrader) || lotNumber;

  // 1. Header + Prefix Badge
  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('TOBACCO LAB · SISI BELAKANG (A4 6-KARTU)', x + pad, y + pad + 14);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16.5px sans-serif';
  ctx.fillText(
    cleanGrader ? `BARCODE LOT · GRADER: ${cleanGrader.toUpperCase()}` : 'BARCODE SCANNER LOT GUDANG',
    x + pad,
    y + pad + 36
  );

  const badgeW = Math.max(120, Math.min(200, prefixCode.length * 15 + 32));
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + w - pad - badgeW, y + pad, badgeW, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10.5px sans-serif';
  ctx.fillText('PREFIX CODE', x + w - pad - badgeW + 12, y + pad + 15);
  ctx.font = 'bold 19px monospace';
  ctx.fillText(prefixCode, x + w - pad - badgeW + 12, y + pad + 37);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + pad + 54);
  ctx.lineTo(x + w - pad, y + pad + 54);
  ctx.stroke();

  // 2. Normal-Size Crisp Barcode Box (upper band directly above Catatan)
  const frameY = y + pad + 66;
  const frameH = 148;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x + pad, frameY, innerW, frameH);

  const runs = encodeCode39Modules(barcodePayload);
  const totalUnits = computeCode39TotalUnits(runs);
  const matrixSize = 76;
  const barBoxW = innerW - matrixSize - 42;
  const unitPx = Math.max(1, barBoxW / totalUnits);
  const barW = unitPx * totalUnits;
  let barX = x + pad + 14 + Math.max(0, Math.floor((barBoxW - barW) / 2));
  const barY = frameY + 14;
  const barH = 74;

  ctx.fillStyle = '#000000';
  for (const run of runs) {
    const rw = run.units * unitPx;
    if (run.isBar) {
      ctx.fillRect(barX, barY, Math.max(1, rw), barH);
    }
    barX += rw;
  }

  // 2D Anchor
  drawMatrixCells(ctx, lotNumber, x + w - pad - matrixSize - 14, barY, matrixSize);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('2D ANCHOR', x + w - pad - matrixSize - 4, barY + matrixSize + 15);

  // Lot + Grader Barcode Payload Text
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + pad + 14, frameY + frameH - 36);
  ctx.lineTo(x + w - pad - 14, frameY + frameH - 36);
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${barcodePayload.length > 14 ? 22 : 26}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(barcodePayload, x + w / 2, frameY + frameH - 10);
  ctx.textAlign = 'left';

  // 3. GIANT Multi-Line CATATAN / KETERANGAN DETAIL (TAHAP 2) Box right below the Barcode!
  const catatanY = frameY + frameH + 14;
  const footerReserved = 32;
  const catatanH = Math.max(160, y + h - pad - footerReserved - catatanY);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.4;
  ctx.strokeRect(x + pad, catatanY, innerW, catatanH);
  ctx.fillStyle = '#000000';
  ctx.font = '900 13px sans-serif';
  ctx.fillText('CATATAN / KETERANGAN DETAIL (TAHAP 2)', x + pad + 12, catatanY + 20);
  ctx.fillStyle = '#71717a';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('RUANG TULIS EKSTRA LUAS', x + w - pad - 12, catatanY + 20);
  ctx.textAlign = 'left';

  // 4 dashed horizontal writing guide lines inside Catatan (5 spacious writing lines!)
  ctx.save();
  ctx.strokeStyle = '#d4d4d8';
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1.5;
  const lineAreaTop = catatanY + 32;
  const lineAreaH = catatanH - 42;
  for (let l = 1; l <= 4; l++) {
    const ly = lineAreaTop + (lineAreaH * l) / 5;
    ctx.beginPath();
    ctx.moveTo(x + pad + 12, ly);
    ctx.lineTo(x + w - pad - 12, ly);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Bottom footer
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + h - pad - 24);
  ctx.lineTo(x + w - pad, y + h - pad - 24);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#3f3f46';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(
    cleanGrader ? `PREFIX: ${prefixCode} · GRD: ${cleanGrader.toUpperCase()}` : `PREFIX: ${prefixCode}`,
    x + pad,
    y + h - pad - 4
  );
  ctx.textAlign = 'right';
  ctx.fillText('SCAN BARCODE UNTUK TAHAP 2 / CARI LOT', x + w - pad, y + h - pad - 4);
  ctx.textAlign = 'left';

  ctx.restore();
}

/**
 * Generates an exact A4 portrait PDF Blob (6 cards per A4 page in a 2x3 grid + optional Duplex back barcode + notes pages)
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

  // 200 DPI crisp A4 dimensions (210mm x 297mm) — 2 columns x 3 rows = 6 cards per A4 page
  const PAGE_W = 1654;
  const PAGE_H = 2339;
  const MARGIN_X = 64;
  const MARGIN_Y = 54;
  const GAP_X = 32;
  const GAP_Y = 28;

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

    // Optional Duplex Back A4 sheet (mirrored / rotated per LONG_EDGE or SHORT_EDGE for 2x3 grid)
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
