import {
  FinishedTobaccoSerial,
  RawTobacco,
  TobaccoRollSample,
} from '../types/tobacco';
import {
  formatSheetRp,
  formatSerialLineage,
  calculateRawTobaccoCost,
} from './tobaccoMath';

export function extractSpreadsheetId(input: string): string {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export interface RollTableBlockMeta {
  infoLabelRowIndex: number; // 0-based
  infoValueRowIndex: number; // 0-based
  tableHeaderRowIndex: number; // 0-based
  dataStartRowIndex: number; // 0-based
  dataEndRowIndex: number; // 0-based (exclusive)
  subtotalRowIndex: number; // 0-based
}

export function buildAllRollsHistoryRowsWithMeta(
  rollSamples: TobaccoRollSample[],
  finishedBatches: FinishedTobaccoSerial[]
): {
  rows: (string | number)[][];
  blocks: RollTableBlockMeta[];
} {
  const rows: (string | number)[][] = [];
  const blocks: RollTableBlockMeta[] = [];

  const exportDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Row 0: Merged full-width banner title so text never gets clipped
  rows.push([
    `LAPORAN RIWAYAT NOTA GULUNGAN — TOBACCO LAB (Diekspor: ${exportDateStr})`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  // Row 1: Spacer row
  rows.push([]);

  rollSamples.forEach((roll) => {
    const serialsInRoll = finishedBatches.filter(
      (b) =>
        b.rollId === roll.id ||
        b.rollNumber === roll.rollNumber ||
        b.previousRollId === roll.id ||
        (b.previousRollNumber && b.previousRollNumber.includes(roll.rollNumber))
    );

    const formattedDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const stageLabel = roll.isSentToFactory
      ? 'SUDAH DIKIRIM KE PABRIK'
      : 'MASIH DI GUDANG';

    // Use 2 vertical cells for Gulungan metadata (Label on top row, Value on bottom row)
    // so long names like "PT Gudang Garam Tbk - Kediri" or "SETORAN TERI..." never collide!
    const infoLabelRowIndex = rows.length;
    rows.push([
      'KODE GULUNGAN',
      '',
      'NAMA SETORAN / RESEP',
      '',
      '',
      'PABRIK TUJUAN',
      '',
      '',
      'TANGGAL SETOR',
      '',
      'STATUS BARANG',
      '',
      'JUMLAH SERI',
      '',
    ]);

    const infoValueRowIndex = rows.length;
    rows.push([
      roll.rollNumber,
      '',
      roll.recipeName,
      '',
      '',
      roll.targetFactory,
      '',
      '',
      formattedDate,
      '',
      stageLabel,
      '',
      `${serialsInRoll.length} Keranjang`,
      '',
    ]);

    const tableHeaderRowIndex = rows.length;
    rows.push([
      'NO',
      'SERI AKTIF',
      'RIWAYAT SERI\n(ASAL -> BARU)',
      'STATUS PABRIK\nDI GULUNGAN INI',
      'BRUTO\n(KG)',
      'TARA\n(KG)',
      'NETTO TAGIH\n(KG)',
      'JENIS\nKEMASAN',
      'GRADE',
      'HARGA MODAL\n/ KG',
      'JUMLAH MODAL\nKITA',
      'HARGA PABRIK\n/ KG',
      'JUMLAH NOTA\nPABRIK',
      'PROFIT BERSIH\n(NOTA - MODAL)',
    ]);

    const dataStartRowIndex = rows.length;

    let sumBruto = 0;
    let sumTara = 0;
    let sumNetto = 0;
    let sumModal = 0;
    let sumNota = 0;
    let sumProfit = 0;

    serialsInRoll.forEach((s, idx) => {
      const movedToAnotherRoll = s.rollId !== roll.id && s.rollNumber !== roll.rollNumber;
      const paymentSuffix =
        s.paymentStatus === 'CAIR' ? ' (CAIR)' : ' (BELUM CAIR)';
      const statusInThisRoll = movedToAnotherRoll
        ? `REJECTED -> PINDAH (${s.rollNumber})`
        : s.factoryStatus === 'ACCEPTED_CAIR'
          ? `DITERIMA / ACCEPTED${paymentSuffix}`
          : s.factoryStatus === 'REJECTED_STOCK'
            ? 'REJECT KE STOK'
            : 'MENUNGGU PABRIK';

      const bruto = Number(s.packaging.grossWeightPerPackage || 0);
      const tara = Number(s.factoryDeductionKg || 0);
      const netto = Number(Math.max(0, bruto - tara).toFixed(2));
      const modalPerKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg || 0);
      const jumlahModal = Math.round(s.totalProductionCost || netto * modalPerKg);
      const hargaPabrik = Math.round(s.factoryTargetPricePerKg || 0);
      const jumlahNota = Math.round(netto * hargaPabrik);
      const profit = jumlahNota - jumlahModal;

      if (!movedToAnotherRoll) {
        sumBruto += bruto;
        sumTara += tara;
        sumNetto += netto;
        sumModal += jumlahModal;
        sumNota += jumlahNota;
        sumProfit += profit;
      }

      rows.push([
        idx + 1,
        s.serialNumber,
        formatSerialLineage(s),
        statusInThisRoll,
        bruto,
        tara,
        netto,
        (s.packaging.packagingType || 'KRJ MUNTILAN').toUpperCase(),
        s.compositeColorGrade,
        formatSheetRp(modalPerKg),
        formatSheetRp(jumlahModal),
        formatSheetRp(hargaPabrik),
        formatSheetRp(jumlahNota),
        formatSheetRp(profit),
      ]);
    });

    if (serialsInRoll.length === 0) {
      rows.push([
        '-',
        '-',
        '-',
        'BELUM ADA SERI',
        0,
        0,
        0,
        '-',
        '-',
        formatSheetRp(0),
        formatSheetRp(0),
        formatSheetRp(0),
        formatSheetRp(0),
        formatSheetRp(0),
      ]);
    }

    const dataEndRowIndex = rows.length;
    const subtotalRowIndex = rows.length;

    rows.push([
      'SUBTOTAL AKTIF',
      roll.rollNumber,
      roll.recipeName,
      `${serialsInRoll.length} Seri`,
      Number(sumBruto.toFixed(2)),
      Number(sumTara.toFixed(2)),
      Number(sumNetto.toFixed(2)),
      '',
      '',
      'TOTAL:',
      formatSheetRp(sumModal),
      '',
      formatSheetRp(sumNota),
      formatSheetRp(sumProfit),
    ]);

    blocks.push({
      infoLabelRowIndex,
      infoValueRowIndex,
      tableHeaderRowIndex,
      dataStartRowIndex,
      dataEndRowIndex,
      subtotalRowIndex,
    });

    // Empty spacer row between Gulungan tables
    rows.push([]);
  });

  return { rows, blocks };
}

export function buildAllRollsHistoryRows(
  rollSamples: TobaccoRollSample[],
  finishedBatches: FinishedTobaccoSerial[]
): (string | number)[][] {
  return buildAllRollsHistoryRowsWithMeta(rollSamples, finishedBatches).rows;
}

export function buildAllSerialStatusRows(
  finishedBatches: FinishedTobaccoSerial[]
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  rows.push([
    'NO',
    'SERI AKTIF',
    'JEJAK PERUBAHAN SERI\n(ASAL -> BARU)',
    'STATUS PABRIK\nSAAT INI',
    'GULUNGAN\nAKTIF',
    'EKS-GULUNGAN\n(SEBELUMNYA)',
    'PABRIK TUJUAN\nAKTIF',
    'EKS-PABRIK\n(SEBELUMNYA)',
    'TANGGAL\nDIBUAT',
    'JENIS\nKEMASAN',
    'GRADE',
    'BRUTO\n(KG)',
    'TARA PABRIK\n(KG)',
    'NETTO TAGIH\n(KG)',
    'NETTO RIIL\nTEMBAKAU (KG)',
    'SELISIH TIMBANGAN\nPABRIK (KG)',
    'MODAL PRODUKSI\n/ KG',
    'TOTAL MODAL\nPRODUKSI',
    'HARGA PABRIK\n/ KG',
    'TOTAL TAGIHAN\nNOTA PABRIK',
    'PROFIT BERSIH\n(NOTA - MODAL)',
    'CATATAN / RIWAYAT PINDAH GULUNGAN',
  ]);

  let sumBruto = 0;
  let sumTara = 0;
  let sumNetto = 0;
  let sumRealNetto = 0;
  let sumModal = 0;
  let sumNota = 0;
  let sumProfit = 0;

  finishedBatches.forEach((b, idx) => {
    const bruto = Number(b.packaging.grossWeightPerPackage || 0);
    const tara = Number(b.factoryDeductionKg || 0);
    const netto = Number(Math.max(0, bruto - tara).toFixed(2));
    const realPkg = b.packaging.packagingMassKg ?? tara;
    const realNetto =
      b.packaging.netTobaccoWeightKg ??
      b.totalBlendNetKg ??
      Number(Math.max(0, bruto - realPkg).toFixed(2));
    const wpKg = b.factoryWeightProfitKg ?? Number((netto - realNetto).toFixed(2));
    const modalPerKg = Math.round(b.effectiveHppAfterTaraPerKg || b.hppPerNetKg || 0);
    const totalModal = Math.round(b.totalProductionCost || netto * modalPerKg);
    const hargaPabrik = Math.round(b.factoryTargetPricePerKg || 0);
    const totalNota = Math.round(netto * hargaPabrik);
    const profit = totalNota - totalModal;

    const paymentSuffix =
      b.paymentStatus === 'CAIR' ? ' (CAIR)' : ' (BELUM CAIR)';
    const statusLabel =
      b.factoryStatus === 'ACCEPTED_CAIR'
        ? `DITERIMA / ACCEPTED${paymentSuffix}`
        : b.factoryStatus === 'REJECTED_STOCK'
          ? 'REJECT KE STOK'
          : 'MENUNGGU PABRIK';

    const transferNotes =
      b.transferHistory && b.transferHistory.length > 0
        ? b.transferHistory
            .map(
              (t) =>
                `[${t.date}] ${t.fromSerialNumber} -> ${t.toSerialNumber} (${t.fromRollNumber} -> ${t.toRollNumber} / ${t.toFactory})`
            )
            .join(' | ')
        : b.rejectionNotes || b.notes || '-';

    sumBruto += bruto;
    sumTara += tara;
    sumNetto += netto;
    sumRealNetto += realNetto;
    sumModal += totalModal;
    sumNota += totalNota;
    sumProfit += profit;

    rows.push([
      idx + 1,
      b.serialNumber,
      formatSerialLineage(b),
      statusLabel,
      b.rollNumber || '-',
      b.previousRollNumber || '-',
      b.targetFactory,
      b.previousFactory || '-',
      b.createdAt,
      (b.packaging.packagingType || 'KRJ MUNTILAN').toUpperCase(),
      b.compositeColorGrade,
      bruto,
      tara,
      netto,
      realNetto,
      wpKg,
      formatSheetRp(modalPerKg),
      formatSheetRp(totalModal),
      formatSheetRp(hargaPabrik),
      formatSheetRp(totalNota),
      formatSheetRp(profit),
      transferNotes,
    ]);
  });

  rows.push([
    'TOTAL',
    `${finishedBatches.length} SERI`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    Number(sumBruto.toFixed(2)),
    Number(sumTara.toFixed(2)),
    Number(sumNetto.toFixed(2)),
    Number(sumRealNetto.toFixed(2)),
    '',
    'TOTAL:',
    formatSheetRp(sumModal),
    '',
    formatSheetRp(sumNota),
    formatSheetRp(sumProfit),
    '',
  ]);

  return rows;
}

export function buildRawTobaccoRows(rawTobaccos: RawTobacco[]): (string | number)[][] {
  const rows: (string | number)[][] = [];

  rows.push([
    'NO',
    'KODE LOT',
    'NAMA TEMBAKAU\nMENTAH',
    'DAERAH ASAL',
    'PENJUAL /\nPENGEPUL',
    'TANGGAL\nBELI',
    'GRADE',
    'JENIS\nKEMASAN',
    'BRUTO\n(KG)',
    'WADAH RIIL\n(KG)',
    'POTONGAN NOTA\n(KG)',
    'NETTO BAYAR\nNOTA (KG)',
    'NETTO RIIL\nFISIK (KG)',
    'HARGA BELI\n/ KG',
    'TOTAL KITA BAYAR\n(NOTA BELI)',
    'NILAI BARANG RIIL\n(FISIK GUDANG)',
    'SELISIH TIMBANGAN\nBELI (KG)',
    'NILAI SELISIH\nBELI (RP)',
    'SISA STOK\nGUDANG (KG)',
  ]);

  rawTobaccos.forEach((t, idx) => {
    const calc = calculateRawTobaccoCost({
      grossWeightKg: t.grossWeightKg,
      pricePerKgPurchase: t.pricePerKgPurchase,
      taraFormula: t.taraFormula,
    });
    const realPkg = t.taraFormula.packagingMassKg ?? t.deductionKg;
    const paidNet = t.netWeightKg ?? calc.netWeightKg;
    const realNet = t.realNetWeightKg ?? calc.realNetWeightKg;
    const paidVal = t.totalModalAsal || calc.totalModalAsal;
    const realVal = t.realStockValueRp ?? calc.realStockValueRp;
    const wpKg = t.purchaseWeightProfitKg ?? Number((realNet - paidNet).toFixed(2));
    const wpRp = t.purchaseWeightProfitRp ?? realVal - paidVal;

    rows.push([
      idx + 1,
      t.lotNumber,
      t.name,
      t.origin,
      t.sellerName || '-',
      t.purchaseDate,
      t.colorGrade,
      t.taraFormula.packagingType || 'Standar',
      t.grossWeightKg,
      realPkg,
      t.deductionKg,
      paidNet,
      realNet,
      formatSheetRp(t.pricePerKgPurchase),
      formatSheetRp(paidVal),
      formatSheetRp(realVal),
      wpKg,
      formatSheetRp(wpRp),
      t.currentStockNetKg,
    ]);
  });

  return rows;
}

/**
 * Builds the "Ringkasan & Grafik Profit" sheet rows for TOTAL GULUNGAN & PER PABRIK
 * so Google Sheets' native chart engine plots Total Semua Gulungan alongside each Pabrik.
 */
export function buildProfitSummaryAndChartRows(
  rollSamples: TobaccoRollSample[],
  finishedBatches: FinishedTobaccoSerial[]
): {
  rows: (string | number)[][];
  rollRowCount: number;
} {
  const rows: (string | number)[][] = [];

  // Row 0: Table Header for Chart Data (Total Gulungan & Per Pabrik)
  rows.push([
    'TOTAL GULUNGAN & PER PABRIK',
    'RINCIAN GULUNGAN & SERI',
    'PENDAPATAN NOTA (RP)',
    'MODAL PRODUKSI (RP)',
    'PROFIT BERSIH (RP)',
    'DITERIMA / ACCEPTED (RP)',
    'NILAI REJECT / RUGI (RP)',
    'MARGIN PROFIT (%)',
  ]);

  let totalNotaAll = 0;
  let totalModalAll = 0;
  let totalProfitAll = 0;
  let totalAcceptedAll = 0;
  let totalRejectAll = 0;
  let totalActiveSeriAll = 0;

  // Group metrics per Pabrik
  const factoryMap = new Map<
    string,
    {
      rollIds: Set<string>;
      activeSeriCount: number;
      sumNota: number;
      sumModal: number;
      sumAccepted: number;
      sumReject: number;
    }
  >();

  const ensureFactoryEntry = (facName: string) => {
    const clean = (facName || 'Pabrik Lainnya').trim();
    if (!factoryMap.has(clean)) {
      factoryMap.set(clean, {
        rollIds: new Set<string>(),
        activeSeriCount: 0,
        sumNota: 0,
        sumModal: 0,
        sumAccepted: 0,
        sumReject: 0,
      });
    }
    return factoryMap.get(clean)!;
  };

  rollSamples.forEach((roll) => {
    const entry = ensureFactoryEntry(roll.targetFactory);
    entry.rollIds.add(roll.id);

    const activeSerials = finishedBatches.filter(
      (b) => b.rollId === roll.id || (!b.rollId && b.rollNumber === roll.rollNumber)
    );
    const rejectedFromThisRoll = finishedBatches.filter(
      (b) =>
        (b.rollId === roll.id && b.factoryStatus === 'REJECTED_STOCK') ||
        b.previousRollId === roll.id ||
        (b.previousRollNumber && b.previousRollNumber.includes(roll.rollNumber))
    );

    activeSerials.forEach((s) => {
      const netto = Math.max(
        0,
        (s.packaging.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0)
      );
      const modalPerKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg || 0);
      const modal = Math.round(s.totalProductionCost || netto * modalPerKg);
      const nota = Math.round(netto * (s.factoryTargetPricePerKg || 0));

      entry.activeSeriCount += 1;
      entry.sumNota += nota;
      entry.sumModal += modal;
      totalActiveSeriAll += 1;
      totalNotaAll += nota;
      totalModalAll += modal;

      if (s.factoryStatus === 'ACCEPTED_CAIR') {
        entry.sumAccepted += nota;
        totalAcceptedAll += nota;
      }
    });

    rejectedFromThisRoll.forEach((s) => {
      const netto = Math.max(
        0,
        (s.packaging.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0)
      );
      const nota = Math.round(netto * (s.factoryTargetPricePerKg || 0));
      entry.sumReject += nota;
      totalRejectAll += nota;
    });
  });

  totalProfitAll = totalNotaAll - totalModalAll;
  const totalMarginPct =
    totalNotaAll > 0 ? Number(((totalProfitAll / totalNotaAll) * 100).toFixed(1)) : 0;

  // Row 1: TOTAL SEMUA GULUNGAN (First Bar Group on the Chart!)
  rows.push([
    `TOTAL SEMUA GULUNGAN (${rollSamples.length} Gulungan)`,
    `${rollSamples.length} Gulungan • ${totalActiveSeriAll} Seri Aktif`,
    totalNotaAll,
    totalModalAll,
    totalProfitAll,
    totalAcceptedAll,
    totalRejectAll,
    totalMarginPct,
  ]);

  // Rows 2..N: Per Pabrik Breakdown (Subsequent Bar Groups on the Chart!)
  Array.from(factoryMap.entries()).forEach(([factoryName, data]) => {
    const profit = data.sumNota - data.sumModal;
    const marginPct =
      data.sumNota > 0 ? Number(((profit / data.sumNota) * 100).toFixed(1)) : 0;
    rows.push([
      factoryName,
      `${data.rollIds.size} Gulungan • ${data.activeSeriCount} Seri Aktif`,
      data.sumNota,
      data.sumModal,
      profit,
      data.sumAccepted,
      data.sumReject,
      marginPct,
    ]);
  });

  return {
    rows,
    // Total number of chartable rows (1 Total Gulungan row + N Per-Pabrik rows)
    rollRowCount: Math.max(0, rows.length - 1),
  };
}

/**
 * Builds Google Sheets API batchUpdate requests for:
 * - Text wrapping (`WRAP`) and vertical middle alignment on every cell
 * - 2-row vertical metadata cells with horizontal merges so long factory/recipe names never clip
 * - Full table borders (outlines & inner grid lines)
 * - Optimal column widths so all columns are visible at once
 * - Embedded Combo/Column Chart on the "Ringkasan & Grafik Profit" tab
 */
function buildSpreadsheetFormattingRequests(params: {
  sheetIdMap: Record<string, number>;
  rollBlocks: RollTableBlockMeta[];
  rollHistoryTotalRows: number;
  serialStatusTotalRows: number;
  rawTobaccoTotalRows: number;
  profitSummaryRollCount: number;
  existingChartIdsToRemove?: number[];
}): any[] {
  const {
    sheetIdMap,
    rollBlocks,
    rollHistoryTotalRows,
    serialStatusTotalRows,
    rawTobaccoTotalRows,
    profitSummaryRollCount,
    existingChartIdsToRemove = [],
  } = params;

  const requests: any[] = [];

  // Remove any old charts before re-creating so updates never duplicate charts
  existingChartIdsToRemove.forEach((chartId) => {
    requests.push({
      deleteEmbeddedObject: {
        objectId: chartId,
      },
    });
  });

  const solidThinBorder = {
    style: 'SOLID',
    width: 1,
    color: { red: 0.72, green: 0.72, blue: 0.75 },
  };
  const solidMediumBorder = {
    style: 'SOLID_MEDIUM',
    width: 2,
    color: { red: 0.15, green: 0.15, blue: 0.18 },
  };

  // 1. Format "Riwayat Nota Gulungan"
  const notaSheetId = sheetIdMap['Riwayat Nota Gulungan'];
  if (notaSheetId !== undefined) {
    // Unmerge all first in case we are updating an existing sheet
    requests.push({
      unmergeCells: {
        range: {
          sheetId: notaSheetId,
          startRowIndex: 0,
          endRowIndex: Math.max(rollHistoryTotalRows + 10, 50),
          startColumnIndex: 0,
          endColumnIndex: 14,
        },
      },
    });

    // Global wrapStrategy = WRAP & verticalAlignment = MIDDLE across entire sheet
    requests.push({
      repeatCell: {
        range: {
          sheetId: notaSheetId,
          startRowIndex: 0,
          endRowIndex: Math.max(rollHistoryTotalRows, 5),
          startColumnIndex: 0,
          endColumnIndex: 14,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 10,
            },
          },
        },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)',
      },
    });

    // Merge Title Banner Row 0 (A1:N1) & style it
    requests.push({
      mergeCells: {
        range: {
          sheetId: notaSheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 14,
        },
        mergeType: 'MERGE_ALL',
      },
    });
    requests.push({
      repeatCell: {
        range: {
          sheetId: notaSheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 14,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.08, green: 0.08, blue: 0.1 },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 12,
              bold: true,
              foregroundColor: { red: 0.98, green: 0.75, blue: 0.15 },
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    });

    // Explicit column widths so all 14 columns fit cleanly without clipping
    const notaColWidths = [
      48,  // A: NO
      90,  // B: SERI AKTIF
      135, // C: RIWAYAT SERI
      145, // D: STATUS PABRIK
      85,  // E: BRUTO
      80,  // F: TARA
      105, // G: NETTO TAGIH
      135, // H: PACKAGING
      75,  // I: GRADE
      130, // J: HARGA MODAL / KG
      140, // K: JUMLAH MODAL
      130, // L: HARGA PABRIK / KG
      145, // M: JUMLAH NOTA
      145, // N: PROFIT BERSIH
    ];
    notaColWidths.forEach((pixelSize, colIdx) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: notaSheetId,
            dimension: 'COLUMNS',
            startIndex: colIdx,
            endIndex: colIdx + 1,
          },
          properties: { pixelSize },
          fields: 'pixelSize',
        },
      });
    });

    // Style each Gulungan Block (2-row vertical metadata header + table header + data rows + subtotal)
    rollBlocks.forEach((block) => {
      const mergeRanges = [
        [0, 2],   // KODE GULUNGAN (A:B)
        [2, 5],   // NAMA SETORAN / RESEP (C:E)
        [5, 8],   // PABRIK TUJUAN (F:H)
        [8, 10],  // TANGGAL SETOR (I:J)
        [10, 12], // STATUS BARANG (K:L)
        [12, 14], // JUMLAH SERI (M:N)
      ];

      mergeRanges.forEach(([startCol, endCol]) => {
        // Merge on Label Row
        requests.push({
          mergeCells: {
            range: {
              sheetId: notaSheetId,
              startRowIndex: block.infoLabelRowIndex,
              endRowIndex: block.infoLabelRowIndex + 1,
              startColumnIndex: startCol,
              endColumnIndex: endCol,
            },
            mergeType: 'MERGE_ALL',
          },
        });
        // Merge on Value Row (vertical pair right below!)
        requests.push({
          mergeCells: {
            range: {
              sheetId: notaSheetId,
              startRowIndex: block.infoValueRowIndex,
              endRowIndex: block.infoValueRowIndex + 1,
              startColumnIndex: startCol,
              endColumnIndex: endCol,
            },
            mergeType: 'MERGE_ALL',
          },
        });
      });

      // Style Info Label Row (Row 1 of the 2-cell vertical pair)
      requests.push({
        repeatCell: {
          range: {
            sheetId: notaSheetId,
            startRowIndex: block.infoLabelRowIndex,
            endRowIndex: block.infoLabelRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.16, green: 0.16, blue: 0.2 },
              wrapStrategy: 'WRAP',
              verticalAlignment: 'MIDDLE',
              textFormat: {
                fontFamily: 'Arial',
                fontSize: 9,
                bold: true,
                foregroundColor: { red: 0.85, green: 0.85, blue: 0.88 },
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat)',
        },
      });

      // Style Info Value Row (Row 2 of the 2-cell vertical pair)
      requests.push({
        repeatCell: {
          range: {
            sheetId: notaSheetId,
            startRowIndex: block.infoValueRowIndex,
            endRowIndex: block.infoValueRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.99, green: 0.95, blue: 0.82 },
              wrapStrategy: 'WRAP',
              verticalAlignment: 'MIDDLE',
              textFormat: {
                fontFamily: 'Arial',
                fontSize: 10,
                bold: true,
                foregroundColor: { red: 0.08, green: 0.08, blue: 0.1 },
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,textFormat)',
        },
      });

      // Style Table Column Header Row
      requests.push({
        repeatCell: {
          range: {
            sheetId: notaSheetId,
            startRowIndex: block.tableHeaderRowIndex,
            endRowIndex: block.tableHeaderRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'WRAP',
              textFormat: {
                fontFamily: 'Arial',
                fontSize: 9,
                bold: true,
                foregroundColor: { red: 0.98, green: 0.75, blue: 0.15 },
              },
            },
          },
          fields:
            'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
        },
      });

      // Style Subtotal Row
      requests.push({
        repeatCell: {
          range: {
            sheetId: notaSheetId,
            startRowIndex: block.subtotalRowIndex,
            endRowIndex: block.subtotalRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.95, green: 0.95, blue: 0.96 },
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'WRAP',
              textFormat: {
                fontFamily: 'Arial',
                fontSize: 10,
                bold: true,
                foregroundColor: { red: 0.05, green: 0.05, blue: 0.08 },
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)',
        },
      });

      // Full Table Outline & Inner Grid Borders for the entire Gulungan Block
      requests.push({
        updateBorders: {
          range: {
            sheetId: notaSheetId,
            startRowIndex: block.infoLabelRowIndex,
            endRowIndex: block.subtotalRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          top: solidMediumBorder,
          bottom: solidMediumBorder,
          left: solidMediumBorder,
          right: solidMediumBorder,
          innerHorizontal: solidThinBorder,
          innerVertical: solidThinBorder,
        },
      });
    });
  }

  // 2. Format "Status Semua Seri"
  const seriSheetId = sheetIdMap['Status Semua Seri'];
  if (seriSheetId !== undefined && serialStatusTotalRows > 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: seriSheetId,
          startRowIndex: 0,
          endRowIndex: serialStatusTotalRows,
          startColumnIndex: 0,
          endColumnIndex: 22,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP',
            verticalAlignment: 'MIDDLE',
            textFormat: { fontFamily: 'Arial', fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)',
      },
    });

    // Header Row 0
    requests.push({
      repeatCell: {
        range: {
          sheetId: seriSheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 22,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 9,
              bold: true,
              foregroundColor: { red: 0.98, green: 0.75, blue: 0.15 },
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
      },
    });

    // Total Row (last row)
    if (serialStatusTotalRows > 1) {
      requests.push({
        repeatCell: {
          range: {
            sheetId: seriSheetId,
            startRowIndex: serialStatusTotalRows - 1,
            endRowIndex: serialStatusTotalRows,
            startColumnIndex: 0,
            endColumnIndex: 22,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.99, green: 0.95, blue: 0.82 },
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'WRAP',
              textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)',
        },
      });
    }

    // Borders
    requests.push({
      updateBorders: {
        range: {
          sheetId: seriSheetId,
          startRowIndex: 0,
          endRowIndex: serialStatusTotalRows,
          startColumnIndex: 0,
          endColumnIndex: 22,
        },
        top: solidMediumBorder,
        bottom: solidMediumBorder,
        left: solidMediumBorder,
        right: solidMediumBorder,
        innerHorizontal: solidThinBorder,
        innerVertical: solidThinBorder,
      },
    });

    const seriColWidths = [
      45, 90, 135, 140, 115, 145, 175, 155, 105, 130, 70, 85, 90, 100, 105, 110, 130, 140, 130, 145,
      145, 240,
    ];
    seriColWidths.forEach((pixelSize, colIdx) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: seriSheetId,
            dimension: 'COLUMNS',
            startIndex: colIdx,
            endIndex: colIdx + 1,
          },
          properties: { pixelSize },
          fields: 'pixelSize',
        },
      });
    });
  }

  // 3. Format "Stok Bahan Mentah"
  const rawSheetId = sheetIdMap['Stok Bahan Mentah'];
  if (rawSheetId !== undefined && rawTobaccoTotalRows > 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: rawSheetId,
          startRowIndex: 0,
          endRowIndex: rawTobaccoTotalRows,
          startColumnIndex: 0,
          endColumnIndex: 19,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP',
            verticalAlignment: 'MIDDLE',
            textFormat: { fontFamily: 'Arial', fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)',
      },
    });

    requests.push({
      repeatCell: {
        range: {
          sheetId: rawSheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 19,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 9,
              bold: true,
              foregroundColor: { red: 0.98, green: 0.75, blue: 0.15 },
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
      },
    });

    requests.push({
      updateBorders: {
        range: {
          sheetId: rawSheetId,
          startRowIndex: 0,
          endRowIndex: rawTobaccoTotalRows,
          startColumnIndex: 0,
          endColumnIndex: 19,
        },
        top: solidMediumBorder,
        bottom: solidMediumBorder,
        left: solidMediumBorder,
        right: solidMediumBorder,
        innerHorizontal: solidThinBorder,
        innerVertical: solidThinBorder,
      },
    });

    const rawColWidths = [
      45, 110, 175, 150, 145, 105, 70, 130, 85, 95, 105, 115, 115, 130, 145, 145, 115, 135, 115,
    ];
    rawColWidths.forEach((pixelSize, colIdx) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: rawSheetId,
            dimension: 'COLUMNS',
            startIndex: colIdx,
            endIndex: colIdx + 1,
          },
          properties: { pixelSize },
          fields: 'pixelSize',
        },
      });
    });
  }

  // 4. Format "Ringkasan & Grafik Profit" + Add Native Google Sheets Chart
  const chartSheetId = sheetIdMap['Ringkasan & Grafik Profit'];
  if (chartSheetId !== undefined) {
    const totalSummaryRows = profitSummaryRollCount + 2; // Header + rolls + Total row

    requests.push({
      repeatCell: {
        range: {
          sheetId: chartSheetId,
          startRowIndex: 0,
          endRowIndex: totalSummaryRows,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP',
            verticalAlignment: 'MIDDLE',
            textFormat: { fontFamily: 'Arial', fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)',
      },
    });

    // Header Row 0
    requests.push({
      repeatCell: {
        range: {
          sheetId: chartSheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.1, green: 0.1, blue: 0.12 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: {
              fontFamily: 'Arial',
              fontSize: 9,
              bold: true,
              foregroundColor: { red: 0.98, green: 0.75, blue: 0.15 },
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
      },
    });

    // Format Currency Columns C..G (indices 2..7) as Rupiah numbers so Google Sheets Chart plots them cleanly
    requests.push({
      repeatCell: {
        range: {
          sheetId: chartSheetId,
          startRowIndex: 1,
          endRowIndex: totalSummaryRows,
          startColumnIndex: 2,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'CURRENCY',
              pattern: '"Rp"#,##0',
            },
            horizontalAlignment: 'RIGHT',
          },
        },
        fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
      },
    });

    // Highlight Row 1 ("TOTAL SEMUA GULUNGAN") in warm amber tint
    requests.push({
      repeatCell: {
        range: {
          sheetId: chartSheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.99, green: 0.95, blue: 0.82 },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)',
      },
    });

    // Borders for Summary Table
    requests.push({
      updateBorders: {
        range: {
          sheetId: chartSheetId,
          startRowIndex: 0,
          endRowIndex: totalSummaryRows,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        top: solidMediumBorder,
        bottom: solidMediumBorder,
        left: solidMediumBorder,
        right: solidMediumBorder,
        innerHorizontal: solidThinBorder,
        innerVertical: solidThinBorder,
      },
    });

    const summaryColWidths = [210, 180, 150, 150, 150, 150, 150, 115];
    summaryColWidths.forEach((pixelSize, colIdx) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: chartSheetId,
            dimension: 'COLUMNS',
            startIndex: colIdx,
            endIndex: colIdx + 1,
          },
          properties: { pixelSize },
          fields: 'pixelSize',
        },
      });
    });

    // Add Embedded Column Chart below the Summary Table comparing Total Semua Gulungan & Per Pabrik
    if (profitSummaryRollCount > 0) {
      const chartEndRowIndex = profitSummaryRollCount + 1; // Header row (0) + Row 1 (Total Semua Gulungan) + Rows 2..N (Per Pabrik)
      requests.push({
        addChart: {
          chart: {
            spec: {
              title:
                'Grafik Perbandingan Pendapatan (Nota), Modal, Profit Bersih & Reject — Total Gulungan & Per Pabrik',
              subtitle:
                'Sumber: Data Aktual Tobacco Lab (Total Semua Gulungan & Rincian Per Pabrik Tujuan)',
              basicChart: {
                chartType: 'COLUMN',
                legendPosition: 'BOTTOM_LEGEND',
                axis: [
                  {
                    position: 'BOTTOM_AXIS',
                    title: 'Total Semua Gulungan & Per Pabrik Tujuan',
                  },
                  {
                    position: 'LEFT_AXIS',
                    title: 'Nilai Rupiah (Rp)',
                  },
                ],
                domains: [
                  {
                    domain: {
                      sourceRange: {
                        sources: [
                          {
                            sheetId: chartSheetId,
                            startRowIndex: 0,
                            endRowIndex: chartEndRowIndex,
                            startColumnIndex: 0,
                            endColumnIndex: 1,
                          },
                        ],
                      },
                    },
                  },
                ],
                series: [
                  {
                    series: {
                      sourceRange: {
                        sources: [
                          {
                            sheetId: chartSheetId,
                            startRowIndex: 0,
                            endRowIndex: chartEndRowIndex,
                            startColumnIndex: 2,
                            endColumnIndex: 3,
                          },
                        ],
                      },
                    },
                    targetAxis: 'LEFT_AXIS',
                  },
                  {
                    series: {
                      sourceRange: {
                        sources: [
                          {
                            sheetId: chartSheetId,
                            startRowIndex: 0,
                            endRowIndex: chartEndRowIndex,
                            startColumnIndex: 3,
                            endColumnIndex: 4,
                          },
                        ],
                      },
                    },
                    targetAxis: 'LEFT_AXIS',
                  },
                  {
                    series: {
                      sourceRange: {
                        sources: [
                          {
                            sheetId: chartSheetId,
                            startRowIndex: 0,
                            endRowIndex: chartEndRowIndex,
                            startColumnIndex: 4,
                            endColumnIndex: 5,
                          },
                        ],
                      },
                    },
                    targetAxis: 'LEFT_AXIS',
                  },
                  {
                    series: {
                      sourceRange: {
                        sources: [
                          {
                            sheetId: chartSheetId,
                            startRowIndex: 0,
                            endRowIndex: chartEndRowIndex,
                            startColumnIndex: 6,
                            endColumnIndex: 7,
                          },
                        ],
                      },
                    },
                    targetAxis: 'LEFT_AXIS',
                  },
                ],
                headerCount: 1,
              },
            },
            position: {
              overlayPosition: {
                anchorCell: {
                  sheetId: chartSheetId,
                  rowIndex: totalSummaryRows + 1,
                  columnIndex: 0,
                },
                offsetXPixels: 0,
                offsetYPixels: 10,
                widthPixels: 920,
                heightPixels: 420,
              },
            },
          },
        },
      });
    }
  }

  return requests;
}

