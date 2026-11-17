import React from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  Check,
  FileCheck2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  PreviousPrefixDetection,
  REPRINT_REASON_OPTIONS,
  ReprintReasonCode,
  ReprintWarningEvaluation,
} from '../utils/prefixAuditLedger';

interface ReprintSafetyWarningProps {
  warning: ReprintWarningEvaluation;
  selectedReason: ReprintReasonCode | null;
  onSelectReason: (reason: ReprintReasonCode) => void;
  confirmed: boolean;
  onConfirmedChange: (checked: boolean) => void;
}

/**
 * Factory-grade Reprint Risk & Verification Notice.
 * Separates Stock-Registered double-entry risks (Red) from Printed-lot risks (Amber),
 * requiring an explicit reason code + physical card disposal confirmation before unlocking print.
 */
export const ReprintSafetyWarning: React.FC<ReprintSafetyWarningProps> = ({
  warning,
  selectedReason,
  onSelectReason,
  confirmed,
  onConfirmedChange,
}) => {
  if (warning.severity === 'NONE') return null;

  const isCritical = warning.severity === 'CRITICAL_STOCK';
  const isPrinted = warning.severity === 'PRINTED_WARNING';

  if (warning.severity === 'UNPRINTED_INFO') {
    return (
      <div
        data-testid="reprint-older-lot-warning"
        className="p-3 rounded-xl bg-[#0a0b0f] border border-zinc-700/90 flex items-center gap-2.5 text-xs text-zinc-200"
      >
        <FileCheck2 className="w-4 h-4 text-zinc-400 shrink-0" />
        <div className="min-w-0">
          <span className="font-bold text-white">Nomor Belum Tercatat Cetak</span>
          <span className="text-zinc-500 mx-1.5">·</span>
          <span className="font-mono text-amber-300 font-bold">
            {warning.unprintedLots.join(', ')}
          </span>
          <span className="text-zinc-400 ml-1.5">siap dicetak ulang.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reprint-older-lot-warning"
      role="alert"
      className={`rounded-xl border overflow-hidden ${
        isCritical
          ? 'bg-[#120608] border-red-500/80 text-red-100'
          : 'bg-[#110d05] border-amber-500/80 text-amber-100'
      }`}
    >
      {/* Top Warning Header */}
      <div
        className={`px-3.5 py-2.5 border-b flex items-start gap-2.5 ${
          isCritical ? 'border-red-500/30 bg-red-950/35' : 'border-amber-500/30 bg-amber-950/25'
        }`}
      >
        {isCritical ? (
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-xs font-extrabold tracking-tight text-white">
            {isCritical
              ? 'Peringatan Kritis · Nomor Sudah Masuk Stok'
              : 'Peringatan · Nomor Pernah Dicetak'}
          </div>
          <p className="text-[11px] text-zinc-300 leading-snug">
            {isCritical
              ? 'Kartu fisik pengganti hanya boleh diterbitkan jika kartu asli rusak atau hilang.'
              : 'Pastikan hasil cetak sebelumnya yang cacat dimusnahkan agar tidak terjadi lot ganda.'}
          </p>
        </div>
      </div>

      {/* Affected Lots Breakdown */}
      <div className="px-3.5 py-2.5 space-y-3">
        <div className="space-y-1">
          {warning.stockedItems.map((item) => (
            <div
              key={item.lotCode}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/55 border border-red-500/35 text-[11px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-black text-red-300 shrink-0">{item.lotCode}</span>
                <span className="text-zinc-500" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold text-white truncate">{item.stockName}</span>
              </div>
              <span className="font-mono text-[10px] text-red-300 shrink-0">
                Stok {item.purchaseDate || 'Aktif'}
              </span>
            </div>
          ))}

          {warning.printedOnlyLots.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/55 border border-amber-500/35 text-[11px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-black text-amber-300 truncate">
                  {warning.printedOnlyLots.join(', ')}
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-300 shrink-0">
                Sudah Dicetak
              </span>
            </div>
          )}
        </div>

        {/* Step 1: Mandatory Factory Reprint Reason */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-200">
            1. Pilih Alasan Cetak Ulang <span className="text-red-400">*</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {REPRINT_REASON_OPTIONS.map((opt) => {
              const active = selectedReason === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  data-testid={`reprint-reason-${opt.code}`}
                  onClick={() => onSelectReason(opt.code)}
                  title={opt.shortDesc}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-bold transition-colors cursor-pointer ${
                    active
                      ? isCritical
                        ? 'bg-[#1f0a0d] border-red-400 text-white'
                        : 'bg-[#1a1306] border-amber-400 text-amber-200'
                      : 'bg-black/60 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{opt.label}</span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0 text-amber-300" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Verification Gate */}
        <label
          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${
            confirmed
              ? 'bg-[#091510] border-emerald-500/70 text-emerald-100'
              : 'bg-black/65 border-zinc-800 hover:border-zinc-600 text-zinc-200'
          }`}
        >
          <input
            type="checkbox"
            data-testid="confirm-reprint-warning-checkbox"
            checked={confirmed}
            onChange={(e) => onConfirmedChange(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded accent-amber-500 cursor-pointer shrink-0"
          />
          <span className="text-[11px] font-semibold leading-snug">
            2. Konfirmasi:{' '}
            {isPrinted && !isCritical
              ? 'Kartu lama yang rusak sudah dimusnahkan dan nomor tidak dipakai ganda.'
              : 'Kartu fisik lama sudah dimusnahkan / hilang dan tidak akan dipakai ganda.'}
          </span>
        </label>
      </div>
    </div>
  );
};

interface DeleteConfirmWarningProps {
  testId?: string;
  targetLabel: string;
  consequenceText: string;
  confirmButtonLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmWarning: React.FC<DeleteConfirmWarningProps> = ({
  testId,
  targetLabel,
  consequenceText,
  confirmButtonLabel,
  onCancel,
  onConfirm,
}) => (
  <div
    data-testid={testId}
    role="alert"
    className="p-3 rounded-xl bg-[#120608] border border-red-500/75 flex flex-wrap items-center justify-between gap-2.5 text-xs"
  >
    <div className="flex items-start gap-2 min-w-0 flex-1">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="font-extrabold text-white">Hapus {targetLabel}?</div>
        <p className="text-[11px] text-zinc-300 leading-snug mt-0.5">{consequenceText}</p>
      </div>
    </div>
    <div className="flex items-center gap-1.5 ml-auto shrink-0">
      <button
        type="button"
        onClick={onCancel}
        className="h-8 px-3 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold cursor-pointer transition-colors"
      >
        Batal
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="h-8 px-3 rounded-lg bg-[#1d090b] hover:bg-red-950 border border-red-500/80 text-red-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>{confirmButtonLabel}</span>
      </button>
    </div>
  </div>
);

interface PrefixHistoryResumeNoticeProps {
  detection: PreviousPrefixDetection;
}

export const PrefixHistoryResumeNotice: React.FC<PrefixHistoryResumeNoticeProps> = ({
  detection,
}) => (
  <div
    data-testid="readd-prefix-history-detected"
    className="p-2.5 rounded-xl bg-[#110d05] border border-amber-500/75 flex items-start gap-2 text-xs"
  >
    <ArchiveRestore className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
    <div className="min-w-0 space-y-0.5">
      <div className="font-extrabold text-amber-200">
        Riwayat Lama{' '}
        <span className="font-mono text-white">{detection.prefixKey}</span> Terdeteksi
      </div>
      <p className="text-[11px] text-zinc-300 leading-snug tabular-nums">
        {detection.printedCount} dicetak · {detection.stockCount} masuk stok
        {detection.highestLotCode ? ` (terakhir ${detection.highestLotCode})` : ''} · otomatis
        lanjut ke <b className="font-mono text-amber-300">{detection.nextContinueLot}</b>.
      </p>
    </div>
  </div>
);

interface PrintErrorWarningProps {
  message: string;
}

export const PrintErrorWarning: React.FC<PrintErrorWarningProps> = ({ message }) => (
  <div
    role="alert"
    className="px-3.5 py-2.5 rounded-xl bg-[#120608] border border-red-500/75 text-xs text-red-100 flex items-start gap-2.5"
  >
    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
    <div className="min-w-0 space-y-0.5">
      <div className="font-extrabold text-red-300">Proses Cetak / PDF Belum Berhasil</div>
      <p className="text-[11px] text-zinc-200 leading-snug">{message}</p>
    </div>
  </div>
);
