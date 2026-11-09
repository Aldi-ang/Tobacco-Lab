import {
  TobaccoGrade,
  TaraFormula,
  BlendIngredient,
  AdditionalCostItem,
  PackagingSpec,
  FinishedTobaccoSerial,
} from '../types/tobacco';

export const GRADE_SCORES: Record<TobaccoGrade, number> = {
  'A+': 9,
  'A': 8,
  'B+': 7,
  'B': 6,
  'C+': 5,
  'C': 4,
  'D+': 3,
  'D': 2,
  'E': 1,
};

export const GRADE_LABELS: Record<TobaccoGrade, { name: string; color: string; desc: string }> = {
  'A+': {
    name: 'Grade A+ (Srintil Emas)',
    color: 'bg-black text-amber-400 border-amber-500/70',
    desc: 'Kuning keemasan berminyak/getah tebal, aroma wangi kuat',
  },
  'A': {
    name: 'Grade A (Kuning Terang)',
    color: 'bg-zinc-950 text-white border-zinc-800',
    desc: 'Warna kuning cerah keemasan, mutu super',
  },
  'B+': {
    name: 'Grade B+ (Cokelat Kuning)',
    color: 'bg-zinc-900 text-zinc-200 border-zinc-800',
    desc: 'Cokelat kemerahan matang, body mantap',
  },
  'B': {
    name: 'Grade B (Cokelat Sedang)',
    color: 'bg-zinc-900 text-white border-zinc-700',
    desc: 'Warna cokelat alami tembakau rajangan standar',
  },
  'C+': {
    name: 'Grade C+ (Cokelat Tua)',
    color: 'bg-zinc-900 text-zinc-200 border-zinc-700',
    desc: 'Cokelat gelap, kadar tarikan padat',
  },
  'C': {
    name: 'Grade C (Gelap)',
    color: 'bg-zinc-900 text-zinc-300 border-zinc-700',
    desc: 'Warna gelap tebal, rasa kuat',
  },
  'D+': {
    name: 'Grade D+ (Daun Tengah/Atas)',
    color: 'bg-zinc-950 text-zinc-200 border-zinc-800',
    desc: 'Daun tengah/atas matang, body kuat',
  },
  'D': {
    name: 'Grade D (Standar Pabrik)',
    color: 'bg-zinc-900 text-white border-zinc-700',
    desc: 'Grade D standar setoran pabrik',
  },
  'E': {
    name: 'Grade E (Spesial / Super)',
    color: 'bg-black text-amber-400 border-zinc-700',
    desc: 'Grade E kualitas tinggi sesuai klasifikasi nota pabrik',
  },
};

/**
 * Mengubah teks formula potongan seperti "20% + 2" atau "10% + 2 + 2" atau "3" menjadi komponen angka
 */
