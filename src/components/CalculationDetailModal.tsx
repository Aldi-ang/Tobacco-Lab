import React, { useState, useEffect } from 'react';
import { X, Calculator, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { AgentFeeItem } from '../types/tobacco';
import {
  formatRupiah,
  formatTaraFormula,
  calculateTaraDeduction,
  roundHalfUpKg,
} from '../utils/tobaccoMath';

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
  realPackagingMassKg?: number;
  percentTara: number;
  flatKgTara: number;
  pricePerKg: number;
  agentFees?: AgentFeeItem[];
  additionalCost?: number;
  focus?: RawTobaccoCalcFocus;
}): CalculationDetailData {
  const gross = roundHalfUpKg(params.grossWeightKg);
  const pct = Number(params.percentTara) || 0;
  const flat = roundHalfUpKg(params.flatKgTara);
  const basePrice = Number(params.pricePerKg) || 0;
  const validFees = Array.isArray(params.agentFees)
    ? params.agentFees.filter((f) => Number(f.feePerKg) > 0 || (f.agentName && f.agentName.trim()))
    : [];
  const totalFeePerKg = validFees.reduce(
    (sum, f) => sum + Math.max(0, Number(f.feePerKg) || 0),
    0
  );
  const totalPricePerKg = basePrice + totalFeePerKg;
  const addCost = Number(params.additionalCost) || 0;
  const focus: RawTobaccoCalcFocus = params.focus || 'WEIGHT_PROFIT';

  const feeBreakdownText =
    validFees.length > 0
      ? validFees
          .map(
            (f, i) =>
              `${f.agentName?.trim() || `Orang #${i + 1}`} (${formatRupiah(Number(f.feePerKg) || 0)}/kg)`
          )
          .join(' + ')
      : 'Rp 0/kg';

  const taraCalc = calculateTaraDeduction(gross, { percent: pct, flatKg: flat });
  const rawPctKg = taraCalc.rawPercentPart;
  const pctKg = taraCalc.roundedPercentPart;
  const deductionKg = taraCalc.deductionKg;
  const netKg = taraCalc.netWeightKg;

  const baseTobaccoCostRp = Math.round(netKg * basePrice);
  const totalFeeCostRp = Math.round(netKg * totalFeePerKg);
  const totalModalPaidRp = Math.round(netKg * totalPricePerKg + addCost);

  const formulaLabel = formatTaraFormula(pct, flat);
  const itemName = params.name || 'Bahan Tembakau';
  const pctSubstitutionText =
    rawPctKg !== pctKg
      ? `(${gross} kg × ${pct}% = ${rawPctKg} kg → dibulatkan ${pctKg} kg) + ${flat} kg = ${deductionKg} kg`
      : `(${gross} kg × ${pct}%) + ${flat} kg = ${pctKg} kg + ${flat} kg = ${deductionKg} kg`;

  const netStepSubstitution =
    pct > 0 && flat > 0
      ? `${gross} kg − ${pctKg} kg − ${flat} kg = ${netKg} kg`
      : `${gross} kg − ${deductionKg} kg = ${netKg} kg`;

  if (focus === 'PAID_VALUE') {
    return {
      title: `1. Harga Tembakau Dasar (Netto × Harga) — ${itemName}`,
      subtitle: `Bruto ${gross} kg − Tarra ${deductionKg} kg = Netto ${netKg} kg`,
      badgeText: 'PANEL 1 • HARGA TEMBAKAU DASAR (SEBELUM FEE)',
      coreFormula:
        'Harga Tembakau Dasar = Netto × Harga Tembakau / KG   |   Netto = Berat Bruto − Potongan Tarra',
      appliedFormula: `Harga Tembakau Dasar = ${netKg} kg × ${formatRupiah(basePrice)} = ${formatRupiah(baseTobaccoCostRp)}   |   Netto = ${netStepSubstitution}`,
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
          title: 'Potongan Tarra',
          formula: 'Potongan Tarra = Pembulatan(Berat Bruto × % Tarra) + Tarra Flat',
          substitution: pct > 0 ? pctSubstitutionText : `Tarra Flat = ${flat} kg`,
          resultLabel: 'Potongan Tarra',
          resultValue: `${deductionKg} kg (${formulaLabel})`,
          explanation:
            rawPctKg !== pctKg
              ? `Potongan ${pct}% dari ${gross} kg adalah ${rawPctKg} kg (dibulatkan ke atas menjadi ${pctKg} kg), ditambah flat ${flat} kg menjadi ${deductionKg} kg.`
              : `Total potongan tarra sesuai rumus (${formulaLabel}) adalah ${deductionKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 3,
          title: 'Berat Netto',
          formula: 'Netto = Berat Bruto − Potongan Tarra',
          substitution: netStepSubstitution,
          resultLabel: 'Netto',
          resultValue: `${netKg} kg`,
          explanation: `Berat bersih tembakau setelah dikurangi potongan tarra adalah ${netKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 4,
          title: 'Harga Tembakau Dasar',
          formula: 'Harga Tembakau Dasar = Netto × Harga Tembakau / KG',
          substitution: `${netKg} kg × ${formatRupiah(basePrice)} = ${formatRupiah(baseTobaccoCostRp)}`,
          resultLabel: 'Harga Tembakau Dasar',
          resultValue: formatRupiah(baseTobaccoCostRp),
          explanation: `Biaya murni pembelian tembakau sebelum ditambah biaya fee perantara.`,
          highlight: 'amber',
        },
      ],
      conclusion: `Harga Tembakau Dasar = ${netKg} kg × ${formatRupiah(basePrice)} = ${formatRupiah(baseTobaccoCostRp)}.`,
    };
  }

  if (focus === 'REAL_VALUE') {
    const perAgentSteps = validFees.map((f, idx) => {
      const fKg = Math.max(0, Number(f.feePerKg) || 0);
      const fTotal = Math.round(netKg * fKg);
      const agentLabel = f.agentName?.trim() || `Agen #${idx + 1}`;
      return {
        stepNumber: idx + 3,
        title: `Biaya Fee — ${agentLabel}`,
        formula: 'Biaya Fee Agen = Netto × Fee / KG',
        substitution: `${netKg} kg × ${formatRupiah(fKg)} = ${formatRupiah(fTotal)}`,
        resultLabel: `Fee ${agentLabel}`,
        resultValue: formatRupiah(fTotal),
        explanation: `Biaya tambahan (added cost) untuk ${agentLabel} dihitung dari Netto (${netKg} kg) dikali ${formatRupiah(fKg)}/kg.`,
        highlight: 'white' as const,
      };
    });

    return {
      title: `2. Biaya Tambahan Fee (Netto × Fee) — ${itemName}`,
      subtitle: `Netto ${netKg} kg × Fee ${formatRupiah(totalFeePerKg)}/kg (Biaya Tambahan / Added Cost)`,
      badgeText: 'PANEL 2 • RINCIAN BIAYA TAMBAHAN FEE PERANTARA',
      coreFormula:
        'Total Biaya Fee = Netto × Total Fee / KG   |   Netto = Berat Bruto − Potongan Tarra',
      appliedFormula: `Total Biaya Fee = ${netKg} kg × ${formatRupiah(totalFeePerKg)} = ${formatRupiah(totalFeeCostRp)}   |   Netto = ${netStepSubstitution}`,
      steps: [
        {
          stepNumber: 1,
          title: 'Berat Netto (Bruto − Tarra)',
          formula: 'Netto = Berat Bruto − Potongan Tarra',
          substitution: netStepSubstitution,
          resultLabel: 'Netto',
          resultValue: `${netKg} kg`,
          explanation: `Bruto ${gross} kg dikurangi potongan tarra ${deductionKg} kg (${formulaLabel}) = ${netKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Total Fee Perantara / KG',
          formula: 'Total Fee / KG = Σ Fee Agen per KG',
          substitution: `${feeBreakdownText} = ${formatRupiah(totalFeePerKg)}/kg`,
          resultLabel: 'Fee / KG',
          resultValue: `${formatRupiah(totalFeePerKg)}/kg`,
          explanation: `Gabungan tarif fee per kilogram untuk barang ini.`,
          highlight: 'white',
        },
        ...perAgentSteps,
        {
          stepNumber: perAgentSteps.length + 3,
          title: 'Total Biaya Tambahan Fee',
          formula: 'Total Biaya Fee = Netto × Total Fee / KG',
          substitution: `${netKg} kg × ${formatRupiah(totalFeePerKg)} = ${formatRupiah(totalFeeCostRp)}`,
          resultLabel: 'Total Biaya Fee',
          resultValue: formatRupiah(totalFeeCostRp),
          explanation: `Fee ini adalah biaya tambahan pembelian (added cost) sebesar ${formatRupiah(totalFeeCostRp)} yang menambah modal kita.`,
          highlight: 'amber',
        },
      ],
      conclusion: `Total Biaya Tambahan Fee = ${netKg} kg × ${formatRupiah(totalFeePerKg)} = ${formatRupiah(totalFeeCostRp)}.`,
    };
  }

  // focus === 'WEIGHT_PROFIT' -> 3. Total Modal Bayar (Harga Tembakau + Biaya Fee)
  return {
    title: `3. Total Modal Bayar (Netto × Harga Total) — ${itemName}`,
    subtitle: `Netto ${netKg} kg × (${formatRupiah(basePrice)} + Fee ${formatRupiah(totalFeePerKg)}) = ${formatRupiah(totalPricePerKg)}/kg`,
    badgeText: 'PANEL 3 • TOTAL MODAL PEMBELIAN (HARGA + FEE)',
    coreFormula:
      'Total Modal Bayar = Netto × (Harga Tembakau + Fee/KG)   |   Netto = Berat Bruto − Potongan Tarra',
    appliedFormula: `Total Modal Bayar = ${netKg} kg × ${formatRupiah(totalPricePerKg)} = ${formatRupiah(totalModalPaidRp)}   (${formatRupiah(baseTobaccoCostRp)} + Fee ${formatRupiah(totalFeeCostRp)})`,
    steps: [
      {
        stepNumber: 1,
        title: 'Berat Netto (Bruto − Tarra)',
        formula: `Netto = Berat Bruto − Potongan Tarra (${formulaLabel})`,
        substitution: netStepSubstitution,
        resultLabel: 'Netto',
        resultValue: `${netKg} kg`,
        explanation: `Berat bersih tembakau yang dibayar setelah dikurangi potongan tarra (${deductionKg} kg).`,
        highlight: 'white',
      },
      {
        stepNumber: 2,
        title: 'Harga Total / KG (Harga + Fee)',
        formula: 'Harga Total / KG = Harga Tembakau Dasar + Fee Perantara / KG',
        substitution: `${formatRupiah(basePrice)}/kg + ${formatRupiah(totalFeePerKg)}/kg = ${formatRupiah(totalPricePerKg)}/kg`,
        resultLabel: 'Harga + Fee / KG',
        resultValue: `${formatRupiah(totalPricePerKg)}/kg`,
        explanation: `Fee perantara (${formatRupiah(totalFeePerKg)}/kg) menambah harga modal per kg tembakau menjadi ${formatRupiah(totalPricePerKg)}/kg.`,
        highlight: 'white',
      },
      {
        stepNumber: 3,
        title: 'Harga Tembakau Dasar',
        formula: 'Harga Tembakau Dasar = Netto × Harga Tembakau / KG',
        substitution: `${netKg} kg × ${formatRupiah(basePrice)} = ${formatRupiah(baseTobaccoCostRp)}`,
        resultLabel: 'Harga Tembakau',
        resultValue: formatRupiah(baseTobaccoCostRp),
        explanation: `Biaya pokok tembakau untuk ${netKg} kg.`,
        highlight: 'white',
      },
      {
        stepNumber: 4,
        title: 'Biaya Tambahan Fee (Added Cost)',
        formula: 'Biaya Tambahan Fee = Netto × Fee / KG',
        substitution: `${netKg} kg × ${formatRupiah(totalFeePerKg)} = ${formatRupiah(totalFeeCostRp)}`,
        resultLabel: 'Biaya Fee',
        resultValue: formatRupiah(totalFeeCostRp),
        explanation: `Biaya tambahan yang dibayarkan kepada pencari barang/perantara.`,
        highlight: 'white',
      },
      {
        stepNumber: 5,
        title: 'Total Modal Bayar',
        formula: 'Total Modal Bayar = Netto × (Harga Tembakau + Fee/KG)',
        substitution: `${netKg} kg × ${formatRupiah(totalPricePerKg)} = ${formatRupiah(totalModalPaidRp)} (${formatRupiah(baseTobaccoCostRp)} + ${formatRupiah(totalFeeCostRp)})`,
        resultLabel: 'Total Modal Bayar',
        resultValue: formatRupiah(totalModalPaidRp),
        explanation: `Total modal keseluruhan yang kita keluarkan untuk barang ini.`,
        highlight: 'amber',
      },
    ],
    conclusion: `Total Modal Bayar = ${netKg} kg × ${formatRupiah(totalPricePerKg)} = ${formatRupiah(totalModalPaidRp)}.`,
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
          title: 'Potongan Pabrik (Dibulatkan ≥ 0.5 ke Atas)',
          formula: 'Potongan Pabrik = Pembulatan(Bruto × % Tarra) + Tarra Flat + Sampel',
          substitution: (() => {
            const facTara = calculateTaraDeduction(brutoKg, {
              percent: factoryTaraPercent,
              flatKg: factoryTaraFlatKg,
              sampleKg: factorySampleKg,
            });
            if (factoryTaraPercent > 0 && facTara.rawPercentPart !== facTara.roundedPercentPart) {
              return `(${brutoKg} kg × ${factoryTaraPercent}% = ${facTara.rawPercentPart} kg → dibulatkan ${facTara.roundedPercentPart} kg) + ${factoryTaraFlatKg} kg${factorySampleKg > 0 ? ` + ${factorySampleKg} kg` : ''} = ${factoryDeductionKg} kg`;
            }
            return `Rumus ${formatTaraFormula(factoryTaraPercent, factoryTaraFlatKg, factorySampleKg)} dari Bruto ${brutoKg} kg = ${factoryDeductionKg} kg`;
          })(),
          resultLabel: 'Potongan Pabrik',
          resultValue: `${factoryDeductionKg} kg`,
          explanation: `Total potongan tarra yang dikenakan oleh ${targetFactory} (desimal ≥ 0.5 dibulatkan ke atas).`,
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
