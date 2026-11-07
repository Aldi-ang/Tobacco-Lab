import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  X,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import {
  TobaccoRollSample,
  FinishedTobaccoSerial,
  TobaccoGrade,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  formatSheetRp,
  buildGoogleSheetText,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';
import { TobaccoRoll3D } from './TobaccoRoll3D';

interface RollArchiveViewProps {
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  onSelectRoll: (roll: TobaccoRollSample) => void;
  onOpenNewRollModal: () => void;
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
  onSelectRoll,
  onOpenNewRollModal,
  onRepriceSerial,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeRollId, setActiveRollId] = useState<string | null>(null);
  // Hidden until pressed inside the opened Gulungan card modal:
  const [isNotaVisible, setIsNotaVisible] = useState<boolean>(false);
  const [isSerialsVisible, setIsSerialsVisible] = useState<boolean>(false);
  const [sheetViewMode, setSheetViewMode] = useState<'personal' | 'factory' | 'both'>('personal');
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
    // Keep Nota and Seri list hidden until the user presses their buttons
    setIsNotaVisible(false);
    setIsSerialsVisible(false);
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
    <div className="bg-black border border-amber-500/60 rounded-xl overflow-hidden flex flex-col justify-between">
      <div>
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block">
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
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-amber-500/50 cursor-pointer"
              title="Download CSV Arsip Personal (Modal + Harga Pabrik + Profit)"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Spreadsheet Header Row */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 font-mono text-xs flex items-center justify-between flex-wrap gap-2 text-white">
          <div className="flex items-center gap-4">
            <span className="font-bold text-zinc-400">TANGGAL</span>
            <span className="font-bold">{formattedDate}</span>
            <span className="font-black text-amber-400 uppercase">
              {roll.recipeName} (ARSIP PERSONAL)
            </span>
          </div>
          <span className="text-[10px] text-zinc-400">
            Rumus: <b className="text-amber-400">PROFIT = Jumlah Pabrik − Jumlah Modal</b>
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
                <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-300 w-[110px]">
                  HARGA PABRIK
                </th>
                <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-300">
                  JUMLAH PABRIK
                </th>
                <th className="py-2.5 px-2 text-amber-400">PROFIT</th>
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
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold text-amber-400">
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
                        className="h-7 w-full min-w-[88px] px-1.5 bg-zinc-950 border border-amber-500/60 focus:border-amber-400 rounded-md text-right text-amber-300 font-mono font-bold text-[11px] focus:outline-hidden"
                      />
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 text-right font-bold text-amber-300">
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
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-[10px] text-zinc-400">
                  TOTAL
                </td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-white">
                  {formatSheetRp(sumInternalCost)}
                </td>
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-right text-amber-300">
                  {formatSheetRp(sumFactoryNota)}
                </td>
                <td className="py-2.5 px-2 text-right text-amber-400">
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
    <div className="bg-black border-2 border-amber-500/60 rounded-xl overflow-hidden flex flex-col justify-between">
      <div>
        <div className="px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block">
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
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 hover:border-amber-500/50 cursor-pointer"
              title="Download CSV Nota Pabrik"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Spreadsheet Header Row */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 font-mono text-xs flex items-center gap-6 text-white">
          <span className="font-bold text-zinc-400">TANGGAL</span>
          <span className="font-bold">{formattedDate}</span>
          <span className="font-black text-amber-400 uppercase">{roll.recipeName}</span>
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
                <th className="py-2.5 px-2 border-r border-zinc-800 text-amber-400 w-[112px]">
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
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-bold text-amber-400 align-middle">
                      {s.serialNumber}
                    </td>
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <NumericInput
                        value={bruto}
                        onChange={(val) => onRepriceSerial(s.id, { brutoKg: val })}
                        className="h-7 w-full min-w-[54px] px-1.5 bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-md text-center text-white font-mono text-[11px] focus:outline-hidden"
                      />
                    </td>
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <NumericInput
                        value={tara}
                        onChange={(val) => onRepriceSerial(s.id, { taraKg: val })}
                        className="h-7 w-full min-w-[48px] px-1.5 bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-md text-center text-amber-400 font-mono text-[11px] focus:outline-hidden"
                      />
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 font-black text-white align-middle">
                      {netto}
                    </td>
                    <td className="py-1.5 px-2 border-r border-zinc-900 uppercase whitespace-nowrap align-middle">
                      {s.packaging.packagingType}
                    </td>
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <select
                        value={s.compositeColorGrade}
                        onChange={(e) =>
                          onRepriceSerial(s.id, {
                            compositeColorGrade: e.target.value as TobaccoGrade,
                          })
                        }
                        aria-label={`Grade Seri ${s.serialNumber}`}
                        className="h-7 w-full min-w-[58px] px-1.5 bg-zinc-950 border border-zinc-700 focus:border-amber-500 rounded-md text-amber-400 font-bold text-[11px] text-center focus:outline-hidden"
                      >
                        {(Object.keys(GRADE_LABELS) as TobaccoGrade[]).map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <NumericInput
                        value={s.factoryTargetPricePerKg}
                        onChange={(val) =>
                          onRepriceSerial(s.id, { factoryTargetPricePerKg: val })
                        }
                        aria-label={`Harga Pabrik Seri ${s.serialNumber}`}
                        className="h-7 w-full min-w-[92px] px-2 bg-zinc-950 border border-amber-500/70 focus:border-amber-400 rounded-md text-right text-amber-400 font-mono font-bold text-[11px] focus:outline-hidden"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right font-black text-amber-400 align-middle">
                      {formatSheetRp(jumlahNota)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900 border-t-2 border-amber-500/50 font-black text-white text-center">
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
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
                <td className="py-2.5 px-2 border-r border-zinc-800"></td>
                <td className="py-2.5 px-2 border-r border-zinc-800 text-[10px] text-amber-400">
                  TOTAL NOTA
                </td>
                <td className="py-2.5 px-2 text-right text-amber-400">
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
    <div className="space-y-5 pb-16 md:pb-4">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 requiem-card p-4 sm:p-5 rounded-2xl border border-zinc-800/90">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 text-xs font-mono font-black shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              GULUNGAN
            </span>
            <span>Arsip Gulungan (Klik Kartu untuk Nota & Evaluasi)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Tekan kartu Gulungan untuk membuka <b>Nota Sheet</b> (Harga Pabrik & Profit per Keranjang) atau <b>Komposisi dan Evaluasi</b>.
          </p>
        </div>

        <button
          type="button"
          title="Buat Arsip Gulungan Sampel Baru"
          onClick={onOpenNewRollModal}
          className="btn-amber-outline min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span>Gulungan Baru</span>
        </button>
      </div>

      {/* Minimalist Search Bar */}
      <div className="requiem-card p-3.5 rounded-xl border border-zinc-800/90">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama gulungan, kode (GUL-...), tanggal, nomor seri, atau pabrik..."
            className="w-full h-10 pl-10 pr-4 bg-black border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>
      </div>

      {/* Grid of 1-Card 3D Gulungan Items (Shows Name, Date, and 3D Roll) */}
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
                className="text-left group relative requiem-card border-2 border-zinc-800/90 hover:border-amber-500 rounded-2xl p-4 shadow-[0_7px_0_0_#09090b,0_12px_20px_rgba(0,0,0,0.85)] hover:shadow-[0_9px_0_0_#f59e0b,0_16px_28px_rgba(245,158,11,0.2)] transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                      {roll.rollNumber}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 font-bold">
                      <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                      {formattedDate}
                    </span>
                  </div>

                  {/* Gulungan Name & Factory */}
                  <div>
                    <h2 className="font-black text-white text-base sm:text-lg truncate group-hover:text-amber-400 transition-colors">
                      {roll.recipeName}
                    </h2>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mt-0.5">
                      <span className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <b className="text-zinc-200 truncate">{roll.targetFactory}</b>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-300 shrink-0">
                        {activeSheetSerials.length} Keranjang
                      </span>
                    </div>
                  </div>

                  {/* 3D Cylindrical Gulungan Tembakau Preview */}
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
                    <div className="font-mono font-bold text-amber-300 text-[11px]">
                      {Math.round(sumFactoryNota / 1000000)}jt
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-amber-400 uppercase font-black">PROFIT</div>
                    <div className="font-mono font-black text-amber-400 text-[11px]">
                      +{Math.round(totalNetProfit / 1000000)}jt
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 group-hover:text-amber-400 transition-colors">
                  <span>Ketuk untuk membuka gulungan 3D</span>
                  <span className="font-bold">Buka Gulungan →</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* LOCKED GULUNGAN WORKSPACE MODAL (3D Gulungan Unrolls when opened; No Slider inside!) */}
      <AnimatePresence>
        {activeRoll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
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

              return (
                <div className="bg-zinc-950 border-2 border-amber-500 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl text-white overflow-hidden">
                  {/* Modal Header */}
                  <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs sm:text-sm shrink-0">
                        {activeRoll.rollNumber}
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-black text-white text-sm sm:text-lg truncate">
                          {activeRoll.recipeName}
                        </h2>
                        <p className="text-[11px] text-zinc-300 truncate flex items-center gap-2">
                          <span>
                            Pabrik: <b className="text-white">{activeRoll.targetFactory}</b>
                          </span>
                          <span>•</span>
                          <span className="text-amber-300 font-mono font-bold">
                            {formattedDate}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveRollId(null)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer shrink-0"
                      aria-label="Tutup modal gulungan"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body (Locked Position — No Snapping!) */}
                  <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
                    {/* 3D Gulungan Tembakau Opening / Unrolling Animation */}
                    <TobaccoRoll3D
                      isOpen={true}
                      rollNumber={`${activeRoll.rollNumber} • ${activeRoll.recipeName} (${formattedDate})`}
                      size="md"
                    />

                    {/* Summary KPI Strip: Modal Kita, Nota Pabrik & PROFIT */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black p-3.5 rounded-xl border border-zinc-800">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                          Total Keranjang & Netto
                        </span>
                        <span className="font-mono font-black text-white text-sm sm:text-base">
                          {activeSheetSerials.length} Seri ({sumNetto} kg)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                          Total Modal Kita
                        </span>
                        <span className="font-mono font-bold text-white text-sm sm:text-base">
                          {formatRupiah(sumInternalCost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-300 uppercase font-bold block">
                          Total Harga Pabrik (Nota)
                        </span>
                        <span className="font-mono font-black text-amber-300 text-sm sm:text-base">
                          {formatRupiah(sumFactoryNota)}
                        </span>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded-lg border border-amber-500/70">
                        <span className="text-[10px] text-amber-400 uppercase font-black flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> PROFIT GULUNGAN
                        </span>
                        <span className="font-mono font-black text-amber-400 text-sm sm:text-base">
                          {formatRupiah(totalNetProfit)}
                        </span>
                      </div>
                    </div>

                    {/* Locked Action Bar: Toggle Nota Sheet, Komposisi dan Evaluasi, Daftar Seri */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 bg-black/90 p-3 rounded-xl border border-zinc-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          title="Tampilkan / Sembunyikan Tabel Nota Arsip Personal (Profit) & Nota Pabrik"
                          onClick={() => setIsNotaVisible((v) => !v)}
                          className={`min-h-9 px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isNotaVisible
                              ? 'bg-black text-amber-400 border-2 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.3)]'
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

                        <button
                          type="button"
                          title="Tampilkan / Sembunyikan Ringkasan Nomor Seri Keranjang"
                          onClick={() => setIsSerialsVisible((v) => !v)}
                          className={`min-h-9 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer border ${
                            isSerialsVisible
                              ? 'bg-black text-amber-400 border-amber-500'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 hover:text-white border-zinc-700'
                          }`}
                        >
                          <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {isSerialsVisible
                              ? 'Tutup Daftar Seri'
                              : `Daftar Seri (${allSerialsInRoll.length})`}
                          </span>
                        </button>
                      </div>

                      {!isNotaVisible && (
                        <span className="text-[11px] text-zinc-400">
                          Klik <b className="text-amber-400">Buka Nota Sheet</b> untuk melihat & menyalin Nota Personal / Pabrik
                        </span>
                      )}
                    </div>

                    {/* Locked Daftar Seri Summary (No snapping animation) */}
                    {isSerialsVisible && (
                      <div className="bg-black p-3.5 rounded-xl border border-zinc-800 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {allSerialsInRoll.map((ser) => {
                          const netto = Math.max(
                            0,
                            ser.packaging.grossWeightPerPackage - ser.factoryDeductionKg
                          );
                          const modal = Math.round(
                            netto *
                              Math.round(
                                ser.effectiveHppAfterTaraPerKg || ser.hppPerNetKg
                              )
                          );
                          const nota = Math.round(netto * ser.factoryTargetPricePerKg);
                          const profit = nota - modal;
                          return (
                            <div
                              key={ser.id}
                              className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-amber-400">
                                  SERI {ser.serialNumber}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black border border-zinc-700 text-white font-bold">
                                  Grade {ser.compositeColorGrade}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 font-mono">
                                Netto: <b className="text-white">{netto} kg</b>
                              </div>
                              <div className="text-[11px] text-amber-400 font-mono font-bold">
                                Profit: {formatRupiah(profit)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Locked Nota Sheet Section (NO Slider inside — Clean Direct Buttons!) */}
                    {isNotaVisible && (
                      <div className="space-y-4 pt-1">
                        {/* Static Locked Button Group (No < > Slider) */}
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
                                    ? 'bg-black text-amber-400 border border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
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

                  {/* Modal Footer */}
                  <div className="px-4 sm:px-5 py-3 border-t border-zinc-800 bg-black flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveRollId(null)}
                      className="btn-amber-outline min-h-9 px-4 py-1.5 rounded-xl font-black text-xs cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
