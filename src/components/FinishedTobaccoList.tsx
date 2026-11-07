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
} from 'lucide-react';
import { FinishedTobaccoSerial, TobaccoRollSample } from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  formatSheetRp,
  clampRating5,
  buildFinishedBatchSyncCsv,
} from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import { SpinningStatTicker } from './SpinningStatTicker';

interface FinishedTobaccoListProps {
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  onOpenRoll: (rollId: string) => void;
  onDelete: (id: string) => void;
}

export const FinishedTobaccoList: React.FC<FinishedTobaccoListProps> = ({
  finishedBatches,
  rollSamples,
  onOpenRoll,
  onDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [selectedRollFilter, setSelectedRollFilter] = useState<string>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid-3d' | 'by-gulungan' | 'csv-sync'>('grid-3d');
  const [activeSerial, setActiveSerial] = useState<FinishedTobaccoSerial | null>(null);
  const [copiedMode, setCopiedMode] = useState<'CSV' | 'TSV' | null>(null);

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
        label: 'Profit & Nota',
        value: `${profitRp >= 0 ? '+' : ''}${formatRupiah(profitRp)}`,
        subValue: 'Profit',
        detailLine: `Nota: ${formatRupiah(batch.projectedRevenue)}`,
        accent: 'amber' as const,
      },
      {
        id: 'modal-kita',
        label: 'Modal Produksi',
        value: `${formatRupiah(batch.hppPerNetKg)}/kg`,
        subValue: 'HPP',
        detailLine: `Total: ${formatRupiah(batch.totalProductionCost)}`,
        accent: 'white' as const,
      },
      {
        id: 'timbangan',
        label: 'Timbangan & Tarra',
        value: `Netto ${nettoKg} kg`,
        subValue: `Tarra -${batch.factoryDeductionKg}kg`,
        detailLine: `Bruto ${brutoKg}kg • ${batch.packaging.packagingType}`,
        accent: 'white' as const,
      },
    ];

    return (
      <motion.div
        key={batch.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.15) }}
        onClick={() => setActiveSerial(batch)}
        className="text-left group relative requiem-card border border-zinc-800/90 hover:border-amber-500 rounded-2xl p-3 sm:p-4 shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[284px] sm:min-h-[300px]"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1">
            <span className="px-2 py-0.5 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-[11px] sm:text-xs tracking-wide shrink-0">
              SERI {batch.serialNumber}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black border shrink-0 ${gradeInfo.color}`}
            >
              Grade {batch.compositeColorGrade}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-white font-bold truncate">
            <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
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
                <RotateCcw className="w-2.5 h-2.5 text-amber-400" /> Reject
              </span>
            )}
          </div>

          {/* Permanent 2-Row Summary Box (Full horizontal room so Rp values never get cut off!) */}
          <div className="bg-zinc-950/95 border border-zinc-800/90 rounded-xl px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-bold uppercase text-zinc-400">
                Netto Tagih
              </span>
              <span className="font-mono font-black text-[11px] sm:text-xs text-white whitespace-nowrap">
                {nettoKg} kg
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-900">
              <span className="text-[9px] font-bold uppercase text-zinc-400">
                Harga Pabrik
              </span>
              <span className="font-mono font-black text-[11px] sm:text-xs text-amber-400 whitespace-nowrap">
                {formatRupiah(batch.factoryTargetPricePerKg)}
              </span>
            </div>
          </div>

          {/* Moving Panel with All 5 Character Parameters (/5) & Profit Breakdown */}
          <SpinningStatTicker items={tickerItems} intervalMs={3200 + (idx % 3) * 350} />
        </div>

        <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-400 group-hover:text-amber-400 transition-colors">
          <span className="truncate max-w-[95px]">{batch.packaging.packagingType}</span>
          <span className="font-bold shrink-0">Rincian →</span>
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
    <div className="space-y-4 pb-20 md:pb-4">
      {/* Header & Locked-Position Segment Switcher */}
      <div className="requiem-card p-3.5 sm:p-5 rounded-2xl border border-zinc-800/90 space-y-3">
        <div>
          <h1 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-black text-amber-400 border border-amber-500 text-xs font-mono font-black shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              SERI
            </span>
            <span>Tembakau Jadi & Sinkronisasi CSV</span>
          </h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            2 Kartu per baris di HP • Panel bergerak menampilkan 5 karakter (/5) & profit
          </p>
        </div>

        <div className="pt-3 border-t border-zinc-800/90">
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
        </div>
      </div>

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
              className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <button
            type="button"
            title="Tampilkan / Sembunyikan Filter Gulungan & Pabrik"
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
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-900 overflow-hidden"
            >
              <select
                value={selectedRollFilter}
                onChange={(e) => setSelectedRollFilter(e.target.value)}
                className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-amber-400 font-bold focus:outline-hidden focus:border-amber-500"
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
                className="w-full h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-amber-500"
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
          <div className="requiem-card p-4 rounded-2xl border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 block">
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
                className="min-h-9 px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-900 text-white border border-zinc-700 hover:border-amber-500/60 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" /> .CSV
              </button>
            </div>
          </div>

          {/* Structured Synchronized Table Preview */}
          <div className="requiem-card border border-amber-500/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-black border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-white">
                Tabel Sinkronisasi Modal Produksi vs Harga Tagih
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Total Profit: <b className="text-amber-400">{formatRupiah(sumProfit)}</b>
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
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-300">
                      MODAL PRODUKSI/KG
                    </th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-300">
                      TOTAL MODAL PRODUKSI
                    </th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-400">
                      HARGA TAGIH/KG
                    </th>
                    <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-400">
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
                        <td className="py-2 px-2 border-r border-zinc-900 font-black text-amber-400">
                          {b.serialNumber}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-left">
                          {b.targetFactory}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-amber-400">
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
                        <td className="py-2 px-2 border-r border-zinc-900 text-right text-amber-400 font-bold">
                          {formatSheetRp(billableKg)}
                        </td>
                        <td className="py-2 px-2 border-r border-zinc-900 text-right font-black text-amber-400">
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
                  <tr className="bg-zinc-900 border-t-2 border-amber-500/50 font-black text-white text-center">
                    <td colSpan={6} className="py-2.5 px-3 border-r border-zinc-800 text-left text-amber-400">
                      TOTAL ({filtered.length} SERI)
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
                    <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-white">
                      {formatSheetRp(sumProdCost)}
                    </td>
                    <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                    <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-amber-400">
                      {formatSheetRp(sumBillable)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-amber-400">
                      {formatSheetRp(sumProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Raw CSV Text Box */}
          <div className="requiem-card border border-zinc-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">
              Struktur CSV Mentah (Siap Copy-Paste ke Google Sheets)
            </span>
            <textarea
              readOnly
              value={csvSyncText}
              rows={6}
              aria-label="Output CSV Sinkronisasi Batch"
              className="w-full p-3 rounded-xl bg-black border border-zinc-800 text-[11px] font-mono text-zinc-300 focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </motion.div>
      ) : viewMode === 'grid-3d' ? (
        /* 2 Cards per Horizontal Line on Phone (grid-cols-2) */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
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
                  <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs">
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

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
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
              className="bg-zinc-950 border-2 border-amber-500 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs sm:text-sm tracking-wide">
                    SERI {activeSerial.serialNumber}
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-white">
                      {activeSerial.recipeName || 'Kemasan Tembakau Jadi'}
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Pabrik: <b className="text-amber-400">{activeSerial.targetFactory}</b> •{' '}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Packaging & Tara */}
                  <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="font-extrabold uppercase tracking-wider text-amber-400 mb-1">
                      Timbangan & Tarra
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Kemasan:</span>
                      <b className="text-white">{activeSerial.packaging.packagingType}</b>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Bruto:</span>
                      <b className="font-mono text-white">
                        {activeSerial.packaging.grossWeightPerPackage} kg
                      </b>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Tarra:</span>
                      <b className="font-mono text-amber-400">
                        -{activeSerial.factoryDeductionKg} kg
                      </b>
                    </div>
                    <div className="flex justify-between text-white pt-1 border-t border-zinc-900 font-black">
                      <span>Netto:</span>
                      <span className="font-mono text-amber-400 text-sm">
                        {activeSerial.factoryNetBillableKg} kg
                      </span>
                    </div>
                  </div>

                  {/* Cost, Factory Price & Profit */}
                  <div className="bg-black p-3.5 rounded-xl border border-amber-500/40 space-y-1.5">
                    <div className="font-extrabold uppercase tracking-wider text-amber-400 mb-1">
                      Modal, Harga Pabrik & Profit
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Modal / KG:</span>
                      <b className="font-mono text-white">{formatRupiah(activeSerial.hppPerNetKg)}</b>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span>Harga Pabrik / KG:</span>
                      <b className="font-mono text-amber-300">
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
                      <span>Jumlah Pabrik:</span>
                      <b className="font-mono text-amber-300">
                        {formatRupiah(activeSerial.projectedRevenue)}
                      </b>
                    </div>
                    <div className="flex justify-between text-white pt-1 border-t border-zinc-900 font-black">
                      <span>PROFIT SERI:</span>
                      <span className="font-mono text-amber-400">
                        {formatRupiah(
                          activeSerial.projectedRevenue - activeSerial.totalProductionCost
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5 Sensory Ratings (/5) */}
                <div className="bg-black p-3 rounded-xl border border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="font-extrabold uppercase text-amber-400">
                    Karakteristik (/5):
                  </span>
                  <div className="flex flex-wrap gap-3 font-mono text-xs">
                    <span>
                      Power: <b className="text-amber-400">{clampRating5(activeSerial.weightedPower)}/5</b>
                    </span>
                    <span>
                      Impact: <b className="text-amber-400">{clampRating5(activeSerial.weightedImpact)}/5</b>
                    </span>
                    <span>
                      Bitter: <b className="text-amber-400">{clampRating5(activeSerial.weightedBitter)}/5</b>
                    </span>
                    <span>
                      Bakar: <b className="text-amber-400">{clampRating5(activeSerial.weightedBurn ?? 4.5)}/5</b>
                    </span>
                    <span>
                      Sugar: <b className="text-amber-400">{clampRating5(activeSerial.weightedSugar ?? 4.0)}/5</b>
                    </span>
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
                        <span className="text-amber-400 font-mono font-bold">
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
                  className="min-h-9 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-amber-400 border border-zinc-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Hapus Seri
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSerial(null)}
                  className="btn-amber-outline min-h-9 px-4 py-1.5 rounded-xl font-black text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
