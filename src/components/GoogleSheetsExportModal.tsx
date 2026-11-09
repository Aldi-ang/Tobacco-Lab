import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Download,
  Sparkles,
  Link2,
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  RawTobacco,
  TobaccoRollSample,
} from '../types/tobacco';
import {
  getAccessToken,
  googleSignInForSheets,
} from '../firebase';
import {
  createGoogleSpreadsheetWithData,
  updateExistingGoogleSpreadsheet,
  buildAllRollsHistoryRows,
  buildAllSerialStatusRows,
} from '../utils/googleSheetsApi';

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos: RawTobacco[];
  defaultTitle?: string;
  userEmail?: string | null;
}

export const GoogleSheetsExportModal: React.FC<GoogleSheetsExportModalProps> = ({
  isOpen,
  onClose,
  rollSamples,
  finishedBatches,
  rawTobaccos,
  defaultTitle,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [mode, setMode] = useState<'CREATE_NEW' | 'UPDATE_EXISTING'>('CREATE_NEW');
  const [newSheetTitle, setNewSheetTitle] = useState<string>(
    defaultTitle || `Tobacco Lab — Riwayat Nota & Status Seri (${todayStr})`
  );
  const [existingUrlOrId, setExistingUrlOrId] = useState<string>('');
  const [exportScope, setExportScope] = useState<'ALL_TABS' | 'NOTA_HISTORY' | 'SERIAL_STATUS'>(
    'ALL_TABS'
  );

  // Mandatory explicit confirmation state before updating an existing Google Spreadsheet
  const [showConfirmUpdateModal, setShowConfirmUpdateModal] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    title: string;
    url: string;
    detail: string;
  } | null>(null);
  const [copiedQuick, setCopiedQuick] = useState<'NOTA' | 'SERI' | null>(null);

  if (!isOpen) return null;

  const ensureToken = async (): Promise<string> => {
    const existing = getAccessToken();
    if (existing) return existing;
    const authRes = await googleSignInForSheets();
    return authRes.accessToken;
  };

  const handleCreateNewSheet = async () => {
    setErrorMsg(null);
    setSuccessResult(null);
    setIsLoading(true);
    try {
      const token = await ensureToken();
      const res = await createGoogleSpreadsheetWithData({
        accessToken: token,
        spreadsheetTitle:
          newSheetTitle.trim() || `Tobacco Lab — Riwayat Nota & Status Seri (${todayStr})`,
        rollSamples,
        finishedBatches,
        rawTobaccos,
      });
      setSuccessResult({
        title: res.title,
        url: res.spreadsheetUrl,
        detail: `Berhasil membuat Google Spreadsheet baru berisi 3 Tab: Riwayat Nota Gulungan (${rollSamples.length} Gulungan), Status Semua Seri (${finishedBatches.length} Seri), dan Stok Bahan Mentah (${rawTobaccos.length} Stok).`,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menghubungkan ke Google Sheets.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestUpdateExisting = () => {
    if (!existingUrlOrId.trim()) {
      setErrorMsg('Masukkan URL atau ID Google Spreadsheet tujuan terlebih dahulu.');
      return;
    }
    setErrorMsg(null);
    // Show mandatory confirmation dialog before mutating user's existing spreadsheet
    setShowConfirmUpdateModal(true);
  };

  const handleConfirmedUpdateExisting = async () => {
    setShowConfirmUpdateModal(false);
    setErrorMsg(null);
    setSuccessResult(null);
    setIsLoading(true);
    try {
      const token = await ensureToken();
      const res = await updateExistingGoogleSpreadsheet({
        accessToken: token,
        spreadsheetIdOrUrl: existingUrlOrId.trim(),
        rollSamples,
        finishedBatches,
        rawTobaccos,
        exportScope,
      });
      setSuccessResult({
        title: res.spreadsheetTitle,
        url: res.spreadsheetUrl,
        detail: `Berhasil mentransfer data ke tab "${res.updatedTabName}" (${rollSamples.length} Gulungan & ${finishedBatches.length} Nomor Seri).`,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memperbarui Google Spreadsheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCopyTsv = (kind: 'NOTA' | 'SERI') => {
    const matrix =
      kind === 'NOTA'
        ? buildAllRollsHistoryRows(rollSamples, finishedBatches)
        : buildAllSerialStatusRows(finishedBatches);
    const tsv = matrix.map((r) => r.map((c) => String(c ?? '')).join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    setCopiedQuick(kind);
    setTimeout(() => setCopiedQuick(null), 2500);
  };

  const handleQuickDownloadCsv = (kind: 'NOTA' | 'SERI') => {
    const matrix =
      kind === 'NOTA'
        ? buildAllRollsHistoryRows(rollSamples, finishedBatches)
        : buildAllSerialStatusRows(finishedBatches);
    const csv = matrix
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? '');
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `awd_master_${kind === 'NOTA' ? 'riwayat_nota_gulungan' : 'status_semua_seri'}_${todayStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const hasToken = !!getAccessToken();

  return (
    <AnimatePresence>
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
          className="bg-zinc-950 border-2 border-amber-500 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-[0_0_45px_rgba(245,158,11,0.28)] text-white overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-black border border-amber-500 flex items-center justify-center text-amber-400 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400 block">
                  INTEGRASI GOOGLE SHEETS RESMI
                </span>
                <h2 className="text-sm sm:text-base font-black text-white truncate">
                  Transfer Riwayat Nota & Status Seri ke Google Sheets
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
              aria-label="Tutup modal Google Sheets"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
            {/* Connection status / Sign in with Google button */}
            <div className="bg-black p-3.5 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-extrabold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Status Izin Google Sheets:{' '}
                    {hasToken ? (
                      <b className="text-amber-400">Terhubung & Siap Transfer</b>
                    ) : (
                      <b className="text-zinc-300">Perlu Konfirmasi Akun Google</b>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Mentransfer {rollSamples.length} Nota Gulungan, {finishedBatches.length} Nomor Seri (termasuk jejak <b className="text-amber-300">AK 1 -&gt; AL 1</b>), dan {rawTobaccos.length} Stok Mentah.
                </p>
              </div>

              {!hasToken && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setErrorMsg(null);
                    setIsLoading(true);
                    try {
                      await googleSignInForSheets();
                    } catch (err: any) {
                      setErrorMsg(err?.message || 'Gagal masuk ke Google.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs shadow-md transition-all cursor-pointer shrink-0"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-4 h-4 block shrink-0"
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMode('CREATE_NEW');
                  setErrorMsg(null);
                }}
                className={`h-9 px-3 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
                  mode === 'CREATE_NEW'
                    ? 'bg-zinc-900 text-amber-400 border border-amber-500'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                1. Buat Spreadsheet Baru
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('UPDATE_EXISTING');
                  setErrorMsg(null);
                }}
                className={`h-9 px-3 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
                  mode === 'UPDATE_EXISTING'
                    ? 'bg-zinc-900 text-amber-400 border border-amber-500'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                2. Update Sheet yang Ada
              </button>
            </div>

            {mode === 'CREATE_NEW' ? (
              <div className="bg-black p-4 rounded-xl border border-zinc-800 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">
                    Judul Google Spreadsheet Baru
                  </label>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="Contoh: AWD Master — Riwayat Nota & Status Seri"
                    className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/90 space-y-1 text-[11px] text-zinc-300">
                  <div className="font-bold text-white">Isi 3 Sheet yang Akan Dibuat Otomatis:</div>
                  <div>• <b>Tab 1 (Riwayat Nota Gulungan)</b>: Seluruh nota gulungan yang dikirim beserta status tiap seri & profit.</div>
                  <div>• <b>Tab 2 (Status Semua Seri)</b>: Data semua nomor seri, jejak ganti seri (<b className="text-amber-300">AK 1 -&gt; AL 1</b>), eks-gulungan, & pabrik.</div>
                  <div>• <b>Tab 3 (Stok Bahan Mentah)</b>: Data stok gudang, Paid Value, Real Value, & Weight Profit.</div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleCreateNewSheet}
                  className="btn-amber-outline w-full h-10 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuat & Mengisi Google Sheet...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Buat & Transfer ke Google Sheet Baru Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-black p-4 rounded-xl border border-zinc-800 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">
                    Link URL atau ID Google Spreadsheet Tujuan
                  </label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={existingUrlOrId}
                      onChange={(e) => setExistingUrlOrId(e.target.value)}
                      placeholder="Tempel link https://docs.google.com/spreadsheets/d/..."
                      className="w-full h-10 pl-9 pr-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Data yang Ingin Ditransfer
                  </label>
                  <select
                    value={exportScope}
                    onChange={(e) => setExportScope(e.target.value as any)}
                    className="w-full h-9 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-amber-400 font-bold focus:outline-hidden focus:border-amber-500"
                    aria-label="Pilih Cakupan Data Transfer"
                  >
                    <option value="ALL_TABS">
                      Semua Data (3 Tab: Riwayat Nota + Status Seri + Stok Mentah)
                    </option>
                    <option value="NOTA_HISTORY">
                      Hanya Tab Riwayat Nota Gulungan ({rollSamples.length} Gulungan)
                    </option>
                    <option value="SERIAL_STATUS">
                      Hanya Tab Status Semua Seri ({finishedBatches.length} Seri)
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleRequestUpdateExisting}
                  className="btn-amber-outline w-full h-10 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mentransfer Data ke Spreadsheet...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Transfer & Perbarui Google Spreadsheet</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/70 text-red-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-red-300">Kendala Transfer Google Sheets</div>
                  <p className="text-[11px] leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Success Result Banner with Direct Link */}
            {successResult && (
              <div className="p-4 rounded-xl bg-black border-2 border-amber-400 space-y-2.5 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
                <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Transfer ke Google Sheets Berhasil!</span>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">{successResult.detail}</p>
                <a
                  href={successResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-amber-outline inline-flex items-center gap-2 h-9 px-4 rounded-xl font-black text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka "{successResult.title}" di Google Sheets</span>
                </a>
              </div>
            )}

            {/* Offline / Quick Copy TSV & CSV Fallback */}
            <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
              <div className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-wider">
                Alternatif Cepat (Copy-Paste Langsung / Unduh File CSV):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickCopyTsv('NOTA')}
                    className="flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedQuick === 'NOTA' ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Salin Riwayat Nota
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDownloadCsv('NOTA')}
                    className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Unduh CSV Riwayat Nota Gulungan"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" /> CSV
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickCopyTsv('SERI')}
                    className="flex-1 h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedQuick === 'SERI' ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Salin Status Seri
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDownloadCsv('SERI')}
                    className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Unduh CSV Status Semua Seri"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" /> CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mandatory Confirmation Dialog for Updating Existing Spreadsheet */}
          <AnimatePresence>
            {showConfirmUpdateModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
              >
                <div className="bg-zinc-950 border-2 border-amber-500 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
                  <div className="flex items-center gap-2.5 text-amber-400 font-black text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Konfirmasi Perbarui Google Spreadsheet</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Apakah Anda yakin ingin menuliskan / memperbarui data pada Google Spreadsheet tersebut ({rollSamples.length} Gulungan &amp; {finishedBatches.length} Nomor Seri)? Data pada tab tujuan akan diperbarui sesuai data terbaru aplikasi.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setShowConfirmUpdateModal(false)}
                      className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold text-xs cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmedUpdateExisting}
                      className="btn-amber-outline h-9 px-4 rounded-xl font-black text-xs cursor-pointer"
                    >
                      Ya, Konfirmasi &amp; Transfer
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