export async function createGoogleSpreadsheetWithData(params: {
  accessToken: string;
  spreadsheetTitle: string;
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos: RawTobacco[];
}): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}> {
  const { accessToken, spreadsheetTitle, rollSamples, finishedBatches, rawTobaccos } = params;

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: spreadsheetTitle,
      },
      sheets: [
        { properties: { title: 'Riwayat Nota Gulungan', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Ringkasan & Grafik Profit', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Status Semua Seri', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Stok Bahan Mentah', gridProperties: { frozenRowCount: 1 } } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`Gagal membuat Google Sheet baru (${createRes.status}): ${errBody}`);
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string =
    created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const sheetIdMap: Record<string, number> = {};
  (created.sheets || []).forEach((s: any) => {
    if (s?.properties?.title && typeof s?.properties?.sheetId === 'number') {
      sheetIdMap[s.properties.title] = s.properties.sheetId;
    }
  });

  const { rows: rollHistoryRows, blocks: rollBlocks } = buildAllRollsHistoryRowsWithMeta(
    rollSamples,
    finishedBatches
  );
  const serialStatusRows = buildAllSerialStatusRows(finishedBatches);
  const rawTobaccoRows = buildRawTobaccoRows(rawTobaccos);
  const { rows: profitSummaryRows, rollRowCount } = buildProfitSummaryAndChartRows(
    rollSamples,
    finishedBatches
  );

  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'Riwayat Nota Gulungan'!A1`,
            values: rollHistoryRows,
          },
          {
            range: `'Ringkasan & Grafik Profit'!A1`,
            values: profitSummaryRows,
          },
          {
            range: `'Status Semua Seri'!A1`,
            values: serialStatusRows,
          },
          {
            range: `'Stok Bahan Mentah'!A1`,
            values: rawTobaccoRows,
          },
        ],
      }),
    }
  );

  if (!batchRes.ok) {
    const errBody = await batchRes.text();
    throw new Error(`Gagal mengisi data ke Google Sheet (${batchRes.status}): ${errBody}`);
  }

  // Apply table borders, 2-row vertical cell merges, text wrapping, column widths, and native chart
  const formatRequests = buildSpreadsheetFormattingRequests({
    sheetIdMap,
    rollBlocks,
    rollHistoryTotalRows: rollHistoryRows.length,
    serialStatusTotalRows: serialStatusRows.length,
    rawTobaccoTotalRows: rawTobaccoRows.length,
    profitSummaryRollCount: rollRowCount,
  });

  if (formatRequests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: formatRequests,
      }),
    });
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: spreadsheetTitle,
  };
}

export async function updateExistingGoogleSpreadsheet(params: {
  accessToken: string;
  spreadsheetIdOrUrl: string;
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos: RawTobacco[];
  exportScope: 'ALL_TABS' | 'NOTA_HISTORY' | 'SERIAL_STATUS';
}): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  updatedTabName: string;
}> {
  const {
    accessToken,
    spreadsheetIdOrUrl,
    rollSamples,
    finishedBatches,
    rawTobaccos,
    exportScope,
  } = params;

  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('ID atau URL Google Spreadsheet tidak valid.');
  }

  // Fetch spreadsheet metadata first to inspect actual tab names, sheetIds, and existing charts
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    const errBody = await metaRes.text();
    throw new Error(
      `Gagal membaca Google Spreadsheet (${metaRes.status}). Pastikan link benar dan akun Google Anda memiliki akses edit. Detail: ${errBody}`
    );
  }

  const meta = await metaRes.json();
  const sheetIdMap: Record<string, number> = {};
  const existingChartIdsToRemove: number[] = [];

  (meta.sheets || []).forEach((s: any) => {
    const title = s?.properties?.title || '';
    const sheetId = s?.properties?.sheetId;
    if (title && typeof sheetId === 'number') {
      sheetIdMap[title] = sheetId;
    }
    if (title === 'Ringkasan & Grafik Profit' && Array.isArray(s?.charts)) {
      s.charts.forEach((c: any) => {
        if (typeof c?.chartId === 'number') {
          existingChartIdsToRemove.push(c.chartId);
        }
      });
    }
  });

  const existingSheetTitles = Object.keys(sheetIdMap);

  const targetTabs =
    exportScope === 'ALL_TABS'
      ? [
          'Riwayat Nota Gulungan',
          'Ringkasan & Grafik Profit',
          'Status Semua Seri',
          'Stok Bahan Mentah',
        ]
      : exportScope === 'NOTA_HISTORY'
        ? ['Riwayat Nota Gulungan', 'Ringkasan & Grafik Profit']
        : ['Status Semua Seri'];

  // Create any missing tabs via batchUpdate and record their new sheetIds
  const missingTabs = targetTabs.filter((t) => !existingSheetTitles.includes(t));
  if (missingTabs.length > 0) {
    const addTabRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: {
              properties: { title, gridProperties: { frozenRowCount: 1 } },
            },
          })),
        }),
      }
    );
    if (addTabRes.ok) {
      const addTabJson = await addTabRes.json();
      (addTabJson.replies || []).forEach((r: any) => {
        const prop = r?.addSheet?.properties;
        if (prop?.title && typeof prop?.sheetId === 'number') {
          sheetIdMap[prop.title] = prop.sheetId;
        }
      });
    }
  }

  // Clear old values on target tabs first so leftover rows from previous updates are cleanly removed
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: targetTabs.map((t) => `'${t}'!A1:Z1000`),
      }),
    }
  );

  const { rows: rollHistoryRows, blocks: rollBlocks } = buildAllRollsHistoryRowsWithMeta(
    rollSamples,
    finishedBatches
  );
  const serialStatusRows = buildAllSerialStatusRows(finishedBatches);
  const rawTobaccoRows = buildRawTobaccoRows(rawTobaccos);
  const { rows: profitSummaryRows, rollRowCount } = buildProfitSummaryAndChartRows(
    rollSamples,
    finishedBatches
  );

  const dataPayloads: { range: string; values: (string | number)[][] }[] = [];

  if (exportScope === 'ALL_TABS' || exportScope === 'NOTA_HISTORY') {
    dataPayloads.push({
      range: `'Riwayat Nota Gulungan'!A1`,
      values: rollHistoryRows,
    });
    dataPayloads.push({
      range: `'Ringkasan & Grafik Profit'!A1`,
      values: profitSummaryRows,
    });
  }

  if (exportScope === 'ALL_TABS' || exportScope === 'SERIAL_STATUS') {
    dataPayloads.push({
      range: `'Status Semua Seri'!A1`,
      values: serialStatusRows,
    });
  }

  if (exportScope === 'ALL_TABS') {
    dataPayloads.push({
      range: `'Stok Bahan Mentah'!A1`,
      values: rawTobaccoRows,
    });
  }

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataPayloads,
      }),
    }
  );

  if (!updateRes.ok) {
    const errBody = await updateRes.text();
    throw new Error(`Gagal memperbarui Google Spreadsheet (${updateRes.status}): ${errBody}`);
  }

  // Apply full table formatting, wrapping, column widths, and chart update
  const scopedSheetIdMap: Record<string, number> = {};
  targetTabs.forEach((t) => {
    if (sheetIdMap[t] !== undefined) {
      scopedSheetIdMap[t] = sheetIdMap[t];
    }
  });

  const formatRequests = buildSpreadsheetFormattingRequests({
    sheetIdMap: scopedSheetIdMap,
    rollBlocks,
    rollHistoryTotalRows: rollHistoryRows.length,
    serialStatusTotalRows: serialStatusRows.length,
    rawTobaccoTotalRows: rawTobaccoRows.length,
    profitSummaryRollCount: rollRowCount,
    existingChartIdsToRemove,
  });

  if (formatRequests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: formatRequests,
      }),
    });
  }

  return {
    spreadsheetId,
    spreadsheetUrl:
      meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    spreadsheetTitle: meta.properties?.title || 'Spreadsheet',
    updatedTabName: targetTabs.join(', '),
  };
}
