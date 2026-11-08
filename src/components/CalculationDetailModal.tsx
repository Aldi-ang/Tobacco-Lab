import React from 'react';
import { X, Calculator, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
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

/**
 * Compact symbol mark indicating a calculation panel can be pressed to inspect its exact formula
 */
export const CalcSymbolBadge: React.FC<{
  symbol?: string;
  className?: string;
}> = ({ symbol = 'ƒx', className = '' }) => (
  <span
    title="Tekan panel untuk melihat rincian rumus angka ini"
    aria-hidden="true"
    className={`inline-flex items-center justify-center w-5 h-5 rounded-md bg-zinc-900/95 group-hover:bg-amber-500/20 border border-amber-500/50 group-hover:border-amber-400 text-amber-400 font-mono font-black text-[10px] leading-none shrink-0 transition-all shadow-[0_0_8px_rgba(245,158,11,0.14)] group-hover:scale-105 ${className}`}
  >
    {symbol}
  </span>
);

export const CalculationDetailModal: React.FC<CalculationDetailModalProps> = ({
  data,
  onClose,
}) => {
  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border-2 border-amber-500 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-[0_0_40px_rgba(245,158,11,0.25)] text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-black text-amber-400 border border-amber-500 shrink-0">
              <Calculator className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-black text-amber-400 border border-amber-500/70 font-mono font-black text-[10px] uppercase tracking-wider">
                  {data.badgeText || 'ASAL ANGKA & RUMUS SPESIFIK'}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
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
          {/* Core Formula Box */}
          <div className="bg-black border border-amber-500/60 rounded-xl p-3.5 space-y-1.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Rumus Spesifik Panel Ini</span>
            </div>
            <div className="font-mono font-bold text-white text-xs sm:text-sm bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800">
              {data.coreFormula}
            </div>
          </div>

          {/* Step-by-Step Breakdown */}
          <div className="space-y-3">
            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
              Asal Angka Langkah Demi Langkah ({data.steps.length} Langkah):
            </div>

            {data.steps.map((step) => {
              const borderClass =
                step.highlight === 'amber'
                  ? 'border-amber-500/70 bg-black'
                  : step.highlight === 'red'
                  ? 'border-red-500/70 bg-black'
                  : 'border-zinc-800 bg-black/95';
              const valueColor =
                step.highlight === 'amber'
                  ? 'text-amber-400 border-amber-500/60'
                  : step.highlight === 'red'
                  ? 'text-red-400 border-red-500/60'
                  : 'text-white border-zinc-700';

              return (
                <div
                  key={step.stepNumber}
                  className={`rounded-xl border p-3.5 space-y-2 ${borderClass}`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-zinc-950 text-amber-400 border border-amber-500 font-mono font-black text-[10px] shrink-0">
                        LANGKAH {step.stepNumber}
                      </span>
                      <h3 className="font-extrabold text-white text-xs sm:text-sm">
                        {step.title}
                      </h3>
                    </div>

                    <div
                      className={`px-2.5 py-1 rounded-lg bg-zinc-950 border font-mono font-black text-xs shrink-0 ${valueColor}`}
                    >
                      <span className="text-[10px] text-zinc-400 font-normal mr-1.5">
                        {step.resultLabel}:
                      </span>
                      <span>{step.resultValue}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800/90">
                      <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-0.5">
                        Rumus:
                      </span>
                      <span className="font-mono text-zinc-200 text-[11px] block">
                        {step.formula}
                      </span>
                    </div>

                    <div className="bg-zinc-950 px-3 py-2 rounded-lg border border-amber-500/30">
                      <span className="text-[10px] text-amber-400 uppercase font-bold block mb-0.5">
                        Angka Dimasukkan:
                      </span>
                      <span className="font-mono font-bold text-white text-[11px] block">
                        {step.substitution}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 flex items-start gap-1.5 pt-0.5">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{step.explanation}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Summary Comparison Table if provided */}
          {data.summaryRows && data.summaryRows.length > 0 && (
            <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Ringkasan Angka pada Panel Ini
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {data.summaryRows.map((row, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border bg-zinc-950 flex flex-col justify-between ${
                      row.highlight === 'amber'
                        ? 'border-amber-500'
                        : row.highlight === 'red'
                        ? 'border-red-500/70'
                        : 'border-zinc-800'
                    }`}
                  >
                    <span className="text-[10px] text-zinc-400 uppercase font-bold">
                      {row.label}
                    </span>
                    <span
                      className={`font-mono font-black text-sm mt-1 ${
                        row.highlight === 'amber'
                          ? 'text-amber-400'
                          : row.highlight === 'red'
                          ? 'text-red-400'
                          : 'text-white'
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Conclusion */}
          <div className="bg-zinc-950 border-2 border-amber-500/70 rounded-xl p-3.5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                Kesimpulan Asal Angka
              </span>
              <p className="text-xs text-white leading-relaxed">{data.conclusion}</p>
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
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export type RawTobaccoCalcFocus = 'PAID_VALUE' | 'REAL_VALUE' | 'WEIGHT_PROFIT';

/**
 * Helper 1: Panel-Specific Step-by-Step Calculation Detail for Raw Tobacco Purchase
 * Each panel ('PAID_VALUE', 'REAL_VALUE', 'WEIGHT_PROFIT') returns ONLY the specific steps
 * for the numbers displayed on that pressed panel.
 */
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
      subtitle: `Kemasan ${params.packagingType} • Bruto ${gross} kg • Harga Beli ${formatRupiah(price)}/kg`,
      badgeText: 'PANEL 1 • ASAL ANGKA HITUNGAN NOTA (PAID VALUE)',
      coreFormula:
        'Total Kita Bayar = (Berat Bruto − Potongan Tarra Nota) × Harga Beli / KG',
      steps: [
        {
          stepNumber: 1,
          title: 'Hitung Potongan Tarra Nota Penjual',
          formula: 'Potongan Nota = (Bruto × % Tarra) + Tarra Flat Nota',
          substitution:
            pct > 0
              ? `(${gross} kg × ${pct}%) + ${flat} kg = ${pctKg} kg + ${flat} kg = ${deductionKg} kg`
              : `Tarra Flat = ${flat} kg`,
          resultLabel: 'Potongan Nota',
          resultValue: `-${deductionKg} kg (${formulaLabel})`,
          explanation: `Sesuai rumus potongan nota (${formulaLabel}), dari Bruto ${gross} kg dipotong sebesar ${deductionKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Hitung Berat Netto Bayar (Netto Nota)',
          formula: 'Netto Bayar = Berat Bruto − Potongan Nota',
          substitution: `${gross} kg − ${deductionKg} kg = ${paidNetKg} kg`,
          resultLabel: 'Netto Bayar',
          resultValue: `${paidNetKg} kg`,
          explanation: `Berat bersih di atas kertas nota yang ditagihkan oleh penjual adalah ${paidNetKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 3,
          title: 'Hitung Total Uang yang Kita Bayar (Paid Value)',
          formula: 'Total Kita Bayar = Netto Bayar × Harga Beli / KG',
          substitution: `${paidNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(paidValueRp)}`,
          resultLabel: 'Total Kita Bayar',
          resultValue: formatRupiah(paidValueRp),
          explanation: `Uang kas yang dibayarkan ke penjual adalah ${paidNetKg} kg dikali ${formatRupiah(price)}/kg = ${formatRupiah(paidValueRp)}.`,
          highlight: 'amber',
        },
      ],
      summaryRows: [
        {
          label: 'Potongan Nota',
          value: `-${deductionKg} kg (${formulaLabel})`,
          highlight: 'white',
        },
        {
          label: 'Netto Bayar',
          value: `${paidNetKg} kg`,
          highlight: 'white',
        },
        {
          label: 'Total Kita Bayar',
          value: formatRupiah(paidValueRp),
          highlight: 'amber',
        },
      ],
      conclusion: `Angka ${formatRupiah(paidValueRp)} berasal dari Bruto ${gross} kg dikurangi potongan nota ${deductionKg} kg (${formulaLabel}) = ${paidNetKg} kg Netto Bayar, lalu dikalikan harga beli ${formatRupiah(price)}/kg.`,
    };
  }

  if (focus === 'REAL_VALUE') {
    return {
      title: `2. Berat & Nilai Riil (Real Value) — ${itemName}`,
      subtitle: `Kemasan ${params.packagingType} • Bruto ${gross} kg • Wadah Riil ${realPkg} kg`,
      badgeText: 'PANEL 2 • ASAL ANGKA BERAT & NILAI RIIL SEBENARNYA',
      coreFormula:
        'Nilai Riil Barang = (Berat Bruto − Berat Wadah Riil) × Harga Beli / KG',
      steps: [
        {
          stepNumber: 1,
          title: 'Identifikasi Potongan Wadah Fisik Sebenarnya',
          formula: 'Potongan Wadah Riil = Berat Kemasan Kosong Asli',
          substitution: `Wadah ${params.packagingType} = ${realPkg} kg`,
          resultLabel: 'Potongan Wadah Riil',
          resultValue: `-${realPkg} kg`,
          explanation: `Berat fisik wadah/kemasan (${params.packagingType}) tanpa isi tembakau adalah ${realPkg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Hitung Netto Riil Sebenarnya (Fisik Tembakau di Gudang)',
          formula: 'Netto Riil Sebenarnya = Berat Bruto − Berat Wadah Riil',
          substitution: `${gross} kg − ${realPkg} kg = ${realNetKg} kg`,
          resultLabel: 'Netto Riil Sebenarnya',
          resultValue: `${realNetKg} kg`,
          explanation: `Isi tembakau murni yang benar-benar masuk ke gudang dari kemasan ini adalah ${realNetKg} kg.`,
          highlight: 'amber',
        },
        {
          stepNumber: 3,
          title: `Hitung Nilai Riil Barang (${realNetKg} × Harga)`,
          formula: 'Nilai Riil = Netto Riil Sebenarnya × Harga Beli / KG',
          substitution: `${realNetKg} kg × ${formatRupiah(price)} = ${formatRupiah(realValueRp)}`,
          resultLabel: `Nilai Riil (${realNetKg}×Harga)`,
          resultValue: formatRupiah(realValueRp),
          explanation: `Jika dihitung sesuai berat fisik tembakau yang ada (${realNetKg} kg), nilai pasar barang ini adalah ${formatRupiah(realValueRp)}.`,
          highlight: 'amber',
        },
      ],
      summaryRows: [
        {
          label: 'Potongan Wadah Riil',
          value: `-${realPkg} kg`,
          highlight: 'white',
        },
        {
          label: 'Netto Riil Sebenarnya',
          value: `${realNetKg} kg`,
          highlight: 'amber',
        },
        {
          label: `Nilai Riil (${realNetKg}×Harga)`,
          value: formatRupiah(realValueRp),
          highlight: 'amber',
        },
      ],
      conclusion: `Angka ${realNetKg} kg dan ${formatRupiah(realValueRp)} berasal dari Bruto ${gross} kg dikurangi berat wadah asli ${realPkg} kg = ${realNetKg} kg fisik tembakau, lalu dikalikan harga beli ${formatRupiah(price)}/kg.`,
    };
  }

  // Default: 'WEIGHT_PROFIT' (Panel 3)
  return {
    title: `3. Weight Profit (Untung Timbangan) — ${itemName}`,
    subtitle: `Netto Riil ${realNetKg} kg vs Netto Bayar ${paidNetKg} kg • Harga ${formatRupiah(price)}/kg`,
    badgeText: 'PANEL 3 • ASAL ANGKA WEIGHT PROFIT & MODAL RIIL / KG',
    coreFormula:
      'Weight Profit = (Netto Riil − Netto Bayar) × Harga   |   Modal Riil/KG = Total Bayar ÷ Netto Riil',
    steps: [
      {
        stepNumber: 1,
        title: 'Hitung Selisih Berat (Untung/Rugi Timbangan)',
        formula: 'Selisih Berat = Netto Riil Sebenarnya − Netto Bayar Nota  (atau Potongan Nota − Wadah Riil)',
        substitution: `${realNetKg} kg − ${paidNetKg} kg = ${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg  (Potongan Nota ${deductionKg} kg − Wadah Riil ${realPkg} kg)`,
        resultLabel: 'Selisih Berat',
        resultValue: `${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg`,
        explanation:
          weightProfitKg >= 0
            ? `Kita menerima fisik tembakau ${realNetKg} kg tetapi hanya membayar ${paidNetKg} kg, sehingga ada ekstra +${weightProfitKg} kg tembakau.`
            : `Kita membayar ${paidNetKg} kg tetapi fisik tembakau hanya ${realNetKg} kg, sehingga selisih ${weightProfitKg} kg.`,
        highlight: weightProfitKg >= 0 ? 'amber' : 'red',
      },
      {
        stepNumber: 2,
        title: 'Hitung Weight Profit dalam Rupiah',
        formula: 'Weight Profit (Rp) = Selisih Berat × Harga Beli / KG  (atau Nilai Riil − Total Bayar)',
        substitution: `${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg × ${formatRupiah(price)} = ${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}  (${formatRupiah(realValueRp)} − ${formatRupiah(paidValueRp)})`,
        resultLabel: 'Weight Profit (Rp)',
        resultValue: `${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}`,
        explanation: `Nilai keuntungan langsung dari selisih timbangan sebelum barang dikirim ke pabrik adalah ${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}.`,
        highlight: weightProfitRp >= 0 ? 'amber' : 'red',
      },
      {
        stepNumber: 3,
        title: 'Hitung Modal Riil / KG Fisik',
        formula: 'Modal Riil / KG Fisik = Total Kita Bayar ÷ Netto Riil Sebenarnya',
        substitution: `${formatRupiah(paidValueRp)} ÷ ${realNetKg} kg = ${formatRupiah(effectiveCostPerRealKg)}/kg`,
        resultLabel: 'Modal Riil / KG Fisik',
        resultValue: `${formatRupiah(effectiveCostPerRealKg)}/kg`,
        explanation: `Karena uang yang keluar ${formatRupiah(paidValueRp)} dibagi ${realNetKg} kg tembakau fisik di gudang, maka modal riil per kg turun dari ${formatRupiah(price)}/kg menjadi ${formatRupiah(effectiveCostPerRealKg)}/kg.`,
        highlight: 'amber',
      },
    ],
    summaryRows: [
      {
        label: 'Selisih Berat',
        value: `${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg`,
        highlight: weightProfitKg >= 0 ? 'amber' : 'red',
      },
      {
        label: 'Weight Profit (Rp)',
        value: `${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}`,
        highlight: weightProfitRp >= 0 ? 'amber' : 'red',
      },
      {
        label: 'Modal Riil / KG Fisik',
        value: `${formatRupiah(effectiveCostPerRealKg)}/kg`,
        highlight: 'amber',
      },
    ],
    conclusion: `Selisih ${weightProfitKg >= 0 ? '+' : ''}${weightProfitKg} kg berasal dari Netto Riil ${realNetKg} kg dikurangi Netto Bayar ${paidNetKg} kg. Dikalikan ${formatRupiah(price)}/kg menghasilkan Weight Profit ${weightProfitRp >= 0 ? '+' : ''}${formatRupiah(weightProfitRp)}, dan menurunkan modal fisik menjadi ${formatRupiah(effectiveCostPerRealKg)}/kg.`,
  };
}

export type SerialFactoryCalcFocus = 'FACTORY_WEIGHT' | 'FACTORY_PROFIT';

/**
 * Helper 2: Panel-Specific Step-by-Step Calculation Detail for Finished Serial / Factory Delivery
 */
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
      subtitle: `Kemasan ${packagingType} • Pabrik ${targetFactory} • Bruto ${brutoKg} kg`,
      badgeText: 'PANEL 1 • ASAL ANGKA TIMBANGAN & POTONGAN PABRIK',
      coreFormula:
        'Netto Tagih = Bruto − Potongan Pabrik   |   Selisih Timbangan = Netto Tagih − Tembakau Riil',
      steps: [
        {
          stepNumber: 1,
          title: 'Hitung Berat Bruto Kemasan (Tembakau Riil + Wadah Asli)',
          formula: 'Bruto = Tembakau Riil + Berat Wadah Asli',
          substitution: `${realTobaccoNetKg} kg + ${realPackagingMassKg} kg (${packagingType}) = ${brutoKg} kg`,
          resultLabel: 'Bruto',
          resultValue: `${brutoKg} kg`,
          explanation: `Kemasan ${packagingType} seberat ${realPackagingMassKg} kg diisi ${realTobaccoNetKg} kg tembakau fisik sehingga total Bruto ${brutoKg} kg.`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Hitung Potongan Pabrik & Netto Tagih Pabrik',
          formula: 'Potongan Pabrik = (Bruto × % Tarra) + Tarra Flat  →  Netto Tagih = Bruto − Potongan',
          substitution: `Potongan ${formatTaraFormula(factoryTaraPercent, factoryTaraFlatKg, factorySampleKg)} = -${factoryDeductionKg} kg  →  ${brutoKg} kg − ${factoryDeductionKg} kg = ${factoryBillableNetKg} kg`,
          resultLabel: 'Netto Tagih Pabrik',
          resultValue: `${factoryBillableNetKg} kg`,
          explanation: `Pabrik memotong tarra ${factoryDeductionKg} kg dari Bruto ${brutoKg} kg, menghasilkan Netto Tagih ${factoryBillableNetKg} kg.`,
          highlight: 'amber',
        },
        {
          stepNumber: 3,
          title: 'Hitung Selisih Timbangan Pabrik (Weight Profit / Loss Setor)',
          formula: 'Selisih Timbangan = Netto Tagih Pabrik − Tembakau Riil  (× Harga Pabrik)',
          substitution: `${factoryBillableNetKg} kg − ${realTobaccoNetKg} kg = ${wpKg >= 0 ? '+' : ''}${wpKg} kg  →  ${wpKg >= 0 ? '+' : ''}${wpKg} kg × ${formatRupiah(factoryPricePerKg)} = ${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)}`,
          resultLabel: 'Selisih Timbangan',
          resultValue: `${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
          explanation:
            wpKg > 0
              ? `Wadah asli (${realPackagingMassKg} kg) lebih berat daripada potongan pabrik (${factoryDeductionKg} kg), sehingga ada +${wpKg} kg berat kemasan yang ikut terbayar sebagai tembakau.`
              : wpKg < 0
              ? `Potongan pabrik (${factoryDeductionKg} kg) lebih besar daripada berat wadah asli (${realPackagingMassKg} kg), sehingga kita rugi timbangan ${wpKg} kg.`
              : `Berat wadah asli (${realPackagingMassKg} kg) sama persis dengan potongan pabrik (${factoryDeductionKg} kg).`,
          highlight: wpKg >= 0 ? 'amber' : 'red',
        },
      ],
      summaryRows: [
        {
          label: 'Bruto (Tembakau + Wadah)',
          value: `${brutoKg} kg (${realTobaccoNetKg} + ${realPackagingMassKg} kg)`,
          highlight: 'white',
        },
        {
          label: 'Netto Tagih Pabrik',
          value: `${factoryBillableNetKg} kg (Potongan -${factoryDeductionKg} kg)`,
          highlight: 'amber',
        },
        {
          label: 'Selisih Timbangan',
          value: `${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
          highlight: wpKg >= 0 ? 'amber' : 'red',
        },
      ],
      conclusion: `Netto Tagih ${factoryBillableNetKg} kg berasal dari Bruto ${brutoKg} kg dikurangi potongan pabrik ${factoryDeductionKg} kg. Dibandingkan isi tembakau fisik ${realTobaccoNetKg} kg, terdapat selisih timbangan ${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)}).`,
    };
  }

  // focus === 'FACTORY_PROFIT' (Panel 2)
  return {
    title: `2. Modal, Harga Pabrik & Profit — Seri ${serialNumber}`,
    subtitle: `Netto Tagih ${factoryBillableNetKg} kg • Harga Pabrik ${formatRupiah(factoryPricePerKg)}/kg`,
    badgeText: 'PANEL 2 • ASAL ANGKA MODAL, NOTA PABRIK & PROFIT SERI',
    coreFormula:
      'Profit Bersih = (Netto Tagih Pabrik × Harga Pabrik) − Total Modal Produksi',
    steps: [
      {
        stepNumber: 1,
        title: 'Hitung Total Modal Produksi Seri Ini',
        formula: 'Total Modal = Modal Bahan Racikan + Biaya Kemasan & Press',
        substitution: `${formatRupiah(materialCostRp)} + ${formatRupiah(overheadCostRp)} = ${formatRupiah(totalProductionCostRp)} (HPP: ${formatRupiah(hppPerNetKg)}/kg)`,
        resultLabel: 'Total Modal Produksi',
        resultValue: formatRupiah(totalProductionCostRp),
        explanation: `Modal bahan untuk ${realTobaccoNetKg} kg ditambah biaya kemasan & press menghasilkan Total Modal ${formatRupiah(totalProductionCostRp)} (BEP: ${formatRupiah(bepPerBillableKg)}/kg tagih).`,
        highlight: 'white',
      },
      {
        stepNumber: 2,
        title: 'Hitung Total Tagihan Nota Pabrik',
        formula: 'Total Tagihan Nota = Netto Tagih Pabrik × Harga Pabrik / KG',
        substitution: `${factoryBillableNetKg} kg × ${formatRupiah(factoryPricePerKg)} = ${formatRupiah(revenueRp)}`,
        resultLabel: 'Total Tagihan Nota',
        resultValue: formatRupiah(revenueRp),
        explanation: `Pabrik membayar berdasarkan Netto Tagih (${factoryBillableNetKg} kg) dikalikan harga ${formatRupiah(factoryPricePerKg)}/kg = ${formatRupiah(revenueRp)}.`,
        highlight: 'amber',
      },
      {
        stepNumber: 3,
        title: 'Hitung Profit Bersih Seri',
        formula: 'Profit Bersih = Total Tagihan Nota − Total Modal Produksi',
        substitution: `${formatRupiah(revenueRp)} − ${formatRupiah(totalProductionCostRp)} = ${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}`,
        resultLabel: 'Profit Bersih Seri',
        resultValue: `${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}`,
        explanation: `Selisih antara uang nota pabrik (${formatRupiah(revenueRp)}) dengan modal produksi (${formatRupiah(totalProductionCostRp)}) adalah ${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}.`,
        highlight: netProfitRp >= 0 ? 'amber' : 'red',
      },
    ],
    summaryRows: [
      {
        label: 'Total Modal Produksi',
        value: formatRupiah(totalProductionCostRp),
        highlight: 'white',
      },
      {
        label: 'Total Tagihan Nota',
        value: formatRupiah(revenueRp),
        highlight: 'amber',
      },
      {
        label: 'Profit Bersih Seri',
        value: `${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)}`,
        highlight: netProfitRp >= 0 ? 'amber' : 'red',
      },
    ],
    conclusion: `Profit Seri ${serialNumber} sebesar ${netProfitRp >= 0 ? '+' : ''}${formatRupiah(netProfitRp)} berasal dari Total Tagihan Nota ${formatRupiah(revenueRp)} (${factoryBillableNetKg} kg × ${formatRupiah(factoryPricePerKg)}) dikurangi Total Modal Produksi ${formatRupiah(totalProductionCostRp)}.`,
  };
}
