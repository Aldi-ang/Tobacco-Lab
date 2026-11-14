import React, { useState, useRef } from 'react';
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
  Send,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Trash2,
  Scale,
  Sliders,
  Hand,
} from 'lucide-react';
import {
  TobaccoRollSample,
  FinishedTobaccoSerial,
  TobaccoGrade,
  PackagingMaster,
  FactoryMaster,
  RawTobacco,
  SerialFactoryStatus,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  formatSheetRp,
  buildGoogleSheetText,
  formatSerialLineage,
  hasSerialLineage,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';
import { SegmentedControl } from './RatingSegmentSlider';
import { TobaccoRoll3D, FullScreenScrollModal } from './TobaccoRoll3D';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
} from './CalculationDetailModal';
import { EditFinishedSerialModal } from './EditFinishedSerialModal';
import { RollCompositionAndEvaluationPanel } from './RollDetailModal';
import { getSerialMissingFlags } from '../utils/tobaccoCompleteness';
import { HoldQuickMenuOverlay, useHoldDragMenu } from './HoldQuickMenu';

const toScale5 = (v: number) => (v > 5 ? Number((v / 2).toFixed(1)) : v);

interface RollArchiveViewProps {
  viewMode?: 'warehouse' | 'shipped';
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos?: RawTobacco[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
  onSelectRoll: (roll: TobaccoRollSample) => void;
  onOpenNewRollModal: () => void;
  onSendRollToFactory?: (rollId: string, isSent: boolean) => void;
  onUpdateSerial?: (updated: FinishedTobaccoSerial) => void;
  onUpdateSerialStatus?: (
    serialId: string,
    status: SerialFactoryStatus,
    currentRoll: TobaccoRollSample
  ) => void;
  onUpdateSmokingTest?: (
    rollId: string,
    updatedTest: NonNullable<TobaccoRollSample['smokingTest']>
  ) => void;
  onRepriceSerial: (
    serialId: string,
    updates: {
      factoryTargetPricePerKg?: number;
      compositeColorGrade?: TobaccoGrade;
      brutoKg?: number;
      taraKg?: number;
    }
  ) => void;
  onDeleteRoll?: (rollId: string) => void;
  onDeleteSerial?: (serialId: string) => void;
  onOpenGoogleSheetsModal?: () => void;
}

export const RollArchiveView: React.FC<RollArchiveViewProps> = ({
  viewMode = 'warehouse',
  rollSamples,
  finishedBatches,
  rawTobaccos = [],
  packagingList = [],
  factoryList = [],
  onSelectRoll,
  onOpenNewRollModal,
  onSendRollToFactory,
  onUpdateSerial,
  onUpdateSerialStatus,
  onUpdateSmokingTest,
  onRepriceSerial,
  onDeleteRoll,
  onDeleteSerial,
  onOpenGoogleSheetsModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK'
  >('ALL');
  const [activeRollId, setActiveRollId] = useState<string | null>(null);
  const [editingSerial, setEditingSerial] = useState<FinishedTobaccoSerial | null>(null);
  const [editingSerialSection, setEditingSerialSection] = useState<
    'main' | 'weights' | 'character' | 'all'
  >('main');
  const [activeRollTab, setActiveRollTab] = useState<'SERI' | 'NOTA' | 'KOMPOSISI'>('SERI');
  const [modalSeriStatusFilter, setModalSeriStatusFilter] = useState<
    'ALL' | 'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK'
  >('ALL');
  const [sheetViewMode, setSheetViewMode] = useState<'personal' | 'factory' | 'both'>('personal');
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const serialPriceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const serialHoldMenu = useHoldDragMenu();

  // Filter rolls based on whether they are still in Warehouse ('warehouse') or Sent to Factory ('shipped')
  const stageRolls = rollSamples.filter((roll) =>
    viewMode === 'shipped' ? !!roll.isSentToFactory : !roll.isSentToFactory
  );

  // Counts for shipped status filter pills
  const shippedSerials = finishedBatches.filter((b) => {
    const parentRoll = rollSamples.find(
      (r) => r.id === b.rollId || r.rollNumber === b.rollNumber
    );
    return parentRoll ? !!parentRoll.isSentToFactory : false;
  });
  const pendingShippedCount = shippedSerials.filter(
    (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
  ).length;
  const acceptedShippedCount = shippedSerials.filter(
    (s) => s.factoryStatus === 'ACCEPTED_CAIR'
  ).length;
  const rejectedShippedCount = shippedSerials.filter(
    (s) => s.factoryStatus === 'REJECTED_STOCK'
  ).length;

  const filtered = stageRolls.filter((roll) => {
    const serialsInRoll = finishedBatches.filter(
      (b) =>
        b.rollId === roll.id ||
        b.rollNumber === roll.rollNumber ||
        b.previousRollId === roll.id ||
        (b.previousRollNumber && b.previousRollNumber.includes(roll.rollNumber))
    );

    if (viewMode === 'shipped' && statusFilter !== 'ALL') {
      const hasMatchingStatus = serialsInRoll.some((s) => {
        const st = s.factoryStatus || 'PENDING';
        return st === statusFilter;
      });
      if (!hasMatchingStatus) return false;
    }

    const serialsText = serialsInRoll.map((s) => formatSerialLineage(s)).join(' ');

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
    setActiveRollTab('SERI');
    setModalSeriStatusFilter('ALL');
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
                      {formatSerialLineage(s)}
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
                    <td className="py-1 px-1.5 border-r border-zinc-900 align-middle">
                      <select
                        value={s.compositeColorGrade}
                        onChange={(e) =>
                          onRepriceSerial(s.id, {
                            compositeColorGrade: e.target.value as TobaccoGrade,
                          })
                        }
                        aria-label={`Grade Seri ${s.serialNumber}`}
                        className="h-7 w-full min-w-[60px] px-1 bg-zinc-950 border border-zinc-800 rounded-md text-center text-white font-mono font-bold text-[11px] focus:outline-hidden"
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
      {/* Stage Banner & Status Filter when in Shipped / Status Barang mode */}
      {viewMode === 'shipped' ? (
        <div className="space-y-2.5">
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              {
                id: 'ALL',
                label: 'Semua Dikirim',
                fullLabel: 'Semua Gulungan yang Sudah Dikirim ke Pabrik',
                icon: <Scroll className="w-3.5 h-3.5" />,
                badge: stageRolls.length,
              },
              {
                id: 'PENDING',
                label: 'Menunggu Pabrik',
                fullLabel: 'Gulungan dengan Seri Menunggu Keputusan Pabrik',
                icon: <Clock className="w-3.5 h-3.5" />,
                badge: pendingShippedCount,
              },
              {
                id: 'ACCEPTED_CAIR',
                label: 'Diterima / Accepted',
                fullLabel: 'Gulungan dengan Seri yang Diterima Pabrik (Accepted)',
                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                badge: acceptedShippedCount,
              },
              {
                id: 'REJECTED_STOCK',
                label: 'Reject',
                fullLabel: 'Gulungan dengan Seri yang Direject (Masuk Stok Tembakau Jadi)',
                icon: <RotateCcw className="w-3.5 h-3.5" />,
                badge: rejectedShippedCount,
              },
            ]}
          />
        </div>
      ) : (
        <div className="requiem-card px-3.5 py-2.5 rounded-xl border border-zinc-800/90 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/50 font-mono font-black text-[10px]">
              DI GUDANG KITA ({stageRolls.length})
            </span>
            <span>
              Gulungan di bawah masih ada di kita. Tekan <b className="text-amber-400">Kirim ke Pabrik</b> untuk memindahkan ke <b className="text-white">Status Barang</b>.
            </span>
          </div>
        </div>
      )}

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

        {viewMode === 'warehouse' && (
          <button
            type="button"
            title="Buat Arsip Gulungan Sampel Baru"
            onClick={onOpenNewRollModal}
            className="btn-amber-outline h-9 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Gulungan Baru</span>
          </button>
        )}
      </div>

      {/* Grid of 1-Card 3D Gulungan Items (Shows Name, Date, 3D Scroll, and Send/Return Action) */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800 space-y-2">
          <Scroll className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
          <p className="text-white font-bold text-sm">
            {viewMode === 'warehouse'
              ? 'Tidak ada gulungan yang sedang di gudang'
              : 'Tidak ada gulungan terkirim pada kategori ini'}
          </p>
          <p className="text-xs text-zinc-400">
            {viewMode === 'warehouse'
              ? 'Semua gulungan sudah dikirim ke menu Status Barang atau buat Gulungan Baru.'
              : 'Tekan tombol "Kirim ke Pabrik" pada menu Gulungan saat barang dikirim.'}
          </p>
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

            const pendingCount = allSerialsInRoll.filter(
              (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
            ).length;
            const acceptedCount = allSerialsInRoll.filter(
              (s) => s.factoryStatus === 'ACCEPTED_CAIR'
            ).length;
            const rejectedCount = allSerialsInRoll.filter(
              (s) => s.factoryStatus === 'REJECTED_STOCK'
            ).length;

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
              <motion.div
                key={roll.id}
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
                        {allSerialsInRoll.map((s) => formatSerialLineage(s)).join(', ') ||
                          roll.serialNumber}
                      </span>
                    </div>
                  </div>

                  {/* Status Counters Pill Strip */}
                  <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                    <div className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                      Menunggu: <b className="text-white">{pendingCount}</b>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                      Diterima: <b className="text-amber-400">{acceptedCount}</b>
                    </div>
                    <div className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                      Reject: <b className="text-white">{rejectedCount}</b>
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

                {/* Card Footer: Open Full-Screen + Delete + Send/Return Button */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-bold text-zinc-300 group-hover:text-white inline-flex items-center gap-1">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" /> Buka Gulungan
                  </span>

                  <div className="flex items-center gap-1.5">
                    {onDeleteRoll && (
                      <button
                        type="button"
                        aria-label={`Hapus Gulungan ${roll.rollNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRoll(roll.id);
                        }}
                        className="group/del relative min-h-9 w-9 shrink-0 rounded-xl bg-black hover:bg-red-950/80 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/70 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span className="pointer-events-none opacity-0 group-hover/del:opacity-100 transition-opacity duration-150 absolute -top-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-red-500/70 text-red-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                          Hapus Gulungan {roll.rollNumber}
                        </span>
                      </button>
                    )}

                    {onSendRollToFactory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendRollToFactory(roll.id, !roll.isSentToFactory);
                        }}
                        className={`min-h-9 px-3 py-1.5 rounded-xl font-black text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                          roll.isSentToFactory
                            ? 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700'
                            : 'btn-amber-outline shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        }`}
                        title={
                          roll.isSentToFactory
                            ? 'Kembalikan Gulungan ini ke menu Gulungan (Di Gudang)'
                            : 'Kirim Gulungan ini ke Pabrik & pindahkan ke menu Status Barang'
                        }
                      >
                        {roll.isSentToFactory ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                            <span>Tarik ke Gudang</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span>Kirim ke Pabrik →</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
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
                    stepNumber: idx + 4,
                    title: `Seri ${s.serialNumber}`,
                    formula: 'Netto Tagih = Berat Bruto − Potongan Tarra Pabrik',
                    substitution: `${bruto} kg − ${tara} kg = ${netto} kg`,
                    resultLabel: `Seri ${s.serialNumber}`,
                    resultValue: `${netto} kg`,
                    explanation: `Kemasan ${s.packaging.packagingType} (Grade ${s.compositeColorGrade}): Bruto ${bruto} kg dipotong tarra ${tara} kg.`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `1. Total Keranjang & Netto (${activeSheetSerials.length} Seri • ${sumNetto} kg)`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • Total Bruto ${sumBruto} kg − Total Tarra ${sumTara} kg`,
                  badgeText: 'PANEL 1 GULUNGAN • RUMUS TOTAL NETTO TAGIH',
                  coreFormula:
                    'Total Netto Tagih = Total Bruto − Total Potongan Tarra',
                  appliedFormula: `Total Netto Tagih = ${sumBruto} kg − ${sumTara} kg = ${sumNetto} kg`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Bruto',
                      formula: 'Total Bruto = Σ Berat Bruto Seluruh Seri',
                      substitution:
                        activeSheetSerials
                          .map((s) => `${s.packaging.grossWeightPerPackage} kg`)
                          .join(' + ') + ` = ${sumBruto} kg`,
                      resultLabel: 'Total Bruto',
                      resultValue: `${sumBruto} kg`,
                      explanation: `Jumlah berat kotor dari ${activeSheetSerials.length} Nomor Seri.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Total Potongan Tarra',
                      formula: 'Total Potongan Tarra = Σ Potongan Tarra Pabrik per Seri',
                      substitution:
                        activeSheetSerials.map((s) => `${s.factoryDeductionKg} kg`).join(' + ') +
                        ` = ${sumTara} kg`,
                      resultLabel: 'Total Potongan Tarra',
                      resultValue: `${sumTara} kg`,
                      explanation: `Total potongan tarra pabrik untuk ${activeSheetSerials.length} Nomor Seri.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 3,
                      title: 'Total Netto Tagih',
                      formula: 'Total Netto Tagih = Total Bruto − Total Potongan Tarra',
                      substitution: `${sumBruto} kg − ${sumTara} kg = ${sumNetto} kg`,
                      resultLabel: 'Total Netto Tagih',
                      resultValue: `${sumNetto} kg`,
                      explanation: `Total berat bersih yang ditagihkan pada nota pabrik.`,
                      highlight: 'amber',
                    },
                    ...seriSteps,
                  ],
                  conclusion: `Total Netto Tagih = ${sumBruto} kg − ${sumTara} kg = ${sumNetto} kg.`,
                });
                return;
              }

              if (focus === 'MODAL') {
                const avgModalPerKg = sumNetto > 0 ? Math.round(sumInternalCost / sumNetto) : 0;
                const seriSteps = activeSheetSerials.map((s, idx) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  const costKg = Math.round(s.effectiveHppAfterTaraPerKg || s.hppPerNetKg);
                  const modalRp = Math.round(netto * costKg);
                  return {
                    stepNumber: idx + 4,
                    title: `Seri ${s.serialNumber}`,
                    formula: 'Jumlah Modal Seri = Netto Tagih × Harga Modal / KG',
                    substitution: `${netto} kg × ${formatRupiah(costKg)}/kg = ${formatRupiah(modalRp)}`,
                    resultLabel: `Seri ${s.serialNumber}`,
                    resultValue: formatRupiah(modalRp),
                    explanation: `Modal produksi Seri ${s.serialNumber} (${netto} kg × ${formatRupiah(costKg)}/kg).`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `2. Total Modal Kita (${formatRupiah(sumInternalCost)})`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • ${activeSheetSerials.length} Seri Aktif (${sumNetto} kg)`,
                  badgeText: 'PANEL 2 GULUNGAN • RUMUS TOTAL MODAL KITA',
                  coreFormula:
                    'Total Modal Kita = Σ (Netto Tagih Seri × Harga Modal / KG)',
                  appliedFormula: `Total Modal Kita = ${sumNetto} kg × ${formatRupiah(avgModalPerKg)}/kg = ${formatRupiah(sumInternalCost)}`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Netto Tagih',
                      formula: 'Total Netto Tagih = Total Bruto − Total Potongan Tarra',
                      substitution: `${sumBruto} kg − ${sumTara} kg = ${sumNetto} kg`,
                      resultLabel: 'Total Netto Tagih',
                      resultValue: `${sumNetto} kg`,
                      explanation: `Total berat bersih seluruh ${activeSheetSerials.length} Seri.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Rata-Rata Modal/KG',
                      formula: 'Rata-Rata Modal/KG = Total Modal Kita ÷ Total Netto Tagih',
                      substitution: `${formatRupiah(sumInternalCost)} ÷ ${sumNetto} kg = ${formatRupiah(avgModalPerKg)}/kg`,
                      resultLabel: 'Rata-Rata Modal/KG',
                      resultValue: `${formatRupiah(avgModalPerKg)}/kg`,
                      explanation: `Rata-rata harga pokok per kilogram tagih di gulungan ini.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 3,
                      title: 'Total Modal Kita',
                      formula: 'Total Modal Kita = Σ Jumlah Modal Seluruh Seri',
                      substitution: `${activeSheetSerials.length} Seri = ${formatRupiah(sumInternalCost)}`,
                      resultLabel: 'Total Modal Kita',
                      resultValue: formatRupiah(sumInternalCost),
                      explanation: `Total modal produksi seluruh Nomor Seri di gulungan ini.`,
                      highlight: 'amber',
                    },
                    ...seriSteps,
                  ],
                  conclusion: `Total Modal Kita = ${formatRupiah(sumInternalCost)}.`,
                });
                return;
              }

              if (focus === 'NOTA') {
                const avgNotaPerKg = sumNetto > 0 ? Math.round(sumFactoryNota / sumNetto) : 0;
                const seriSteps = activeSheetSerials.map((s, idx) => {
                  const bruto = s.packaging.grossWeightPerPackage;
                  const tara = s.factoryDeductionKg;
                  const netto = Math.max(0, bruto - tara);
                  const notaRp = Math.round(netto * s.factoryTargetPricePerKg);
                  return {
                    stepNumber: idx + 4,
                    title: `Seri ${s.serialNumber}`,
                    formula: 'Jumlah Nota Pabrik = Netto Tagih × Harga Pabrik / KG',
                    substitution: `${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)}/kg = ${formatRupiah(notaRp)}`,
                    resultLabel: `Seri ${s.serialNumber}`,
                    resultValue: formatRupiah(notaRp),
                    explanation: `Tagihan nota pabrik untuk Seri ${s.serialNumber} (${netto} kg × ${formatRupiah(s.factoryTargetPricePerKg)}).`,
                    highlight: 'white' as const,
                  };
                });

                setCalcDetail({
                  title: `3. Total Harga Pabrik / Nota (${formatRupiah(sumFactoryNota)})`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • Pabrik ${activeRoll.targetFactory} (${sumNetto} kg)`,
                  badgeText: 'PANEL 3 GULUNGAN • RUMUS TOTAL HARGA PABRIK (NOTA)',
                  coreFormula:
                    'Total Harga Pabrik = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
                  appliedFormula: `Total Harga Pabrik = ${sumNetto} kg × ${formatRupiah(avgNotaPerKg)}/kg = ${formatRupiah(sumFactoryNota)}`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Netto Tagih',
                      formula: 'Total Netto Tagih = Total Bruto − Total Potongan Tarra',
                      substitution: `${sumBruto} kg − ${sumTara} kg = ${sumNetto} kg`,
                      resultLabel: 'Total Netto Tagih',
                      resultValue: `${sumNetto} kg`,
                      explanation: `Total berat bersih yang ditagihkan ke ${activeRoll.targetFactory}.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Rata-Rata Harga Pabrik/KG',
                      formula: 'Rata-Rata Harga Pabrik/KG = Total Harga Pabrik ÷ Total Netto Tagih',
                      substitution: `${formatRupiah(sumFactoryNota)} ÷ ${sumNetto} kg = ${formatRupiah(avgNotaPerKg)}/kg`,
                      resultLabel: 'Rata-Rata Harga Pabrik/KG',
                      resultValue: `${formatRupiah(avgNotaPerKg)}/kg`,
                      explanation: `Rata-rata harga jual pabrik per kilogram di gulungan ini.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 3,
                      title: 'Total Harga Pabrik',
                      formula: 'Total Harga Pabrik = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
                      substitution: `${activeSheetSerials.length} Seri = ${formatRupiah(sumFactoryNota)}`,
                      resultLabel: 'Total Harga Pabrik',
                      resultValue: formatRupiah(sumFactoryNota),
                      explanation: `Total nilai tagihan nota pabrik untuk gulungan ini.`,
                      highlight: 'amber',
                    },
                    ...seriSteps,
                  ],
                  conclusion: `Total Harga Pabrik = ${formatRupiah(sumFactoryNota)}.`,
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
                    stepNumber: idx + 4,
                    title: `Seri ${s.serialNumber}`,
                    formula: 'Selisih Timbangan = (Netto Tagih − Tembakau Riil) × Harga Pabrik',
                    substitution: `(${netto} kg − ${realNet} kg) × ${formatRupiah(s.factoryTargetPricePerKg)} = ${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
                    resultLabel: `Seri ${s.serialNumber}`,
                    resultValue: `${wpKg >= 0 ? '+' : ''}${wpKg} kg (${wpRp >= 0 ? '+' : ''}${formatRupiah(wpRp)})`,
                    explanation: `Bruto ${bruto} kg dengan potongan pabrik ${tara} kg vs isi tembakau fisik ${realNet} kg.`,
                    highlight: (wpKg >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                  };
                });

                setCalcDetail({
                  title: `4. Selisih Timbangan Pabrik (${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg)`,
                  subtitle: `Gulungan ${activeRoll.rollNumber} • Nilai Selisih: ${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}`,
                  badgeText: 'PANEL 4 GULUNGAN • RUMUS SELISIH TIMBANGAN PABRIK',
                  coreFormula:
                    'Selisih Timbangan = Σ ((Netto Tagih − Tembakau Riil) × Harga Pabrik)',
                  appliedFormula: `Selisih Timbangan = ${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg = ${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}`,
                  steps: [
                    {
                      stepNumber: 1,
                      title: 'Total Netto Tagih',
                      formula: 'Total Netto Tagih = Total Bruto − Total Potongan Tarra',
                      substitution: `${sumBruto} kg − ${sumTara} kg = ${sumNetto} kg`,
                      resultLabel: 'Total Netto Tagih',
                      resultValue: `${sumNetto} kg`,
                      explanation: `Total berat bersih yang diakui pabrik pada nota.`,
                      highlight: 'white',
                    },
                    {
                      stepNumber: 2,
                      title: 'Total Selisih Berat',
                      formula: 'Total Selisih Berat = Σ (Netto Tagih Seri − Tembakau Riil Seri)',
                      substitution: `${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg`,
                      resultLabel: 'Total Selisih Berat',
                      resultValue: `${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg`,
                      explanation: `Total selisih berat kemasan dibanding potongan tarra pabrik.`,
                      highlight: sumFactoryWeightProfitKg >= 0 ? 'amber' : 'red',
                    },
                    {
                      stepNumber: 3,
                      title: 'Nilai Selisih Timbangan',
                      formula: 'Nilai Selisih = Σ (Selisih Berat Seri × Harga Pabrik)',
                      substitution: `${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}`,
                      resultLabel: 'Nilai Selisih Timbangan',
                      resultValue: `${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}`,
                      explanation: `Nilai Rupiah dari selisih timbangan setor pabrik.`,
                      highlight: sumFactoryWeightProfitRp >= 0 ? 'amber' : 'red',
                    },
                    ...seriSteps,
                  ],
                  conclusion: `Selisih Timbangan Pabrik = ${sumFactoryWeightProfitKg >= 0 ? '+' : ''}${sumFactoryWeightProfitKg} kg (${sumFactoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(sumFactoryWeightProfitRp)}).`,
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
                  stepNumber: idx + 4,
                  title: `Seri ${s.serialNumber}`,
                  formula: 'Profit Seri = Jumlah Nota Pabrik − Jumlah Modal Kita',
                  substitution: `${formatRupiah(notaRp)} − ${formatRupiah(modalRp)} = ${profitRp >= 0 ? '+' : ''}${formatRupiah(profitRp)}`,
                  resultLabel: `Seri ${s.serialNumber}`,
                  resultValue: `${profitRp >= 0 ? '+' : ''}${formatRupiah(profitRp)}`,
                  explanation: `Netto ${netto} kg × (Harga Pabrik ${formatRupiah(s.factoryTargetPricePerKg)} − Modal ${formatRupiah(costKg)}).`,
                  highlight: (profitRp >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                };
              });

              setCalcDetail({
                title: `5. Profit Gulungan (${formatRupiah(totalNetProfit)})`,
                subtitle: `Gulungan ${activeRoll.rollNumber} • Nota ${formatRupiah(sumFactoryNota)} − Modal ${formatRupiah(sumInternalCost)}`,
                badgeText: 'PANEL 5 GULUNGAN • RUMUS PROFIT BERSIH GULUNGAN',
                coreFormula:
                  'Profit Gulungan = Total Harga Pabrik (Nota) − Total Modal Kita',
                appliedFormula: `Profit Gulungan = ${formatRupiah(sumFactoryNota)} − ${formatRupiah(sumInternalCost)} = ${totalNetProfit >= 0 ? '+' : ''}${formatRupiah(totalNetProfit)}`,
                steps: [
                  {
                    stepNumber: 1,
                    title: 'Total Harga Pabrik (Nota)',
                    formula: 'Total Harga Pabrik = Σ (Netto Tagih Seri × Harga Pabrik / KG)',
                    substitution: `${sumNetto} kg (${activeSheetSerials.length} Seri) = ${formatRupiah(sumFactoryNota)}`,
                    resultLabel: 'Total Harga Pabrik (Nota)',
                    resultValue: formatRupiah(sumFactoryNota),
                    explanation: `Total uang tagihan nota pabrik dari seluruh seri di gulungan ini.`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 2,
                    title: 'Total Modal Kita',
                    formula: 'Total Modal Kita = Σ (Netto Tagih Seri × Harga Modal / KG)',
                    substitution: `${sumNetto} kg (${activeSheetSerials.length} Seri) = ${formatRupiah(sumInternalCost)}`,
                    resultLabel: 'Total Modal Kita',
                    resultValue: formatRupiah(sumInternalCost),
                    explanation: `Total modal produksi seluruh seri di gulungan ini.`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 3,
                    title: 'Profit Gulungan',
                    formula: 'Profit Gulungan = Total Harga Pabrik (Nota) − Total Modal Kita',
                    substitution: `${formatRupiah(sumFactoryNota)} − ${formatRupiah(sumInternalCost)} = ${totalNetProfit >= 0 ? '+' : ''}${formatRupiah(totalNetProfit)}`,
                    resultLabel: 'Profit Gulungan',
                    resultValue: `${totalNetProfit >= 0 ? '+' : ''}${formatRupiah(totalNetProfit)}`,
                    explanation: `Keuntungan bersih dari Gulungan ${activeRoll.rollNumber}.`,
                    highlight: totalNetProfit >= 0 ? 'amber' : 'red',
                  },
                  ...seriSteps,
                ],
                conclusion: `Profit Gulungan = ${formatRupiah(sumFactoryNota)} − ${formatRupiah(sumInternalCost)} = ${formatRupiah(totalNetProfit)}.`,
              });
            };

            const rollPendingCount = allSerialsInRoll.filter(
              (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
            ).length;
            const rollAcceptedCount = allSerialsInRoll.filter(
              (s) => s.factoryStatus === 'ACCEPTED_CAIR'
            ).length;
            const rollRejectedCount = allSerialsInRoll.filter(
              (s) => s.factoryStatus === 'REJECTED_STOCK'
            ).length;

            return (
              <div className="space-y-4">
                {/* Stage & Send to Factory Action Banner */}
                <div className="bg-black/95 p-3.5 sm:p-4 rounded-2xl border-2 border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs border ${
                          activeRoll.isSentToFactory
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                            : 'bg-zinc-950 border-zinc-700 text-zinc-200'
                        }`}
                      >
                        {activeRoll.isSentToFactory
                          ? 'STATUS: SUDAH DIKIRIM KE PABRIK'
                          : 'STATUS: MASIH DI GUDANG KITA'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
                        Menunggu Pabrik: <b className="text-white">{rollPendingCount}</b> • Diterima / Accepted:{' '}
                        <b className="text-amber-400">{rollAcceptedCount}</b> • Reject:{' '}
                        <b className="text-red-400">{rollRejectedCount}</b>
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {activeRoll.isSentToFactory
                        ? `Gulungan ini berada di menu Status Barang (${activeRoll.targetFactory}). Tentukan status Diterima / Accepted, Cair / Belum Cair, atau Reject pada tiap Seri di bawah.`
                        : `Gulungan ini masih tersimpan di menu Gulungan. Klik "Kirim ke Pabrik" saat barang berangkat agar otomatis pindah ke menu Status Barang.`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {onDeleteRoll && (
                      <button
                        type="button"
                        aria-label={`Hapus Gulungan ${activeRoll.rollNumber}`}
                        onClick={() => {
                          onDeleteRoll(activeRoll.id);
                          setActiveRollId(null);
                        }}
                        className="min-h-11 px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-red-950/70 text-red-400 border border-red-500/50 hover:border-red-500 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Hapus Gulungan</span>
                      </button>
                    )}

                    {onSendRollToFactory && (
                      <div>
                        {!activeRoll.isSentToFactory ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSendRollToFactory(activeRoll.id, true);
                              setActiveRollId(null);
                            }}
                            className="w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0"
                          >
                            <Send className="w-4 h-4 stroke-[2.5]" />
                            <span>Kirim Gulungan ke Pabrik →</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onSendRollToFactory(activeRoll.id, false);
                              setActiveRollId(null);
                            }}
                            className="w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-200 hover:text-white border border-zinc-700 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>← Kembalikan ke Gudang</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

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

                {/* Clear 3-Tab View Switcher inside Gulungan: 1. Daftar Seri, 2. Tabel Nota Sheet, 3. Komposisi Tembakau Per Grade */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-black/95 p-3 sm:p-4 rounded-2xl border-2 border-zinc-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setActiveRollTab('SERI')}
                      className={`min-h-11 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer border-2 transition-all ${
                        activeRollTab === 'SERI'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 hover:text-white border-zinc-800'
                      }`}
                    >
                      <Package className="w-4 h-4 shrink-0" />
                      <span>1. Daftar Seri ({allSerialsInRoll.length} Keranjang)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveRollTab('NOTA')}
                      className={`min-h-11 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer border-2 transition-all ${
                        activeRollTab === 'NOTA'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 hover:text-white border-zinc-800'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      <span>2. Tabel Nota Sheet</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveRollTab('KOMPOSISI')}
                      className={`min-h-11 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer border-2 transition-all ${
                        activeRollTab === 'KOMPOSISI'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                          : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-200 hover:text-white border-zinc-800'
                      }`}
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>3. Komposisi Tembakau Per Grade</span>
                    </button>
                  </div>

                  {onOpenGoogleSheetsModal && (
                    <button
                      type="button"
                      title="Transfer Langsung ke Google Sheets"
                      onClick={onOpenGoogleSheetsModal}
                      className="btn-amber-outline min-h-11 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      <span>Transfer Google Sheets</span>
                    </button>
                  )}
                </div>

                {/* TAB 1: Full-Screen Spacious Seri Grid with Direct Price, Grade & Terima Cair / Reject Controls */}
                {activeRollTab === 'SERI' && (
                  <div className="bg-black p-3.5 sm:p-4 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <Package className="w-4 h-4 text-zinc-300" />
                          Daftar Nomor Seri di Dalam Gulungan ({allSerialsInRoll.length} Keranjang)
                        </h3>
                        <span className="text-[11px] text-zinc-400">
                          Ubah <b className="text-white">Grade & Harga Pabrik/KG</b>, status{' '}
                          <b className="text-amber-400">Diterima</b> vs{' '}
                          <b className="text-red-400">Reject</b>, atau gunakan aksi massal di kanan
                        </span>
                      </div>

                      {allSerialsInRoll.length > 1 &&
                        onUpdateSerialStatus &&
                        allSerialsInRoll.some(
                          (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
                        ) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                allSerialsInRoll.forEach((s) => {
                                  if ((s.factoryStatus || 'PENDING') === 'PENDING') {
                                    onUpdateSerialStatus(s.id, 'ACCEPTED_CAIR', activeRoll);
                                  }
                                });
                              }}
                              className="h-8 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/60 text-amber-300 text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Terima Semua Pending</span>
                            </button>
                          </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {allSerialsInRoll.map((ser, serIdx) => {
                        const status = ser.factoryStatus || 'PENDING';
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
                        const serialMissing = getSerialMissingFlags(ser);
                        const nextSer = allSerialsInRoll[serIdx + 1];

                        const seriHoldOptions = [
                          {
                            id: 'focus_price',
                            label: 'Harga Pabrik & Profit Seri',
                            shortLabel: 'Harga / KG',
                            sublabel:
                              ser.factoryTargetPricePerKg > 0
                                ? `${formatRupiah(ser.factoryTargetPricePerKg)}/kg`
                                : 'Belum diisi (Rp 0)',
                            detailRows: [
                              {
                                label: 'Harga Pabrik / KG',
                                value:
                                  ser.factoryTargetPricePerKg > 0
                                    ? `${formatRupiah(ser.factoryTargetPricePerKg)}/kg`
                                    : 'Belum diisi (Rp 0)',
                                tone: (ser.factoryTargetPricePerKg > 0 ? 'emerald' : 'rose') as
                                  | 'emerald'
                                  | 'rose',
                              },
                              {
                                label: 'Modal Kita vs Nota',
                                value: `${formatRupiah(modal)} vs ${formatRupiah(nota)}`,
                                tone: 'white' as const,
                              },
                              {
                                label: 'Profit Seri',
                                value: `${profit >= 0 ? '+' : ''}${formatRupiah(profit)}`,
                                tone: (profit >= 0 ? 'emerald' : 'rose') as 'emerald' | 'rose',
                              },
                            ],
                            icon: <DollarSign className="w-3.5 h-3.5" />,
                            isMissing: serialMissing.missingFactoryPrice,
                            missingLabel: 'Belum Diisi',
                          },
                          {
                            id: 'edit_weights',
                            label: 'Timbangan & Tarra Seri',
                            shortLabel: 'Timbangan',
                            sublabel:
                              bruto > 0 ? `Bruto ${bruto} kg • Netto ${netto} kg` : 'Bruto masih 0 kg',
                            detailRows: [
                              {
                                label: 'Bruto Timbangan',
                                value: bruto > 0 ? `${bruto} kg` : 'Belum diisi (0 kg)',
                                tone: (bruto > 0 ? 'emerald' : 'rose') as 'emerald' | 'rose',
                              },
                              {
                                label: 'Kemasan & Tarra',
                                value: `${ser.packaging.packagingType} (−${tara} kg)`,
                                tone: 'white' as const,
                              },
                              {
                                label: 'Netto Tagih vs Riil',
                                value: `${netto} kg • Riil ${realNet} kg`,
                                tone: 'amber' as const,
                              },
                            ],
                            icon: <Scale className="w-3.5 h-3.5" />,
                            isMissing: serialMissing.missingWeight,
                            missingLabel: 'Belum Diisi',
                          },
                          {
                            id: 'edit_character',
                            label: 'Grade & 6 Atribut (/5)',
                            shortLabel: '6 Atribut',
                            sublabel: `Grade ${ser.compositeColorGrade}`,
                            detailRows: [
                              {
                                label: 'Grade Seri',
                                value: `Grade ${ser.compositeColorGrade}`,
                                tone: 'amber' as const,
                              },
                              {
                                label: 'Power · Impact · Bitter',
                                value: `${toScale5(ser.weightedPower).toFixed(1)} · ${toScale5(ser.weightedImpact).toFixed(1)} · ${toScale5(ser.weightedBitter).toFixed(1)} /5`,
                                tone: (serialMissing.missingAttributes ? 'rose' : 'emerald') as
                                  | 'emerald'
                                  | 'rose',
                              },
                              {
                                label: 'Burn · Sugar · Aroma',
                                value: `${toScale5(ser.weightedBurn ?? 4.5).toFixed(1)} · ${toScale5(ser.weightedSugar ?? 4.0).toFixed(1)} · ${toScale5(ser.weightedAroma ?? 4.2).toFixed(1)} /5`,
                                tone: (serialMissing.missingAttributes ? 'rose' : 'emerald') as
                                  | 'emerald'
                                  | 'rose',
                              },
                            ],
                            icon: <Sliders className="w-3.5 h-3.5" />,
                            isMissing: serialMissing.missingAttributes,
                            missingLabel: 'Belum Diisi',
                          },
                          ...(onUpdateSerialStatus
                            ? [
                                {
                                  id: 'accept_serial',
                                  label: 'Tandai Diterima / Accepted',
                                  shortLabel: 'Diterima',
                                  sublabel: 'Lolos QC pabrik',
                                  detailRows: [
                                    {
                                      label: 'Status Saat Ini',
                                      value:
                                        status === 'ACCEPTED_CAIR'
                                          ? 'Sudah Diterima (Accepted)'
                                          : status === 'REJECTED_STOCK'
                                            ? 'Reject (Di Stok Jadi)'
                                            : 'Menunggu Pabrik',
                                      tone: 'emerald' as const,
                                    },
                                    {
                                      label: 'Nilai Nota Cair',
                                      value: formatRupiah(nota),
                                      tone: 'amber' as const,
                                    },
                                  ],
                                  actionHint: 'Lepas → Terima',
                                  icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                                  tone: 'emerald' as const,
                                },
                                {
                                  id: 'reject_serial',
                                  label: 'Tandai Reject ke Stok Jadi',
                                  shortLabel: 'Reject',
                                  sublabel: 'Kembalikan ke Stok Jadi',
                                  detailRows: [
                                    {
                                      label: 'Efek Aksi',
                                      value: 'Masuk Panel 2: Stok Tembakau Jadi',
                                      tone: 'rose' as const,
                                    },
                                    {
                                      label: 'Berat & Kemasan',
                                      value: `Utuh ${netto} kg (${ser.packaging.packagingType})`,
                                      tone: 'white' as const,
                                    },
                                  ],
                                  actionHint: 'Lepas → Reject',
                                  icon: <XCircle className="w-3.5 h-3.5" />,
                                  tone: 'rose' as const,
                                },
                              ]
                            : []),
                          ...(onUpdateSerial
                            ? [
                                {
                                  id: 'edit_full',
                                  label: 'Edit Lengkap Seri',
                                  shortLabel: 'Edit Semua',
                                  sublabel: 'Buka semua kolom seri',
                                  detailRows: [
                                    {
                                      label: 'Nomor Seri',
                                      value: formatSerialLineage(ser),
                                      tone: 'amber' as const,
                                    },
                                    {
                                      label: 'Pabrik Tujuan',
                                      value: ser.targetFactory || activeRoll.targetFactory,
                                      tone: 'white' as const,
                                    },
                                  ],
                                  icon: <Edit3 className="w-3.5 h-3.5" />,
                                },
                              ]
                            : []),
                        ];

                        const handleSelectSeriHoldOption = (optId: string) => {
                          if (optId === 'focus_price') {
                            const inp = serialPriceInputRefs.current[ser.id];
                            inp?.focus();
                            inp?.select();
                            return;
                          }
                          if (optId === 'edit_weights' && onUpdateSerial) {
                            setEditingSerialSection('weights');
                            setEditingSerial(ser);
                            return;
                          }
                          if (optId === 'edit_character' && onUpdateSerial) {
                            setEditingSerialSection('character');
                            setEditingSerial(ser);
                            return;
                          }
                          if (optId === 'edit_full' && onUpdateSerial) {
                            setEditingSerialSection('main');
                            setEditingSerial(ser);
                            return;
                          }
                          if (optId === 'accept_serial' && onUpdateSerialStatus) {
                            onUpdateSerialStatus(ser.id, 'ACCEPTED_CAIR', activeRoll);
                            return;
                          }
                          if (optId === 'reject_serial' && onUpdateSerialStatus) {
                            onUpdateSerialStatus(ser.id, 'REJECTED_STOCK', activeRoll);
                          }
                        };

                        const seriHoldHandlers = serialHoldMenu.bindHoldHandlers({
                          id: ser.id,
                          title: `SERI ${formatSerialLineage(ser)}`,
                          subtitle: serialMissing.isIncomplete
                            ? `Belum diisi: ${serialMissing.missingLabels.join(', ')}`
                            : `Grade ${ser.compositeColorGrade} • Netto ${netto} kg`,
                          options: seriHoldOptions,
                          onSelect: handleSelectSeriHoldOption,
                        });

                        return (
                          <div
                            key={ser.id}
                            {...seriHoldHandlers}
                            className={`p-3 rounded-xl bg-zinc-950 border transition-colors text-xs space-y-2.5 flex flex-col justify-between select-none ${
                              serialHoldMenu.isHoldingProgressId === ser.id
                                ? 'border-amber-400 ring-2 ring-amber-400/70 scale-[0.99]'
                                : status === 'ACCEPTED_CAIR'
                                  ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.08)]'
                                  : status === 'REJECTED_STOCK'
                                    ? 'border-red-500/60 opacity-95'
                                    : serialMissing.isIncomplete
                                      ? 'border-amber-500/45 hover:border-amber-400'
                                      : 'border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-md bg-black border border-zinc-700 font-mono font-black text-amber-400 text-xs whitespace-nowrap shrink-0">
                                  SERI {formatSerialLineage(ser)}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={ser.compositeColorGrade}
                                    onChange={(e) =>
                                      onRepriceSerial(ser.id, {
                                        compositeColorGrade: e.target.value as TobaccoGrade,
                                      })
                                    }
                                    aria-label={`Ubah Grade Seri ${ser.serialNumber}`}
                                    className="h-7 px-1.5 rounded bg-black border border-zinc-700 hover:border-amber-500/70 text-zinc-100 font-bold text-[11px] cursor-pointer focus:outline-hidden"
                                  >
                                    {(Object.keys(GRADE_LABELS) as TobaccoGrade[]).map((g) => (
                                      <option key={g} value={g}>
                                        Grade {g}
                                      </option>
                                    ))}
                                  </select>

                                  {onUpdateSerial && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        serialHoldMenu.openMenuImmediate({
                                          anchorEl: e.currentTarget,
                                          title: `SERI ${formatSerialLineage(ser)}`,
                                          subtitle: serialMissing.isIncomplete
                                            ? `Belum diisi: ${serialMissing.missingLabels.join(', ')}`
                                            : `Grade ${ser.compositeColorGrade} • Netto ${netto} kg`,
                                          options: seriHoldOptions,
                                          onSelect: handleSelectSeriHoldOption,
                                        });
                                      }}
                                      className={`h-7 px-2 rounded border font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                        serialMissing.isIncomplete
                                          ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/60 text-amber-300'
                                          : 'bg-black hover:bg-zinc-900 border-zinc-700 hover:border-amber-500/70 text-amber-400'
                                      }`}
                                      title={`Menu Cepat Seri ${ser.serialNumber}`}
                                    >
                                      <Hand className="w-3 h-3" />
                                      <span>{serialMissing.isIncomplete ? 'Lengkapi' : 'Edit'}</span>
                                    </button>
                                  )}

                                  {onDeleteSerial && (
                                    <button
                                      type="button"
                                      aria-label={`Hapus Seri ${ser.serialNumber}`}
                                      onClick={() => onDeleteSerial(ser.id)}
                                      className="group/del relative h-7 w-7 shrink-0 rounded bg-black hover:bg-red-950/70 border border-zinc-800 hover:border-red-500/70 text-zinc-400 hover:text-red-400 flex items-center justify-center cursor-pointer transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                      <span className="pointer-events-none opacity-0 group-hover/del:opacity-100 transition-opacity duration-150 absolute -top-7 right-0 z-50 px-2 py-0.5 rounded bg-black border border-red-500/70 text-red-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                                        Hapus Seri {ser.serialNumber}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Unfilled Marks for Seri */}
                              {serialMissing.isIncomplete && (
                                <div className="flex items-center gap-1 flex-wrap" data-no-card-hold="true">
                                  {serialMissing.missingFactoryPrice && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const inp = serialPriceInputRefs.current[ser.id];
                                        inp?.focus();
                                        inp?.select();
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-dashed border-amber-500/70 text-[9px] font-black text-amber-300 cursor-pointer"
                                    >
                                      ⏳ Harga Pabrik
                                    </button>
                                  )}
                                  {serialMissing.missingWeight && onUpdateSerial && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSerialSection('weights');
                                        setEditingSerial(ser);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-dashed border-amber-500/70 text-[9px] font-black text-amber-300 cursor-pointer"
                                    >
                                      ⏳ Timbangan
                                    </button>
                                  )}
                                  {serialMissing.missingAttributes && onUpdateSerial && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSerialSection('character');
                                        setEditingSerial(ser);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/25 border border-dashed border-amber-500/50 text-[9px] font-bold text-amber-200 cursor-pointer"
                                    >
                                      ⏳ Atribut
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Factory Decision Status Badge */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] uppercase font-bold text-zinc-400">
                                  Status Pabrik:
                                </span>
                                {status === 'ACCEPTED_CAIR' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/50 text-[10px] font-extrabold uppercase">
                                    <CheckCircle2 className="w-3 h-3 text-amber-400" /> Diterima / Accepted
                                  </span>
                                )}
                                {status === 'REJECTED_STOCK' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-700/60 text-[10px] font-extrabold uppercase">
                                    <XCircle className="w-3 h-3 text-red-400" /> Reject ke Stok
                                  </span>
                                )}
                                {status === 'PENDING' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black text-zinc-300 border border-zinc-700 text-[10px] font-extrabold uppercase">
                                    <Clock className="w-3 h-3 text-amber-400" /> Menunggu Pabrik
                                  </span>
                                )}
                              </div>

                              {hasSerialLineage(ser) && ser.previousRollNumber && (
                                <div className="text-[10px] font-mono text-zinc-400">
                                  Eks-Gulungan:{' '}
                                  <b className="text-amber-300">{ser.previousRollNumber}</b>
                                </div>
                              )}

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

                              {/* Editable Factory Price per KG with Enter-to-Advance to Next Seri */}
                              <div data-no-card-hold="true">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <label className="block text-[10px] text-zinc-200 font-bold uppercase">
                                    Harga Pabrik / KG (Rp)
                                  </label>
                                  {nextSer && (
                                    <span className="text-[9px] text-zinc-500">
                                      Enter → Seri {nextSer.serialNumber}
                                    </span>
                                  )}
                                </div>
                                <NumericInput
                                  ref={(el) => {
                                    serialPriceInputRefs.current[ser.id] = el;
                                  }}
                                  emptyWhenZero
                                  enterKeyHint={nextSer ? 'next' : 'done'}
                                  value={ser.factoryTargetPricePerKg}
                                  onChange={(val) =>
                                    onRepriceSerial(ser.id, { factoryTargetPricePerKg: val })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (nextSer && serialPriceInputRefs.current[nextSer.id]) {
                                        const nextInput = serialPriceInputRefs.current[nextSer.id];
                                        nextInput?.focus();
                                        nextInput?.select();
                                      } else {
                                        (e.currentTarget as HTMLInputElement).blur();
                                      }
                                    }
                                  }}
                                  placeholder="Harga menyusul (0)"
                                  className={`w-full h-8 px-2.5 bg-black rounded-lg text-right font-mono font-bold text-xs focus:outline-hidden ${
                                    serialMissing.missingFactoryPrice
                                      ? 'border border-dashed border-amber-500/70 focus:border-amber-400 text-amber-300'
                                      : 'border border-zinc-800 focus:border-amber-400 text-zinc-200'
                                  }`}
                                />
                              </div>
                            </div>

                            <div className="pt-2 border-t border-zinc-900 space-y-2">
                              <div className="space-y-1 font-mono text-[11px]">
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

                              {/* Unified Diterima/Accepted vs Reject + Cair/Belum Cair Action Buttons */}
                              {onUpdateSerialStatus && (
                                <div className="pt-1.5 border-t border-zinc-900 space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateSerialStatus(ser.id, 'ACCEPTED_CAIR', activeRoll)
                                      }
                                      className={`min-h-8 px-2 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                        status === 'ACCEPTED_CAIR'
                                          ? 'bg-amber-500 text-black border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                                          : 'bg-black hover:bg-zinc-900 text-white border border-zinc-700 hover:border-amber-500/70'
                                      }`}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>Diterima</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateSerialStatus(ser.id, 'REJECTED_STOCK', activeRoll)
                                      }
                                      className={`min-h-8 px-2 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                        status === 'REJECTED_STOCK'
                                          ? 'bg-red-600 text-white border border-red-400'
                                          : 'bg-black hover:bg-zinc-900 text-red-300 border border-zinc-700 hover:border-red-500/70'
                                      }`}
                                    >
                                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>Reject</span>
                                    </button>
                                  </div>

                                  {status !== 'PENDING' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateSerialStatus(ser.id, 'PENDING', activeRoll)
                                      }
                                      className="w-full min-h-7 py-1 rounded-lg bg-black hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Kembalikan ke Menunggu Pabrik</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: Tabel Nota Sheet Section */}
                {activeRollTab === 'NOTA' && (
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

                {/* TAB 3: Komposisi & Evaluasi Per Grade */}
                {activeRollTab === 'KOMPOSISI' && (
                  <RollCompositionAndEvaluationPanel
                    roll={activeRoll}
                    finishedBatches={finishedBatches}
                    rawTobaccos={rawTobaccos}
                    onUpdateSmokingTest={(rollId, updatedTest) => {
                      if (onUpdateSmokingTest) {
                        onUpdateSmokingTest(rollId, updatedTest);
                      } else {
                        onSelectRoll(activeRoll);
                      }
                    }}
                    isEmbedded={true}
                  />
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
          initialSection={editingSerialSection}
          onClose={() => setEditingSerial(null)}
          onSave={(updated) => {
            onUpdateSerial(updated);
            setEditingSerial(null);
          }}
        />
      )}

      <HoldQuickMenuOverlay
        menu={serialHoldMenu.activeMenu}
        hoveredOptionId={serialHoldMenu.hoveredOptionId}
        onSelectOption={serialHoldMenu.selectOption}
        onClose={serialHoldMenu.closeMenu}
      />

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
