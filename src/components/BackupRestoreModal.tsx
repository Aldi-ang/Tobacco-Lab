import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Upload,
  Share2,
  Copy,
  Check,
  X,
  FileJson,
  ClipboardPaste,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
} from '../types/tobacco';

export interface TobaccoBackupPayload {
  rawTobaccos?: RawTobacco[];
  finishedBatches?: FinishedTobaccoSerial[];
  rollSamples?: TobaccoRollSample[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
  exportedAt?: string;
  version?: string;
}

interface BackupRestoreModalProps {
  isOpen: boolean;
  initialMode?: 'backup' | 'restore';
  onClose: () => void;
  backupData: TobaccoBackupPayload;
  onRestorePayload: (payload: TobaccoBackupPayload) => void;
  onShowToast: (msg: string) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  initialMode = 'backup',
  onClose,
  backupData,
  onRestorePayload,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>(initialMode);
  const [copiedJson, setCopiedJson] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setErrorMsg(null);
      setPasteText('');
      setCopiedJson(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `tobacco_lab_backup_${dateStr}.json`;
  const jsonText = JSON.stringify(backupData, null, 2);

  const handleDownloadBlobFile = () => {
    try {
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 400);
      onShowToast(`File backup ${fileName} berhasil diunduh!`);
    } catch {
      handleCopyJsonText();
    }
  };

  const handleShareFileMobile = async () => {
    try {
      const file = new File([jsonText], fileName, { type: 'application/json' });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: `Backup Data Tobacco Lab (${dateStr})`,
          text: `Backup Data Gudang & Gulungan Tobacco Lab (${dateStr})`,
          files: [file],
        });
        onShowToast('File JSON berhasil dibagikan / disimpan!');
        return;
      }
    } catch (err: unknown) {
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'AbortError') return;
    }
    // Fallback to Blob download if file share is unsupported
    handleDownloadBlobFile();
  };

  const handleCopyJsonText = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopiedJson(true);
      onShowToast('Kode Backup JSON berhasil disalin ke Clipboard!');
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      setErrorMsg('Gagal menyalin otomatis. Silakan gunakan tombol Unduh File JSON.');
    }
  };

  const validateAndApplyRestore = (rawString: string) => {
    setErrorMsg(null);
    const trimmed = rawString.trim();
    if (!trimmed) {
      setErrorMsg('Data JSON masih kosong. Pilih file .json atau tempel kode backup terlebih dahulu.');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as TobaccoBackupPayload;
      const hasValidArrays =
        Array.isArray(parsed.rawTobaccos) ||
        Array.isArray(parsed.finishedBatches) ||
        Array.isArray(parsed.rollSamples) ||
        Array.isArray(parsed.packagingList) ||
        Array.isArray(parsed.factoryList);

      if (!hasValidArrays) {
        setErrorMsg(
          'Format JSON tidak dikenali sebagai Backup Tobacco Lab. Pastikan file berasal dari Backup Data JSON aplikasi ini.'
        );
        return;
      }

      onRestorePayload(parsed);
      onClose();
    } catch {
      setErrorMsg('Format teks/file JSON tidak valid atau terpotong. Pastikan seluruh isi JSON utuh.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      validateAndApplyRestore(content);
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file dari perangkat. Coba gunakan fitur Tempel (Paste) Teks JSON.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) {
        setPasteText(clip);
        setErrorMsg(null);
      }
    } catch {
      // User can manually long-press and paste into textarea
    }
  };

  const rawCount = backupData.rawTobaccos?.length || 0;
  const serialCount = backupData.finishedBatches?.length || 0;
  const rollCount = backupData.rollSamples?.length || 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[75] overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col text-white shadow-[0_24px_60px_rgba(0,0,0,0.95)] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-black text-amber-400 border border-zinc-700 shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                Backup &amp; Restore Data JSON
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">
                Kompatibel penuh untuk iPhone (Safari / Files), Android &amp; PC
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer shrink-0"
            aria-label="Tutup modal backup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="p-2.5 bg-zinc-950 border-b border-zinc-800 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('backup');
              setErrorMsg(null);
            }}
            className={`h-9 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-black text-amber-400 border border-amber-500/80'
                : 'bg-black/60 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1. Backup (Simpan Data)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('restore');
              setErrorMsg(null);
            }}
            className={`h-9 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-black text-amber-400 border border-amber-500/80'
                : 'bg-black/60 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. Restore (Muat Data)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/60 text-red-200 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'backup' ? (
            <>
              <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                  Isi Data Saat Ini yang Akan Di-Backup:
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2">
                    <div className="font-mono font-black text-sm text-white">{rawCount}</div>
                    <div className="text-[10px] text-zinc-400">Stok Bahan</div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2">
                    <div className="font-mono font-black text-sm text-amber-400">{serialCount}</div>
                    <div className="text-[10px] text-zinc-400">Seri Jadi</div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2">
                    <div className="font-mono font-black text-sm text-white">{rollCount}</div>
                    <div className="text-[10px] text-zinc-400">Gulungan</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleShareFileMobile}
                  className="btn-amber-outline w-full h-11 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Simpan ke Files iPhone / Bagikan File JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBlobFile}
                  className="w-full h-10 px-4 rounded-xl bg-black hover:bg-zinc-900 text-white border border-zinc-700 hover:border-zinc-500 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Unduh Langsung File ({fileName})</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJsonText}
                  className="w-full h-10 px-4 rounded-xl bg-black hover:bg-zinc-900 text-zinc-200 border border-zinc-800 hover:border-zinc-600 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-amber-400">Kode JSON Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Salin Teks JSON (Bisa Disimpan di Notes / WA)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] text-zinc-400 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <b>Tips untuk iPhone:</b> Tekan tombol <b>&quot;Simpan ke Files iPhone / Bagikan File JSON&quot;</b> lalu pilih <b>&quot;Save to Files&quot; (Simpan ke File)</b> atau kirim ke WhatsApp pribadi Anda sebagai cadangan.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                <div className="font-extrabold text-white text-xs">
                  Cara 1: Pilih File Backup (.json) dari HP / PC
                </div>
                <p className="text-[11px] text-zinc-400">
                  Pilih file <span className="font-mono text-zinc-200">.json</span> dari aplikasi <b>Files (iPhone)</b>, <b>File Manager (Android)</b>, atau komputer Anda:
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json,text/plain,*/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-amber-outline w-full h-11 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Pilih File Backup (.json) dari Perangkat</span>
                </button>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-extrabold text-white text-xs">
                    Cara 2: Tempel (Paste) Kode Teks JSON
                  </span>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Tempel Otomatis</span>
                  </button>
                </div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  placeholder='Tempel (Paste) kode JSON hasil "Salin Teks JSON" di sini...'
                  className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-[11px] focus:outline-hidden focus:border-amber-500/70"
                />
                <button
                  type="button"
                  onClick={() => validateAndApplyRestore(pasteText)}
                  disabled={!pasteText.trim()}
                  className="w-full h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white border border-zinc-700 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Restore Data dari Teks JSON</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-zinc-800 bg-black flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
