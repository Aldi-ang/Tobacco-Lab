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
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
    desc: 'Kuning keemasan berminyak/getah tebal, aroma wangi kuat',
  },
  'A': {
    name: 'Grade A (Kuning Terang)',
    color: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
    desc: 'Warna kuning cerah keemasan, mutu super',
  },
  'B+': {
    name: 'Grade B+ (Cokelat Kuning)',
    color: 'bg-zinc-900 text-amber-300 border-amber-500/30',
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
    color: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    desc: 'Daun tengah/atas matang, body kuat',
  },
  'D': {
    name: 'Grade D (Standar Pabrik)',
    color: 'bg-zinc-900 text-white border-zinc-700',
    desc: 'Grade D standar setoran pabrik',
  },
  'E': {
    name: 'Grade E (Spesial / Super)',
    color: 'bg-black text-amber-400 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
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
 * Menghitung Modal Asal tembakau mentah:
 * Netto = Bruto - Tarra (Tarra eksklusif per seri / penjual)
 * Modal Asal = Price * Netto (secara default NET_WEIGHT, atau GROSS_WEIGHT jika dipilih khusus)
 */
export function calculateRawTobaccoCost(params: {
  grossWeightKg: number;
  pricePerKgPurchase: number;
  taraFormula: TaraFormula;
  additionalCost?: number;
}): {
  deductionKg: number;
  netWeightKg: number;
  totalModalAsal: number;
  totalInvoiceCost: number;
  realCostPerNetKg: number;
  effectiveTaraPercent: number;
} {
  const { grossWeightKg, pricePerKgPurchase, taraFormula, additionalCost = 0 } = params;

  const { deductionKg, netWeightKg, effectivePercent } = calculateTaraDeduction(
    grossWeightKg,
    taraFormula
  );

  // Modal Asal murni = Price * Netto (dimana Netto = Bruto - Tarra)
  const totalModalAsal = Math.round(netWeightKg * pricePerKgPurchase);

  let totalInvoiceCost = 0;
  if (taraFormula.pricingBasis === 'GROSS_WEIGHT') {
    totalInvoiceCost = grossWeightKg * pricePerKgPurchase + additionalCost;
  } else {
    // Default: Modal Asal = Price * Netto (+ ongkos angkut jika ada)
    totalInvoiceCost = netWeightKg * pricePerKgPurchase + additionalCost;
  }

  const realCostPerNetKg = netWeightKg > 0 ? totalInvoiceCost / netWeightKg : 0;

  return {
    deductionKg,
    netWeightKg,
    totalModalAsal,
    totalInvoiceCost: Math.round(totalInvoiceCost),
    realCostPerNetKg: Math.round(realCostPerNetKg * 100) / 100,
    effectiveTaraPercent: effectivePercent,
  };
}

/**
 * Konversi skor rata-rata grade menjadi label TobaccoGrade
 */
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

/**
 * Clamp rating to 0 - 5 scale
 */
export function clampRating5(val: number): number {
  const num = Number(val) || 0;
  // Auto-normalize legacy >5 values if any
  const scaled = num > 5 ? num / 2 : num;
  return Number(Math.max(0, Math.min(5, scaled)).toFixed(1));
}

/**
 * Menghitung kalkulator racikan otomatis (Real-time HPP & 5 Sensory Ratings /5)
 */
export function calculateBlendMetrics(params: {
  ingredients: BlendIngredient[];
  additionalCosts: AdditionalCostItem[];
}): {
  totalBlendNetKg: number;
  totalMaterialCost: number;
  totalOverheadCost: number;
  totalProductionCost: number;
  hppPerNetKg: number;
  weightedPower: number;
  weightedImpact: number;
  weightedBitter: number;
  weightedBurn: number;
  weightedSugar: number;
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
      totalOverheadCost,
      totalProductionCost: totalOverheadCost,
      hppPerNetKg: 0,
      weightedPower: 0,
      weightedImpact: 0,
      weightedBitter: 0,
      weightedBurn: 0,
      weightedSugar: 0,
      compositeColorGrade: 'D',
      updatedIngredients: ingredients,
    };
  }

  let totalMaterialCost = 0;
  let powerSum = 0;
  let impactSum = 0;
  let bitterSum = 0;
  let burnSum = 0;
  let sugarSum = 0;
  let gradeScoreSum = 0;

  const updatedIngredients = ingredients.map((item) => {
    const percentageInBlend = (item.usedNetKg / totalBlendNetKg) * 100;
    const subtotalCost = item.usedNetKg * item.realCostPerNetKg;

    const p = clampRating5(item.powerRating || 0);
    const im = clampRating5(item.impactRating || 0);
    const b = clampRating5(item.bitterRating || 0);
    const bu = clampRating5(item.burnRating ?? 4.0);
    const su = clampRating5(item.sugarRating ?? 3.5);

    totalMaterialCost += subtotalCost;
    powerSum += item.usedNetKg * p;
    impactSum += item.usedNetKg * im;
    bitterSum += item.usedNetKg * b;
    burnSum += item.usedNetKg * bu;
    sugarSum += item.usedNetKg * su;
    gradeScoreSum += item.usedNetKg * (GRADE_SCORES[item.colorGrade] || 2);

    return {
      ...item,
      powerRating: p,
      impactRating: im,
      bitterRating: b,
      burnRating: bu,
      sugarRating: su,
      percentageInBlend: Number(percentageInBlend.toFixed(1)),
      subtotalCost: Math.round(subtotalCost),
    };
  });

  const totalProductionCost = Math.round(totalMaterialCost + totalOverheadCost);
  const hppPerNetKg = Math.round((totalProductionCost / totalBlendNetKg) * 100) / 100;

  const weightedPower = Number((powerSum / totalBlendNetKg).toFixed(1));
  const weightedImpact = Number((impactSum / totalBlendNetKg).toFixed(1));
  const weightedBitter = Number((bitterSum / totalBlendNetKg).toFixed(1));
  const weightedBurn = Number((burnSum / totalBlendNetKg).toFixed(1));
  const weightedSugar = Number((sugarSum / totalBlendNetKg).toFixed(1));
  const averageGradeScore = gradeScoreSum / totalBlendNetKg;
  const compositeColorGrade = scoreToColorGrade(averageGradeScore);

  return {
    totalBlendNetKg: Number(totalBlendNetKg.toFixed(2)),
    totalMaterialCost: Math.round(totalMaterialCost),
    totalOverheadCost: Math.round(totalOverheadCost),
    totalProductionCost,
    hppPerNetKg,
    weightedPower,
    weightedImpact,
    weightedBitter,
    weightedBurn,
    weightedSugar,
    compositeColorGrade,
    updatedIngredients,
  };
}

