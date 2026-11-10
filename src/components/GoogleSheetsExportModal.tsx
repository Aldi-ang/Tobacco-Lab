import React, { useState, useEffect } from 'react';
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
  BookmarkCheck,
  Trash2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  RawTobacco,
  TobaccoRollSample,
  SavedGoogleSheetRef,
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
  extractSpreadsheetId,
} from '../utils/googleSheetsApi';

const LEGACY_GLOBAL_KEY = 'tobacco_lab_google_sheets_memory_v1';
const ACCOUNT_SHEETS_KEY_PREFIX = 'tobacco_lab_sheets_account_v2_';

interface StoredSheetsMemory {
  ownerEmail: string;
  activeTitle: string;
  activeUrl: string;
  preferredMode?: 'CREATE_NEW' | 'UPDATE_EXISTING';
  savedSheets: SavedGoogleSheetRef[];
}

function getAccountStorageKey(userEmail: string | null | undefined): string | null {
  const clean = (userEmail || '').trim().toLowerCase();
  if (!clean) return null;
  return `${ACCOUNT_SHEETS_KEY_PREFIX}${clean}`;
}

function loadAccountScopedSheetsMemory(
  userEmail: string | null | undefined,
  rollSamples: TobaccoRollSample[],
  defaultTitle: string
): StoredSheetsMemory {
  // Always remove any legacy non-account-scoped storage key so nobody else can see it
  try {
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch {
    // ignore
  }

  const normalizedEmail = (userEmail || '').trim().toLowerCase();
  // STRICT PRIVACY GATE: Never load or show any saved spreadsheet if not logged in with a Google Account
  if (!normalizedEmail) {
    return {
      ownerEmail: '',
      activeTitle: defaultTitle,
      activeUrl: '',
      preferredMode: 'CREATE_NEW',
      savedSheets: [],
    };
  }

  const cloudRollWithSheet = rollSamples.find(
    (r) =>
      r.linkedSpreadsheetUrl &&
      r.linkedSpreadsheetUrl.trim().length > 0 &&
      (!r.linkedSpreadsheetOwnerEmail ||
        r.linkedSpreadsheetOwnerEmail.trim().toLowerCase() === normalizedEmail)
  );

  const storageKey = getAccountStorageKey(normalizedEmail);
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredSheetsMemory>;
        if (
          !parsed.ownerEmail ||
          parsed.ownerEmail.trim().toLowerCase() === normalizedEmail
        ) {
          const savedList = Array.isArray(parsed.savedSheets) ? parsed.savedSheets : [];
          const activeUrl =
            parsed.activeUrl?.trim() || cloudRollWithSheet?.linkedSpreadsheetUrl || '';
          const activeTitle =
            parsed.activeTitle?.trim() ||
            cloudRollWithSheet?.linkedSpreadsheetTitle ||
            defaultTitle;

          return {
            ownerEmail: normalizedEmail,
            activeTitle,
            activeUrl,
            preferredMode:
              parsed.preferredMode || (activeUrl ? 'UPDATE_EXISTING' : 'CREATE_NEW'),
            savedSheets: savedList,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  if (cloudRollWithSheet?.linkedSpreadsheetUrl) {
    const sheetId = extractSpreadsheetId(cloudRollWithSheet.linkedSpreadsheetUrl);
    const title = cloudRollWithSheet.linkedSpreadsheetTitle || defaultTitle;
    const url = cloudRollWithSheet.linkedSpreadsheetUrl;
    return {
      ownerEmail: normalizedEmail,
      activeTitle: title,
      activeUrl: url,
      preferredMode: 'UPDATE_EXISTING',
      savedSheets: [
        {
          id: sheetId,
          title,
          url,
          lastUpdatedAt: new Date().toLocaleDateString('id-ID'),
        },
      ],
    };
  }

  return {
    ownerEmail: normalizedEmail,
    activeTitle: defaultTitle,
    activeUrl: '',
    preferredMode: 'CREATE_NEW',
    savedSheets: [],
  };
}

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rollSamples: TobaccoRollSample[];
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos: RawTobacco[];
  defaultTitle?: string;
  userEmail?: string | null;
  onSaveLinkedSpreadsheet?: (title: string, url: string) => void;
  onShowToast?: (msg: string) => void;
}

export const GoogleSheetsExportModal: React.FC<GoogleSheetsExportModalProps> = ({
  isOpen,
  onClose,
  rollSamples,
  finishedBatches,
  rawTobaccos,
  defaultTitle,
  userEmail = null,
  onSaveLinkedSpreadsheet,
  onShowToast,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const fallbackTitle =
    defaultTitle || `Tobacco Lab — Riwayat Nota & Status Seri (${todayStr})`;
  const normalizedEmail = (userEmail || '').trim().toLowerCase();

  const initialMem = loadAccountScopedSheetsMemory(
    normalizedEmail,
    rollSamples,
    fallbackTitle
  );

  const [mode, setMode] = useState<'CREATE_NEW' | 'UPDATE_EXISTING'>(
    initialMem.preferredMode || (initialMem.activeUrl ? 'UPDATE_EXISTING' : 'CREATE_NEW')
  );
  const [newSheetTitle, setNewSheetTitle] = useState<string>(initialMem.activeTitle);
  const [existingUrlOrId, setExistingUrlOrId] = useState<string>(initialMem.activeUrl);
  const [savedSheets, setSavedSheets] = useState<SavedGoogleSheetRef[]>(
    initialMem.savedSheets
  );
  const [exportScope, setExportScope] = useState<
    'ALL_TABS' | 'NOTA_HISTORY' | 'SERIAL_STATUS'
  >('ALL_TABS');

  // Re-load or clear memory whenever userEmail changes (e.g., login / logout / switch Google account)
  useEffect(() => {
    const mem = loadAccountScopedSheetsMemory(normalizedEmail, rollSamples, fallbackTitle);
    setNewSheetTitle(mem.activeTitle);
    setExistingUrlOrId(mem.activeUrl);
    setSavedSheets(mem.savedSheets);
    setMode(mem.preferredMode || (mem.activeUrl ? 'UPDATE_EXISTING' : 'CREATE_NEW'));
  }, [normalizedEmail, rollSamples, fallbackTitle]);

  // Persist to account-scoped localStorage ONLY when signed in with a Google Account
  useEffect(() => {
    const storageKey = getAccountStorageKey(normalizedEmail);
    if (!storageKey || !normalizedEmail) return;
    try {
      const payload: StoredSheetsMemory = {
        ownerEmail: normalizedEmail,
        activeTitle: newSheetTitle,
        activeUrl: existingUrlOrId,
        preferredMode: mode,
        savedSheets,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore localStorage errors
    }
  }, [normalizedEmail, newSheetTitle, existingUrlOrId, mode, savedSheets]);

  // Mandatory explicit confirmation state before updating an existing Google Spreadsheet
  const [showConfirmUpdateModal, setShowConfirmUpdateModal] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Temporary status indicator (auto-hides after 3.5 seconds instead of a big permanent panel)
  const [tempTransferStatus, setTempTransferStatus] = useState<string | null>(null);
  const [copiedQuick, setCopiedQuick] = useState<'NOTA' | 'SERI' | 'LINK' | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  if (!isOpen) return null;

  const triggerTemporaryTransferStatus = (msg: string) => {
    setTempTransferStatus(msg);
    if (onShowToast) {
      onShowToast(msg);
    }
    setTimeout(() => {
      setTempTransferStatus(null);
    }, 3800);
  };

  const rememberSpreadsheetEntry = (title: string, url: string) => {
    // Only remember when signed into a Google Account
    if (!normalizedEmail) return;

    const cleanTitle = title.trim() || fallbackTitle;
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const id = extractSpreadsheetId(cleanUrl);
    const fullUrl = cleanUrl.startsWith('http')
      ? cleanUrl
      : `https://docs.google.com/spreadsheets/d/${id}/edit`;

    const nowLabel = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    setNewSheetTitle(cleanTitle);
    setExistingUrlOrId(fullUrl);
    setSavedSheets((prev) => {
      const filtered = prev.filter((item) => item.id !== id && item.url !== fullUrl);
      return [
        {
          id,
          title: cleanTitle,
          url: fullUrl,
          lastUpdatedAt: nowLabel,
        },
        ...filtered,
      ].slice(0, 10);
    });

    if (onSaveLinkedSpreadsheet) {
      onSaveLinkedSpreadsheet(cleanTitle, fullUrl);
    }
  };

  const handleManualSaveMemory = () => {
    if (!normalizedEmail) {
      setErrorMsg('Silakan login dengan Akun Google terlebih dahulu agar Nama & Link Spreadsheet disimpan khusus untuk akun Anda.');
      return;
    }
    if (!existingUrlOrId.trim() && !newSheetTitle.trim()) return;
    if (existingUrlOrId.trim()) {
      rememberSpreadsheetEntry(newSheetTitle, existingUrlOrId);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  };

  const handleRemoveSavedSheet = (idOrUrl: string) => {
    setSavedSheets((prev) =>
      prev.filter((item) => item.id !== idOrUrl && item.url !== idOrUrl)
    );
  };

  const ensureToken = async (): Promise<string> => {
    const existing = getAccessToken();
    if (existing) return existing;
    const authRes = await googleSignInForSheets();
    return authRes.accessToken;
  };

  const handleCreateNewSheet = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const token = await ensureToken();
      const targetTitle =
        newSheetTitle.trim() || `Tobacco Lab — Riwayat Nota & Status Seri (${todayStr})`;
      const res = await createGoogleSpreadsheetWithData({
        accessToken: token,
        spreadsheetTitle: targetTitle,
        rollSamples,
        finishedBatches,
        rawTobaccos,
      });

      // Automatically remember the newly created Spreadsheet Name & Link for this Google Account
      rememberSpreadsheetEntry(res.title, res.spreadsheetUrl);
      setMode('UPDATE_EXISTING');
      triggerTemporaryTransferStatus(`Transfer selesai! "${res.title}" berhasil dibuat.`);
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

      const effectiveTitle =
        newSheetTitle.trim() && newSheetTitle.trim() !== fallbackTitle
          ? newSheetTitle.trim()
          : res.spreadsheetTitle || newSheetTitle.trim() || fallbackTitle;

      // Automatically remember the updated Spreadsheet Name & Link for this Google Account
      rememberSpreadsheetEntry(effectiveTitle, res.spreadsheetUrl);
      triggerTemporaryTransferStatus(`Transfer selesai! "${effectiveTitle}" berhasil diperbarui.`);
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
    const tsv = matrix
      .map((r) =>
        r
          .map((c) =>
            String(c ?? '')
              .replace(/\n/g, ' ')
              .trim()
          )
          .join('\t')
      )
      .join('\n');
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
            const s = String(c ?? '').replace(/\n/g, ' ').trim();
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
      `tobacco_lab_${kind === 'NOTA' ? 'riwayat_nota_gulungan' : 'status_semua_seri'}_${todayStr}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const hasToken = !!getAccessToken();
  const activeFullUrl = existingUrlOrId.trim()
    ? existingUrlOrId.trim().startsWith('http')
      ? existingUrlOrId.trim()
      : `https://docs.google.com/spreadsheets/d/${extractSpreadsheetId(existingUrlOrId)}/edit`
    : '';

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
          {/* Header with Compact Redirect Link Button & Temporary Transfer Toast */}
          <div className="px-4 py-3 border-b border-zinc-800 bg-black flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-black border border-amber-500 flex items-center justify-center text-amber-400 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400 block">
                  INTEGRASI GOOGLE SHEETS RESMI
                </span>
                <h2 className="text-xs sm:text-sm font-black text-white truncate">
                  Transfer Riwayat Nota, Grafik &amp; Status Seri
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Small Compact Redirect Button to Open Saved Sheet */}
              {activeFullUrl && (
                <a
                  href={activeFullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Buka "${newSheetTitle || 'Spreadsheet'}" di Google Sheets`}
                  className="h-7 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/60 font-extrabold text-[11px] inline-flex items-center gap-1 max-w-[180px]"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    Buka {newSheetTitle ? `"${newSheetTitle}"` : 'Sheet'}
                  </span>
                </a>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
                aria-label="Tutup modal Google Sheets"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Temporary Auto-Hiding Transfer Status Strip */}
          <AnimatePresence>
            {tempTransferStatus && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-amber-500/15 border-b border-amber-500/50 px-4 py-2 flex items-center justify-between gap-2 text-xs"
              >
                <span className="inline-flex items-center gap-1.5 font-extrabold text-amber-300 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{tempTransferStatus}</span>
                </span>
                {activeFullUrl && (
                  <a
                    href={activeFullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-6 px-2 rounded bg-black text-amber-400 border border-amber-500/60 font-bold text-[10px] inline-flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    <span>Buka</span>
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
            {/* Connection status / Sign in with Google button */}
            <div className="bg-black p-3 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5 min-w-0">
                <div className="font-extrabold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Status Google Sheets:{' '}
                    {hasToken ? (
                      <b className="text-amber-400">Terhubung &amp; Siap Transfer</b>
                    ) : (
                      <b className="text-zinc-300">Perlu Konfirmasi Akun Google</b>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {userEmail ? (
                    <>
                      Akun: <b className="text-amber-300">{userEmail}</b> (Nama &amp; Link Spreadsheet terkunci khusus akun ini)
                    </>
                  ) : (
                    <>
                      Login Google agar Nama &amp; Link Spreadsheet pribadi Anda diingat secara aman.
                    </>
                  )}
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
                  className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs shadow-md transition-all cursor-pointer shrink-0"
                >
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="w-3.5 h-3.5 block shrink-0"
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

            {/* Compact Single-Line Saved Spreadsheet Bar — ONLY visible when logged into the owner's Google Account */}
            {normalizedEmail && activeFullUrl && (
              <div className="bg-black px-3 py-2 rounded-xl border border-amber-500/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[11px] text-zinc-400 shrink-0">Sheet Aktif:</span>
                  <b className="text-white text-xs truncate">
                    {newSheetTitle || fallbackTitle}
                  </b>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeFullUrl);
                      setCopiedQuick('LINK');
                      setTimeout(() => setCopiedQuick(null), 2000);
                    }}
                    className="h-6 px-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                    title="Salin Link Google Sheet"
                  >
                    {copiedQuick === 'LINK' ? (
                      <>
                        <Check className="w-3 h-3 text-amber-400" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-amber-400" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                  <a
                    href={activeFullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-6 px-2.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/60 font-extrabold text-[10px] inline-flex items-center gap-1 max-w-[165px]"
                    title={`Buka "${newSheetTitle || 'Sheet'}" di Google Sheets`}
                  >
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">Buka di Sheets</span>
                  </a>
                </div>
              </div>
            )}

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
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-amber-400 block mb-1">
                    Judul Google Spreadsheet Baru {userEmail ? `(Diingat untuk ${userEmail})` : ''}
                  </label>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="Contoh: Tobacco Lab — Riwayat Nota & Status Seri"
                    className="w-full h-9 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/90 space-y-1 text-[11px] text-zinc-300">
                  <div className="font-bold text-white">Isi 4 Sheet Tabel Rapi yang Dibuat Otomatis:</div>
                  <div>• <b>Tab 1 (Riwayat Nota Gulungan)</b>: Tabel bergaris lengkap, header 2 baris vertikal + text-wrap otomatis.</div>
                  <div>• <b>Tab 2 (Ringkasan &amp; Grafik Profit)</b>: <b className="text-amber-400">Grafik Total Gulungan &amp; Per Pabrik</b> (Pendapatan vs Modal vs Profit vs Reject).</div>
                  <div>• <b>Tab 3 (Status Semua Seri)</b>: Status Diterima/Accepted (Cair / Belum Cair), Reject, &amp; jejak ganti seri.</div>
                  <div>• <b>Tab 4 (Stok Bahan Mentah)</b>: Data stok gudang, Total Kita Bayar, Nilai Riil, &amp; Selisih Timbangan.</div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleCreateNewSheet}
                  className="btn-amber-outline w-full h-9 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuat Tabel &amp; Grafik di Google Sheet...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Buat &amp; Simpan Link Google Sheet Baru</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[11px] font-bold text-amber-400 block">
                      Nama Spreadsheet Tujuan {userEmail ? `(${userEmail})` : ''}
                    </label>
                    {activeFullUrl && (
                      <a
                        href={activeFullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-amber-400 hover:underline inline-flex items-center gap-1 max-w-[200px] truncate"
                        title={`Buka "${newSheetTitle || 'Spreadsheet'}" di Google Sheets`}
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          Buka &quot;{newSheetTitle || 'Sheet'}&quot;
                        </span>
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="Contoh: Tobacco Lab — Riwayat Nota & Status Seri"
                    className="w-full h-9 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-semibold focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[11px] font-bold text-amber-400 block">
                      Link URL atau ID Google Spreadsheet Tujuan
                    </label>
                    {normalizedEmail && (
                      <button
                        type="button"
                        onClick={handleManualSaveMemory}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                        title="Simpan Nama & Link Spreadsheet ini khusus untuk Akun Google Anda"
                      >
                        {savedNotice ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Tersimpan!</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3" />
                            <span>Simpan Link</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={existingUrlOrId}
                      onChange={(e) => setExistingUrlOrId(e.target.value)}
                      placeholder="Tempel link https://docs.google.com/spreadsheets/d/..."
                      className="w-full h-9 pl-8 pr-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Data yang Ingin Ditransfer &amp; Dirapikan Formatnya
                  </label>
                  <select
                    value={exportScope}
                    onChange={(e) => setExportScope(e.target.value as any)}
                    className="w-full h-9 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-amber-400 font-bold focus:outline-hidden focus:border-amber-500"
                    aria-label="Pilih Cakupan Data Transfer"
                  >
                    <option value="ALL_TABS">
                      Semua Data (4 Tab: Riwayat Nota + Grafik Total/Pabrik + Status Seri + Stok)
                    </option>
                    <option value="NOTA_HISTORY">
                      Tab Riwayat Nota + Grafik Total Gulungan &amp; Per Pabrik ({rollSamples.length} Gulungan)
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
                  className="btn-amber-outline w-full h-9 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memperbarui Data, Tabel &amp; Grafik...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Transfer &amp; Perbarui Google Spreadsheet</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/70 text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-red-300">Kendala Transfer Google Sheets</div>
                  <p className="text-[11px] leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Tidy 2-Column Stacked Quick Copy TSV & CSV Fallback (Screenshot 2 Fix) */}
            <div className="bg-black p-3.5 sm:p-4 rounded-xl border border-zinc-800 space-y-3">
              <div className="text-[11px] font-extrabold text-zinc-200 uppercase tracking-wider">
                Alternatif Cepat (Copy-Paste Langsung / Unduh File CSV):
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Card 1: Riwayat Nota Gulungan (Salin on top, Unduh CSV right below) */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 flex flex-col justify-between">
                  <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    1. Data Riwayat Nota ({rollSamples.length} Gulungan)
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickCopyTsv('NOTA')}
                      className="w-full h-9 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 hover:border-amber-500/60 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      {copiedQuick === 'NOTA' ? (
                        <>
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>Salin Riwayat Nota</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDownloadCsv('NOTA')}
                      className="w-full h-8 px-3 rounded-lg bg-black hover:bg-zinc-900 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-600 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      title="Unduh CSV Riwayat Nota Gulungan"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Unduh CSV Riwayat Nota</span>
                    </button>
                  </div>
                </div>

                {/* Card 2: Status Semua Seri (Salin on top, Unduh CSV right below) */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 flex flex-col justify-between">
                  <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    2. Data Status Seri ({finishedBatches.length} Nomor Seri)
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickCopyTsv('SERI')}
                      className="w-full h-9 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 hover:border-amber-500/60 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      {copiedQuick === 'SERI' ? (
                        <>
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>Salin Status Seri</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDownloadCsv('SERI')}
                      className="w-full h-8 px-3 rounded-lg bg-black hover:bg-zinc-900 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-600 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      title="Unduh CSV Status Semua Seri"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Unduh CSV Status Seri</span>
                    </button>
                  </div>
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
                    Apakah Anda yakin ingin menuliskan / memperbarui data pada Google Spreadsheet <b className="text-white">"{newSheetTitle || 'Spreadsheet Tujuan'}"</b> ({rollSamples.length} Gulungan &amp; {finishedBatches.length} Nomor Seri)? Data pada tab tujuan akan diperbarui sesuai data terbaru aplikasi.
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