export function parseTaraFormula(formulaStr: string): { percent: number; flatKg: number; sampleKg: number } {
  if (!formulaStr || typeof formulaStr !== 'string') {
    return { percent: 0, flatKg: 0, sampleKg: 0 };
  }

  const clean = formulaStr.trim().toLowerCase();

  // Format dengan sampel: "10% + 2 + 2"
  const tripleMatch = clean.match(/^(\d+(?:\.\d+)?)\s*%\s*\+\s*(\d+(?:\.\d+)?)(?:\s*kg)?\s*\+\s*(\d+(?:\.\d+)?)/);
  if (tripleMatch) {
    return {
      percent: parseFloat(tripleMatch[1]) || 0,
      flatKg: parseFloat(tripleMatch[2]) || 0,
      sampleKg: parseFloat(tripleMatch[3]) || 0,
    };
  }

  // Format "20% + 2" atau "20% + 2kg"
  const comboMatch = clean.match(/^(\d+(?:\.\d+)?)\s*%\s*\+\s*(\d+(?:\.\d+)?)/);
  if (comboMatch) {
    return {
      percent: parseFloat(comboMatch[1]) || 0,
      flatKg: parseFloat(comboMatch[2]) || 0,
      sampleKg: 0,
    };
  }

  // Format persentase saja: "20%"
  const percentMatch = clean.match(/^(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    return {
      percent: parseFloat(percentMatch[1]) || 0,
      flatKg: 0,
      sampleKg: 0,
    };
  }

  // Format flat kg: "3 kg" atau "3"
  const flatMatch = clean.match(/^(\d+(?:\.\d+)?)(?:\s*kg)?$/);
  if (flatMatch) {
    return {
      percent: 0,
      flatKg: parseFloat(flatMatch[1]) || 0,
      sampleKg: 0,
    };
  }

  return { percent: 0, flatKg: 0, sampleKg: 0 };
}

/**
 * Format string representasi formula potongan termasuk sampel pabrik jika ada
 */
export function formatTaraFormula(percent: number, flatKg: number, sampleKg: number = 0): string {
  const parts: string[] = [];
  if (percent > 0) parts.push(`${percent}%`);
  if (flatKg > 0) parts.push(`${flatKg} kg`);
  if (sampleKg > 0) parts.push(`${sampleKg} kg Sampel`);

  if (parts.length === 0) return '0 kg (Tanpa Potongan)';
  return parts.join(' + ');
}

/**
 * Menghitung potongan tara timbangan dari Bruto:
 * Netto = Bruto - Tarra
 */
export function calculateTaraDeduction(
  grossWeightKg: number,
  formula: { percent: number; flatKg: number; sampleKg?: number }
): {
  deductionKg: number;
  netWeightKg: number;
  effectivePercent: number;
} {
  const gross = Math.max(0, grossWeightKg);
  const percentPart = gross * ((formula.percent || 0) / 100);
  const flatPart = formula.flatKg || 0;
  const samplePart = formula.sampleKg || 0;
  const rawDeduction = percentPart + flatPart + samplePart;

  const deductionKg = Math.min(gross, Math.max(0, rawDeduction));
  const netWeightKg = Math.max(0, gross - deductionKg);
  const effectivePercent = gross > 0 ? (deductionKg / gross) * 100 : 0;

  return {
    deductionKg: Number(deductionKg.toFixed(2)),
    netWeightKg: Number(netWeightKg.toFixed(2)),
    effectivePercent: Number(effectivePercent.toFixed(2)),
  };
}

/**
 * Menghitung Modal Asal (Paid Value) vs Nilai Barang Sebenarnya (Real Value) & Weight Profit Pembelian
 */
export function calculateRawTobaccoCost(params: {
  grossWeightKg: number;
  pricePerKgPurchase: number;
  taraFormula: TaraFormula;
  additionalCost?: number;
  realPackagingMassKg?: number;
}): {
  deductionKg: number;
  netWeightKg: number;
  totalModalAsal: number;
  totalInvoiceCost: number;
  realCostPerNetKg: number;
  effectiveTaraPercent: number;
  realPackagingMassKg: number;
  realNetWeightKg: number;
  realStockValueRp: number;
  purchaseWeightProfitKg: number;
  purchaseWeightProfitRp: number;
  effectiveCostPerRealKg: number;
} {
  const {
    grossWeightKg,
    pricePerKgPurchase,
    taraFormula,
    additionalCost = 0,
    realPackagingMassKg: explicitPkgMassKg,
  } = params;

  const gross = Math.max(0, grossWeightKg);
  const { deductionKg, netWeightKg, effectivePercent } = calculateTaraDeduction(
    gross,
    taraFormula
  );

  const realPackagingMassKg = Number(
    Math.min(
      gross,
      Math.max(
        0,
        explicitPkgMassKg !== undefined
          ? explicitPkgMassKg
          : taraFormula.packagingMassKg !== undefined
          ? taraFormula.packagingMassKg
          : taraFormula.flatKg || 0
      )
    ).toFixed(2)
  );

  const realNetWeightKg = Number(Math.max(0, gross - realPackagingMassKg).toFixed(2));
  const totalModalAsal = Math.round(netWeightKg * pricePerKgPurchase);
  const totalInvoiceCost = netWeightKg * pricePerKgPurchase + additionalCost;
  const realStockValueRp = Math.round(realNetWeightKg * pricePerKgPurchase);
  const purchaseWeightProfitKg = Number((realNetWeightKg - netWeightKg).toFixed(2));
  const purchaseWeightProfitRp = Math.round(realStockValueRp - totalModalAsal);

  const realCostPerNetKg = netWeightKg > 0 ? totalInvoiceCost / netWeightKg : 0;
  const effectiveCostPerRealKg = realNetWeightKg > 0 ? totalInvoiceCost / realNetWeightKg : 0;

  return {
    deductionKg,
    netWeightKg,
    totalModalAsal,
    totalInvoiceCost: Math.round(totalInvoiceCost),
    realCostPerNetKg: Math.round(realCostPerNetKg * 100) / 100,
    effectiveTaraPercent: effectivePercent,
    realPackagingMassKg,
    realNetWeightKg,
    realStockValueRp,
    purchaseWeightProfitKg,
    purchaseWeightProfitRp,
    effectiveCostPerRealKg: Math.round(effectiveCostPerRealKg * 100) / 100,
  };
}

export function scoreToColorGrade(score: number): TobaccoGrade {
  if (score >= 8.5) return 'A+';
  if (score >= 7.5) return 'A';
  if (score >= 6.5) return 'B+';
  if (score >= 5.5) return 'B';
  if (score >= 4.5) return 'C+';
  if (score >= 3.5) return 'C';
  if (score >= 2.5) return 'D+';
  if (score >= 1.5) return 'D';
  return 'E';
}

export function clampRating5(val: number): number {
  const num = Number(val) || 0;
  const scaled = num > 5 ? num / 2 : num;
  return Number(Math.max(0, Math.min(5, scaled)).toFixed(1));
}

export function calculateBlendMetrics(params: {
  ingredients: BlendIngredient[];
  additionalCosts: AdditionalCostItem[];
}): {
  totalBlendNetKg: number;
  totalMaterialCost: number;
  totalRealPaidMaterialCost: number;
  totalBuyWeightProfitRp: number;
  totalOverheadCost: number;
  totalProductionCost: number;
  totalRealPaidProductionCost: number;
  hppPerNetKg: number;
  effectiveRealPaidHppPerKg: number;
  weightedPower: number;
  weightedImpact: number;
  weightedBitter: number;
  weightedBurn: number;
  weightedSugar: number;
  weightedAroma: number;
  compositeColorGrade: TobaccoGrade;
  updatedIngredients: BlendIngredient[];
} {
  const { ingredients, additionalCosts } = params;

  const totalBlendNetKg = ingredients.reduce((acc, curr) => acc + (curr.usedNetKg || 0), 0);
  const totalOverheadCost = additionalCosts.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  if (totalBlendNetKg <= 0) {
    return {
      totalBlendNetKg: 0,
      totalMaterialCost: 0,
      totalRealPaidMaterialCost: 0,
      totalBuyWeightProfitRp: 0,
      totalOverheadCost,
      totalProductionCost: totalOverheadCost,
      totalRealPaidProductionCost: totalOverheadCost,
      hppPerNetKg: 0,
      effectiveRealPaidHppPerKg: 0,
      weightedPower: 0,
      weightedImpact: 0,
      weightedBitter: 0,
      weightedBurn: 0,
      weightedSugar: 0,
      weightedAroma: 0,
      compositeColorGrade: 'D',
      updatedIngredients: ingredients,
    };
  }

  let totalMaterialCost = 0;
  let totalRealPaidMaterialCost = 0;
  let powerSum = 0;
  let impactSum = 0;
  let bitterSum = 0;
  let burnSum = 0;
  let sugarSum = 0;
  let aromaSum = 0;
  let gradeScoreSum = 0;

  const updatedIngredients = ingredients.map((item) => {
    const percentageInBlend = (item.usedNetKg / totalBlendNetKg) * 100;
    const subtotalCost = item.usedNetKg * item.realCostPerNetKg;
    const effCostKg = item.effectiveCostPerRealKg ?? item.realCostPerNetKg;
    const subtotalRealPaidCost = item.usedNetKg * effCostKg;
    const embeddedWeightProfitRp = Math.round(subtotalCost - subtotalRealPaidCost);

    const p = clampRating5(item.powerRating || 0);
    const im = clampRating5(item.impactRating || 0);
    const b = clampRating5(item.bitterRating || 0);
    const bu = clampRating5(item.burnRating ?? 4.0);
    const su = clampRating5(item.sugarRating ?? 3.5);
    const ar = clampRating5(item.aromaRating ?? 4.2);

    totalMaterialCost += subtotalCost;
    totalRealPaidMaterialCost += subtotalRealPaidCost;
    powerSum += item.usedNetKg * p;
    impactSum += item.usedNetKg * im;
    bitterSum += item.usedNetKg * b;
    burnSum += item.usedNetKg * bu;
    sugarSum += item.usedNetKg * su;
    aromaSum += item.usedNetKg * ar;
    gradeScoreSum += item.usedNetKg * (GRADE_SCORES[item.colorGrade] || 2);

    return {
      ...item,
      powerRating: p,
      impactRating: im,
      bitterRating: b,
      burnRating: bu,
      sugarRating: su,
      aromaRating: ar,
      percentageInBlend: Number(percentageInBlend.toFixed(1)),
      subtotalCost: Math.round(subtotalCost),
      subtotalRealPaidCost: Math.round(subtotalRealPaidCost),
      embeddedWeightProfitRp,
    };
  });

  const totalProductionCost = Math.round(totalMaterialCost + totalOverheadCost);
  const totalRealPaidProductionCost = Math.round(totalRealPaidMaterialCost + totalOverheadCost);
  const totalBuyWeightProfitRp = Math.round(totalMaterialCost - totalRealPaidMaterialCost);
  const hppPerNetKg = Math.round((totalProductionCost / totalBlendNetKg) * 100) / 100;
  const effectiveRealPaidHppPerKg =
    Math.round((totalRealPaidProductionCost / totalBlendNetKg) * 100) / 100;

  const weightedPower = Number((powerSum / totalBlendNetKg).toFixed(1));
  const weightedImpact = Number((impactSum / totalBlendNetKg).toFixed(1));
  const weightedBitter = Number((bitterSum / totalBlendNetKg).toFixed(1));
  const weightedBurn = Number((burnSum / totalBlendNetKg).toFixed(1));
  const weightedSugar = Number((sugarSum / totalBlendNetKg).toFixed(1));
  const weightedAroma = Number((aromaSum / totalBlendNetKg).toFixed(1));
  const averageGradeScore = gradeScoreSum / totalBlendNetKg;
  const compositeColorGrade = scoreToColorGrade(averageGradeScore);

  return {
    totalBlendNetKg: Number(totalBlendNetKg.toFixed(2)),
    totalMaterialCost: Math.round(totalMaterialCost),
    totalRealPaidMaterialCost: Math.round(totalRealPaidMaterialCost),
    totalBuyWeightProfitRp,
    totalOverheadCost: Math.round(totalOverheadCost),
    totalProductionCost,
    totalRealPaidProductionCost,
    hppPerNetKg,
    effectiveRealPaidHppPerKg,
    weightedPower,
    weightedImpact,
    weightedBitter,
    weightedBurn,
    weightedSugar,
    weightedAroma,
    compositeColorGrade,
    updatedIngredients,
  };
}

export function calculateFactoryDelivery(params: {
  packaging: PackagingSpec;
  hppPerNetKg: number;
  totalProductionCost: number;
  factoryTargetPricePerKg: number;
}): {
  grossWeightShipped: number;
  realPackagingMassTotalKg: number;
  realTobaccoNetTotalKg: number;
  factoryDeductionKg: number;
  factoryNetBillableKg: number;
  factoryWeightProfitKg: number;
  factoryWeightProfitRp: number;
  totalHPPBatch: number;
  effectiveHppAfterTaraPerKg: number;
  projectedRevenue: number;
  projectedProfit: number;
  profitMarginPercent: number;
} {
  const { packaging, totalProductionCost, factoryTargetPricePerKg } = params;

  const {
    packageCount = 1,
    grossWeightPerPackage = 0,
    packagingMassKg = 0,
    netTobaccoWeightKg,
    factoryTaraFormula,
  } = packaging;
  const grossWeightShipped = packageCount * grossWeightPerPackage;
  const realPackagingMassTotalKg = Number((packageCount * (packagingMassKg || 0)).toFixed(2));
  const realTobaccoNetTotalKg = Number(
    (
      netTobaccoWeightKg !== undefined && netTobaccoWeightKg > 0
        ? packageCount * netTobaccoWeightKg
        : Math.max(0, grossWeightShipped - realPackagingMassTotalKg)
    ).toFixed(2)
  );

  const singlePackageTara = calculateTaraDeduction(grossWeightPerPackage, factoryTaraFormula);
  const factoryDeductionKg = Number((singlePackageTara.deductionKg * packageCount).toFixed(2));
  const factoryNetBillableKg = Number(Math.max(0, grossWeightShipped - factoryDeductionKg).toFixed(2));

  const factoryWeightProfitKg = Number((factoryNetBillableKg - realTobaccoNetTotalKg).toFixed(2));
  const factoryWeightProfitRp = Math.round(
    factoryWeightProfitKg * (factoryTargetPricePerKg || 0)
  );

  const projectedRevenue = Math.round(factoryNetBillableKg * (factoryTargetPricePerKg || 0));
  const totalHPPBatch = Math.round(totalProductionCost);
  const effectiveHppAfterTaraPerKg =
    factoryNetBillableKg > 0 ? Math.round((totalHPPBatch / factoryNetBillableKg) * 100) / 100 : 0;
  const projectedProfit = Math.round(projectedRevenue - totalHPPBatch);
  const profitMarginPercent =
    projectedRevenue > 0 ? Number(((projectedProfit / projectedRevenue) * 100).toFixed(2)) : 0;

  return {
    grossWeightShipped: Number(grossWeightShipped.toFixed(2)),
    realPackagingMassTotalKg,
    realTobaccoNetTotalKg,
    factoryDeductionKg,
    factoryNetBillableKg,
    factoryWeightProfitKg,
    factoryWeightProfitRp,
    totalHPPBatch,
    effectiveHppAfterTaraPerKg,
    projectedRevenue,
    projectedProfit,
    profitMarginPercent,
  };
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatSheetRp(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `Rp${rounded.toLocaleString('en-US')}`;
}

export function buildGoogleSheetText(params: {
  dateLabel: string;
  headerTitle: string;
  serials: FinishedTobaccoSerial[];
  mode: 'INTERNAL_COST' | 'FACTORY_NOTA';
  separator?: '\t' | ',';
}): string {
  const { dateLabel, headerTitle, serials, mode, separator = '\t' } = params;

  const cleanCell = (val: string | number) => {
    const str = String(val ?? '');
    if (separator === ',' && (str.includes(',') || str.includes('"'))) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[][] = [];
  const isInternal = mode === 'INTERNAL_COST';

  if (isInternal) {
    rows.push([
      'TANGGAL',
      dateLabel,
      `${headerTitle} (ARSIP PERSONAL)`,
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
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    rows.push([
      'NO',
      'SERI',
      'BRUTO',
      'TARA',
      'NETTO',
      'PACKAGING',
      'GRADE',
      'HARGA MODAL',
      'JUMLAH MODAL',
      'HARGA PABRIK',
      'JUMLAH PABRIK',
      'PROFIT',
    ]);
  } else {
    rows.push(['TANGGAL', dateLabel, headerTitle, '', '', '', '', '', '']);
    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push(['NO', 'SERI', 'BRUTO', 'TARA', 'NETTO', 'PACKAGING', 'GRADE', 'HARGA', 'JUMLAH']);
  }

  let sumBruto = 0;
  let sumTara = 0;
  let sumNetto = 0;
  let sumJumlahModal = 0;
  let sumJumlahPabrik = 0;
  let sumProfit = 0;

  serials.forEach((s, idx) => {
    const bruto = s.packaging.grossWeightPerPackage;
    const tara = s.factoryDeductionKg;
    const netto = Number(Math.max(0, bruto - tara).toFixed(2));
    const pkgName = s.packaging.packagingType.toUpperCase();
    const grade = s.compositeColorGrade;

    const modalPerKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg);
    const hargaNotaPerKg = Math.round(s.factoryTargetPricePerKg);

    const jumlahModal = Math.round(netto * modalPerKg);
    const jumlahNota = Math.round(netto * hargaNotaPerKg);
    const profitPerSeri = jumlahNota - jumlahModal;

    sumBruto += bruto;
    sumTara += tara;
    sumNetto += netto;
    sumJumlahModal += jumlahModal;
    sumJumlahPabrik += jumlahNota;
    sumProfit += profitPerSeri;

    if (isInternal) {
      rows.push([
        String(idx + 1),
        formatSerialLineage(s),
        String(bruto),
        String(tara),
        String(netto),
        pkgName,
        grade,
        formatSheetRp(modalPerKg),
        formatSheetRp(jumlahModal),
        formatSheetRp(hargaNotaPerKg),
        formatSheetRp(jumlahNota),
        formatSheetRp(profitPerSeri),
      ]);
    } else {
      rows.push([
        String(idx + 1),
        s.serialNumber,
        String(bruto),
        String(tara),
        String(netto),
        pkgName,
        grade,
        formatSheetRp(hargaNotaPerKg),
        formatSheetRp(jumlahNota),
      ]);
    }
  });

  if (isInternal) {
    rows.push([
      '',
      '',
      String(Number(sumBruto.toFixed(2))),
      String(Number(sumTara.toFixed(2))),
      String(Number(sumNetto.toFixed(2))),
      '',
      '',
      '',
      formatSheetRp(sumJumlahModal),
      '',
      formatSheetRp(sumJumlahPabrik),
      formatSheetRp(sumProfit),
    ]);
  } else {
    rows.push([
      '',
      '',
      String(Number(sumBruto.toFixed(2))),
      String(Number(sumTara.toFixed(2))),
      String(Number(sumNetto.toFixed(2))),
      '',
      '',
      '',
      formatSheetRp(sumJumlahPabrik),
    ]);
  }

  return rows.map((r) => r.map(cleanCell).join(separator)).join('\n');
}

export function buildFinishedBatchSyncCsv(params: {
  batches: FinishedTobaccoSerial[];
  separator?: ',' | '\t';
  includeMetadataBanner?: boolean;
  syncTitle?: string;
}): string {
  const {
    batches,
    separator = ',',
    includeMetadataBanner = false,
    syncTitle = 'SINKRONISASI BATCH TEMBAKAU JADI (MODAL PRODUKSI & HARGA TAGIH PABRIK)',
  } = params;

  const cleanCell = (val: string | number) => {
    const str = String(val ?? '');
    if (separator === ',' && (str.includes(',') || str.includes('"') || str.includes('\n'))) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[][] = [];

  if (includeMetadataBanner) {
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    rows.push([
      'TANGGAL SINKRONISASI',
      todayStr,
      syncTitle,
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
    rows.push(new Array(16).fill(''));
  }

  rows.push([
    'NO',
    'SERI',
    'RIWAYAT SERI (ASAL -> BARU)',
    'TANGGAL',
    'PABRIK TUJUAN',
    'EKS-PABRIK',
    'GULUNGAN',
    'EKS-GULUNGAN',
    'PACKAGING',
    'GRADE',
    'BRUTO (KG)',
    'TARA (KG)',
    'NETTO (KG)',
    'MODAL PRODUKSI / KG',
    'TOTAL MODAL PRODUKSI',
    'HARGA TAGIH / KG',
    'TOTAL TAGIHAN NOTA',
    'PROFIT BERSIH',
    'STATUS PABRIK',
  ]);

  let sumBruto = 0;
  let sumTara = 0;
  let sumNetto = 0;
  let sumTotalModal = 0;
  let sumTotalTagihan = 0;
  let sumProfit = 0;

  batches.forEach((b, idx) => {
    const bruto = Number(b.packaging.grossWeightPerPackage || 0);
    const tara = Number(b.factoryDeductionKg || 0);
    const netto = Number(Math.max(0, bruto - tara).toFixed(2));
    const pkgName = (b.packaging.packagingType || 'KRJ MUNTILAN').toUpperCase();
    const grade = b.compositeColorGrade || 'D';

    const productionCostPerKg = Math.round(b.effectiveHppAfterTaraPerKg || b.hppPerNetKg || 0);
    const totalProductionCost = Math.round(
      b.totalProductionCost || netto * productionCostPerKg
    );

    const billablePricePerKg = Math.round(b.factoryTargetPricePerKg || 0);
    const totalBillableAmount = Math.round(netto * billablePricePerKg);

    const netProfit = totalBillableAmount - totalProductionCost;

    const statusLabel =
      b.factoryStatus === 'ACCEPTED_CAIR'
        ? 'DITERIMA (UANG CAIR)'
        : b.factoryStatus === 'REJECTED_STOCK'
        ? 'REJECT (STOK JADI)'
        : 'MENUNGGU QC';

    sumBruto += bruto;
    sumTara += tara;
    sumNetto += netto;
    sumTotalModal += totalProductionCost;
    sumTotalTagihan += totalBillableAmount;
    sumProfit += netProfit;

    rows.push([
      String(idx + 1),
      b.serialNumber,
      formatSerialLineage(b),
      b.createdAt,
      b.targetFactory,
      b.previousFactory || '-',
      b.rollNumber || '-',
      b.previousRollNumber || '-',
      pkgName,
      grade,
      String(bruto),
      String(tara),
      String(netto),
      formatSheetRp(productionCostPerKg),
      formatSheetRp(totalProductionCost),
      formatSheetRp(billablePricePerKg),
      formatSheetRp(totalBillableAmount),
      formatSheetRp(netProfit),
      statusLabel,
    ]);
  });

  rows.push([
    'TOTAL',
    `${batches.length} SERI`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    String(Number(sumBruto.toFixed(2))),
    String(Number(sumTara.toFixed(2))),
    String(Number(sumNetto.toFixed(2))),
    '',
    formatSheetRp(sumTotalModal),
    '',
    formatSheetRp(sumTotalTagihan),
    formatSheetRp(sumProfit),
    '',
  ]);

  return rows.map((r) => r.map(cleanCell).join(separator)).join('\n');
}

export function formatSerialLineage(serial: {
  serialNumber: string;
  previousSerialNumber?: string;
  serialHistory?: string[];
}): string {
  const current = (serial.serialNumber || '').trim();
  if (Array.isArray(serial.serialHistory) && serial.serialHistory.length > 1) {
    const cleaned = serial.serialHistory.map((s) => s.trim()).filter(Boolean);
    const deduped = cleaned.filter((item, idx) => idx === 0 || item !== cleaned[idx - 1]);
    if (deduped.length > 1) {
      return deduped.join(' -> ');
    }
  }
  const prev = (serial.previousSerialNumber || '').trim();
  if (prev && prev !== current) {
    return `${prev} -> ${current}`;
  }
  return current;
}

export function hasSerialLineage(serial: {
  serialNumber: string;
  previousSerialNumber?: string;
  serialHistory?: string[];
}): boolean {
  return formatSerialLineage(serial).includes(' -> ');
}

export function applyRejectedSerialReassignment(params: {
  serial: FinishedTobaccoSerial;
  targetRoll: {
    id: string;
    rollNumber: string;
    recipeName: string;
    targetFactory: string;
    rackLocation: string;
    serialNumbers?: string[];
    serialNumber: string;
  };
  newSerialNumber?: string;
  newTargetFactory?: string;
  dateStr?: string;
}): {
  updatedSerial: FinishedTobaccoSerial;
  updatedTargetRollSerialNumbers: string[];
  lineageDisplay: string;
} {
  const { serial, targetRoll, newSerialNumber, newTargetFactory, dateStr } = params;
  const oldSerialNum = serial.serialNumber.trim();
  const nextSerialNum = (newSerialNumber ?? oldSerialNum).trim() || oldSerialNum;
  const isRenamed = nextSerialNum !== oldSerialNum;

  const existingHistory =
    Array.isArray(serial.serialHistory) && serial.serialHistory.length > 0
      ? [...serial.serialHistory]
      : serial.previousSerialNumber && serial.previousSerialNumber !== oldSerialNum
        ? [serial.previousSerialNumber, oldSerialNum]
        : [oldSerialNum];

  if (isRenamed && existingHistory[existingHistory.length - 1] !== nextSerialNum) {
    existingHistory.push(nextSerialNum);
  }

  const fromRollLabel =
    serial.previousRollNumber ||
    (serial.rollNumber ? `${serial.rollNumber} (${serial.targetFactory})` : 'GUL-LAMA');
  const fromFactoryName = serial.previousFactory || serial.targetFactory;
  const finalTargetFactory = (newTargetFactory || targetRoll.targetFactory).trim();
  const today = dateStr || new Date().toISOString().split('T')[0];

  const transferRecord = {
    id: `trf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: today,
    fromSerialNumber: oldSerialNum,
    toSerialNumber: nextSerialNum,
    fromRollId: serial.previousRollId || serial.rollId,
    fromRollNumber: fromRollLabel,
    toRollId: targetRoll.id,
    toRollNumber: `${targetRoll.rollNumber} (${targetRoll.recipeName})`,
    fromFactory: fromFactoryName,
    toFactory: finalTargetFactory,
    notes: isRenamed
      ? `Ubah Nomor Seri ${oldSerialNum} -> ${nextSerialNum} & masuk ke ${targetRoll.rollNumber} (${finalTargetFactory})`
      : `Masuk kembali ke ${targetRoll.rollNumber} (${finalTargetFactory}) dengan Nomor Seri tetap ${nextSerialNum}`,
  };

  const updatedSerial: FinishedTobaccoSerial = {
    ...serial,
    serialNumber: nextSerialNum,
    previousSerialNumber: isRenamed
      ? oldSerialNum
      : serial.previousSerialNumber,
    serialHistory: existingHistory,
    transferHistory: [...(serial.transferHistory || []), transferRecord],
    factoryStatus: 'PENDING',
    previousRollId: serial.previousRollId || serial.rollId,
    previousRollNumber: fromRollLabel,
    previousFactory: fromFactoryName,
    rollId: targetRoll.id,
    rollNumber: targetRoll.rollNumber,
    rollRackNumber: targetRoll.rackLocation,
    targetFactory: finalTargetFactory,
  };

  const currentRollSerials = (targetRoll.serialNumbers || []).filter(
    (s) => s !== oldSerialNum
  );
  const updatedTargetRollSerialNumbers = currentRollSerials.includes(nextSerialNum)
    ? currentRollSerials
    : [...currentRollSerials, nextSerialNum];

  return {
    updatedSerial,
    updatedTargetRollSerialNumbers,
    lineageDisplay: formatSerialLineage(updatedSerial),
  };
}
