import {
  TobaccoGrade,
  TaraFormula,
  AgentFeeItem,
  BlendIngredient,
  AdditionalCostItem,
  PackagingSpec,
  FinishedTobaccoSerial,
} from '../types/tobacco';

export const TOBACCO_GRADE_ORDER: TobaccoGrade[] = [
  'A',
  'A+',
  'B',
  'B+',
  'C',
  'C+',
  'D',
  'D+',
  'E',
  'E+',
  'F',
  'F+',
];

export const GRADE_SCORES: Record<TobaccoGrade, number> = {
  'A': 1,
  'A+': 2,
  'B': 3,
  'B+': 4,
  'C': 5,
  'C+': 6,
  'D': 7,
  'D+': 8,
  'E': 9,
  'E+': 10,
  'F': 11,
  'F+': 12,
};

export const GRADE_LABELS: Record<TobaccoGrade, { name: string; color: string; desc: string }> = {
  'A': {
    name: 'Grade A',
    color: 'bg-zinc-950 text-white border-zinc-800',
    desc: 'Grade A',
  },
  'A+': {
    name: 'Grade A+',
    color: 'bg-black text-amber-400 border-amber-500/70',
    desc: 'Grade A+',
  },
  'B': {
    name: 'Grade B',
    color: 'bg-zinc-900 text-white border-zinc-700',
    desc: 'Grade B',
  },
  'B+': {
    name: 'Grade B+',
    color: 'bg-zinc-900 text-zinc-200 border-zinc-800',
    desc: 'Grade B+',
  },
  'C': {
    name: 'Grade C',
    color: 'bg-zinc-900 text-zinc-300 border-zinc-700',
    desc: 'Grade C',
  },
  'C+': {
    name: 'Grade C+',
    color: 'bg-zinc-900 text-zinc-200 border-zinc-700',
    desc: 'Grade C+',
  },
  'D': {
    name: 'Grade D',
    color: 'bg-zinc-900 text-white border-zinc-700',
    desc: 'Grade D',
  },
  'D+': {
    name: 'Grade D+',
    color: 'bg-zinc-950 text-zinc-200 border-zinc-800',
    desc: 'Grade D+',
  },
  'E': {
    name: 'Grade E',
    color: 'bg-black text-amber-400 border-zinc-700',
    desc: 'Grade E',
  },
  'E+': {
    name: 'Grade E+',
    color: 'bg-black text-amber-400 border-amber-500/70',
    desc: 'Grade E+',
  },
  'F': {
    name: 'Grade F',
    color: 'bg-black text-amber-300 border-zinc-700',
    desc: 'Grade F',
  },
  'F+': {
    name: 'Grade F+',
    color: 'bg-black text-amber-400 border-amber-500',
    desc: 'Grade F+',
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
 * Pembulatan timbangan & potongan tembakau (Beli & Jual):
 * Desimal >= 0.5 dibulatkan ke atas menjadi bilangan bulat berikutnya
 * (contoh: 10% dari 50 kg = 5 kg; 10% dari 55..59 kg = 5.5..5.9 -> 6 kg; 2 kg + 5.8 kg = 2 + 6 = 8 kg).
 */
export function roundHalfUpKg(value: number): number {
  const clean = Math.max(0, Number((Number(value) || 0).toFixed(6)));
  return Math.floor(clean + 0.5);
}

/**
 * Menghitung potongan tara timbangan dari Bruto (berlaku sama untuk Beli & Jual/Setor Pabrik):
 * - Potongan % dibulatkan ke atas jika >= 0.5 (misal 10% dari 55..59 kg = 5.5..5.9 -> 6 kg)
 * - Total Potongan = Potongan % (bulat) + Flat KG + Sampel KG
 * - Netto = Bruto - Total Potongan
 */
export function calculateTaraDeduction(
  grossWeightKg: number,
  formula: { percent: number; flatKg: number; sampleKg?: number }
): {
  deductionKg: number;
  netWeightKg: number;
  effectivePercent: number;
  rawPercentPart: number;
  roundedPercentPart: number;
} {
  const gross = roundHalfUpKg(grossWeightKg);
  const rawPercentPart = Number((gross * ((formula.percent || 0) / 100)).toFixed(2));
  const percentPart = roundHalfUpKg(rawPercentPart);
  const flatPart = roundHalfUpKg(formula.flatKg || 0);
  const samplePart = roundHalfUpKg(formula.sampleKg || 0);
  const rawDeduction = roundHalfUpKg(percentPart + flatPart + samplePart);

  const deductionKg = Math.min(gross, Math.max(0, rawDeduction));
  const netWeightKg = Math.max(0, gross - deductionKg);
  const effectivePercent = gross > 0 ? (deductionKg / gross) * 100 : 0;

  return {
    deductionKg,
    netWeightKg,
    effectivePercent: Number(effectivePercent.toFixed(2)),
    rawPercentPart,
    roundedPercentPart: percentPart,
  };
}

/**
 * Menghitung Modal Pembelian Tembakau Mentah:
 * - Netto = Bruto - Potongan Tarra (misal 50 kg dengan potongan 10% + 2 kg -> 50 - 5 - 2 = 43 kg)
 * - Biaya Tambahan Fee (Added Cost) = Netto * Total Fee/KG (misal 43 kg * Rp 1.000 = Rp 43.000)
 * - Harga Total / KG = Harga Tembakau Dasar + Total Fee/KG (misal Rp 50.000 + Rp 1.000 = Rp 51.000/kg)
 * - Total Modal Bayar = Netto * (Harga Tembakau Dasar + Total Fee/KG) (misal 43 kg * Rp 51.000 = Rp 2.193.000)
 */
export function calculateRawTobaccoCost(params: {
  grossWeightKg: number;
  pricePerKgPurchase: number;
  taraFormula: TaraFormula;
  additionalCost?: number;
  realPackagingMassKg?: number;
  agentFees?: AgentFeeItem[];
  totalAgentFeePerKg?: number;
}): {
  deductionKg: number;
  netWeightKg: number;
  baseTobaccoCostRp: number;
  totalAgentFeePerKg: number;
  totalAgentFeeRp: number;
  effectivePricePerKgWithFee: number;
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
    agentFees,
    totalAgentFeePerKg: explicitAgentFeePerKg,
  } = params;

  const gross = roundHalfUpKg(grossWeightKg);
  const { deductionKg, netWeightKg, effectivePercent } = calculateTaraDeduction(
    gross,
    taraFormula
  );

  const basePricePerKg = Math.max(0, Number(pricePerKgPurchase) || 0);
  const baseTobaccoCostRp = Math.round(netWeightKg * basePricePerKg);

  const computedFeePerKg = Array.isArray(agentFees)
    ? agentFees.reduce((sum, f) => sum + (Math.max(0, Number(f.feePerKg) || 0)), 0)
    : Math.max(0, Number(explicitAgentFeePerKg) || 0);

  const totalAgentFeePerKg = Math.round(computedFeePerKg);
  const totalAgentFeeRp = Math.round(netWeightKg * totalAgentFeePerKg);
  const effectivePricePerKgWithFee = basePricePerKg + totalAgentFeePerKg;

  // Total Modal = Netto * (Harga Tembakau + Fee/KG) = baseTobaccoCostRp + totalAgentFeeRp
  const totalModalAsal = Math.round(netWeightKg * effectivePricePerKgWithFee);
  const totalInvoiceCost = totalModalAsal + (Number(additionalCost) || 0);

  const realPackagingMassKg = deductionKg;
  const realNetWeightKg = netWeightKg;
  const realStockValueRp = baseTobaccoCostRp;
  const purchaseWeightProfitKg = 0;
  const purchaseWeightProfitRp = 0;

  const realCostPerNetKg =
    netWeightKg > 0 ? totalInvoiceCost / netWeightKg : effectivePricePerKgWithFee;
  const effectiveCostPerRealKg = realCostPerNetKg;

  return {
    deductionKg,
    netWeightKg,
    baseTobaccoCostRp,
    totalAgentFeePerKg,
    totalAgentFeeRp,
    effectivePricePerKgWithFee,
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
  const idx = Math.max(0, Math.min(TOBACCO_GRADE_ORDER.length - 1, Math.round(score) - 1));
  return TOBACCO_GRADE_ORDER[idx] || 'D';
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

    const paymentSuffix =
      b.paymentStatus === 'CAIR' ? ' (CAIR)' : ' (BELUM CAIR)';
    const statusLabel =
      b.factoryStatus === 'ACCEPTED_CAIR'
        ? `DITERIMA / ACCEPTED${paymentSuffix}`
        : b.factoryStatus === 'REJECTED_STOCK'
        ? 'REJECT (STOK JADI)'
        : 'MENUNGGU PABRIK';

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
