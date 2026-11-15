import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Camera,
  Upload,
  Printer,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  RefreshCw,
  FileCheck2,
  ShieldAlert,
  Layers,
  Image as ImageIcon,
  Bluetooth,
  ScanBarcode,
  Search,
  Lock,
  Plus,
  BookmarkCheck,
} from 'lucide-react';
import { PackagingMaster, RawTobacco, TobaccoGrade } from '../types/tobacco';
import { TOBACCO_GRADE_ORDER, formatRating5, formatRupiah } from '../utils/tobaccoMath';
import {
  ReviewedScannedGradeCard,
  ScannedGradeCardRawInput,
  buildEditableReviewCardFromExistingStock,
  buildWarehouseMasterDictionary,
  classifyScannedCardsForReview,
  generateNextLotBatchNumbers,
  normalizeLotNumber,
} from '../utils/gradeCardEngine';
import {
  DuplexMode,
  PrintPaperFormat,
  THERMAL_PROFILES,
  arrangeDuplexBackSlots,
  buildDynamicPrintPageCss,
  computeCode39TotalUnits,
  encodeCode39Modules,
  extractLotPrefixCode,
  isThermalPaperFormat,
  printCanvasViaWebBluetooth,
  renderThermalCardToCanvas,
} from '../utils/thermalPrintEngine';
import {
  decodeCode39FromCanvas,
  decodeCode39FromVideoElement,
} from '../utils/code39DecoderEngine';
import {
  PRINT_PREFIX_REGISTRY_STORAGE_KEY,
  PrefixRegistryState,
  loadPrefixRegistryState,
  mergeRegistryWithDiscoveredPrefixes,
  normalizePrefixInput,
  recordPrintedBatchToPrefixRegistry,
  registerNewPrefix,
  removeRegisteredPrefix,
  savePrefixRegistryState,
  selectActivePrefix,
} from '../utils/prefixRegistryEngine';

const ISSUED_PRINT_LOTS_STORAGE_KEY = 'tobacco_lab_issued_print_lots_v1';

