import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Scale,
  Plus,
  Edit3,
  Trash2,
  MapPin,
  FileText,
  Leaf,
  PackageX,
  RotateCcw,
  Scroll,
  Building2,
  UserCheck,
  ArrowRightCircle,
  SlidersHorizontal,
  X,
  Calculator,
} from 'lucide-react';
import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  clampRating5,
  calculateRawTobaccoCost,
} from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import { SpinningStatTicker } from './SpinningStatTicker';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
  RawTobaccoCalcFocus,
  buildRawTobaccoCalcDetail,
} from './CalculationDetailModal';

interface RawTobaccoListProps {
  tobaccos: RawTobacco[];
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  onAddNew: () => void;
  onEdit: (tobacco: RawTobacco) => void;
  onDelete: (id: string) => void;
  onAddToBlend: (tobacco: RawTobacco) => void;
  onReassignRejectedToRoll: (serialId: string, targetRollId: string) => void;
  onUnpackRejectedToBlend?: (serial: FinishedTobaccoSerial) => void;
}

export const RawTobaccoList: React.FC<RawTobaccoListProps> = ({
  tobaccos,
  finishedBatches,
  rollSamples,
  onAddNew,
  onEdit,
  onDelete,
  onAddToBlend,
  onReassignRejectedToRoll,
  onUnpackRejectedToBlend,
}) => {
  const [activeStockPanel, setActiveStockPanel] = useState<'raw' | 'rejected-finished'>('raw');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'hpp' | 'power' | 'weightProfit'>('name');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Active item for "hidden until pressed" detail modal
  const [selectedRawDetail, setSelectedRawDetail] = useState<RawTobacco | null>(null);
  const [selectedRejectDetail, setSelectedRejectDetail] = useState<FinishedTobaccoSerial | null>(
    null
  );
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  const newestRollId = rollSamples[rollSamples.length - 1]?.id || rollSamples[0]?.id || '';
  const [selectedTargetRollMap, setSelectedTargetRollMap] = useState<Record<string, string>>({});

  const rejectedFinishedItems = finishedBatches.filter(
    (b) => b.factoryStatus === 'REJECTED_STOCK'
  );

  const origins = ['ALL', ...Array.from(new Set(tobaccos.map((t) => t.origin.split(' ')[0])))];

  // Helper to guarantee Paid vs Real Weight & Value metrics even for older cloud documents
  const getRawWeightMetrics = (t: RawTobacco) => {
    const calc = calculateRawTobaccoCost({
      grossWeightKg: t.grossWeightKg,
      pricePerKgPurchase: t.pricePerKgPurchase,
      taraFormula: t.taraFormula,
    });
    const paidNetKg = t.netWeightKg ?? calc.netWeightKg;
    const realNetKg = t.realNetWeightKg ?? calc.realNetWeightKg;
    const paidValueRp = t.totalModalAsal || calc.totalModalAsal;
    const realValueRp = t.realStockValueRp ?? calc.realStockValueRp;
    const weightProfitKg =
      t.purchaseWeightProfitKg ?? Number((realNetKg - paidNetKg).toFixed(2));
    const weightProfitRp = t.purchaseWeightProfitRp ?? realValueRp - paidValueRp;
    const effectiveRealCostPerKg =
      t.effectiveCostPerRealKg ?? calc.effectiveCostPerRealKg;
    const realPkgMassKg =
      t.taraFormula.packagingMassKg ?? t.taraFormula.flatKg ?? t.deductionKg;

    return {
      paidNetKg,
      realNetKg,
      paidValueRp,
      realValueRp,
      weightProfitKg,
      weightProfitRp,
      effectiveRealCostPerKg,
      realPkgMassKg,
    };
  };

  const filteredRaw = tobaccos
    .filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.sellerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.characterNotes.toLowerCase().includes(searchTerm.toLowerCase());

      const matchOrigin = selectedOrigin === 'ALL' || t.origin.startsWith(selectedOrigin);
      const matchGrade = selectedGrade === 'ALL' || t.colorGrade === selectedGrade;

      return matchSearch && matchOrigin && matchGrade;
    })
    .sort((a, b) => {
      if (sortBy === 'stock') return b.currentStockNetKg - a.currentStockNetKg;
      if (sortBy === 'hpp') return b.realCostPerNetKg - a.realCostPerNetKg;
      if (sortBy === 'power') return b.powerRating - a.powerRating;
      if (sortBy === 'weightProfit') {
        return getRawWeightMetrics(b).weightProfitRp - getRawWeightMetrics(a).weightProfitRp;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {/* Top Header & Locked-Position Segment Switcher */}
      <div className="requiem-card p-3.5 sm:p-5 rounded-2xl border border-zinc-800/90 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-black text-amber-400 border border-amber-500 text-xs font-mono font-black shadow-[0_0_12px_rgba(245,158,11,0.25)] shrink-0">
                STOK
              </span>
              <span className="truncate">Gudang Stok Tembakau</span>
            </h1>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              Ketuk kartu untuk rincian • Panel statistik menampilkan 5 karakter (/5) & timbangan
            </p>
          </div>

          <button
            type="button"
            title="Tambah Stok Tembakau Mentah Baru"
            onClick={onAddNew}
            className="btn-amber-outline inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl font-black text-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Bahan</span>
          </button>
        </div>

        {/* Fixed-Width Navigator Bar (Position never shifts when pressing < or >) */}
        <div className="pt-3 border-t border-zinc-800/90">
          <SegmentedControl
            value={activeStockPanel}
            onChange={setActiveStockPanel}
            options={[
              {
                id: 'raw',
                label: '1. Stok Mentah',
                fullLabel: '1. Stok Tembakau Mentah',
                icon: <Leaf className="w-3.5 h-3.5" />,
                badge: tobaccos.length,
              },
              {
                id: 'rejected-finished',
                label: '2. Stok Jadi (Reject)',
                fullLabel: '2. Stok Tembakau Jadi (Eks-Reject Pabrik)',
                icon: <PackageX className="w-3.5 h-3.5" />,
                badge: rejectedFinishedItems.length,
              },
            ]}
          />
        </div>
      </div>

      {/* PANEL 1: STOK TEMBAKAU MENTAH */}
      {activeStockPanel === 'raw' && (
        <>
          {/* Warehouse Paid Value vs Real Value & Buy-Side Weight Profit Summary Strip */}
          {(() => {
            const totals = filteredRaw.reduce(
              (acc, t) => {
                const paidVal =
                  t.totalModalAsal || Math.round(t.netWeightKg * t.pricePerKgPurchase);
                const realPkg = t.taraFormula.packagingMassKg ?? t.deductionKg;
                const realNet =
                  t.realNetWeightKg ??
                  Number(Math.max(0, t.grossWeightKg - realPkg).toFixed(2));
                const realVal =
                  t.realStockValueRp ?? Math.round(realNet * t.pricePerKgPurchase);
                const wpKg =
                  t.purchaseWeightProfitKg ?? Number((realNet - t.netWeightKg).toFixed(2));
                const wpRp = t.purchaseWeightProfitRp ?? realVal - paidVal;

                return {
                  paidNetKg: Number((acc.paidNetKg + t.netWeightKg).toFixed(2)),
                  realNetKg: Number((acc.realNetKg + realNet).toFixed(2)),
                  paidValueRp: acc.paidValueRp + paidVal,
                  realValueRp: acc.realValueRp + realVal,
                  weightProfitKg: Number((acc.weightProfitKg + wpKg).toFixed(2)),
                  weightProfitRp: acc.weightProfitRp + wpRp,
                };
              },
              {
                paidNetKg: 0,
                realNetKg: 0,
                paidValueRp: 0,
                realValueRp: 0,
                weightProfitKg: 0,
                weightProfitRp: 0,
              }
            );

            const openWarehouseCalcModal = (focus: RawTobaccoCalcFocus) => {
              if (focus === 'PAID_VALUE') {
                const itemSteps = filteredRaw.map((item, idx) => {
                  const m = getRawWeightMetrics(item);
                  return {
                    stepNumber: idx + 1,
                    title: `${item.name} (${item.origin})`,
                    formula: `Netto Bayar = Bruto ${item.grossWeightKg} kg − Potongan Nota ${item.deductionKg} kg = ${m.paidNetKg} kg`,
                    substitution: `${m.paidNetKg} kg × ${formatRupiah(item.pricePerKgPurchase)} = ${formatRupiah(m.paidValueRp)}`,
                    resultLabel: 'Nilai Bayar',
                    resultValue: formatRupiah(m.paidValueRp),
                    explanation: `Dari Bruto ${item.grossWeightKg} kg dipotong tarra nota ${item.deductionKg} kg (${item.taraFormula.rawFormula}) menjadi ${m.paidNetKg} kg.`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `1. Total Nilai Bayar (Paid Value) — ${filteredRaw.length} Stok`,
                  subtitle: `Total Netto Nota Dibayar: ${totals.paidNetKg} kg`,
                  badgeText: 'PANEL 1 GUDANG • ASAL ANGKA TOTAL NILAI BAYAR',
                  coreFormula:
                    'Total Nilai Bayar = Σ ((Bruto − Potongan Nota) × Harga Beli / KG)',
                  steps: itemSteps,
                  summaryRows: [
                    {
                      label: 'Jumlah Jenis Stok',
                      value: `${filteredRaw.length} Jenis Tembakau`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Netto Nota Dibayar',
                      value: `${totals.paidNetKg} kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Nilai Bayar (Paid)',
                      value: formatRupiah(totals.paidValueRp),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Total Nilai Bayar sebesar ${formatRupiah(totals.paidValueRp)} diperoleh dari penjumlahan Netto Bayar Nota seluruh stok (${totals.paidNetKg} kg) dikalikan harga beli masing-masing.`,
                });
                return;
              }

              if (focus === 'REAL_VALUE') {
                const itemSteps = filteredRaw.map((item, idx) => {
                  const m = getRawWeightMetrics(item);
                  return {
                    stepNumber: idx + 1,
                    title: `${item.name} (${item.origin})`,
                    formula: `Netto Riil = Bruto ${item.grossWeightKg} kg − Wadah Riil ${m.realPkgMassKg} kg = ${m.realNetKg} kg`,
                    substitution: `${m.realNetKg} kg × ${formatRupiah(item.pricePerKgPurchase)} = ${formatRupiah(m.realValueRp)}`,
                    resultLabel: 'Nilai Riil',
                    resultValue: formatRupiah(m.realValueRp),
                    explanation: `Berat wadah asli (${item.taraFormula.packagingType || 'Standar'}) adalah ${m.realPkgMassKg} kg, sehingga fisik tembakau adalah ${m.realNetKg} kg.`,
                    highlight: 'amber' as const,
                  };
                });

                setCalcDetail({
                  title: `2. Total Nilai Barang Riil (Real Value) — ${filteredRaw.length} Stok`,
                  subtitle: `Total Netto Fisik Sebenarnya: ${totals.realNetKg} kg`,
                  badgeText: 'PANEL 2 GUDANG • ASAL ANGKA TOTAL NILAI BARANG RIIL',
                  coreFormula:
                    'Total Nilai Barang Riil = Σ ((Bruto − Berat Wadah Riil) × Harga Beli / KG)',
                  steps: itemSteps,
                  summaryRows: [
                    {
                      label: 'Jumlah Jenis Stok',
                      value: `${filteredRaw.length} Jenis Tembakau`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Netto Fisik Sebenarnya',
                      value: `${totals.realNetKg} kg`,
                      highlight: 'amber',
                    },
                    {
                      label: 'Total Nilai Barang Riil',
                      value: formatRupiah(totals.realValueRp),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Total Nilai Barang Riil sebesar ${formatRupiah(totals.realValueRp)} diperoleh dari berat fisik tembakau sebenarnya di gudang (${totals.realNetKg} kg setelah dikurangi berat wadah asli) dikalikan harga beli masing-masing.`,
                });
                return;
              }

              // focus === 'WEIGHT_PROFIT'
              const itemSteps = filteredRaw.map((item, idx) => {
                const m = getRawWeightMetrics(item);
                return {
                  stepNumber: idx + 1,
                  title: `${item.name} (${item.origin})`,
                  formula: `Selisih Kg = Netto Riil ${m.realNetKg} kg − Netto Bayar ${m.paidNetKg} kg = ${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg`,
                  substitution: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg × ${formatRupiah(item.pricePerKgPurchase)} = ${m.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(m.weightProfitRp)}`,
                  resultLabel: 'Weight Profit',
                  resultValue: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg (${m.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(m.weightProfitRp)})`,
                  explanation: `Potongan nota ${item.deductionKg} kg vs berat wadah asli ${m.realPkgMassKg} kg (${item.taraFormula.packagingType || 'Standar'}).`,
                  highlight: (m.weightProfitKg >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                };
              });

              setCalcDetail({
                title: `3. Weight Profit (Untung Timbangan Beli) — ${filteredRaw.length} Stok`,
                subtitle: `Selisih Berat Total: ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg tembakau ekstra`,
                badgeText: 'PANEL 3 GUDANG • ASAL ANGKA WEIGHT PROFIT BELI',
                coreFormula:
                  'Total Weight Profit = Total Nilai Barang Riil − Total Nilai Bayar Nota',
                steps: itemSteps,
                summaryRows: [
                  {
                    label: 'Total Selisih Berat',
                    value: `${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                    highlight: totals.weightProfitKg >= 0 ? 'amber' : 'red',
                  },
                  {
                    label: 'Nilai Riil vs Nilai Bayar',
                    value: `${formatRupiah(totals.realValueRp)} − ${formatRupiah(totals.paidValueRp)}`,
                    highlight: 'white',
                  },
                  {
                    label: 'Total Weight Profit (Rp)',
                    value: `${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)}`,
                    highlight: totals.weightProfitRp >= 0 ? 'amber' : 'red',
                  },
                ],
                conclusion: `Angka Weight Profit ${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)} berasal dari selisih antara Total Nilai Barang Riil ${formatRupiah(totals.realValueRp)} (${totals.realNetKg} kg) dengan Total Nilai Bayar ${formatRupiah(totals.paidValueRp)} (${totals.paidNetKg} kg).`,
              });
            };

            return (
              <div className="requiem-card p-3.5 sm:p-4 rounded-2xl border border-amber-500/60 bg-black/95 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    <span>Perbandingan Nilai Bayar (Paid) vs Nilai Riil Barang & Weight Profit</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                    <CalcSymbolBadge />
                    <span>Simbol rincian angka</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs items-stretch">
                  <button
                    type="button"
                    onClick={() => openWarehouseCalcModal('PAID_VALUE')}
                    className="text-left group bg-zinc-950 p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                  >
                    <div className="space-y-0.5 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block truncate">
                          1. Total Nilai Bayar (Paid Value)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <div className="font-mono font-black text-white text-sm sm:text-base">
                        {formatRupiah(totals.paidValueRp)}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 block">
                        Netto Nota Dibayar: <b className="text-white">{totals.paidNetKg} kg</b>
                      </span>
                    </div>
                    <div className="w-full pt-1.5 border-t border-zinc-900 text-[10px] text-zinc-400 font-mono">
                      Σ (Netto Nota × Harga)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openWarehouseCalcModal('REAL_VALUE')}
                    className="text-left group bg-zinc-950 p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                  >
                    <div className="space-y-0.5 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-300 uppercase font-bold block truncate">
                          2. Total Nilai Barang Riil (Real Value)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <div className="font-mono font-black text-amber-300 text-sm sm:text-base">
                        {formatRupiah(totals.realValueRp)}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 block">
                        Netto Fisik Sebenarnya: <b className="text-amber-300">{totals.realNetKg} kg</b>
                      </span>
                    </div>
                    <div className="w-full pt-1.5 border-t border-zinc-900 text-[10px] text-zinc-400 font-mono">
                      Σ (Netto Riil × Harga)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openWarehouseCalcModal('WEIGHT_PROFIT')}
                    className="text-left group bg-zinc-950 p-3 rounded-xl border border-amber-500/80 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.12)] transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                  >
                    <div className="space-y-0.5 w-full">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-400 uppercase font-black block truncate">
                          3. Weight Profit (Untung Timbangan Beli)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <div
                        className={`font-mono font-black text-sm sm:text-base ${
                          totals.weightProfitRp >= 0 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        {totals.weightProfitRp >= 0 ? '+' : ''}
                        {formatRupiah(totals.weightProfitRp)}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-300 block">
                        Selisih Berat:{' '}
                        <b className="text-amber-400">
                          {totals.weightProfitKg >= 0 ? '+' : ''}
                          {totals.weightProfitKg} kg
                        </b>{' '}
                        tembakau ekstra
                      </span>
                    </div>
                    <div className="w-full pt-1.5 border-t border-zinc-900 text-[10px] text-zinc-400 font-mono">
                      Nilai Riil − Nilai Bayar
                    </div>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Compact Search Bar + Collapsible Filters (Hidden Until Pressed) */}
          <div className="requiem-card p-3 rounded-xl border border-zinc-800/90 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari tembakau, penjual, daerah asal..."
                  className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                title="Buka / Sembunyikan Filter Daerah, Grade & Urutan"
                onClick={() => setIsFilterOpen((v) => !v)}
                className="min-h-9 sm:min-h-10 px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-900 text-amber-400 border border-zinc-800 hover:border-amber-500 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-900 overflow-hidden"
                >
                  <select
                    value={selectedOrigin}
                    onChange={(e) => setSelectedOrigin(e.target.value)}
                    className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-amber-500"
                    aria-label="Filter Daerah Asal"
                  >
                    <option value="ALL">Semua Daerah</option>
                    {origins
                      .filter((o) => o !== 'ALL')
                      .map((orig) => (
                        <option key={orig} value={orig}>
                          {orig}
                        </option>
                      ))}
                  </select>

                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-amber-400 font-bold focus:outline-hidden focus:border-amber-500"
                    aria-label="Filter Grade Warna"
                  >
                    <option value="ALL">Semua Grade</option>
                    {Object.keys(GRADE_LABELS).map((gr) => (
                      <option key={gr} value={gr}>
                        Grade {gr}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-amber-500"
                    aria-label="Urutkan"
                  >
                    <option value="name">Urut: Nama</option>
                    <option value="weightProfit">Urut: Weight Profit Tertinggi</option>
                    <option value="stock">Urut: Stok Terbanyak</option>
                    <option value="hpp">Urut: Modal Tertinggi</option>
                    <option value="power">Urut: Power Terkuat</option>
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dynamic CSS Grid: 1 card per row on small phones (<420px), 2 per row when space permits (>=420px), 3-4 on larger screens */}
          {filteredRaw.length === 0 ? (
            <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
              <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-white font-bold text-sm">Tidak ada tembakau mentah yang cocok</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredRaw.map((tobacco, idx) => {
                const gradeInfo = GRADE_LABELS[tobacco.colorGrade] || GRADE_LABELS['D'];
                const power5 = clampRating5(tobacco.powerRating);
                const impact5 = clampRating5(tobacco.impactRating);
                const bitter5 = clampRating5(tobacco.bitterRating);
                const burn5 = clampRating5(tobacco.burnRating ?? 4.5);
                const sugar5 = clampRating5(tobacco.sugarRating ?? 4.0);
                const pkgName = tobacco.taraFormula.packagingType || 'Keranjang';
                const totalModalAsal =
                  tobacco.totalModalAsal ||
                  Math.round(tobacco.netWeightKg * tobacco.pricePerKgPurchase);
                const realPkgMassKg =
                  tobacco.taraFormula.packagingMassKg ?? tobacco.deductionKg;
                const realNetWeightKg =
                  tobacco.realNetWeightKg ??
                  Number(Math.max(0, tobacco.grossWeightKg - realPkgMassKg).toFixed(2));
                const realStockValueRp =
                  tobacco.realStockValueRp ??
                  Math.round(realNetWeightKg * tobacco.pricePerKgPurchase);
                const purchaseWeightProfitKg =
                  tobacco.purchaseWeightProfitKg ??
                  Number((realNetWeightKg - tobacco.netWeightKg).toFixed(2));
                const purchaseWeightProfitRp =
                  tobacco.purchaseWeightProfitRp ??
                  realStockValueRp - totalModalAsal;

                const tickerItems = [
                  {
                    id: 'all-5-characters',
                    shortTab: 'Rasa /5',
                    label: '5 Karakter (/5)',
                    value: '',
                    characterParams: [
                      { label: 'Power', shortLabel: 'Pwr', value: power5 },
                      { label: 'Impact', shortLabel: 'Imp', value: impact5 },
                      { label: 'Bitter', shortLabel: 'Bit', value: bitter5 },
                      { label: 'Bakar', shortLabel: 'Bkr', value: burn5 },
                      { label: 'Sugar', shortLabel: 'Sgr', value: sugar5 },
                    ],
                  },
                  {
                    id: 'weight-profit-beli',
                    shortTab: 'Untung Kg',
                    label: 'Paid vs Real Value',
                    value: `${purchaseWeightProfitKg >= 0 ? '+' : ''}${purchaseWeightProfitKg} kg (${purchaseWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(purchaseWeightProfitRp)})`,
                    subValue: `Riil ${realNetWeightKg}kg`,
                    detailLine: `Bayar ${formatRupiah(totalModalAsal)} vs Riil ${formatRupiah(realStockValueRp)}`,
                    accent: 'amber' as const,
                  },
                  {
                    id: 'timbangan-beli',
                    shortTab: 'Berat',
                    label: 'Timbangan & Tarra',
                    value: `Bayar ${tobacco.netWeightKg}kg • Riil ${realNetWeightKg}kg`,
                    subValue: `Tarra -${tobacco.deductionKg}kg`,
                    detailLine: `Bruto ${tobacco.grossWeightKg}kg • Wadah ${realPkgMassKg}kg (${pkgName})`,
                    accent: 'white' as const,
                  },
                  {
                    id: 'harga-modal',
                    shortTab: 'Modal',
                    label: 'Beli & Modal Asal',
                    value: `${formatRupiah(tobacco.pricePerKgPurchase)}/kg`,
                    subValue: 'Beli',
                    detailLine: `Paid: ${formatRupiah(totalModalAsal)}`,
                    accent: 'amber' as const,
                  },
                ];

                return (
                  <motion.div
                    key={tobacco.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
                    className="requiem-card border border-zinc-800/90 hover:border-amber-500 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-lg transition-all duration-200 group min-h-[308px] sm:min-h-[320px]"
                  >
                    {/* Clickable Area -> Opens Full Detail Modal */}
                    <div
                      onClick={() => setSelectedRawDetail(tobacco)}
                      className="cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-black border shrink-0 ${gradeInfo.color}`}
                        >
                          Grade {tobacco.colorGrade}
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate flex items-center gap-0.5 min-w-0">
                          <MapPin className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span className="truncate">{tobacco.origin.split(' ')[0]}</span>
                        </span>
                      </div>

                      <h3 className="font-extrabold text-white text-xs sm:text-sm line-clamp-2 min-h-[2.1rem] sm:min-h-[2.4rem] leading-snug group-hover:text-amber-400 transition-colors">
                        {tobacco.name}
                      </h3>

                      {/* Permanent Summary Box with Paid vs Real Weight & Value */}
                      <div className="bg-zinc-950/95 border border-zinc-800/90 rounded-xl px-2.5 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase text-zinc-400">
                            Netto Bayar / Riil
                          </span>
                          <span className="font-mono font-black text-[11px] sm:text-xs text-white whitespace-nowrap">
                            {tobacco.netWeightKg} kg{' '}
                            <span className="text-amber-400">/ {realNetWeightKg} kg</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                          <span className="text-[9px] font-bold uppercase text-zinc-400">
                            Harga Beli / KG
                          </span>
                          <span className="font-mono font-black text-[11px] sm:text-xs text-amber-400 whitespace-nowrap">
                            {formatRupiah(tobacco.realCostPerNetKg)}
                          </span>
                        </div>
                        {purchaseWeightProfitKg !== 0 && (
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                            <span className="text-[9px] font-black uppercase text-amber-400">
                              Weight Profit
                            </span>
                            <span className="font-mono font-black text-[10px] sm:text-[11px] text-amber-300 whitespace-nowrap">
                              {purchaseWeightProfitKg > 0 ? '+' : ''}
                              {purchaseWeightProfitKg} kg ({purchaseWeightProfitRp > 0 ? '+' : ''}
                              {formatRupiah(purchaseWeightProfitRp)})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Moving Panel with All 5 Character Parameters (/5) & Clear Breakdown */}
                      <SpinningStatTicker items={tickerItems} intervalMs={3200 + (idx % 3) * 350} />
                    </div>

                    {/* Minimalist Compact Card Footer */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-900 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedRawDetail(tobacco)}
                        className="text-[10px] sm:text-[11px] font-bold text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer truncate"
                      >
                        Detail →
                      </button>

                      <button
                        type="button"
                        title="Masukkan ke Kalkulator Racikan"
                        onClick={() => onAddToBlend(tobacco)}
                        className="btn-amber-outline min-h-7 sm:min-h-8 px-2.5 py-1 rounded-lg font-black text-[10px] sm:text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Scale className="w-3 h-3 stroke-[2.2] shrink-0" />
                        <span>Campur</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PANEL 2: STOK TEMBAKAU JADI (TEMPAT BARANG REJECT PABRIK) */}
      {activeStockPanel === 'rejected-finished' && (
        <div className="space-y-4">
          {rejectedFinishedItems.length === 0 ? (
            <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
              <PackageX className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-white font-bold">
                Tidak ada Nomor Seri Reject di Stok Tembakau Jadi
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rejectedFinishedItems.map((item) => {
                const targetRollId = selectedTargetRollMap[item.id] || newestRollId;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="requiem-card border-2 border-amber-500/50 rounded-2xl p-4 space-y-3.5 shadow-xl min-w-0 overflow-hidden"
                  >
                    <div
                      onClick={() => setSelectedRejectDetail(item)}
                      className="cursor-pointer flex items-start justify-between gap-2 min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs">
                            SERI {item.serialNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-500/40 text-xs font-black">
                            Grade {item.compositeColorGrade}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black text-white border border-zinc-700 text-[11px] font-bold">
                            {item.packaging.packagingType} (Utuh)
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1.5 truncate">
                          Eks-Gulungan:{' '}
                          <b className="text-white font-mono">
                            {item.previousRollNumber || item.rollNumber || 'GUL-2026-001'}
                          </b>
                        </p>
                      </div>

                      <div className="text-right font-mono text-xs shrink-0">
                        <div className="text-amber-400 font-black">
                          Netto: {item.factoryNetBillableKg} kg
                        </div>
                        <span className="text-[10px] text-zinc-400 underline">Detail →</span>
                      </div>
                    </div>

                    {/* Primary Action: Reassign into Newest Gulungan (Packaging & Weight Intact) */}
                    <div className="pt-2.5 border-t border-zinc-800 flex flex-col gap-2 w-full min-w-0">
                      <select
                        value={targetRollId}
                        onChange={(e) =>
                          setSelectedTargetRollMap((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        aria-label={`Pilih Gulungan Tujuan untuk Seri ${item.serialNumber}`}
                        className="w-full min-w-0 max-w-full h-9 px-3 bg-black border border-zinc-700 rounded-xl text-xs text-white font-bold truncate focus:outline-hidden focus:border-amber-500"
                      >
                        {rollSamples.map((r, idx) => (
                          <option key={r.id} value={r.id}>
                            {r.rollNumber} — {r.recipeName}
                            {idx === rollSamples.length - 1 ? ' [TERBARU]' : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        title="Masukkan Seri Reject ke Gulungan Ini (Kemasan & Berat Tetap Utuh)"
                        onClick={() => onReassignRejectedToRoll(item.id, targetRollId)}
                        className="btn-amber-outline w-full min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightCircle className="w-4 h-4 stroke-[2.2] shrink-0" />
                        <span>Masukkan ke Gulungan</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL FOR RAW TOBACCO CARD (Opens when card is pressed) */}
      <AnimatePresence>
        {selectedRawDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            {(() => {
              const t = selectedRawDetail;
              const modalAsal =
                t.totalModalAsal || Math.round(t.netWeightKg * t.pricePerKgPurchase);
              const realPkgMassKg = t.taraFormula.packagingMassKg ?? t.deductionKg;
              const realNetWeightKg =
                t.realNetWeightKg ??
                Number(Math.max(0, t.grossWeightKg - realPkgMassKg).toFixed(2));
              const realStockValueRp =
                t.realStockValueRp ?? Math.round(realNetWeightKg * t.pricePerKgPurchase);
              const purchaseWeightProfitKg =
                t.purchaseWeightProfitKg ??
                Number((realNetWeightKg - t.netWeightKg).toFixed(2));
              const purchaseWeightProfitRp =
                t.purchaseWeightProfitRp ?? realStockValueRp - modalAsal;
              const effectiveCostPerRealKg =
                t.effectiveCostPerRealKg ??
                (realNetWeightKg > 0
                  ? Math.round((modalAsal / realNetWeightKg) * 100) / 100
                  : t.realCostPerNetKg);

              return (
                <motion.div
                  initial={{ scale: 0.95, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 12 }}
                  className="bg-zinc-950 border-2 border-amber-500 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden"
                >
                  <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-black text-amber-400 border border-amber-500 font-black text-xs">
                          Grade {t.colorGrade}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">
                           Pembelian: {t.purchaseDate}
                        </span>
                      </div>
                      <h2 className="font-extrabold text-white text-base mt-1">{t.name}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRawDetail(null)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
                      aria-label="Tutup detail bahan"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto space-y-4 text-xs">
                    <div className="flex items-center justify-between text-zinc-300 bg-black p-3 rounded-xl border border-zinc-800">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        Asal: <b className="text-white">{t.origin}</b>
                      </span>
                      {(t.sellerName || t.taraFormula.sellerName) && (
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <b className="text-white">
                            {t.sellerName || t.taraFormula.sellerName}
                          </b>
                        </span>
                      )}
                    </div>

                    {/* Timbangan Nota vs Timbangan Riil & Weight Profit (Specific Per-Panel Breakdown) */}
                    <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-1.5 text-zinc-400">
                        <span>Kemasan ({t.taraFormula.packagingType || 'Standar'}):</span>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                          <CalcSymbolBadge />
                          <span>Simbol rincian angka</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-900 items-stretch">
                        <button
                          type="button"
                          onClick={() =>
                            setCalcDetail(
                              buildRawTobaccoCalcDetail({
                                name: t.name,
                                packagingType: t.taraFormula.packagingType || 'Standar',
                                grossWeightKg: t.grossWeightKg,
                                realPackagingMassKg: realPkgMassKg,
                                percentTara: t.taraFormula.percent,
                                flatKgTara: t.taraFormula.flatKg,
                                pricePerKg: t.pricePerKgPurchase,
                                additionalCost: t.additionalPurchaseCost || 0,
                                focus: 'PAID_VALUE',
                              })
                            )
                          }
                          className="text-left group bg-zinc-950 p-3 rounded-lg border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-zinc-400 font-bold uppercase block truncate">
                                1. Nilai Bayar Nota (Paid Value)
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono text-white">
                              Bruto {t.grossWeightKg} − Tarra {t.deductionKg} ={' '}
                              <b className="text-white">{t.netWeightKg} kg</b>
                            </div>
                            <div className="font-mono font-black text-white text-sm">
                              {formatRupiah(modalAsal)}
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            {t.netWeightKg} kg × {formatRupiah(t.pricePerKgPurchase)}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setCalcDetail(
                              buildRawTobaccoCalcDetail({
                                name: t.name,
                                packagingType: t.taraFormula.packagingType || 'Standar',
                                grossWeightKg: t.grossWeightKg,
                                realPackagingMassKg: realPkgMassKg,
                                percentTara: t.taraFormula.percent,
                                flatKgTara: t.taraFormula.flatKg,
                                pricePerKg: t.pricePerKgPurchase,
                                additionalCost: t.additionalPurchaseCost || 0,
                                focus: 'REAL_VALUE',
                              })
                            )
                          }
                          className="text-left group bg-zinc-950 p-3 rounded-lg border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-amber-300 font-bold uppercase block truncate">
                                2. Nilai Barang Riil (Real Value)
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono text-zinc-200">
                              Bruto {t.grossWeightKg} − Wadah {realPkgMassKg} ={' '}
                              <b className="text-amber-300">{realNetWeightKg} kg</b>
                            </div>
                            <div className="font-mono font-black text-amber-300 text-sm">
                              {formatRupiah(realStockValueRp)}
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            {realNetWeightKg} kg × {formatRupiah(t.pricePerKgPurchase)}
                          </div>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCalcDetail(
                            buildRawTobaccoCalcDetail({
                              name: t.name,
                              packagingType: t.taraFormula.packagingType || 'Standar',
                              grossWeightKg: t.grossWeightKg,
                              realPackagingMassKg: realPkgMassKg,
                              percentTara: t.taraFormula.percent,
                              flatKgTara: t.taraFormula.flatKg,
                              pricePerKg: t.pricePerKgPurchase,
                              additionalCost: t.additionalPurchaseCost || 0,
                              focus: 'WEIGHT_PROFIT',
                            })
                          )
                        }
                        className="w-full text-left group bg-zinc-950 p-3 rounded-lg border border-amber-500/80 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between flex-wrap gap-2"
                      >
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-400 block">
                            3. Weight Profit (Untung Timbangan Beli)
                          </span>
                          <span className="text-[11px] font-mono text-zinc-300">
                            Modal Riil / KG Fisik:{' '}
                            <b className="text-white">{formatRupiah(effectiveCostPerRealKg)}/kg</b>
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="font-mono font-black text-amber-400 text-sm text-right">
                            {purchaseWeightProfitKg >= 0 ? '+' : ''}
                            {purchaseWeightProfitKg} kg ({purchaseWeightProfitRp >= 0 ? '+' : ''}
                            {formatRupiah(purchaseWeightProfitRp)})
                          </div>
                          <CalcSymbolBadge />
                        </div>
                      </button>
                    </div>

                    {/* 5 Sensory Ratings (/5) */}
                    <div className="bg-black p-3.5 rounded-xl border border-zinc-800">
                      <div className="text-[10px] text-amber-400 uppercase font-extrabold mb-2">
                        5 Parameter Karakteristik (/5)
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        {[
                          { lbl: 'Power', val: clampRating5(t.powerRating) },
                          { lbl: 'Impact', val: clampRating5(t.impactRating) },
                          { lbl: 'Bitter', val: clampRating5(t.bitterRating) },
                          { lbl: 'Bakar', val: clampRating5(t.burnRating ?? 4.5) },
                          { lbl: 'Sugar', val: clampRating5(t.sugarRating ?? 4.0) },
                        ].map((r) => (
                          <div
                            key={r.lbl}
                            className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800"
                          >
                            <div className="text-[9px] text-zinc-400 uppercase font-bold">
                              {r.lbl}
                            </div>
                            <div className="font-mono font-black text-amber-400 text-xs">
                              {r.val.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {t.characterNotes && (
                      <div className="bg-black p-3 rounded-xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" /> Catatan Karakter & Pegangan:
                        </div>
                        <p className="text-zinc-300 leading-relaxed">{t.characterNotes}</p>
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 border-t border-zinc-800 bg-black flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(t);
                          setSelectedRawDetail(null);
                        }}
                        className="min-h-9 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(t.id);
                          setSelectedRawDetail(null);
                        }}
                        className="min-h-9 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-amber-400 border border-zinc-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAddToBlend(t);
                        setSelectedRawDetail(null);
                      }}
                      className="btn-amber-outline min-h-9 px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5" /> Campur
                    </button>
                  </div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAIL MODAL FOR REJECTED SERIAL CARD */}
      <AnimatePresence>
        {selectedRejectDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="bg-zinc-950 border-2 border-amber-500 rounded-2xl w-full max-w-md flex flex-col shadow-2xl text-white overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs">
                  SERI {selectedRejectDetail.serialNumber} (Eks-Reject)
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedRejectDetail(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                  aria-label="Tutup detail reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Riwayat Sebelum Reject:
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Scroll className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Gulungan Asal:{' '}
                      <b className="text-white font-mono">
                        {selectedRejectDetail.previousRollNumber ||
                          selectedRejectDetail.rollNumber}
                      </b>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Pabrik Sebelumnya:{' '}
                      <b className="text-white">
                        {selectedRejectDetail.previousFactory ||
                          selectedRejectDetail.targetFactory}
                      </b>
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-zinc-900 font-mono text-white">
                    Kemasan Utuh: {selectedRejectDetail.packaging.packagingType} • Bruto{' '}
                    {selectedRejectDetail.packaging.grossWeightPerPackage}kg − Tarra{' '}
                    {selectedRejectDetail.factoryDeductionKg}kg ={' '}
                    <b className="text-amber-400">{selectedRejectDetail.factoryNetBillableKg}kg</b>
                  </div>
                </div>

                {onUnpackRejectedToBlend && (
                  <div className="bg-black p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-400">
                      Opsi jarang (bongkar kemasan):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onUnpackRejectedToBlend(selectedRejectDetail);
                        setSelectedRejectDetail(null);
                      }}
                      className="min-h-8 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/50 font-bold text-[11px] cursor-pointer"
                    >
                      Bongkar ke Racikan
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
