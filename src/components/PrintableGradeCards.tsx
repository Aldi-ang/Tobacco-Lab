import React, { useMemo } from 'react';
import { sanitizePrintYear } from '../utils/graderRegistryEngine';
import {
  computeCode39TotalUnits,
  encodeCode39Modules,
  extractLotPrefixCode,
} from '../utils/thermalPrintEngine';

const PRINT_ATTRIBUTE_FIELDS: {
  key:
    | 'powerRating'
    | 'impactRating'
    | 'bitterRating'
    | 'burnRating'
    | 'sugarRating'
    | 'aromaRating';
  label: string;
}[] = [
  { key: 'powerRating', label: 'Power' },
  { key: 'impactRating', label: 'Impact' },
  { key: 'bitterRating', label: 'Bitter' },
  { key: 'burnRating', label: 'Burn' },
  { key: 'sugarRating', label: 'Sugar' },
  { key: 'aromaRating', label: 'Aroma' },
];

/** Deterministic crisp 7x7 mini matrix SVG from Kode Lot string for printable paper cards */
export const LotMatrixSvg: React.FC<{ lotCode: string; size?: number }> = ({
  lotCode,
  size = 34,
}) => {
  const cells = useMemo(() => {
    let seed = 2166136261;
    for (let i = 0; i < lotCode.length; i++) {
      seed ^= lotCode.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const grid: boolean[] = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
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
export const PrintableGradeCardPaper: React.FC<{
  lotNumber: string | null;
  packagingChoices: string[];
  compact: boolean;
  graderName?: string;
  printYear?: number;
  previewEmptySlotLabel?: string;
}> = ({
  lotNumber,
  packagingChoices,
  compact,
  graderName = '',
  printYear,
  previewEmptySlotLabel,
}) => {
  if (!lotNumber) {
    if (previewEmptySlotLabel) {
      return (
        <div
          className="grade-card-paper-item bg-zinc-50/60 border border-dashed border-zinc-200 text-zinc-400 flex items-center justify-center select-none min-h-[210px]"
          aria-hidden="true"
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest">
            {previewEmptySlotLabel}
          </span>
        </div>
      );
    }
    return (
      <div
        className="grade-card-paper-item bg-white border border-transparent select-none"
        aria-hidden="true"
      />
    );
  }

  const pkgs = packagingChoices.slice(0, 6);
  const gradesRow1 = ['A+', 'A', 'B+', 'B', 'C+', 'C'];
  const gradesRow2 = ['D+', 'D', 'E+', 'E', 'F+', 'F'];
  const resolvedYear = sanitizePrintYear(printYear);
  const cleanGrader = graderName.trim();

  return (
    <div
      className={`grade-card-paper-item relative bg-white text-black border-2 border-black flex flex-col justify-between select-none box-border overflow-hidden ${
        compact ? 'p-1.5 text-[8px] leading-tight' : 'p-2.5 text-[9.5px]'
      }`}
      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
    >
      {/* 4 Corner Registration L-Marks for Vision Alignment */}
      <span className="absolute top-0.5 left-0.5 w-2.5 h-2.5 border-t-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 border-t-2 border-r-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 border-b-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 border-black pointer-events-none" />

      {/* Header + Lot Code + Matrix */}
      <div
        className={`flex items-center justify-between gap-2 border-b-[1.5px] border-black ${
          compact ? 'pb-0.5' : 'pb-1'
        }`}
      >
        <div className="min-w-0">
          <div className="text-[6.5px] font-extrabold uppercase tracking-[0.14em] text-zinc-700 truncate">
            TOBACCO LAB • KARTU GRADE
          </div>
          <div
            className={`font-mono font-black tracking-tight leading-none ${
              compact ? 'text-[11px]' : 'text-sm'
            }`}
          >
            {lotNumber}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <LotMatrixSvg lotCode={lotNumber} size={compact ? 20 : 30} />
        </div>
      </div>

      {/* Boxed Handwritten Identity Fields */}
      <div className={`grid grid-cols-2 ${compact ? 'gap-[3px] my-[2px]' : 'gap-1 my-1'}`}>
        <div className="border border-black px-1.5 py-[2px] flex flex-col justify-between">
          <div className="text-[6px] font-black uppercase tracking-wider text-zinc-800">
            TANGGAL (TGL / BLN / THN)
          </div>
          <div
            className={`${
              compact ? 'h-3.5' : 'h-5'
            } flex items-end font-mono text-[8px] font-bold leading-none text-zinc-600`}
          >
            ____ / ____ / <span className="text-black font-black ml-0.5">{resolvedYear}</span>
          </div>
        </div>
        <div className="border border-black px-1.5 py-[2px] flex flex-col justify-between">
          <div className="text-[6px] font-black uppercase tracking-wider text-zinc-800">
            NAMA GRADER
          </div>
          <div
            className={`${compact ? 'h-3.5' : 'h-5'} flex items-end leading-none overflow-hidden`}
          >
            {cleanGrader ? (
              <span
                className={`font-extrabold text-black truncate ${
                  compact ? 'text-[8.5px]' : 'text-[10px]'
                }`}
              >
                {cleanGrader}
              </span>
            ) : null}
          </div>
        </div>
        <div className="border border-black px-1.5 py-[2px]">
          <div className="text-[6px] font-black uppercase tracking-wider text-zinc-700">
            PENJUAL / PETANI
          </div>
          <div className={compact ? 'h-2' : 'h-3.5'} />
        </div>
        <div className="border border-black px-1.5 py-[2px]">
          <div className="text-[6px] font-black uppercase tracking-wider text-zinc-700">
            DAERAH ASAL (MTL/TMG/WDS)
          </div>
          <div className={compact ? 'h-2' : 'h-3.5'} />
        </div>
        <div className="col-span-2 border border-black px-1.5 py-[2px]">
          <div className="text-[6px] font-black uppercase tracking-wider text-zinc-700">
            NAMA / JENIS TEMBAKAU
          </div>
          <div className={compact ? 'h-2' : 'h-3.5'} />
        </div>
      </div>

      {/* Grade Checkboxes (SILANG X) */}
      <div className={`border border-black px-1.5 ${compact ? 'py-0.5 mb-[2px]' : 'py-1 mb-1'}`}>
        <div className="text-[6px] font-black uppercase tracking-wider text-zinc-800 mb-[2px]">
          GRADE WARNA (SILANG X / CENTANG 1)
        </div>
        <div className="grid grid-cols-6 gap-[2px]">
          {[...gradesRow1, ...gradesRow2].map((gr) => (
            <div key={gr} className="flex items-center gap-1 min-w-0">
              <span
                className={`inline-block rounded-[2px] border-[1.25px] border-black shrink-0 ${
                  compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
                }`}
              />
              <span className={`font-mono font-black ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
                {gr}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Packaging Checkboxes (SILANG X) */}
      <div className={`border border-black px-1.5 ${compact ? 'py-0.5 mb-[2px]' : 'py-1 mb-1'}`}>
        <div className="text-[6px] font-black uppercase tracking-wider text-zinc-800 mb-[2px]">
          KEMASAN (SILANG X / CENTANG 1)
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-[2px]">
          {pkgs.map((pkgName) => (
            <div key={pkgName} className="flex items-center gap-1">
              <span
                className={`inline-block rounded-[2px] border-[1.25px] border-black shrink-0 ${
                  compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
                }`}
              />
              <span className={`font-bold uppercase ${compact ? 'text-[7px]' : 'text-[8px]'}`}>
                {pkgName}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span
              className={`inline-block rounded-[2px] border-[1.25px] border-black shrink-0 ${
                compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
              }`}
            />
            <span className={`font-bold ${compact ? 'text-[7px]' : 'text-[8px]'}`}>
              Lain: ______
            </span>
          </div>
        </div>
      </div>

      {/* 6 Attributes Whole-Number 1-5 Square Checkboxes */}
      <div className={`border border-black px-1.5 ${compact ? 'py-0.5 mb-[2px]' : 'py-1 mb-1'}`}>
        <div className="text-[6px] font-black uppercase tracking-wider text-zinc-800 mb-[2px]">
          KARAKTER RASA &amp; BAKAR (SILANG X ANGKA 1–5 • BULAT)
        </div>
        <div className={`grid grid-cols-2 gap-x-2 ${compact ? 'gap-y-[2px]' : 'gap-y-1'}`}>
          {PRINT_ATTRIBUTE_FIELDS.map((attr) => (
            <div
              key={attr.key}
              className="flex items-center justify-start gap-1.5 min-w-0 overflow-hidden"
            >
              <span
                className={`font-extrabold uppercase tracking-tight shrink-0 w-9 ${
                  compact ? 'text-[7px]' : 'text-[7.5px]'
                }`}
              >
                {attr.label}
              </span>
              <div className="flex items-center gap-[2px] shrink-0">
                {[1, 2, 3, 4, 5].map((num) => (
                  <span
                    key={num}
                    className={`${
                      compact ? 'w-[11px] h-[11px] text-[6.5px]' : 'w-[14px] h-[14px] text-[7.5px]'
                    } rounded-[2px] border-[1.2px] border-black inline-flex items-center justify-center font-mono font-bold leading-none`}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage 2: Timbangan & Harga */}
      <div className={`border-t-[1.5px] border-dashed border-black ${compact ? 'pt-0.5' : 'pt-1'}`}>
        <div className="text-[6px] font-black uppercase tracking-wider text-zinc-700 mb-[2px]">
          TAHAP 2 (MENYUSUL — ISI &amp; SCAN ULANG KARTU INI)
        </div>
        <div className="grid grid-cols-12 gap-1">
          <div className="col-span-4 border border-black px-1.5 py-[2px]">
            <div className="text-[6px] font-black uppercase">BRUTO (KG)</div>
            <div className={compact ? 'h-2.5' : 'h-4'} />
          </div>
          <div className="col-span-4 border border-black px-1.5 py-[2px]">
            <div className="text-[6px] font-black uppercase">HARGA / KG (RP)</div>
            <div className={compact ? 'h-2.5' : 'h-4'} />
          </div>
          <div className="col-span-4 border border-black px-1.5 py-[2px]">
            <div className="text-[6px] font-black uppercase">CATATAN</div>
            <div className={compact ? 'h-2.5' : 'h-4'} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** Scannable 1D Code 39 Linear Barcode SVG (ISO/ANSI standard bar/space ratios) */
export const Code39BarcodeSvg: React.FC<{
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
export const PrintableGradeCardBackPaper: React.FC<{
  lotNumber: string | null;
  customPrefix?: string;
  compact: boolean;
  rotate180?: boolean;
  blankUnusedSlots?: boolean;
}> = ({ lotNumber, customPrefix, compact, rotate180 = false, blankUnusedSlots = false }) => {
  if (!lotNumber) {
    if (blankUnusedSlots) {
      return (
        <div
          className="grade-card-paper-item bg-white border border-transparent select-none"
          aria-hidden="true"
        />
      );
    }
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
      className={`grade-card-paper-item relative bg-white text-black border-2 border-black flex flex-col justify-between select-none box-border overflow-hidden ${
        compact ? 'p-2.5 text-[9px]' : 'p-3 text-[10px]'
      } ${rotate180 ? 'rotate-180' : ''}`}
      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
    >
      <span className="absolute top-0.5 left-0.5 w-2.5 h-2.5 border-t-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 border-t-2 border-r-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 left-0.5 w-2.5 h-2.5 border-b-2 border-l-2 border-black pointer-events-none" />
      <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 border-b-2 border-r-2 border-black pointer-events-none" />

      <div className="flex items-center justify-between gap-2 pb-1.5 border-b-2 border-black">
        <div className="min-w-0">
          <div className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-zinc-700 truncate">
            TOBACCO LAB • SISI BELAKANG
          </div>
          <div className="text-[8.5px] font-black uppercase tracking-wider mt-0.5 truncate">
            BARCODE SCANNER LOT GUDANG
          </div>
        </div>
        <div className="bg-black text-white px-2 py-0.5 rounded-[3px] text-right shrink-0">
          <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] opacity-80">
            PREFIX CODE
          </div>
          <div
            className={`font-mono font-black tracking-wider ${
              compact ? 'text-[11px]' : 'text-xs'
            }`}
          >
            {prefixCode}
          </div>
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col justify-center ${
          compact ? 'my-1 gap-1' : 'my-1.5 gap-1.5'
        }`}
      >
        <div className={`border-2 border-black bg-white ${compact ? 'p-1.5' : 'p-2'}`}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Code39BarcodeSvg code={lotNumber} height={compact ? 42 : 62} />
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <LotMatrixSvg lotCode={lotNumber} size={compact ? 40 : 56} />
              <span className="text-[6px] font-mono font-extrabold uppercase mt-0.5">
                2D ANCHOR
              </span>
            </div>
          </div>

          <div
            className={`text-center font-mono font-black tracking-[0.14em] leading-none border-t border-zinc-300 ${
              compact ? 'text-sm mt-1 pt-1' : 'text-xl mt-1.5 pt-1.5'
            }`}
          >
            {lotNumber}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-dashed border-black pt-1 flex items-center justify-between gap-2 text-[7.5px] font-mono font-bold text-zinc-700">
        <span className="shrink-0">PREFIX: {prefixCode}</span>
        <span className="truncate">SCAN BARCODE UNTUK TAHAP 2 / CARI LOT</span>
      </div>
    </div>
  );
};

/** Single-column vertical high-contrast slip formatted specifically for 58mm / 80mm thermal rolls */
export const ThermalGradeCardPaper: React.FC<{
  lotNumber: string;
  packagingChoices: string[];
  profile: 'THERMAL_58' | 'THERMAL_80';
  includeBackBarcode?: boolean;
  customPrefix?: string;
  graderName?: string;
  printYear?: number;
}> = ({
  lotNumber,
  packagingChoices,
  profile,
  includeBackBarcode = false,
  customPrefix,
  graderName = '',
  printYear,
}) => {
  const is58 = profile === 'THERMAL_58';
  const pkgs = packagingChoices.slice(0, 4);
  const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
  const prefixCode = extractLotPrefixCode(lotNumber, customPrefix);
  const resolvedYear = sanitizePrintYear(printYear);
  const cleanGrader = graderName.trim();

  return (
    <div
      className={`grade-card-thermal-strip bg-white text-black border-2 border-black mx-auto select-none ${
        is58 ? 'w-[52mm] p-1.5 text-[8.5px]' : 'w-[72mm] p-2.5 text-[10px]'
      }`}
      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
    >
      <div className="flex items-start justify-between gap-1.5 pb-1.5 border-b-2 border-black">
        <div className="min-w-0">
          <div
            className={`${
              is58 ? 'text-[7px]' : 'text-[8px]'
            } font-extrabold uppercase tracking-[0.14em]`}
          >
            TOBACCO LAB • SLIP GRADE
          </div>
          <div
            className={`font-mono font-black tracking-tight leading-tight mt-0.5 ${
              is58 ? 'text-xs' : 'text-sm'
            }`}
          >
            {lotNumber}
          </div>
          <div className={`${is58 ? 'text-[7px]' : 'text-[8px]'} text-zinc-700 mt-0.5`}>
            Tgl: ___/___/<b className="text-black">{resolvedYear}</b> • Grd:{' '}
            <b className="text-black">{cleanGrader || '_______'}</b>
          </div>
        </div>
        <LotMatrixSvg lotCode={lotNumber} size={is58 ? 28 : 34} />
      </div>

      <div className="space-y-1 my-1.5">
        <div className="border border-black px-1.5 py-1">
          <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase`}>
            PENJUAL / PETANI
          </div>
          <div className={is58 ? 'h-4' : 'h-5'} />
        </div>
        <div className="border border-black px-1.5 py-1">
          <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase`}>
            DAERAH ASAL (MTL/TMG/WDS)
          </div>
          <div className={is58 ? 'h-4' : 'h-5'} />
        </div>
        <div className="border border-black px-1.5 py-1">
          <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase`}>
            NAMA / JENIS TEMBAKAU
          </div>
          <div className={is58 ? 'h-4' : 'h-5'} />
        </div>
      </div>

      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase mb-1`}>
          GRADE WARNA (SILANG X SATU)
        </div>
        <div className="grid grid-cols-4 gap-1">
          {grades.map((gr) => (
            <div key={gr} className="flex items-center gap-0.5">
              <span
                className={`${
                  is58 ? 'w-3 h-3' : 'w-3.5 h-3.5'
                } rounded-[2px] border-[1.5px] border-black inline-block shrink-0`}
              />
              <span className={`font-mono font-black ${is58 ? 'text-[8px]' : 'text-[9px]'}`}>
                {gr}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase mb-1`}>
          KEMASAN (SILANG X SATU)
        </div>
        <div className="grid grid-cols-2 gap-1">
          {pkgs.map((pkgName) => (
            <div key={pkgName} className="flex items-center gap-1 min-w-0">
              <span
                className={`${
                  is58 ? 'w-3 h-3' : 'w-3.5 h-3.5'
                } rounded-[2px] border-[1.5px] border-black inline-block shrink-0`}
              />
              <span
                className={`font-bold uppercase truncate ${
                  is58 ? 'text-[7.5px]' : 'text-[8.5px]'
                }`}
              >
                {pkgName}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-black px-1.5 py-1 mb-1.5">
        <div className={`${is58 ? 'text-[6.5px]' : 'text-[7.5px]'} font-black uppercase mb-1`}>
          KARAKTER RASA (SILANG X ANGKA 1–5)
        </div>
        <div className="space-y-1">
          {PRINT_ATTRIBUTE_FIELDS.map((attr) => (
            <div key={attr.key} className="flex items-center justify-start gap-2">
              <span
                className={`font-extrabold uppercase shrink-0 ${
                  is58 ? 'w-11 text-[8px]' : 'w-12 text-[9px]'
                }`}
              >
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
            <div
              className={`text-center font-mono font-black tracking-wider ${
                is58 ? 'text-[10px]' : 'text-xs'
              }`}
            >
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