function loadIssuedPrintedLots(): string[] {
  try {
    const raw = localStorage.getItem(ISSUED_PRINT_LOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((v) => String(v || '').trim().toUpperCase()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

interface GradeCardScannerModalProps {
  isOpen: boolean;
  initialTab?: 'scan' | 'print';
  onClose: () => void;
  rawTobaccos: RawTobacco[];
  packagingList: PackagingMaster[];
  onCommitReviewedCards: (cards: ReviewedScannedGradeCard[]) => void;
  onShowToast?: (msg: string) => void;
}

const ATTRIBUTE_FIELDS: {
  key:
    | 'powerRating'
    | 'impactRating'
    | 'bitterRating'
    | 'burnRating'
    | 'sugarRating'
    | 'aromaRating';
  label: string;
  shortLabel: string;
}[] = [
  { key: 'powerRating', label: 'Power', shortLabel: 'PWR' },
  { key: 'impactRating', label: 'Impact', shortLabel: 'IMP' },
  { key: 'bitterRating', label: 'Bitter', shortLabel: 'BIT' },
  { key: 'burnRating', label: 'Burn', shortLabel: 'BRN' },
  { key: 'sugarRating', label: 'Sugar', shortLabel: 'SGR' },
  { key: 'aromaRating', label: 'Aroma', shortLabel: 'ARM' },
];

const UNCERTAIN_FIELD_LABELS: Record<string, string> = {
  lotNumber: 'Kode Lot',
  name: 'Nama Tembakau',
  origin: 'Daerah',
  sellerName: 'Penjual',
  colorGrade: 'Grade',
  packagingType: 'Kemasan',
  grossWeightKg: 'Bruto (kg)',
  pricePerKgPurchase: 'Harga/kg',
  powerRating: 'Power',
  impactRating: 'Impact',
  bitterRating: 'Bitter',
  burnRating: 'Burn',
  sugarRating: 'Sugar',
  aromaRating: 'Aroma',
};

/** Deterministic crisp 7x7 mini matrix SVG from Kode Lot string for printable paper cards */
const LotMatrixSvg: React.FC<{ lotCode: string; size?: number }> = ({ lotCode, size = 34 }) => {
  const cells = useMemo(() => {
    let seed = 2166136261;
    for (let i = 0; i < lotCode.length; i++) {
      seed ^= lotCode.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const grid: boolean[] = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        // Finder anchors at 3 corners
        const isCorner =
          (r < 2 && c < 2) || (r < 2 && c >= 5) || (r >= 5 && c < 2);
        if (isCorner) {
          grid.push(true);
        } else {
          seed ^= (r * 7 + c + 1) * 2654435761;
          seed = Math.imul(seed, 1597334677);
          grid.push((seed >>> 28) % 2 === 0);
        }
      }
    }
    return grid;
  }, [lotCode]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      className="border border-black bg-white p-[1px]"
      aria-hidden="true"
    >
      {cells.map((on, idx) =>
        on ? (
          <rect
            key={idx}
            x={idx % 7}
            y={Math.floor(idx / 7)}
            width={1}
            height={1}
            fill="#000000"
          />
        ) : null
      )}
    </svg>
  );
};

/** Single crisp black-on-white printable Kartu Grade Cetak */
const PrintableGradeCardPaper: React.FC<{
  lotNumber: string;
  packagingChoices: string[];
  compact: boolean;
}> = ({ lotNumber, packagingChoices, compact }) => {
  const pkgs = packagingChoices.slice(0, 6);
  const gradesRow1 = ['A+', 'A', 'B+', 'B', 'C+', 'C'];
  const gradesRow2 = ['D+', 'D', 'E+', 'E', 'F+', 'F'];

  return (
    <div
      className={`grade-card-paper-item relative bg-white text-black border-2 border-black flex flex-col justify-between select-none ${
        compact ? 'p-2.5 text-[9.5px]' : 'p-3.5 text-[10.5px]'
      }`}
      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
    >
      {/* 4 Corner Registration L-Marks for Vision Alignment */}
      <span className="absolute top-0.5 left-0.5 w-2.5 h-2.5 border-t-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 border-t-2 border-r-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 border-b-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 border-black pointer-events-none" />

      {/* Header + Lot Code + Matrix */}
      <div className="flex items-start justify-between gap-2 pb-1.5 border-b-2 border-black">
        <div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-zinc-700">
            TOBACCO LAB • KARTU GRADE
          </div>
          <div className="font-mono font-black tracking-tight text-sm leading-tight mt-0.5">
            {lotNumber}
          </div>
          <div className="text-[8px] text-zinc-600 mt-0.5">
            Tgl: ____/____/20____ • Grader: ____________
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LotMatrixSvg lotCode={lotNumber} size={compact ? 30 : 36} />
        </div>
      </div>

      {/* Boxed Handwritten Identity Fields */}
      <div className={`grid grid-cols-2 gap-1.5 ${compact ? 'my-1.5' : 'my-2'}`}>
        <div className="border border-black px-1.5 py-1">
          <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-700">
            PENJUAL / PETANI
          </div>
          <div className={compact ? 'h-4' : 'h-5'} />
        </div>
        <div className="border border-black px-1.5 py-1">
          <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-700">
            DAERAH ASAL (MTL/TMG/WDS)
          </div>
          <div className={compact ? 'h-4' : 'h-5'} />
        </div>
        <div className="col-span-2 border border-black px-1.5 py-1">
          <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-700">
            NAMA / JENIS TEMBAKAU
          </div>
          <div className={compact ? 'h-4' : 'h-5'} />
        </div>
      </div>

      {/* Grade Checkboxes (SILANG X) */}
      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-800 mb-1">
          GRADE WARNA (SILANG X / CENTANG 1)
        </div>
        <div className="grid grid-cols-6 gap-1">
          {[...gradesRow1, ...gradesRow2].map((gr) => (
            <div key={gr} className="flex items-center gap-1">
              <span className="inline-block w-3.5 h-3.5 rounded-[2px] border-[1.5px] border-black shrink-0" />
              <span className="font-mono font-black text-[9.5px]">{gr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Packaging Checkboxes (SILANG X) */}
      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-800 mb-1">
          KEMASAN (SILANG X / CENTANG 1)
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {pkgs.map((pkgName) => (
            <div key={pkgName} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-[2px] border-[1.5px] border-black shrink-0" />
              <span className="font-bold text-[8.5px] uppercase">{pkgName}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-[2px] border-[1.5px] border-black shrink-0" />
            <span className="font-bold text-[8.5px]">Lain: ______</span>
          </div>
        </div>
      </div>

      {/* 6 Attributes Whole-Number 1-5 Square Checkboxes (SILANG X, NO DECIMAL) */}
      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-800 mb-1">
          KARAKTER RASA &amp; BAKAR (SILANG X ANGKA 1–5 • BULAT)
        </div>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
          {ATTRIBUTE_FIELDS.map((attr) => (
            <div key={attr.key} className="flex items-center justify-between gap-1">
              <span className="font-extrabold text-[8.5px] uppercase">{attr.label}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <span
                    key={num}
                    className={`${
                      compact ? 'w-3.5 h-3.5 text-[8px]' : 'w-4 h-4 text-[9px]'
                    } rounded-[2px] border-[1.5px] border-black inline-flex items-center justify-center font-mono font-bold`}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage 2: Timbangan & Harga (Menyusul - Rescan same card) */}
      <div className="border-t-2 border-dashed border-black pt-1.5">
        <div className="text-[7.5px] font-black uppercase tracking-wider text-zinc-700 mb-1">
          TAHAP 2 (MENYUSUL — ISI &amp; SCAN ULANG KARTU INI)
        </div>
        <div className="grid grid-cols-12 gap-1.5">
          <div className="col-span-4 border border-black px-1.5 py-1">
            <div className="text-[7px] font-black uppercase">BRUTO (KG)</div>
            <div className={compact ? 'h-4' : 'h-4.5'} />
          </div>
          <div className="col-span-4 border border-black px-1.5 py-1">
            <div className="text-[7px] font-black uppercase">HARGA / KG (RP)</div>
            <div className={compact ? 'h-4' : 'h-4.5'} />
          </div>
          <div className="col-span-4 border border-black px-1.5 py-1">
            <div className="text-[7px] font-black uppercase">CATATAN</div>
            <div className={compact ? 'h-4' : 'h-4.5'} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** Scannable 1D Code 39 Linear Barcode SVG (ISO/ANSI standard bar/space ratios) */
const Code39BarcodeSvg: React.FC<{
  code: string;
  height?: number;
  className?: string;
}> = ({ code, height = 64, className = '' }) => {
  const { rects, totalUnits } = useMemo(() => {
    const runs = encodeCode39Modules(code);
    const total = computeCode39TotalUnits(runs);
    const quiet = 10;
    let cursor = quiet;
    const bars: { x: number; w: number }[] = [];
    for (const run of runs) {
      if (run.isBar) {
        bars.push({ x: cursor, w: run.units });
      }
      cursor += run.units;
    }
    return { rects: bars, totalUnits: total + quiet * 2 };
  }, [code]);

  return (
    <svg
      viewBox={`0 0 ${totalUnits} 100`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      style={{ height: `${height}px` }}
      className={`w-full bg-white block ${className}`}
      aria-label={`Barcode ${code}`}
    >
      <rect x={0} y={0} width={totalUnits} height={100} fill="#ffffff" />
      {rects.map((b, idx) => (
        <rect key={idx} x={b.x} y={0} width={b.w} height={100} fill="#000000" />
      ))}
    </svg>
  );
};

/** Back side of Printable Kartu Grade for 2-sided Duplex printing: Giant Barcode + Prefix Code */
const PrintableGradeCardBackPaper: React.FC<{
  lotNumber: string | null;
  customPrefix?: string;
  compact: boolean;
  rotate180?: boolean;
}> = ({ lotNumber, customPrefix, compact, rotate180 = false }) => {
  if (!lotNumber) {
    return (
      <div
        className={`grade-card-paper-item bg-white text-zinc-400 border border-dashed border-zinc-300 flex items-center justify-center select-none ${
          compact ? 'p-2.5' : 'p-3.5'
        }`}
      >
        <span className="font-mono text-[9px] uppercase tracking-widest">
          SLOT KOSONG (PENYEIMBANG DUPLEX)
        </span>
      </div>
    );
  }

  const prefixCode = extractLotPrefixCode(lotNumber, customPrefix);

  return (
    <div
      className={`grade-card-paper-item relative bg-white text-black border-2 border-black flex flex-col justify-between select-none ${
        compact ? 'p-3 text-[10px]' : 'p-4 text-[11px]'
      } ${rotate180 ? 'rotate-180' : ''}`}
      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
    >
      {/* 4 Corner Registration L-Marks aligned with Front Card */}
      <span className="absolute top-0.5 left-0.5 w-2.5 h-2.5 border-t-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 border-t-2 border-r-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 border-b-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 border-black pointer-events-none" />

      {/* Top Banner: Header + Bold Prefix Code */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-black">
        <div>
          <div className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-zinc-700">
            TOBACCO LAB • SISI BELAKANG
          </div>
          <div className="text-[9px] font-black uppercase tracking-wider mt-0.5">
            BARCODE SCANNER LOT GUDANG
          </div>
        </div>
        <div className="bg-black text-white px-2.5 py-1 rounded-[3px] text-right shrink-0">
          <div className="text-[7px] font-bold uppercase tracking-[0.15em] opacity-80">
            PREFIX CODE
          </div>
          <div className={`font-mono font-black tracking-wider ${compact ? 'text-xs' : 'text-sm'}`}>
            {prefixCode}
          </div>
        </div>
      </div>

      {/* Center Hero: Giant 1D Code 39 Barcode + Large 2D Lot Matrix + Jumbo Text */}
      <div className={`flex-1 flex flex-col justify-center ${compact ? 'my-2 gap-1.5' : 'my-3 gap-2.5'}`}>
        <div className="border-2 border-black p-2 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <Code39BarcodeSvg code={lotNumber} height={compact ? 58 : 78} />
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <LotMatrixSvg lotCode={lotNumber} size={compact ? 54 : 68} />
              <span className="text-[6.5px] font-mono font-extrabold uppercase mt-0.5">
                2D ANCHOR
              </span>
            </div>
          </div>

          <div
            className={`text-center font-mono font-black tracking-[0.14em] leading-none mt-2 pt-1.5 border-t border-zinc-300 ${
              compact ? 'text-lg' : 'text-2xl'
            }`}
          >
            {lotNumber}
          </div>
        </div>
      </div>

      {/* Bottom Quick Reference + Duplex Alignment Footer */}
      <div className="border-t-2 border-dashed border-black pt-1.5 flex items-center justify-between gap-2 text-[8px] font-mono font-bold text-zinc-700">
        <span>PREFIX: {prefixCode}</span>
        <span>SCAN BARCODE UNTUK TAHAP 2 / CARI LOT</span>
      </div>
    </div>
  );
};

/** Single-column vertical high-contrast slip formatted specifically for 58mm / 80mm thermal rolls */
const ThermalGradeCardPaper: React.FC<{
  lotNumber: string;
  packagingChoices: string[];
  profile: 'THERMAL_58' | 'THERMAL_80';
  includeBackBarcode?: boolean;
  customPrefix?: string;
}> = ({ lotNumber, packagingChoices, profile, includeBackBarcode = false, customPrefix }) => {
  const is58 = profile === 'THERMAL_58';
  const pkgs = packagingChoices.slice(0, 4);
  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
  const prefixCode = extractLotPrefixCode(lotNumber, customPrefix);

  return (
    <div
      className={`grade-card-thermal-strip bg-white text-black border-2 border-black mx-auto select-none ${
        is58 ? 'w-[52mm] p-1.5 text-[8.5px]' : 'w-[72mm] p-2.5 text-[10px]'
      }`}
      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
    >
      {/* Header + Lot Matrix */}
      <div className="flex items-start justify-between gap-1.5 pb-1.5 border-b-2 border-black">
        <div className="min-w-0">
          <div className={`${is58 ? 'text-[7px]' : 'text-[8px]'} font-extrabold uppercase tracking-[0.14em]`}>
            TOBACCO LAB • SLIP GRADE
          </div>
          <div className={`font-mono font-black tracking-tight leading-tight mt-0.5 ${is58 ? 'text-xs' : 'text-sm'}`}>
            {lotNumber}
          </div>
          <div className={`${is58 ? 'text-[7px]' : 'text-[8px]'} text-zinc-700 mt-0.5`}>
            Tgl: ___/___/20__ • Grd: _______
          </div>
        </div>
        <LotMatrixSvg lotCode={lotNumber} size={is58 ? 28 : 34} />
      </div>

      {/* Handwritten Identity Boxes */}
      <div className="space-y-1 my-1.5">
        <div className="border border-black px-1.5 py-1">
          <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase`}>PENJUAL / PETANI</div>
          <div className={is58 ? 'h-4' : 'h-5'} />
        </div>
        <div className="border border-black px-1.5 py-1">
          <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase`}>DAERAH ASAL (MTL/TMG/WDS)</div>
          <div className={is58 ? 'h-4' : 'h-5'} />
        </div>
        <div className="border border-black px-1.5 py-1">
          <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase`}>NAMA / JENIS TEMBAKAU</div>
          <div className={is58 ? 'h-4' : 'h-5'} />
        </div>
      </div>

      {/* Grade Warna Square Checkboxes */}
      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase mb-1`}>
          GRADE WARNA (SILANG X SATU)
        </div>
        <div className="grid grid-cols-4 gap-1">
          {grades.map((gr) => (
            <div key={gr} className="flex items-center gap-0.5">
              <span className={`${is58 ? 'w-3 h-3' : 'w-3.5 h-3.5'} rounded-[2px] border-[1.5px] border-black inline-block shrink-0`} />
              <span className={`font-mono font-black ${is58 ? 'text-[8px]' : 'text-[9px]'}`}>{gr}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kemasan Square Checkboxes */}
      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase mb-1`}>
          KEMASAN (SILANG X SATU)
        </div>
        <div className="grid grid-cols-2 gap-1">
          {pkgs.map((pkgName) => (
            <div key={pkgName} className="flex items-center gap-1 min-w-0">
              <span className={`${is58 ? 'w-3 h-3' : 'w-3.5 h-3.5'} rounded-[2px] border-[1.5px] border-black inline-block shrink-0`} />
              <span className={`font-bold uppercase truncate ${is58 ? 'text-[7.5px]' : 'text-[8.5px]'}`}>{pkgName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Karakter Rasa Square X-Checkboxes 1-5 */}
      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase mb-1`}>
          KARAKTER RASA (SILANG X ANGKA 1–5)
        </div>
        <div className="space-y-1">
          {ATTRIBUTE_FIELDS.map((attr) => (
            <div key={attr.key} className="flex items-center justify-between gap-1">
              <span className={`font-extrabold uppercase ${is58 ? 'text-[8px]' : 'text-[9px]'}`}>
                {attr.label}
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <span
                    key={num}
                    className={`${
                      is58 ? 'w-3.5 h-3.5 text-[8px]' : 'w-4 h-4 text-[9px]'
                    } rounded-[2px] border-[1.5px] border-black inline-flex items-center justify-center font-mono font-bold`}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage 2 Boxes */}
      <div className="border-t-2 border-dashed border-black pt-1">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7px]'} font-black uppercase mb-1`}>
          TAHAP 2: TIMBANGAN &amp; HARGA
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="border border-black px-1 py-0.5">
            <div className="text-[6.5px] font-black uppercase">BRUTO (KG)</div>
            <div className={is58 ? 'h-4' : 'h-5'} />
          </div>
          <div className="border border-black px-1 py-0.5">
            <div className="text-[6.5px] font-black uppercase">HARGA/KG (RP)</div>
            <div className={is58 ? 'h-4' : 'h-5'} />
          </div>
        </div>
      </div>

      {includeBackBarcode && (
        <div className="mt-2 pt-2 border-t-2 border-dashed border-black">
          <div className="text-center font-mono font-bold text-[6.5px] text-zinc-700 mb-1">
            --- LIPAT KE BELAKANG / TEMPEL ---
          </div>
          <div className="border border-black p-1 bg-white space-y-1">
            <div className="bg-black text-white px-1.5 py-0.5 font-mono font-black text-[8px] tracking-wider flex items-center justify-between">
              <span>PREFIX:</span>
              <span>{prefixCode}</span>
            </div>
            <Code39BarcodeSvg code={lotNumber} height={is58 ? 40 : 52} />
            <div className={`text-center font-mono font-black tracking-wider ${is58 ? 'text-[10px]' : 'text-xs'}`}>
              {lotNumber}
            </div>
          </div>
        </div>
      )}

      <div className="mt-1.5 pt-1 border-t border-dashed border-black text-center font-mono font-bold text-[7.5px] text-zinc-700">
        ✂ --- POTONG DISINI ({is58 ? '58MM' : '80MM'}) ---
      </div>
    </div>
  );
};

/** Resize & compress image client-side cleanly before uploading to AI Vision + extract local Code 39 barcodes */
async function compressImageFileToJpegBase64(
  source: File | HTMLVideoElement
): Promise<{ dataUrl: string; base64: string; mimeType: string; localBarcodes: string[] }> {
  const MAX_DIM = 1800;

  let width = 0;
  let height = 0;
  let drawSource: CanvasImageSource;

  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth || 1280;
    height = source.videoHeight || 720;
    drawSource = source;
  } else {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const objUrl = URL.createObjectURL(source);
      el.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve(el);
      };
      el.onerror = () => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Gagal membaca file gambar.'));
      };
      el.src = objUrl;
    });
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
    drawSource = img;
  }

  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Browser canvas tidak tersedia.');

  ctx.drawImage(drawSource, 0, 0, targetW, targetH);
  const localBarcodes = decodeCode39FromCanvas(canvas);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const base64 = dataUrl.split('base64,')[1] || '';
  return { dataUrl, base64, mimeType: 'image/jpeg', localBarcodes };
}

export const GradeCardScannerModal: React.FC<GradeCardScannerModalProps> = ({
  isOpen,
  initialTab = 'scan',
  onClose,
  rawTobaccos,
  packagingList,
  onCommitReviewedCards,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'print'>(initialTab);

  // Camera & Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const barcodePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeScratchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPurpose, setCameraPurpose] = useState<'NEW_STOCK' | 'BARCODE_UPDATE'>('NEW_STOCK');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [barcodeManualQuery, setBarcodeManualQuery] = useState('');
  const barcodeTimerRef = useRef<number | null>(null);

  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanQualityWarning, setScanQualityWarning] = useState<string>('');
  const [scanModelUsed, setScanModelUsed] = useState<string>('');
  const [reviewedCards, setReviewedCards] = useState<ReviewedScannedGradeCard[]>([]);

  // Printable Card Builder State (Strict Single-Print Anti-Double + Registered Prefix Memory)
  const [printCount, setPrintCount] = useState<number>(8);
  const [paperFormat, setPaperFormat] = useState<PrintPaperFormat>('A4_4');
  const [duplexMode, setDuplexMode] = useState<DuplexMode>('LONG_EDGE');
  const [includeThermalBarcode, setIncludeThermalBarcode] = useState<boolean>(true);
  const [issuedPrintedLots, setIssuedPrintedLots] = useState<string[]>(() =>
    loadIssuedPrintedLots()
  );
  const [prefixRegistryRaw, setPrefixRegistryRaw] = useState<PrefixRegistryState>(() =>
    loadPrefixRegistryState()
  );
  const [isAddingPrefix, setIsAddingPrefix] = useState(false);
  const [newPrefixDraft, setNewPrefixDraft] = useState('');
  const [isPrintLocked, setIsPrintLocked] = useState(false);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);

  const prefixRegistry = useMemo(
    () =>
      mergeRegistryWithDiscoveredPrefixes(
        prefixRegistryRaw,
        rawTobaccos,
        issuedPrintedLots
      ),
    [prefixRegistryRaw, rawTobaccos, issuedPrintedLots]
  );

  // Auto-select the last printed/registered prefix automatically
  const customLotPrefix = prefixRegistry.lastSelectedPrefix;

  const cardsPerA4Page: 4 | 6 = paperFormat === 'A4_6' ? 6 : 4;
  const isThermalMode = isThermalPaperFormat(paperFormat);

  const persistPrefixRegistry = (next: PrefixRegistryState) => {
    savePrefixRegistryState(next);
    setPrefixRegistryRaw(next);
  };

  // Keep issued print & prefix registries synchronized across browser tabs / windows
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === ISSUED_PRINT_LOTS_STORAGE_KEY) {
        setIssuedPrintedLots(loadIssuedPrintedLots());
      } else if (ev.key === PRINT_PREFIX_REGISTRY_STORAGE_KEY) {
        setPrefixRegistryRaw(loadPrefixRegistryState());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const masterDict = useMemo(
    () => buildWarehouseMasterDictionary(rawTobaccos, packagingList),
    [rawTobaccos, packagingList]
  );

  const lotBatchNumbers = useMemo(
    () =>
      generateNextLotBatchNumbers(
        rawTobaccos,
        Math.max(1, Math.min(60, printCount)),
        customLotPrefix,
        issuedPrintedLots
      ),
    [rawTobaccos, printCount, customLotPrefix, issuedPrintedLots]
  );

  const a4Pages = useMemo(() => {
    const pages: string[][] = [];
    for (let i = 0; i < lotBatchNumbers.length; i += cardsPerA4Page) {
      pages.push(lotBatchNumbers.slice(i, i + cardsPerA4Page));
    }
    return pages;
  }, [lotBatchNumbers, cardsPerA4Page]);

  const totalA4SheetPages =
    duplexMode === 'OFF' ? a4Pages.length : a4Pages.length * 2;

  const handleSelectSavedPrefix = (prefix: string) => {
    const next = selectActivePrefix(prefixRegistry, prefix);
    persistPrefixRegistry(next);
  };

  const handleRegisterNewPrefixSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = normalizePrefixInput(newPrefixDraft);
    if (!cleaned) {
      onShowToast?.('Masukkan kode prefix huruf/angka (contoh: MTL atau TMG-).');
      return;
    }
    const { nextState, normalizedPrefix } = registerNewPrefix(prefixRegistry, cleaned);
    persistPrefixRegistry(nextState);
    setNewPrefixDraft('');
    setIsAddingPrefix(false);
    if (normalizedPrefix) {
      onShowToast?.(
        `Prefix "${normalizedPrefix}" terdaftar & otomatis dipilih untuk cetak berikutnya!`
      );
    }
  };

  const handleRemoveSavedPrefix = (prefix: string) => {
    const next = removeRegisteredPrefix(prefixRegistry, prefix);
    persistPrefixRegistry(next);
    onShowToast?.(`Prefix "${prefix}" dihapus dari daftar tersimpan.`);
  };

  const markBatchAsPrintedOnce = (printedLots: string[]) => {
    if (!printedLots.length) return;
    setIssuedPrintedLots((prev) => {
      const merged = Array.from(
        new Set([...prev, ...printedLots.map((l) => l.trim().toUpperCase())])
      );
      try {
        localStorage.setItem(ISSUED_PRINT_LOTS_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // Ignore quota edge case
      }
      return merged;
    });
    const nextPrefixReg = recordPrintedBatchToPrefixRegistry(
      prefixRegistry,
      printedLots,
      customLotPrefix
    );
    persistPrefixRegistry(nextPrefixReg);
  };

  const handleSystemPrintOnce = () => {
    if (isPrintLocked || isBluetoothPrinting || lotBatchNumbers.length === 0) return;
    const batchSnapshot = [...lotBatchNumbers];
    setIsPrintLocked(true);

    let settled = false;
    const finalizeLock = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('afterprint', finalizeLock);
      markBatchAsPrintedOnce(batchSnapshot);
      setIsPrintLocked(false);
      onShowToast?.(
        `Seri ${batchSnapshot[0]} s/d ${batchSnapshot[batchSnapshot.length - 1]} terkunci (1× cetak). Nomor berikutnya siap!`
      );
    };

    window.addEventListener('afterprint', finalizeLock, { once: true });
    try {
      window.print();
    } finally {
      // Fallback in browsers where window.print() does not block or fire afterprint
      window.setTimeout(finalizeLock, 650);
    }
  };

  const handlePrintBluetoothThermal = async () => {
    if (isPrintLocked || isBluetoothPrinting || lotBatchNumbers.length === 0) return;
    const profileKey: 'THERMAL_58' | 'THERMAL_80' =
      paperFormat === 'THERMAL_58' ? 'THERMAL_58' : 'THERMAL_80';
    const profile = THERMAL_PROFILES[profileKey];
    const batchSnapshot = [...lotBatchNumbers];
    setIsBluetoothPrinting(true);
    setIsPrintLocked(true);
    let printedOk = 0;
    try {
      for (const lotNumber of batchSnapshot) {
        const canvas = renderThermalCardToCanvas({
          lotNumber,
          packagingChoices: masterDict.packagings,
          widthDots: profile.widthDots,
          includeBackBarcode: includeThermalBarcode,
          customPrefix: customLotPrefix,
        });
        await printCanvasViaWebBluetooth(canvas);
        markBatchAsPrintedOnce([lotNumber]);
        printedOk++;
      }
      onShowToast?.(
        `Berhasil mencetak & mengunci ${printedOk} seri ke printer Bluetooth ${profile.rollWidthMm}mm.`
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mencetak via Bluetooth. Gunakan Cetak Thermal (Driver / PDF).';
      onShowToast?.(msg);
    } finally {
      setIsBluetoothPrinting(false);
      setIsPrintLocked(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const stopCamera = () => {
    if (barcodeTimerRef.current !== null) {
      window.clearInterval(barcodeTimerRef.current);
      barcodeTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'scan') {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const findExistingStockByCode = (rawCode: string): RawTobacco | undefined => {
    const cleanCode = normalizeLotNumber(rawCode);
    if (!cleanCode) return undefined;
    return (
      rawTobaccos.find((t) => normalizeLotNumber(t.lotNumber) === cleanCode) ||
      rawTobaccos.find((t) => normalizeLotNumber(t.id) === cleanCode)
    );
  };

  const handleBarcodeLotResolved = (rawCode: string): boolean => {
    const cleanCode = normalizeLotNumber(rawCode);
    if (!cleanCode) {
      setScanError('Masukkan atau arahkan barcode Kode Lot terlebih dahulu.');
      return false;
    }

    const found = findExistingStockByCode(cleanCode);
    if (!found) {
      stopCamera();
      setScanError(
        `Barcode "${cleanCode}" terbaca oleh kamera, tetapi belum terdaftar di gudang. Scan kartu depan lewat "1. Kamera Stok Baru" untuk mendaftarkannya pertama kali.`
      );
      return false;
    }

    stopCamera();
    setScanError(null);
    setCameraError(null);
    setScanQualityWarning('');
    setScanModelUsed('Barcode Scanner');
    setReviewedCards([buildEditableReviewCardFromExistingStock(found)]);
    onShowToast?.(`Barcode ${found.lotNumber || cleanCode} terbaca! Siap update & edit info.`);
    return true;
  };

  // Native BarcodeDetector + Universal Pure-TS Code 39 Pixel Decoder loop (works on Chrome, Android, iOS Safari, Firefox)
  useEffect(() => {
    if (!cameraActive || cameraPurpose !== 'BARCODE_UPDATE') {
      if (barcodeTimerRef.current !== null) {
        window.clearInterval(barcodeTimerRef.current);
        barcodeTimerRef.current = null;
      }
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
    let detector: any = null;
    if (typeof BarcodeDetectorCtor === 'function') {
      try {
        detector = new BarcodeDetectorCtor({
          formats: ['code_39', 'code_128', 'qr_code'],
        });
      } catch {
        detector = null;
      }
    }

    if (!barcodeScratchCanvasRef.current && typeof document !== 'undefined') {
      barcodeScratchCanvasRef.current = document.createElement('canvas');
    }

    let busy = false;
    barcodeTimerRef.current = window.setInterval(async () => {
      if (busy || !videoRef.current || videoRef.current.readyState < 2) return;
      busy = true;
      try {
        // 1. Try hardware-accelerated browser BarcodeDetector when available
        if (detector) {
          const codes = await detector.detect(videoRef.current);
          if (Array.isArray(codes) && codes.length > 0 && codes[0]?.rawValue) {
            handleBarcodeLotResolved(String(codes[0].rawValue));
            return;
          }
        }
        // 2. Universal pure-TS ISO Code 39 pixel decoder fallback (iOS Safari / Firefox / webcam)
        const localHits = decodeCode39FromVideoElement(
          videoRef.current,
          barcodeScratchCanvasRef.current
        );
        if (localHits.length > 0) {
          handleBarcodeLotResolved(localHits[0]);
        }
      } catch {
        // Ignore single-frame decode errors
      } finally {
        busy = false;
      }
    }, 260);

    return () => {
      if (barcodeTimerRef.current !== null) {
        window.clearInterval(barcodeTimerRef.current);
        barcodeTimerRef.current = null;
      }
    };
  }, [cameraActive, cameraPurpose, rawTobaccos]);

  const startCamera = async (purpose: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK') => {
    setCameraPurpose(purpose);
    setCameraError(null);
    setScanError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        purpose === 'BARCODE_UPDATE'
          ? 'Kamera live tidak tersedia di browser ini. Ketik / tembak scanner USB Kode Lot di kotak bawah, atau pakai Foto Kamera HP / Galeri.'
          : 'Browser tidak mendukung kamera langsung. Gunakan Upload Foto / Kamera HP di bawah.'
      );
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        setTorchSupported(Boolean(caps?.torch));
      }
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Kamera gagal dibuka (${err.message}). Gunakan scanner USB/ketik Lot di bawah atau Upload Foto.`
          : 'Kamera gagal dibuka. Gunakan scanner USB/ketik Lot di bawah atau Upload Foto.'
      );
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch {
      onShowToast?.('Lampu senter/flash tidak didukung oleh browser perangkat ini.');
    }
  };

  const runAiVisionScan = async (
    imageData: {
      dataUrl: string;
      base64: string;
      mimeType: string;
      localBarcodes?: string[];
    },
    purpose: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK'
  ) => {
    setCapturedPreviewUrl(imageData.dataUrl);
    setScanError(null);
    setScanQualityWarning('');
    stopCamera();

    // Fast-path: if Mode 2 (Barcode Update) decoded 1D Code 39 locally on canvas and it matches gudang, resolve immediately!
    const localHits = Array.isArray(imageData.localBarcodes) ? imageData.localBarcodes : [];
    if (purpose === 'BARCODE_UPDATE' && localHits.length > 0) {
      const matchedLocal: ReviewedScannedGradeCard[] = [];
      const seenIds = new Set<string>();
      for (const code of localHits) {
        const existing = findExistingStockByCode(code);
        if (existing && !seenIds.has(existing.id)) {
          seenIds.add(existing.id);
          matchedLocal.push(buildEditableReviewCardFromExistingStock(existing));
        }
      }
      if (matchedLocal.length > 0) {
        setScanModelUsed('Code 39 Barcode Decoder');
        setReviewedCards(matchedLocal);
        onShowToast?.(
          `Barcode ${matchedLocal.map((m) => m.lotNumber).join(', ')} terbaca instan! Siap update & edit info.`
        );
        return;
      }
    }

    setIsScanningAI(true);

    try {
      const response = await fetch('/api/scan-grade-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          scanMode: purpose,
          masterContext: {
            sellers: masterDict.sellers,
            origins: masterDict.origins,
            packagings: masterDict.packagings,
            tobaccoNames: masterDict.tobaccoNames,
            existingLotNumbers: rawTobaccos.map((t) => t.lotNumber).filter(Boolean).slice(0, 120),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Server error (${response.status})`);
      }

      const rawCards: ScannedGradeCardRawInput[] = Array.isArray(payload.cards)
        ? payload.cards
        : [];
      setScanQualityWarning(String(payload.imageQualityWarning || ''));
      setScanModelUsed(String(payload.modelUsed || ''));

      if (rawCards.length === 0) {
        if (purpose === 'BARCODE_UPDATE' && localHits.length > 0) {
          setReviewedCards([]);
          setScanError(
            `Barcode "${localHits.join(', ')}" terbaca oleh kamera, tetapi belum ada di stok gudang. Scan kartu depan lewat "1. Kamera Stok Baru" untuk mendaftarkannya pertama kali.`
          );
          return;
        }
        setReviewedCards([]);
        setScanError(
          payload.imageQualityWarning ||
            'Tidak ada Kartu Grade atau Barcode yang terbaca jelas pada foto ini. Pastikan tulisan/barcode jelas & cahaya cukup.'
        );
        return;
      }

      if (purpose === 'BARCODE_UPDATE') {
        const matchedLots: ReviewedScannedGradeCard[] = [];
        const unmatchedDetectedLots: string[] = [];
        const seenIds = new Set<string>();
        for (const rc of rawCards) {
          const cleanLot = normalizeLotNumber(rc.lotNumber);
          if (!cleanLot) continue;
          const existing = findExistingStockByCode(cleanLot);
          if (existing) {
            if (!seenIds.has(existing.id)) {
              seenIds.add(existing.id);
              const baseEdit = buildEditableReviewCardFromExistingStock(existing);
              const gVal = Number(rc.grossWeightKg) || 0;
              const pVal = Number(rc.pricePerKgPurchase) || 0;
              matchedLots.push({
                ...baseEdit,
                grossWeightKg: gVal > 0 ? gVal : baseEdit.grossWeightKg,
                pricePerKgPurchase: pVal > 0 ? pVal : baseEdit.pricePerKgPurchase,
              });
            }
          } else {
            unmatchedDetectedLots.push(cleanLot);
          }
        }
        if (matchedLots.length > 0) {
          setReviewedCards(matchedLots);
          return;
        }
        const detectedSummary = Array.from(
          new Set([...localHits, ...unmatchedDetectedLots])
        ).join(', ');
        setReviewedCards([]);
        setScanError(
          detectedSummary
            ? `Barcode "${detectedSummary}" terbaca jelas oleh kamera, tetapi belum ada di stok gudang. Gunakan "1. Kamera Stok Baru" jika ingin mendaftarkannya pertama kali.`
            : 'Barcode tidak terbaca jelas pada foto ini. Dekatkan kamera ke area garis barcode.'
        );
        return;
      }

      const classified = classifyScannedCardsForReview({
        scannedCards: rawCards,
        rawTobaccos,
        packagingList,
      });
      setReviewedCards(classified);
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke Scanner AI. Periksa koneksi internet Anda.'
      );
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleCaptureFromLiveVideo = async () => {
    if (!videoRef.current) return;
    try {
      const compressed = await compressImageFileToJpegBase64(videoRef.current);
      await runAiVisionScan(compressed, cameraPurpose);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Gagal mengambil gambar kamera.');
    }
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    purposeOverride: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFileToJpegBase64(file);
      await runAiVisionScan(compressed, purposeOverride);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Gagal memproses file foto.');
    }
  };

  const updateReviewedCard = (
    reviewId: string,
    patch: Partial<ReviewedScannedGradeCard>
  ) => {
    setReviewedCards((prev) =>
      prev.map((c) => {
        if (c.reviewId !== reviewId) return c;
        const updated = { ...c, ...patch };
        // Clear uncertain highlight on fields the user explicitly edited
        const editedKeys = Object.keys(patch);
        const remainingUncertain = updated.uncertainFields.filter(
          (f) => !editedKeys.includes(f)
        );
        return {
          ...updated,
          uncertainFields: remainingUncertain,
        };
      })
    );
  };

  const removeReviewedCard = (reviewId: string) => {
    setReviewedCards((prev) => prev.filter((c) => c.reviewId !== reviewId));
  };

  const resetForNextPhoto = () => {
    setCapturedPreviewUrl(null);
    setReviewedCards([]);
    setScanError(null);
    setScanQualityWarning('');
  };

  const selectedToSaveCount = reviewedCards.filter((c) => c.selectedForSave).length;
  const stage2Count = reviewedCards.filter(
    (c) => c.selectedForSave && c.matchStatus === 'UPDATE_MENYUSUL'
  ).length;
  const duplicateBlockedCount = reviewedCards.filter(
    (c) => c.matchStatus === 'DUPLICATE_COMPLETE' || c.matchStatus === 'BATCH_DUPLICATE'
  ).length;

  const handleConfirmCommit = () => {
    const chosen = reviewedCards.filter((c) => c.selectedForSave);
    if (chosen.length === 0) {
      onShowToast?.('Centang minimal 1 kartu untuk disimpan ke gudang.');
      return;
    }
    onCommitReviewedCards(chosen);
    resetForNextPhoto();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[92vh] bg-[#070709] border border-zinc-800 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-white"
          >
            {/* Header + 2-Tab Switch */}
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-800 bg-black/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                    Kartu Grade Cetak &amp; Scanner AI
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('scan')}
                    className={`h-8 px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      activeTab === 'scan'
                        ? 'bg-amber-500 text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan &amp; Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('print')}
                    className={`h-8 px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                      activeTab === 'print'
                        ? 'bg-amber-500 text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak (A4 / Thermal)</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup Scanner Kartu Grade"
                  className="h-9 w-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* TAB 1: SCAN & REVIEW CEPAT */}
              {activeTab === 'scan' && (
                <>
                  {/* Hidden file inputs for native mobile camera, barcode update photo, & gallery */}
                  <input
                    ref={nativeCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileSelected(e, cameraPurpose)}
                    className="hidden"
                  />
                  <input
                    ref={barcodePhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelected(e, 'BARCODE_UPDATE')}
                    className="hidden"
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelected(e, 'NEW_STOCK')}
                    className="hidden"
                  />

                  {/* Capture Section (shown when no reviewed cards yet) */}
                  {reviewedCards.length === 0 && (
                    <div className="space-y-4">
                      {/* Live Camera Frame OR Capture Options */}
                      {cameraActive ? (
                        <div
                          className={`relative rounded-2xl overflow-hidden border-2 bg-black ${
                            cameraPurpose === 'BARCODE_UPDATE'
                              ? 'border-emerald-500/80'
                              : 'border-amber-500/70'
                          }`}
                        >
                          <video
                            ref={videoRef}
                            playsInline
                            muted
                            autoPlay
                            className="w-full max-h-[54vh] object-cover bg-black"
                          />

                          {/* Purpose-Specific Warehouse Framing Overlay */}
                          {cameraPurpose === 'BARCODE_UPDATE' ? (
                            <div className="pointer-events-none absolute inset-x-8 sm:inset-x-16 top-1/2 -translate-y-1/2 h-32 border-2 border-emerald-400/70 rounded-xl bg-emerald-500/5">
                              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[2px] bg-red-500/85 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-black/85 border border-emerald-500/60 text-[10px] font-extrabold text-emerald-300 whitespace-nowrap">
                                Arahkan ke Barcode Belakang Kartu (Auto-Deteksi Lot)
                              </div>
                            </div>
                          ) : (
                            <div className="pointer-events-none absolute inset-5 sm:inset-8 border border-amber-400/30 rounded-xl">
                              <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-[3px] border-l-[3px] border-amber-400 rounded-tl-md" />
                              <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-[3px] border-r-[3px] border-amber-400 rounded-tr-md" />
                              <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-[3px] border-l-[3px] border-amber-400 rounded-bl-md" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-[3px] border-r-[3px] border-amber-400 rounded-br-md" />
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/75 border border-amber-500/50 text-[10px] font-extrabold text-amber-300 whitespace-nowrap">
                                Jajarkan 1 s/d 4 Kartu Stok Baru di Dalam Bingkai
                              </div>
                            </div>
                          )}

                          {/* Camera HUD Controls */}
                          <div className="p-3 bg-black/95 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={toggleTorch}
                                className={`h-10 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                                  torchOn
                                    ? 'bg-amber-500 text-black border-amber-400'
                                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                                }`}
                                title={
                                  torchSupported
                                    ? 'Nyalakan/matikan lampu senter kamera'
                                    : 'Coba nyalakan senter kamera'
                                }
                              >
                                {torchOn ? (
                                  <Zap className="w-4 h-4 fill-current" />
                                ) : (
                                  <ZapOff className="w-4 h-4" />
                                )}
                                <span>{torchOn ? 'Senter ON' : 'Senter'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => nativeCameraInputRef.current?.click()}
                                className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Kamera Bawaan</span>
                              </button>

                              <button
                                type="button"
                                onClick={stopCamera}
                                className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-bold cursor-pointer"
                              >
                                Tutup Kamera
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={handleCaptureFromLiveVideo}
                              className={`h-11 px-5 rounded-xl font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-lg ${
                                cameraPurpose === 'BARCODE_UPDATE'
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                                  : 'bg-amber-500 hover:bg-amber-400 text-black'
                              }`}
                            >
                              {cameraPurpose === 'BARCODE_UPDATE' ? (
                                <ScanBarcode className="w-4 h-4" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                              <span>
                                {cameraPurpose === 'BARCODE_UPDATE'
                                  ? 'Jepret & Baca Barcode (AI)'
                                  : 'Jepret & Input Stok Baru'}
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* OPTION 1: Camera Mode 1 — Input Stok Baru */}
                            <button
                              type="button"
                              onClick={() => startCamera('NEW_STOCK')}
                              disabled={isScanningAI}
                              className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-amber-500/60 hover:border-amber-400 text-left space-y-2 transition-all cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                                <Camera className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black text-white">
                                1. Kamera Stok Baru (Kartu Grade)
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Foto kartu depan (Silang X &amp; tulis tangan) + Senter gudang untuk upload stok baru.
                              </p>
                            </button>

                            {/* OPTION 2: Camera Mode 2 — Barcode Scanner for Update & Edit Info */}
                            <button
                              type="button"
                              onClick={() => startCamera('BARCODE_UPDATE')}
                              disabled={isScanningAI}
                              className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-emerald-500/55 hover:border-emerald-400 text-left space-y-2 transition-all cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                                <ScanBarcode className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black text-white">
                                2. Scan Barcode (Update / Edit Info)
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Scan barcode besar di belakang kartu untuk update timbangan, harga, &amp; edit info stok lama.
                              </p>
                            </button>

                            {/* OPTION 3: Gallery Upload */}
                            <button
                              type="button"
                              onClick={() => galleryInputRef.current?.click()}
                              disabled={isScanningAI}
                              className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-left space-y-2 transition-all cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-200 group-hover:scale-105 transition-transform">
                                <Upload className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black text-white">
                                3. Upload Foto dari Galeri
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Pilih foto dari HP/WhatsApp (bisa berisi 1 atau banyak kartu berjejer).
                              </p>
                            </button>
                          </div>

                          {/* Instant USB Barcode Gun / Upload Foto Barcode / Manual Lot Code Quick Update Bar */}
                          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleBarcodeLotResolved(barcodeManualQuery);
                              }}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-400 shrink-0">
                                <ScanBarcode className="w-4 h-4" />
                                <span>Scanner USB / Input Cepat Kode Lot:</span>
                              </div>
                              <input
                                type="text"
                                value={barcodeManualQuery}
                                onChange={(e) => setBarcodeManualQuery(e.target.value)}
                                placeholder="Tembak barcode USB atau ketik Kode Lot (mis. MTL001 / LOT-261115-701)..."
                                className="flex-1 min-w-[200px] h-9 px-3 rounded-xl bg-black border border-zinc-800 text-xs font-mono text-white focus:outline-hidden focus:border-emerald-500"
                              />
                              <button
                                type="submit"
                                className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <Search className="w-3.5 h-3.5" />
                                <span>Cari &amp; Edit Stok</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => barcodePhotoInputRef.current?.click()}
                                disabled={isScanningAI}
                                className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/45 text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Scan Foto Barcode</span>
                              </button>
                            </form>
                          </div>
                        </div>
                      )}

                      {cameraError && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{cameraError}</span>
                        </div>
                      )}

                      {/* Scanning Progress Indicator */}
                      {isScanningAI && (
                        <div className="p-5 rounded-2xl bg-zinc-950 border border-amber-500/60 flex flex-col sm:flex-row items-center gap-4">
                          {capturedPreviewUrl && (
                            <img
                              src={capturedPreviewUrl}
                              alt="Preview Foto Kartu Grade"
                              className="w-28 h-20 object-cover rounded-xl border border-zinc-700 shrink-0"
                            />
                          )}
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-6 h-6 text-amber-400 animate-spin shrink-0" />
                            <div>
                              <div className="text-sm font-black text-white">
                                Membaca Tulisan Tangan &amp; Kotak Silang (X)...
                              </div>
                              <p className="text-xs text-zinc-400">
                                Mencocokkan Kode Lot, Kamus Master Penjual/Daerah, dan cek anti-dobel.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {scanError && !isScanningAI && (
                        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/70 text-xs text-red-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <span>{scanError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={resetForNextPhoto}
                            className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                          >
                            Coba Foto Ulang
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* REVIEW CEPAT SEBELUM MASUK GUDANG */}
                  {reviewedCards.length > 0 && (
                    <div className="space-y-4">
                      {/* Datalists for fast Kamus Master editing */}
                      <datalist id="scanner-master-sellers">
                        {masterDict.sellers.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                      <datalist id="scanner-master-origins">
                        {masterDict.origins.map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                      <datalist id="scanner-master-names">
                        {masterDict.tobaccoNames.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>

                      {/* Review Summary Banner */}
                      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {capturedPreviewUrl && (
                            <img
                              src={capturedPreviewUrl}
                              alt="Foto Kartu Discan"
                              className="w-16 h-12 object-cover rounded-lg border border-zinc-700 shrink-0"
                            />
                          )}
                          <div>
                            <div className="text-sm font-black text-white flex items-center gap-2">
                              <FileCheck2 className="w-4 h-4 text-amber-400" />
                              <span>
                                Review Cepat: {reviewedCards.length} Kartu Terdeteksi
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {selectedToSaveCount} dipilih untuk masuk gudang
                              {stage2Count > 0 ? ` (${stage2Count} Update Tahap 2 Menyusul)` : ''}
                              {duplicateBlockedCount > 0
                                ? ` • ${duplicateBlockedCount} ditandai Dobel (otomatis dilewati)`
                                : ''}
                              {scanModelUsed ? ` • Vision: ${scanModelUsed}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={resetForNextPhoto}
                          className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Foto Ulang / Scan Lain</span>
                        </button>
                      </div>

                      {scanQualityWarning && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/50 text-xs text-amber-200 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{scanQualityWarning}</span>
                        </div>
                      )}

                      {/* Cards List */}
                      <div className="space-y-3">
                        {reviewedCards.map((card, index) => {
                          const isDuplicate =
                            card.matchStatus === 'DUPLICATE_COMPLETE' ||
                            card.matchStatus === 'BATCH_DUPLICATE';
                          const isStage2 = card.matchStatus === 'UPDATE_MENYUSUL';
                          const isUncertain = (fieldName: string) =>
                            card.uncertainFields.includes(fieldName);

                          return (
                            <div
                              key={card.reviewId}
                              className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-colors ${
                                isDuplicate
                                  ? 'bg-red-950/20 border-red-500/60'
                                  : isStage2
                                  ? 'bg-amber-950/15 border-amber-500/70'
                                  : 'bg-zinc-950/90 border-zinc-800'
                              }`}
                            >
                              {/* Top Row: Checkbox + Match Badge + Confidence + Remove */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={card.selectedForSave}
                                      onChange={(e) =>
                                        updateReviewedCard(card.reviewId, {
                                          selectedForSave: e.target.checked,
                                        })
                                      }
                                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-black text-white">
                                      Kartu #{index + 1}
                                    </span>
                                  </label>

                                  {card.matchStatus === 'NEW_STOCK' && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 text-[10px] font-black uppercase">
                                      Stok Baru
                                    </span>
                                  )}
                                  {isStage2 && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-black uppercase">
                                      Tahap 2: Update Menyusul ({card.matchedExistingLot || card.lotNumber})
                                    </span>
                                  )}
                                  {card.matchStatus === 'DUPLICATE_COMPLETE' && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500 text-red-300 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3" />
                                      Anti-Dobel: Lot Sudah Lengkap
                                    </span>
                                  )}
                                  {card.matchStatus === 'BATCH_DUPLICATE' && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500 text-red-300 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3" />
                                      Dobel dalam 1 Foto
                                    </span>
                                  )}

                                  <span
                                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                                      card.confidenceScore >= 85
                                        ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                        : 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                                    }`}
                                  >
                                    Akurasi {card.confidenceScore}%
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeReviewedCard(card.reviewId)}
                                  aria-label={`Hapus Kartu ${index + 1}`}
                                  className="h-7 px-2 rounded-lg bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-zinc-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Buang</span>
                                </button>
                              </div>

                              {/* Duplicate Alert OR Stage 2 Diff Info */}
                              {isDuplicate && (
                                <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-[11px] text-red-200">
                                  Lot <strong>{card.lotNumber}</strong> sudah tercatat lengkap di gudang
                                  {card.matchedExistingName ? ` ("${card.matchedExistingName}")` : ''}.
                                  Otomatis tidak dicentang agar tidak terjadi double input.
                                </div>
                              )}

                              {isStage2 && card.updateDiffSummary.length > 0 && (
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 flex flex-wrap items-center gap-2">
                                  <span className="font-black text-amber-300">
                                    Akan digabung ke &ldquo;{card.matchedExistingName}&rdquo;:
                                  </span>
                                  {card.updateDiffSummary.map((d, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded bg-black/60 border border-amber-500/40 font-semibold"
                                    >
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Uncertain Fields & Kamus Master Auto-Corrections */}
                              {(card.uncertainFields.length > 0 ||
                                card.autoCorrections.length > 0) && (
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                  {card.uncertainFields.length > 0 && (
                                    <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400 text-amber-200 font-bold inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span>
                                        Tulisan Ragu (Wajib Cek):{' '}
                                        {card.uncertainFields
                                          .map((f) => UNCERTAIN_FIELD_LABELS[f] || f)
                                          .join(', ')}
                                      </span>
                                    </span>
                                  )}
                                  {card.autoCorrections.map((ac, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 font-semibold"
                                    >
                                      Kamus {ac.field}: &ldquo;{ac.from}&rdquo; → &ldquo;{ac.to}&rdquo;
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Editable Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Kode Lot{' '}
                                    {isUncertain('lotNumber') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    value={card.lotNumber}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        lotNumber: e.target.value.toUpperCase(),
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('lotNumber')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Nama Tembakau{' '}
                                    {isUncertain('name') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-names"
                                    value={card.name}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, { name: e.target.value })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('name')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Penjual{' '}
                                    {isUncertain('sellerName') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-sellers"
                                    value={card.sellerName}
                                    placeholder="Opsional"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        sellerName: e.target.value,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('sellerName')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Daerah Asal{' '}
                                    {isUncertain('origin') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-origins"
                                    value={card.origin}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, { origin: e.target.value })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('origin')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Grade{' '}
                                    {isUncertain('colorGrade') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <select
                                    value={card.colorGrade}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        colorGrade: e.target.value as TobaccoGrade,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-black text-amber-300 border focus:outline-hidden ${
                                      isUncertain('colorGrade')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  >
                                    {TOBACCO_GRADE_ORDER.map((gr) => (
                                      <option key={gr} value={gr}>
                                        Grade {gr}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Kemasan{' '}
                                    {isUncertain('packagingType') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <select
                                    value={card.packagingType}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        packagingType: e.target.value,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('packagingType')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  >
                                    {masterDict.packagings.map((pk) => (
                                      <option key={pk} value={pk}>
                                        {pk}
                                      </option>
                                    ))}
                                    {!masterDict.packagings.includes(card.packagingType) && (
                                      <option value={card.packagingType}>
                                        {card.packagingType}
                                      </option>
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Bruto (kg){' '}
                                    {isUncertain('grossWeightKg') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step={0.1}
                                    value={card.grossWeightKg || ''}
                                    placeholder="0 (Menyusul)"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        grossWeightKg: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('grossWeightKg')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Harga Beli / kg{' '}
                                    {isUncertain('pricePerKgPurchase') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={1000}
                                    value={card.pricePerKgPurchase || ''}
                                    placeholder="0 (Menyusul)"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        pricePerKgPurchase: Math.max(
                                          0,
                                          Math.round(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('pricePerKgPurchase')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                  {card.pricePerKgPurchase > 0 && (
                                    <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                      {formatRupiah(card.pricePerKgPurchase)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Whole-Number Attribute Tap Selectors (0-5 NO DECIMAL) */}
                              <div className="pt-2 border-t border-zinc-800/80">
                                <div className="text-[10px] font-extrabold uppercase text-zinc-400 mb-1.5">
                                  Atribut Karakter (Skala Bulat 0–5)
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                  {ATTRIBUTE_FIELDS.map((attr) => {
                                    const currentVal = card[attr.key];
                                    const fieldUncertain = isUncertain(attr.key);
                                    return (
                                      <div
                                        key={attr.key}
                                        className={`p-2 rounded-xl border ${
                                          fieldUncertain
                                            ? 'bg-amber-500/10 border-amber-400'
                                            : 'bg-black border-zinc-800'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-[10px] font-black mb-1">
                                          <span className="text-zinc-300">{attr.label}</span>
                                          <span className="text-amber-400 font-mono">
                                            {formatRating5(currentVal)}/5
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-6 gap-1">
                                          {[0, 1, 2, 3, 4, 5].map((digit) => (
                                            <button
                                              key={digit}
                                              type="button"
                                              onClick={() =>
                                                updateReviewedCard(card.reviewId, {
                                                  [attr.key]: digit,
                                                  attributesConfirmed: true,
                                                } as Partial<ReviewedScannedGradeCard>)
                                              }
                                              className={`h-6 rounded-md font-mono text-[11px] font-black cursor-pointer transition-colors ${
                                                currentVal === digit
                                                  ? 'bg-amber-500 text-black'
                                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                                              }`}
                                            >
                                              {digit}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: CETAK KARTU GRADE (A4 & THERMAL 58mm / 80mm) */}
              {activeTab === 'print' && (
                <div className="space-y-4">
                  {/* Configuration Controls */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                      <div className="lg:col-span-3">
                        <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                          Jumlah Kartu Dicetak
                        </label>
                        <div className="flex items-center gap-1.5">
                          {[4, 8, 12, 24].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setPrintCount(preset)}
                              className={`h-9 flex-1 rounded-xl font-mono text-xs font-black border cursor-pointer ${
                                printCount === preset
                                  ? 'bg-amber-500 text-black border-amber-400'
                                  : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="lg:col-span-5">
                        <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                          Format Kertas &amp; Printer (Silang X Ready)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPaperFormat('A4_4')}
                            className={`h-9 px-2 rounded-xl text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 ${
                              paperFormat === 'A4_4'
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5 shrink-0" />
                            <span>4 / A4</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperFormat('A4_6')}
                            className={`h-9 px-2 rounded-xl text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 ${
                              paperFormat === 'A4_6'
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5 shrink-0" />
                            <span>6 / A4</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperFormat('THERMAL_58')}
                            className={`h-9 px-2 rounded-xl text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 ${
                              paperFormat === 'THERMAL_58'
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            <Printer className="w-3.5 h-3.5 shrink-0" />
                            <span>58mm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperFormat('THERMAL_80')}
                            className={`h-9 px-2 rounded-xl text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 ${
                              paperFormat === 'THERMAL_80'
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            <Printer className="w-3.5 h-3.5 shrink-0" />
                            <span>80mm</span>
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label
                            htmlFor="print-prefix-select"
                            className="text-[10px] font-extrabold uppercase text-zinc-400 inline-flex items-center gap-1"
                          >
                            <BookmarkCheck className="w-3 h-3 text-amber-400" />
                            <span>Prefix Terdaftar (Auto-Pilih Terakhir)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsAddingPrefix((v) => !v)}
                            className="text-[10px] font-black text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isAddingPrefix ? 'Batal' : 'Daftar Prefix Baru'}</span>
                          </button>
                        </div>
                        <select
                          id="print-prefix-select"
                          value={customLotPrefix}
                          onChange={(e) => handleSelectSavedPrefix(e.target.value)}
                          className="w-full h-9 px-3 rounded-xl bg-black border border-zinc-800 text-xs font-mono font-bold text-amber-300 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                        >
                          <option value="">
                            Otomatis Harian ({generateNextLotBatchNumbers(rawTobaccos, 1, '', issuedPrintedLots)[0]?.replace(/\d+$/, '') || 'LOT-...'})
                          </option>
                          {prefixRegistry.registeredPrefixes.map((pref) => (
                            <option key={pref} value={pref}>
                              {pref} (Contoh: {pref}001)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Registered Prefix Chips + Inline New Prefix Registration */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase text-zinc-500 mr-1">
                          Prefix Tersimpan:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectSavedPrefix('')}
                          className={`h-7 px-2.5 rounded-lg font-mono text-[11px] font-extrabold border cursor-pointer transition-colors ${
                            customLotPrefix === ''
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          Otomatis Harian
                        </button>
                        {prefixRegistry.registeredPrefixes.map((pref) => {
                          const active = customLotPrefix === pref;
                          return (
                            <div
                              key={pref}
                              className={`inline-flex items-center rounded-lg border overflow-hidden ${
                                active
                                  ? 'bg-amber-500 text-black border-amber-400'
                                  : 'bg-black text-zinc-200 border-zinc-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectSavedPrefix(pref)}
                                className="h-7 px-2.5 font-mono text-[11px] font-black cursor-pointer"
                              >
                                {pref}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSavedPrefix(pref)}
                                aria-label={`Hapus prefix ${pref}`}
                                title={`Hapus prefix ${pref}`}
                                className={`h-7 px-1.5 flex items-center justify-center cursor-pointer transition-colors ${
                                  active
                                    ? 'hover:bg-black/15 text-black/80'
                                    : 'hover:bg-red-950/60 text-zinc-500 hover:text-red-300 border-l border-zinc-800'
                                }`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                        {!isAddingPrefix && (
                          <button
                            type="button"
                            onClick={() => setIsAddingPrefix(true)}
                            className="h-7 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-dashed border-amber-500/60 text-amber-300 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Prefix Baru</span>
                          </button>
                        )}
                      </div>

                      {isAddingPrefix && (
                        <form
                          onSubmit={handleRegisterNewPrefixSubmit}
                          className="flex items-center gap-1.5 w-full sm:w-auto"
                        >
                          <input
                            type="text"
                            value={newPrefixDraft}
                            onChange={(e) => setNewPrefixDraft(e.target.value.toUpperCase())}
                            placeholder="Mis. MTL atau TMG-"
                            autoFocus
                            className="h-8 w-40 px-2.5 rounded-lg bg-black border border-amber-500/70 text-xs font-mono font-bold text-white focus:outline-hidden focus:border-amber-400"
                          />
                          <button
                            type="submit"
                            className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] cursor-pointer"
                          >
                            Simpan Prefix
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                      {/* Duplex (2-Sided Back Barcode) OR Thermal Companion Barcode Control */}
                      {isThermalMode ? (
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={includeThermalBarcode}
                            onChange={(e) => setIncludeThermalBarcode(e.target.checked)}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span>
                            Sertakan Barcode Besar &amp; Prefix (Lipat / Tempel Belakang)
                          </span>
                        </label>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase text-zinc-400">
                            Cetak 2 Sisi (Belakang = Barcode Besar + Prefix):
                          </span>
                          <div className="inline-flex p-0.5 rounded-xl bg-black border border-zinc-800">
                            <button
                              type="button"
                              onClick={() => setDuplexMode('OFF')}
                              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                                duplexMode === 'OFF'
                                  ? 'bg-zinc-700 text-white'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              1 Sisi
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplexMode('LONG_EDGE')}
                              className={`h-7 px-2.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                                duplexMode === 'LONG_EDGE'
                                  ? 'bg-amber-500 text-black'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              2 Sisi • Long Edge
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplexMode('SHORT_EDGE')}
                              className={`h-7 px-2.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                                duplexMode === 'SHORT_EDGE'
                                  ? 'bg-amber-500 text-black'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              2 Sisi • Short Edge
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {isThermalMode && (
                          <button
                            type="button"
                            onClick={handlePrintBluetoothThermal}
                            disabled={isBluetoothPrinting || isPrintLocked}
                            className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-amber-500/60 text-amber-300 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {isBluetoothPrinting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Bluetooth className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isBluetoothPrinting
                                ? 'Mengirim ESC/POS...'
                                : 'Bluetooth ESC/POS (1×)'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleSystemPrintOnce}
                          disabled={isPrintLocked || isBluetoothPrinting}
                          className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                        >
                          <Printer className="w-4 h-4" />
                          <span>
                            {isPrintLocked
                              ? 'Mengunci Seri & Menyiapkan Cetak...'
                              : isThermalMode
                              ? `Cetak Thermal (${paperFormat === 'THERMAL_58' ? '58mm' : '80mm'})`
                              : `Cetak / PDF (${totalA4SheetPages} Hal A4${
                                  duplexMode !== 'OFF' ? ' Bolak-Balik' : ''
                                })`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Screen Preview of Printable Sheets (A4 Front/Back Duplex OR Thermal Roll) */}
                  <div className="space-y-4">
                    <div className="text-xs text-zinc-400 flex flex-wrap items-center justify-end gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold">
                        <Lock className="w-3 h-3" />
                        <span>
                          Anti-Cetak-Ganda ({issuedPrintedLots.length} seri terkunci)
                        </span>
                      </span>
                    </div>

                    {isThermalMode ? (
                      <div className="max-h-[55vh] overflow-y-auto pr-1 py-4 bg-zinc-950/90 rounded-2xl border border-zinc-800 flex flex-wrap items-start justify-center gap-5">
                        {lotBatchNumbers.map((lot) => (
                          <div key={lot} className="shadow-2xl">
                            <ThermalGradeCardPaper
                              lotNumber={lot}
                              packagingChoices={masterDict.packagings}
                              profile={paperFormat === 'THERMAL_58' ? 'THERMAL_58' : 'THERMAL_80'}
                              includeBackBarcode={includeThermalBarcode}
                              customPrefix={customLotPrefix}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1">
                        {a4Pages.map((pageLots, pageIdx) => {
                          const backSlots =
                            duplexMode !== 'OFF'
                              ? arrangeDuplexBackSlots(pageLots, cardsPerA4Page, duplexMode)
                              : [];
                          return (
                            <React.Fragment key={pageIdx}>
                              {/* FRONT SIDE SHEET */}
                              <div className="bg-white text-black rounded-xl p-4 shadow-2xl border border-zinc-300">
                                <div className="text-[9px] font-mono font-bold text-zinc-500 mb-2 flex justify-between">
                                  <span>HALAMAN A4 #{pageIdx + 1} — SISI DEPAN (FORM GRADING)</span>
                                  <span>POTONG MENGIKUTI GARIS TEPI HITAM</span>
                                </div>
                                <div
                                  className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
                                    paperFormat === 'A4_6' ? 'sm:grid-rows-3' : 'sm:grid-rows-2'
                                  }`}
                                >
                                  {pageLots.map((lot) => (
                                    <PrintableGradeCardPaper
                                      key={lot}
                                      lotNumber={lot}
                                      packagingChoices={masterDict.packagings}
                                      compact={paperFormat === 'A4_6'}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* BACK SIDE SHEET (DUPLEX BARCODE + PREFIX) */}
                              {duplexMode !== 'OFF' && (
                                <div className="bg-white text-black rounded-xl p-4 shadow-2xl border-2 border-amber-500/70">
                                  <div className="text-[9px] font-mono font-bold text-zinc-700 mb-2 flex justify-between">
                                    <span>
                                      HALAMAN A4 #{pageIdx + 1} — SISI BELAKANG (BARCODE BESAR &amp; PREFIX •{' '}
                                      {duplexMode === 'LONG_EDGE' ? 'FLIP LONG EDGE' : 'FLIP SHORT EDGE'})
                                    </span>
                                    <span>OTOMATIS SEJAJAR DI BALIK KARTU DEPAN</span>
                                  </div>
                                  <div
                                    className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
                                      paperFormat === 'A4_6' ? 'sm:grid-rows-3' : 'sm:grid-rows-2'
                                    }`}
                                  >
                                    {backSlots.map((slot, sIdx) => (
                                      <PrintableGradeCardBackPaper
                                        key={`${pageIdx}-back-${sIdx}`}
                                        lotNumber={slot.lot}
                                        customPrefix={customLotPrefix}
                                        compact={paperFormat === 'A4_6'}
                                        rotate180={slot.rotate180}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Commit Bar (Only on Review Cepat when cards detected) */}
            {activeTab === 'scan' && reviewedCards.length > 0 && (
              <div className="px-4 py-3 sm:px-6 border-t border-zinc-800 bg-black/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="text-xs text-zinc-300">
                  Siap diproses: <strong className="text-amber-400">{selectedToSaveCount}</strong>{' '}
                  kartu
                  {duplicateBlockedCount > 0 && (
                    <span className="text-red-300 ml-2">
                      ({duplicateBlockedCount} kartu dobel terlindungi)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCommit}
                    disabled={selectedToSaveCount === 0}
                    className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan &amp; Update ke Gudang ({selectedToSaveCount})</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Dedicated Dynamic Print Portal (A4 Front/Back Duplex or Thermal 58mm/80mm) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="grade-card-print-portal">
            <style>{buildDynamicPrintPageCss(paperFormat)}</style>
            {isThermalMode
              ? lotBatchNumbers.map((lot) => (
                  <ThermalGradeCardPaper
                    key={lot}
                    lotNumber={lot}
                    packagingChoices={masterDict.packagings}
                    profile={paperFormat === 'THERMAL_58' ? 'THERMAL_58' : 'THERMAL_80'}
                    includeBackBarcode={includeThermalBarcode}
                    customPrefix={customLotPrefix}
                  />
                ))
              : a4Pages.map((pageLots, pageIdx) => {
                  const backSlots =
                    duplexMode !== 'OFF'
                      ? arrangeDuplexBackSlots(pageLots, cardsPerA4Page, duplexMode)
                      : [];
                  return (
                    <React.Fragment key={pageIdx}>
                      {/* ODD PAGE: FRONT */}
                      <div
                        className="grade-card-a4-page grid grid-cols-2 gap-3"
                        style={{
                          gridTemplateRows:
                            paperFormat === 'A4_6' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                          minHeight: '275mm',
                        }}
                      >
                        {pageLots.map((lot) => (
                          <PrintableGradeCardPaper
                            key={lot}
                            lotNumber={lot}
                            packagingChoices={masterDict.packagings}
                            compact={paperFormat === 'A4_6'}
                          />
                        ))}
                      </div>

                      {/* EVEN PAGE: BACK (BIG BARCODE + PREFIX FOR 2-SIDED PRINTERS) */}
                      {duplexMode !== 'OFF' && (
                        <div
                          className="grade-card-a4-page grid grid-cols-2 gap-3"
                          style={{
                            gridTemplateRows:
                              paperFormat === 'A4_6' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                            minHeight: '275mm',
                          }}
                        >
                          {backSlots.map((slot, sIdx) => (
                            <PrintableGradeCardBackPaper
                              key={`${pageIdx}-print-back-${sIdx}`}
                              lotNumber={slot.lot}
                              customPrefix={customLotPrefix}
                              compact={paperFormat === 'A4_6'}
                              rotate180={slot.rotate180}
                            />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
          </div>,
          document.body
        )}
    </>
  );
};
