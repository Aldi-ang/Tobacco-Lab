import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Search,
  Scroll,
  Trash2,
  Building2,
  LayoutGrid,
  FolderKanban,
  X,
  Layers,
  ExternalLink,
  DollarSign,
  RotateCcw,
  FileSpreadsheet,
  Copy,
  Check,
  Download,
  SlidersHorizontal,
  Edit3,
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  formatSheetRp,
  clampRating5,
  buildFinishedBatchSyncCsv,
} from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import { SpinningStatTicker } from './SpinningStatTicker';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
  SerialFactoryCalcFocus,
  buildSerialFactoryCalcDetail,
} from './CalculationDetailModal';
import { EditFinishedSerialModal } from './EditFinishedSerialModal';

interface FinishedTobaccoListProps {
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
  onOpenRoll: (rollId: string) => void;
  onUpdateSerial?: (updated: FinishedTobaccoSerial) => void;
  onDelete: (id: string) => void;
}

export const FinishedTobaccoList: React.FC<FinishedTobaccoListProps> = ({
  finishedBatches,
  rollSamples,
  packagingList = [],
  factoryList = [],
  onOpenRoll,
  onUpdateSerial,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [selectedRollFilter, setSelectedRollFilter] = useState<string>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid-3d' | 'by-gulungan' | 'csv-sync'>('grid-3d');
  const [activeSerial, setActiveSerial] = useState<FinishedTobaccoSerial | null>(null);
  const [editingSerial, setEditingSerial] = useState<FinishedTobaccoSerial | null>(null);
  const [copiedMode, setCopiedMode] = useState<'CSV' | 'TSV' | null>(null);
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  const factories = ['ALL', ...Array.from(new Set(finishedBatches.map((b) => b.targetFactory)))];

  const filtered = finishedBatches.filter((b) => {
    const matchSearch =
      b.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.recipeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.targetFactory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.rollNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchFactory = selectedFactory === 'ALL' || b.targetFactory === selectedFactory;
    const matchRoll = selectedRollFilter === 'ALL' || b.rollId === selectedRollFilter;

    return matchSearch && matchFactory && matchRoll;
  });

  // Live CSV & TSV strings for data synchronization
  const csvSyncText = buildFinishedBatchSyncCsv({
    batches: filtered,
    separator: ',',
  });

  const tsvSyncText = buildFinishedBatchSyncCsv({
    batches: filtered,
    separator: '\t',
  });

  const handleCopySyncData = (sep: ',' | '\t') => {
    const text = sep === ',' ? csvSyncText : tsvSyncText;
    navigator.clipboard.writeText(text);
    setCopiedMode(sep === ',' ? 'CSV' : 'TSV');
    setTimeout(() => setCopiedMode(null), 2500);
  };

  const handleDownloadSyncCsv = () => {
    const blob = new Blob([csvSyncText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `sinkronisasi_tembakau_jadi_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Totals for CSV Sync Preview
  const sumBruto = filtered.reduce(
    (acc, s) => acc + (s.packaging.grossWeightPerPackage || 0),
    0
  );
  const sumTara = filtered.reduce((acc, s) => acc + (s.factoryDeductionKg || 0), 0);
  const sumNetto = filtered.reduce(
    (acc, s) =>
      acc + Math.max(0, (s.packaging.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0)),
    0
  );
  const sumProdCost = filtered.reduce((acc, s) => {
    const netto = Math.max(
      0,
      (s.packaging.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0)
    );
    const costPerKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg || 0);
    return acc + Math.round(s.totalProductionCost || netto * costPerKg);
  }, 0);
  const sumBillable = filtered.reduce((acc, s) => {
    const netto = Math.max(
      0,
      (s.packaging.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0)
    );
    return acc + Math.round(netto * (s.factoryTargetPricePerKg || 0));
  }, 0);
  const sumProfit = sumBillable - sumProdCost;

  // Render a single 2-per-row Seri Jadi card (slightly longer vertically with All 5 Character Parameters inside Moving Panel)
  const render3DCard = (batch: FinishedTobaccoSerial, idx: number) => {
    const gradeInfo = GRADE_LABELS[batch.compositeColorGrade] || GRADE_LABELS['D'];
    const linkedRoll = rollSamples.find((r) => r.id === batch.rollId);
    const rollCode = batch.rollNumber || linkedRoll?.rollNumber || 'GUL-2026-001';
    const brutoKg =
      batch.packaging.grossWeightPerPackage * (batch.packaging.packageCount || 1);
    const nettoKg = batch.factoryNetBillableKg;
    const realTobaccoNetKg =
      batch.packaging.netTobaccoWeightKg ??
      batch.totalBlendNetKg ??
      Math.max(0, brutoKg - (batch.packaging.packagingMassKg ?? batch.factoryDeductionKg));
    const realPkgMassKg =
      batch.packaging.packagingMassKg ??
      Number(Math.max(0, brutoKg - realTobaccoNetKg).toFixed(2));
    const factoryWeightProfitKg =
      batch.factoryWeightProfitKg ?? Number((nettoKg - realTobaccoNetKg).toFixed(2));
    const factoryWeightProfitRp =
      batch.factoryWeightProfitRp ??
      Math.round(factoryWeightProfitKg * (batch.factoryTargetPricePerKg || 0));
    const status = batch.factoryStatus || 'PENDING';
    const profitRp = batch.projectedRevenue - batch.totalProductionCost;

    const power5 = clampRating5(batch.weightedPower);
    const impact5 = clampRating5(batch.weightedImpact);
    const bitter5 = clampRating5(batch.weightedBitter);
    const burn5 = clampRating5(batch.weightedBurn ?? 4.5);
    const sugar5 = clampRating5(batch.weightedSugar ?? 4.0);

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
        id: 'profit-seri',
        shortTab: 'Profit',
        label: 'Profit & Nota',
        value: `${profitRp >= 0 ? '+' : ''}${formatRupiah(profitRp)}`,
        subValue: 'Profit',
        detailLine: `Nota: ${formatRupiah(batch.projectedRevenue)}`,
        accent: 'amber' as const,
      },
      {
        id: 'timbangan',
        shortTab: 'Berat',
        label: 'Netto Tagih vs Riil',
        value: `Tagih ${nettoKg}kg • Riil ${realTobaccoNetKg}kg`,
        subValue: `Tarra -${batch.factoryDeductionKg}kg`,
        detailLine: `Bruto ${brutoKg}kg • Wadah ${realPkgMassKg}kg`,
        accent: 'white' as const,
      },
      {
        id: 'modal-kita',
        shortTab: 'Modal',
        label: 'Modal Produksi',
        value: `${formatRupiah(batch.hppPerNetKg)}/kg`,
        subValue: 'HPP',
        detailLine: `Total: ${formatRupiah(batch.totalProductionCost)}`,
        accent: 'white' as const,
      },
    ];

    return (
      <motion.div
        key={batch.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3 }}
        transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
        onClick={() => setActiveSerial(batch)}
        className="text-left group relative requiem-card border-2 border-zinc-700/90 hover:border-amber-500/80 rounded-2xl p-3.5 sm:p-4 shadow-[0_7px_0_0_#18181b,0_14px_26px_rgba(0,0,0,0.9)] hover:shadow-[0_8px_0_0_#f59e0b,0_16px_30px_rgba(245,158,11,0.18)] transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[304px] sm:min-h-[318px]"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1">
            <span className="px-2 py-0.5 rounded-lg bg-black text-amber-400 border border-zinc-700 font-mono font-black text-[11px] sm:text-xs tracking-wide shrink-0">
              SERI {batch.serialNumber}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${gradeInfo.color}`}
            >
              Grade {batch.compositeColorGrade}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-white font-bold truncate">
            <Building2 className="w-3 h-3 text-zinc-300 shrink-0" />
            <span className="truncate">{batch.targetFactory}</span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[10px]">
            <span className="inline-flex items-center gap-1 text-amber-400 font-mono font-bold truncate">
              <Scroll className="w-2.5 h-2.5 shrink-0" /> {rollCode}
            </span>
            {status === 'ACCEPTED_CAIR' && (
              <span className="inline-flex items-center gap-0.5 text-amber-400 font-black text-[9px] shrink-0">
                <DollarSign className="w-2.5 h-2.5" /> Cair
              </span>
            )}
            {status === 'REJECTED_STOCK' && (
              <span className="inline-flex items-center gap-0.5 text-zinc-300 font-bold text-[9px] shrink-0">
                <RotateCcw className="w-2.5 h-2.5 text-zinc-300" /> Reject
              </span>
            )}
          </div>

          {/* Permanent Summary Box with Real vs Billable Net Weight & Factory Weight Profit/Loss */}
          <div className="bg-zinc-950/95 border border-zinc-800/90 rounded-xl px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-bold uppercase text-zinc-400">
                Riil / Tagih
              </span>
              <span className="font-mono font-black text-[11px] sm:text-xs text-white whitespace-nowrap">
                {realTobaccoNetKg} kg / <span className="text-amber-400">{nettoKg} kg</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
              <span className="text-[9px] font-bold uppercase text-zinc-400">
                Harga Pabrik
              </span>
              <span className="font-mono font-black text-[11px] sm:text-xs text-zinc-200 whitespace-nowrap">
                {formatRupiah(batch.factoryTargetPricePerKg)}
              </span>
            </div>
            {factoryWeightProfitKg !== 0 && (
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
                <span className="text-[9px] font-black uppercase text-zinc-200">
                  Selisih Timbangan
                </span>
                <span
                  className={`font-mono font-black text-[10px] sm:text-[11px] whitespace-nowrap ${
                    factoryWeightProfitKg > 0 ? 'text-zinc-200' : 'text-red-400'
                  }`}
                >
                  {factoryWeightProfitKg > 0 ? '+' : ''}
                  {factoryWeightProfitKg} kg ({factoryWeightProfitRp > 0 ? '+' : ''}
                  {formatRupiah(factoryWeightProfitRp)})
                </span>
              </div>
            )}
          </div>

          {/* Moving Panel with All 5 Character Parameters (/5) & Profit Breakdown */}
          <SpinningStatTicker items={tickerItems} intervalMs={3200 + (idx % 3) * 350} />
        </div>

        <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-center justify-between gap-2 text-[10px] text-zinc-400 group-hover:text-white transition-colors">
          <span className="truncate max-w-[90px]">{batch.packaging.packagingType}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {onUpdateSerial && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingSerial(batch);
                }}
                className="px-2 py-0.5 rounded-md bg-black hover:bg-zinc-900 text-amber-400 border border-zinc-700 hover:border-amber-500/70 font-black text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                title={`Edit Seri ${batch.serialNumber}`}
              >
                <Edit3 className="w-2.5 h-2.5" />
                <span>Edit</span>
              </button>
            )}
            <span className="font-bold shrink-0">Rincian →</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // Group filtered batches by Gulungan
  const groupedByRoll = rollSamples
    .map((roll) => ({
      roll,
      items: filtered.filter((b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3 pb-20 md:pb-4">
      {/* Slideable Button Panel Only */}
      <SegmentedControl
        value={viewMode}
        onChange={setViewMode}
        options={[
          {
            id: 'grid-3d',
            label: 'Kartu Seri',
            fullLabel: 'Tampilkan Semua Kartu Nomor Seri',
            icon: <LayoutGrid className="w-3.5 h-3.5" />,
            badge: filtered.length,
          },
          {
            id: 'by-gulungan',
            label: 'Per Gulungan',
            fullLabel: 'Kelompokkan Nomor Seri Berdasarkan Gulungan',
            icon: <FolderKanban className="w-3.5 h-3.5" />,
          },
          {
            id: 'csv-sync',
            label: 'Sinkron CSV',
            fullLabel:
              'Sinkronisasi Data Batch (Modal Produksi & Harga Tagih) ke CSV / Google Sheets',
            icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
          },
        ]}
      />

      {/* Minimalist Search Bar + Collapsible Filter */}
      <div className="requiem-card p-3 rounded-xl border border-zinc-800/90 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor seri (57, 58...), gulungan (GUL-...), atau pabrik..."
              className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700"
            />
          </div>

          <button
            type="button"
            title="Tampilkan / Sembunyikan Filter Gulungan & Pabrik"
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
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-900 overflow-hidden"
            >
              <select
                value={selectedRollFilter}
                onChange={(e) => setSelectedRollFilter(e.target.value)}
                className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-bold focus:outline-hidden focus:border-zinc-700"
                aria-label="Filter Gulungan Sampel"
              >
                <option value="ALL">Semua Gulungan Sampel</option>
                {rollSamples.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rollNumber} — {r.recipeName}
                  </option>
                ))}
              </select>

              <select
                value={selectedFactory}
                onChange={(e) => setSelectedFactory(e.target.value)}
                className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-zinc-700"
                aria-label="Filter Pabrik Tujuan"
              >
                <option value="ALL">Semua Pabrik Tujuan</option>
                {factories
                  .filter((f) => f !== 'ALL')
                  .map((fac) => (
                    <option key={fac} value={fac}>
                      {fac}
                    </option>
                  ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
          <Package className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <p className="text-white font-bold text-sm">Tidak ada Nomor Seri yang ditemukan</p>
        </div>
      ) : viewMode === 'csv-sync' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Action Toolbar inside CSV Sync Mode */}
          <div className="requiem-card p-4 rounded-2xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 block">
                Sinkronisasi Batch Tembakau Jadi ({filtered.length} Seri)
              </span>
              <p className="text-xs text-zinc-400">
                Mencakup kolom <b>Modal Produksi</b>, <b>Harga Tagih Pabrik</b>, dan <b>Profit Bersih</b>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                title="Salin Format CSV Koma (,)"
                onClick={() => handleCopySyncData(',')}
                className="btn-amber-outline min-h-9 px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copiedMode === 'CSV' ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Salin CSV
                  </>
                )}
              </button>

              <button
                type="button"
                title="Salin Format Tab untuk Paste Langsung ke Google Sheets"
                onClick={() => handleCopySyncData('\t')}
                className="btn-amber-outline min-h-9 px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copiedMode === 'TSV' ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Siap Paste!
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Salin Sheet
                  </>
                )}
              </button>

              <button
                type="button"
                title="Unduh File CSV"
                onClick={handleDownloadSyncCsv}
                className="min-h-9 px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-900 text-white border border-zinc-700 hover:border-zinc-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-zinc-300" /> .CSV
              </button>
            </div>
          </div>

          {/* Structured Synchronized Table Preview */}
          <div className="requiem-card border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-black border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-white">
                Tabel Sinkronisasi Modal Produksi vs Harga Tagih
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Total Profit: <b className="text-white">{formatRupiah(sumProfit)}</b>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="bg-zinc-900/90 text-white border-b border-zinc-800 text-center font-black">
                    <th className="py-2.5 px-2 border-r border-zinc-800">NO</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">SERI</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">PABRIK</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">GULUNGAN</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">PACKAGING</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">GRADE</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">BRUTO</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">TARA</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800">NETTO</th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-zinc-200">
                      MODAL PRODUKSI/KG
                    </th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-zinc-200">
                      TOTAL MODAL PRODUKSI
                    </th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-white">
                      HARGA TAGIH/KG
                    </th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-white">
                      TOTAL TAGIHAN NOTA
                    </th>
                    <th className="py-2.5 px-2">PROFIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-center">
                  {filtered.map((b, idx) => {
                    const bruto = b.packaging.grossWeightPerPackage;
                    const tara = b.factoryDeductionKg;
                    const netto = Math.max(0, bruto - tara);
                    const prodCostKg = Math.round(
                      b.effectiveHppAfterTaraPerKg || b.hppPerNetKg || 0
                    );
                    const totalProdCost = Math.round(
                      b.totalProductionCost || netto * prodCostKg
                    );
                    const billableKg = Math.round(b.factoryTargetPricePerKg || 0);
                    const totalBillable = Math.round(netto * billableKg);
                    const profit = totalBillable - totalProdCost;

                    return (
                      <tr key={b.id} className="hover:bg-zinc-950/90 text-zinc-200">
                        <td className="py-2 px-2 border-r border-zinc-900">{idx + 1}</td>
                        <td className="py-2 px-2 border-r border-zinc-900 font-black text-white">
                          {b.serialNumber}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-left">
                          {b.targetFactory}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-white">
                          {b.rollNumber || '-'}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 uppercase">
                          {b.packaging.packagingType}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 font-bold text-white">
                          {b.compositeColorGrade}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900">{bruto}</td>
                        <td className="py-2 px-2 border-r border-zinc-900">{tara}</td>
                        <td className="py-2 px-2 border-r border-zinc-900 font-bold text-white">
                          {netto}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-right text-zinc-300">
                          {formatSheetRp(prodCostKg)}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-right font-bold text-white">
                          {formatSheetRp(totalProdCost)}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-right text-white font-bold">
                          {formatSheetRp(billableKg)}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-right font-black text-white">
                          {formatSheetRp(totalBillable)}
                        </td>
                        <td className="py-2 px-2 text-right font-black text-white">
                          {formatSheetRp(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-900 border-t-2 border-zinc-800 font-black text-white text-center">
                    <td colSpan={6} className="py-2.5 px-3 border-r border-zinc-800 text-left text-white">
                      TOTAL ({filtered.length} SERI)
                    </td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-white">
                      {sumBruto}
                    </td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-white">
                      {sumTara}
                    </td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-white">
                      {sumNetto}
                    </td>
                    <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-white">
                      {formatSheetRp(sumProdCost)}
                    </td>
                    <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-white">
                      {formatSheetRp(sumBillable)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-white">
                      {formatSheetRp(sumProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Raw CSV Text Box */}
          <div className="requiem-card border border-zinc-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-extrabold text-zinc-200 uppercase tracking-wider block">
              Struktur CSV Mentah (Siap Copy-Paste ke Google Sheets)
            </span>
            <textarea
              readOnly
              value={csvSyncText}
              rows={6}
              aria-label="Output CSV Sinkronisasi Batch"
              className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-[11px] font-mono text-zinc-300 focus:outline-hidden focus:border-zinc-700"
            />
          </div>
        </motion.div>
      ) : viewMode === 'grid-3d' ? (
        /* Dynamic CSS Grid: 1 card per row on small phones (<420px), 2 per row when space permits (>=420px), 3-4 on larger screens */
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((batch, idx) => render3DCard(batch, idx))}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByRoll.map(({ roll, items }) => (
            <div
              key={roll.id}
              className="requiem-card border border-zinc-800 rounded-2xl p-3.5 sm:p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-zinc-700 font-mono font-black text-xs">
                    {roll.rollNumber}
                  </span>
                  <div>
                    <h2 className="font-extrabold text-white text-sm sm:text-base">
                      {roll.recipeName}
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Pabrik: <b className="text-white">{roll.targetFactory}</b> •{' '}
                      {roll.sampleCreatedDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 bg-black px-2.5 py-1 rounded-lg border border-zinc-800">
                    {items.length} Seri
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenRoll(roll.id)}
                    className="btn-amber-outline min-h-8 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Gulungan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {items.map((batch, idx) => render3DCard(batch, idx))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal when a Seri Card is pressed */}
      <AnimatePresence>
        {activeSerial && (
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
              className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-black text-amber-400 border border-zinc-700 font-mono font-black text-xs sm:text-sm tracking-wide">
                    SERI {activeSerial.serialNumber}
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white">
                      {activeSerial.recipeName || 'Kemasan Tembakau Jadi'}
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Pabrik: <b className="text-white">{activeSerial.targetFactory}</b> •{' '}
                      {activeSerial.createdAt}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSerial(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
                  aria-label="Tutup detail seri"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
                  {/* Packaging & Tara + Factory Weight Profit/Loss */}
                  {(() => {
                    const bruto = activeSerial.packaging.grossWeightPerPackage;
                    const realNet =
                      activeSerial.packaging.netTobaccoWeightKg ??
                      activeSerial.totalBlendNetKg ??
                      Math.max(
                        0,
                        bruto -
                          (activeSerial.packaging.packagingMassKg ??
                            activeSerial.factoryDeductionKg)
                      );
                    const realPkg =
                      activeSerial.packaging.packagingMassKg ??
                      Number(Math.max(0, bruto - realNet).toFixed(2));
                    const wpKg =
                      activeSerial.factoryWeightProfitKg ??
                      Number((activeSerial.factoryNetBillableKg - realNet).toFixed(2));
                    const wpRp =
                      activeSerial.factoryWeightProfitRp ??
                      Math.round(wpKg * (activeSerial.factoryTargetPricePerKg || 0));

                    const openSeriCalcDetail = (focus: SerialFactoryCalcFocus) => {
                      setCalcDetail(
                        buildSerialFactoryCalcDetail({
                          serialNumber: activeSerial.serialNumber,
                          packagingType: activeSerial.packaging.packagingType,
                          targetFactory: activeSerial.targetFactory,
                          brutoKg: bruto,
                          realTobaccoNetKg: realNet,
                          realPackagingMassKg: realPkg,
                          factoryTaraPercent:
                            activeSerial.packaging.factoryTaraFormula?.percent ?? 0,
                          factoryTaraFlatKg:
                            activeSerial.packaging.factoryTaraFormula?.flatKg ??
                            activeSerial.factoryDeductionKg,
                          factorySampleKg:
                            activeSerial.packaging.factoryTaraFormula?.sampleKg ?? 0,
                          factoryDeductionKg: activeSerial.factoryDeductionKg,
                          factoryBillableNetKg: activeSerial.factoryNetBillableKg,
                          materialCostRp: activeSerial.totalMaterialCost,
                          overheadCostRp: activeSerial.totalOverheadCost,
                          totalProductionCostRp: activeSerial.totalProductionCost,
                          hppPerNetKg: activeSerial.hppPerNetKg,
                          factoryPricePerKg: activeSerial.factoryTargetPricePerKg,
                          focus,
                        })
                      );
                    };

                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => openSeriCalcDetail('FACTORY_WEIGHT')}
                          className="text-left group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-2"
                        >
                          <div className="space-y-1.5 w-full">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-extrabold uppercase tracking-wider text-zinc-200 truncate">
                                1. Timbangan Riil vs Potongan Pabrik
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Kemasan:</span>
                              <b className="text-white">{activeSerial.packaging.packagingType}</b>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Bruto (Tembakau {realNet}kg + Wadah {realPkg}kg):</span>
                              <b className="font-mono text-white">{bruto} kg</b>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Potongan Tarra Pabrik:</span>
                              <b className="font-mono text-white">
                                -{activeSerial.factoryDeductionKg} kg
                              </b>
                            </div>
                            <div className="flex justify-between text-white pt-1 border-t border-zinc-900 font-black">
                              <span>Netto Tagih Pabrik:</span>
                              <span className="font-mono text-amber-400 text-sm">
                                {activeSerial.factoryNetBillableKg} kg
                              </span>
                            </div>
                          </div>
                          <div className="w-full pt-1.5 border-t border-zinc-900 flex justify-between text-zinc-200 font-bold">
                            <span>Selisih Timbangan Pabrik:</span>
                            <span
                              className={`font-mono font-black ${
                                wpKg >= 0 ? 'text-zinc-200' : 'text-red-400'
                              }`}
                            >
                              {wpKg >= 0 ? '+' : ''}
                              {wpKg} kg ({wpRp >= 0 ? '+' : ''}
                              {formatRupiah(wpRp)})
                            </span>
                          </div>
                        </button>

                        {/* Cost, Factory Price & Profit */}
                        <button
                          type="button"
                          onClick={() => openSeriCalcDetail('FACTORY_PROFIT')}
                          className="text-left group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-2"
                        >
                          <div className="space-y-1.5 w-full">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-extrabold uppercase tracking-wider text-zinc-200 truncate">
                                2. Modal, Harga Pabrik & Profit
                              </span>
                              <CalcSymbolBadge />
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Modal / KG:</span>
                              <b className="font-mono text-white">
                                {formatRupiah(activeSerial.hppPerNetKg)}
                              </b>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Harga Pabrik / KG:</span>
                              <b className="font-mono text-zinc-200">
                                {formatRupiah(activeSerial.factoryTargetPricePerKg)}
                              </b>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Total Modal Kita:</span>
                              <b className="font-mono text-white">
                                {formatRupiah(activeSerial.totalProductionCost)}
                              </b>
                            </div>
                            <div className="flex justify-between text-zinc-300">
                              <span>Jumlah Nota Pabrik:</span>
                              <b className="font-mono text-zinc-200">
                                {formatRupiah(activeSerial.projectedRevenue)}
                              </b>
                            </div>
                          </div>
                          <div className="w-full pt-1.5 border-t border-zinc-900 flex justify-between text-white font-black">
                            <span>PROFIT SERI:</span>
                            <span className="font-mono text-white">
                              {formatRupiah(
                                activeSerial.projectedRevenue - activeSerial.totalProductionCost
                              )}
                            </span>
                          </div>
                        </button>
                      </>
                    );
                  })()}
                </div>

                {/* 5 Sensory Ratings (/5) */}
                <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-200 block">
                    5 Parameter Karakteristik Rasa (/5)
                  </span>
                  <div className="grid grid-cols-5 gap-1.5 text-center">
                    {[
                      { lbl: 'Power', val: clampRating5(activeSerial.weightedPower) },
                      { lbl: 'Impact', val: clampRating5(activeSerial.weightedImpact) },
                      { lbl: 'Bitter', val: clampRating5(activeSerial.weightedBitter) },
                      { lbl: 'Bakar', val: clampRating5(activeSerial.weightedBurn ?? 4.5) },
                      { lbl: 'Sugar', val: clampRating5(activeSerial.weightedSugar ?? 4.0) },
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

                {/* Ingredients Composition */}
                <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    Komposisi Bahan Kemasan Ini:
                  </div>
                  <div className="space-y-1.5">
                    {activeSerial.ingredients.map((ing, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-950 border border-zinc-800"
                      >
                        <div>
                          <span className="font-bold text-white">{ing.tobaccoName}</span>
                          <span className="text-zinc-400 ml-1.5">({ing.origin})</span>
                        </div>
                        <span className="text-white font-mono font-bold">
                          {ing.usedNetKg} kg ({ing.percentageInBlend}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-zinc-800 bg-black flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(activeSerial.id);
                    setActiveSerial(null);
                  }}
                  className="min-h-9 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Hapus Seri
                </button>

                <div className="flex items-center gap-2">
                  {onUpdateSerial && (
                    <button
                      type="button"
                      onClick={() => setEditingSerial(activeSerial)}
                      className="btn-amber-outline min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Seri
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveSerial(null)}
                    className="min-h-9 px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-xs cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {editingSerial && onUpdateSerial && (
        <EditFinishedSerialModal
          serial={editingSerial}
          rollSamples={rollSamples}
          packagingList={packagingList}
          factoryList={factoryList}
          onClose={() => setEditingSerial(null)}
          onSave={(updated) => {
            onUpdateSerial(updated);
            if (activeSerial && activeSerial.id === updated.id) {
              setActiveSerial(updated);
            }
            setEditingSerial(null);
          }}
        />
      )}

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
