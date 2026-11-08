import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Scroll,
  Search,
  Eye,
  Building2,
  Package,
  Plus,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Calendar,
  Maximize2,
  Edit3,
} from 'lucide-react';
import {
  TobaccoRollSample,
  FinishedTobaccoSerial,
  TobaccoGrade,
  PackagingMaster,
  FactoryMaster,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  formatSheetRp,
  buildGoogleSheetText,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';
import { TobaccoRoll3D, FullScreenScrollModal } from './TobaccoRoll3D';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
} from './CalculationDetailModal';
import { EditFinishedSerialModal } from './EditFinishedSerialModal';

interface RollArchiveViewProps {
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
  onSelectRoll: (roll: TobaccoRollSample) => void;
  onOpenNewRollModal: () => void;
  onUpdateSerial?: (updated: FinishedTobaccoSerial) => void;
  onRepriceSerial: (
    serialId: string,
    updates: {
      factoryTargetPricePerKg?: number;
      compositeColorGrade?: TobaccoGrade;
      brutoKg?: number;
      taraKg?: number;
    }
  ) => void;
}

export const RollArchiveView: React.FC<RollArchiveViewProps> = ({
  rollSamples,
  finishedBatches,
  packagingList = [],
  factoryList = [],
  onSelectRoll,
  onOpenNewRollModal,
  onUpdateSerial,
  onRepriceSerial,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRollId, setActiveRollId] = useState<string | null>(null);
  const [editingSerial, setEditingSerial] = useState<FinishedTobaccoSerial | null>(null);
  // Default to showing the Seri list in full screen when opening a Gulungan, with Nota toggleable
  const [isNotaVisible, setIsNotaVisible] = useState<boolean>(false);
  const [isSerialsVisible, setIsSerialsVisible] = useState<boolean>(true);
  const [sheetViewMode, setSheetViewMode] = useState<'personal' | 'factory' | 'both'>('personal');
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filtered = rollSamples.filter((roll) => {
    const serialsInRoll = finishedBatches.filter(
      (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
    );
    const serialsText = serialsInRoll.map((s) => s.serialNumber).join(' ');

    return (
      roll.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serialsText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.recipeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.targetFactory.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const activeRoll = rollSamples.find((r) => r.id === activeRollId) || null;

  const handleOpenRollCard = (roll: TobaccoRollSample) => {
    setActiveRollId(roll.id);
    // Show each Nomor Seri immediately in the full-screen scroll view; keep Nota hidden until pressed
    setIsSerialsVisible(true);
    setIsNotaVisible(false);
  };

  const handleCopySheet = (
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

  const handleDownloadCsv = (
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
      `${roll.rollNumber}_${mode === 'INTERNAL_COST' ? 'ARSIP_PERSONAL_PROFIT' : 'NOTA_PABRIK'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Render Sheet 1: Arsip Personal Kita (with HARGA MODAL, JUMLAH MODAL, HARGA PABRIK, JUMLAH PABRIK, and PROFIT)
  const renderPersonalArchiveTable = (
    roll: TobaccoRollSample,
    activeSheetSerials: FinishedTobaccoSerial[],
    formattedDate: string,
    sumBruto: number,
    sumTara: number,
    sumNetto: number,
    sumInternalCost: number,
    sumFactoryNota: number,
    totalNetProfit: number
  ) => (
    <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden flex flex-col justify-between">
      <div>
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-zinc-200 block">
              SHEET 1 — NOTA ARSIP PERSONAL KITA (INTERNAL)
            </span>
            <h4 className="font-extrabold text-white text-xs sm:text-sm">
              Modal Produksi + Harga Pabrik + PROFIT per Keranjang/Seri
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Salin Nota Arsip Personal (Termasuk Harga Pabrik & Profit) ke Google Sheets"
              onClick={() => handleCopySheet(roll, activeSheetSerials, 'INTERNAL_COST')}
              className="btn-amber-outline min-h-8 px-3 py-1 rounded-lg font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === `${roll.id}-INTERNAL_COST` ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Salin Personal
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadCsv(roll, activeSheetSerials, 'INTERNAL_COST')}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-800 cursor-pointer"
              title="Download CSV Arsip Personal (Modal + Harga Pabrik + Profit)"
            >
              <Download className="w-3.5 h-3.5 text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Spreadsheet Header Row */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 font-mono text-xs flex items-center justify-between flex-wrap gap-2 text-white">
          <div className="flex items-center gap-4">
            <span className="font-bold text-zinc-400">TANGGAL</span>
            <span className="font-bold">{formattedDate}</span>
            <span className="font-black text-zinc-200 uppercase">
              {roll.recipeName} (ARSIP PERSONAL)
            </span>
          </div>
          <span className="text-[10px] text-zinc-400">
            Rumus: <b className="text-white">PROFIT = Jumlah Pabrik − Jumlah Modal</b>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-zinc-900 text-white border-b border-zinc-800 text-center font-black">
                <th className="py-2.5 px-2 border-r border-zinc-800">NO</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">SERI</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">BRUTO</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">TARA</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">NETTO</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">PACKAGING</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">GRADE</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">HARGA MODAL</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">JUMLAH MODAL</th>
                <th className="py-2.5 px-2 border-r border-zinc-800 text-zinc-200 w-[110px]">
                  HARGA PABRIK
                </th>
                <th className="py-2.5 px-2 border-r border-zinc-800 text-zinc-200">
                  JUMLAH PABRIK
                </th>
                <th className="py-2.5 px-2 text-white">PROFIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-center">
              {activeSheetSerials.map((s, idx) => {
                const bruto = s.packaging.grossWeightPerPackage;
                const tara = s.factoryDeductionKg;
                const netto = Math.max(0, bruto - tara);
                const modalPerKg = Math.round(
                  s.effectiveHppAfterTaraPerKg || s.hppPerNetKg
                );
                const jumlahModal = Math.round(netto * modalPerKg);
                const jumlahNota = Math.round(netto * s.factoryTargetPricePerKg);
                const profit = jumlahNota - jumlahModal;

                return (
                  <tr key={s.id} className="h-10 hover:bg-zinc-950/80 text-zinc-200">
                    <td className="py-1.5 px-2 border-r border-zinc-900">{idx + 1}</td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold text-white">
                      {s.serialNumber}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900">{bruto}</td>
                    <td className="py-1.5 px-2 border-r border-zinc-900">{tara}</td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold text-white">
                      {netto}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 uppercase whitespace-nowrap">
                      {s.packaging.packagingType}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold">
                      {s.compositeColorGrade}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 text-right">
                      {formatSheetRp(modalPerKg)}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 text-right font-bold text-white">
                      {formatSheetRp(jumlahModal)}
                    </td>
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <NumericInput
                        value={s.factoryTargetPricePerKg}
                        onChange={(val) =>
                          onRepriceSerial(s.id, { factoryTargetPricePerKg: val })
                        }
                        aria-label={`Harga Pabrik Seri ${s.serialNumber}`}
                        className="h-7 w-full min-w-[88px] px-1.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-md text-right text-zinc-200 font-mono font-bold text-[11px] focus:outline-hidden"
                      />
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 text-right font-bold text-zinc-200">
                      {formatSheetRp(jumlahNota)}
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-black ${
                        profit >= 0 ? 'text-amber-400' : 'text-red-400'
                      }`}
                    >
                      {formatSheetRp(profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900 border-t-2 border-zinc-700 font-black text-white text-center">
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
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
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-[10px] text-zinc-400">
                  TOTAL
                </td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-white">
                  {formatSheetRp(sumInternalCost)}
                </td>
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-zinc-200">
                  {formatSheetRp(sumFactoryNota)}
                </td>
                <td className="py-2.5 px-2 text-right text-white">
                  {formatSheetRp(totalNetProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  // Render Sheet 2: Nota Setor ke Pabrik (Strictly 9 Factory Columns)
  const renderFactoryNotaTable = (
    roll: TobaccoRollSample,
    activeSheetSerials: FinishedTobaccoSerial[],
    formattedDate: string,
    sumBruto: number,
    sumTara: number,
    sumNetto: number,
    sumFactoryNota: number
  ) => (
    <div className="bg-black border border-zinc-700 rounded-xl overflow-hidden flex flex-col justify-between">
      <div>
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-zinc-200 block">
              SHEET 2 — NOTA SETORAN KE PABRIK (RESMI)
            </span>
            <h4 className="font-extrabold text-white text-xs sm:text-sm">
              Tabel Nota Resmi Pabrik (Tanpa Modal & Profit • Siap Kirim)
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Salin Nota Resmi Pabrik (9 Kolom) ke Google Sheets"
              onClick={() => handleCopySheet(roll, activeSheetSerials, 'FACTORY_NOTA')}
              className="btn-amber-outline min-h-8 px-3 py-1 rounded-lg font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === `${roll.id}-FACTORY_NOTA` ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Salin Pabrik
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadCsv(roll, activeSheetSerials, 'FACTORY_NOTA')}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-800 cursor-pointer"
              title="Download CSV Nota Pabrik"
            >
              <Download className="w-3.5 h-3.5 text-zinc-300" />
            </button>
          </div>
        </div>

        {/* Spreadsheet Header Row */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 font-mono text-xs flex items-center gap-6 text-white">
          <span className="font-bold text-zinc-400">TANGGAL</span>
          <span className="font-bold">{formattedDate}</span>
          <span className="font-black text-zinc-200 uppercase">{roll.recipeName}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-zinc-900 text-white border-b border-zinc-800 text-center font-black">
                <th className="py-2.5 px-2 border-r border-zinc-800">NO</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">SERI</th>
                <th className="py-2.5 px-2 border-r border-zinc-800 w-[72px]">BRUTO</th>
                <th className="py-2.5 px-2 border-r border-zinc-800 w-[68px]">TARA</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">NETTO</th>
                <th className="py-2.5 px-2 border-r border-zinc-800">PACKAGING</th>
                <th className="py-2.5 px-2 border-r border-zinc-800 w-[76px]">GRADE</th>
                <th className="py-2.5 px-2 border-r border-zinc-800 text-white w-[112px]">
                  HARGA (EDIT)
                </th>
                <th className="py-2.5 px-2">JUMLAH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 text-center">
              {activeSheetSerials.map((s, idx) => {
                const bruto = s.packaging.grossWeightPerPackage;
                const tara = s.factoryDeductionKg;
                const netto = Math.max(0, bruto - tara);
                const jumlahNota = Math.round(netto * s.factoryTargetPricePerKg);

                return (
                  <tr key={s.id} className="h-10 hover:bg-zinc-950/80 text-white">
                    <td className="py-1.5 px-2 border-r border-zinc-900 align-middle">
                      {idx + 1}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold text-white align-middle">
                      {s.serialNumber}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 align-middle">
                      {bruto}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 align-middle">
                      {tara}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-black text-white align-middle">
                      {netto}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 uppercase whitespace-nowrap align-middle">
                      {s.packaging.packagingType}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold text-white align-middle">
                      {s.compositeColorGrade}
                    </td>
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <NumericInput
                        value={s.factoryTargetPricePerKg}
                        onChange={(val) =>
                          onRepriceSerial(s.id, { factoryTargetPricePerKg: val })
                        }
                        aria-label={`Harga Pabrik Seri ${s.serialNumber}`}
                        className="h-7 w-full min-w-[92px] px-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-md text-right text-white font-mono font-bold text-[11px] focus:outline-hidden"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right font-black text-white align-middle">
                      {formatSheetRp(jumlahNota)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900 border-t-2 border-zinc-800 font-black text-white text-center">
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
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
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-[10px] text-zinc-200">
                  TOTAL NOTA
                </td>
                <td className="py-2.5 px-2 text-right text-white">
                  {formatSheetRp(sumFactoryNota)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 pb-16 md:pb-4">
      {/* Search Bar + New Gulungan Action Button Inline */}
      <div className="requiem-card p-2.5 sm:p-3 rounded-xl border border-zinc-800/90 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama gulungan, kode (GUL-...), tanggal, nomor seri, atau pabrik..."
            className="w-full h-9 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700"
          />
        </div>

        <button
          type="button"
          title="Buat Arsip Gulungan Sampel Baru"
          onClick={onOpenNewRollModal}
          className="btn-amber-outline h-9 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span>Gulungan Baru</span>
        </button>
      </div>

      {/* Grid of 1-Card 3D Gulungan Items (Shows Name, Date, and 3D Antique Scroll) */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
          <Scroll className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-white font-bold">Tidak ada gulungan yang cocok</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((roll, idx) => {
            const allSerialsInRoll = finishedBatches.filter(
              (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
            );
            const activeSheetSerials = allSerialsInRoll.filter(
              (s) => s.factoryStatus !== 'REJECTED_STOCK'
            );

            const sumNetto = activeSheetSerials.reduce(
              (acc, s) =>
                acc + Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg),
              0
            );
            const sumInternalCost = activeSheetSerials.reduce((acc, s) => {
              const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
              const costKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg);
              return acc + Math.round(netto * costKg);
            }, 0);
            const sumFactoryNota = activeSheetSerials.reduce((acc, s) => {
              const netto = Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg);
              return acc + Math.round(netto * s.factoryTargetPricePerKg);
            }, 0);
            const totalNetProfit = sumFactoryNota - sumInternalCost;

            const formattedDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            return (
              <motion.button
                key={roll.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.2) }}
                whileHover={{ y: -3 }}
                onClick={() => handleOpenRollCard(roll)}
                className="text-left group relative requiem-card border-2 border-zinc-800/90 hover:border-zinc-700 rounded-2xl p-4 shadow-[0_7px_0_0_#09090b,0_12px_20px_rgba(0,0,0,0.85)] hover:shadow-[0_9px_0_0_#f59e0b,0_16px_28px_rgba(245,158,11,0.2)] transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-black text-amber-400 border border-zinc-700 font-mono font-black text-xs">
                      {roll.rollNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-200 font-bold">
                      <Calendar className="w-3 h-3 text-zinc-300 shrink-0" />
                      {formattedDate}
                    </span>
                  </div>

                  {/* Gulungan Name & Factory */}
                  <div>
                    <h2 className="font-black text-white text-base sm:text-lg truncate group-hover:text-white transition-colors">
                      {roll.recipeName}
                    </h2>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mt-0.5">
                      <span className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        <b className="text-zinc-200 truncate">{roll.targetFactory}</b>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-300 shrink-0">
                        {activeSheetSerials.length} Keranjang
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400 truncate mt-1">
                      Seri:{' '}
                      <span className="text-amber-400 font-bold">
                        {allSerialsInRoll.map((s) => s.serialNumber).join(', ') ||
                          roll.serialNumber}
                      </span>
                    </div>
                  </div>

                  {/* Closed 3D Antique Scroll Preview */}
                  <TobaccoRoll3D isOpen={false} rollNumber={roll.rollNumber} size="sm" />
                </div>

                {/* Compact Metrics Strip: Netto, Nota Pabrik & Profit */}
                <div className="pt-2 border-t border-zinc-900 grid grid-cols-3 gap-1.5 text-center bg-black/90 p-2.5 rounded-xl border border-zinc-800/90">
                  <div>
                    <div className="text-[9px] text-zinc-400 uppercase font-bold">Netto</div>
                    <div className="font-mono font-bold text-white text-xs">{sumNetto} kg</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-400 uppercase font-bold">Nota Pabrik</div>
                    <div className="font-mono font-bold text-zinc-200 text-[11px]">
                      {Math.round(sumFactoryNota / 1000000)}jt
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-200 uppercase font-black">PROFIT</div>
                    <div className="font-mono font-black text-amber-400 text-[11px]">
                      +{Math.round(totalNetProfit / 1000000)}jt
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 group-hover:text-white transition-colors">
                  <span>Buka gulungan layar penuh</span>
                  <span className="font-bold inline-flex items-center gap-1">
                    <Maximize2 className="w-3 h-3" /> Layar Penuh →
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* FULL-SCREEN UNROLLING SCROLL MODAL (Matches YouTube Short Scroll Animation) */}
      {activeRoll && (
        <FullScreenScrollModal
          isOpen={!!activeRoll}
          onClose={() => setActiveRollId(null)}
          rollNumber={activeRoll.rollNumber}
          recipeName={activeRoll.recipeName}
          targetFactory={activeRoll.targetFactory}
          formattedDate={new Date(activeRoll.sampleCreatedDate).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          badgeText="ARSIP GULUNGAN & NOTA"
        >
          {(() => {
            const allSerialsInRoll = finishedBatches.filter(
              (b) => b.rollId === activeRoll.id || b.rollNumber === activeRoll.rollNumber
            );
            const activeSheetSerials = allSerialsInRoll.filter(
              (s) => s.factoryStatus !== 'REJECTED_STOCK'
            );
            const formattedDate = new Date(activeRoll.sampleCreatedDate).toLocaleDateString(
              'id-ID',
              {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }
            );

            const sumBruto = activeSheetSerials.reduce(
              (acc, s) => acc + s.packaging.grossWeightPerPackage,
              0
            );
            const sumTara = activeSheetSerials.reduce(
              (acc, s) => acc + s.factoryDeductionKg,
              0
            );
            const sumNetto = activeSheetSerials.reduce(
              (acc, s) =>
                acc + Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg),
              0
            );
            const sumInternalCost = activeSheetSerials.reduce((acc, s) => {
              const netto = Math.max(
                0,
                s.packaging.grossWeightPerPackage - s.factoryDeductionKg
              );
              const costKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg);
              return acc + Math.round(netto * costKg);
            }, 0);
            const sumFactoryNota = activeSheetSerials.reduce((acc, s) => {
              const netto = Math.max(
                0,
                s.packaging.grossWeightPerPackage - s.factoryDeductionKg
              );
              return acc + Math.round(netto * s.factoryTargetPricePerKg);
            }, 0);
            const totalNetProfit = sumFactoryNota - sumInternalCost;
            const sumFactoryWeightProfitKg = Number(
              activeSheetSerials
                .reduce((acc, s) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const netto = Math.max(0, bruto - s.factoryDeductionKg);
                  const realNet =
                    s.packaging.netTobaccoWeightKg ??
                    s.totalBlendNetKg ??
                    Math.max(
                      0,
                      bruto - (s.packaging.packagingMassKg ?? s.factoryDeductionKg)
                    );
                  const wpKg = s.factoryWeightProfitKg ?? netto - realNet;
                  return acc + wpKg;
                }, 0)
                .toFixed(2)
            );
            const sumFactoryWeightProfitRp = activeSheetSerials.reduce((acc, s) => {
              const bruto = s.packaging.grossWeightPerPackage;
              const netto = Math.max(0, bruto - s.factoryDeductionKg);
              const realNet =
                s.packaging.netTobaccoWeightKg ??
                s.totalBlendNetKg ??
                Math.max(0, bruto - (s.packaging.packagingMassKg ?? s.factoryDeductionKg));
              const wpKg = s.factoryWeightProfitKg ?? netto - realNet;
              return acc + Math.round(wpKg * (s.factoryTargetPricePerKg || 0));
            }, 0);

            type RollCalcFocus = 'NETTO' | 'MODAL' | 'NOTA' | 'WEIGHT_PROFIT' | 'PROFIT';

            const openRollCalcModal = (focus: RollCalcFocus) => {
              if (focus === 'NETTO') {
                const seriSteps = activeSheetSerials.map((s, idx) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  return {
                    stepNumber: idx + 1,
                    title: `Seri ${s.serialNumber} (${s.packaging.packagingType} • Grade ${s.compositeColorGrade})`,
                    formula: 'Netto Tagih = Berat Bruto − Potongan Tarra Pabrik',
                    substitution: `${bruto} kg − ${tara} kg = ${netto} kg`,
                    resultLabel: 'Netto Tagih',
                    resultValue: `${netto} kg`,
                    explanation: `Kemasan Seri ${s.serialNumber} memiliki Bruto ${bruto} kg dan dipotong tarra pabrik ${tara} kg menjadi ${netto} kg.`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `1. Total Keranjang & Netto (${activeSheetSerials.length} Seri • ${sumNetto} kg)`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • Total Bruto ${sumBruto} kg − Total Tarra ${sumTara} kg`,
                  badgeText: 'PANEL 1 GULUNGAN • ASAL ANGKA TOTAL KERANJANG & NETTO',
                  coreFormula:
                    'Total Netto Tagih = Σ (Berat Bruto Seri − Potongan Tarra Pabrik)',
                  steps: seriSteps,
                  summaryRows: [
                    {
                      label: 'Total Bruto',
                      value: `${sumBruto} kg (${activeSheetSerials.length} Seri)`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Potongan Tarra',
                      value: `-${sumTara} kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Netto Tagih',
                      value: `${sumNetto} kg`,
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Angka ${activeSheetSerials.length} Seri (${sumNetto} kg) berasal dari penjumlahan Bruto ${sumBruto} kg dikurangi total potongan tarra pabrik ${sumTara} kg.`,
                });
                return;
              }

              if (focus === 'MODAL') {
                const seriSteps = activeSheetSerials.map((s, idx) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  const costKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg);
                  const modalRp = Math.round(netto * costKg);
                  return {
                    stepNumber: idx + 1,
                    title: `Seri ${s.serialNumber} (${s.packaging.packagingType} • Grade ${s.compositeColorGrade})`,
                    formula: 'Jumlah Modal Seri = Netto Tagih × Harga Modal / KG',
                    substitution: `${netto} kg × ${formatRupiah(costKg)}/kg = ${formatRupiah(modalRp)}`,
                    resultLabel: 'Modal Seri',
                    resultValue: formatRupiah(modalRp),
                    explanation: `Modal produksi Seri ${s.serialNumber} untuk ${netto} kg dengan HPP ${formatRupiah(costKg)}/kg.`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `2. Total Modal Kita (${formatRupiah(sumInternalCost)})`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • ${activeSheetSerials.length} Seri Aktif (${sumNetto} kg)`,
                  badgeText: 'PANEL 2 GULUNGAN • ASAL ANGKA TOTAL MODAL KITA',
                  coreFormula:
                    'Total Modal Kita = Σ (Netto Tagih Seri × Harga Modal / KG)',
                  steps: seriSteps,
                  summaryRows: [
                    {
                      label: 'Jumlah Seri Aktif',
                      value: `${activeSheetSerials.length} Seri (${sumNetto} kg)`,
                      highlight: 'white',
                    },
                    {
                      label: 'Rata-Rata Modal / KG',
                      value: `${formatRupiah(sumNetto > 0 ? Math.round(sumInternalCost / sumNetto) : 0)}/kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Modal Kita',
                      value: formatRupiah(sumInternalCost),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Total Modal Kita sebesar ${formatRupiah(sumInternalCost)} berasal dari akumulasi modal produksi seluruh ${activeSheetSerials.length} Nomor Seri di dalam gulungan ini.`,
                });
                return;
              }

              if (focus === 'NOTA') {
                const seriSteps = activeSheetSerials.map((s, idx) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  const notaRp = Math.round(netto * s.factoryTargetPricePerKg);
                  return {
                    stepNumber: idx + 1,
                    title: `Seri ${s.serialNumber} (Grade ${s.compositeColorGrade})`,
                    formula: 'Jumlah Nota Pabrik = Netto Tagih × Harga Pabrik / KG',
                    substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)}/kg = ${formatRupiah(notaRp)}`,
                    resultLabel: 'Nota Seri',
                    resultValue: formatRupiah(notaRp),
                    explanation: `Tagihan nota pabrik untuk Seri ${s.serialNumber} (${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)}).`,
                    highlight: 'amber' as const,
                  };
                });

                setCalcDetail({
                  title: `3. Total Harga Pabrik / Nota (${formatRupiah(sumFactoryNota)})`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • Pabrik ${activeRoll.targetFactory} (${sumNetto} kg)`,
                  badgeText: 'PANEL 3 GULUNGAN • ASAL ANGKA TOTAL HARGA PABRIK (NOTA)',
                  coreFormula:
                    'Total Harga Pabrik (Nota) = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
                  steps: seriSteps,
                  summaryRows: [
                    {
                      label: 'Total Netto Tagih',
                      value: `${sumNetto} kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Rata-Rata Harga Pabrik',
                      value: `${formatRupiah(sumNetto > 0 ? Math.round(sumFactoryNota / sumNetto) : 0)}/kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Harga Pabrik (Nota)',
                      value: formatRupiah(sumFactoryNota),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Total Harga Pabrik (Nota) sebesar ${formatRupiah(sumFactoryNota)} berasal dari penjumlahan tagihan nota seluruh ${activeSheetSerials.length} Nomor Seri (${sumNetto} kg).`,
                });
                return;
              }

              if (focus === 'WEIGHT_PROFIT') {
                const seriSteps = activeSheetSerials.map((s, idx) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  const realNet =
                    s.packaging.netTobaccoWeightKg ??
                    s.totalBlendNetKg ??
                    Math.max(0, bruto - (s.packaging.packagingMassKg ?? tara));
                  const wpKg = Number((s.factoryWeightProfitKg ?? netto - realNet).toFixed(2));
                  const wpRp = Math.round(wpKg * (s.factoryTargetPricePerKg || 0));
                  return {
                    stepNumber: idx + 1,
                    title: `Seri ${s.serialNumber} (${s.packaging.packagingType})`,
                    formula: 'Selisih Timbangan = (Netto Tagih − Tembakau Riil) × Harga Pabrik',
                    substitution: `(${netto} kg − ${realNet} kg) = ${wpKg >= 0 ? '+' : ''}${wpKg} kg × ${formatRupiah(s.factoryTargetPricePerKg)} = ${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)}`,
                    resultLabel: 'Selisih Seri',
                    resultValue: `${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
                    explanation: `Bruto ${bruto} kg dengan potongan pabrik ${tara} kg vs isi tembakau fisik ${realNet} kg.`,
                    highlight: (wpKg >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                  };
                });

                setCalcDetail({
                  title: `4. Selisih Timbangan Pabrik (${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg)`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • Nilai Selisih: ${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}`,
                  badgeText: 'PANEL 4 GULUNGAN • ASAL ANGKA SELISIH TIMBANGAN PABRIK',
                  coreFormula:
                    'Selisih Timbangan Pabrik = Σ ((Netto Tagih − Tembakau Riil) × Harga Pabrik)',
                  steps: seriSteps,
                  summaryRows: [
                    {
                      label: 'Total Netto Tagih Pabrik',
                      value: `${sumNetto} kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Selisih Berat',
                      value: `${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg`,
                      highlight: sumFactoryWeightProfitKg >= 0 ? 'amber' : 'red',
                    },
                    {
                      label: 'Nilai Selisih Timbangan',
                      value: `${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}`,
                      highlight: sumFactoryWeightProfitRp >= 0 ? 'amber' : 'red',
                    },
                  ],
                  conclusion: `Selisih Timbangan Pabrik sebesar ${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg (${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}) berasal dari perbandingan antara Netto Tagih Pabrik dengan berat tembakau fisik riil di tiap keranjang.`,
                });
                return;
              }

              // focus === 'PROFIT'
              const seriSteps = activeSheetSerials.map((s, idx) => {
                const bruto = s.packaging.grossWeightPerPackage;
                const tara = s.factoryDeductionKg;
                const netto = Math.max(0, bruto - tara);
                const costKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg);
                const modalRp = Math.round(netto * costKg);
                const notaRp = Math.round(netto * s.factoryTargetPricePerKg);
                const profitRp = notaRp - modalRp;

                return {
                  stepNumber: idx + 1,
                  title: `Seri ${s.serialNumber} (Grade ${s.compositeColorGrade})`,
                  formula: 'Profit Seri = Jumlah Nota Pabrik − Jumlah Modal Kita',
                  substitution: `${formatRupiah(notaRp)} − ${formatRupiah(modalRp)} = ${profitRp >= 0 ? '+' : ''}${formatRupiah(profitRp)}`,
                  resultLabel: 'Profit Seri',
                  resultValue: `${profitRp >= 0 ? '+' : ''}${formatRupiah(profitRp)}`,
                  explanation: `Netto ${netto} kg dengan Harga Pabrik ${formatRupiah(s.factoryTargetPricePerKg)}/kg dikurangi Modal ${formatRupiah(costKg)}/kg.`,
                  highlight: (profitRp >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                };
              });

              setCalcDetail({
                title: `5. Profit Gulungan (${formatRupiah(totalNetProfit)})`,
                subtitle: `Gulungan ${activeRoll.rollNumber} • Nota ${formatRupiah(sumFactoryNota)} − Modal ${formatRupiah(sumInternalCost)}`,
                badgeText: 'PANEL 5 GULUNGAN • ASAL ANGKA PROFIT BERSIH GULUNGAN',
                coreFormula:
                  'Profit Gulungan = Total Harga Pabrik (Nota) − Total Modal Kita',
                steps: seriSteps,
                summaryRows: [
                  {
                    label: 'Total Harga Pabrik (Nota)',
                    value: formatRupiah(sumFactoryNota),
                    highlight: 'white',
                  },
                  {
                    label: 'Total Modal Kita',
                    value: formatRupiah(sumInternalCost),
                    highlight: 'white',
                  },
                  {
                    label: 'PROFIT GULUNGAN',
                    value: `${totalNetProfit >= 0 ? '+' : ''}${formatRupiah(totalNetProfit)}`,
                    highlight: totalNetProfit >= 0 ? 'amber' : 'red',
                  },
                ],
                conclusion: `Profit Gulungan sebesar ${formatRupiah(totalNetProfit)} berasal dari Total Harga Pabrik (Nota) ${formatRupiah(sumFactoryNota)} dikurangi Total Modal Kita ${formatRupiah(sumInternalCost)}.`,
              });
            };

            return (
              <div className="space-y-4">
                {/* Summary KPI Strip: Modal Kita, Nota Pabrik, Selisih Timbangan & PROFIT (Specific Per-Panel Breakdown) */}
                <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200">
                      Ringkasan Kalkulasi Gulungan ({activeSheetSerials.length} Seri Aktif)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                      <CalcSymbolBadge />
                      <span>Simbol rincian angka</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-stretch">
                    <button
                      type="button"
                      onClick={() => openRollCalcModal('NETTO')}
                      className="text-left group bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full"
                    >
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block truncate">
                          Total Keranjang & Netto
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <span className="font-mono font-black text-white text-sm sm:text-base block mt-1">
                        {activeSheetSerials.length} Seri ({sumNetto} kg)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openRollCalcModal('MODAL')}
                      className="text-left group bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full"
                    >
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block truncate">
                          Total Modal Kita
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <span className="font-mono font-bold text-white text-sm sm:text-base block mt-1">
                        {formatRupiah(sumInternalCost)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openRollCalcModal('NOTA')}
                      className="text-left group bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full"
                    >
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className="text-[10px] text-zinc-200 uppercase font-bold block truncate">
                          Total Harga Pabrik (Nota)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <span className="font-mono font-black text-zinc-200 text-sm sm:text-base block mt-1">
                        {formatRupiah(sumFactoryNota)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openRollCalcModal('WEIGHT_PROFIT')}
                      className="text-left group bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full"
                    >
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className="text-[10px] text-zinc-200 uppercase font-bold block truncate">
                          Selisih Timbangan Pabrik
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <span
                        className={`font-mono font-black text-xs sm:text-sm block mt-1 ${
                          sumFactoryWeightProfitKg >= 0 ? 'text-zinc-200' : 'text-red-400'
                        }`}
                      >
                        {sumFactoryWeightProfitKg >= 0 ? '+' : ''}
                        {sumFactoryWeightProfitKg} kg ({sumFactoryWeightProfitRp >= 0 ? '+' : ''}
                        {formatRupiah(sumFactoryWeightProfitRp)})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openRollCalcModal('PROFIT')}
                      className="col-span-2 sm:col-span-1 text-left group bg-zinc-950 p-2.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between h-full"
                    >
                      <div className="flex items-start justify-between gap-1.5 w-full">
                        <span className="text-[10px] text-zinc-200 uppercase font-black flex items-center gap-1 truncate">
                          <TrendingUp className="w-3 h-3 shrink-0" /> PROFIT GULUNGAN
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <span className="font-mono font-black text-amber-400 text-sm sm:text-base block mt-1">
                        {formatRupiah(totalNetProfit)}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Locked Action Bar: Toggle Daftar Seri, Nota Sheet, Komposisi dan Evaluasi */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-black/90 p-3 rounded-xl border border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      title="Tampilkan / Sembunyikan Rincian Nomor Seri di Layar Penuh"
                      onClick={() => setIsSerialsVisible((v) => !v)}
                      className={`min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer border ${
                        isSerialsVisible
                          ? 'bg-black text-amber-400 border border-zinc-700'
                          : 'bg-black hover:bg-zinc-900 text-zinc-300 hover:text-white border-zinc-700'
                      }`}
                    >
                      <Package className="w-4 h-4 text-zinc-300 shrink-0" />
                      <span>
                        {isSerialsVisible
                          ? `Sembunyikan Seri (${allSerialsInRoll.length})`
                          : `Lihat Semua Seri (${allSerialsInRoll.length})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      title="Tampilkan / Sembunyikan Tabel Nota Arsip Personal (Profit) & Nota Pabrik"
                      onClick={() => setIsNotaVisible((v) => !v)}
                      className={`min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isNotaVisible
                          ? 'bg-black text-amber-400 border border-zinc-700'
                          : 'btn-amber-outline'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      <span>{isNotaVisible ? 'Sembunyikan Nota' : 'Buka Nota Sheet'}</span>
                    </button>

                    <button
                      type="button"
                      title="Lihat Komposisi Daun & Evaluasi Grader Pabrik (/5)"
                      onClick={() => onSelectRoll(activeRoll)}
                      className="btn-amber-outline min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>Komposisi dan Evaluasi</span>
                    </button>
                  </div>

                  {!isNotaVisible && (
                    <span className="text-[11px] text-zinc-400">
                      Klik <b className="text-white">Buka Nota Sheet</b> untuk menyalin Nota Personal / Pabrik ke Google Sheets
                    </span>
                  )}
                </div>

                {/* Full-Screen Spacious Seri Grid with Direct Price & Grade Controls */}
                {isSerialsVisible && (
                  <div className="bg-black p-3.5 sm:p-4 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Package className="w-4 h-4 text-zinc-300" />
                        Daftar Nomor Seri di Dalam Gulungan ({allSerialsInRoll.length} Keranjang)
                      </h3>
                      <span className="text-[11px] text-zinc-400">
                        Anda dapat langsung mengubah <b className="text-white">Grade</b> &{' '}
                        <b className="text-white">Harga Pabrik/KG</b> pada tiap kartu Seri di bawah
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {allSerialsInRoll.map((ser) => {
                        const bruto = ser.packaging.grossWeightPerPackage;
                        const tara = ser.factoryDeductionKg;
                        const netto = Math.max(0, bruto - tara);
                        const realNet =
                          ser.packaging.netTobaccoWeightKg ??
                          ser.totalBlendNetKg ??
                          Math.max(0, bruto - (ser.packaging.packagingMassKg ?? tara));
                        const realPkg =
                          ser.packaging.packagingMassKg ??
                          Number(Math.max(0, bruto - realNet).toFixed(2));
                        const wpKg =
                          ser.factoryWeightProfitKg ?? Number((netto - realNet).toFixed(2));
                        const wpRp = Math.round(wpKg * (ser.factoryTargetPricePerKg || 0));
                        const modalPerKg = Math.round(
                          ser.effectiveHppAfterTaraPerKg || ser.hppPerNetKg
                        );
                        const modal = Math.round(netto * modalPerKg);
                        const nota = Math.round(netto * ser.factoryTargetPricePerKg);
                        const profit = nota - modal;

                        return (
                          <div
                            key={ser.id}
                            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-800 transition-colors text-xs space-y-2.5 flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-black border border-zinc-700 font-mono font-black text-amber-400 text-xs">
                                  SERI {ser.serialNumber}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <span className="h-7 px-2 rounded bg-black border border-zinc-800 text-zinc-200 font-bold text-[11px] inline-flex items-center">
                                    Grade {ser.compositeColorGrade}
                                  </span>

                                  {onUpdateSerial && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingSerial(ser)}
                                      className="h-7 px-2 rounded bg-black hover:bg-zinc-900 border border-zinc-700 hover:border-amber-500/70 text-amber-400 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      title={`Edit Lengkap Seri ${ser.serialNumber}`}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="bg-black/80 p-2 rounded-lg border border-zinc-900 space-y-1 font-mono text-[11px]">
                                <div className="flex items-center justify-between text-zinc-400">
                                  <span>Kemasan (Wadah {realPkg}kg):</span>
                                  <b className="text-white">{ser.packaging.packagingType}</b>
                                </div>
                                <div className="flex items-center justify-between text-zinc-400">
                                  <span>Tagih / Riil:</span>
                                  <b className="text-white">
                                    {netto}kg ({bruto}−{tara}) /{' '}
                                    <span className="text-zinc-200">{realNet}kg</span>
                                  </b>
                                </div>
                                {wpKg !== 0 && (
                                  <div className="flex items-center justify-between text-zinc-400">
                                    <span>Selisih Timbangan:</span>
                                    <b className={wpKg > 0 ? 'text-amber-400' : 'text-red-400'}>
                                      {wpKg > 0 ? '+' : ''}
                                      {wpKg}kg ({wpRp > 0 ? '+' : ''}
                                      {formatRupiah(wpRp)})
                                    </b>
                                  </div>
                                )}
                                <div className="flex items-center justify-between text-zinc-400">
                                  <span>Modal/KG:</span>
                                  <span className="text-zinc-200">{formatRupiah(modalPerKg)}</span>
                                </div>
                              </div>

                              {/* Editable Factory Price per KG */}
                              <div>
                                <label className="block text-[10px] text-zinc-200 font-bold uppercase mb-1">
                                  Harga Pabrik / KG (Rp)
                                </label>
                                <NumericInput
                                  value={ser.factoryTargetPricePerKg}
                                  onChange={(val) =>
                                    onRepriceSerial(ser.id, { factoryTargetPricePerKg: val })
                                  }
                                  className="w-full h-8 px-2.5 bg-black border border-zinc-800 focus:border-zinc-700 rounded-lg text-right font-mono font-bold text-zinc-200 text-xs"
                                />
                              </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-900 space-y-1 font-mono text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Jumlah Pabrik:</span>
                                <b className="text-zinc-200">{formatRupiah(nota)}</b>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-400">Profit Seri:</span>
                                <b className={profit >= 0 ? 'text-amber-400' : 'text-red-400'}>
                                  {profit >= 0 ? '+' : ''}
                                  {formatRupiah(profit)}
                                </b>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Locked Nota Sheet Section (NO Slider inside — Clean Direct Buttons!) */}
                {isNotaVisible && (
                  <div className="space-y-4 pt-1">
                    <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-black border border-zinc-800">
                      <span className="text-[11px] font-bold text-zinc-400 px-2">
                        Pilih Tampilan Nota:
                      </span>
                      {(
                        [
                          {
                            id: 'personal',
                            label: 'Nota Arsip Personal (Profit)',
                          },
                          {
                            id: 'factory',
                            label: 'Nota Setoran Pabrik',
                          },
                          {
                            id: 'both',
                            label: 'Tampilkan Berdampingan',
                          },
                        ] as const
                      ).map((btn) => {
                        const active = sheetViewMode === btn.id;
                        return (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setSheetViewMode(btn.id)}
                            className={`min-h-8 px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                              active
                                ? 'bg-black text-amber-400 border border-zinc-700'
                                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                            }`}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>

                    {sheetViewMode === 'personal' &&
                      renderPersonalArchiveTable(
                        activeRoll,
                        activeSheetSerials,
                        formattedDate,
                        sumBruto,
                        sumTara,
                        sumNetto,
                        sumInternalCost,
                        sumFactoryNota,
                        totalNetProfit
                      )}

                    {sheetViewMode === 'factory' &&
                      renderFactoryNotaTable(
                        activeRoll,
                        activeSheetSerials,
                        formattedDate,
                        sumBruto,
                        sumTara,
                        sumNetto,
                        sumFactoryNota
                      )}

                    {sheetViewMode === 'both' && (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {renderPersonalArchiveTable(
                          activeRoll,
                          activeSheetSerials,
                          formattedDate,
                          sumBruto,
                          sumTara,
                          sumNetto,
                          sumInternalCost,
                          sumFactoryNota,
                          totalNetProfit
                        )}
                        {renderFactoryNotaTable(
                          activeRoll,
                          activeSheetSerials,
                          formattedDate,
                          sumBruto,
                          sumTara,
                          sumNetto,
                          sumFactoryNota
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </FullScreenScrollModal>
      )}

      {editingSerial && onUpdateSerial && (
        <EditFinishedSerialModal
          serial={editingSerial}
          rollSamples={rollSamples}
          packagingList={packagingList}
          factoryList={factoryList}
          onClose={() => setEditingSerial(null)}
          onSave={(updated) => {
            onUpdateSerial(updated);
            setEditingSerial(null);
          }}
        />
      )}

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
