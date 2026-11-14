import {
  TobaccoGrade,
  TaraFormula,
  AgentFeeItem,
  BlendIngredient,
  AdditionalCostItem,
  PackagingSpec,
  FinishedTobaccoSerial,
  RawTobacco,
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
    realPackagingMassKg: explicitRealPkgKg,
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

  // Total Modal / Inventory Value = Netto * (Harga Tembakau + Fee/KG) + Biaya Tambahan Lain
  const totalModalAsal = Math.round(netWeightKg * effectivePricePerKgWithFee);
  const totalInvoiceCost = totalModalAsal + (Number(additionalCost) || 0);

  // Wadah Riil (KG): jika diisi (>0) gunakan nilai tersebut; jika kosong (0), gunakan Tarra Flat (berat keranjang) atau Total Potongan
  const candidatePkgMass =
    explicitRealPkgKg !== undefined && explicitRealPkgKg > 0
      ? roundHalfUpKg(explicitRealPkgKg)
      : taraFormula.packagingMassKg !== undefined && taraFormula.packagingMassKg > 0
        ? roundHalfUpKg(taraFormula.packagingMassKg)
        : (taraFormula.flatKg || 0) > 0
          ? roundHalfUpKg(taraFormula.flatKg)
          : deductionKg;

  const realPackagingMassKg = gross > 0 ? Math.min(gross, candidatePkgMass) : 0;
  const realNetWeightKg = gross > 0 ? Math.max(0, gross - realPackagingMassKg) : 0;

  // Weight Profit (KG) = Netto Fisik Riil - Netto Nota
  const purchaseWeightProfitKg =
    gross > 0 ? Number((realNetWeightKg - netWeightKg).toFixed(2)) : 0;

  // Weight Profit (Rp) = Weight Profit (KG) * Harga Tembakau Dasar (Fee adalah biaya tambahan modal, BUKAN profit)
  const purchaseWeightProfitRp = Math.round(purchaseWeightProfitKg * basePricePerKg);
  const realStockValueRp = totalInvoiceCost + purchaseWeightProfitRp;

  const realCostPerNetKg =
    netWeightKg > 0 ? totalInvoiceCost / netWeightKg : effectivePricePerKgWithFee;
  const effectiveCostPerRealKg =
    realNetWeightKg > 0 ? totalInvoiceCost / realNetWeightKg : realCostPerNetKg;

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

/**
 * Base Grade Letter Families in ascending order (A = highest/lightest, I = lowest/darkest)
 */
export const GRADE_LETTER_FAMILIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

/**
 * Given a target grade (e.g., 'D' or 'D+'), automatically returns the allowed grades
 * covering 1 level below (e.g., C, C+) and 2 levels above (e.g., E, E+, F, F+),
 * plus optionally the target grade family itself (D, D+).
 *
 * Example for D or D+:
 * - includeTargetFamily = true (default): ['C', 'C+', 'D', 'D+', 'E', 'E+', 'F', 'F+']
 * - includeTargetFamily = false (strict cross-grade): ['C', 'C+', 'E', 'E+', 'F']
 */
export function getAllowedGradesForTarget(
  targetGrade: TobaccoGrade,
  options?: { includeTargetFamily?: boolean; includeTopPlus?: boolean }
): TobaccoGrade[] {
  const includeTargetFamily = options?.includeTargetFamily ?? true;
  const includeTopPlus = options?.includeTopPlus ?? false;

  const baseLetter = targetGrade.replace('+', '');
  const baseIdx = GRADE_LETTER_FAMILIES.indexOf(
    baseLetter as (typeof GRADE_LETTER_FAMILIES)[number]
  );

  if (baseIdx === -1) {
    return [...TOBACCO_GRADE_ORDER];
  }

  const minFamilyIdx = Math.max(0, baseIdx - 1); // 1 level below (e.g. C for D)
  const maxFamilyIdx = Math.min(GRADE_LETTER_FAMILIES.length - 1, baseIdx + 2); // 2 levels above (e.g. E, F for D)

  const allowedFamilies = new Set<string>();
  for (let idx = minFamilyIdx; idx <= maxFamilyIdx; idx++) {
    if (!includeTargetFamily && idx === baseIdx) continue;
    allowedFamilies.add(GRADE_LETTER_FAMILIES[idx]);
  }

  const topFamilyLetter = GRADE_LETTER_FAMILIES[maxFamilyIdx];

  return TOBACCO_GRADE_ORDER.filter((grade) => {
    const family = grade.replace('+', '');
    if (!allowedFamilies.has(family)) return false;
    // Example: For D/D+, 2 levels above is E, E+, and F (F+ excluded unless includeTopPlus is true)
    if (!includeTopPlus && grade === `${topFamilyLetter}+` && maxFamilyIdx === baseIdx + 2) {
      return false;
    }
    return true;
  });
}

/**
 * Extracts normalized unique origin names (Daerah Asal) from raw tobacco inventory
 */
export function extractUniqueOrigins(rawTobaccos: RawTobacco[]): string[] {
  const seen = new Set<string>();
  const origins: string[] = [];
  for (const t of rawTobaccos) {
    const trimmed = (t.origin || '').trim();
    if (!trimmed) continue;
    if (!seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      origins.push(trimmed);
    }
  }
  return origins.sort((a, b) => a.localeCompare(b, 'id-ID'));
}

export interface AutoBlendSensoryTargets {
  power: number;
  impact: number;
  bitter: number;
  burn: number;
  sugar: number;
  aroma: number;
}

export interface AutoBlendConfig {
  rawTobaccos: RawTobacco[];
  /** Setting 1: 'ALL' uses all available stock (>0 kg); 'SELECTED' uses only selectedTobaccoIds */
  stockMode: 'ALL' | 'SELECTED';
  selectedTobaccoIds?: string[];
  /** Setting 2: Target grade & allowed grade list (auto-populated -1 level to +2 levels) */
  targetGrade: TobaccoGrade;
  allowedGrades: TobaccoGrade[];
  /** Setting 3: Desired sensory character ratings (/5 scale) */
  targetSensory: AutoBlendSensoryTargets;
  /** Setting 4: Allowed origins (empty = all origins), target HPP/kg, and desired total blend weight */
  allowedOrigins: string[];
  targetPricePerKg: number;
  targetTotalKg: number;
  /** Optional smart protections */
  respectStockCap?: boolean;
  prioritizeWeightProfit?: boolean;
}

export interface AutoBlendParameterDiagnostic {
  key: 'power' | 'impact' | 'bitter' | 'burn' | 'sugar' | 'aroma' | 'price' | 'grade';
  label: string;
  targetValue: number;
  achievedValue: number;
  minInPool: number;
  maxInPool: number;
  avgInPool: number;
  isWithinPoolBounds: boolean;
  isCloselyAchieved: boolean;
  status: 'OPTIMAL' | 'CLOSE_TRADEOFF' | 'IMPOSSIBLE_TOO_LOW' | 'IMPOSSIBLE_TOO_HIGH';
  explanation: string;
}

export interface AutoBlendResult {
  isPoolEmpty: boolean;
  isFullyFeasible: boolean;
  hasOutOfBoundsTarget: boolean;
  hasCoupledTradeoff: boolean;
  candidatePool: RawTobacco[];
  maxAvailablePoolKg: number;
  effectiveTotalKg: number;
  recommendedIngredients: BlendIngredient[];
  achievedMetrics: ReturnType<typeof calculateBlendMetrics>;
  parameterDiagnostics: AutoBlendParameterDiagnostic[];
  impossibilityWarnings: string[];
  summaryMessage: string;
}

/**
 * Pure deterministic solver for the 4-Condition Auto-Racik Engine.
 * - Filters stock by Setting 1 (Stock Scope), Setting 2 (Grade Window), and Setting 4a (Daerah Asal).
 * - Checks strict mathematical convex bounds [minInPool, maxInPool] for Setting 3 (6 Karakter) & Setting 4b (Harga/HPP).
 * - Solves for optimal simplex weights w_i >= 0, sum(w_i) = 1 (respecting individual stock caps) to get as close as possible.
 * - Never fabricates numbers or excuses: reports exact mathematical impossibility or trade-off reasons when targets cannot be averaged.
 */
export function solveAutoBlend(config: AutoBlendConfig): AutoBlendResult {
  const {
    rawTobaccos,
    stockMode,
    selectedTobaccoIds = [],
    targetGrade,
    allowedGrades,
    targetSensory,
    allowedOrigins,
    targetPricePerKg,
    targetTotalKg,
    respectStockCap = true,
    prioritizeWeightProfit = false,
  } = config;

  // 1. Filter candidate stock pool with positive stock
  const availableStocks = rawTobaccos.filter((t) => (t.currentStockNetKg || 0) > 0);

  const afterStockScope =
    stockMode === 'SELECTED'
      ? availableStocks.filter((t) => selectedTobaccoIds.includes(t.id))
      : availableStocks;

  const afterGradeFilter =
    allowedGrades.length > 0
      ? afterStockScope.filter((t) => allowedGrades.includes(t.colorGrade))
      : afterStockScope;

  const normalizedOrigins = allowedOrigins.map((o) => o.trim().toLowerCase()).filter(Boolean);
  const candidatePool =
    normalizedOrigins.length > 0
      ? afterGradeFilter.filter((t) =>
          normalizedOrigins.includes((t.origin || '').trim().toLowerCase())
        )
      : afterGradeFilter;

  if (candidatePool.length === 0) {
    const emptyMetrics = calculateBlendMetrics({ ingredients: [], additionalCosts: [] });
    let emptyReason = 'Tidak ada stok tembakau mentah dengan sisa berat > 0 kg.';
    if (availableStocks.length > 0 && afterStockScope.length === 0) {
      emptyReason = 'Belum ada stok tembakau yang dicentang pada pilihan "Stok Tertentu".';
    } else if (afterStockScope.length > 0 && afterGradeFilter.length === 0) {
      emptyReason = `Tidak ada stok dengan Grade [${allowedGrades.join(', ')}] untuk target Grade ${targetGrade}.`;
    } else if (afterGradeFilter.length > 0 && candidatePool.length === 0) {
      emptyReason = `Tidak ada stok dari Daerah Asal [${allowedOrigins.join(', ')}] yang cocok dengan filter Grade [${allowedGrades.join(', ')}].`;
    }

    return {
      isPoolEmpty: true,
      isFullyFeasible: false,
      hasOutOfBoundsTarget: true,
      hasCoupledTradeoff: false,
      candidatePool: [],
      maxAvailablePoolKg: 0,
      effectiveTotalKg: 0,
      recommendedIngredients: [],
      achievedMetrics: emptyMetrics,
      parameterDiagnostics: [],
      impossibilityWarnings: [emptyReason],
      summaryMessage: emptyReason,
    };
  }

  const maxAvailablePoolKg = Number(
    candidatePool.reduce((sum, t) => sum + (t.currentStockNetKg || 0), 0).toFixed(2)
  );
  const desiredTotalKg = Math.max(1, Number(targetTotalKg) || 100);
  const effectiveTotalKg = respectStockCap
    ? Math.min(desiredTotalKg, maxAvailablePoolKg)
    : desiredTotalKg;

  // 2. Compute pool bounds [min, max, avg] for each parameter
  const getPoolStats = (getter: (t: RawTobacco) => number) => {
    const vals = candidatePool.map(getter);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg };
  };

  const powerStats = getPoolStats((t) => clampRating5(t.powerRating));
  const impactStats = getPoolStats((t) => clampRating5(t.impactRating));
  const bitterStats = getPoolStats((t) => clampRating5(t.bitterRating));
  const burnStats = getPoolStats((t) => clampRating5(t.burnRating ?? 4.5));
  const sugarStats = getPoolStats((t) => clampRating5(t.sugarRating ?? 4.0));
  const aromaStats = getPoolStats((t) => clampRating5(t.aromaRating ?? 4.2));
  const priceStats = getPoolStats((t) => t.realCostPerNetKg);
  const gradeStats = getPoolStats((t) => GRADE_SCORES[t.colorGrade] || 6);

  const targetGradeScore = GRADE_SCORES[targetGrade] || 6;
  const n = candidatePool.length;

  // Upper bound on weight share w_i based on available stock
  const maxShares = candidatePool.map((t) =>
    respectStockCap && effectiveTotalKg > 0
      ? Math.min(1, Math.max(0, (t.currentStockNetKg || 0) / effectiveTotalKg))
      : 1
  );

  // Project vector w onto bounded simplex: 0 <= w_i <= maxShares[i], sum(w_i) = 1
  const projectOntoBoundedSimplex = (weights: number[]): number[] => {
    const w = weights.map((val, i) => Math.max(0, Math.min(maxShares[i], val)));
    let sum = w.reduce((a, b) => a + b, 0);

    if (sum <= 1e-9) {
      // Fallback: distribute proportional to maxShares
      const capSum = maxShares.reduce((a, b) => a + b, 0) || 1;
      return maxShares.map((c) => c / capSum);
    }

    // Iteratively redistribute excess or deficit while respecting [0, maxShares[i]]
    for (let iter = 0; iter < 12; iter++) {
      sum = w.reduce((a, b) => a + b, 0);
      const diff = 1 - sum;
      if (Math.abs(diff) < 1e-7) break;

      if (diff > 0) {
        // Need to add weight to non-saturated items
        const freeIndices = w
          .map((val, idx) => (val < maxShares[idx] - 1e-7 ? idx : -1))
          .filter((idx) => idx !== -1);
        if (freeIndices.length === 0) break;
        const addPerItem = diff / freeIndices.length;
        for (const idx of freeIndices) {
          w[idx] = Math.min(maxShares[idx], w[idx] + addPerItem);
        }
      } else {
        // Need to remove weight from positive items
        const posIndices = w
          .map((val, idx) => (val > 1e-7 ? idx : -1))
          .filter((idx) => idx !== -1);
        if (posIndices.length === 0) break;
        const subPerItem = -diff / posIndices.length;
        for (const idx of posIndices) {
          w[idx] = Math.max(0, w[idx] - subPerItem);
        }
      }
    }
    return w;
  };

  // Pre-extract feature vectors for fast evaluation
  const pPower = candidatePool.map((t) => clampRating5(t.powerRating));
  const pImpact = candidatePool.map((t) => clampRating5(t.impactRating));
  const pBitter = candidatePool.map((t) => clampRating5(t.bitterRating));
  const pBurn = candidatePool.map((t) => clampRating5(t.burnRating ?? 4.5));
  const pSugar = candidatePool.map((t) => clampRating5(t.sugarRating ?? 4.0));
  const pAroma = candidatePool.map((t) => clampRating5(t.aromaRating ?? 4.2));
  const pPrice = candidatePool.map((t) => t.realCostPerNetKg);
  const pGrade = candidatePool.map((t) => GRADE_SCORES[t.colorGrade] || 6);
  const pWeightProfitRatio = candidatePool.map((t) =>
    t.netWeightKg > 0 ? (t.purchaseWeightProfitKg || 0) / t.netWeightKg : 0
  );

  const priceScale = Math.max(15000, priceStats.avg * 0.2);

  // Objective function: weighted squared error across sensory, price, and grade targets
  const evaluateLoss = (w: number[]): number => {
    let mPower = 0;
    let mImpact = 0;
    let mBitter = 0;
    let mBurn = 0;
    let mSugar = 0;
    let mAroma = 0;
    let mPrice = 0;
    let mGrade = 0;
    let mProfitBonus = 0;

    for (let i = 0; i < n; i++) {
      const wi = w[i];
      mPower += wi * pPower[i];
      mImpact += wi * pImpact[i];
      mBitter += wi * pBitter[i];
      mBurn += wi * pBurn[i];
      mSugar += wi * pSugar[i];
      mAroma += wi * pAroma[i];
      mPrice += wi * pPrice[i];
      mGrade += wi * pGrade[i];
      mProfitBonus += wi * pWeightProfitRatio[i];
    }

    const errSensory =
      Math.pow((mPower - targetSensory.power) / 0.5, 2) +
      Math.pow((mImpact - targetSensory.impact) / 0.5, 2) +
      Math.pow((mBitter - targetSensory.bitter) / 0.5, 2) +
      Math.pow((mBurn - targetSensory.burn) / 0.5, 2) +
      Math.pow((mSugar - targetSensory.sugar) / 0.5, 2) +
      Math.pow((mAroma - targetSensory.aroma) / 0.5, 2);

    const errPrice =
      targetPricePerKg > 0 ? Math.pow((mPrice - targetPricePerKg) / priceScale, 2) * 1.5 : 0;

    const errGrade = Math.pow((mGrade - targetGradeScore) / 1.5, 2) * 0.8;

    const profitTerm = prioritizeWeightProfit ? -0.35 * mProfitBonus : 0;

    return errSensory + errPrice + errGrade + profitTerm;
  };

  // Multi-start coordinate descent optimization over bounded simplex
  const initialCandidates: number[][] = [
    projectOntoBoundedSimplex(new Array(n).fill(1 / n)),
    // Price-focused start
    projectOntoBoundedSimplex(
      candidatePool.map((t) =>
        1 / Math.max(1000, Math.abs(t.realCostPerNetKg - (targetPricePerKg || priceStats.avg)))
      )
    ),
    // Sensory-focused start
    projectOntoBoundedSimplex(
      candidatePool.map((t, idx) => {
        const dist =
          Math.abs(pPower[idx] - targetSensory.power) +
          Math.abs(pImpact[idx] - targetSensory.impact) +
          Math.abs(pBitter[idx] - targetSensory.bitter) +
          Math.abs(pBurn[idx] - targetSensory.burn) +
          Math.abs(pSugar[idx] - targetSensory.sugar) +
          Math.abs(pAroma[idx] - targetSensory.aroma);
        return 1 / Math.max(0.1, dist);
      })
    ),
  ];

  let bestW = initialCandidates[0];
  let bestLoss = evaluateLoss(bestW);

  for (const startW of initialCandidates) {
    let w = [...startW];
    let currentLoss = evaluateLoss(w);

    const stepSizes = [0.2, 0.1, 0.05, 0.02, 0.008, 0.002];
    for (const step of stepSizes) {
      for (let round = 0; round < 35; round++) {
        let improved = false;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const maxTransfer = Math.min(step, maxShares[i] - w[i], w[j]);
            if (maxTransfer <= 1e-5) continue;

            w[i] += maxTransfer;
            w[j] -= maxTransfer;
            const candidateLoss = evaluateLoss(w);
            if (candidateLoss + 1e-9 < currentLoss) {
              currentLoss = candidateLoss;
              improved = true;
            } else {
              w[i] -= maxTransfer;
              w[j] += maxTransfer;
            }
          }
        }
        if (!improved) break;
      }
    }

    if (currentLoss < bestLoss) {
      bestLoss = currentLoss;
      bestW = w;
    }
  }

  // Convert optimal simplex weights to KG quantities summing to effectiveTotalKg
  let rawKgAllocations = bestW.map((wi, idx) => {
    const rawKg = wi * effectiveTotalKg;
    // Prune tiny trace allocations (< 1.5% of total blend and < 1 kg) unless pool only has 1 item
    if (n > 1 && wi < 0.015 && rawKg < 1) return 0;
    const cappedKg = respectStockCap
      ? Math.min(candidatePool[idx].currentStockNetKg, rawKg)
      : rawKg;
    return Math.round(cappedKg * 2) / 2; // Round to nearest 0.5 kg for practical factory weighing
  });

  // Ensure at least 1 ingredient is selected and adjust largest ingredient so sum matches effectiveTotalKg
  let sumKg = rawKgAllocations.reduce((a, b) => a + b, 0);
  if (sumKg <= 0) {
    rawKgAllocations = bestW.map((wi) => Number((wi * effectiveTotalKg).toFixed(1)));
    sumKg = rawKgAllocations.reduce((a, b) => a + b, 0);
  } else if (Math.abs(sumKg - effectiveTotalKg) >= 0.5) {
    const diffKg = Number((effectiveTotalKg - sumKg).toFixed(1));
    // Add/subtract diffKg to the non-zero ingredient that has capacity
    let adjusted = false;
    for (let idx = 0; idx < n; idx++) {
      if (rawKgAllocations[idx] <= 0) continue;
      const newKg = rawKgAllocations[idx] + diffKg;
      const cap = respectStockCap ? candidatePool[idx].currentStockNetKg : Infinity;
      if (newKg >= 0.5 && newKg <= cap) {
        rawKgAllocations[idx] = Number(newKg.toFixed(1));
        adjusted = true;
        break;
      }
    }
    if (!adjusted) {
      // Fallback: distribute across any available stock capacity
      rawKgAllocations = bestW.map((wi, idx) => {
        const cap = respectStockCap ? candidatePool[idx].currentStockNetKg : Infinity;
        return Number(Math.min(cap, wi * effectiveTotalKg).toFixed(1));
      });
    }
  }

  const recommendedIngredients: BlendIngredient[] = [];
  for (let i = 0; i < n; i++) {
    const usedNetKg = rawKgAllocations[i];
    if (usedNetKg <= 0) continue;
    const raw = candidatePool[i];
    recommendedIngredients.push({
      tobaccoId: raw.id,
      tobaccoName: raw.name,
      origin: raw.origin,
      sellerName: raw.sellerName,
      usedNetKg,
      percentageInBlend: 0,
      realCostPerNetKg: raw.realCostPerNetKg,
      effectiveCostPerRealKg: raw.effectiveCostPerRealKg ?? raw.realCostPerNetKg,
      subtotalCost: Math.round(usedNetKg * raw.realCostPerNetKg),
      powerRating: clampRating5(raw.powerRating),
      impactRating: clampRating5(raw.impactRating),
      bitterRating: clampRating5(raw.bitterRating),
      burnRating: clampRating5(raw.burnRating ?? 4.5),
      sugarRating: clampRating5(raw.sugarRating ?? 4.0),
      aromaRating: clampRating5(raw.aromaRating ?? 4.2),
      colorGrade: raw.colorGrade,
      characterNotes: raw.characterNotes,
    });
  }

  const achievedMetrics = calculateBlendMetrics({
    ingredients: recommendedIngredients,
    additionalCosts: [],
  });

  // 3. Build Honest Parameter Diagnostics & Mathematical Feasibility Warnings
  const impossibilityWarnings: string[] = [];

  if (respectStockCap && desiredTotalKg > maxAvailablePoolKg) {
    impossibilityWarnings.push(
      `Berat disesuaikan ke maksimal stok (${effectiveTotalKg} kg dari permintaan ${desiredTotalKg} kg).`
    );
  }

  const buildSensoryDiag = (
    key: AutoBlendParameterDiagnostic['key'],
    label: string,
    targetVal: number,
    achievedVal: number,
    stats: { min: number; max: number; avg: number }
  ): AutoBlendParameterDiagnostic => {
    const minVal = Number(stats.min.toFixed(1));
    const maxVal = Number(stats.max.toFixed(1));
    const avgVal = Number(stats.avg.toFixed(1));
    const tVal = Number(targetVal.toFixed(1));
    const aVal = Number(achievedVal.toFixed(1));

    if (tVal < minVal - 0.05) {
      const msg = `Mentok bawah: Stok min ${minVal} (tidak bisa turun ke ${tVal}) • Hasil: ${aVal}`;
      impossibilityWarnings.push(`${label}: ${msg}`);
      return {
        key,
        label,
        targetValue: tVal,
        achievedValue: aVal,
        minInPool: minVal,
        maxInPool: maxVal,
        avgInPool: avgVal,
        isWithinPoolBounds: false,
        isCloselyAchieved: false,
        status: 'IMPOSSIBLE_TOO_LOW',
        explanation: msg,
      };
    }

    if (tVal > maxVal + 0.05) {
      const msg = `Mentok atas: Stok maks ${maxVal} (tidak bisa naik ke ${tVal}) • Hasil: ${aVal}`;
      impossibilityWarnings.push(`${label}: ${msg}`);
      return {
        key,
        label,
        targetValue: tVal,
        achievedValue: aVal,
        minInPool: minVal,
        maxInPool: maxVal,
        avgInPool: avgVal,
        isWithinPoolBounds: false,
        isCloselyAchieved: false,
        status: 'IMPOSSIBLE_TOO_HIGH',
        explanation: msg,
      };
    }

    const diff = Math.abs(aVal - tVal);
    if (diff > 0.35) {
      const msg = `Kompromi di ${aVal} (Stok ${minVal}–${maxVal}) mengikuti keseimbangan harga/rasa lain`;
      impossibilityWarnings.push(`${label}: ${msg}`);
      return {
        key,
        label,
        targetValue: tVal,
        achievedValue: aVal,
        minInPool: minVal,
        maxInPool: maxVal,
        avgInPool: avgVal,
        isWithinPoolBounds: true,
        isCloselyAchieved: false,
        status: 'CLOSE_TRADEOFF',
        explanation: msg,
      };
    }

    return {
      key,
      label,
      targetValue: tVal,
      achievedValue: aVal,
      minInPool: minVal,
      maxInPool: maxVal,
      avgInPool: avgVal,
      isWithinPoolBounds: true,
      isCloselyAchieved: true,
      status: 'OPTIMAL',
      explanation: `Pas di zona stok (${minVal}–${maxVal}) • Hasil: ${aVal}`,
    };
  };

  const parameterDiagnostics: AutoBlendParameterDiagnostic[] = [
    buildSensoryDiag('power', 'Power', targetSensory.power, achievedMetrics.weightedPower, powerStats),
    buildSensoryDiag('impact', 'Impact', targetSensory.impact, achievedMetrics.weightedImpact, impactStats),
    buildSensoryDiag('bitter', 'Bitter', targetSensory.bitter, achievedMetrics.weightedBitter, bitterStats),
    buildSensoryDiag('burn', 'Burn', targetSensory.burn, achievedMetrics.weightedBurn, burnStats),
    buildSensoryDiag('sugar', 'Sugar', targetSensory.sugar, achievedMetrics.weightedSugar, sugarStats),
    buildSensoryDiag('aroma', 'Aroma', targetSensory.aroma, achievedMetrics.weightedAroma, aromaStats),
  ];

  // Price / HPP Diagnostic
  if (targetPricePerKg > 0) {
    const minPrice = Math.round(priceStats.min);
    const maxPrice = Math.round(priceStats.max);
    const avgPrice = Math.round(priceStats.avg);
    const achievedPrice = Math.round(achievedMetrics.hppPerNetKg);
    const targetP = Math.round(targetPricePerKg);

    if (targetP < minPrice - 500) {
      const msg = `Mentok bawah: Stok termurah ${formatRupiah(minPrice)}/kg • Hasil: ${formatRupiah(achievedPrice)}/kg`;
      impossibilityWarnings.push(`HPP/KG: ${msg}`);
      parameterDiagnostics.push({
        key: 'price',
        label: 'Harga Modal (HPP/KG)',
        targetValue: targetP,
        achievedValue: achievedPrice,
        minInPool: minPrice,
        maxInPool: maxPrice,
        avgInPool: avgPrice,
        isWithinPoolBounds: false,
        isCloselyAchieved: false,
        status: 'IMPOSSIBLE_TOO_LOW',
        explanation: msg,
      });
    } else if (targetP > maxPrice + 500) {
      const msg = `Lebih hemat dari target: Stok maks ${formatRupiah(maxPrice)}/kg • Hasil: ${formatRupiah(achievedPrice)}/kg`;
      parameterDiagnostics.push({
        key: 'price',
        label: 'Harga Modal (HPP/KG)',
        targetValue: targetP,
        achievedValue: achievedPrice,
        minInPool: minPrice,
        maxInPool: maxPrice,
        avgInPool: avgPrice,
        isWithinPoolBounds: false,
        isCloselyAchieved: true,
        status: 'OPTIMAL',
        explanation: msg,
      });
    } else {
      const relDiff = Math.abs(achievedPrice - targetP) / Math.max(1, targetP);
      if (relDiff > 0.1) {
        const msg = `Kompromi di ${formatRupiah(achievedPrice)}/kg (Stok ${formatRupiah(minPrice)}–${formatRupiah(maxPrice)}) demi menjaga rasa`;
        impossibilityWarnings.push(`HPP/KG: ${msg}`);
        parameterDiagnostics.push({
          key: 'price',
          label: 'Harga Modal (HPP/KG)',
          targetValue: targetP,
          achievedValue: achievedPrice,
          minInPool: minPrice,
          maxInPool: maxPrice,
          avgInPool: avgPrice,
          isWithinPoolBounds: true,
          isCloselyAchieved: false,
          status: 'CLOSE_TRADEOFF',
          explanation: msg,
        });
      } else {
        parameterDiagnostics.push({
          key: 'price',
          label: 'Harga Modal (HPP/KG)',
          targetValue: targetP,
          achievedValue: achievedPrice,
          minInPool: minPrice,
          maxInPool: maxPrice,
          avgInPool: avgPrice,
          isWithinPoolBounds: true,
          isCloselyAchieved: true,
          status: 'OPTIMAL',
          explanation: `Pas di zona stok (${formatRupiah(achievedPrice)}/kg)`,
        });
      }
    }
  }

  const hasOutOfBoundsTarget = parameterDiagnostics.some((d) => !d.isWithinPoolBounds && d.status !== 'OPTIMAL');
  const hasCoupledTradeoff = parameterDiagnostics.some((d) => d.status === 'CLOSE_TRADEOFF');
  const isFullyFeasible = impossibilityWarnings.length === 0;

  const summaryMessage = isFullyFeasible
    ? `Semua target masuk zona stok (${recommendedIngredients.length} bahan • ${achievedMetrics.totalBlendNetKg} kg).`
    : hasOutOfBoundsTarget
    ? `Ada target di luar zona stok [Min–Maks]. Lihat bar indikator di tiap karakter di sebelah kiri.`
    : `Komposisi terdekat ditemukan (${recommendedIngredients.length} bahan) dengan kompromi ringan antar karakter.`;

  return {
    isPoolEmpty: false,
    isFullyFeasible,
    hasOutOfBoundsTarget,
    hasCoupledTradeoff,
    candidatePool,
    maxAvailablePoolKg,
    effectiveTotalKg,
    recommendedIngredients,
    achievedMetrics,
    parameterDiagnostics,
    impossibilityWarnings,
    summaryMessage,
  };
}

