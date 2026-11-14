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
  Clock,
  DollarSign,
  Sparkles,
  Hand,
} from 'lucide-react';
import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  FactoryMaster,
  PackagingMaster,
} from '../types/tobacco';
import { getRawTobaccoMissingFlags } from '../utils/tobaccoCompleteness';
import { HoldQuickMenuOverlay, useHoldDragMenu } from './HoldQuickMenu';
import { QuickEditSection, RawQuickEditModal } from './RawQuickEditModal';
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
  packagingList?: PackagingMaster[];
  initialStockPanel?: 'raw' | 'rejected-finished';
  onAddNew: () => void;
  onEdit: (tobacco: RawTobacco) => void;
  onQuickUpdate?: (updated: RawTobacco) => void;
  onDelete: (id: string) => void;
  onDeleteFinished?: (serialId: string) => void;
  onClearAllDemoData?: () => void;
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
  packagingList = [],
  initialStockPanel = 'raw',
  onAddNew,
  onEdit,
  onQuickUpdate,
  onDelete,
  onDeleteFinished,
  onClearAllDemoData,
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
  const [missingFilter, setMissingFilter] = useState<
    'ALL' | 'INCOMPLETE' | 'NEED_WEIGHT' | 'NEED_PRICE' | 'NEED_ATTR'
  >('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'hpp' | 'power' | 'weightProfit'>('name');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Active item for "hidden until pressed" detail modal
  const [selectedRawDetail, setSelectedRawDetail] = useState<RawTobacco | null>(null);
  const [selectedRejectDetail, setSelectedRejectDetail] = useState<FinishedTobaccoSerial | null>(
    null
  );
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);
  const [quickEditState, setQuickEditState] = useState<{
    tobacco: RawTobacco;
    section: QuickEditSection;
  } | null>(null);
  const holdMenu = useHoldDragMenu();

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

  // Helper to compute Total Modal / Inventory Value, Weight Profit (Rp), Weight Profit (KG), and Sisa Stok
  const getRawWeightMetrics = (t: RawTobacco) => {
    const calc = calculateRawTobaccoCost({
      grossWeightKg: t.grossWeightKg,
      pricePerKgPurchase: t.pricePerKgPurchase,
      realPackagingMassKg: t.packagingMassKg ?? t.taraFormula.packagingMassKg,
      taraFormula: t.taraFormula,
      agentFees: t.agentFees,
      totalAgentFeePerKg: t.totalAgentFeePerKg,
      additionalCost: t.additionalPurchaseCost || 0,
    });
    const netWeightKg = calc.netWeightKg;
    const realNetKg = calc.realNetWeightKg;
    const realPkgMassKg = calc.realPackagingMassKg;
    const baseTobaccoCostRp = calc.baseTobaccoCostRp;
    const totalAgentFeePerKg = calc.totalAgentFeePerKg;
    const totalAgentFeeRp = calc.totalAgentFeeRp;
    const effectivePricePerKgWithFee = calc.effectivePricePerKgWithFee;
    const totalModalAsal = calc.totalModalAsal;
    const weightProfitKg = calc.purchaseWeightProfitKg;
    const weightProfitRp = calc.purchaseWeightProfitRp;
    const currentStockKg = Number((t.currentStockNetKg ?? realNetKg).toFixed(2));

    return {
      netWeightKg,
      realNetKg,
      realPkgMassKg,
      baseTobaccoCostRp,
      totalAgentFeePerKg,
      totalAgentFeeRp,
      effectivePricePerKgWithFee,
      totalModalAsal,
      weightProfitKg,
      weightProfitRp,
      currentStockKg,
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
      const flags = getRawTobaccoMissingFlags(t);
      const matchMissing =
        missingFilter === 'ALL' ||
        (missingFilter === 'INCOMPLETE' && flags.isIncomplete) ||
        (missingFilter === 'NEED_WEIGHT' && flags.missingWeight) ||
        (missingFilter === 'NEED_PRICE' && flags.missingPrice) ||
        (missingFilter === 'NEED_ATTR' && flags.missingAttributes);

      return matchSearch && matchOrigin && matchGrade && matchMissing;
    })
    .sort((a, b) => {
      if (sortBy === 'stock') return b.currentStockNetKg - a.currentStockNetKg;
      if (sortBy === 'hpp') {
        return getRawWeightMetrics(b).effectivePricePerKgWithFee - getRawWeightMetrics(a).effectivePricePerKgWithFee;
      }
      if (sortBy === 'power') return b.powerRating - a.powerRating;
      if (sortBy === 'weightProfit') {
        return getRawWeightMetrics(b).weightProfitRp - getRawWeightMetrics(a).weightProfitRp;
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
          {/* Warehouse Summary Strip: 1. Total Modal / Nilai Inventori | 2. Weight Profit (Rupiah) | 3. Weight Profit (KG) */}
          {(() => {
            const totals = filteredRaw.reduce(
              (acc, t) => {
                const m = getRawWeightMetrics(t);
                return {
                  netWeightKg: Number((acc.netWeightKg + m.netWeightKg).toFixed(2)),
                  realNetKg: Number((acc.realNetKg + m.realNetKg).toFixed(2)),
                  currentStockKg: Number((acc.currentStockKg + m.currentStockKg).toFixed(2)),
                  totalModalAsal: acc.totalModalAsal + m.totalModalAsal,
                  weightProfitKg: Number((acc.weightProfitKg + m.weightProfitKg).toFixed(2)),
                  weightProfitRp: acc.weightProfitRp + m.weightProfitRp,
                };
              },
              {
                netWeightKg: 0,
                realNetKg: 0,
                currentStockKg: 0,
                totalModalAsal: 0,
                weightProfitKg: 0,
                weightProfitRp: 0,
              }
            );

            const openWarehouseCalcModal = (focus: RawTobaccoCalcFocus) => {
              if (focus === 'PAID_VALUE') {
                const itemSteps = filteredRaw.map((item, idx) => {
                  const m = getRawWeightMetrics(item);
                  return {
                    stepNumber: idx + 3,
                    title: `${item.name} (${item.origin})`,
                    formula: `Total Modal = Netto Nota × (Harga Tembakau + Fee/KG)`,
                    substitution: `${m.netWeightKg} kg × (${formatRupiah(item.pricePerKgPurchase)} + ${formatRupiah(m.totalAgentFeePerKg)}) = ${m.netWeightKg} kg × ${formatRupiah(m.effectivePricePerKgWithFee)} = ${formatRupiah(m.totalModalAsal)}`,
                    resultLabel: `${item.name}`,
                    resultValue: `${formatRupiah(m.totalModalAsal)} (Sisa: ${m.currentStockKg} kg)`,
                    explanation: `Bruto ${item.grossWeightKg} kg − Tarra ${m.deductionKg} kg = Netto Nota ${m.netWeightKg} kg. Sisa stok saat ini: ${m.currentStockKg} kg.`,
                    highlight: 'amber' as const,
                  };
                });

                setCalcDetail({
                  title: `1. Total Modal / Nilai Inventori — ${filteredRaw.length} Stok`,
                  subtitle: `Sisa Stok Tersedia: ${totals.currentStockKg} kg • Total Netto Beli: ${totals.netWeightKg} kg`,
                  badgeText: 'METRIK 1 GUDANG • TOTAL MODAL / NILAI INVENTORI',
                  coreFormula:
                    'Total Modal / Nilai Inventori = Σ [Netto Nota × (Harga Tembakau + Fee/KG)]',
                  appliedFormula: `Total Modal = ${filteredRaw.map((item) => formatRupiah(getRawWeightMetrics(item).totalModalAsal)).join(' + ')} = ${formatRupiah(totals.totalModalAsal)}`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Netto Nota & Sisa Stok Gudang',
                      formula: 'Netto Nota = Σ (Bruto − Potongan Tarra)',
                      substitution:
                        filteredRaw
                          .map((item) => `${getRawWeightMetrics(item).netWeightKg} kg (${item.name})`)
                          .join(' + ') + ` = ${totals.netWeightKg} kg`,
                      resultLabel: 'Total Netto Nota',
                      resultValue: `${totals.netWeightKg} kg (Sisa: ${totals.currentStockKg} kg)`,
                      explanation: `Total berat bersih yang kita bayar dari ${filteredRaw.length} stok tembakau mentah.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Total Modal / Nilai Inventori (Harga Tembakau + Biaya Fee)',
                      formula: 'Total Modal = Σ [Netto × (Harga Tembakau + Fee/KG)]',
                      substitution:
                        filteredRaw
                          .map((item) => formatRupiah(getRawWeightMetrics(item).totalModalAsal))
                          .join(' + ') + ` = ${formatRupiah(totals.totalModalAsal)}`,
                      resultLabel: 'Total Modal / Nilai Inventori',
                      resultValue: formatRupiah(totals.totalModalAsal),
                      explanation: `Seluruh modal pembelian tembakau beserta biaya tambahan fee perantara.`,
                      highlight: 'amber',
                    },
                    ...itemSteps,
                  ],
                  conclusion: `Total Modal / Nilai Inventori = ${formatRupiah(totals.totalModalAsal)} (${totals.currentStockKg} kg stok tersedia).`,
                });
                return;
              }

              if (focus === 'REAL_VALUE') {
                const itemSteps = filteredRaw.map((item, idx) => {
                  const m = getRawWeightMetrics(item);
                  return {
                    stepNumber: idx + 3,
                    title: `${item.name} (${item.origin})`,
                    formula: `Weight Profit (Rp) = Weight Profit (KG) × Harga Tembakau Dasar/KG`,
                    substitution: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg × ${formatRupiah(item.pricePerKgPurchase)} = ${m.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(m.weightProfitRp)}`,
                    resultLabel: `${item.name}`,
                    resultValue: `${m.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(m.weightProfitRp)} (${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg)`,
                    explanation: `Netto Riil ${m.realNetKg} kg − Netto Nota ${m.netWeightKg} kg = ${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg × ${formatRupiah(item.pricePerKgPurchase)}/kg.`,
                    highlight: (m.weightProfitRp >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                  };
                });

                setCalcDetail({
                  title: `2. Weight Profit dalam Rupiah — ${filteredRaw.length} Stok`,
                  subtitle: `Total Weight Profit (KG): ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                  badgeText: 'METRIK 2 GUDANG • WEIGHT PROFIT DALAM RUPIAH',
                  coreFormula:
                    'Total Weight Profit (Rp) = Σ [(Netto Riil − Netto Nota) × Harga Tembakau Dasar/KG]',
                  appliedFormula: `Total Weight Profit (Rp) = ${filteredRaw.map((item) => formatRupiah(getRawWeightMetrics(item).weightProfitRp)).join(' + ')} = ${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)}`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Weight Profit dalam KG (Selisih Timbangan)',
                      formula: 'Total Weight Profit (KG) = Σ (Netto Fisik Riil − Netto Nota)',
                      substitution: `${totals.realNetKg} kg (Netto Riil) − ${totals.netWeightKg} kg (Netto Nota) = ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                      resultLabel: 'Total Weight Profit (KG)',
                      resultValue: `${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                      explanation: `Selisih antara berat isi tembakau fisik sebenarnya dengan berat yang ditagihkan di nota pembelian.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Total Weight Profit dalam Rupiah',
                      formula: 'Total Weight Profit (Rp) = Σ (Weight Profit KG × Harga Tembakau / KG)',
                      substitution:
                        filteredRaw
                          .map((item) => formatRupiah(getRawWeightMetrics(item).weightProfitRp))
                          .join(' + ') + ` = ${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)}`,
                      resultLabel: 'Total Weight Profit (Rp)',
                      resultValue: `${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)}`,
                      explanation: `Dihitung menggunakan harga tembakau dasar per kg (Fee perantara adalah biaya tambahan, bukan profit).`,
                      highlight: totals.weightProfitRp >= 0 ? 'amber' : 'red',
                    },
                    ...itemSteps,
                  ],
                  conclusion: `Total Weight Profit (Rupiah) = ${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)} dari ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg.`,
                });
                return;
              }

              // focus === 'WEIGHT_PROFIT' -> Weight Profit dalam KG
              const itemSteps = filteredRaw.map((item, idx) => {
                const m = getRawWeightMetrics(item);
                return {
                  stepNumber: idx + 3,
                  title: `${item.name} (${item.origin})`,
                  formula: `Weight Profit (KG) = Netto Riil − Netto Nota`,
                  substitution: `(${item.grossWeightKg} − ${m.realPkgMassKg}) − (${item.grossWeightKg} − ${m.deductionKg}) = ${m.realNetKg} kg − ${m.netWeightKg} kg = ${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg`,
                  resultLabel: `${item.name}`,
                  resultValue: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg`,
                  explanation: `Potongan Tarra Nota ${m.deductionKg} kg vs Berat Wadah Riil ${m.realPkgMassKg} kg.`,
                  highlight: (m.weightProfitKg >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                };
              });

              setCalcDetail({
                title: `3. Weight Profit dalam KG — ${filteredRaw.length} Stok`,
                subtitle: `Netto Fisik Riil ${totals.realNetKg} kg vs Netto Nota ${totals.netWeightKg} kg`,
                badgeText: 'METRIK 3 GUDANG • WEIGHT PROFIT DALAM KG',
                coreFormula:
                  'Weight Profit (KG) = Σ (Netto Fisik Riil − Netto Nota) = Σ (Potongan Tarra Nota − Berat Wadah Riil)',
                appliedFormula: `Weight Profit (KG) = ${totals.realNetKg} kg (Netto Riil) − ${totals.netWeightKg} kg (Netto Nota) = ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                steps: [
                  {
                    stepNumber: 1,
                    title: 'Total Netto Nota (Bruto − Potongan Tarra)',
                    formula: 'Total Netto Nota = Σ (Bruto − Tarra Nota)',
                    substitution:
                      filteredRaw
                        .map((item) => `${getRawWeightMetrics(item).netWeightKg} kg (${item.name})`)
                        .join(' + ') + ` = ${totals.netWeightKg} kg`,
                    resultLabel: 'Total Netto Nota',
                    resultValue: `${totals.netWeightKg} kg`,
                    explanation: `Berat bersih yang kita bayar sesuai potongan tarra nota.`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 2,
                    title: 'Total Netto Fisik Riil & Weight Profit (KG)',
                    formula: 'Weight Profit (KG) = Total Netto Fisik Riil − Total Netto Nota',
                    substitution: `${totals.realNetKg} kg − ${totals.netWeightKg} kg = ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                    resultLabel: 'Total Weight Profit (KG)',
                    resultValue: `${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                    explanation: `Total selisih berat menguntungkan (dalam KG) dari seluruh stok mentah di gudang.`,
                    highlight: totals.weightProfitKg >= 0 ? 'amber' : 'red',
                  },
                  ...itemSteps,
                ],
                conclusion: `Total Weight Profit (KG) = ${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg (Senilai ${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)}).`,
              });
            };

            return (
              <AutoSlideValueTicker
                slides={[
                  {
                    id: 'paid-value',
                    tabLabel: '1. Total Modal',
                    title: '1. Total Modal / Nilai Inventori (Netto × Harga + Fee)',
                    mainValue: formatRupiah(totals.totalModalAsal),
                    subLabel: 'Sisa Stok / Netto Nota',
                    subValue: `${totals.currentStockKg} kg / ${totals.netWeightKg} kg`,
                    formulaHint: 'Σ [Netto × (Harga + Fee)]',
                    accent: 'amber',
                    onOpenCalc: () => openWarehouseCalcModal('PAID_VALUE'),
                  },
                  {
                    id: 'real-value',
                    tabLabel: '2. Weight Profit (Rp)',
                    title: '2. Weight Profit dalam Rupiah (KG Profit × Harga)',
                    mainValue: `${totals.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(totals.weightProfitRp)}`,
                    subLabel: 'Dari Weight Profit (KG)',
                    subValue: `${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                    formulaHint: 'Σ (Weight Profit KG × Harga)',
                    accent: totals.weightProfitRp >= 0 ? 'amber' : 'red',
                    onOpenCalc: () => openWarehouseCalcModal('REAL_VALUE'),
                  },
                  {
                    id: 'weight-profit',
                    tabLabel: '3. Weight Profit (KG)',
                    title: '3. Weight Profit dalam KG (Netto Riil − Netto Nota)',
                    mainValue: `${totals.weightProfitKg >= 0 ? '+' : ''}${totals.weightProfitKg} kg`,
                    subLabel: 'Netto Riil vs Netto Nota',
                    subValue: `${totals.realNetKg} kg vs ${totals.netWeightKg} kg`,
                    formulaHint: 'Σ (Netto Riil − Netto Nota)',
                    accent: totals.weightProfitKg >= 0 ? 'white' : 'red',
                    onOpenCalc: () => openWarehouseCalcModal('WEIGHT_PROFIT'),
                  },
                ]}
              />
            );
          })()}

          {/* Compact Search Bar + Fixed Icon-Only Filter Button (Shows Description Only on Hover) */}
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
                aria-label="Filter & Urutan"
                onClick={() => setIsFilterOpen((v) => !v)}
                className={`group relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                  isFilterOpen
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-black hover:bg-zinc-900 text-amber-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" />
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                  {isFilterOpen ? 'Tutup Filter & Urutan' : 'Filter Daerah, Grade & Urutan'}
                </span>
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
            {/* Quick Completeness Status Pills + Hold Instruction */}
            {(() => {
              const allFlags = tobaccos.map((t) => getRawTobaccoMissingFlags(t));
              const incompleteCount = allFlags.filter((f) => f.isIncomplete).length;
              const needWeightCount = allFlags.filter((f) => f.missingWeight).length;
              const needPriceCount = allFlags.filter((f) => f.missingPrice).length;
              const needAttrCount = allFlags.filter((f) => f.missingAttributes).length;

              return (
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setMissingFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        missingFilter === 'ALL'
                          ? 'bg-amber-500 text-black border-amber-400 font-black'
                          : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      Semua ({tobaccos.length})
                    </button>

                    {incompleteCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMissingFilter(missingFilter === 'INCOMPLETE' ? 'ALL' : 'INCOMPLETE')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 ${
                          missingFilter === 'INCOMPLETE'
                            ? 'bg-amber-500 text-black border-amber-400 font-black'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/50'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>Belum Lengkap ({incompleteCount})</span>
                      </button>
                    )}

                    {needWeightCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMissingFilter(
                            missingFilter === 'NEED_WEIGHT' ? 'ALL' : 'NEED_WEIGHT'
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          missingFilter === 'NEED_WEIGHT'
                            ? 'bg-amber-500 text-black border-amber-400 font-black'
                            : 'bg-black hover:bg-zinc-900 text-amber-300 border-zinc-800'
                        }`}
                      >
                        ⏳ Butuh Timbangan ({needWeightCount})
                      </button>
                    )}

                    {needPriceCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMissingFilter(missingFilter === 'NEED_PRICE' ? 'ALL' : 'NEED_PRICE')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          missingFilter === 'NEED_PRICE'
                            ? 'bg-amber-500 text-black border-amber-400 font-black'
                            : 'bg-black hover:bg-zinc-900 text-amber-300 border-zinc-800'
                        }`}
                      >
                        ⏳ Butuh Harga ({needPriceCount})
                      </button>
                    )}

                    {needAttrCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMissingFilter(missingFilter === 'NEED_ATTR' ? 'ALL' : 'NEED_ATTR')
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          missingFilter === 'NEED_ATTR'
                            ? 'bg-amber-500 text-black border-amber-400 font-black'
                            : 'bg-black hover:bg-zinc-900 text-amber-300 border-zinc-800'
                        }`}
                      >
                        ⏳ Butuh Atribut ({needAttrCount})
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-zinc-400 inline-flex items-center gap-1">
                    <Hand className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Tahan &amp; geser pada kartu untuk edit cepat</span>
                  </span>
                </div>
              );
            })()}
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
                const missingFlags = getRawTobaccoMissingFlags(tobacco);
                const isBeingHeld = holdMenu.isHoldingProgressId === tobacco.id;

                const buildHoldOptions = () => [
                  {
                    id: 'timbangan',
                    label: 'Timbangan & Potongan Tarra',
                    shortLabel: 'Timbangan',
                    sublabel:
                      tobacco.grossWeightKg > 0
                        ? `Bruto ${tobacco.grossWeightKg} kg • Netto ${m.netWeightKg} kg`
                        : 'Timbangan menyusul (0 kg)',
                    detailRows: [
                      {
                        label: 'Bruto Timbangan',
                        value:
                          tobacco.grossWeightKg > 0
                            ? `${tobacco.grossWeightKg} kg`
                            : 'Belum diisi (0 kg)',
                        tone: (tobacco.grossWeightKg > 0 ? 'emerald' : 'rose') as
                          | 'emerald'
                          | 'rose',
                      },
                      {
                        label: 'Kemasan & Tarra',
                        value: `${pkgName} (−${m.deductionKg} kg)`,
                        tone: 'white' as const,
                      },
                      {
                        label: 'Netto Nota vs Riil',
                        value: `${m.netWeightKg} kg • Riil ${m.realNetKg} kg`,
                        tone: 'amber' as const,
                      },
                      {
                        label: 'Sisa Stok Aktif',
                        value: `${tobacco.currentStockNetKg} kg`,
                        tone: 'white' as const,
                      },
                    ],
                    icon: <Scale className="w-3.5 h-3.5" />,
                    isMissing: missingFlags.missingWeight,
                    missingLabel: 'Belum Diisi',
                  },
                  {
                    id: 'harga',
                    label: 'Harga Beli & Modal',
                    shortLabel: 'Harga / KG',
                    sublabel:
                      tobacco.pricePerKgPurchase > 0
                        ? `${formatRupiah(tobacco.pricePerKgPurchase)}/kg`
                        : 'Harga menyusul (Rp 0)',
                    detailRows: [
                      {
                        label: 'Harga Beli / KG',
                        value:
                          tobacco.pricePerKgPurchase > 0
                            ? `${formatRupiah(tobacco.pricePerKgPurchase)}/kg`
                            : 'Belum diisi (Rp 0)',
                        tone: (tobacco.pricePerKgPurchase > 0 ? 'emerald' : 'rose') as
                          | 'emerald'
                          | 'rose',
                      },
                      {
                        label: 'Total Modal Nota',
                        value:
                          m.totalModalAsal > 0
                            ? `${formatRupiah(m.totalModalAsal)} (${m.netWeightKg} kg)`
                            : 'Menyusul',
                        tone: 'amber' as const,
                      },
                      {
                        label: 'Weight Profit',
                        value: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg (${m.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(m.weightProfitRp)})`,
                        tone: (m.weightProfitKg >= 0 ? 'emerald' : 'rose') as
                          | 'emerald'
                          | 'rose',
                      },
                    ],
                    icon: <DollarSign className="w-3.5 h-3.5" />,
                    isMissing: missingFlags.missingPrice,
                    missingLabel: 'Belum Diisi',
                  },
                  {
                    id: 'grade_attr',
                    label: 'Grade & 6 Karakter (/5)',
                    shortLabel: '6 Atribut',
                    sublabel: `Grade ${tobacco.colorGrade} · Pwr ${power5.toFixed(1)} · Arm ${aroma5.toFixed(1)}`,
                    detailRows: [
                      {
                        label: 'Grade Warna',
                        value: `Grade ${tobacco.colorGrade} (${gradeInfo.name})`,
                        tone: 'amber' as const,
                      },
                      {
                        label: 'Power · Impact · Bitter',
                        value: `${power5.toFixed(1)} · ${impact5.toFixed(1)} · ${bitter5.toFixed(1)} /5`,
                        tone: (missingFlags.missingAttributes ? 'rose' : 'emerald') as
                          | 'emerald'
                          | 'rose',
                      },
                      {
                        label: 'Burn · Sugar · Aroma',
                        value: `${burn5.toFixed(1)} · ${sugar5.toFixed(1)} · ${aroma5.toFixed(1)} /5`,
                        tone: (missingFlags.missingAttributes ? 'rose' : 'emerald') as
                          | 'emerald'
                          | 'rose',
                      },
                    ],
                    icon: <Sparkles className="w-3.5 h-3.5" />,
                    isMissing: missingFlags.missingAttributes,
                    missingLabel: 'Belum Diisi',
                  },
                  {
                    id: 'info',
                    label: 'Penjual, Daerah & Kemasan',
                    shortLabel: 'Info & Kms',
                    sublabel:
                      tobacco.sellerName?.trim()
                        ? `${tobacco.sellerName} · ${pkgName}`
                        : `Penjual belum diisi · ${pkgName}`,
                    detailRows: [
                      {
                        label: 'Penjual / Petani',
                        value: tobacco.sellerName?.trim() || 'Belum diisi',
                        tone: (missingFlags.missingSeller ? 'rose' : 'emerald') as
                          | 'emerald'
                          | 'rose',
                      },
                      {
                        label: 'Jenis & Daerah',
                        value: `${tobacco.name} · ${tobacco.origin}`,
                        tone: (missingFlags.missingOrigin ? 'rose' : 'white') as
                          | 'rose'
                          | 'white',
                      },
                      {
                        label: 'Kemasan',
                        value: pkgName,
                        tone: (missingFlags.missingPackaging ? 'rose' : 'amber') as
                          | 'rose'
                          | 'amber',
                      },
                    ],
                    icon: <UserCheck className="w-3.5 h-3.5" />,
                    isMissing:
                      missingFlags.missingSeller ||
                      missingFlags.missingOrigin ||
                      missingFlags.missingPackaging,
                    missingLabel: 'Belum Lengkap',
                  },
                  {
                    id: 'blend',
                    label: 'Masukkan ke Kalkulator Racikan',
                    shortLabel: 'Ke Racikan',
                    sublabel: 'Kirim ke Kalkulator Campuran',
                    detailRows: [
                      {
                        label: 'Stok Tersedia',
                        value: `${tobacco.currentStockNetKg} kg siap diracik`,
                        tone: 'emerald' as const,
                      },
                      {
                        label: 'HPP / KG',
                        value:
                          m.effectivePricePerKgWithFee > 0
                            ? `${formatRupiah(m.effectivePricePerKgWithFee)}/kg`
                            : 'Menyusul',
                        tone: 'amber' as const,
                      },
                    ],
                    actionHint: 'Lepas → Racik',
                    icon: <Calculator className="w-3.5 h-3.5" />,
                    tone: 'emerald' as const,
                  },
                  {
                    id: 'full_edit',
                    label: 'Edit Lengkap (Semua Kolom)',
                    shortLabel: 'Edit Semua',
                    sublabel: 'Buka form lengkap + Lot & Fee',
                    detailRows: [
                      {
                        label: 'Lot & Tanggal',
                        value: `${tobacco.lotNumber || '-'} · ${tobacco.purchaseDate}`,
                        tone: 'white' as const,
                      },
                      {
                        label: 'Kelengkapan Data',
                        value: missingFlags.isIncomplete
                          ? `Kurang: ${missingFlags.missingLabels.join(', ')}`
                          : 'Semua kolom utama sudah terisi',
                        tone: (missingFlags.isIncomplete ? 'rose' : 'emerald') as
                          | 'emerald'
                          | 'rose',
                      },
                    ],
                    icon: <Edit3 className="w-3.5 h-3.5" />,
                  },
                ];

                const handleSelectHoldOption = (optId: string) => {
                  if (optId === 'blend') {
                    onAddToBlend(tobacco);
                    return;
                  }
                  if (optId === 'full_edit') {
                    onEdit(tobacco);
                    return;
                  }
                  if (
                    optId === 'timbangan' ||
                    optId === 'harga' ||
                    optId === 'grade_attr' ||
                    optId === 'info'
                  ) {
                    setQuickEditState({ tobacco, section: optId });
                  }
                };

                const holdHandlers = holdMenu.bindHoldHandlers({
                  id: tobacco.id,
                  title: tobacco.name,
                  subtitle: missingFlags.isIncomplete
                    ? `Belum diisi: ${missingFlags.missingLabels.join(', ')}`
                    : `Grade ${tobacco.colorGrade} · ${tobacco.origin}`,
                  options: buildHoldOptions(),
                  onSelect: handleSelectHoldOption,
                });

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
                    id: 'total-modal',
                    shortTab: 'Modal',
                    label: 'Total Modal / Nilai Inventori',
                    value: formatRupiah(m.totalModalAsal),
                    subValue: `${formatRupiah(m.effectivePricePerKgWithFee)}/kg`,
                    detailLine: `Netto ${m.netWeightKg} kg • Sisa Stok: ${m.currentStockKg} kg`,
                    accent: 'amber' as const,
                  },
                  {
                    id: 'weight-profit-rp',
                    shortTab: 'Profit Rp',
                    label: 'Weight Profit (Rupiah)',
                    value: `${m.weightProfitRp >= 0 ? '+' : ''}${formatRupiah(m.weightProfitRp)}`,
                    subValue: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg`,
                    detailLine: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg × ${formatRupiah(tobacco.pricePerKgPurchase)}/kg`,
                    accent: (m.weightProfitRp >= 0 ? 'emerald' : 'rose') as 'emerald' | 'rose',
                  },
                  {
                    id: 'weight-profit-kg',
                    shortTab: 'Profit KG',
                    label: 'Weight Profit (KG)',
                    value: `${m.weightProfitKg >= 0 ? '+' : ''}${m.weightProfitKg} kg`,
                    subValue: `Riil ${m.realNetKg} kg`,
                    detailLine: `Bruto ${tobacco.grossWeightKg} kg • ${pkgName} (${tobacco.taraFormula.rawFormula})`,
                    accent: 'white' as const,
                  },
                ];

                return (
                  <motion.div
                    key={tobacco.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
                    {...holdHandlers}
                    className={`requiem-card border-2 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-[0_7px_0_0_#18181b,0_14px_26px_rgba(0,0,0,0.9)] hover:shadow-[0_8px_0_0_#f59e0b,0_16px_30px_rgba(245,158,11,0.18)] transition-all duration-200 group min-h-[308px] sm:min-h-[320px] select-none ${
                      isBeingHeld
                        ? 'border-amber-400 scale-[0.985] ring-2 ring-amber-400/70'
                        : missingFlags.isIncomplete
                          ? 'border-amber-500/55 hover:border-amber-400'
                          : 'border-zinc-700/90 hover:border-amber-500/80'
                    }`}
                  >
                    {/* Clickable Area -> Opens Detail Modal (or Hold >= 280ms pops Quick-Edit Menu) */}
                    <div
                      onClick={() => {
                        if (holdMenu.consumeRecentHoldFlag()) return;
                        setSelectedRawDetail(tobacco);
                      }}
                      className="cursor-pointer space-y-2"
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

                      <div>
                        <h3 className="font-extrabold text-white text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-white transition-colors">
                          {tobacco.name}
                        </h3>
                        {tobacco.sellerName && (
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                            Penjual: <b className="text-zinc-200">{tobacco.sellerName}</b>
                          </div>
                        )}
                      </div>

                      {/* Unfilled Marks Strip (Shows clearly which data is still menyusul / empty) */}
                      {missingFlags.isIncomplete && (
                        <div className="flex items-center gap-1 flex-wrap" data-no-card-hold="true">
                          {missingFlags.missingWeight && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickEditState({ tobacco, section: 'timbangan' });
                              }}
                              className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-dashed border-amber-500/70 text-[9px] font-black text-amber-300 cursor-pointer"
                            >
                              ⏳ Timbangan
                            </button>
                          )}
                          {missingFlags.missingPrice && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickEditState({ tobacco, section: 'harga' });
                              }}
                              className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-dashed border-amber-500/70 text-[9px] font-black text-amber-300 cursor-pointer"
                            >
                              ⏳ Harga
                            </button>
                          )}
                          {missingFlags.missingAttributes && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickEditState({ tobacco, section: 'grade_attr' });
                              }}
                              className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/25 border border-dashed border-amber-500/50 text-[9px] font-bold text-amber-200 cursor-pointer"
                            >
                              ⏳ Atribut
                            </button>
                          )}
                          {(missingFlags.missingSeller || missingFlags.missingPackaging) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickEditState({ tobacco, section: 'info' });
                              }}
                              className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-600 text-[9px] font-bold text-zinc-300 cursor-pointer"
                            >
                              ⏳ {missingFlags.missingSeller ? 'Penjual' : 'Kemasan'}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Permanent Summary Box with 3 Key Metrics: Total Modal, Weight Profit (Rp), Weight Profit (KG) */}
                      <div className="bg-zinc-950/95 border border-zinc-800/90 rounded-xl px-2.5 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase text-amber-400">
                            Total Modal ({m.netWeightKg} kg)
                          </span>
                          <span className="font-mono font-black text-[11px] sm:text-xs text-amber-400 whitespace-nowrap">
                            {missingFlags.missingPrice ? 'Menyusul' : formatRupiah(m.totalModalAsal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                          <span className="text-[9px] font-bold uppercase text-zinc-300">
                            Weight Profit (Rp)
                          </span>
                          <span className="font-mono font-black text-[11px] text-white whitespace-nowrap">
                            {m.weightProfitRp >= 0 ? '+' : ''}
                            {formatRupiah(m.weightProfitRp)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                          <span className="text-[9px] font-bold uppercase text-zinc-400">
                            Weight Profit (KG)
                          </span>
                          <span className="font-mono font-bold text-[10px] text-amber-300 whitespace-nowrap">
                            {m.weightProfitKg >= 0 ? '+' : ''}
                            {m.weightProfitKg} kg{' '}
                            <span className="text-zinc-400">
                              (Sisa: {m.currentStockKg} kg)
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Moving Panel with All 6 Character Parameters (/5) & Clear Breakdown */}
                      <SpinningStatTicker items={tickerItems} intervalMs={3200 + (idx % 3) * 350} />
                    </div>

                    {/* Minimalist Compact Card Footer with Quick Hold/Edit Menu Trigger */}
                    <div
                      className="mt-3 pt-2.5 border-t border-zinc-900 flex items-center justify-between gap-1.5"
                      data-no-card-hold="true"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          holdMenu.openMenuImmediate({
                            anchorEl: e.currentTarget,
                            title: tobacco.name,
                            subtitle: missingFlags.isIncomplete
                              ? `Belum diisi: ${missingFlags.missingLabels.join(', ')}`
                              : `Grade ${tobacco.colorGrade} · ${tobacco.origin}`,
                            options: buildHoldOptions(),
                            onSelect: handleSelectHoldOption,
                          });
                        }}
                        aria-label={`Edit Cepat ${tobacco.name}`}
                        className={`h-8 px-2.5 rounded-lg border text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                          missingFlags.isIncomplete
                            ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/60'
                            : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 border-zinc-800'
                        }`}
                      >
                        <Hand className="w-3 h-3 shrink-0" />
                        <span>{missingFlags.isIncomplete ? `Lengkapi (${missingFlags.missingCount})` : 'Menu Edit'}</span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Hapus ${tobacco.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(tobacco.id);
                          }}
                          className="group/del relative h-8 w-8 shrink-0 rounded-lg bg-black hover:bg-red-950/70 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/70 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="pointer-events-none opacity-0 group-hover/del:opacity-100 transition-opacity duration-150 absolute -top-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-red-500/70 text-red-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                            Hapus Tembakau
                          </span>
                        </button>

                        <button
                          type="button"
                          aria-label="Masukkan ke Kalkulator Racikan"
                          onClick={() => onAddToBlend(tobacco)}
                          className="group/btn relative btn-amber-outline h-8 w-8 shrink-0 rounded-lg font-black text-xs flex items-center justify-center cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                          <span className="pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity duration-150 absolute -top-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500/70 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                            Campur ke Racikan
                          </span>
                        </button>
                      </div>
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

                      <div className="flex items-start gap-2 shrink-0">
                        <div className="text-right font-mono text-xs shrink-0">
                          <div className="text-amber-400 font-black">
                            Netto: {item.factoryNetBillableKg} kg
                          </div>
                          <span className="text-[10px] text-zinc-400 underline">Detail →</span>
                        </div>
                        {onDeleteFinished && (
                          <button
                            type="button"
                            aria-label={`Hapus Seri Reject ${item.serialNumber}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteFinished(item.id);
                            }}
                            className="group/del relative h-8 w-8 shrink-0 rounded-lg bg-black hover:bg-red-950/70 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/70 flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="pointer-events-none opacity-0 group-hover/del:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-red-500/70 text-red-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                              Hapus Seri {item.serialNumber}
                            </span>
                          </button>
                        )}
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

                    {/* 3 Useful Metrics Breakdown: 1. Total Modal / Nilai Inventori | 2. Weight Profit (Rp) | 3. Weight Profit (KG) */}
                    <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-1.5 text-zinc-400">
                        <span>
                          Kemasan: <b className="text-white">{t.taraFormula.packagingType || 'Standar'}</b> • Sisa Stok:{' '}
                          <b className="text-amber-400 font-mono">
                            {m.currentStockKg} kg
                          </b>
                        </span>
                        <CalcSymbolBadge />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-900 items-stretch">
                        <button
                          type="button"
                          onClick={() =>
                            setCalcDetail(
                              buildRawTobaccoCalcDetail({
                                name: t.name,
                                packagingType: t.taraFormula.packagingType || 'Standar',
                                grossWeightKg: t.grossWeightKg,
                                realPackagingMassKg: m.realPkgMassKg,
                                percentTara: t.taraFormula.percent,
                                flatKgTara: t.taraFormula.flatKg,
                                pricePerKg: t.pricePerKgPurchase,
                                agentFees: t.agentFees,
                                additionalCost: t.additionalPurchaseCost || 0,
                                focus: 'PAID_VALUE',
                              })
                            )
                          }
                          className="text-left group bg-zinc-950 p-3 rounded-lg border border-amber-500/40 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-amber-400 font-black uppercase block truncate">
                                1. Total Modal / Inventori
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono font-black text-amber-400 text-sm">
                              {formatRupiah(m.totalModalAsal)}
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            {m.netWeightKg} kg × {formatRupiah(m.effectivePricePerKgWithFee)}/kg
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
                                realPackagingMassKg: m.realPkgMassKg,
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
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-zinc-200 font-bold uppercase block truncate">
                                2. Weight Profit (Rp)
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono font-black text-white text-sm">
                              {m.weightProfitRp >= 0 ? '+' : ''}
                              {formatRupiah(m.weightProfitRp)}
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            {m.weightProfitKg >= 0 ? '+' : ''}
                            {m.weightProfitKg} kg × {formatRupiah(t.pricePerKgPurchase)}
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
                                realPackagingMassKg: m.realPkgMassKg,
                                percentTara: t.taraFormula.percent,
                                flatKgTara: t.taraFormula.flatKg,
                                pricePerKg: t.pricePerKgPurchase,
                                agentFees: t.agentFees,
                                additionalCost: t.additionalPurchaseCost || 0,
                                focus: 'WEIGHT_PROFIT',
                              })
                            )
                          }
                          className="text-left group bg-zinc-950 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1.5"
                        >
                          <div className="space-y-1 w-full">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] text-zinc-300 font-bold uppercase block truncate">
                                3. Weight Profit (KG)
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="font-mono font-black text-amber-300 text-sm">
                              {m.weightProfitKg >= 0 ? '+' : ''}
                              {m.weightProfitKg} kg
                            </div>
                          </div>
                          <div className="pt-1.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-400">
                            Riil {m.realNetKg} kg − Nota {m.netWeightKg} kg
                          </div>
                        </button>
                      </div>
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
                        aria-label="Edit Data Tembakau"
                        className="group relative h-9 w-9 shrink-0 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 flex items-center justify-center cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4 text-zinc-200 shrink-0" />
                        <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-8 left-0 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                          Edit Barang
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(t.id);
                          setSelectedRawDetail(null);
                        }}
                        aria-label="Hapus Data Tembakau"
                        className="group relative h-9 w-9 shrink-0 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-8 left-0 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                          Hapus Barang
                        </span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAddToBlend(t);
                        setSelectedRawDetail(null);
                      }}
                      aria-label="Campur ke Racikan"
                      className="group relative btn-amber-outline h-9 w-9 shrink-0 rounded-xl font-black text-xs flex items-center justify-center cursor-pointer"
                    >
                      <Scale className="w-4 h-4 shrink-0" />
                      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500/70 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                        Campur ke Racikan
                      </span>
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

      <HoldQuickMenuOverlay
        menu={holdMenu.activeMenu}
        hoveredOptionId={holdMenu.hoveredOptionId}
        onSelectOption={holdMenu.selectOption}
        onClose={holdMenu.closeMenu}
      />

      <RawQuickEditModal
        tobacco={quickEditState?.tobacco || null}
        initialSection={quickEditState?.section || 'timbangan'}
        packagingList={packagingList}
        onClose={() => setQuickEditState(null)}
        onSave={(updated) => {
          if (onQuickUpdate) {
            onQuickUpdate(updated);
          } else {
            onEdit(updated);
          }
          setQuickEditState(null);
        }}
      />
    </div>
  );
};