/**
 * Menghitung spesifikasi packaging & pengiriman tembakau jadi ke pabrik
 * Netto = Bruto - Tarra, Jumlah = Netto * Harga
 */
export function calculateFactoryDelivery(params: {
  packaging: PackagingSpec;
  hppPerNetKg: number;
  totalProductionCost: number;
  factoryTargetPricePerKg: number;
}): {
  grossWeightShipped: number;
  factoryDeductionKg: number;
  factoryNetBillableKg: number;
  totalHPPBatch: number;
  effectiveHppAfterTaraPerKg: number;
  projectedRevenue: number;
  projectedProfit: number;
  profitMarginPercent: number;
} {
  const { packaging, totalProductionCost, factoryTargetPricePerKg } = params;

  const { packageCount = 1, grossWeightPerPackage = 0, factoryTaraFormula } = packaging;
  const grossWeightShipped = packageCount * grossWeightPerPackage;

  const singlePackageTara = calculateTaraDeduction(grossWeightPerPackage, factoryTaraFormula);
  const factoryDeductionKg = Number((singlePackageTara.deductionKg * packageCount).toFixed(2));
  const factoryNetBillableKg = Number(Math.max(0, grossWeightShipped - factoryDeductionKg).toFixed(2));

  const projectedRevenue = Math.round(factoryNetBillableKg * (factoryTargetPricePerKg || 0));
  const totalHPPBatch = Math.round(totalProductionCost);
  const effectiveHppAfterTaraPerKg =
    factoryNetBillableKg > 0 ? Math.round((totalHPPBatch / factoryNetBillableKg) * 100) / 100 : 0;
  const projectedProfit = Math.round(projectedRevenue - totalHPPBatch);
  const profitMarginPercent =
    projectedRevenue > 0 ? Number(((projectedProfit / projectedRevenue) * 100).toFixed(2)) : 0;

  return {
    grossWeightShipped: Number(grossWeightShipped.toFixed(2)),
    factoryDeductionKg,
    factoryNetBillableKg,
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

/**
 * Format angka Rupiah sesuai gaya Google Sheet user: "Rp140,000" atau "Rp7,280,000"
 */
export function formatSheetRp(amount: number): string {
  const rounded = Math.round(amount || 0);
  return `Rp${rounded.toLocaleString('en-US')}`;
}

/**
 * Generate TSV (Tab-Separated Values) atau CSV persis seperti format Google Sheet user:
 * Row 1: TANGGAL \t <Tanggal> \t <Nama Gulungan / Pabrik>
 * Row 2: (Kosong)
 * Row 3: NO \t SERI \t BRUTO \t TARA \t NETTO \t PACKAGING \t GRADE \t HARGA \t JUMLAH
 * Row 4..N: Data
 * Row N+1: \t \t <Sum Bruto> \t <Sum Tara> \t <Sum Netto> \t \t \t \t <Sum Jumlah>
 */
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
    // Row 1: TANGGAL | 3 November 2026 | CELLO MUNTILAN (ARSIP PERSONAL MODAL, HARGA PABRIK & PROFIT)
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
    // Row 2: Blank row
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    // Row 3: Headers with HARGA MODAL, JUMLAH MODAL, HARGA PABRIK, JUMLAH PABRIK, and PROFIT for Personal Archive
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
    // Row 1: TANGGAL | 3 November 2026 | CELLO MUNTILAN
    rows.push(['TANGGAL', dateLabel, headerTitle, '', '', '', '', '', '']);
    // Row 2: Blank row
    rows.push(['', '', '', '', '', '', '', '', '']);
    // Row 3: Strictly 9 columns for Factory Nota (No cost or profit exposed)
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
        s.serialNumber,
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

  // Bottom Totals Row
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

/**
 * Sinkronisasi Data Batch Tembakau Jadi (Nomor Seri) ke format CSV / Google Sheets
 * Menyertakan kolom lengkap untuk Modal Produksi (Production Cost) & Harga Tagih (Billable Price)
 */
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

  // Header Columns explicitly including Production Cost & Billable Price
  rows.push([
    'NO',
    'SERI',
    'TANGGAL',
    'PABRIK TUJUAN',
    'GULUNGAN',
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

    // Production Cost (Modal Produksi per KG & Total Modal Produksi)
    const productionCostPerKg = Math.round(b.effectiveHppAfterTaraPerKg || b.hppPerNetKg || 0);
    const totalProductionCost = Math.round(
      b.totalProductionCost || netto * productionCostPerKg
    );

    // Billable Price (Harga Tagih Pabrik per KG & Total Tagihan Nota)
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
      b.createdAt,
      b.targetFactory,
      b.rollNumber || '-',
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

  // Totals Footer Row
  rows.push([
    'TOTAL',
    `${batches.length} SERI`,
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

