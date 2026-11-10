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
  FactoryMaster,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  TOBACCO_GRADE_ORDER,
  formatRupiah,
  clampRating5,
  calculateRawTobaccoCost,
  formatSerialLineage,
} from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import { SpinningStatTicker, AutoSlideValueTicker } from './SpinningStatTicker';
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
  factoryList?: FactoryMaster[];
  initialStockPanel?: 'raw' | 'rejected-finished';
  onAddNew: () => void;
  onEdit: (tobacco: RawTobacco) => void;
  onDelete: (id: string) => void;
  onAddToBlend: (tobacco: RawTobacco) => void;
  onReassignRejectedToRoll: (
    serialId: string,
    targetRollId: string,
    newSerialNumber?: string,
    newTargetFactory?: string
  ) => void;
  onUnpackRejectedToBlend?: (serial: FinishedTobaccoSerial) => void;
}

export const RawTobaccoList: React.FC<RawTobaccoListProps> = ({
  tobaccos,
  finishedBatches,
  rollSamples,
  factoryList = [],
  initialStockPanel = 'raw',
  onAddNew,
  onEdit,
  onDelete,
  onAddToBlend,
  onReassignRejectedToRoll,
  onUnpackRejectedToBlend,
}) => {
  const [activeStockPanel, setActiveStockPanel] = useState<'raw' | 'rejected-finished'>(
    initialStockPanel
  );
  React.useEffect(() => {
    setActiveStockPanel(initialStockPanel);
  }, [initialStockPanel]);
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
  const [newSerialNumberMap, setNewSerialNumberMap] = useState<Record<string, string>>({});
  const [selectedTargetFactoryMap, setSelectedTargetFactoryMap] = useState<Record<string, string>>(
    {}
  );

  const rejectedFinishedItems = finishedBatches.filter(
    (b) => b.factoryStatus === 'REJECTED_STOCK'
  );

  const origins = ['ALL', ...Array.from(new Set(tobaccos.map((t) => t.origin.split(' ')[0])))];

  // Helper to compute Netto (Bruto - Tarra), Base Tobacco Cost (Netto * Harga), Added Fee Cost (Netto * Fee), and Total Modal (Netto * (Harga + Fee))
  const getRawWeightMetrics = (t: RawTobacco) => {
    const calc = calculateRawTobaccoCost({
      grossWeightKg: t.grossWeightKg,
      pricePerKgPurchase: t.pricePerKgPurchase,
      taraFormula: t.taraFormula,
      agentFees: t.agentFees,
      totalAgentFeePerKg: t.totalAgentFeePerKg,
      additionalCost: t.additionalPurchaseCost || 0,
    });
    const netWeightKg = calc.netWeightKg;
    const baseTobaccoCostRp = calc.baseTobaccoCostRp;
    const totalAgentFeePerKg = calc.totalAgentFeePerKg;
    const totalAgentFeeRp = calc.totalAgentFeeRp;
    const effectivePricePerKgWithFee = calc.effectivePricePerKgWithFee;
    const totalModalAsal = calc.totalModalAsal;

    return {
      netWeightKg,
      baseTobaccoCostRp,
      totalAgentFeePerKg,
      totalAgentFeeRp,
      effectivePricePerKgWithFee,
      totalModalAsal,
      deductionKg: calc.deductionKg,
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
      if (sortBy === 'hpp') {
        return getRawWeightMetrics(b).effectivePricePerKgWithFee - getRawWeightMetrics(a).effectivePricePerKgWithFee;
      }
      if (sortBy === 'power') return b.powerRating - a.powerRating;
      if (sortBy === 'weightProfit') {
        return getRawWeightMetrics(b).totalModalAsal - getRawWeightMetrics(a).totalModalAsal;
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-3 pb-20 md:pb-4">
      {/* Slideable Button Panel Only */}
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

      {/* PANEL 1: STOK TEMBAKAU MENTAH */}
      {activeStockPanel === 'raw' && (
        <>
          {/* Warehouse Summary Strip: 1. Harga Tembakau Dasar | 2. Biaya Tambahan Fee | 3. Total Modal (Harga + Fee) */}
          {(() => {
            const totals = filteredRaw.reduce(
              (acc, t) => {
                const m = getRawWeightMetrics(t);
                return {
                  netWeightKg: Number((acc.netWeightKg + m.netWeightKg).toFixed(2)),
                  baseTobaccoCostRp: acc.baseTobaccoCostRp + m.baseTobaccoCostRp,
                  totalAgentFeeRp: acc.totalAgentFeeRp + m.totalAgentFeeRp,
                  totalModalAsal: acc.totalModalAsal + m.totalModalAsal,
                };
              },
              {
                netWeightKg: 0,
                baseTobaccoCostRp: 0,
                totalAgentFeeRp: 0,
                totalModalAsal: 0,
              }
            );

            const openWarehouseCalcModal = (focus: RawTobaccoCalcFocus) => {
              if (focus === 'PAID_VALUE') {
                const itemSteps = filteredRaw.map((item, idx) => {
                  const m = getRawWeightMetrics(item);
                  return {
                    stepNumber: idx + 3,
                    title: `${item.name} (${item.origin})`,
                    formula: `Harga Tembakau = (Bruto − Tarra) × Harga Beli / KG`,
                    substitution: `(${item.grossWeightKg} kg − ${m.deductionKg} kg) × ${formatRupiah(item.pricePerKgPurchase)} = ${m.netWeightKg} kg × ${formatRupiah(item.pricePerKgPurchase)} = ${formatRupiah(m.baseTobaccoCostRp)}`,
                    resultLabel: `${item.name}`,
                    resultValue: `${formatRupiah(m.baseTobaccoCostRp)} (${m.netWeightKg} kg)`,
                    explanation: `Bruto ${item.grossWeightKg} kg dipotong tarra ${m.deductionKg} kg (${item.taraFormula.rawFormula}) menjadi Netto ${m.netWeightKg} kg.`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `1. Total Harga Tembakau Dasar (Netto × Harga) — ${filteredRaw.length} Stok`,
                  subtitle: `Total Netto (Bruto − Tarra): ${totals.netWeightKg} kg`,
                  badgeText: 'PANEL 1 GUDANG • RUMUS HARGA TEMBAKAU DASAR',
                  coreFormula:
                    'Total Harga Tembakau = Σ (Netto × Harga Tembakau / KG)   |   Netto = Bruto − Tarra',
                  appliedFormula: `Total Harga Tembakau = ${filteredRaw.map((item) => formatRupiah(getRawWeightMetrics(item).baseTobaccoCostRp)).join(' + ')} = ${formatRupiah(totals.baseTobaccoCostRp)}   |   Total Netto = ${totals.netWeightKg} kg`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Netto (Bruto − Tarra)',
                      formula: 'Total Netto = Σ (Berat Bruto − Potongan Tarra)',
                      substitution:
                        filteredRaw
                          .map((item) => `${getRawWeightMetrics(item).netWeightKg} kg (${item.name})`)
                          .join(' + ') + ` = ${totals.netWeightKg} kg`,
                      resultLabel: 'Total Netto',
                      resultValue: `${totals.netWeightKg} kg`,
                      explanation: `Jumlah berat bersih (Bruto − Tarra) dari seluruh ${filteredRaw.length} stok tembakau.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Total Harga Tembakau Dasar',
                      formula: 'Total Harga Tembakau = Σ (Netto × Harga Tembakau / KG)',
                      substitution:
                        filteredRaw
                          .map((item) => formatRupiah(getRawWeightMetrics(item).baseTobaccoCostRp))
                          .join(' + ') + ` = ${formatRupiah(totals.baseTobaccoCostRp)}`,
                      resultLabel: 'Total Harga Tembakau Dasar',
                      resultValue: formatRupiah(totals.baseTobaccoCostRp),
                      explanation: `Total harga pokok tembakau murni sebelum ditambah fee pencari barang/perantara.`,
                      highlight: 'amber',
                    },
                    ...itemSteps,
                  ],
                  conclusion: `Total Harga Tembakau Dasar = ${formatRupiah(totals.baseTobaccoCostRp)} (${totals.netWeightKg} kg).`,
                });
                return;
              }

              if (focus === 'REAL_VALUE') {
                const itemSteps = filteredRaw.map((item, idx) => {
                  const m = getRawWeightMetrics(item);
                  const feeNames =
                    Array.isArray(item.agentFees) && item.agentFees.length > 0
                      ? item.agentFees
                          .map((f) => `${f.agentName || 'Agen'} (+${formatRupiah(f.feePerKg)}/kg)`)
                          .join(', ')
                      : 'Tanpa Fee Perantara (Rp 0/kg)';
                  return {
                    stepNumber: idx + 3,
                    title: `${item.name} (${item.origin})`,
                    formula: `Biaya Tambahan Fee = Netto × Fee / KG`,
                    substitution: `${m.netWeightKg} kg × ${formatRupiah(m.totalAgentFeePerKg)}/kg = ${formatRupiah(m.totalAgentFeeRp)}`,
                    resultLabel: `${item.name}`,
                    resultValue: `+${formatRupiah(m.totalAgentFeeRp)} (${formatRupiah(m.totalAgentFeePerKg)}/kg)`,
                    explanation: `Rincian Fee: ${feeNames}. Merupakan biaya tambahan pembelian (bukan keuntungan).`,
                    highlight: (m.totalAgentFeeRp > 0 ? 'amber' : 'white') as 'amber' | 'white',
                  };
                });

                setCalcDetail({
                  title: `2. Total Biaya Tambahan Fee (Netto × Fee) — ${filteredRaw.length} Stok`,
                  subtitle: `Biaya Tambahan Perantara • Total Netto: ${totals.netWeightKg} kg`,
                  badgeText: 'PANEL 2 GUDANG • RUMUS BIAYA TAMBAHAN FEE PERANTARA',
                  coreFormula:
                    'Total Biaya Fee = Σ (Netto × Fee / KG)   |   Netto = Bruto − Tarra (Biaya Tambahan / Added Cost)',
                  appliedFormula: `Total Biaya Tambahan Fee = ${filteredRaw.map((item) => formatRupiah(getRawWeightMetrics(item).totalAgentFeeRp)).join(' + ')} = +${formatRupiah(totals.totalAgentFeeRp)}`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Rumus Fee per Barang (Netto × Fee)',
                      formula: 'Biaya Fee Barang = (Bruto − Tarra) × Total Fee / KG',
                      substitution: `Contoh: 50 kg dengan potongan 10% + 2 kg → Netto = 50 − 5 − 2 = 43 kg × Rp 1.000 = Rp 43.000 biaya tambahan`,
                      resultLabel: 'Sifat Perhitungan',
                      resultValue: 'Biaya Tambahan (Added Cost)',
                      explanation: `Fee perantara menambah harga modal per kg tembakau yang harus kita bayar.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Total Biaya Tambahan Fee Gudang',
                      formula: 'Total Biaya Fee = Σ (Netto × Fee / KG)',
                      substitution:
                        filteredRaw
                          .map((item) => formatRupiah(getRawWeightMetrics(item).totalAgentFeeRp))
                          .join(' + ') + ` = ${formatRupiah(totals.totalAgentFeeRp)}`,
                      resultLabel: 'Total Biaya Tambahan Fee',
                      resultValue: `+${formatRupiah(totals.totalAgentFeeRp)}`,
                      explanation: `Total seluruh ongkos fee pencari barang/perantara dari ${filteredRaw.length} stok.`,
                      highlight: 'amber',
                    },
                    ...itemSteps,
                  ],
                  conclusion: `Total Biaya Tambahan Fee = +${formatRupiah(totals.totalAgentFeeRp)} (Biaya Tambahan Pembelian).`,
                });
                return;
              }

              // focus === 'WEIGHT_PROFIT' -> Total Modal Pembelian (Harga Tembakau + Fee)
              const itemSteps = filteredRaw.map((item, idx) => {
                const m = getRawWeightMetrics(item);
                return {
                  stepNumber: idx + 4,
                  title: `${item.name} (${item.origin})`,
                  formula: `Total Modal = Netto × (Harga Beli + Fee/KG)`,
                  substitution: `${m.netWeightKg} kg × (${formatRupiah(item.pricePerKgPurchase)} + ${formatRupiah(m.totalAgentFeePerKg)}) = ${m.netWeightKg} kg × ${formatRupiah(m.effectivePricePerKgWithFee)} = ${formatRupiah(m.totalModalAsal)}`,
                  resultLabel: `${item.name}`,
                  resultValue: `${formatRupiah(m.totalModalAsal)} (${formatRupiah(m.effectivePricePerKgWithFee)}/kg)`,
                  explanation: `Harga Tembakau ${formatRupiah(m.baseTobaccoCostRp)} + Biaya Fee ${formatRupiah(m.totalAgentFeeRp)} = Total Modal ${formatRupiah(m.totalModalAsal)}.`,
                  highlight: 'amber' as const,
                };
              });

              const avgEffectiveModalPerKg =
                totals.netWeightKg > 0 ? Math.round(totals.totalModalAsal / totals.netWeightKg) : 0;

              setCalcDetail({
                title: `3. Total Modal Pembelian (Harga + Fee) — ${filteredRaw.length} Stok`,
                subtitle: `Total Netto: ${totals.netWeightKg} kg • Rata-rata ${formatRupiah(avgEffectiveModalPerKg)}/kg`,
                badgeText: 'PANEL 3 GUDANG • RUMUS TOTAL MODAL (HARGA + FEE)',
                coreFormula:
                  'Total Modal = Σ [Netto × (Harga Tembakau + Fee)] = Total Harga Tembakau + Total Biaya Fee',
                appliedFormula: `Total Modal = ${formatRupiah(totals.baseTobaccoCostRp)} (Tembakau) + ${formatRupiah(totals.totalAgentFeeRp)} (Fee) = ${formatRupiah(totals.totalModalAsal)}`,
                steps: [
                  {
                    stepNumber: 1,
                    title: 'Total Harga Tembakau Dasar (Netto × Harga)',
                    formula: 'Total Harga Tembakau = Σ (Netto × Harga Beli / KG)',
                    substitution:
                      filteredRaw
                        .map((item) => formatRupiah(getRawWeightMetrics(item).baseTobaccoCostRp))
                        .join(' + ') + ` = ${formatRupiah(totals.baseTobaccoCostRp)}`,
                    resultLabel: 'Total Harga Tembakau',
                    resultValue: formatRupiah(totals.baseTobaccoCostRp),
                    explanation: `Total harga pokok tembakau murni untuk ${totals.netWeightKg} kg.`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 2,
                    title: 'Total Biaya Tambahan Fee (Netto × Fee)',
                    formula: 'Total Biaya Fee = Σ (Netto × Fee / KG)',
                    substitution:
                      filteredRaw
                        .map((item) => formatRupiah(getRawWeightMetrics(item).totalAgentFeeRp))
                        .join(' + ') + ` = +${formatRupiah(totals.totalAgentFeeRp)}`,
                    resultLabel: 'Total Biaya Tambahan Fee',
                    resultValue: `+${formatRupiah(totals.totalAgentFeeRp)}`,
                    explanation: `Total biaya tambahan untuk agen/perantara pencari barang.`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 3,
                    title: 'Total Modal Pembelian (Harga Tembakau + Fee)',
                    formula: 'Total Modal = Total Harga Tembakau + Total Biaya Fee',
                    substitution: `${formatRupiah(totals.baseTobaccoCostRp)} + ${formatRupiah(totals.totalAgentFeeRp)} = ${formatRupiah(totals.totalModalAsal)}`,
                    resultLabel: 'Total Modal Kita Bayar',
                    resultValue: formatRupiah(totals.totalModalAsal),
                    explanation: `Rata-rata harga modal efektif = ${formatRupiah(totals.totalModalAsal)} ÷ ${totals.netWeightKg} kg = ${formatRupiah(avgEffectiveModalPerKg)}/kg.`,
                    highlight: 'amber',
                  },
                  ...itemSteps,
                ],
                conclusion: `Total Modal Pembelian = ${formatRupiah(totals.baseTobaccoCostRp)} + ${formatRupiah(totals.totalAgentFeeRp)} = ${formatRupiah(totals.totalModalAsal)}.`,
              });
            };

            return (
              <AutoSlideValueTicker
                slides={[
                  {
                    id: 'paid-value',
                    tabLabel: '1. Harga Tembakau',
                    title: '1. Total Harga Tembakau Dasar (Netto × Harga)',
                    mainValue: formatRupiah(totals.baseTobaccoCostRp),
                    subLabel: 'Total Netto (Bruto − Tarra)',
                    subValue: `${totals.netWeightKg} kg`,
                    formulaHint: 'Σ (Netto × Harga Beli)',
                    accent: 'white',
                    onOpenCalc: () => openWarehouseCalcModal('PAID_VALUE'),
                  },
                  {
                    id: 'real-value',
                    tabLabel: '2. Biaya Fee',
                    title: '2. Total Biaya Tambahan Fee (Netto × Fee)',
                    mainValue: `+${formatRupiah(totals.totalAgentFeeRp)}`,
                    subLabel: 'Biaya Tambahan Perantara',
                    subValue: `${totals.netWeightKg} kg`,
                    formulaHint: 'Σ (Netto × Fee/KG)',
                    accent: 'white',
                    onOpenCalc: () => openWarehouseCalcModal('REAL_VALUE'),
                  },
                  {
                    id: 'weight-profit',
                    tabLabel: '3. Total Modal',
                    title: '3. Total Modal Pembelian (Harga + Fee)',
                    mainValue: formatRupiah(totals.totalModalAsal),
                    subLabel: 'Total Netto Dibayar',
                    subValue: `${totals.netWeightKg} kg`,
                    formulaHint: 'Σ [Netto × (Harga + Fee)]',
                    accent: 'amber',
                    onOpenCalc: () => openWarehouseCalcModal('WEIGHT_PROFIT'),
                  },
                ]}
              />
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
                  className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700"
                />
              </div>

              <button
                type="button"
                title="Buka / Sembunyikan Filter Daerah, Grade & Urutan"
                onClick={() => setIsFilterOpen((v) => !v)}
                className="min-h-9 sm:min-h-10 px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-900 text-amber-400 border border-zinc-800 hover:border-zinc-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
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
                    className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-zinc-700"
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
                    className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-bold focus:outline-hidden focus:border-zinc-700"
                    aria-label="Filter Grade Warna"
                  >
                    <option value="ALL">Semua Grade</option>
                    {TOBACCO_GRADE_ORDER.map((gr) => (
                      <option key={gr} value={gr}>
                        Grade {gr}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-zinc-700"
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
                const aroma5 = clampRating5(tobacco.aromaRating ?? 4.2);
                const pkgName = tobacco.taraFormula.packagingType || 'Keranjang';
                const m = getRawWeightMetrics(tobacco);

                const tickerItems = [
                  {
                    id: 'all-6-characters',
                    shortTab: 'Rasa /5',
                    label: '6 Karakter (/5)',
                    value: '',
                    characterParams: [
                      { label: 'Power', shortLabel: 'Pwr', value: power5 },
                      { label: 'Impact', shortLabel: 'Imp', value: impact5 },
                      { label: 'Bitter', shortLabel: 'Bit', value: bitter5 },
                      { label: 'Burn', shortLabel: 'Brn', value: burn5 },
                      { label: 'Sugar', shortLabel: 'Sgr', value: sugar5 },
                      { label: 'Aroma', shortLabel: 'Arm', value: aroma5 },
                    ],
                  },
                  {
                    id: 'timbangan-beli',
                    shortTab: 'Berat',
                    label: 'Timbangan (Bruto − Tarra)',
                    value: `Netto ${m.netWeightKg} kg`,
                    subValue: `Tarra -${m.deductionKg} kg`,
                    detailLine: `Bruto ${tobacco.grossWeightKg} kg • ${pkgName} (${tobacco.taraFormula.rawFormula})`,
                    accent: 'white' as const,
                  },
                  {
                    id: 'biaya-fee',
                    shortTab: 'Fee',
                    label: 'Biaya Tambahan Fee (Netto × Fee)',
                    value:
                      m.totalAgentFeePerKg > 0
                        ? `+${formatRupiah(m.totalAgentFeeRp)}`
                        : 'Rp 0 (Tanpa Fee)',
                    subValue: `+${formatRupiah(m.totalAgentFeePerKg)}/kg`,
                    detailLine: `${m.netWeightKg} kg × ${formatRupiah(m.totalAgentFeePerKg)}/kg`,
                    accent: 'amber' as const,
                  },
                  {
                    id: 'harga-modal',
                    shortTab: 'Modal',
                    label: 'Total Modal (Harga + Fee)',
                    value: `${formatRupiah(m.totalModalAsal)}`,
                    subValue: `${formatRupiah(m.effectivePricePerKgWithFee)}/kg`,
                    detailLine: `Tembakau ${formatRupiah(m.baseTobaccoCostRp)} + Fee ${formatRupiah(m.totalAgentFeeRp)}`,
                    accent: 'amber' as const,
                  },
                ];

                return (
                  <motion.div
                    key={tobacco.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
                    className="requiem-card border-2 border-zinc-700/90 hover:border-amber-500/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-[0_7px_0_0_#18181b,0_14px_26px_rgba(0,0,0,0.9)] hover:shadow-[0_8px_0_0_#f59e0b,0_16px_30px_rgba(245,158,11,0.18)] transition-all duration-200 group min-h-[308px] sm:min-h-[320px]"
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
                          <MapPin className="w-2.5 h-2.5 text-zinc-300 shrink-0" />
                          <span className="truncate">{tobacco.origin.split(' ')[0]}</span>
                        </span>
                      </div>

                      <h3 className="font-extrabold text-white text-xs sm:text-sm line-clamp-2 min-h-[2.1rem] sm:min-h-[2.4rem] leading-snug group-hover:text-white transition-colors">
                        {tobacco.name}
                      </h3>

                      {/* Permanent Summary Box with Netto (Bruto - Tarra), Harga + Fee, and Total Modal */}
                      <div className="bg-zinc-950/95 border border-zinc-800/90 rounded-xl px-2.5 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase text-zinc-400">
                            Netto (Bruto − Tarra)
                          </span>
                          <span className="font-mono font-black text-[11px] sm:text-xs text-white whitespace-nowrap">
                            {m.netWeightKg} kg{' '}
                            <span className="text-zinc-400 text-[10px]">
                              ({tobacco.grossWeightKg}−{m.deductionKg})
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                          <span className="text-[9px] font-bold uppercase text-zinc-400">
                            Harga Tembakau / KG
                          </span>
                          <span className="font-mono font-bold text-[11px] text-zinc-200 whitespace-nowrap">
                            {formatRupiah(tobacco.pricePerKgPurchase)}
                          </span>
                        </div>
                        {m.totalAgentFeePerKg > 0 && (
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                            <span className="text-[9px] font-bold uppercase text-amber-300 truncate">
                              + Fee ({tobacco.agentFees?.length || 1} Agen)
                            </span>
                            <span className="font-mono font-bold text-[10px] text-amber-400 whitespace-nowrap">
                              +{formatRupiah(m.totalAgentFeePerKg)}/kg ({formatRupiah(m.totalAgentFeeRp)})
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                          <span className="text-[9px] font-black uppercase text-amber-400">
                            Total Modal ({formatRupiah(m.effectivePricePerKgWithFee)}/kg)
                          </span>
                          <span className="font-mono font-black text-[11px] sm:text-xs text-amber-400 whitespace-nowrap">
                            {formatRupiah(m.totalModalAsal)}
                          </span>
                        </div>
                      </div>

                      {/* Moving Panel with All 6 Character Parameters (/5) & Clear Breakdown */}
                      <SpinningStatTicker items={tickerItems} intervalMs={3200 + (idx % 3) * 350} />
                    </div>

                    {/* Minimalist Compact Card Footer */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-900 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedRawDetail(tobacco)}
                        className="text-[10px] sm:text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer truncate"
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
                const selectedRollObj = rollSamples.find((r) => r.id === targetRollId);
                const newSerialInput = newSerialNumberMap[item.id] ?? '';
                const trimmedNewSerial = newSerialInput.trim();
                const targetFactoryValue =
                  selectedTargetFactoryMap[item.id] ||
                  selectedRollObj?.targetFactory ||
                  item.targetFactory;

                const currentLineageText = formatSerialLineage(item);
                const previewNextLineage =
                  trimmedNewSerial && trimmedNewSerial !== item.serialNumber
                    ? `${currentLineageText} -> ${trimmedNewSerial}`
                    : currentLineageText;

                const allFactoryOptions = Array.from(
                  new Set([
                    ...factoryList.map((f) => f.name),
                    ...rollSamples.map((r) => r.targetFactory),
                    item.targetFactory,
                  ])
                );

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -3 }}
                    className="requiem-card border-2 border-zinc-700/90 hover:border-amber-500/80 rounded-2xl p-4 space-y-3.5 shadow-[0_7px_0_0_#18181b,0_14px_26px_rgba(0,0,0,0.9)] hover:shadow-[0_8px_0_0_#f59e0b,0_16px_30px_rgba(245,158,11,0.18)] transition-all duration-200 min-w-0 overflow-hidden"
                  >
                    <div
                      onClick={() => setSelectedRejectDetail(item)}
                      className="cursor-pointer flex items-start justify-between gap-2 min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-zinc-700 font-mono font-black text-xs">
                            SERI {currentLineageText}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-400 border border-zinc-800 text-xs font-black">
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
                          {' • '}
                          Pabrik Asal:{' '}
                          <b className="text-amber-300">
                            {item.previousFactory || item.targetFactory}
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

                    {/* Primary Action: Rename Serial (e.g. AK 1 -> AL 1) & Reassign into New Gulungan / Factory */}
                    <div className="pt-3 border-t border-zinc-800 space-y-2.5 w-full min-w-0">
                      {/* Step 1: Opsi Ganti Nomor Seri (misal AK 1 menjadi AL 1) */}
                      <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="text-[10px] uppercase font-extrabold text-amber-400">
                            Ganti Nomor Seri Baru
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setNewSerialNumberMap((prev) => ({
                                ...prev,
                                [item.id]:
                                  item.serialNumber.toUpperCase() === 'AK 1'
                                    ? 'AL 1'
                                    : `AL ${item.serialNumber.replace(/[^0-9]/g, '') || '1'}`,
                              }))
                            }
                            className="px-2 py-0.5 rounded bg-black hover:bg-zinc-900 border border-amber-500/60 text-[10px] font-mono font-bold text-amber-300 cursor-pointer"
                          >
                            +{' '}
                            {item.serialNumber.toUpperCase() === 'AK 1'
                              ? 'AL 1'
                              : `AL ${item.serialNumber.replace(/[^0-9]/g, '') || '1'}`}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                          <input
                            type="text"
                            value={newSerialInput}
                            onChange={(e) =>
                              setNewSerialNumberMap((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder={`Kosongkan jika tetap ${item.serialNumber} (atau ketik mis. AL 1)`}
                            aria-label={`Nomor Seri Baru untuk ${item.serialNumber}`}
                            className="w-full h-9 px-3 bg-black border border-zinc-700 focus:border-amber-500 rounded-xl text-xs font-mono font-bold text-white placeholder-zinc-500 focus:outline-hidden"
                          />

                          <div className="h-9 px-3 rounded-xl bg-black border border-amber-500/60 flex items-center justify-between gap-2 text-xs font-mono">
                            <span className="text-[10px] text-zinc-400 uppercase font-bold shrink-0">
                              Tampilan Seri:
                            </span>
                            <span className="font-black text-amber-400 truncate">
                              {previewNextLineage}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Pilih Gulungan Tujuan Baru & Pabrik Tujuan Baru */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                            Gulungan Baru Tujuan
                          </label>
                          <select
                            value={targetRollId}
                            onChange={(e) => {
                              const nextRollId = e.target.value;
                              const nextRoll = rollSamples.find((r) => r.id === nextRollId);
                              setSelectedTargetRollMap((prev) => ({
                                ...prev,
                                [item.id]: nextRollId,
                              }));
                              if (nextRoll) {
                                setSelectedTargetFactoryMap((prev) => ({
                                  ...prev,
                                  [item.id]: nextRoll.targetFactory,
                                }));
                              }
                            }}
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
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                            Pabrik Tujuan Baru
                          </label>
                          <select
                            value={targetFactoryValue}
                            onChange={(e) =>
                              setSelectedTargetFactoryMap((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            aria-label={`Pilih Pabrik Tujuan Baru untuk Seri ${item.serialNumber}`}
                            className="w-full min-w-0 max-w-full h-9 px-3 bg-black border border-zinc-700 rounded-xl text-xs text-amber-300 font-bold truncate focus:outline-hidden focus:border-amber-500"
                          >
                            {allFactoryOptions.map((facName) => (
                              <option key={facName} value={facName}>
                                {facName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        title="Masukkan Seri Reject ke Gulungan & Pabrik Tujuan (Kemasan & Berat Tetap Utuh)"
                        onClick={() => {
                          onReassignRejectedToRoll(
                            item.id,
                            targetRollId,
                            trimmedNewSerial || undefined,
                            targetFactoryValue
                          );
                          setNewSerialNumberMap((prev) => {
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                        }}
                        className="btn-amber-outline w-full min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightCircle className="w-4 h-4 stroke-[2.2] shrink-0" />
                        <span>
                          {trimmedNewSerial && trimmedNewSerial !== item.serialNumber
                            ? `Ubah jadi SERI ${previewNextLineage} & Masukkan ke Gulungan`
                            : 'Masukkan ke Gulungan'}
                        </span>
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
              const m = getRawWeightMetrics(t);

              return (
                <motion.div
                  initial={{ scale: 0.95, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 12 }}
                  className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden"
                >
                  <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-black text-amber-400 border border-zinc-700 font-black text-xs">
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
                        <MapPin className="w-3.5 h-3.5 text-zinc-300" />
                        Asal: <b className="text-white">{t.origin}</b>
                      </span>
                      {(t.sellerName || t.taraFormula.sellerName) && (
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-zinc-300" />
                          <b className="text-white">
                            {t.sellerName || t.taraFormula.sellerName}
                          </b>
                        </span>
                      )}
                    </div>

                    {Array.isArray(t.agentFees) && t.agentFees.length > 0 && (
                      <div className="bg-black p-3 rounded-xl border border-amber-500/40 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                          <span>Biaya Tambahan Fee Perantara ({t.agentFees.length} Orang):</span>
                          <span className="font-mono font-black text-amber-400">
                            +{formatRupiah(m.totalAgentFeePerKg)}/kg (Total +{formatRupiah(m.totalAgentFeeRp)})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {t.agentFees.map((f, idx) => (
                            <span
                              key={f.id || idx}
                              className="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-200"
                            >
                              <b className="text-white">{f.agentName || `Orang #${idx + 1}`}</b>:{' '}
                              +{formatRupiah(f.feePerKg)}/kg × {m.netWeightKg} kg ={' '}
                              <b className="text-amber-400">
                                +{formatRupiah(Math.round(m.netWeightKg * (Number(f.feePerKg) || 0)))}
                              </b>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rincian Harga Tembakau, Biaya Tambahan Fee & Total Modal (Specific Per-Panel Breakdown) */}
                    <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-1.5 text-zinc-400">
                        <span>
                          Kemasan: <b className="text-white">{t.taraFormula.packagingType || 'Standar'}</b> • Netto:{' '}
                          <b className="text-amber-400 font-mono">
                            {t.grossWeightKg} − {m.deductionKg} = {m.netWeightKg} kg
                          </b>
                        </span>
                        <CalcSymbolBadge />
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
                                percentTara: t.taraFormula.percent,
                                flatKgTara: t.taraFormula.flatKg,
                                pricePerKg: t.pricePerKgPurchase,
                                agentFees: t.agentFees,
                                additionalCost: t.additionalPurchaseCost || 0,
                                focus: 'PAID_VALUE',
                              })
                            )
                          }
                          className="text-left group bg-zinc-950 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-zinc-400 font-bold uppercase block truncate">
                                1. Harga Tembakau (Netto × Harga)
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono text-white">
                              Bruto {t.grossWeightKg} − Tarra {m.deductionKg} ={' '}
                              <b className="text-white">{m.netWeightKg} kg</b>
                            </div>
                            <div className="font-mono font-black text-white text-sm">
                              {formatRupiah(m.baseTobaccoCostRp)}
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            {m.netWeightKg} kg × {formatRupiah(t.pricePerKgPurchase)}/kg
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
                                percentTara: t.taraFormula.percent,
                                flatKgTara: t.taraFormula.flatKg,
                                pricePerKg: t.pricePerKgPurchase,
                                agentFees: t.agentFees,
                                additionalCost: t.additionalPurchaseCost || 0,
                                focus: 'REAL_VALUE',
                              })
                            )
                          }
                          className="text-left group bg-zinc-950 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-amber-300 font-bold uppercase block truncate">
                                2. Biaya Tambahan Fee (Netto × Fee)
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono text-zinc-200">
                              Netto <b className="text-white">{m.netWeightKg} kg</b> × Fee{' '}
                              <b className="text-amber-300">+{formatRupiah(m.totalAgentFeePerKg)}/kg</b>
                            </div>
                            <div className="font-mono font-black text-amber-400 text-sm">
                              +{formatRupiah(m.totalAgentFeeRp)}
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            Biaya Tambahan ({t.agentFees?.length || 0} Orang Perantara)
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
                              percentTara: t.taraFormula.percent,
                              flatKgTara: t.taraFormula.flatKg,
                              pricePerKg: t.pricePerKgPurchase,
                              agentFees: t.agentFees,
                              additionalCost: t.additionalPurchaseCost || 0,
                              focus: 'WEIGHT_PROFIT',
                            })
                          )
                        }
                        className="w-full text-left group bg-zinc-950 p-3 rounded-lg border border-amber-500/40 hover:border-amber-500 transition-all cursor-pointer flex items-center justify-between flex-wrap gap-2"
                      >
                        <div>
                          <span className="text-[10px] font-black uppercase text-amber-400 block">
                            3. Total Modal Kita Bayar (Harga + Fee)
                          </span>
                          <span className="text-[11px] font-mono text-zinc-300">
                            {m.netWeightKg} kg × ({formatRupiah(t.pricePerKgPurchase)} +{' '}
                            {formatRupiah(m.totalAgentFeePerKg)}) ={' '}
                            <b className="text-white">{formatRupiah(m.effectivePricePerKgWithFee)}/kg</b>
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="font-mono font-black text-amber-400 text-sm text-right">
                            {formatRupiah(m.totalModalAsal)}
                          </div>
                          <CalcSymbolBadge />
                        </div>
                      </button>
                    </div>

                    {/* 6 Sensory Ratings (/5) */}
                    <div className="bg-black p-3.5 rounded-xl border border-zinc-800">
                      <div className="text-[10px] text-zinc-200 uppercase font-extrabold mb-2">
                        6 Parameter Karakteristik (/5)
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                        {[
                          { lbl: 'Power', val: clampRating5(t.powerRating) },
                          { lbl: 'Impact', val: clampRating5(t.impactRating) },
                          { lbl: 'Bitter', val: clampRating5(t.bitterRating) },
                          { lbl: 'Burn', val: clampRating5(t.burnRating ?? 4.5) },
                          { lbl: 'Sugar', val: clampRating5(t.sugarRating ?? 4.0) },
                          { lbl: 'Aroma', val: clampRating5(t.aromaRating ?? 4.2) },
                        ].map((r) => (
                          <div
                            key={r.lbl}
                            className="bg-zinc-950 py-2 px-1.5 rounded-lg border border-zinc-800"
                          >
                            <div className="text-[9px] text-zinc-400 uppercase font-bold">
                              {r.lbl}
                            </div>
                            <div className="font-mono font-black text-amber-400 text-base sm:text-lg mt-0.5">
                              {r.val.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {t.characterNotes && (
                      <div className="bg-black p-3 rounded-xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-200 flex items-center gap-1 mb-1">
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
                        <Edit3 className="w-3.5 h-3.5 text-zinc-300" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(t.id);
                          setSelectedRawDetail(null);
                        }}
                        className="min-h-9 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
              className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-md flex flex-col shadow-2xl text-white overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-zinc-700 font-mono font-black text-xs">
                  SERI {formatSerialLineage(selectedRejectDetail)} (Eks-Reject)
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
                    <Scroll className="w-3.5 h-3.5 text-zinc-300" />
                    <span>
                      Gulungan Asal:{' '}
                      <b className="text-white font-mono">
                        {selectedRejectDetail.previousRollNumber ||
                          selectedRejectDetail.rollNumber}
                      </b>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <Building2 className="w-3.5 h-3.5 text-zinc-300" />
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
                    <b className="text-white">{selectedRejectDetail.factoryNetBillableKg}kg</b>
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
                      className="min-h-8 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-800 font-bold text-[11px] cursor-pointer"
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
