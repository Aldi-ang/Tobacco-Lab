import React, { useState, useEffect } from 'react';
import { X, Calculator, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { formatRupiah, formatTaraFormula } from '../utils/tobaccoMath';

export interface CalculationStep {
  stepNumber: number;
  title: string;
  formula: string;
  substitution: string;
  resultLabel: string;
  resultValue: string;
  explanation: string;
  highlight?: 'white' | 'amber' | 'red';
}

export interface CalculationDetailData {
  title: string;
  subtitle: string;
  badgeText?: string;
  coreFormula: string;
  appliedFormula?: string;
  steps: CalculationStep[];
  summaryRows?: {
    label: string;
    value: string;
    highlight?: 'white' | 'amber' | 'red';
  }[];
  conclusion: string;
}

interface CalculationDetailModalProps {
  data: CalculationDetailData | null;
  onClose: () => void;
}

export const CalcSymbolBadge: React.FC<{
  symbol?: string;
  className?: string;
}> = ({ symbol = 'ƒx', className = '' }) => (
  <span
    title="Tekan panel untuk melihat rincian rumus angka ini"
    aria-hidden="true"
    className={`inline-flex items-center justify-center w-5 h-5 rounded-md bg-zinc-900/95 group-hover:bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700 text-zinc-300 font-mono font-black text-[10px] leading-none shrink-0 transition-all group-hover:scale-105 ${className}`}
  >
    {symbol}
  </span>
);

export const CalculationDetailModal: React.FC<CalculationDetailModalProps> = ({
  data,
  onClose,
}) => {
  // All calculation steps are HIDDEN by default until the user presses the button for a specific number
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpandedMap({});
  }, [data]);

  if (!data) return null;

  const toggleStep = (stepNumber: number) => {
    setExpandedMap((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const allExpanded =
    data.steps.length > 0 && data.steps.every((s) => Boolean(expandedMap[s.stepNumber]));

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedMap({});
    } else {
      const next: Record<number, boolean> = {};
      data.steps.forEach((s) => {
        next[s.stepNumber] = true;
      });
      setExpandedMap(next);
    }
  };

  // Format the variable name cleanly so each row reads "Netto Riil = 48 kg", "Netto Bayar = 43 kg", etc.
  const getStepDisplayName = (step: CalculationStep): string => {
    const titleTrim = step.title.trim();
    const labelTrim = step.resultLabel.trim();
    // If title represents a specific Seri or Bahan item (e.g. "Seri AK 1..." or "Bahan #1..."), keep that distinct name
    if (
      titleTrim.startsWith('Seri ') ||
      titleTrim.startsWith('Bahan ') ||
      titleTrim.includes('(')
    ) {
      if (
        titleTrim.toLowerCase().includes(labelTrim.toLowerCase()) ||
        labelTrim.toLowerCase().includes(titleTrim.toLowerCase())
      ) {
        return labelTrim;
      }
      // If title is just explanatory (e.g. "Hitung Selisih Berat (Untung/Rugi Timbangan)"), prefer short resultLabel
      if (
        titleTrim.startsWith('Hitung ') ||
        titleTrim.startsWith('Identifikasi ') ||
        titleTrim.startsWith('Jumlahkan ') ||
        titleTrim.startsWith('Bagi ') ||
        titleTrim.startsWith('Kalikan ') ||
        titleTrim.startsWith('Kurangi ') ||
        titleTrim.startsWith('Tambahkan ') ||
        titleTrim.startsWith('Pembagian ')
      ) {
        return labelTrim;
      }
      return `${titleTrim} (${labelTrim})`;
    }
    return labelTrim || titleTrim;
  };

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col text-white shadow-[0_24px_60px_rgba(0,0,0,0.95)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-black text-amber-400 border border-zinc-700 shrink-0">
              <Calculator className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                {data.title}
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">{data.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup rincian perhitungan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* LINE 1: THE FORMULA + REAL NUMBERS APPLIED FROM STEP 2 */}
          <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-500/60 font-mono font-black text-[10px] uppercase tracking-wider">
                1. Rumus Utama
              </span>
              <span className="text-[10px] text-zinc-400">
                Rumus &amp; penerapan angka langsung
              </span>
            </div>

            <div className="bg-zinc-950 px-3.5 py-2.5 rounded-lg border border-zinc-800 space-y-2">
              <div className="font-mono font-extrabold text-white text-xs sm:text-sm leading-relaxed">
                {data.coreFormula}
              </div>

              <div className="pt-2 border-t border-zinc-800/90 space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Angka Diterapkan (Dari Langkah 2 di Bawah):
                </span>
                <div className="font-mono font-black text-amber-400 text-xs sm:text-sm leading-relaxed">
                  {data.appliedFormula || data.conclusion}
                </div>
              </div>
            </div>
          </div>

          {/* LINE 2: APPLIED NUMBERS WITH COLLAPSIBLE "LIHAT RUMUS" BUTTON FOR EACH NUMBER */}
          <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-white border border-zinc-700 font-mono font-black text-[10px] uppercase tracking-wider">
                  2. Angka pada Rumus
                </span>
                <span className="text-[11px] text-zinc-400">
                  (Tekan tombol untuk lihat rumus &amp; asal angka)
                </span>
              </div>

              {data.steps.length > 1 && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {allExpanded ? (
                    <>
                      <EyeOff className="w-3 h-3 text-zinc-400" />
                      <span>Tutup Semua</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-amber-400" />
                      <span>Buka Semua</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {data.steps.map((step) => {
                const isExpanded = Boolean(expandedMap[step.stepNumber]);
                const varName = getStepDisplayName(step);
                const valueColor =
                  step.highlight === 'amber'
                    ? 'text-amber-400'
                    : step.highlight === 'red'
                    ? 'text-red-400'
                    : 'text-white';

                return (
                  <div
                    key={step.stepNumber}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'bg-zinc-950 border-amber-500/60'
                        : 'bg-zinc-950/90 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Main Number Line: e.g. Netto Riil = 48 kg   [ Lihat Rumus ▾ ] */}
                    <div
                      onClick={() => toggleStep(step.stepNumber)}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap cursor-pointer select-none"
                    >
                      <div className="font-mono text-xs sm:text-sm flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-zinc-300 font-bold">{varName}</span>
                        <span className="text-zinc-500 font-bold">=</span>
                        <span className={`font-black ${valueColor}`}>{step.resultValue}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStep(step.stepNumber);
                        }}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] inline-flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-black text-amber-400 border-amber-500/70'
                            : 'bg-black hover:bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
                        }`}
                      >
                        <span>{isExpanded ? 'Tutup Rumus' : 'Lihat Rumus'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-zinc-400" />
                        )}
                      </button>
                    </div>

                    {/* Hidden Calculation Step & Formula Source — Shown ONLY when pressed */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3 pt-2 border-t border-zinc-800/90 bg-black space-y-2 text-[11px]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800">
                          <span className="text-zinc-400 font-bold uppercase text-[10px] shrink-0">
                            Rumus:
                          </span>
                          <span className="font-mono text-zinc-200 font-semibold sm:text-right">
                            {step.formula}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800">
                          <span className="text-zinc-400 font-bold uppercase text-[10px] shrink-0">
                            Cara Hitung:
                          </span>
                          <span className={`font-mono font-bold sm:text-right ${valueColor}`}>
                            {step.substitution}
                          </span>
                        </div>

                        {step.explanation && (
                          <p className="text-[11px] text-zinc-400 leading-relaxed pl-0.5">
                            {step.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-black flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-amber-outline min-h-9 px-5 py-1.5 rounded-xl font-black text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export type RawTobaccoCalcFocus = 'PAID_VALUE' | 'REAL_VALUE' | 'WEIGHT_PROFIT';

export function buildRawTobaccoCalcDetail(params: {
  name: string;
  packagingType: string;
  grossWeightKg: number;
  realPackagingMassKg: number;
  percentTara: number;
  flatKgTara: number;
  pricePerKg: number;
  additionalCost?: number;
  focus?: RawTobaccoCalcFocus;
}): CalculationDetailData {
  const gross = Number(params.grossWeightKg) || 0;
  const realPkg = Number(params.realPackagingMassKg) || 0;
  const pct = Number(params.percentTara) || 0;
  const flat = Number(params.flatKgTara) || 0;
  const price = Number(params.pricePerKg) || 0;
  const addCost = Number(params.additionalCost) || 0;
  const focus: RawTobaccoCalcFocus = params.focus || 'WEIGHT_PROFIT';

  const pctKg = Number(((gross * pct) / 100).toFixed(2));
  const deductionKg = Number((pctKg + flat).toFixed(2));
  const paidNetKg = Number(Math.max(0, gross - deductionKg).toFixed(2));
  const paidValueRp = Math.round(paidNetKg * price + addCost);

  const realNetKg = Number(Math.max(0, gross - realPkg).toFixed(2));
  const realValueRp = Math.round(realNetKg * price + addCost);

  const weightProfitKg = Number((realNetKg - paidNetKg).toFixed(2));
  const weightProfitRp = realValueRp - paidValueRp;
  const effectiveCostPerRealKg =
    realNetKg > 0 ? Math.round(paidValueRp / realNetKg) : price;

  const formulaLabel = formatTaraFormula(pct, flat);
  const itemName = params.name || 'Bahan Tembakau';

  if (focus === 'PAID_VALUE') {
    return {
      title: `1. Hitungan Nota (Paid Value) — ${itemName}`,
      subtitle: `Kemasan ${params.packagingType} • Bruto ${gross} kg`,
      badgeText: 'PANEL 1 • RUMUS & ANGKA HITUNGAN NOTA',
      coreFormula:
        'Total Kita Bayar = Netto Bayar × Harga Beli   |   Netto Bayar = Berat Bruto − Potongan Nota',
      appliedFormula: `Total Kita Bayar = ${paidNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(paidValueRp)}   |   Netto Bayar = ${gross} kg − ${deductionKg} kg = ${paidNetKg} kg`,
      steps: [
        {
          stepNumber: 1,
          title: 'Berat Bruto',
          formula: 'Berat Bruto = Timbangan Kotor (Tembakau + Kemasan)',
          substitution: `${gross} kg (${params.packagingType})`,
          resultLabel: 'Berat Bruto',
          resultValue: `${gross} kg`,
          explanation: `Berat kotor kemasan ${params.packagingType} beserta isinya saat ditimbang adalah ${gross} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Potongan Nota',
          formula: 'Potongan Nota = (Berat Bruto × % Tarra) + Tarra Flat Nota',
          substitution:
            pct > 0
              ? `(${gross} kg × ${pct}%) + ${flat} kg = ${pctKg} kg + ${flat} kg = ${deductionKg} kg`
              : `Tarra Flat = ${flat} kg`,
          resultLabel: 'Potongan Nota',
          resultValue: `${deductionKg} kg (${formulaLabel})`,
          explanation: `Sesuai rumus potongan nota penjual (${formulaLabel}), total potongan adalah ${deductionKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 3,
          title: 'Netto Bayar',
          formula: 'Netto Bayar = Berat Bruto − Potongan Nota',
          substitution: `${gross} kg − ${deductionKg} kg = ${paidNetKg} kg`,
          resultLabel: 'Netto Bayar',
          resultValue: `${paidNetKg} kg`,
          explanation: `Berat bersih di atas kertas nota yang kita bayar ke penjual adalah ${paidNetKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 4,
          title: 'Harga Beli / KG',
          formula: 'Harga Beli = Harga Kesepakatan Nota per KG',
          substitution: `${formatRupiah(price)}/kg`,
          resultLabel: 'Harga Beli / KG',
          resultValue: `${formatRupiah(price)}/kg`,
          explanation: `Harga beli per kilogram sesuai kesepakatan nota penjual.`,
          highlight: 'white',
        },
        {
          stepNumber: 5,
          title: 'Total Kita Bayar',
          formula: 'Total Kita Bayar = Netto Bayar × Harga Beli / KG',
          substitution: `${paidNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(paidValueRp)}`,
          resultLabel: 'Total Kita Bayar',
          resultValue: formatRupiah(paidValueRp),
          explanation: `Uang kas yang dibayarkan untuk stok ini adalah ${formatRupiah(paidValueRp)}.`,
          highlight: 'amber',
        },
      ],
      conclusion: `Total Kita Bayar = ${paidNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(paidValueRp)}.`,
    };
  }

  if (focus === 'REAL_VALUE') {
    return {
      title: `2. Berat & Nilai Riil (Real Value) — ${itemName}`,
      subtitle: `Kemasan ${params.packagingType} • Bruto ${gross} kg`,
      badgeText: 'PANEL 2 • RUMUS & ANGKA NILAI RIIL',
      coreFormula:
        'Nilai Riil = Netto Riil × Harga Beli   |   Netto Riil = Berat Bruto − Wadah Riil',
      appliedFormula: `Nilai Riil = ${realNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(realValueRp)}   |   Netto Riil = ${gross} kg − ${realPkg} kg = ${realNetKg} kg`,
      steps: [
        {
          stepNumber: 1,
          title: 'Berat Bruto',
          formula: 'Berat Bruto = Timbangan Kotor (Tembakau + Kemasan)',
          substitution: `${gross} kg (${params.packagingType})`,
          resultLabel: 'Berat Bruto',
          resultValue: `${gross} kg`,
          explanation: `Berat kotor kemasan ${params.packagingType} saat ditimbang adalah ${gross} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Wadah Riil',
          formula: 'Wadah Riil = Berat Fisik Kemasan Kosong Asli',
          substitution: `Wadah ${params.packagingType} = ${realPkg} kg`,
          resultLabel: 'Wadah Riil',
          resultValue: `${realPkg} kg`,
          explanation: `Berat fisik wadah/kemasan (${params.packagingType}) tanpa isi tembakau adalah ${realPkg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 3,
          title: 'Netto Riil',
          formula: 'Netto Riil = Berat Bruto − Wadah Riil',
          substitution: `${gross} kg − ${realPkg} kg = ${realNetKg} kg`,
          resultLabel: 'Netto Riil',
          resultValue: `${realNetKg} kg`,
          explanation: `Isi tembakau murni yang benar-benar masuk ke gudang adalah ${realNetKg} kg.`,
          highlight: 'amber',
        },
        {
          stepNumber: 4,
          title: 'Harga Beli / KG',
          formula: 'Harga Beli = Harga Kesepakatan Nota per KG',
          substitution: `${formatRupiah(price)}/kg`,
          resultLabel: 'Harga Beli / KG',
          resultValue: `${formatRupiah(price)}/kg`,
          explanation: `Harga beli per kilogram sesuai nota.`,
          highlight: 'white',
        },
        {
          stepNumber: 5,
          title: 'Nilai Riil',
          formula: 'Nilai Riil = Netto Riil × Harga Beli / KG',
          substitution: `${realNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(realValueRp)}`,
          resultLabel: 'Nilai Riil',
          resultValue: formatRupiah(realValueRp),
          explanation: `Nilai fisik tembakau yang ada di gudang (${realNetKg} kg) adalah ${formatRupiah(realValueRp)}.`,
          highlight: 'amber',
        },
      ],
      conclusion: `Nilai Riil = ${realNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(realValueRp)}.`,
    };
  }

  // focus === 'WEIGHT_PROFIT'
  return {
    title: `3. Weight Profit (Untung Timbangan) — ${itemName}`,
    subtitle: `Netto Riil ${realNetKg} kg vs Netto Bayar ${paidNetKg} kg • Harga ${formatRupiah(price)}/kg`,
    badgeText: 'PANEL 3 • RUMUS & ANGKA WEIGHT PROFIT',
    coreFormula:
      'Weight Profit = (Netto Riil − Netto Bayar) × Harga   |   Modal Riil/KG = Total Bayar ÷ Netto Riil',
    appliedFormula: `Weight Profit = (${realNetKg} kg − ${paidNetKg} kg) × ${formatRupiah(price)} = ${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}   |   Modal Riil/KG = ${formatRupiah(paidValueRp)} ÷ ${realNetKg} kg = ${formatRupiah(effectiveCostPerRealKg)}/kg`,
    steps: [
      {
        stepNumber: 1,
        title: 'Netto Riil',
        formula: 'Netto Riil = Berat Bruto − Berat Wadah Riil',
        substitution: `${gross} kg − ${realPkg} kg (${params.packagingType}) = ${realNetKg} kg`,
        resultLabel: 'Netto Riil',
        resultValue: `${realNetKg} kg`,
        explanation: `Berat fisik tembakau sebenarnya di gudang setelah dikurangi berat kemasan asli (${realPkg} kg).`,
        highlight: 'white',
      },
      {
        stepNumber: 2,
        title: 'Netto Bayar',
        formula: `Netto Bayar = Berat Bruto − Potongan Nota (${formulaLabel})`,
        substitution:
          pct > 0
            ? `${gross} kg − ((${gross} × ${pct}%) + ${flat} kg) = ${gross} kg − ${deductionKg} kg = ${paidNetKg} kg`
            : `${gross} kg − ${deductionKg} kg = ${paidNetKg} kg`,
        resultLabel: 'Netto Bayar',
        resultValue: `${paidNetKg} kg`,
        explanation: `Berat bersih yang ditagihkan di nota setelah potongan tarra penjual (${deductionKg} kg).`,
        highlight: 'white',
      },
      {
        stepNumber: 3,
        title: 'Harga',
        formula: 'Harga = Harga Beli Nota per KG',
        substitution: `${formatRupiah(price)}/kg`,
        resultLabel: 'Harga',
        resultValue: `${formatRupiah(price)}/kg`,
        explanation: `Harga beli per kilogram sesuai nota pembelian.`,
        highlight: 'white',
      },
      {
        stepNumber: 4,
        title: 'Total Bayar',
        formula: 'Total Bayar = Netto Bayar × Harga',
        substitution: `${paidNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(paidValueRp)}`,
        resultLabel: 'Total Bayar',
        resultValue: formatRupiah(paidValueRp),
        explanation: `Total uang kas yang dibayarkan sesuai Netto Bayar (${paidNetKg} kg).`,
        highlight: 'white',
      },
      {
        stepNumber: 5,
        title: 'Selisih Berat',
        formula: 'Selisih Berat = Netto Riil − Netto Bayar  (atau Potongan Nota − Wadah Riil)',
        substitution: `${realNetKg} kg − ${paidNetKg} kg = ${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg  (${deductionKg} kg − ${realPkg} kg)`,
        resultLabel: 'Selisih Berat',
        resultValue: `${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg`,
        explanation:
          weightProfitKg >= 0
            ? `Kita menerima fisik tembakau ${realNetKg} kg tetapi hanya membayar ${paidNetKg} kg.`
            : `Kita membayar ${paidNetKg} kg tetapi fisik tembakau hanya ${realNetKg} kg.`,
        highlight: weightProfitKg >= 0 ? 'amber' : 'red',
      },
      {
        stepNumber: 6,
        title: 'Weight Profit',
        formula: 'Weight Profit = (Netto Riil − Netto Bayar) × Harga',
        substitution: `(${realNetKg} kg − ${paidNetKg} kg) × ${formatRupiah(price)} = ${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg × ${formatRupiah(price)} = ${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}`,
        resultLabel: 'Weight Profit',
        resultValue: `${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}`,
        explanation: `Nilai keuntungan langsung dari selisih timbangan sebelum barang dikirim ke pabrik.`,
        highlight: weightProfitRp >= 0 ? 'amber' : 'red',
      },
      {
        stepNumber: 7,
        title: 'Modal Riil/KG',
        formula: 'Modal Riil/KG = Total Bayar ÷ Netto Riil',
        substitution: `${formatRupiah(paidValueRp)} ÷ ${realNetKg} kg = ${formatRupiah(effectiveCostPerRealKg)}/kg`,
        resultLabel: 'Modal Riil/KG',
        resultValue: `${formatRupiah(effectiveCostPerRealKg)}/kg`,
        explanation: `Modal efektif per 1 kg tembakau fisik di gudang setelah memperhitungkan ekstra berat timbangan.`,
        highlight: 'amber',
      },
    ],
    conclusion: `Weight Profit = (${realNetKg} kg − ${paidNetKg} kg) × ${formatRupiah(price)} = ${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}.`,
  };
}

export type SerialFactoryCalcFocus = 'FACTORY_WEIGHT' | 'FACTORY_PROFIT';

export function buildSerialFactoryCalcDetail(params: {
  serialNumber: string;
  packagingType: string;
  targetFactory: string;
  brutoKg: number;
  realTobaccoNetKg: number;
  realPackagingMassKg: number;
  factoryTaraPercent: number;
  factoryTaraFlatKg: number;
  factorySampleKg?: number;
  factoryDeductionKg: number;
  factoryBillableNetKg: number;
  materialCostRp: number;
  overheadCostRp: number;
  totalProductionCostRp: number;
  hppPerNetKg: number;
  factoryPricePerKg: number;
  focus?: SerialFactoryCalcFocus;
}): CalculationDetailData {
  const {
    serialNumber,
    packagingType,
    targetFactory,
    brutoKg,
    realTobaccoNetKg,
    realPackagingMassKg,
    factoryTaraPercent,
    factoryTaraFlatKg,
    factorySampleKg = 0,
    factoryDeductionKg,
    factoryBillableNetKg,
    materialCostRp,
    overheadCostRp,
    totalProductionCostRp,
    hppPerNetKg,
    factoryPricePerKg,
    focus = 'FACTORY_WEIGHT',
  } = params;

  const wpKg = Number((factoryBillableNetKg - realTobaccoNetKg).toFixed(2));
  const wpRp = Math.round(wpKg * factoryPricePerKg);
  const revenueRp = Math.round(factoryBillableNetKg * factoryPricePerKg);
  const netProfitRp = revenueRp - totalProductionCostRp;
  const bepPerBillableKg =
    factoryBillableNetKg > 0 ? Math.round(totalProductionCostRp / factoryBillableNetKg) : 0;

  if (focus === 'FACTORY_WEIGHT') {
    return {
      title: `1. Timbangan Riil vs Potongan Pabrik — Seri ${serialNumber}`,
      subtitle: `Kemasan ${packagingType} • Pabrik ${targetFactory}`,
      badgeText: 'PANEL 1 • RUMUS TIMBANGAN & POTONGAN PABRIK',
      coreFormula:
        'Netto Tagih = Bruto − Potongan Pabrik   |   Selisih Timbangan = (Netto Tagih − Tembakau Riil) × Harga Pabrik',
      appliedFormula: `Netto Tagih = ${brutoKg} kg − ${factoryDeductionKg} kg = ${factoryBillableNetKg} kg   |   Selisih Timbangan = (${factoryBillableNetKg} kg − ${realTobaccoNetKg} kg) × ${formatRupiah(factoryPricePerKg)} = ${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
      steps: [
        {
          stepNumber: 1,
          title: 'Tembakau Riil',
          formula: 'Tembakau Riil = Berat Isi Tembakau Murni di Dalam Kemasan',
          substitution: `${realTobaccoNetKg} kg`,
          resultLabel: 'Tembakau Riil',
          resultValue: `${realTobaccoNetKg} kg`,
          explanation: `Berat bersih tembakau fisik yang dimasukkan ke dalam kemasan Seri ${serialNumber}.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Wadah Riil',
          formula: `Wadah Riil = Berat Fisik Kemasan Kosong (${packagingType})`,
          substitution: `${realPackagingMassKg} kg`,
          resultLabel: 'Wadah Riil',
          resultValue: `${realPackagingMassKg} kg`,
          explanation: `Berat kemasan kosong ${packagingType} sebelum diisi tembakau.`,
          highlight: 'white',
        },
        {
          stepNumber: 3,
          title: 'Bruto',
          formula: 'Bruto = Tembakau Riil + Wadah Riil',
          substitution: `${realTobaccoNetKg} kg + ${realPackagingMassKg} kg = ${brutoKg} kg`,
          resultLabel: 'Bruto',
          resultValue: `${brutoKg} kg`,
          explanation: `Total berat kotor Seri ${serialNumber} saat ditimbang di pabrik.`,
          highlight: 'white',
        },
        {
          stepNumber: 4,
          title: 'Potongan Pabrik',
          formula: 'Potongan Pabrik = (Bruto × % Tarra) + Tarra Flat + Sampel',
          substitution: `Rumus ${formatTaraFormula(factoryTaraPercent, factoryTaraFlatKg, factorySampleKg)} dari Bruto ${brutoKg} kg = ${factoryDeductionKg} kg`,
          resultLabel: 'Potongan Pabrik',
          resultValue: `${factoryDeductionKg} kg`,
          explanation: `Total potongan tarra yang dikenakan oleh ${targetFactory}.`,
          highlight: 'white',
        },
        {
          stepNumber: 5,
          title: 'Netto Tagih',
          formula: 'Netto Tagih = Bruto − Potongan Pabrik',
          substitution: `${brutoKg} kg − ${factoryDeductionKg} kg = ${factoryBillableNetKg} kg`,
          resultLabel: 'Netto Tagih',
          resultValue: `${factoryBillableNetKg} kg`,
          explanation: `Berat bersih yang diakui dan dibayar oleh pabrik pada nota.`,
          highlight: 'amber',
        },
        {
          stepNumber: 6,
          title: 'Selisih Timbangan',
          formula: 'Selisih Timbangan = (Netto Tagih − Tembakau Riil) × Harga Pabrik',
          substitution: `(${factoryBillableNetKg} kg − ${realTobaccoNetKg} kg) × ${formatRupiah(factoryPricePerKg)} = ${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
          resultLabel: 'Selisih Timbangan',
          resultValue: `${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
          explanation:
            wpKg > 0
              ? `Wadah asli (${realPackagingMassKg} kg) lebih berat daripada potongan pabrik (${factoryDeductionKg} kg), sehingga kita untung timbangan +${wpKg} kg.`
              : wpKg < 0
              ? `Potongan pabrik (${factoryDeductionKg} kg) lebih besar daripada berat wadah asli (${realPackagingMassKg} kg), sehingga susut timbangan ${wpKg} kg.`
              : `Berat wadah asli (${realPackagingMassKg} kg) sama persis dengan potongan pabrik (${factoryDeductionKg} kg).`,
          highlight: wpKg >= 0 ? 'amber' : 'red',
        },
      ],
      conclusion: `Netto Tagih = ${brutoKg} kg − ${factoryDeductionKg} kg = ${factoryBillableNetKg} kg.`,
    };
  }

  return {
    title: `2. Modal, Harga Pabrik & Profit — Seri ${serialNumber}`,
    subtitle: `Netto Tagih ${factoryBillableNetKg} kg • Harga Pabrik ${formatRupiah(factoryPricePerKg)}/kg`,
    badgeText: 'PANEL 2 • RUMUS MODAL, NOTA & PROFIT SERI',
    coreFormula:
      'Profit Bersih = Total Tagihan Nota − Total Modal Produksi   |   Total Tagihan = Netto Tagih × Harga Pabrik',
    appliedFormula: `Profit Bersih = ${formatRupiah(revenueRp)} − ${formatRupiah(totalProductionCostRp)} = ${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}   |   Total Tagihan = ${factoryBillableNetKg} kg × ${formatRupiah(factoryPricePerKg)} = ${formatRupiah(revenueRp)}`,
    steps: [
      {
        stepNumber: 1,
        title: 'Modal Bahan',
        formula: 'Modal Bahan = Tembakau Riil × HPP Campuran Bahan / KG',
        substitution: `${realTobaccoNetKg} kg tembakau = ${formatRupiah(materialCostRp)}`,
        resultLabel: 'Modal Bahan',
        resultValue: formatRupiah(materialCostRp),
        explanation: `Nilai bahan baku tembakau yang masuk ke Seri ${serialNumber}.`,
        highlight: 'white',
      },
      {
        stepNumber: 2,
        title: 'Biaya Kemas & Press',
        formula: 'Biaya Kemas & Press = Harga Kemasan + Ongkos Press per Seri',
        substitution: `Kemasan ${packagingType} + Press = ${formatRupiah(overheadCostRp)}`,
        resultLabel: 'Biaya Kemas & Press',
        resultValue: formatRupiah(overheadCostRp),
        explanation: `Biaya operasional kemasan dan pengepresan untuk Seri ${serialNumber}.`,
        highlight: 'white',
      },
      {
        stepNumber: 3,
        title: 'Total Modal Produksi',
        formula: 'Total Modal Produksi = Modal Bahan + Biaya Kemas & Press',
        substitution: `${formatRupiah(materialCostRp)} + ${formatRupiah(overheadCostRp)} = ${formatRupiah(totalProductionCostRp)}`,
        resultLabel: 'Total Modal Produksi',
        resultValue: formatRupiah(totalProductionCostRp),
        explanation: `Total modal Seri ${serialNumber} (HPP: ${formatRupiah(hppPerNetKg)}/kg • BEP Tagih: ${formatRupiah(bepPerBillableKg)}/kg).`,
        highlight: 'white',
      },
      {
        stepNumber: 4,
        title: 'Netto Tagih',
        formula: 'Netto Tagih = Bruto − Potongan Pabrik',
        substitution: `${brutoKg} kg − ${factoryDeductionKg} kg = ${factoryBillableNetKg} kg`,
        resultLabel: 'Netto Tagih',
        resultValue: `${factoryBillableNetKg} kg`,
        explanation: `Berat bersih yang dibayar oleh pabrik ${targetFactory}.`,
        highlight: 'white',
      },
      {
        stepNumber: 5,
        title: 'Harga Pabrik',
        formula: 'Harga Pabrik = Harga Jual Nota per KG di Pabrik',
        substitution: `${formatRupiah(factoryPricePerKg)}/kg`,
        resultLabel: 'Harga Pabrik',
        resultValue: `${formatRupiah(factoryPricePerKg)}/kg`,
        explanation: `Harga beli per kilogram yang ditetapkan untuk Seri ${serialNumber}.`,
        highlight: 'white',
      },
      {
        stepNumber: 6,
        title: 'Total Tagihan Nota',
        formula: 'Total Tagihan Nota = Netto Tagih × Harga Pabrik',
        substitution: `${factoryBillableNetKg} kg × ${formatRupiah(factoryPricePerKg)} = ${formatRupiah(revenueRp)}`,
        resultLabel: 'Total Tagihan Nota',
        resultValue: formatRupiah(revenueRp),
        explanation: `Jumlah uang nota pabrik untuk Seri ${serialNumber}.`,
        highlight: 'amber',
      },
      {
        stepNumber: 7,
        title: 'Profit Bersih',
        formula: 'Profit Bersih = Total Tagihan Nota − Total Modal Produksi',
        substitution: `${formatRupiah(revenueRp)} − ${formatRupiah(totalProductionCostRp)} = ${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}`,
        resultLabel: 'Profit Bersih',
        resultValue: `${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}`,
        explanation: `Keuntungan bersih dari Seri ${serialNumber}.`,
        highlight: netProfitRp >= 0 ? 'amber' : 'red',
      },
    ],
    conclusion: `Profit Bersih = ${formatRupiah(revenueRp)} − ${formatRupiah(totalProductionCostRp)} = ${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}.`,
  };
}
