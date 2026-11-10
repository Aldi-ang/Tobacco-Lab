import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  History,
  FileSpreadsheet,
  Search,
  Scroll,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
  Copy,
  Check,
  Download,
  Package,
  Eye,
  EyeOff,
  Pencil,
  BarChart3,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import {
  FactoryMaster,
  FinishedTobaccoSerial,
  PackagingMaster,
  RawTobacco,
  TobaccoRollSample,
} from '../types/tobacco';
import {
  formatRupiah,
  formatSheetRp,
  formatSerialLineage,
  hasSerialLineage,
  buildGoogleSheetText,
  GRADE_LABELS,
} from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
} from './CalculationDetailModal';
import { EditFinishedSerialModal } from './EditFinishedSerialModal';

interface HistoryViewProps {
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos?: RawTobacco[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
  onUpdateSerial?: (updated: FinishedTobaccoSerial) => void;
  onOpenGoogleSheetsModal: () => void;
  onGoToRejectedStock?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  rollSamples,
  finishedBatches,
  packagingList = [],
  factoryList = [],
  onUpdateSerial,
  onOpenGoogleSheetsModal,
  onGoToRejectedStock,
}) => {
  const [activeSegment, setActiveSegment] = useState<'nota-history' | 'seri-status'>(
    'nota-history'
  );
  const [editingSerial, setEditingSerial] = useState<FinishedTobaccoSerial | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    | 'ALL'
    | 'ACCEPTED_CAIR'
    | 'PAID_CAIR'
    | 'UNPAID_BELUM_CAIR'
    | 'PENDING'
    | 'REJECTED_STOCK'
    | 'RENAMED_LINEAGE'
  >('ALL');
  const [factoryFilter, setFactoryFilter] = useState<string>('ALL');
  const [expandedNotaRollIds, setExpandedNotaRollIds] = useState<Record<string, boolean>>(() => {
    const firstId = rollSamples[0]?.id;
    return firstId ? { [firstId]: true } : {};
  });
  const [notaSheetModeMap, setNotaSheetModeMap] = useState<
    Record<string, 'INTERNAL_COST' | 'FACTORY_NOTA'>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);
  const [showProfitChart, setShowProfitChart] = useState<boolean>(true);

  const factories = [
    'ALL',
    ...Array.from(
      new Set([
        ...rollSamples.map((r) => r.targetFactory),
        ...finishedBatches.map((b) => b.targetFactory),
      ])
    ),
  ];

  const activeFactoryLabel =
    factoryFilter === 'ALL' ? 'Semua Pabrik' : factoryFilter;

  const q = searchTerm.trim().toLowerCase();

  // Filter rolls & serials for top KPI cards based on factoryFilter and searchTerm ("sort menu bottom")
  const kpiRolls = rollSamples.filter((r) => {
    if (factoryFilter !== 'ALL' && r.targetFactory !== factoryFilter) return false;
    if (!q) return true;
    const serialsInRoll = finishedBatches.filter(
      (b) => b.rollId === r.id || (!b.rollId && b.rollNumber === r.rollNumber)
    );
    return (
      r.rollNumber.toLowerCase().includes(q) ||
      r.recipeName.toLowerCase().includes(q) ||
      r.targetFactory.toLowerCase().includes(q) ||
      serialsInRoll.some(
        (s) =>
          s.serialNumber.toLowerCase().includes(q) ||
          formatSerialLineage(s).toLowerCase().includes(q)
      )
    );
  });

  const kpiBatches = finishedBatches.filter((b) => {
    const parentRoll = rollSamples.find(
      (r) => r.id === b.rollId || (!b.rollId && r.rollNumber === b.rollNumber)
    );
    const effectiveFactory = b.targetFactory || parentRoll?.targetFactory || '';
    const matchesCurrentFactory =
      factoryFilter === 'ALL' ||
      effectiveFactory === factoryFilter ||
      b.previousFactory === factoryFilter;
    if (!matchesCurrentFactory) return false;
    if (!q) return true;
    return (
      b.serialNumber.toLowerCase().includes(q) ||
      formatSerialLineage(b).toLowerCase().includes(q) ||
      b.recipeName.toLowerCase().includes(q) ||
      effectiveFactory.toLowerCase().includes(q) ||
      (b.rollNumber || '').toLowerCase().includes(q) ||
      (b.previousRollNumber || '').toLowerCase().includes(q)
    );
  });

  // Aggregate dynamic KPI metrics following the selected factory & search filter
  const cairBatches = kpiBatches.filter(
    (b) =>
      b.factoryStatus === 'ACCEPTED_CAIR' &&
      (factoryFilter === 'ALL' || b.targetFactory === factoryFilter)
  );
  const paidAcceptedBatches = cairBatches.filter((b) => b.paymentStatus === 'CAIR');
  const unpaidAcceptedBatches = cairBatches.filter((b) => b.paymentStatus !== 'CAIR');

  const pendingBatches = kpiBatches.filter(
    (b) =>
      (b.factoryStatus || 'PENDING') === 'PENDING' &&
      (factoryFilter === 'ALL' || b.targetFactory === factoryFilter)
  );
  const rejectedBatches = kpiBatches.filter(
    (b) =>
      b.factoryStatus === 'REJECTED_STOCK' &&
      (factoryFilter === 'ALL' ||
        b.targetFactory === factoryFilter ||
        b.previousFactory === factoryFilter)
  );
  const renamedBatches = kpiBatches.filter(
    (b) => hasSerialLineage(b) || (b.transferHistory && b.transferHistory.length > 0)
  );

  // Billable serials for the selected factory (excludes serials that were only rejected from another factory)
  const billableKpiBatches = kpiBatches.filter(
    (b) => factoryFilter === 'ALL' || b.targetFactory === factoryFilter
  );

  const getSerialNotaRp = (s: FinishedTobaccoSerial) => {
    const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
    return Math.round(netto * (s.factoryTargetPricePerKg || 0));
  };

  const getSerialModalRp = (s: FinishedTobaccoSerial) => {
    const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
    const modalKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg || 0);
    return Math.round(s.totalProductionCost || netto * modalKg);
  };

  const totalAllNotaRp = billableKpiBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalCairRp = cairBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalPaidCairRp = paidAcceptedBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalUnpaidAcceptedRp = unpaidAcceptedBatches.reduce(
    (sum, s) => sum + getSerialNotaRp(s),
    0
  );
  const totalPendingRp = pendingBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalProfitRp = billableKpiBatches.reduce(
    (sum, s) => sum + (getSerialNotaRp(s) - getSerialModalRp(s)),
    0
  );

  const openHistoryKpiCalc = (
    focus: 'TOTAL_NOTA' | 'CAIR_VALUE' | 'PENDING_VALUE' | 'TOTAL_PROFIT'
  ) => {
    if (focus === 'TOTAL_NOTA') {
      setCalcDetail({
        title: `1. Total Nilai Nota — ${activeFactoryLabel} (${billableKpiBatches.length} Seri)`,
        subtitle: `Dari ${kpiRolls.length} Gulungan (${activeFactoryLabel})`,
        badgeText: 'RIWAYAT NOTA • RUMUS TOTAL TAGIHAN NOTA',
        coreFormula: 'Total Tagihan Nota = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
        appliedFormula: `Total Tagihan Nota (${billableKpiBatches.length} Seri • ${activeFactoryLabel}) = ${formatRupiah(totalAllNotaRp)}`,
        steps: [
          {
            stepNumber: 1,
            title: 'Total Tagihan Nota',
            formula: 'Total Tagihan Nota = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
            substitution: `${billableKpiBatches.length} Seri (${kpiRolls.length} Gulungan • ${activeFactoryLabel}) = ${formatRupiah(totalAllNotaRp)}`,
            resultLabel: 'Total Tagihan Nota',
            resultValue: formatRupiah(totalAllNotaRp),
            explanation: `Total nilai nota dari ${billableKpiBatches.length} Nomor Seri untuk ${activeFactoryLabel}.`,
            highlight: 'amber',
          },
          ...billableKpiBatches.map((s, idx) => {
            const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
            const nota = getSerialNotaRp(s);
            return {
              stepNumber: idx + 2,
              title: `Seri ${formatSerialLineage(s)}`,
              formula: `Jumlah Nota = (Bruto − Tara) × Harga Pabrik`,
              substitution: `(${s.packaging.grossWeightPerPackage} kg − ${s.factoryDeductionKg} kg) × ${formatRupiah(s.factoryTargetPricePerKg)} = ${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
              resultLabel: `Seri ${formatSerialLineage(s)}`,
              resultValue: formatRupiah(nota),
              explanation: `Gulungan ${s.rollNumber || '-'} • Pabrik ${s.targetFactory} (${netto} kg).`,
              highlight: 'white' as const,
            };
          }),
        ],
        conclusion: `Total Tagihan Nota (${activeFactoryLabel}) = ${formatRupiah(totalAllNotaRp)}.`,
      });
      return;
    }

    if (focus === 'CAIR_VALUE') {
      setCalcDetail({
        title: `2. Total Nilai Diterima / Accepted — ${activeFactoryLabel} (${cairBatches.length} Seri)`,
        subtitle: `Total Nota Seri yang Diterima Pabrik (Cair: ${formatRupiah(totalPaidCairRp)} • Belum Cair: ${formatRupiah(totalUnpaidAcceptedRp)})`,
        badgeText: 'RIWAYAT DITERIMA / ACCEPTED • CAIR VS BELUM CAIR',
        coreFormula: 'Total Diterima = Σ (Netto Tagih × Harga Pabrik) untuk Seri DITERIMA / ACCEPTED',
        appliedFormula: `Total Diterima (${cairBatches.length} Seri) = ${formatRupiah(totalCairRp)} (Cair: ${formatRupiah(totalPaidCairRp)} + Belum Cair: ${formatRupiah(totalUnpaidAcceptedRp)})`,
        steps: [
          {
            stepNumber: 1,
            title: 'Total Nilai Diterima / Accepted',
            formula: 'Total Diterima = Σ Nota Seri berstatus DITERIMA / ACCEPTED',
            substitution: `${cairBatches.length} Seri DITERIMA (${activeFactoryLabel}) = ${formatRupiah(totalCairRp)}`,
            resultLabel: 'Total Diterima / Accepted',
            resultValue: formatRupiah(totalCairRp),
            explanation: `Terdiri dari ${paidAcceptedBatches.length} Seri Sudah Cair (${formatRupiah(totalPaidCairRp)}) dan ${unpaidAcceptedBatches.length} Seri Belum Cair (${formatRupiah(totalUnpaidAcceptedRp)}).`,
            highlight: 'amber',
          },
          ...cairBatches.map((s, idx) => {
            const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
            const nota = getSerialNotaRp(s);
            const payLabel = s.paymentStatus === 'CAIR' ? 'CAIR (Paid)' : 'BELUM CAIR (Not Paid)';
            return {
              stepNumber: idx + 2,
              title: `Seri ${formatSerialLineage(s)} (${payLabel})`,
              formula: `Nilai Diterima = Netto Tagih × Harga Pabrik`,
              substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
              resultLabel: `Seri ${formatSerialLineage(s)}`,
              resultValue: formatRupiah(nota),
              explanation: `Gulungan ${s.rollNumber || '-'} • Pabrik ${s.targetFactory} • Status Bayar: ${payLabel}.`,
              highlight: 'white' as const,
            };
          }),
        ],
        conclusion: `Total Diterima / Accepted (${activeFactoryLabel}) = ${formatRupiah(totalCairRp)} (Sudah Cair: ${formatRupiah(totalPaidCairRp)} | Belum Cair: ${formatRupiah(totalUnpaidAcceptedRp)}).`,
      });
      return;
    }

    if (focus === 'PENDING_VALUE') {
      setCalcDetail({
        title: `3. Nilai Menunggu Pabrik — ${activeFactoryLabel} (${pendingBatches.length} Seri)`,
        subtitle: `Tagihan Seri yang Sedang Diperiksa Pabrik (${activeFactoryLabel})`,
        badgeText: 'RIWAYAT PENDING • RUMUS MENUNGGU PABRIK',
        coreFormula: 'Total Menunggu Pabrik = Σ (Netto Tagih × Harga Pabrik) untuk Seri MENUNGGU PABRIK',
        appliedFormula: `Total Menunggu Pabrik (${pendingBatches.length} Seri • ${activeFactoryLabel}) = ${formatRupiah(totalPendingRp)}`,
        steps: [
          {
            stepNumber: 1,
            title: 'Total Menunggu Pabrik',
            formula: 'Total Menunggu Pabrik = Σ Nota Seri berstatus MENUNGGU PABRIK',
            substitution: `${pendingBatches.length} Seri (${activeFactoryLabel}) = ${formatRupiah(totalPendingRp)}`,
            resultLabel: 'Total Menunggu Pabrik',
            resultValue: formatRupiah(totalPendingRp),
            explanation: `Total tagihan dari ${pendingBatches.length} Nomor Seri yang sedang menunggu keputusan pabrik (${activeFactoryLabel}).`,
            highlight: 'amber',
          },
          ...pendingBatches.map((s, idx) => {
            const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
            const nota = getSerialNotaRp(s);
            return {
              stepNumber: idx + 2,
              title: `Seri ${formatSerialLineage(s)}`,
              formula: `Nilai Pending = Netto Tagih × Harga Pabrik`,
              substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
              resultLabel: `Seri ${formatSerialLineage(s)}`,
              resultValue: formatRupiah(nota),
              explanation: `Gulungan ${s.rollNumber || '-'} • Pabrik ${s.targetFactory}.`,
              highlight: 'white' as const,
            };
          }),
        ],
        conclusion: `Total Menunggu Pabrik (${activeFactoryLabel}) = ${formatRupiah(totalPendingRp)}.`,
      });
      return;
    }

    // TOTAL_PROFIT
    const totalAllModalRp = billableKpiBatches.reduce((acc, s) => acc + getSerialModalRp(s), 0);
    setCalcDetail({
      title: `4. Total Profit Bersih — ${activeFactoryLabel} (${billableKpiBatches.length} Seri)`,
      subtitle: `Selisih Total Tagihan Nota dikurangi Total Modal Produksi (${activeFactoryLabel})`,
      badgeText: 'RIWAYAT PROFIT • RUMUS PROFIT BERSIH',
      coreFormula: 'Total Profit = Total Tagihan Nota − Total Modal Produksi',
      appliedFormula: `Total Profit (${activeFactoryLabel}) = ${formatRupiah(totalAllNotaRp)} − ${formatRupiah(totalAllModalRp)} = ${totalProfitRp >= 0 ? '+' : ''}${formatRupiah(totalProfitRp)}`,
      steps: [
        {
          stepNumber: 1,
          title: 'Total Tagihan Nota',
          formula: 'Total Tagihan Nota = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
          substitution: `${billableKpiBatches.length} Seri (${activeFactoryLabel}) = ${formatRupiah(totalAllNotaRp)}`,
          resultLabel: 'Total Tagihan Nota',
          resultValue: formatRupiah(totalAllNotaRp),
          explanation: `Total nilai tagihan nota dari ${billableKpiBatches.length} Nomor Seri (${activeFactoryLabel}).`,
          highlight: 'white',
        },
        {
          stepNumber: 2,
          title: 'Total Modal Produksi',
          formula: 'Total Modal Produksi = Σ (Netto Tagih Seri × Harga Modal / KG)',
          substitution: `${billableKpiBatches.length} Seri (${activeFactoryLabel}) = ${formatRupiah(totalAllModalRp)}`,
          resultLabel: 'Total Modal Produksi',
          resultValue: formatRupiah(totalAllModalRp),
          explanation: `Total modal produksi dari ${billableKpiBatches.length} Nomor Seri (${activeFactoryLabel}).`,
          highlight: 'white',
        },
        {
          stepNumber: 3,
          title: 'Total Profit',
          formula: 'Total Profit = Total Tagihan Nota − Total Modal Produksi',
          substitution: `${formatRupiah(totalAllNotaRp)} − ${formatRupiah(totalAllModalRp)} = ${totalProfitRp >= 0 ? '+' : ''}${formatRupiah(totalProfitRp)}`,
          resultLabel: 'Total Profit',
          resultValue: `${totalProfitRp >= 0 ? '+' : ''}${formatRupiah(totalProfitRp)}`,
          explanation: `Total keuntungan bersih dari ${activeFactoryLabel}.`,
          highlight: totalProfitRp >= 0 ? 'amber' : 'red',
        },
        ...billableKpiBatches.map((s, idx) => {
          const nota = getSerialNotaRp(s);
          const modal = getSerialModalRp(s);
          const profit = nota - modal;
          return {
            stepNumber: idx + 4,
            title: `Seri ${formatSerialLineage(s)}`,
            formula: `Profit Seri = Jumlah Nota Pabrik − Jumlah Modal Kita`,
            substitution: `${formatRupiah(nota)} − ${formatRupiah(modal)} = ${profit >= 0 ? '+' : ''}${formatRupiah(profit)}`,
            resultLabel: `Seri ${formatSerialLineage(s)}`,
            resultValue: `${profit >= 0 ? '+' : ''}${formatRupiah(profit)}`,
            explanation: `Gulungan ${s.rollNumber || '-'} • Pabrik ${s.targetFactory}.`,
            highlight: (profit >= 0 ? 'amber' : 'red') as 'amber' | 'red',
          };
        }),
      ],
      conclusion: `Total Profit (${activeFactoryLabel}) = ${formatRupiah(totalAllNotaRp)} − ${formatRupiah(totalAllModalRp)} = ${totalProfitRp >= 0 ? '+' : ''}${formatRupiah(totalProfitRp)}.`,
    });
  };

  const handleCopyRollNota = (
    roll: TobaccoRollSample,
    serials: FinishedTobaccoSerial[],
    mode: 'INTERNAL_COST' | 'FACTORY_NOTA'
  ) => {
    const formattedDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const tsv = buildGoogleSheetText({
      dateLabel: formattedDate,
      headerTitle: roll.recipeName || roll.targetFactory,
      serials,
      mode,
      separator: '\t',
    });
    navigator.clipboard.writeText(tsv);
    const key = `${roll.id}-${mode}`;
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadRollCsv = (
    roll: TobaccoRollSample,
    serials: FinishedTobaccoSerial[],
    mode: 'INTERNAL_COST' | 'FACTORY_NOTA'
  ) => {
    const formattedDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const csv = buildGoogleSheetText({
      dateLabel: formattedDate,
      headerTitle: roll.recipeName || roll.targetFactory,
      serials,
      mode,
      separator: ',',
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${roll.rollNumber}_${mode === 'INTERNAL_COST' ? 'RIWAYAT_ARSIP_PERSONAL' : 'RIWAYAT_NOTA_PABRIK'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Filtered Rolls for Segment 1
  const filteredRolls = rollSamples.filter((roll) => {
    const matchFactory = factoryFilter === 'ALL' || roll.targetFactory === factoryFilter;
    const allRelatedSerials = finishedBatches.filter(
      (b) =>
        b.rollId === roll.id ||
        b.rollNumber === roll.rollNumber ||
        b.previousRollId === roll.id ||
        (b.previousRollNumber && b.previousRollNumber.includes(roll.rollNumber))
    );
    const serialText = allRelatedSerials.map((s) => formatSerialLineage(s)).join(' ');
    const matchSearch =
      !searchTerm.trim() ||
      roll.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.recipeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.targetFactory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serialText.toLowerCase().includes(searchTerm.toLowerCase());
    return matchFactory && matchSearch;
  });

  // Filtered Serials for Segment 2
  const filteredSerials = finishedBatches.filter((b) => {
    const st = b.factoryStatus || 'PENDING';
    const matchStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'RENAMED_LINEAGE'
          ? hasSerialLineage(b) || (b.transferHistory && b.transferHistory.length > 0)
          : statusFilter === 'PAID_CAIR'
            ? st === 'ACCEPTED_CAIR' && b.paymentStatus === 'CAIR'
            : statusFilter === 'UNPAID_BELUM_CAIR'
              ? st === 'ACCEPTED_CAIR' && b.paymentStatus !== 'CAIR'
              : st === statusFilter;
    const matchFactory =
      factoryFilter === 'ALL' ||
      b.targetFactory === factoryFilter ||
      b.previousFactory === factoryFilter;
    const lineage = formatSerialLineage(b);
    const matchSearch =
      !searchTerm.trim() ||
      b.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lineage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.rollNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.previousRollNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.targetFactory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.previousFactory || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchFactory && matchSearch;
  });

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {/* Top Segment Switcher + Google Sheets Action + 4 KPI Summary Cards */}
      <div className="requiem-card p-3 sm:p-4 rounded-2xl border border-zinc-800/90 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex-1 min-w-0">
            <SegmentedControl
              value={activeSegment}
              onChange={setActiveSegment}
              options={[
                {
                  id: 'nota-history',
                  label: '1. Riwayat Nota Gulungan',
                  fullLabel: '1. Riwayat Nota Gulungan yang Dikirim ke Pabrik',
                  icon: <Scroll className="w-3.5 h-3.5" />,
                  badge: kpiRolls.length,
                },
                {
                  id: 'seri-status',
                  label: '2. Data Status Semua Seri',
                  fullLabel: '2. Data Status Semua Seri & Riwayat Ganti Seri (AK 1 -> AL 1)',
                  icon: <History className="w-3.5 h-3.5" />,
                  badge: kpiBatches.length,
                },
              ]}
            />
          </div>

          <button
            type="button"
            onClick={onOpenGoogleSheetsModal}
            className="btn-amber-outline h-10 px-4 rounded-xl font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>Transfer ke Google Sheets</span>
          </button>
        </div>

        {/* Active Factory Filter Indicator if filtered */}
        {factoryFilter !== 'ALL' && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-950 border border-amber-500/50 text-xs">
            <span className="text-zinc-300">
              Menampilkan khusus Pabrik: <b className="text-amber-400">{factoryFilter}</b>
            </span>
            <button
              type="button"
              onClick={() => setFactoryFilter('ALL')}
              className="text-amber-400 hover:underline font-bold cursor-pointer"
            >
              Tampilkan Semua Pabrik
            </button>
          </div>
        )}

        {/* 4 Summary KPI Panels with ƒx Symbol Badges (Follows Selected Factory!) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-800/90">
          <button
            type="button"
            onClick={() => openHistoryKpiCalc('TOTAL_NOTA')}
            className="text-left bg-black p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 truncate">
                1. Total Nilai Nota ({kpiRolls.length} Gulungan)
              </span>
              <CalcSymbolBadge />
            </div>
            <div className="font-mono font-black text-white text-sm sm:text-base">
              {formatRupiah(totalAllNotaRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              {billableKpiBatches.length} Seri Aktif • {activeFactoryLabel}
            </div>
          </button>

          <button
            type="button"
            onClick={() => openHistoryKpiCalc('CAIR_VALUE')}
            className="text-left bg-black p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase text-amber-300 truncate">
                2. Diterima / Accepted ({cairBatches.length} Seri)
              </span>
              <CalcSymbolBadge />
            </div>
            <div className="font-mono font-black text-amber-400 text-sm sm:text-base">
              {formatRupiah(totalCairRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              Cair: <b className="text-amber-300">{paidAcceptedBatches.length}</b> • Belum Cair:{' '}
              <b className="text-white">{unpaidAcceptedBatches.length}</b> • Reject:{' '}
              <b className="text-red-400">{rejectedBatches.length}</b>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openHistoryKpiCalc('PENDING_VALUE')}
            className="text-left bg-black p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-300 truncate">
                3. Nilai Menunggu Pabrik
              </span>
              <CalcSymbolBadge />
            </div>
            <div className="font-mono font-black text-white text-sm sm:text-base">
              {formatRupiah(totalPendingRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              {pendingBatches.length} Seri Menunggu Pabrik • {renamedBatches.length} Seri Ganti/Pindah
            </div>
          </button>

          <button
            type="button"
            onClick={() => openHistoryKpiCalc('TOTAL_PROFIT')}
            className="text-left bg-black p-3 rounded-xl border border-amber-500/80 hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-black uppercase text-amber-400 truncate">
                4. Total Profit Bersih
              </span>
              <CalcSymbolBadge />
            </div>
            <div
              className={`font-mono font-black text-sm sm:text-base ${
                totalProfitRp >= 0 ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              {totalProfitRp >= 0 ? '+' : ''}
              {formatRupiah(totalProfitRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              Σ (Nota − Modal) • {activeFactoryLabel}
            </div>
          </button>
        </div>

        {/* Interactive Visual Graph: Total Semua Gulungan & Per Pabrik (Replaces Per-Gulungan Graph) */}
        <div className="pt-2.5 border-t border-zinc-800/90 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>Grafik Total Semua Gulungan &amp; Per Pabrik</span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Perbandingan Pendapatan (Nota), Modal, Profit Bersih &amp; Reject untuk <b className="text-amber-400">Total Semua Gulungan</b> &amp; <b className="text-white">Per Pabrik Tujuan</b>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowProfitChart((prev) => !prev)}
              className="h-8 px-3 rounded-lg bg-black hover:bg-zinc-900 text-amber-400 border border-zinc-700 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              {showProfitChart ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showProfitChart ? 'Sembunyikan Grafik' : 'Tampilkan Grafik'}</span>
            </button>
          </div>

          {showProfitChart && (
            <div className="bg-black p-3.5 sm:p-4 rounded-xl border border-zinc-800 space-y-3">
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-900 text-[11px]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 font-bold text-zinc-200">
                    <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
                    Pendapatan (Nota Pabrik)
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-zinc-300">
                    <span className="w-3 h-3 rounded-xs bg-zinc-500 inline-block" />
                    Modal Produksi
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-amber-400">
                    <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block" />
                    Profit Bersih
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-red-400">
                    <span className="w-3 h-3 rounded-xs bg-red-500 inline-block" />
                    Nilai Reject / Loss
                  </span>
                </div>
                <span className="font-mono text-[10px] text-zinc-400">
                  Margin Total:{' '}
                  <b className="text-amber-400">
                    {totalAllNotaRp > 0
                      ? `${((totalProfitRp / totalAllNotaRp) * 100).toFixed(1)}%`
                      : '0%'}
                  </b>
                </span>
              </div>

              {/* Total Gulungan & Per Pabrik Bar Comparison */}
              {(() => {
                // Build Per-Pabrik groups + 1 "TOTAL SEMUA GULUNGAN" summary card
                const factoryNamesList = Array.from(
                  new Set([
                    ...rollSamples.map((r) => r.targetFactory),
                    ...finishedBatches.map((b) => b.targetFactory),
                  ])
                ).filter(Boolean);

                const perFactoryMetrics = factoryNamesList
                  .filter((fac) => factoryFilter === 'ALL' || fac === factoryFilter)
                  .map((facName) => {
                    const facRolls = rollSamples.filter((r) => r.targetFactory === facName);
                    const facActiveSerials = finishedBatches.filter(
                      (b) => b.targetFactory === facName && b.factoryStatus !== 'REJECTED_STOCK'
                    );
                    const facAllCurrentSerials = finishedBatches.filter(
                      (b) => b.targetFactory === facName
                    );
                    const facRejectedSerials = finishedBatches.filter(
                      (b) =>
                        (b.targetFactory === facName && b.factoryStatus === 'REJECTED_STOCK') ||
                        (b.previousFactory === facName && b.targetFactory !== facName)
                    );

                    const notaRp = facAllCurrentSerials.reduce(
                      (sum, s) => sum + getSerialNotaRp(s),
                      0
                    );
                    const modalRp = facAllCurrentSerials.reduce(
                      (sum, s) => sum + getSerialModalRp(s),
                      0
                    );
                    const profitRp = notaRp - modalRp;
                    const acceptedSerials = facAllCurrentSerials.filter(
                      (s) => s.factoryStatus === 'ACCEPTED_CAIR'
                    );
                    const acceptedRp = acceptedSerials.reduce(
                      (sum, s) => sum + getSerialNotaRp(s),
                      0
                    );
                    const rejectRp = facRejectedSerials.reduce(
                      (sum, s) => sum + getSerialNotaRp(s),
                      0
                    );
                    const marginPct =
                      notaRp > 0 ? Number(((profitRp / notaRp) * 100).toFixed(1)) : 0;

                    return {
                      id: `FACTORY_${facName}`,
                      isTotal: false,
                      title: facName,
                      subtitle: `${facRolls.length} Gulungan • ${facActiveSerials.length} Seri Aktif`,
                      notaRp,
                      modalRp,
                      profitRp,
                      acceptedRp,
                      rejectRp,
                      marginPct,
                    };
                  });

                const totalRollCount = kpiRolls.length;
                const totalSeriCount = billableKpiBatches.length;
                const totalModalAll = billableKpiBatches.reduce(
                  (sum, s) => sum + getSerialModalRp(s),
                  0
                );
                const totalRejectAll = rejectedBatches.reduce(
                  (sum, s) => sum + getSerialNotaRp(s),
                  0
                );
                const totalMarginAll =
                  totalAllNotaRp > 0
                    ? Number(((totalProfitRp / totalAllNotaRp) * 100).toFixed(1))
                    : 0;

                const chartItems = [
                  {
                    id: 'TOTAL_ALL_GULUNGAN',
                    isTotal: true,
                    title: 'TOTAL SEMUA GULUNGAN',
                    subtitle: `${totalRollCount} Gulungan • ${totalSeriCount} Seri (${activeFactoryLabel})`,
                    notaRp: totalAllNotaRp,
                    modalRp: totalModalAll,
                    profitRp: totalProfitRp,
                    acceptedRp: totalCairRp,
                    rejectRp: totalRejectAll,
                    marginPct: totalMarginAll,
                  },
                  ...perFactoryMetrics,
                ];

                const maxVal = Math.max(
                  1,
                  ...chartItems.map((m) =>
                    Math.max(m.notaRp, m.modalRp, Math.abs(m.profitRp), m.rejectRp)
                  )
                );

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {chartItems.map((m) => {
                      const notaPct =
                        m.notaRp > 0 ? Math.max(4, Math.round((m.notaRp / maxVal) * 100)) : 0;
                      const modalPct =
                        m.modalRp > 0 ? Math.max(4, Math.round((m.modalRp / maxVal) * 100)) : 0;
                      const profitPct =
                        m.profitRp !== 0
                          ? Math.max(4, Math.round((Math.abs(m.profitRp) / maxVal) * 100))
                          : 0;
                      const rejectPct =
                        m.rejectRp > 0 ? Math.max(4, Math.round((m.rejectRp / maxVal) * 100)) : 0;

                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl bg-zinc-950 border space-y-2.5 ${
                            m.isTotal
                              ? 'border-amber-500/80 shadow-[0_0_16px_rgba(245,158,11,0.12)]'
                              : 'border-zinc-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded font-mono font-black text-[10px] border ${
                                    m.isTotal
                                      ? 'bg-amber-500 text-black border-amber-400'
                                      : 'bg-black text-amber-400 border-amber-500/60'
                                  }`}
                                >
                                  {m.isTotal ? 'TOTAL GULUNGAN' : 'PER PABRIK'}
                                </span>
                                <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                                  {m.title}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 mt-0.5">{m.subtitle}</div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-black text-xs border shrink-0 ${
                                m.profitRp >= 0
                                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/50'
                                  : 'bg-red-950/60 text-red-300 border-red-700/60'
                              }`}
                            >
                              <TrendingUp className="w-3 h-3" />
                              {m.marginPct}%
                            </span>
                          </div>

                          {/* Horizontal Visual Bars */}
                          <div className="space-y-1.5 font-mono text-[11px]">
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-zinc-300">
                                <span>Pendapatan (Nota):</span>
                                <b className="text-white">{formatRupiah(m.notaRp)}</b>
                              </div>
                              <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-zinc-800">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                  style={{ width: `${notaPct}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-zinc-400">
                                <span>Modal Produksi:</span>
                                <b className="text-zinc-200">{formatRupiah(m.modalRp)}</b>
                              </div>
                              <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-zinc-800">
                                <div
                                  className="h-full bg-zinc-500 rounded-full transition-all duration-500"
                                  style={{ width: `${modalPct}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-amber-300">
                                <span>Profit Bersih:</span>
                                <b className={m.profitRp >= 0 ? 'text-amber-400' : 'text-red-400'}>
                                  {m.profitRp >= 0 ? '+' : ''}
                                  {formatRupiah(m.profitRp)}
                                </b>
                              </div>
                              <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-zinc-800">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    m.profitRp >= 0 ? 'bg-amber-400' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${profitPct}%` }}
                                />
                              </div>
                            </div>

                            {m.rejectRp > 0 && (
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-red-300">
                                  <span>Nilai Reject / Pindah:</span>
                                  <b className="text-red-400">{formatRupiah(m.rejectRp)}</b>
                                </div>
                                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-zinc-800">
                                  <div
                                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                                    style={{ width: `${rejectPct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="requiem-card p-3 rounded-xl border border-zinc-800/90 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor seri (AK 1 -> AL 1, 57...), kode gulungan (GUL-...), atau nama pabrik..."
              className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <select
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
            className="h-9 sm:h-10 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-amber-400 font-bold focus:outline-hidden focus:border-amber-500"
            aria-label="Filter Pabrik Riwayat"
          >
            <option value="ALL">Semua Pabrik</option>
            {factories
              .filter((f) => f !== 'ALL')
              .map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
          </select>
        </div>

        {activeSegment === 'seri-status' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-900">
            {[
              { id: 'ALL', label: `Semua Seri (${kpiBatches.length})` },
              { id: 'ACCEPTED_CAIR', label: `Diterima / Accepted (${cairBatches.length})` },
              { id: 'PAID_CAIR', label: `Cair / Paid (${paidAcceptedBatches.length})` },
              { id: 'UNPAID_BELUM_CAIR', label: `Belum Cair / Not Paid (${unpaidAcceptedBatches.length})` },
              { id: 'PENDING', label: `Menunggu Pabrik (${pendingBatches.length})` },
              { id: 'REJECTED_STOCK', label: `Reject di Gudang (${rejectedBatches.length})` },
              {
                id: 'RENAMED_LINEAGE',
                label: `Riwayat Ganti Seri / Pindah (${renamedBatches.length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`h-8 px-3 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-black text-amber-400 border border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SEGMENT 1: RIWAYAT NOTA GULUNGAN */}
      {activeSegment === 'nota-history' && (
        <div className="space-y-4">
          {filteredRolls.length === 0 ? (
            <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
              <Scroll className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-white font-bold text-sm">
                Tidak ada riwayat Nota Gulungan yang cocok
              </p>
            </div>
          ) : (
            filteredRolls.map((roll) => {
              // Active serials currently in this roll
              const activeInRoll = finishedBatches.filter(
                (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
              );
              // Serials that were previously in this roll before being rejected & moved to another roll
              const movedOutFromRoll = finishedBatches.filter(
                (b) =>
                  b.rollId !== roll.id &&
                  b.rollNumber !== roll.rollNumber &&
                  (b.previousRollId === roll.id ||
                    (b.previousRollNumber && b.previousRollNumber.includes(roll.rollNumber)))
              );

              const allHistoricalSerials = [...activeInRoll, ...movedOutFromRoll];
              const isExpanded = !!expandedNotaRollIds[roll.id];
              const sheetMode = notaSheetModeMap[roll.id] || 'INTERNAL_COST';

              const formattedDate = new Date(roll.sampleCreatedDate).toLocaleDateString(
                'id-ID',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }
              );

              const sumBruto = activeInRoll.reduce(
                (acc, s) => acc + s.packaging.grossWeightPerPackage,
                0
              );
              const sumTara = activeInRoll.reduce((acc, s) => acc + s.factoryDeductionKg, 0);
              const sumNetto = activeInRoll.reduce(
                (acc, s) =>
                  acc + Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg),
                0
              );
              const sumModal = activeInRoll.reduce((acc, s) => acc + getSerialModalRp(s), 0);
              const sumNota = activeInRoll.reduce((acc, s) => acc + getSerialNotaRp(s), 0);
              const sumProfit = sumNota - sumModal;

              const cairCount = activeInRoll.filter(
                (s) => s.factoryStatus === 'ACCEPTED_CAIR'
              ).length;
              const pendingCount = activeInRoll.filter(
                (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
              ).length;
              const rejectCount =
                activeInRoll.filter((s) => s.factoryStatus === 'REJECTED_STOCK').length +
                movedOutFromRoll.length;

              return (
                <div
                  key={roll.id}
                  className="requiem-card rounded-2xl border-2 border-zinc-800/90 hover:border-amber-500/70 overflow-hidden transition-all"
                >
                  {/* Roll Nota Header */}
                  <div className="p-4 sm:p-5 bg-black/95 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs">
                          {roll.rollNumber}
                        </span>
                        <h2 className="font-black text-white text-sm sm:text-base">
                          {roll.recipeName}
                        </h2>
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-300 border border-zinc-700 font-mono text-[11px] font-bold">
                          {activeInRoll.length} Seri Aktif
                          {movedOutFromRoll.length > 0
                            ? ` (+${movedOutFromRoll.length} Eks-Reject Pindah)`
                            : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-300">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-400" />
                          Pabrik: <b className="text-white">{roll.targetFactory}</b>
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-amber-300">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          {formattedDate}
                        </span>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono pt-0.5">
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-amber-400">
                          Diterima / Accepted: <b>{cairCount}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-white">
                          Menunggu Pabrik: <b>{pendingCount}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">
                          Riwayat Reject/Pindah: <b>{rejectCount}</b>
                        </span>
                      </div>
                    </div>

                    {/* Right Totals & Toggle Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="bg-zinc-950 px-3.5 py-2 rounded-xl border border-zinc-800 text-right font-mono">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold">
                          Total Nota ({sumNetto} kg Netto)
                        </div>
                        <div className="text-amber-400 font-black text-sm">
                          {formatRupiah(sumNota)}
                        </div>
                        <div className="text-[10px] text-zinc-300">
                          Profit:{' '}
                          <b className={sumProfit >= 0 ? 'text-amber-300' : 'text-red-400'}>
                            {sumProfit >= 0 ? '+' : ''}
                            {formatRupiah(sumProfit)}
                          </b>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNotaRollIds((prev) => ({
                            ...prev,
                            [roll.id]: !prev[roll.id],
                          }))
                        }
                        className="btn-amber-outline h-9 px-3.5 rounded-xl font-black text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {isExpanded ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Sembunyikan Nota</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Tabel Nota</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Nota Table */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-950/90 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setNotaSheetModeMap((prev) => ({
                                ...prev,
                                [roll.id]: 'INTERNAL_COST',
                              }))
                            }
                            className={`h-8 px-3 rounded-lg text-xs font-extrabold cursor-pointer ${
                              sheetMode === 'INTERNAL_COST'
                                ? 'bg-black text-amber-400 border border-amber-500'
                                : 'bg-black text-zinc-400 border border-zinc-800 hover:text-white'
                            }`}
                          >
                            Nota Arsip Personal (Modal + Profit)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNotaSheetModeMap((prev) => ({
                                ...prev,
                                [roll.id]: 'FACTORY_NOTA',
                              }))
                            }
                            className={`h-8 px-3 rounded-lg text-xs font-extrabold cursor-pointer ${
                              sheetMode === 'FACTORY_NOTA'
                                ? 'bg-black text-amber-400 border border-amber-500'
                                : 'bg-black text-zinc-400 border border-zinc-800 hover:text-white'
                            }`}
                          >
                            Nota Setor Pabrik (9 Kolom)
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyRollNota(roll, activeInRoll, sheetMode)}
                            className="btn-amber-outline h-8 px-3 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedKey === `${roll.id}-${sheetMode}` ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Tersalin!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Salin Nota
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadRollCsv(roll, activeInRoll, sheetMode)}
                            className="h-8 px-2.5 rounded-lg bg-black hover:bg-zinc-900 text-white border border-zinc-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-400" /> CSV
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-black">
                        <table className="w-full text-left border-collapse font-mono text-[11px]">
                          <thead>
                            <tr className="bg-zinc-900 text-white border-b border-zinc-800 text-center font-black whitespace-nowrap">
                              <th className="py-2.5 px-2.5 border-r border-zinc-800">NO</th>
                              <th className="py-2.5 px-3 border-r border-zinc-800">
                                {sheetMode === 'FACTORY_NOTA' ? 'SERI' : 'SERI (ASAL -> BARU)'}
                              </th>
                              {sheetMode === 'INTERNAL_COST' && (
                                <th className="py-2.5 px-2 border-r border-zinc-800">STATUS</th>
                              )}
                              <th className="py-2.5 px-2 border-r border-zinc-800">BRUTO</th>
                              <th className="py-2.5 px-2 border-r border-zinc-800">TARA</th>
                              <th className="py-2.5 px-2 border-r border-zinc-800">NETTO</th>
                              <th className="py-2.5 px-2 border-r border-zinc-800">PACKAGING</th>
                              <th className="py-2.5 px-2 border-r border-zinc-800">GRADE</th>
                              {sheetMode === 'INTERNAL_COST' && (
                                <>
                                  <th className="py-2.5 px-2 border-r border-zinc-800">
                                    HARGA MODAL
                                  </th>
                                  <th className="py-2.5 px-2 border-r border-zinc-800">
                                    JUMLAH MODAL
                                  </th>
                                </>
                              )}
                              <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-300">
                                {sheetMode === 'FACTORY_NOTA' ? 'HARGA' : 'HARGA PABRIK'}
                              </th>
                              <th
                                className={`py-2.5 px-2 text-amber-300 ${
                                  sheetMode === 'INTERNAL_COST' ? 'border-r border-zinc-800' : ''
                                }`}
                              >
                                {sheetMode === 'FACTORY_NOTA' ? 'JUMLAH' : 'JUMLAH PABRIK'}
                              </th>
                              {sheetMode === 'INTERNAL_COST' && (
                                <th className="py-2.5 px-2 text-amber-400">PROFIT</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-center">
                            {(sheetMode === 'FACTORY_NOTA' && activeInRoll.length > 0
                              ? activeInRoll
                              : allHistoricalSerials
                            ).map((s, idx) => {
                              const movedOut =
                                s.rollId !== roll.id && s.rollNumber !== roll.rollNumber;
                              const bruto = s.packaging.grossWeightPerPackage;
                              const tara = s.factoryDeductionKg;
                              const netto = Math.max(0, bruto - tara);
                              const modalPerKg = Math.round(
                                s.effectiveHppAfterTaraPerKg || s.hppPerNetKg || 0
                              );
                              const jumlahModal = getSerialModalRp(s);
                              const jumlahNota = getSerialNotaRp(s);
                              const profit = jumlahNota - jumlahModal;
                              const lineage = formatSerialLineage(s);

                              return (
                                <tr
                                  key={`${roll.id}-${s.id}`}
                                  className={`hover:bg-zinc-950/90 ${
                                    movedOut ? 'text-zinc-500 bg-zinc-950/50' : 'text-zinc-200'
                                  }`}
                                >
                                  <td className="py-2 px-2 border-r border-zinc-900">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-2 border-r border-zinc-900 font-black text-amber-400 whitespace-nowrap">
                                    {sheetMode === 'FACTORY_NOTA' ? s.serialNumber : lineage}
                                  </td>
                                  {sheetMode === 'INTERNAL_COST' && (
                                    <td className="py-2 px-2 border-r border-zinc-900 whitespace-nowrap text-[10px]">
                                      {movedOut ? (
                                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-amber-300 border border-amber-500/50 font-bold">
                                          REJECTED ({s.rollNumber})
                                        </span>
                                      ) : s.factoryStatus === 'ACCEPTED_CAIR' ? (
                                        <span className="px-2 py-0.5 rounded bg-black text-amber-400 border border-amber-500 font-black">
                                          DITERIMA ({s.paymentStatus === 'CAIR' ? 'CAIR' : 'BELUM CAIR'})
                                        </span>
                                      ) : s.factoryStatus === 'REJECTED_STOCK' ? (
                                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-white border border-zinc-600 font-bold">
                                          REJECTED
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-700">
                                          MENUNGGU PABRIK
                                        </span>
                                      )}
                                    </td>
                                  )}
                                  <td className="py-2 px-2 border-r border-zinc-900">{bruto}</td>
                                  <td className="py-2 px-2 border-r border-zinc-900">{tara}</td>
                                  <td className="py-2 px-2 border-r border-zinc-900 font-bold text-white">
                                    {netto}
                                  </td>
                                  <td className="py-2 px-2 border-r border-zinc-900">
                                    {s.packaging.packagingType}
                                  </td>
                                  <td className="py-2 px-2 border-r border-zinc-900 font-bold text-white">
                                    {s.compositeColorGrade}
                                  </td>
                                  {sheetMode === 'INTERNAL_COST' && (
                                    <>
                                      <td className="py-2 px-2 border-r border-zinc-900 text-right">
                                        {formatSheetRp(modalPerKg)}
                                      </td>
                                      <td className="py-2 px-2 border-r border-zinc-900 text-right font-bold text-white">
                                        {formatSheetRp(jumlahModal)}
                                      </td>
                                    </>
                                  )}
                                  <td className="py-2 px-2 border-r border-zinc-900 text-right text-amber-300 font-bold">
                                    {formatSheetRp(s.factoryTargetPricePerKg)}
                                  </td>
                                  <td
                                    className={`py-2 px-2 text-right text-amber-400 font-black ${
                                      sheetMode === 'INTERNAL_COST' ? 'border-r border-zinc-900' : ''
                                    }`}
                                  >
                                    {formatSheetRp(jumlahNota)}
                                  </td>
                                  {sheetMode === 'INTERNAL_COST' && (
                                    <td className="py-2 px-2 text-right font-black text-white">
                                      {formatSheetRp(profit)}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-zinc-900 border-t-2 border-amber-500/60 font-black text-white text-center">
                              <td
                                colSpan={sheetMode === 'FACTORY_NOTA' ? 2 : 3}
                                className="py-2.5 px-3 border-r border-zinc-800 text-left text-amber-400"
                              >
                                TOTAL AKTIF ({activeInRoll.length} SERI)
                              </td>
                              <td className="py-2.5 px-2 border-r border-zinc-800 text-amber-400">
                                {sumBruto}
                              </td>
                              <td className="py-2.5 px-2 border-r border-zinc-800 text-amber-400">
                                {sumTara}
                              </td>
                              <td className="py-2.5 px-2 border-r border-zinc-800 text-white">
                                {sumNetto}
                              </td>
                              <td colSpan={2} className="py-2.5 px-2 border-r border-zinc-800" />
                              {sheetMode === 'INTERNAL_COST' && (
                                <>
                                  <td className="py-2.5 px-2 border-r border-zinc-800" />
                                  <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-white">
                                    {formatSheetRp(sumModal)}
                                  </td>
                                </>
                              )}
                              <td className="py-2.5 px-2 border-r border-zinc-800" />
                              <td
                                className={`py-2.5 px-2 text-right text-amber-400 ${
                                  sheetMode === 'INTERNAL_COST' ? 'border-r border-zinc-800' : ''
                                }`}
                              >
                                {formatSheetRp(sumNota)}
                              </td>
                              {sheetMode === 'INTERNAL_COST' && (
                                <td className="py-2.5 px-2 text-right text-amber-400">
                                  {formatSheetRp(sumProfit)}
                                </td>
                              )}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SEGMENT 2: DATA STATUS & JEJAK SEMUA SERI */}
      {activeSegment === 'seri-status' && (
        <div className="space-y-4">
          {filteredSerials.length === 0 ? (
            <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
              <Package className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-white font-bold text-sm">
                Tidak ada Nomor Seri yang cocok dengan filter ini
              </p>
            </div>
          ) : (
            <>
              {/* Master Status & Lineage Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSerials.map((s) => {
                  const status = s.factoryStatus || 'PENDING';
                  const lineage = formatSerialLineage(s);
                  const isRenamed = hasSerialLineage(s);
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  const modalRp = getSerialModalRp(s);
                  const notaRp = getSerialNotaRp(s);
                  const profitRp = notaRp - modalRp;
                  const gradeInfo =
                    GRADE_LABELS[s.compositeColorGrade] || GRADE_LABELS['D'];

                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="requiem-card rounded-2xl border border-zinc-800/90 hover:border-amber-500 p-4 flex flex-col justify-between gap-3 transition-all"
                    >
                      <div className="space-y-2.5">
                        {/* Top Header: Serial Lineage Badge & Status */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-xl bg-black text-amber-400 border-2 border-amber-500 font-mono font-black text-xs sm:text-sm shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                              SERI {lineage}
                            </span>
                            {isRenamed && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/60 font-mono font-bold text-[10px]">
                                Ganti Seri ({lineage})
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${gradeInfo.color}`}
                            >
                              Grade {s.compositeColorGrade}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {onUpdateSerial && (
                              <button
                                type="button"
                                onClick={() => setEditingSerial(s)}
                                title={`Edit Seri ${s.serialNumber} (Tersinkron ke Gulungan)`}
                                className="h-7 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-700 hover:border-amber-500 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Pencil className="w-3 h-3 text-amber-400" />
                                <span>Edit</span>
                              </button>
                            )}
                            <span
                              className={`px-2.5 py-1 rounded-lg font-mono font-black text-[10px] border inline-flex items-center gap-1 ${
                                status === 'ACCEPTED_CAIR'
                                  ? 'bg-black text-amber-400 border-amber-400'
                                  : status === 'REJECTED_STOCK'
                                    ? 'bg-zinc-900 text-white border-amber-500/70'
                                    : 'bg-zinc-950 text-zinc-300 border-zinc-700'
                              }`}
                            >
                              {status === 'ACCEPTED_CAIR' ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-amber-400" />
                                  <span>DITERIMA / ACCEPTED</span>
                                </>
                              ) : status === 'REJECTED_STOCK' ? (
                                <>
                                  <RotateCcw className="w-3 h-3 text-amber-400" />
                                  <span>REJECTED</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>MENUNGGU PABRIK</span>
                                </>
                              )}
                            </span>
                            {status === 'ACCEPTED_CAIR' && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!onUpdateSerial) return;
                                  const nextPayment =
                                    s.paymentStatus === 'CAIR' ? 'BELUM_CAIR' : 'CAIR';
                                  onUpdateSerial({
                                    ...s,
                                    paymentStatus: nextPayment,
                                  });
                                }}
                                title="Klik untuk ubah status bayar: Cair (Paid) / Belum Cair (Not Paid)"
                                className={`px-2 py-1 rounded-lg font-mono font-black text-[10px] border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                  s.paymentStatus === 'CAIR'
                                    ? 'bg-amber-500 text-black border-amber-400'
                                    : 'bg-zinc-950 text-zinc-300 border-zinc-700 hover:border-amber-500/60'
                                }`}
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>
                                  {s.paymentStatus === 'CAIR' ? 'CAIR (PAID)' : 'BELUM CAIR'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Current vs Previous Gulungan & Factory Box */}
                        <div className="bg-black p-3 rounded-xl border border-zinc-800/90 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-400 flex items-center gap-1">
                              <Scroll className="w-3.5 h-3.5 text-amber-400" />
                              Gulungan Aktif:
                            </span>
                            <b className="font-mono text-white">
                              {s.rollNumber || '-'} ({s.recipeName})
                            </b>
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-400 flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-amber-400" />
                              Pabrik Tujuan:
                            </span>
                            <b className="text-amber-300">{s.targetFactory}</b>
                          </div>

                          {(s.previousRollNumber || s.previousFactory || isRenamed) && (
                            <div className="pt-2 mt-1 border-t border-zinc-900 space-y-1 text-[11px]">
                              <div className="text-amber-400 font-bold flex items-center gap-1">
                                <History className="w-3 h-3" />
                                <span>Jejak Riwayat Sebelumnya (Eks-Reject / Pindah):</span>
                              </div>
                              {isRenamed && (
                                <div className="font-mono text-zinc-200 flex items-center gap-1.5">
                                  <span>Perubahan Nomor Seri:</span>
                                  <b className="text-amber-400 px-1.5 py-0.5 rounded bg-zinc-950 border border-amber-500/50">
                                    {lineage}
                                  </b>
                                </div>
                              )}
                              {s.previousRollNumber && (
                                <div className="text-zinc-300">
                                  Eks-Gulungan:{' '}
                                  <b className="text-white font-mono">{s.previousRollNumber}</b>{' '}
                                  <ArrowRight className="w-3 h-3 inline text-amber-400 mx-0.5" />{' '}
                                  <b className="text-amber-300 font-mono">{s.rollNumber}</b>
                                </div>
                              )}
                              {s.previousFactory && (
                                <div className="text-zinc-300">
                                  Eks-Pabrik: <b className="text-white">{s.previousFactory}</b>{' '}
                                  <ArrowRight className="w-3 h-3 inline text-amber-400 mx-0.5" />{' '}
                                  <b className="text-amber-300">{s.targetFactory}</b>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Weights & Financials Strip */}
                        <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/90 font-mono text-[11px] text-center">
                          <div>
                            <span className="text-[9px] text-zinc-400 uppercase block font-bold">
                              Bruto / Tara / Netto
                            </span>
                            <b className="text-white">
                              {bruto} − {tara} = <span className="text-amber-400">{netto}kg</span>
                            </b>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 uppercase block font-bold">
                              Jumlah Nota
                            </span>
                            <b className="text-amber-300">{formatRupiah(notaRp)}</b>
                          </div>
                          <div>
                            <span className="text-[9px] text-zinc-400 uppercase block font-bold">
                              Profit Bersih
                            </span>
                            <b className={profitRp >= 0 ? 'text-amber-400' : 'text-red-400'}>
                              {profitRp >= 0 ? '+' : ''}
                              {formatRupiah(profitRp)}
                            </b>
                          </div>
                        </div>
                      </div>

                      {/* Action Footer if Currently Rejected */}
                      {status === 'REJECTED_STOCK' && onGoToRejectedStock && (
                        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-zinc-400">
                            Tersedia di Gudang Stok Jadi (Bisa ganti seri mis.{' '}
                            <b className="text-amber-300">{s.serialNumber} -&gt; AL 1</b>)
                          </span>
                          <button
                            type="button"
                            onClick={onGoToRejectedStock}
                            className="btn-amber-outline h-8 px-3 rounded-lg text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <span>Ubah Seri &amp; Pindah Gulungan →</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
      {onUpdateSerial && (
        <EditFinishedSerialModal
          serial={editingSerial}
          onClose={() => setEditingSerial(null)}
          onSave={onUpdateSerial}
          rollSamples={rollSamples}
          packagingList={packagingList}
          factoryList={factoryList}
        />
      )}
    </div>
  );
};
