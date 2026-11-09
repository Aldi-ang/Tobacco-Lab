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
    'ALL' | 'ACCEPTED_CAIR' | 'PENDING' | 'REJECTED_STOCK' | 'RENAMED_LINEAGE'
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

  const factories = [
    'ALL',
    ...Array.from(
      new Set([
        ...rollSamples.map((r) => r.targetFactory),
        ...finishedBatches.map((b) => b.targetFactory),
      ])
    ),
  ];

  // Aggregate global KPI metrics
  const cairBatches = finishedBatches.filter((b) => b.factoryStatus === 'ACCEPTED_CAIR');
  const pendingBatches = finishedBatches.filter(
    (b) => (b.factoryStatus || 'PENDING') === 'PENDING'
  );
  const rejectedBatches = finishedBatches.filter((b) => b.factoryStatus === 'REJECTED_STOCK');
  const renamedBatches = finishedBatches.filter(
    (b) => hasSerialLineage(b) || (b.transferHistory && b.transferHistory.length > 0)
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

  const totalAllNotaRp = finishedBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalCairRp = cairBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalPendingRp = pendingBatches.reduce((sum, s) => sum + getSerialNotaRp(s), 0);
  const totalProfitRp = finishedBatches.reduce(
    (sum, s) => sum + (getSerialNotaRp(s) - getSerialModalRp(s)),
    0
  );

  const openHistoryKpiCalc = (
    focus: 'TOTAL_NOTA' | 'CAIR_VALUE' | 'PENDING_VALUE' | 'TOTAL_PROFIT'
  ) => {
    if (focus === 'TOTAL_NOTA') {
      setCalcDetail({
        title: `1. Total Nilai Seluruh Nota Gulungan (${finishedBatches.length} Seri)`,
        subtitle: `Dari ${rollSamples.length} Gulungan Terdaftar`,
        badgeText: 'RIWAYAT NOTA • ASAL ANGKA TOTAL TAGIHAN NOTA',
        coreFormula: 'Total Tagihan Nota = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
        steps: finishedBatches.map((s, idx) => {
          const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
          const nota = getSerialNotaRp(s);
          return {
            stepNumber: idx + 1,
            title: `Seri ${formatSerialLineage(s)} (${s.rollNumber || '-'} • ${s.targetFactory})`,
            formula: `Netto Tagih = Bruto ${s.packaging.grossWeightPerPackage} kg − Tara ${s.factoryDeductionKg} kg = ${netto} kg`,
            substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
            resultLabel: 'Nota Seri',
            resultValue: formatRupiah(nota),
            explanation: `Tagihan nota pabrik untuk Seri ${formatSerialLineage(s)} (${netto} kg).`,
            highlight: 'amber' as const,
          };
        }),
        summaryRows: [
          {
            label: 'Jumlah Gulungan',
            value: `${rollSamples.length} Gulungan`,
            highlight: 'white',
          },
          {
            label: 'Jumlah Nomor Seri',
            value: `${finishedBatches.length} Seri`,
            highlight: 'white',
          },
          {
            label: 'Total Tagihan Nota',
            value: formatRupiah(totalAllNotaRp),
            highlight: 'amber',
          },
        ],
        conclusion: `Total Nilai Seluruh Nota Gulungan sebesar ${formatRupiah(totalAllNotaRp)} merupakan akumulasi tagihan dari ${finishedBatches.length} Nomor Seri.`,
      });
      return;
    }

    if (focus === 'CAIR_VALUE') {
      setCalcDetail({
        title: `2. Total Nilai Terima Cair (${cairBatches.length} Seri Diterima)`,
        subtitle: 'Uang Nota Pabrik yang Sudah Cair',
        badgeText: 'RIWAYAT CAIR • ASAL ANGKA UANG CAIR',
        coreFormula: 'Total Uang Cair = Σ Nota Seri berstatus ACCEPTED_CAIR',
        steps: cairBatches.map((s, idx) => {
          const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
          const nota = getSerialNotaRp(s);
          return {
            stepNumber: idx + 1,
            title: `Seri ${formatSerialLineage(s)} (${s.rollNumber || '-'} • ${s.targetFactory})`,
            formula: `Netto Tagih ${netto} kg × Harga Pabrik ${formatRupiah(s.factoryTargetPricePerKg)}`,
            substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
            resultLabel: 'Uang Cair',
            resultValue: formatRupiah(nota),
            explanation: `Uang cair dari Seri ${formatSerialLineage(s)} di ${s.targetFactory}.`,
            highlight: 'amber' as const,
          };
        }),
        summaryRows: [
          {
            label: 'Jumlah Seri Cair',
            value: `${cairBatches.length} Seri`,
            highlight: 'white',
          },
          {
            label: 'Total Uang Cair',
            value: formatRupiah(totalCairRp),
            highlight: 'amber',
          },
        ],
        conclusion: `Total Uang Cair sebesar ${formatRupiah(totalCairRp)} berasal dari ${cairBatches.length} Nomor Seri yang telah diverifikasi Terima Cair oleh pabrik.`,
      });
      return;
    }

    if (focus === 'PENDING_VALUE') {
      setCalcDetail({
        title: `3. Total Nilai Menunggu QC (${pendingBatches.length} Seri Pending)`,
        subtitle: 'Tagihan Seri yang Sedang Diperiksa Pabrik',
        badgeText: 'RIWAYAT PENDING • ASAL ANGKA MENUNGGU QC',
        coreFormula: 'Total Menunggu QC = Σ Nota Seri berstatus PENDING',
        steps: pendingBatches.map((s, idx) => {
          const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
          const nota = getSerialNotaRp(s);
          return {
            stepNumber: idx + 1,
            title: `Seri ${formatSerialLineage(s)} (${s.rollNumber || '-'} • ${s.targetFactory})`,
            formula: `Netto Tagih ${netto} kg × Harga Pabrik ${formatRupiah(s.factoryTargetPricePerKg)}`,
            substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${formatRupiah(nota)}`,
            resultLabel: 'Nilai Pending',
            resultValue: formatRupiah(nota),
            explanation: `Menunggu keputusan QC pabrik untuk Seri ${formatSerialLineage(s)}.`,
            highlight: 'white' as const,
          };
        }),
        summaryRows: [
          {
            label: 'Jumlah Seri Menunggu QC',
            value: `${pendingBatches.length} Seri`,
            highlight: 'white',
          },
          {
            label: 'Total Nilai Menunggu QC',
            value: formatRupiah(totalPendingRp),
            highlight: 'amber',
          },
        ],
        conclusion: `Total Nilai Menunggu QC sebesar ${formatRupiah(totalPendingRp)} berasal dari ${pendingBatches.length} Nomor Seri yang sedang menunggu keputusan QC pabrik.`,
      });
      return;
    }

    // TOTAL_PROFIT
    setCalcDetail({
      title: `4. Total Profit Bersih Keseluruhan (${finishedBatches.length} Seri)`,
      subtitle: 'Selisih Total Tagihan Nota Pabrik dikurangi Total Modal Produksi',
      badgeText: 'RIWAYAT PROFIT • ASAL ANGKA PROFIT BERSIH',
      coreFormula: 'Total Profit = Σ (Jumlah Nota Pabrik − Total Modal Produksi)',
      steps: finishedBatches.map((s, idx) => {
        const nota = getSerialNotaRp(s);
        const modal = getSerialModalRp(s);
        const profit = nota - modal;
        return {
          stepNumber: idx + 1,
          title: `Seri ${formatSerialLineage(s)} (${s.rollNumber || '-'})`,
          formula: `Profit = Nota ${formatRupiah(nota)} − Modal ${formatRupiah(modal)}`,
          substitution: `${formatRupiah(nota)} − ${formatRupiah(modal)} = ${profit >= 0 ? '+' : ''}${formatRupiah(profit)}`,
          resultLabel: 'Profit Seri',
          resultValue: `${profit >= 0 ? '+' : ''}${formatRupiah(profit)}`,
          explanation: `Selisih tagihan nota terhadap modal produksi Seri ${formatSerialLineage(s)}.`,
          highlight: (profit >= 0 ? 'amber' : 'red') as 'amber' | 'red',
        };
      }),
      summaryRows: [
        {
          label: 'Total Tagihan Nota',
          value: formatRupiah(totalAllNotaRp),
          highlight: 'white',
        },
        {
          label: 'Total Profit Bersih',
          value: `${totalProfitRp >= 0 ? '+' : ''}${formatRupiah(totalProfitRp)}`,
          highlight: totalProfitRp >= 0 ? 'amber' : 'red',
        },
      ],
      conclusion: `Total Profit Bersih sebesar ${totalProfitRp >= 0 ? '+' : ''}${formatRupiah(totalProfitRp)} diperoleh dari selisih tagihan nota seluruh seri terhadap modal produksinya.`,
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
                  badge: rollSamples.length,
                },
                {
                  id: 'seri-status',
                  label: '2. Data Status Semua Seri',
                  fullLabel: '2. Data Status Semua Seri & Riwayat Ganti Seri (AK 1 -> AL 1)',
                  icon: <History className="w-3.5 h-3.5" />,
                  badge: finishedBatches.length,
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

        {/* 4 Summary KPI Panels with ƒx Symbol Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-800/90">
          <button
            type="button"
            onClick={() => openHistoryKpiCalc('TOTAL_NOTA')}
            className="text-left bg-black p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400 truncate">
                1. Total Nilai Nota ({rollSamples.length} Gulungan)
              </span>
              <CalcSymbolBadge />
            </div>
            <div className="font-mono font-black text-white text-sm sm:text-base">
              {formatRupiah(totalAllNotaRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Total {finishedBatches.length} Nomor Seri Terdaftar
            </div>
          </button>

          <button
            type="button"
            onClick={() => openHistoryKpiCalc('CAIR_VALUE')}
            className="text-left bg-black p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase text-amber-300 truncate">
                2. Diterima &amp; Uang Cair
              </span>
              <CalcSymbolBadge />
            </div>
            <div className="font-mono font-black text-amber-400 text-sm sm:text-base">
              {formatRupiah(totalCairRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              {cairBatches.length} Seri Cair • {rejectedBatches.length} Seri di Stok Reject
            </div>
          </button>

          <button
            type="button"
            onClick={() => openHistoryKpiCalc('PENDING_VALUE')}
            className="text-left bg-black p-3 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between space-y-1"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase text-zinc-300 truncate">
                3. Nilai Menunggu QC
              </span>
              <CalcSymbolBadge />
            </div>
            <div className="font-mono font-black text-white text-sm sm:text-base">
              {formatRupiah(totalPendingRp)}
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              {pendingBatches.length} Seri Menunggu QC • {renamedBatches.length} Seri Ganti/Pindah
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
            <div className="text-[10px] font-mono text-zinc-400">
              Σ (Nota Pabrik − Modal Produksi)
            </div>
          </button>
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
              { id: 'ALL', label: `Semua Seri (${finishedBatches.length})` },
              { id: 'ACCEPTED_CAIR', label: `Terima Cair (${cairBatches.length})` },
              { id: 'PENDING', label: `Menunggu QC (${pendingBatches.length})` },
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
                          Terima Cair: <b>{cairCount}</b>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-white">
                          Menunggu QC: <b>{pendingCount}</b>
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
                                          ACCEPTED
                                        </span>
                                      ) : s.factoryStatus === 'REJECTED_STOCK' ? (
                                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-white border border-zinc-600 font-bold">
                                          REJECTED
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-700">
                                          MENUNGGU QC
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
                                  <span>ACCEPTED</span>
                                </>
                              ) : status === 'REJECTED_STOCK' ? (
                                <>
                                  <RotateCcw className="w-3 h-3 text-amber-400" />
                                  <span>REJECTED</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>MENUNGGU QC</span>
                                </>
                              )}
                            </span>
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
