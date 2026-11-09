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

export function buildAllRollsHistoryRows(
  rollSamples: TobaccoRollSample[],
  finishedBatches: FinishedTobaccoSerial[]
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  rows.push([
    'LAPORAN RIWAYAT NOTA GULUNGAN — TOBACCO LAB',
    `Diekspor: ${new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`,
  ]);
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

    rows.push([
      'GULUNGAN',
      roll.rollNumber,
      'NAMA SETORAN',
      roll.recipeName,
      'PABRIK TUJUAN',
      roll.targetFactory,
      'TANGGAL',
      formattedDate,
    ]);

    rows.push([
      'NO',
      'SERI AKTIF',
      'RIWAYAT SERI (ASAL -> BARU)',
      'STATUS DI GULUNGAN INI',
      'BRUTO (KG)',
      'TARA (KG)',
      'NETTO TAGIH (KG)',
      'PACKAGING',
      'GRADE',
      'HARGA MODAL / KG',
      'JUMLAH MODAL',
      'HARGA PABRIK / KG',
      'JUMLAH NOTA PABRIK',
      'PROFIT BERSIH',
    ]);

    let sumBruto = 0;
    let sumTara = 0;
    let sumNetto = 0;
    let sumModal = 0;
    let sumNota = 0;
    let sumProfit = 0;

    serialsInRoll.forEach((s, idx) => {
      const movedToAnotherRoll = s.rollId !== roll.id && s.rollNumber !== roll.rollNumber;
      const statusInThisRoll = movedToAnotherRoll
        ? `REJECTED (${s.rollNumber})`
        : s.factoryStatus === 'ACCEPTED_CAIR'
          ? 'ACCEPTED'
          : s.factoryStatus === 'REJECTED_STOCK'
            ? 'REJECTED'
            : 'MENUNGGU QC';

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

    rows.push([
      'SUBTOTAL AKTIF',
      `${roll.rollNumber}`,
      '',
      '',
      Number(sumBruto.toFixed(2)),
      Number(sumTara.toFixed(2)),
      Number(sumNetto.toFixed(2)),
      '',
      '',
      '',
      formatSheetRp(sumModal),
      '',
      formatSheetRp(sumNota),
      formatSheetRp(sumProfit),
    ]);
    rows.push([]);
  });

  return rows;
}

export function buildAllSerialStatusRows(
  finishedBatches: FinishedTobaccoSerial[]
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  rows.push([
    'NO',
    'SERI AKTIF',
    'JEJAK PERUBAHAN SERI (ASAL -> BARU)',
    'STATUS SAAT INI',
    'GULUNGAN AKTIF',
    'EKS-GULUNGAN (SEBELUMNYA)',
    'PABRIK TUJUAN AKTIF',
    'EKS-PABRIK (SEBELUMNYA)',
    'TANGGAL DIBUAT',
    'PACKAGING',
    'GRADE',
    'BRUTO (KG)',
    'TARA PABRIK (KG)',
    'NETTO TAGIH (KG)',
    'NETTO RIIL TEMBAKAU (KG)',
    'WEIGHT PROFIT PABRIK (KG)',
    'MODAL PRODUKSI / KG',
    'TOTAL MODAL PRODUKSI',
    'HARGA TAGIH PABRIK / KG',
    'TOTAL TAGIHAN NOTA',
    'PROFIT BERSIH',
    'CATATAN / RIWAYAT PINDAH',
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

    const statusLabel =
      b.factoryStatus === 'ACCEPTED_CAIR'
        ? 'ACCEPTED'
        : b.factoryStatus === 'REJECTED_STOCK'
          ? 'REJECTED'
          : 'MENUNGGU QC';

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
    '',
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
    'NAMA TEMBAKAU MENTAH',
    'DAERAH ASAL',
    'PENJUAL / PENGEPUL',
    'TANGGAL BELI',
    'GRADE',
    'KEMASAN',
    'BRUTO (KG)',
    'WADAH RIIL (KG)',
    'POTONGAN NOTA (KG)',
    'NETTO BAYAR NOTA (KG)',
    'NETTO RIIL FISIK (KG)',
    'HARGA BELI / KG',
    'NILAI BAYAR NOTA (PAID VALUE)',
    'NILAI BARANG RIIL (REAL VALUE)',
    'WEIGHT PROFIT BELI (KG)',
    'WEIGHT PROFIT BELI (RP)',
    'SISA STOK GUDANG (KG)',
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
        { properties: { title: 'Riwayat Nota Gulungan' } },
        { properties: { title: 'Status Semua Seri' } },
        { properties: { title: 'Stok Bahan Mentah' } },
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

  const rollHistoryRows = buildAllRollsHistoryRows(rollSamples, finishedBatches);
  const serialStatusRows = buildAllSerialStatusRows(finishedBatches);
  const rawTobaccoRows = buildRawTobaccoRows(rawTobaccos);

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

  // Always fetch spreadsheet metadata first to inspect actual tab names
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
  const existingSheetTitles: string[] = (meta.sheets || []).map(
    (s: any) => s?.properties?.title || ''
  );
  const firstSheetTitle = existingSheetTitles[0] || 'Sheet1';

  const targetTabs =
    exportScope === 'ALL_TABS'
      ? ['Riwayat Nota Gulungan', 'Status Semua Seri', 'Stok Bahan Mentah']
      : exportScope === 'NOTA_HISTORY'
        ? ['Riwayat Nota Gulungan']
        : ['Status Semua Seri'];

  // Create any missing tabs via batchUpdate
  const missingTabs = targetTabs.filter((t) => !existingSheetTitles.includes(t));
  if (missingTabs.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: missingTabs.map((title) => ({
          addSheet: {
            properties: { title },
          },
        })),
      }),
    });
  }

  const dataPayloads: { range: string; values: (string | number)[][] }[] = [];

  if (exportScope === 'ALL_TABS' || exportScope === 'NOTA_HISTORY') {
    const tabName =
      existingSheetTitles.includes('Riwayat Nota Gulungan') || missingTabs.includes('Riwayat Nota Gulungan')
        ? 'Riwayat Nota Gulungan'
        : firstSheetTitle;
    dataPayloads.push({
      range: `'${tabName}'!A1`,
      values: buildAllRollsHistoryRows(rollSamples, finishedBatches),
    });
  }

  if (exportScope === 'ALL_TABS' || exportScope === 'SERIAL_STATUS') {
    const tabName =
      existingSheetTitles.includes('Status Semua Seri') || missingTabs.includes('Status Semua Seri')
        ? 'Status Semua Seri'
        : firstSheetTitle;
    dataPayloads.push({
      range: `'${tabName}'!A1`,
      values: buildAllSerialStatusRows(finishedBatches),
    });
  }

  if (exportScope === 'ALL_TABS') {
    dataPayloads.push({
      range: `'Stok Bahan Mentah'!A1`,
      values: buildRawTobaccoRows(rawTobaccos),
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

  return {
    spreadsheetId,
    spreadsheetUrl:
      meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    spreadsheetTitle: meta.properties?.title || 'Spreadsheet',
    updatedTabName: targetTabs.join(', '),
  };
}
