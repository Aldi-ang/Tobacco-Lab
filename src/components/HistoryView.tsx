import React, { useState } from 'react';
import {
  History,
  FileSpreadsheet,
  Search,
  Scroll,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowRight,
  Copy,
  Check,
  Download,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  BarChart3,
  Trash2,
  X,
} from 'lucide-react';
import {
  RollFolderGroupingMode,
  groupRollsIntoFolders,
} from '../utils/rollGrouping';
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
  onDeleteRoll?: (rollId: string) => void;
  onDeleteSerial?: (serialId: string) => void;
  onClearAllDemoData?: () => void;
  onOpenGoogleSheetsModal: () => void;
  onGoToRejectedStock?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  rollSamples,
  finishedBatches,
  packagingList = [],
  factoryList = [],
  onUpdateSerial,
  onDeleteRoll,
  onDeleteSerial,
  onOpenGoogleSheetsModal,
  onGoToRejectedStock,
}) => {
  const [activeSegment, setActiveSegment] = useState<
    'nota-history' | 'seri-status' | 'factory-comparison'
  >('nota-history');
  const [editingSerial, setEditingSerial] = useState<FinishedTobaccoSerial | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACCEPTED_CAIR' | 'PENDING' | 'REJECTED_STOCK' | 'RENAMED_LINEAGE'
  >('ALL');
  const [factoryFilter, setFactoryFilter] = useState<string>('ALL');
  const [notaGroupingMode, setNotaGroupingMode] = useState<RollFolderGroupingMode>('date');
  const [expandedHistoryFolderKeys, setExpandedHistoryFolderKeys] = useState<
    Record<string, boolean>
  >({});
  const [expandedNotaRollIds, setExpandedNotaRollIds] = useState<Record<string, boolean>>({});
  const [notaSheetModeMap, setNotaSheetModeMap] = useState<
    Record<string, 'INTERNAL_COST' | 'FACTORY_NOTA'>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  const factories = [
    'ALL',
    ...Array.from(
      new Set([
        ...rollSamples.map((r) => r.targetFactory),
        ...finishedBatches.map((b) => b.targetFactory),
      ])
    ).filter(Boolean),
  ];

  const activeFactoryLabel =
    factoryFilter === 'ALL' ? 'Semua Pabrik' : factoryFilter;

  const q = searchTerm.trim().toLowerCase();

  // Filter rolls & serials for top KPI ledger based on factoryFilter and searchTerm
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
  const totalAllModalRp = billableKpiBatches.reduce((sum, s) => sum + getSerialModalRp(s), 0);
  const totalNettoAllKg = Number(
    billableKpiBatches
      .reduce((sum, s) => sum + Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg), 0)
      .toFixed(1)
  );
  const totalCairRp = cairBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalPaidCairRp = paidAcceptedBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalUnpaidAcceptedRp = unpaidAcceptedBatches.reduce(
    (sum, s) => sum + getSerialNotaRp(s),
    0
  );
  const totalPendingRp = pendingBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalProfitRp = totalAllNotaRp - totalAllModalRp;
  const totalMarginPct =
    totalAllNotaRp > 0 ? Number(((totalProfitRp / totalAllNotaRp) * 100).toFixed(1)) : 0;

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
        subtitle: `Total Nota Seri yang Diterima Pabrik (${activeFactoryLabel})`,
        badgeText: 'RIWAYAT DITERIMA / ACCEPTED • RUMUS NILAI DITERIMA',
        coreFormula: 'Total Diterima = Σ (Netto Tagih × Harga Pabrik) untuk Seri DITERIMA / ACCEPTED',
        appliedFormula: `Total Diterima (${cairBatches.length} Seri) = ${formatRupiah(totalCairRp)}`,
        steps: [
          {
            stepNumber: 1,
            title: 'Total Nilai Diterima / Accepted',
            formula: 'Total Diterima = Σ Nota Seri berstatus DITERIMA / ACCEPTED',
            substitution: `${cairBatches.length} Seri DITERIMA (${activeFactoryLabel}) = ${formatRupiah(totalCairRp)}`,
            resultLabel: 'Total Diterima / Accepted',
            resultValue: formatRupiah(totalCairRp),
            explanation: `Total nilai nota dari ${cairBatches.length} Nomor Seri yang diterima pabrik (${activeFactoryLabel}).`,
            highlight: 'amber',
          },
          ...cairBatches.map((s, idx) => {
            const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
            const nota = getSerialNotaRp(s);
            return {
              stepNumber: idx + 2,
              title: `Seri ${formatSerialLineage(s)} (Diterima / Accepted)`,
              formula: `Nilai Diterima = Netto Tagih × Harga Pabrik`,
              substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
              resultLabel: `Seri ${formatSerialLineage(s)}`,
              resultValue: formatRupiah(nota),
              explanation: `Gulungan ${s.rollNumber || '-'} • Pabrik ${s.targetFactory} • Status: Diterima / Accepted.`,
              highlight: 'white' as const,
            };
          }),
        ],
        conclusion: `Total Diterima / Accepted (${activeFactoryLabel}) = ${formatRupiah(totalCairRp)}.`,
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
      !q ||
      roll.rollNumber.toLowerCase().includes(q) ||
      roll.recipeName.toLowerCase().includes(q) ||
      roll.targetFactory.toLowerCase().includes(q) ||
      serialText.toLowerCase().includes(q);
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
          : st === statusFilter;
    const matchFactory =
      factoryFilter === 'ALL' ||
      b.targetFactory === factoryFilter ||
      b.previousFactory === factoryFilter;
    const lineage = formatSerialLineage(b);
    const matchSearch =
      !q ||
      b.serialNumber.toLowerCase().includes(q) ||
      lineage.toLowerCase().includes(q) ||
      (b.rollNumber || '').toLowerCase().includes(q) ||
      (b.previousRollNumber || '').toLowerCase().includes(q) ||
      b.targetFactory.toLowerCase().includes(q) ||
      (b.previousFactory || '').toLowerCase().includes(q);
    return matchStatus && matchFactory && matchSearch;
  });

  // Per-factory analytical rows for collapsible comparison drawer
  const factoryComparisonRows = (() => {
    const factoryNamesList = Array.from(
      new Set([
        ...rollSamples.map((r) => r.targetFactory),
        ...finishedBatches.map((b) => b.targetFactory),
      ])
    ).filter(Boolean);

    return factoryNamesList.map((facName) => {
      const facRolls = rollSamples.filter((r) => r.targetFactory === facName);
      const facSerials = finishedBatches.filter((b) => b.targetFactory === facName);
      const facRejectedSerials = finishedBatches.filter(
        (b) =>
          (b.targetFactory === facName && b.factoryStatus === 'REJECTED_STOCK') ||
          (b.previousFactory === facName && b.targetFactory !== facName)
      );
      const notaRp = facSerials.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
      const modalRp = facSerials.reduce((sum, s) => sum + getSerialModalRp(s), 0);
      const profitRp = notaRp - modalRp;
      const acceptedRp = facSerials
        .filter((s) => s.factoryStatus === 'ACCEPTED_CAIR')
        .reduce((sum, s) => sum + getSerialNotaRp(s), 0);
      const rejectRp = facRejectedSerials.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
      const marginPct = notaRp > 0 ? Number(((profitRp / notaRp) * 100).toFixed(1)) : 0;

      return {
        facName,
        rollCount: facRolls.length,
        serialCount: facSerials.length,
        notaRp,
        modalRp,
        profitRp,
        acceptedRp,
        rejectRp,
        marginPct,
      };
    });
  })();

  const statusMeta = (status: string, movedOut = false, movedToRoll?: string) => {
    if (movedOut) {
      return {
        label: `Pindah (${movedToRoll || '-'})`,
        textClass: 'text-amber-300',
        dotClass: 'bg-amber-400',
      };
    }
    if (status === 'ACCEPTED_CAIR') {
      return {
        label: 'Diterima',
        textClass: 'text-emerald-400',
        dotClass: 'bg-emerald-400',
      };
    }
    if (status === 'REJECTED_STOCK') {
      return {
        label: 'Reject',
        textClass: 'text-rose-400',
        dotClass: 'bg-rose-400',
      };
    }
    return {
      label: 'Menunggu',
      textClass: 'text-zinc-300',
      dotClass: 'bg-zinc-400',
    };
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* 1. UNIFIED WORKSPACE TOOLBAR (SEGMENT SWITCH + SEARCH + FACTORY + CHART TOGGLE + SHEETS CTA) */}
      <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Marked Tabs Mode Switch (3 Dedicated Panels) */}
          <div
            role="tablist"
            aria-label="Mode Tampilan Riwayat"
            className="inline-grid grid-cols-3 p-1 rounded-xl bg-[#040507] border border-zinc-800/90 gap-1 w-full lg:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'nota-history'}
              onClick={() => setActiveSegment('nota-history')}
              className={`relative h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap border ${
                activeSegment === 'nota-history'
                  ? 'bg-[#12141c] text-amber-300 border-amber-500/65 font-extrabold'
                  : 'bg-transparent text-zinc-400 hover:text-white border-transparent'
              }`}
            >
              <Scroll className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-none">Nota Gulungan</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md font-mono font-black text-xs tabular-nums leading-none border ${
                  activeSegment === 'nota-history'
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/45'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700/80'
                }`}
              >
                {kpiRolls.length}
              </span>
              {activeSegment === 'nota-history' && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-amber-400" />
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'seri-status'}
              onClick={() => setActiveSegment('seri-status')}
              className={`relative h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap border ${
                activeSegment === 'seri-status'
                  ? 'bg-[#12141c] text-amber-300 border-amber-500/65 font-extrabold'
                  : 'bg-transparent text-zinc-400 hover:text-white border-transparent'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-none">Semua Seri</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md font-mono font-black text-xs tabular-nums leading-none border ${
                  activeSegment === 'seri-status'
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/45'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700/80'
                }`}
              >
                {kpiBatches.length}
              </span>
              {activeSegment === 'seri-status' && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-amber-400" />
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeSegment === 'factory-comparison'}
              onClick={() => setActiveSegment('factory-comparison')}
              className={`relative h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] cursor-pointer whitespace-nowrap border ${
                activeSegment === 'factory-comparison'
                  ? 'bg-[#12141c] text-amber-300 border-amber-500/65 font-extrabold'
                  : 'bg-transparent text-zinc-400 hover:text-white border-transparent'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline leading-none">Perbandingan Pabrik</span>
              <span className="sm:hidden leading-none">Pabrik</span>
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md font-mono font-black text-xs tabular-nums leading-none border ${
                  activeSegment === 'factory-comparison'
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/45'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700/80'
                }`}
              >
                {factoryComparisonRows.length}
              </span>
              {activeSegment === 'factory-comparison' && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          {/* Search + Factory Filter + Sheets Action */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-1 lg:justify-end">
            <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari seri, GUL-..., pabrik..."
                aria-label="Cari riwayat nota atau seri"
                className="w-full h-9 pl-8.5 pr-8 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500/80 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Bersihkan pencarian riwayat"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={factoryFilter}
              onChange={(e) => setFactoryFilter(e.target.value)}
              aria-label="Filter Pabrik Riwayat"
              className="w-full sm:w-auto sm:max-w-[185px] h-9 px-3 bg-black border border-zinc-800 hover:border-zinc-700 rounded-xl text-xs text-zinc-100 font-semibold focus:outline-hidden focus:border-amber-500/80 cursor-pointer shrink-0 truncate"
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

            <button
              type="button"
              onClick={onOpenGoogleSheetsModal}
              className="alucard-edge-btn h-9 px-3.5 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Status Quick Filters when viewing Segment 2 */}
        {activeSegment === 'seri-status' && (
          <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'Semua', count: kpiBatches.length },
                { id: 'ACCEPTED_CAIR', label: 'Diterima', count: cairBatches.length },
                { id: 'PENDING', label: 'Menunggu', count: pendingBatches.length },
                { id: 'REJECTED_STOCK', label: 'Reject', count: rejectedBatches.length },
                { id: 'RENAMED_LINEAGE', label: 'Ganti Seri', count: renamedBatches.length },
              ].map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-zinc-900 text-amber-300 border border-amber-500/70'
                        : 'bg-transparent text-zinc-400 hover:text-white border border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono tabular-nums text-[11px] opacity-80">
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {rejectedBatches.length > 0 && onGoToRejectedStock && (
              <button
                type="button"
                onClick={onGoToRejectedStock}
                className="h-8 px-3 rounded-lg bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 border border-rose-500/40 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Proses Reject di Stok Jadi ({rejectedBatches.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. EXECUTIVE 4-COLUMN KPI LEDGER STRIP (SINGLE SURFACE, HAIRLINE DIVIDERS, TABULAR NUMERALS) */}
      <div className="bg-[#09090c] border border-zinc-800 rounded-2xl overflow-hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80">
        <button
          type="button"
          onClick={() => openHistoryKpiCalc('TOTAL_NOTA')}
          className="text-left p-4 hover:bg-zinc-900/40 transition-colors cursor-pointer flex flex-col justify-between gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-zinc-400">Total Nilai Nota</span>
            <CalcSymbolBadge />
          </div>
          <div className="font-mono tabular-nums font-black text-lg sm:text-xl text-white tracking-tight">
            {formatRupiah(totalAllNotaRp)}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
            {billableKpiBatches.length} seri · {totalNettoAllKg} kg · {activeFactoryLabel}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openHistoryKpiCalc('CAIR_VALUE')}
          className="text-left p-4 hover:bg-zinc-900/40 transition-colors cursor-pointer flex flex-col justify-between gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-400">Diterima Pabrik</span>
            <CalcSymbolBadge />
          </div>
          <div className="font-mono tabular-nums font-black text-lg sm:text-xl text-emerald-300 tracking-tight">
            {formatRupiah(totalCairRp)}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
            {cairBatches.length} seri
            {paidAcceptedBatches.length > 0 ? ` · Cair ${formatRupiah(totalPaidCairRp)}` : ''}
            {unpaidAcceptedBatches.length > 0 && paidAcceptedBatches.length > 0
              ? ` · Proses ${formatRupiah(totalUnpaidAcceptedRp)}`
              : ''}
            {rejectedBatches.length > 0 ? ` · ${rejectedBatches.length} reject` : ''}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openHistoryKpiCalc('PENDING_VALUE')}
          className="text-left p-4 hover:bg-zinc-900/40 transition-colors cursor-pointer flex flex-col justify-between gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-zinc-400">Menunggu Pabrik</span>
            <CalcSymbolBadge />
          </div>
          <div className="font-mono tabular-nums font-black text-lg sm:text-xl text-zinc-100 tracking-tight">
            {formatRupiah(totalPendingRp)}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
            {pendingBatches.length} seri menunggu · {renamedBatches.length} ganti seri
          </div>
        </button>

        <button
          type="button"
          onClick={() => openHistoryKpiCalc('TOTAL_PROFIT')}
          className="text-left p-4 hover:bg-zinc-900/40 transition-colors cursor-pointer flex flex-col justify-between gap-1.5 bg-amber-500/[0.03]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-400">Profit Bersih</span>
            <CalcSymbolBadge />
          </div>
          <div
            className={`font-mono tabular-nums font-black text-lg sm:text-xl tracking-tight ${
              totalProfitRp >= 0 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {totalProfitRp >= 0 ? '+' : ''}
            {formatRupiah(totalProfitRp)}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
            Margin {totalMarginPct}% · Modal {formatRupiah(totalAllModalRp)}
          </div>
        </button>
      </div>

      {/* 3. DEDICATED PANEL: PERBANDINGAN PABRIK */}
      {activeSegment === 'factory-comparison' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Panel Perbandingan Performa Per Pabrik</span>
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Klik baris pabrik untuk memfilter data, atau buka nota gulungan khusus pabrik tersebut.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-zinc-500 inline-block" /> Modal
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" /> Profit
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Reject
              </span>
              {factoryFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setActiveSegment('nota-history')}
                  className="h-8 px-3 rounded-lg bg-[#0d0f14] hover:bg-amber-500/15 border border-amber-500/80 text-amber-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <span>Buka Nota {factoryFilter}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {factoryComparisonRows.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-white">Belum ada data pabrik untuk dibandingkan</p>
              <p className="text-xs text-zinc-400">
                Tambahkan gulungan atau seri tembakau jadi agar statistik per pabrik muncul di sini.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/90 text-[11px] text-zinc-400 font-bold bg-black/40">
                    <th className="py-2.5 px-4">Pabrik Tujuan</th>
                    <th className="py-2.5 px-3 text-right">Gulungan / Seri</th>
                    <th className="py-2.5 px-3 text-right">Modal</th>
                    <th className="py-2.5 px-3 text-right">Nilai Nota</th>
                    <th className="py-2.5 px-3 text-right">Profit</th>
                    <th className="py-2.5 px-3 text-right">Margin</th>
                    <th className="py-2.5 px-4 min-w-[160px]">Komposisi Nota</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 font-mono tabular-nums">
                  {factoryComparisonRows.map((row) => {
                    const isSelected = factoryFilter === row.facName;
                    const denom = Math.max(1, row.notaRp, row.modalRp + Math.max(0, row.profitRp));
                    const modalBarPct = Math.round((row.modalRp / denom) * 100);
                    const profitBarPct =
                      row.profitRp > 0 ? Math.max(4, Math.round((row.profitRp / denom) * 100)) : 0;

                    return (
                      <tr
                        key={row.facName}
                        onClick={() =>
                          setFactoryFilter((prev) => (prev === row.facName ? 'ALL' : row.facName))
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-500/10'
                            : 'hover:bg-zinc-900/50'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-sans font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{row.facName}</span>
                            {isSelected && (
                              <span className="text-[10px] font-mono text-amber-400">Aktif</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-300 whitespace-nowrap">
                          {row.rollCount} gul · {row.serialCount} seri
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-300 whitespace-nowrap">
                          {formatRupiah(row.modalRp)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                          {formatRupiah(row.notaRp)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                            row.profitRp >= 0 ? 'text-amber-400' : 'text-rose-400'
                          }`}
                        >
                          {row.profitRp >= 0 ? '+' : ''}
                          {formatRupiah(row.profitRp)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                            row.marginPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {row.marginPct}%
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="w-full h-2 bg-black rounded-full overflow-hidden flex border border-zinc-800">
                            <div
                              className="h-full bg-zinc-500"
                              style={{ width: `${Math.min(100, modalBarPct)}%` }}
                            />
                            {profitBarPct > 0 && (
                              <div
                                className="h-full bg-amber-400"
                                style={{
                                  width: `${Math.min(100 - Math.min(100, modalBarPct), profitBarPct)}%`,
                                }}
                              />
                            )}
                          </div>
                          {row.rejectRp > 0 && (
                            <div className="text-[10px] text-rose-400 mt-0.5">
                              Reject: {formatRupiah(row.rejectRp)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFactoryFilter(row.facName);
                              setActiveSegment('nota-history');
                            }}
                            className="h-7 px-2.5 rounded-lg bg-[#0d0f14] hover:bg-amber-500/15 border border-amber-500/70 text-amber-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>Lihat Nota</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. SEGMENT 1: RIWAYAT NOTA GULUNGAN (FOLDER GROUPED + COMPACT CARDS) */}
      {activeSegment === 'nota-history' && (
        <div className="space-y-3" data-testid="history-nota-folders">
          {filteredRolls.length === 0 ? (
            <div className="bg-[#09090c] border border-zinc-800 rounded-2xl text-center py-12 px-4 space-y-2">
              <Scroll className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-white font-bold text-sm">
                Belum ada Nota Gulungan yang cocok dengan filter ini
              </p>
              {(searchTerm || factoryFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFactoryFilter('ALL');
                  }}
                  className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                >
                  Reset filter pencarian
                </button>
              )}
            </div>
          ) : (
            (() => {
              const folders = groupRollsIntoFolders(
                filteredRolls,
                finishedBatches,
                notaGroupingMode
              );

              return (
                <>
                  {/* Folder Grouping Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#09090c] border border-zinc-800">
                      <span className="text-[10px] font-bold uppercase text-zinc-500 px-2">
                        Folder:
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotaGroupingMode('date')}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          notaGroupingMode === 'date'
                            ? 'bg-[#101218] text-amber-300 border border-amber-500/70'
                            : 'text-zinc-400 hover:text-white border border-transparent'
                        }`}
                      >
                        Per Tanggal
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotaGroupingMode('factory')}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          notaGroupingMode === 'factory'
                            ? 'bg-[#101218] text-amber-300 border border-amber-500/70'
                            : 'text-zinc-400 hover:text-white border border-transparent'
                        }`}
                      >
                        Per Pabrik
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-zinc-400 font-mono">
                        {folders.length} Folder • {filteredRolls.length} Gulungan
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          folders.forEach((f) => {
                            next[f.folderKey] = true;
                          });
                          setExpandedHistoryFolderKeys(next);
                        }}
                        className="h-7 px-2.5 rounded-lg bg-[#09090c] hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold cursor-pointer"
                      >
                        Buka Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          folders.forEach((f) => {
                            next[f.folderKey] = false;
                          });
                          setExpandedHistoryFolderKeys(next);
                        }}
                        className="h-7 px-2.5 rounded-lg bg-[#09090c] hover:bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold cursor-pointer"
                      >
                        Tutup Semua
                      </button>
                    </div>
                  </div>

                  {folders.map((folder, folderIdx) => {
                    const isFolderOpen =
                      expandedHistoryFolderKeys[folder.folderKey] !== undefined
                        ? expandedHistoryFolderKeys[folder.folderKey]
                        : folderIdx === 0;

                    return (
                      <div
                        key={folder.folderKey}
                        className="bg-[#09090c] border border-zinc-800 rounded-2xl overflow-hidden"
                      >
                        <button
                          type="button"
                          aria-expanded={isFolderOpen}
                          onClick={() =>
                            setExpandedHistoryFolderKeys((prev) => ({
                              ...prev,
                              [folder.folderKey]: !isFolderOpen,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 bg-black/70 hover:bg-zinc-950/90 flex flex-wrap items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isFolderOpen ? (
                              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
                            )}
                            <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                              {folder.folderLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 font-mono text-[11px] font-bold text-amber-300 tabular-nums shrink-0">
                              {folder.rolls.length} Gulungan
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-zinc-400 shrink-0">
                            <span>{folder.stats.totalSerials} Seri</span>
                            <span className="hidden sm:inline text-zinc-300">
                              {folder.stats.totalNettoKg} kg
                            </span>
                            <span className="text-white font-bold">
                              {formatRupiah(folder.stats.totalNotaRp)}
                            </span>
                            <span
                              className={`hidden sm:inline font-bold ${
                                folder.stats.totalProfitRp >= 0
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {folder.stats.totalProfitRp >= 0 ? '+' : ''}
                              {formatRupiah(folder.stats.totalProfitRp)}
                            </span>
                            {isFolderOpen ? (
                              <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                            )}
                          </div>
                        </button>

                        {isFolderOpen && (
                          <div className="p-3 border-t border-zinc-800/80 bg-black/30 space-y-2.5">
                            {/* Compact Grid of Roll Cards for Fast Scanning */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {folder.rolls.map((roll) => {
                                const activeInRoll = finishedBatches.filter(
                                  (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
                                );
                                const movedOutFromRoll = finishedBatches.filter(
                                  (b) =>
                                    b.rollId !== roll.id &&
                                    b.rollNumber !== roll.rollNumber &&
                                    (b.previousRollId === roll.id ||
                                      (b.previousRollNumber &&
                                        b.previousRollNumber.includes(roll.rollNumber)))
                                );

                                const isExpanded = !!expandedNotaRollIds[roll.id];
                                const formattedDate = new Date(
                                  roll.sampleCreatedDate
                                ).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                });

                                const sumNetto = activeInRoll.reduce(
                                  (acc, s) =>
                                    acc +
                                    Math.max(
                                      0,
                                      s.packaging.grossWeightPerPackage - s.factoryDeductionKg
                                    ),
                                  0
                                );
                                const sumModal = activeInRoll.reduce(
                                  (acc, s) => acc + getSerialModalRp(s),
                                  0
                                );
                                const sumNota = activeInRoll.reduce(
                                  (acc, s) => acc + getSerialNotaRp(s),
                                  0
                                );
                                const sumProfit = sumNota - sumModal;
                                const cairCount = activeInRoll.filter(
                                  (s) => s.factoryStatus === 'ACCEPTED_CAIR'
                                ).length;
                                const rejectCount =
                                  activeInRoll.filter((s) => s.factoryStatus === 'REJECTED_STOCK')
                                    .length + movedOutFromRoll.length;

                                return (
                                  <div
                                    key={roll.id}
                                    className={`rounded-xl border transition-colors ${
                                      isExpanded
                                        ? 'col-span-full bg-[#0a0c10] border-amber-500/70'
                                        : 'bg-[#0d0f14] border-zinc-800 hover:border-amber-500/60 flex flex-col justify-between'
                                    }`}
                                  >
                                    <div className={isExpanded ? 'p-3 flex flex-wrap items-center justify-between gap-2' : 'p-3 flex flex-col justify-between gap-2.5 h-full'}>
                                      <button
                                        type="button"
                                        aria-expanded={isExpanded}
                                        onClick={() =>
                                          setExpandedNotaRollIds((prev) => ({
                                            ...prev,
                                            [roll.id]: !prev[roll.id],
                                          }))
                                        }
                                        className="min-w-0 flex-1 text-left cursor-pointer space-y-1"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="px-1.5 py-0.5 rounded bg-black border border-amber-500/60 font-mono font-black text-[11px] text-amber-300 shrink-0">
                                            {roll.rollNumber}
                                          </span>
                                          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold shrink-0">
                                            {cairCount > 0 && (
                                              <span className="text-emerald-400">
                                                {cairCount} OK
                                              </span>
                                            )}
                                            {rejectCount > 0 && (
                                              <span className="text-rose-400">
                                                {rejectCount} Rej
                                              </span>
                                            )}
                                            {cairCount === 0 && rejectCount === 0 && (
                                              <span className="text-zinc-400">
                                                {activeInRoll.length} seri
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="font-bold text-white text-xs truncate">
                                          {roll.recipeName}
                                        </div>
                                        <div className="text-[11px] text-zinc-400 truncate">
                                          {roll.targetFactory} · {formattedDate}
                                        </div>
                                      </button>

                                      <div
                                        className={
                                          isExpanded
                                            ? 'flex items-center gap-2 shrink-0'
                                            : 'pt-2 border-t border-zinc-800/70 flex items-center justify-between gap-2'
                                        }
                                      >
                                        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums min-w-0">
                                          <span className="text-zinc-300 shrink-0">{sumNetto} kg</span>
                                          <span className="font-bold text-white truncate">
                                            {formatRupiah(sumNota)}
                                          </span>
                                          <span
                                            className={`hidden sm:inline font-bold shrink-0 ${
                                              sumProfit >= 0 ? 'text-amber-400' : 'text-rose-400'
                                            }`}
                                          >
                                            {sumProfit >= 0 ? '+' : ''}
                                            {formatRupiah(sumProfit)}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedNotaRollIds((prev) => ({
                                                ...prev,
                                                [roll.id]: !prev[roll.id],
                                              }))
                                            }
                                            aria-expanded={isExpanded}
                                            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                                              isExpanded
                                                ? 'bg-zinc-800 text-white'
                                                : 'bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700/80'
                                            }`}
                                          >
                                            <span>{isExpanded ? 'Tutup' : 'Buka'}</span>
                                            {isExpanded ? (
                                              <ChevronUp className="w-3 h-3 shrink-0" />
                                            ) : (
                                              <ChevronDown className="w-3 h-3 shrink-0" />
                                            )}
                                          </button>

                                          {onDeleteRoll && (
                                            <button
                                              type="button"
                                              aria-label={`Hapus Riwayat Gulungan ${roll.rollNumber}`}
                                              onClick={() => onDeleteRoll(roll.id)}
                                              className="h-7 w-7 shrink-0 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-500/40 flex items-center justify-center cursor-pointer transition-colors"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {isExpanded &&
                                      (() => {
                                        const allHistoricalSerials = [
                                          ...activeInRoll,
                                          ...movedOutFromRoll,
                                        ];
                                        const sheetMode =
                                          notaSheetModeMap[roll.id] || 'INTERNAL_COST';
                                        const sumBruto = activeInRoll.reduce(
                                          (acc, s) => acc + s.packaging.grossWeightPerPackage,
                                          0
                                        );
                                        const sumTara = activeInRoll.reduce(
                                          (acc, s) => acc + s.factoryDeductionKg,
                                          0
                                        );

                                        return (
                                          <div className="border-t border-zinc-800 bg-black/50 p-3.5 sm:p-4 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                              <div className="inline-flex p-0.5 rounded-lg bg-black border border-zinc-800 gap-1 self-start">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setNotaSheetModeMap((prev) => ({
                                                      ...prev,
                                                      [roll.id]: 'INTERNAL_COST',
                                                    }))
                                                  }
                                                  className={`h-7 px-3 rounded-md text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                                                    sheetMode === 'INTERNAL_COST'
                                                      ? 'bg-zinc-800 text-amber-300'
                                                      : 'text-zinc-400 hover:text-white'
                                                  }`}
                                                >
                                                  Arsip Personal (Modal &amp; Profit)
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setNotaSheetModeMap((prev) => ({
                                                      ...prev,
                                                      [roll.id]: 'FACTORY_NOTA',
                                                    }))
                                                  }
                                                  className={`h-7 px-3 rounded-md text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                                                    sheetMode === 'FACTORY_NOTA'
                                                      ? 'bg-zinc-800 text-amber-300'
                                                      : 'text-zinc-400 hover:text-white'
                                                  }`}
                                                >
                                                  Setor Pabrik (9 Kolom)
                                                </button>
                                              </div>

                                              <div className="flex items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleCopyRollNota(
                                                      roll,
                                                      activeInRoll,
                                                      sheetMode
                                                    )
                                                  }
                                                  className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                                >
                                                  {copiedKey === `${roll.id}-${sheetMode}` ? (
                                                    <>
                                                      <Check className="w-3.5 h-3.5 shrink-0" />{' '}
                                                      Tersalin
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="w-3.5 h-3.5 shrink-0" />{' '}
                                                      Salin TSV
                                                    </>
                                                  )}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleDownloadRollCsv(
                                                      roll,
                                                      activeInRoll,
                                                      sheetMode
                                                    )
                                                  }
                                                  className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                                >
                                                  <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />{' '}
                                                  CSV
                                                </button>
                                              </div>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#050507]">
                                              <table className="w-full text-left border-collapse font-mono tabular-nums text-xs">
                                                <thead>
                                                  <tr className="bg-zinc-900/90 text-zinc-300 border-b border-zinc-800 text-[11px] font-bold whitespace-nowrap">
                                                    <th className="py-2.5 px-3 w-10 text-center">
                                                      No
                                                    </th>
                                                    <th className="py-2.5 px-3">
                                                      {sheetMode === 'FACTORY_NOTA'
                                                        ? 'Seri'
                                                        : 'Seri & Jejak'}
                                                    </th>
                                                    {sheetMode === 'INTERNAL_COST' && (
                                                      <th className="py-2.5 px-3">Status</th>
                                                    )}
                                                    <th className="py-2.5 px-2.5 text-right">
                                                      Bruto
                                                    </th>
                                                    <th className="py-2.5 px-2.5 text-right">
                                                      Tara
                                                    </th>
                                                    <th className="py-2.5 px-2.5 text-right">
                                                      Netto
                                                    </th>
                                                    <th className="py-2.5 px-2.5 text-center">
                                                      Wadah
                                                    </th>
                                                    <th className="py-2.5 px-2.5 text-center">
                                                      Grade
                                                    </th>
                                                    {sheetMode === 'INTERNAL_COST' && (
                                                      <>
                                                        <th className="py-2.5 px-3 text-right">
                                                          Modal/kg
                                                        </th>
                                                        <th className="py-2.5 px-3 text-right">
                                                          Jml Modal
                                                        </th>
                                                      </>
                                                    )}
                                                    <th className="py-2.5 px-3 text-right">
                                                      {sheetMode === 'FACTORY_NOTA'
                                                        ? 'Harga'
                                                        : 'Harga/kg'}
                                                    </th>
                                                    <th className="py-2.5 px-3 text-right text-amber-300">
                                                      {sheetMode === 'FACTORY_NOTA'
                                                        ? 'Jumlah'
                                                        : 'Jml Nota'}
                                                    </th>
                                                    {sheetMode === 'INTERNAL_COST' && (
                                                      <th className="py-2.5 px-3 text-right text-amber-400">
                                                        Profit
                                                      </th>
                                                    )}
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-800/60">
                                                  {(sheetMode === 'FACTORY_NOTA' &&
                                                  activeInRoll.length > 0
                                                    ? activeInRoll
                                                    : allHistoricalSerials
                                                  ).map((s, idx) => {
                                                    const movedOut =
                                                      s.rollId !== roll.id &&
                                                      s.rollNumber !== roll.rollNumber;
                                                    const bruto =
                                                      s.packaging.grossWeightPerPackage;
                                                    const tara = s.factoryDeductionKg;
                                                    const netto = Math.max(0, bruto - tara);
                                                    const modalPerKg = Math.round(
                                                      s.effectiveHppAfterTaraPerKg ||
                                                        s.hppPerNetKg ||
                                                        0
                                                    );
                                                    const jumlahModal = getSerialModalRp(s);
                                                    const jumlahNota = getSerialNotaRp(s);
                                                    const profit = jumlahNota - jumlahModal;
                                                    const lineage = formatSerialLineage(s);
                                                    const sm = statusMeta(
                                                      s.factoryStatus || 'PENDING',
                                                      movedOut,
                                                      s.rollNumber
                                                    );

                                                    return (
                                                      <tr
                                                        key={`${roll.id}-${s.id}`}
                                                        className={`hover:bg-zinc-900/40 transition-colors ${
                                                          movedOut
                                                            ? 'text-zinc-500'
                                                            : 'text-zinc-200'
                                                        }`}
                                                      >
                                                        <td className="py-2 px-3 text-center text-zinc-500">
                                                          {idx + 1}
                                                        </td>
                                                        <td className="py-2 px-3 font-bold text-amber-400 whitespace-nowrap">
                                                          {sheetMode === 'FACTORY_NOTA'
                                                            ? s.serialNumber
                                                            : lineage}
                                                        </td>
                                                        {sheetMode === 'INTERNAL_COST' && (
                                                          <td className="py-2 px-3 whitespace-nowrap font-sans text-xs">
                                                            <span
                                                              className={`inline-flex items-center gap-1.5 font-semibold ${sm.textClass}`}
                                                            >
                                                              <span
                                                                className={`w-1.5 h-1.5 rounded-full ${sm.dotClass}`}
                                                              />
                                                              {sm.label}
                                                            </span>
                                                          </td>
                                                        )}
                                                        <td className="py-2 px-2.5 text-right">
                                                          {bruto}
                                                        </td>
                                                        <td className="py-2 px-2.5 text-right">
                                                          {tara}
                                                        </td>
                                                        <td className="py-2 px-2.5 text-right font-bold text-white">
                                                          {netto}
                                                        </td>
                                                        <td className="py-2 px-2.5 text-center font-sans text-[11px] text-zinc-300">
                                                          {s.packaging.packagingType}
                                                        </td>
                                                        <td className="py-2 px-2.5 text-center font-bold text-white">
                                                          {s.compositeColorGrade}
                                                        </td>
                                                        {sheetMode === 'INTERNAL_COST' && (
                                                          <>
                                                            <td className="py-2 px-3 text-right text-zinc-300">
                                                              {formatSheetRp(modalPerKg)}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-semibold text-white">
                                                              {formatSheetRp(jumlahModal)}
                                                            </td>
                                                          </>
                                                        )}
                                                        <td className="py-2 px-3 text-right text-zinc-200">
                                                          {formatSheetRp(s.factoryTargetPricePerKg)}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-bold text-white">
                                                          {formatSheetRp(jumlahNota)}
                                                        </td>
                                                        {sheetMode === 'INTERNAL_COST' && (
                                                          <td
                                                            className={`py-2 px-3 text-right font-bold ${
                                                              profit >= 0
                                                                ? 'text-amber-400'
                                                                : 'text-rose-400'
                                                            }`}
                                                          >
                                                            {formatSheetRp(profit)}
                                                          </td>
                                                        )}
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                                <tfoot>
                                                  <tr className="bg-zinc-900/90 border-t border-zinc-700 font-bold text-white whitespace-nowrap">
                                                    <td
                                                      colSpan={
                                                        sheetMode === 'FACTORY_NOTA' ? 2 : 3
                                                      }
                                                      className="py-2.5 px-3 text-amber-400"
                                                    >
                                                      Total Aktif ({activeInRoll.length} seri)
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-right">
                                                      {sumBruto}
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-right">
                                                      {sumTara}
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-right text-white">
                                                      {sumNetto}
                                                    </td>
                                                    <td colSpan={2} />
                                                    {sheetMode === 'INTERNAL_COST' && (
                                                      <>
                                                        <td />
                                                        <td className="py-2.5 px-3 text-right text-white">
                                                          {formatSheetRp(sumModal)}
                                                        </td>
                                                      </>
                                                    )}
                                                    <td />
                                                    <td className="py-2.5 px-3 text-right text-white">
                                                      {formatSheetRp(sumNota)}
                                                    </td>
                                                    {sheetMode === 'INTERNAL_COST' && (
                                                      <td
                                                        className={`py-2.5 px-3 text-right ${
                                                          sumProfit >= 0
                                                            ? 'text-amber-400'
                                                            : 'text-rose-400'
                                                        }`}
                                                      >
                                                        {formatSheetRp(sumProfit)}
                                                      </td>
                                                    )}
                                                  </tr>
                                                </tfoot>
                                              </table>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()
          )}
        </div>
      )}

      {/* 5. SEGMENT 2: DATA STATUS & JEJAK SEMUA SERI (ERGONOMIC LEDGER TABLE + MOBILE CARDS) */}
      {activeSegment === 'seri-status' && (
        <div className="space-y-3">
          {filteredSerials.length === 0 ? (
            <div className="bg-[#09090c] border border-zinc-800 rounded-2xl text-center py-12 px-4 space-y-2">
              <Package className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-white font-bold text-sm">
                Tidak ada Nomor Seri yang cocok dengan filter ini
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFactoryFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Tampilkan semua seri
              </button>
            </div>
          ) : (
            <>
              {/* Desktop High-Density Scannable Ledger Table */}
              <div className="hidden lg:block bg-[#09090c] border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-black/50 text-[11px] font-bold text-zinc-400 whitespace-nowrap">
                        <th className="py-2.5 pl-3.5 pr-2">Seri</th>
                        <th className="py-2.5 px-2">Gulungan &amp; Pabrik</th>
                        <th className="py-2.5 px-2 text-center">Grade</th>
                        <th className="py-2.5 px-2 text-right">Netto</th>
                        <th className="py-2.5 px-2 text-right">Modal</th>
                        <th className="py-2.5 px-2 text-right">Nota</th>
                        <th className="py-2.5 px-2 text-right">Profit</th>
                        <th className="py-2.5 px-2">Status</th>
                        <th className="py-2.5 pl-2 pr-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
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
                        const sm = statusMeta(status);

                        return (
                          <tr
                            key={s.id}
                            className="hover:bg-zinc-900/40 transition-colors align-middle"
                          >
                            <td className="py-3 pl-3.5 pr-2">
                              <div className="font-mono font-bold text-amber-400 whitespace-nowrap">
                                {lineage}
                              </div>
                              {(isRenamed || s.previousRollNumber) && (
                                <div className="text-[11px] text-zinc-400 font-mono mt-0.5 whitespace-nowrap">
                                  {s.previousRollNumber ? `ex ${s.previousRollNumber}` : 'Ganti Seri'}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-2">
                              <div className="max-w-[165px] xl:max-w-[200px]">
                                <div className="font-bold text-white truncate" title={s.targetFactory}>
                                  {s.targetFactory}
                                </div>
                                <div
                                  className="text-[11px] text-zinc-400 font-mono truncate"
                                  title={`${s.rollNumber || '-'} · ${s.recipeName}`}
                                >
                                  {s.rollNumber || '-'} · {s.recipeName}
                                </div>
                                {s.previousFactory && s.previousFactory !== s.targetFactory && (
                                  <div
                                    className="text-[11px] text-amber-300/90 mt-0.5 flex items-center gap-1"
                                    title={`${s.previousFactory} → ${s.targetFactory}`}
                                  >
                                    <span className="truncate">{s.previousFactory}</span>
                                    <ArrowRight className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{s.targetFactory}</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-2 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${gradeInfo.color}`}
                              >
                                {s.compositeColorGrade}
                              </span>
                            </td>

                            <td className="py-3 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                              <div className="font-bold text-white">{netto} kg</div>
                              <div className="text-[11px] text-zinc-400">
                                {bruto} − {tara} kg · {s.packaging.packagingType}
                              </div>
                            </td>

                            <td className="py-3 px-2 text-right font-mono tabular-nums text-zinc-300 whitespace-nowrap">
                              {formatRupiah(modalRp)}
                            </td>

                            <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-white whitespace-nowrap">
                              <div>{formatRupiah(notaRp)}</div>
                              <div className="text-[11px] text-zinc-400 font-normal">
                                {formatRupiah(s.factoryTargetPricePerKg)}/kg
                              </div>
                            </td>

                            <td
                              className={`py-3 px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                profitRp >= 0 ? 'text-amber-400' : 'text-rose-400'
                              }`}
                            >
                              {profitRp >= 0 ? '+' : ''}
                              {formatRupiah(profitRp)}
                            </td>

                            <td className="py-3 px-2 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 font-semibold ${sm.textClass}`}>
                                {status === 'ACCEPTED_CAIR' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                ) : status === 'REJECTED_STOCK' ? (
                                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>{sm.label}</span>
                              </span>
                            </td>

                            <td className="py-3 pl-2 pr-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {status === 'REJECTED_STOCK' && onGoToRejectedStock && (
                                  <button
                                    type="button"
                                    onClick={onGoToRejectedStock}
                                    className="h-7 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/50 text-[11px] font-bold cursor-pointer transition-colors"
                                  >
                                    Pindah
                                  </button>
                                )}
                                {onUpdateSerial && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingSerial(s)}
                                    aria-label={`Edit Seri ${s.serialNumber}`}
                                    className="h-7 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Pencil className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>Edit</span>
                                  </button>
                                )}
                                {onDeleteSerial && (
                                  <button
                                    type="button"
                                    aria-label={`Hapus Seri ${s.serialNumber}`}
                                    onClick={() => onDeleteSerial(s.id)}
                                    className="h-7 w-7 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-500/40 inline-flex items-center justify-center cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile & Tablet Clean Single-Level Cards (<lg) */}
              <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  const sm = statusMeta(status);

                  return (
                    <div
                      key={s.id}
                      className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-amber-400">
                              Seri {lineage}
                            </span>
                            <span className="text-xs font-mono text-zinc-400">
                              · Grade {s.compositeColorGrade}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-300 font-semibold mt-0.5">
                            {s.targetFactory} ·{' '}
                            <span className="font-mono text-zinc-400">{s.rollNumber || '-'}</span>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${sm.textClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dotClass}`} />
                          {sm.label}
                        </span>
                      </div>

                      {(s.previousRollNumber || s.previousFactory || isRenamed) && (
                        <div className="text-[11px] font-mono text-amber-300/90 border-t border-zinc-800/70 pt-2">
                          Jejak: {lineage}
                          {s.previousRollNumber ? ` · Eks-${s.previousRollNumber}` : ''}
                          {s.previousFactory ? ` (${s.previousFactory})` : ''}
                        </div>
                      )}

                      <div className="grid grid-cols-3 divide-x divide-zinc-800 border-y border-zinc-800/80 py-2 font-mono tabular-nums text-xs">
                        <div className="pr-2">
                          <div className="text-[10px] font-sans text-zinc-500">Netto</div>
                          <div className="font-bold text-white">{netto} kg</div>
                        </div>
                        <div className="px-2">
                          <div className="text-[10px] font-sans text-zinc-500">Nota</div>
                          <div className="font-bold text-white">{formatRupiah(notaRp)}</div>
                        </div>
                        <div className="pl-2 text-right">
                          <div className="text-[10px] font-sans text-zinc-500">Profit</div>
                          <div
                            className={`font-bold ${
                              profitRp >= 0 ? 'text-amber-400' : 'text-rose-400'
                            }`}
                          >
                            {profitRp >= 0 ? '+' : ''}
                            {formatRupiah(profitRp)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {status === 'REJECTED_STOCK' && onGoToRejectedStock && (
                          <button
                            type="button"
                            onClick={onGoToRejectedStock}
                            className="h-9 px-3 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/50 text-xs font-bold cursor-pointer mr-auto"
                          >
                            Pindah Gulungan
                          </button>
                        )}
                        {onUpdateSerial && (
                          <button
                            type="button"
                            onClick={() => setEditingSerial(s)}
                            className="h-9 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-400" />
                            <span>Edit</span>
                          </button>
                        )}
                        {onDeleteSerial && (
                          <button
                            type="button"
                            aria-label={`Hapus Seri ${s.serialNumber}`}
                            onClick={() => onDeleteSerial(s.id)}
                            className="h-9 w-9 rounded-lg text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/50 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
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
