import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Grid3X3,
  Hash,
  Layers,
  Loader2,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import { PackagingMaster, RawTobacco } from '../types/tobacco';
import {
  buildWarehouseMasterDictionary,
  generateNextLotBatchNumbers,
  normalizeLotNumber,
} from '../utils/gradeCardEngine';
import {
  A4_PRINT_PAGE_METRICS,
  DuplexMode,
  PrintPaperFormat,
  arrangeDuplexBackSlots,
  buildDynamicPrintPageCss,
  isThermalPaperFormat,
} from '../utils/thermalPrintEngine';
import {
  PRINT_PREFIX_REGISTRY_STORAGE_KEY,
  PrefixRegistryState,
  getPrefixStartSequence,
  loadPrefixRegistryState,
  mergeRegistryWithDiscoveredPrefixes,
  normalizePrefixInput,
  recordPrintedBatchToPrefixRegistry,
  registerNewPrefix,
  removeRegisteredPrefix,
  savePrefixRegistryState,
  selectActivePrefix,
  setPrefixStartSequence,
} from '../utils/prefixRegistryEngine';
import {
  GRADER_REGISTRY_STORAGE_KEY,
  GraderRegistryState,
  loadGraderRegistryState,
  registerGraderName,
  removeRegisteredGraderName,
  sanitizePrintYear,
  saveGraderRegistryState,
  selectActiveGraderName,
} from '../utils/graderRegistryEngine';
import {
  formatPaperSummaryLabel,
  loadPrintPreferences,
  savePrintPreferences,
} from '../utils/printPreferences';
import {
  ISSUED_PRINT_LOTS_STORAGE_KEY,
  LockedBatchSnapshot,
  PendingPrintBatch,
  ReprintMode,
  buildReprintSlotPlan,
  confirmPendingBatchLock,
  createPendingPrintBatch,
  loadIssuedPrintedLots,
  loadLastLockedBatch,
  loadPendingPrintBatch,
  parseReprintLotCodes,
  resolveActiveBatchLots,
  saveIssuedPrintedLots,
  saveLastLockedBatch,
  savePendingPrintBatch,
  snapPrintCountForFormat,
  unlockLastLockedBatch,
} from '../utils/printBatchLockEngine';
import { generateA4GradeCardsPdf } from '../utils/a4PdfExportEngine';
import {
  ReprintReasonCode,
  buildPrefixAuditGridBlock,
  buildPrefixAuditLedgers,
  detectPreviousPrefixHistory,
  evaluateReprintWarnings,
  isReprintSafetySatisfied,
} from '../utils/prefixAuditLedger';
import {
  PrintableGradeCardBackPaper,
  PrintableGradeCardPaper,
  ThermalGradeCardPaper,
} from './PrintableGradeCards';
import {
  DeleteConfirmWarning,
  PrefixHistoryResumeNotice,
  PrintErrorWarning,
  ReprintSafetyWarning,
} from './PrintWarningBanner';

interface GradeCardPrintPanelProps {
  isOpen: boolean;
  onClose: () => void;
  rawTobaccos: RawTobacco[];
  packagingList: PackagingMaster[];
  onShowToast?: (msg: string) => void;
  onSwitchToScanner?: () => void;
}

const A4_COUNT_PRESETS = [6, 12, 18, 24, 30, 36] as const;
const THERMAL_COUNT_PRESETS = [1, 4, 6, 12, 24] as const;

export const GradeCardPrintPanel: React.FC<GradeCardPrintPanelProps> = ({
  isOpen,
  onClose,
  rawTobaccos,
  packagingList,
  onShowToast,
  onSwitchToScanner,
}) => {
  const initialPrintPrefs = useMemo(() => loadPrintPreferences(), []);

  // Top-level Print Station Mode: 'new' (Batch Serial Issuing) vs 'reprint' (Damaged/Lost Recovery)
  const [printModeTab, setPrintModeTab] = useState<'new' | 'reprint'>('new');

  // Paper & Printer Setup
  const [paperFormat, setPaperFormat] = useState<PrintPaperFormat>(initialPrintPrefs.paperFormat);
  const [printCount, setPrintCount] = useState<number>(() =>
    snapPrintCountForFormat(initialPrintPrefs.printCount, initialPrintPrefs.paperFormat)
  );
  const [duplexMode, setDuplexMode] = useState<DuplexMode>(initialPrintPrefs.duplexMode);
  const [includeThermalBarcode, setIncludeThermalBarcode] = useState<boolean>(
    initialPrintPrefs.includeThermalBarcode
  );
  const [showPaperSetup, setShowPaperSetup] = useState<boolean>(false);

  // Grader & Print Year
  const [printYear, setPrintYear] = useState<number>(initialPrintPrefs.printYear);
  const [printYearDraft, setPrintYearDraft] = useState<string>(String(initialPrintPrefs.printYear));
  const [graderRegistryRaw, setGraderRegistryRaw] = useState<GraderRegistryState>(() =>
    loadGraderRegistryState()
  );
  const [isAddingGrader, setIsAddingGrader] = useState(false);
  const [newGraderDraft, setNewGraderDraft] = useState('');
  const [pendingDeleteGrader, setPendingDeleteGrader] = useState<string | null>(null);

  // Prefix Registry & Issued Lots
  const [issuedPrintedLots, setIssuedPrintedLots] = useState<string[]>(() =>
    loadIssuedPrintedLots()
  );
  const [prefixRegistryRaw, setPrefixRegistryRaw] = useState<PrefixRegistryState>(() =>
    loadPrefixRegistryState()
  );
  const [isAddingPrefix, setIsAddingPrefix] = useState(false);
  const [newPrefixDraft, setNewPrefixDraft] = useState('');
  const [newPrefixStartSeqDraft, setNewPrefixStartSeqDraft] = useState('');
  const [pendingDeletePrefix, setPendingDeletePrefix] = useState<string | null>(null);
  const [showSkipNumber, setShowSkipNumber] = useState(false);
  const [skipStartSeqDraft, setSkipStartSeqDraft] = useState('');

  // Pending Print Batch Lock & Retry State
  const [pendingPrintBatch, setPendingPrintBatch] = useState<PendingPrintBatch | null>(() =>
    loadPendingPrintBatch()
  );
  const [lastLockedBatch, setLastLockedBatch] = useState<LockedBatchSnapshot | null>(() =>
    loadLastLockedBatch()
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [printPdfError, setPrintPdfError] = useState<string | null>(null);

  // Reprint Recovery State
  const [reprintModeType, setReprintModeType] = useState<ReprintMode>('SLOT_TERPILIH');
  const [reprintLotsInput, setReprintLotsInput] = useState('');
  const [reprintReason, setReprintReason] = useState<ReprintReasonCode | null>(null);
  const [reprintWarningConfirmed, setReprintWarningConfirmed] = useState(false);
  const [selectedSlotIndexes, setSelectedSlotIndexes] = useState<number[]>([0]);

  // 100-Number Read-Only Audit Portal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditSelectedPrefixKey, setAuditSelectedPrefixKey] = useState<string>('');
  const [auditBlockIndex, setAuditBlockIndex] = useState<number>(0);

  const effectivePrintCount = snapPrintCountForFormat(printCount, paperFormat);
  const activeGraderName = graderRegistryRaw.lastSelectedGrader;
  const isThermalMode = isThermalPaperFormat(paperFormat);
  const cardsPerA4Page = 6 as const;

  useEffect(() => {
    savePrintPreferences({
      paperFormat,
      duplexMode,
      printCount: effectivePrintCount,
      includeThermalBarcode,
      hasCustomizedBefore: true,
      printYear,
    });
  }, [paperFormat, duplexMode, effectivePrintCount, includeThermalBarcode, printYear]);

  // Keep registries synced across tabs
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === ISSUED_PRINT_LOTS_STORAGE_KEY) {
        setIssuedPrintedLots(loadIssuedPrintedLots());
      } else if (ev.key === PRINT_PREFIX_REGISTRY_STORAGE_KEY) {
        setPrefixRegistryRaw(loadPrefixRegistryState());
      } else if (ev.key === GRADER_REGISTRY_STORAGE_KEY) {
        setGraderRegistryRaw(loadGraderRegistryState());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAuditModalOpen) {
          setIsAuditModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isAuditModalOpen, onClose]);

  const prefixRegistry = useMemo(
    () =>
      mergeRegistryWithDiscoveredPrefixes(
        prefixRegistryRaw,
        rawTobaccos,
        issuedPrintedLots
      ),
    [prefixRegistryRaw, rawTobaccos, issuedPrintedLots]
  );

  const customLotPrefix = prefixRegistry.lastSelectedPrefix;
  const activeMinStartSeq = useMemo(
    () => getPrefixStartSequence(prefixRegistry, customLotPrefix) ?? 1,
    [prefixRegistry, customLotPrefix]
  );

  useEffect(() => {
    const saved = getPrefixStartSequence(prefixRegistry, customLotPrefix);
    setSkipStartSeqDraft(saved ? String(saved) : '');
  }, [prefixRegistry, customLotPrefix]);

  const persistPrefixRegistry = (next: PrefixRegistryState) => {
    savePrefixRegistryState(next);
    setPrefixRegistryRaw(next);
  };

  const persistGraderRegistry = (next: GraderRegistryState) => {
    saveGraderRegistryState(next);
    setGraderRegistryRaw(next);
  };

  const masterDict = useMemo(
    () =>
      buildWarehouseMasterDictionary(
        rawTobaccos,
        packagingList,
        graderRegistryRaw.registeredGraders
      ),
    [rawTobaccos, packagingList, graderRegistryRaw.registeredGraders]
  );

  const parsedReprintLots = useMemo(
    () => (printModeTab === 'reprint' ? parseReprintLotCodes(reprintLotsInput) : []),
    [printModeTab, reprintLotsInput]
  );

  const reprintWarning = useMemo(
    () =>
      evaluateReprintWarnings({
        reprintLots: parsedReprintLots,
        rawTobaccos,
        issuedPrintedLots,
      }),
    [parsedReprintLots, rawTobaccos, issuedPrintedLots]
  );

  const parsedReprintSignature = parsedReprintLots.join(',');
  useEffect(() => {
    setReprintWarningConfirmed(false);
    setReprintReason(null);
  }, [parsedReprintSignature]);

  const isReprintAllowed = useMemo(
    () =>
      isReprintSafetySatisfied({
        warning: reprintWarning,
        reason: reprintReason,
        confirmed: reprintWarningConfirmed,
      }),
    [reprintWarning, reprintReason, reprintWarningConfirmed]
  );

  const prefixAuditLedgers = useMemo(
    () =>
      buildPrefixAuditLedgers({
        rawTobaccos,
        issuedPrintedLots,
        prefixRegistry,
      }),
    [rawTobaccos, issuedPrintedLots, prefixRegistry]
  );

  const activeAuditLedgerIndex = useMemo(() => {
    if (prefixAuditLedgers.length === 0) return -1;
    const byExplicit = prefixAuditLedgers.findIndex(
      (l) => l.prefixKey === auditSelectedPrefixKey
    );
    if (byExplicit >= 0) return byExplicit;
    const activeNorm = normalizePrefixInput(customLotPrefix);
    if (activeNorm) {
      const byCustom = prefixAuditLedgers.findIndex((l) => l.prefixKey === activeNorm);
      if (byCustom >= 0) return byCustom;
    }
    return 0;
  }, [prefixAuditLedgers, auditSelectedPrefixKey, customLotPrefix]);

  const activeAuditLedger =
    activeAuditLedgerIndex >= 0 ? prefixAuditLedgers[activeAuditLedgerIndex] : null;

  const activeAuditGridBlock = useMemo(() => {
    if (!activeAuditLedger) return null;
    return buildPrefixAuditGridBlock({
      ledger: activeAuditLedger,
      rawTobaccos,
      issuedPrintedLots,
      prefixRegistry,
      blockIndex: auditBlockIndex,
    });
  }, [activeAuditLedger, rawTobaccos, issuedPrintedLots, prefixRegistry, auditBlockIndex]);

  const getDefaultBlockIndexForLedger = (ledger: (typeof prefixAuditLedgers)[number] | null) => {
    if (!ledger) return 0;
    const peak = Math.max(1, ledger.highestSeq, ledger.minStartSeq);
    return peak > 100 ? Math.floor((peak - 1) / 100) : 0;
  };

  const handleOpenAuditModal = () => {
    const activeNorm = normalizePrefixInput(customLotPrefix);
    const targetLedger =
      (activeNorm && prefixAuditLedgers.find((l) => l.prefixKey === activeNorm)) ||
      prefixAuditLedgers[0] ||
      null;
    if (targetLedger) {
      setAuditSelectedPrefixKey(targetLedger.prefixKey);
      setAuditBlockIndex(getDefaultBlockIndexForLedger(targetLedger));
    } else {
      setAuditBlockIndex(0);
    }
    setIsAuditModalOpen(true);
  };

  const handleSelectAuditPrefix = (prefixKey: string) => {
    const target = prefixAuditLedgers.find((l) => l.prefixKey === prefixKey) || null;
    setAuditSelectedPrefixKey(prefixKey);
    setAuditBlockIndex(getDefaultBlockIndexForLedger(target));
  };

  const handleStepAuditPrefix = (delta: -1 | 1) => {
    if (prefixAuditLedgers.length <= 1 || activeAuditLedgerIndex < 0) return;
    const nextIdx =
      (activeAuditLedgerIndex + delta + prefixAuditLedgers.length) % prefixAuditLedgers.length;
    const target = prefixAuditLedgers[nextIdx];
    setAuditSelectedPrefixKey(target.prefixKey);
    setAuditBlockIndex(getDefaultBlockIndexForLedger(target));
  };

  const newPrefixDetection = useMemo(
    () =>
      isAddingPrefix
        ? detectPreviousPrefixHistory({
            rawPrefix: newPrefixDraft,
            rawTobaccos,
            issuedPrintedLots,
            prefixRegistry,
          })
        : null,
    [isAddingPrefix, newPrefixDraft, rawTobaccos, issuedPrintedLots, prefixRegistry]
  );

  const reprintFreshNeededCount = useMemo(() => {
    if (parsedReprintLots.length === 0) return effectivePrintCount;
    if (reprintModeType === 'SLOT_TERPILIH') return 0;
    const minPages = isThermalMode ? parsedReprintLots.length : Math.ceil(parsedReprintLots.length / 6);
    const totalSlots = isThermalMode
      ? Math.max(parsedReprintLots.length, effectivePrintCount)
      : Math.max(effectivePrintCount, minPages * 6);
    return Math.max(0, totalSlots - parsedReprintLots.length);
  }, [parsedReprintLots, reprintModeType, isThermalMode, effectivePrintCount]);

  const generatedBatchNumbers = useMemo(
    () =>
      generateNextLotBatchNumbers(
        rawTobaccos,
        Math.max(effectivePrintCount, reprintFreshNeededCount),
        customLotPrefix,
        issuedPrintedLots,
        activeMinStartSeq
      ),
    [
      rawTobaccos,
      effectivePrintCount,
      reprintFreshNeededCount,
      customLotPrefix,
      issuedPrintedLots,
      activeMinStartSeq,
    ]
  );

  const { lots: freshLotsForBatch, isRetryingPending } = useMemo(
    () =>
      resolveActiveBatchLots({
        pendingBatch: pendingPrintBatch,
        generatedBatchLots: generatedBatchNumbers,
        activePrefix: customLotPrefix,
        requestedCount: reprintFreshNeededCount,
      }),
    [pendingPrintBatch, generatedBatchNumbers, customLotPrefix, reprintFreshNeededCount]
  );

  const effectiveSelectedSlotIndexes = useMemo(() => {
    const cap = Math.max(1, parsedReprintLots.length);
    return selectedSlotIndexes.slice(-cap);
  }, [selectedSlotIndexes, parsedReprintLots.length]);

  const activeReprintPlan = useMemo(
    () =>
      buildReprintSlotPlan({
        mode: printModeTab === 'reprint' ? reprintModeType : 'GABUNG_BARU',
        reprintLots: parsedReprintLots,
        selectedSlotIndexes: effectiveSelectedSlotIndexes,
        generatedFreshLots: freshLotsForBatch,
        requestedCount: effectivePrintCount,
        paperFormat,
      }),
    [
      printModeTab,
      reprintModeType,
      parsedReprintLots,
      effectiveSelectedSlotIndexes,
      freshLotsForBatch,
      effectivePrintCount,
      paperFormat,
    ]
  );

  // If in 'reprint' tab with no lot codes selected yet, preview shows empty prompt instead of new sequence
  const isWaitingReprintInput = printModeTab === 'reprint' && parsedReprintLots.length === 0;
  const activePrintSlots = isWaitingReprintInput ? [] : activeReprintPlan.slots;
  const lotBatchNumbers = useMemo(
    () => activePrintSlots.filter((l): l is string => Boolean(l)),
    [activePrintSlots]
  );
  const freshLotsToLock = isWaitingReprintInput ? [] : activeReprintPlan.freshLotsToLock;
  const blankUnusedSlots = activeReprintPlan.blankUnusedSlots;

  const recentPrintableLotsForChips = useMemo(() => {
    const allUnique = Array.from(
      new Set([
        ...issuedPrintedLots.slice().reverse(),
        ...rawTobaccos.map((t) => normalizeLotNumber(t.lotNumber)).filter(Boolean),
      ])
    );
    if (customLotPrefix) {
      const matching = allUnique.filter((lot) => lot.startsWith(customLotPrefix));
      const others = allUnique.filter((lot) => !lot.startsWith(customLotPrefix));
      return [...matching, ...others].slice(0, 12);
    }
    return allUnique.slice(0, 12);
  }, [issuedPrintedLots, rawTobaccos, customLotPrefix]);

  const a4Pages = useMemo(() => {
    const pages: (string | null)[][] = [];
    for (let i = 0; i < activePrintSlots.length; i += cardsPerA4Page) {
      pages.push(activePrintSlots.slice(i, i + cardsPerA4Page));
    }
    return pages;
  }, [activePrintSlots]);

  const totalA4SheetPages =
    duplexMode === 'OFF' ? a4Pages.length : a4Pages.length * 2;

  const handleChangePaperFormat = (nextFormat: PrintPaperFormat) => {
    setPaperFormat(nextFormat);
    setPrintCount((prev) => snapPrintCountForFormat(prev, nextFormat));
  };

  const handleSelectSavedGrader = (grader: string) => {
    setPendingDeleteGrader(null);
    persistGraderRegistry(selectActiveGraderName(graderRegistryRaw, grader));
  };

  const handleRegisterNewGraderSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { nextState, normalizedName } = registerGraderName(
      graderRegistryRaw,
      newGraderDraft
    );
    if (!normalizedName) {
      onShowToast?.('Masukkan nama grader terlebih dahulu.');
      return;
    }
    persistGraderRegistry(nextState);
    setNewGraderDraft('');
    setIsAddingGrader(false);
    setPendingDeleteGrader(null);
    onShowToast?.(`Grader "${normalizedName}" dipilih untuk cetak kartu.`);
  };

  const handleConfirmRemoveSavedGrader = () => {
    if (!pendingDeleteGrader) return;
    const target = pendingDeleteGrader;
    persistGraderRegistry(removeRegisteredGraderName(graderRegistryRaw, target));
    setPendingDeleteGrader(null);
    onShowToast?.(`Grader "${target}" dihapus dari daftar.`);
  };

  const handleCommitPrintYear = (rawVal: string) => {
    const clean = sanitizePrintYear(rawVal, printYear);
    setPrintYear(clean);
    setPrintYearDraft(String(clean));
  };

  const handleToggleSlotIndex = (slotIdx: number) => {
    const neededCount = Math.max(1, parsedReprintLots.length);
    if (neededCount <= 1) {
      setSelectedSlotIndexes([slotIdx]);
      return;
    }
    setSelectedSlotIndexes((prev) => {
      const normalized = prev.slice(-neededCount);
      if (normalized.includes(slotIdx)) {
        return normalized.length > 1 ? normalized.filter((s) => s !== slotIdx) : normalized;
      }
      if (normalized.length >= neededCount) {
        return [...normalized.slice(normalized.length - neededCount + 1), slotIdx].sort(
          (a, b) => a - b
        );
      }
      return [...normalized, slotIdx].sort((a, b) => a - b);
    });
  };

  const handleToggleReprintChip = (lotCode: string) => {
    const curr = parseReprintLotCodes(reprintLotsInput);
    const next = curr.includes(lotCode)
      ? curr.filter((x) => x !== lotCode)
      : [...curr, lotCode];
    setReprintLotsInput(next.join(', '));
  };

  const handleLoadLotForRedownloadFromLedger = (lotCode: string) => {
    setIsAuditModalOpen(false);
    setPrintModeTab('reprint');
    setReprintModeType('SLOT_TERPILIH');
    const curr = parseReprintLotCodes(reprintLotsInput);
    const next = curr.includes(lotCode) ? curr : [...curr, lotCode];
    setReprintLotsInput(next.join(', '));
    setReprintWarningConfirmed(false);
    setReprintReason(null);
    setPrintPdfError(null);
    onShowToast?.(`Lot ${lotCode} dimuat ke Cetak Ulang — pilih alasan & konfirmasi peringatan.`);
  };

  const handleSelectSavedPrefix = (prefix: string) => {
    setPendingDeletePrefix(null);
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

    const priorHistory = detectPreviousPrefixHistory({
      rawPrefix: cleaned,
      rawTobaccos,
      issuedPrintedLots,
      prefixRegistry,
    });

    const rawSeq = parseInt(newPrefixStartSeqDraft.trim(), 10);
    let startSeq: number | undefined =
      Number.isFinite(rawSeq) && rawSeq >= 2 ? rawSeq : undefined;

    if (priorHistory?.hasPreviousData && startSeq !== undefined) {
      startSeq = Math.max(startSeq, priorHistory.nextContinueSeq);
    }

    const { nextState, normalizedPrefix } = registerNewPrefix(
      prefixRegistry,
      cleaned,
      startSeq
    );
    persistPrefixRegistry(nextState);
    if (startSeq !== undefined) {
      setPendingPrintBatch(null);
      savePendingPrintBatch(null);
    }
    setPendingDeletePrefix(null);
    setNewPrefixDraft('');
    setNewPrefixStartSeqDraft('');
    setIsAddingPrefix(false);

    if (normalizedPrefix) {
      if (priorHistory?.hasPreviousData) {
        const resumeSeq = startSeq ?? priorHistory.nextContinueSeq;
        const resumeLot = `${normalizedPrefix}${String(resumeSeq).padStart(3, '0')}`;
        onShowToast?.(
          `Prefix "${normalizedPrefix}" dipulihkan & otomatis lanjut dari ${resumeLot}.`
        );
      } else {
        onShowToast?.(
          startSeq
            ? `Prefix "${normalizedPrefix}" terdaftar mulai #${String(startSeq).padStart(3, '0')}.`
            : `Prefix "${normalizedPrefix}" terdaftar & aktif.`
        );
      }
    }
  };

  const handleRestoreDeletedPrefix = (targetPrefix: string) => {
    const priorHistory = detectPreviousPrefixHistory({
      rawPrefix: targetPrefix,
      rawTobaccos,
      issuedPrintedLots,
      prefixRegistry,
    });
    const { nextState, normalizedPrefix } = registerNewPrefix(prefixRegistry, targetPrefix);
    persistPrefixRegistry(nextState);
    setPendingDeletePrefix(null);
    onShowToast?.(
      priorHistory?.hasPreviousData
        ? `Prefix "${normalizedPrefix}" aktif kembali — lanjut dari ${priorHistory.nextContinueLot}.`
        : `Prefix "${normalizedPrefix}" aktif kembali.`
    );
  };

  const handleConfirmRemoveSavedPrefix = () => {
    if (!pendingDeletePrefix) return;
    const target = pendingDeletePrefix;
    const next = removeRegisteredPrefix(prefixRegistry, target);
    persistPrefixRegistry(next);
    if (pendingPrintBatch && normalizePrefixInput(pendingPrintBatch.prefix) === target) {
      setPendingPrintBatch(null);
      savePendingPrintBatch(null);
    }
    setPendingDeletePrefix(null);
    onShowToast?.(
      `Prefix "${target}" dihapus dari daftar cepat (riwayat Audit tetap tersimpan).`
    );
  };

  const handleApplySkipStartSequence = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseInt(skipStartSeqDraft.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 2) {
      onShowToast?.('Masukkan angka mulai minimal 2 (contoh: 19).');
      return;
    }
    const next = setPrefixStartSequence(prefixRegistry, customLotPrefix, parsed);
    persistPrefixRegistry(next);
    setPendingPrintBatch(null);
    savePendingPrintBatch(null);
    setShowSkipNumber(false);
    onShowToast?.(
      `Urutan "${customLotPrefix || 'Harian'}" diatur mulai dari #${String(parsed).padStart(3, '0')}.`
    );
  };

  const handleResetSkipStartSequence = () => {
    const next = setPrefixStartSequence(prefixRegistry, customLotPrefix, null);
    persistPrefixRegistry(next);
    setPendingPrintBatch(null);
    savePendingPrintBatch(null);
    setSkipStartSeqDraft('');
    setShowSkipNumber(false);
    onShowToast?.('Nomor mulai dikembalikan ke hitungan otomatis.');
  };

  const stagePendingBatch = (lotsToLock: string[], mode: 'PDF' | 'SYSTEM_PRINT' | 'THERMAL') => {
    if (lotsToLock.length === 0) return;
    const draft = createPendingPrintBatch({
      lots: lotsToLock,
      prefix: customLotPrefix,
      paperFormat,
      mode,
    });
    setPendingPrintBatch(draft);
    savePendingPrintBatch(draft);
  };

  const handleDownloadA4Pdf = () => {
    if (isGeneratingPdf || lotBatchNumbers.length === 0) return;
    if (!isReprintAllowed) {
      const msg =
        'Pilih alasan cetak ulang & centang konfirmasi peringatan terlebih dahulu sebelum mengunduh PDF.';
      setPrintPdfError(msg);
      onShowToast?.(msg);
      return;
    }

    const slotSnapshot = [...activePrintSlots];
    const freshSnapshot = [...freshLotsToLock];
    setPrintPdfError(null);
    setIsGeneratingPdf(true);

    try {
      const { blob, filename, physicalPageCount } = generateA4GradeCardsPdf({
        lotBatchNumbers: slotSnapshot,
        packagingChoices: masterDict.packagings,
        duplexMode,
        customPrefix: customLotPrefix,
        graderName: activeGraderName,
        printYear,
        blankUnusedSlots,
      });

      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

      if (freshSnapshot.length > 0) {
        stagePendingBatch(freshSnapshot, 'PDF');
        onShowToast?.(
          `PDF "${filename}" (${physicalPageCount} hal) dibuat — klik Kunci Nomor setelah cetak aman.`
        );
      } else {
        onShowToast?.(
          `PDF Cetak Ulang (${parsedReprintLots.join(', ')}) dibuat — urutan nomor baru tetap aman.`
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : 'Gagal membuat file PDF A4.';
      setPrintPdfError(
        freshSnapshot.length > 0
          ? `${msg} Seri ${freshSnapshot[0]}–${freshSnapshot[freshSnapshot.length - 1]} tidak dikunci agar bisa diulang.`
          : msg
      );
      if (freshSnapshot.length > 0) {
        stagePendingBatch(freshSnapshot, 'PDF');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSystemPrintAttempt = () => {
    if (lotBatchNumbers.length === 0) return;
    if (!isReprintAllowed) {
      const msg =
        'Pilih alasan cetak ulang & centang konfirmasi peringatan terlebih dahulu sebelum mencetak.';
      setPrintPdfError(msg);
      onShowToast?.(msg);
      return;
    }

    const freshSnapshot = [...freshLotsToLock];
    setPrintPdfError(null);

    if (freshSnapshot.length > 0) {
      stagePendingBatch(freshSnapshot, isThermalMode ? 'THERMAL' : 'SYSTEM_PRINT');
    }

    try {
      window.print();
      if (freshSnapshot.length > 0) {
        onShowToast?.(
          `Dialog print dibuka untuk ${freshSnapshot[0]}–${freshSnapshot[freshSnapshot.length - 1]}.`
        );
      } else {
        onShowToast?.(`Dialog cetak ulang dibuka (${lotBatchNumbers.join(', ')}).`);
      }
    } catch {
      setPrintPdfError(
        freshSnapshot.length > 0
          ? `Print sistem gagal dibuka. Seri ${freshSnapshot[0]}–${freshSnapshot[freshSnapshot.length - 1]} tetap belum dikunci.`
          : 'Print sistem gagal dibuka — silakan coba Download PDF A4.'
      );
    }
  };

  const handleConfirmPendingBatch = () => {
    const activePending =
      pendingPrintBatch ||
      createPendingPrintBatch({
        lots: freshLotsToLock,
        prefix: customLotPrefix,
        paperFormat,
        mode: isThermalMode ? 'THERMAL' : 'PDF',
      });
    if (!activePending || activePending.lots.length === 0) return;

    const { nextIssuedLots, lastLockedBatch: nextLockedSnapshot } = confirmPendingBatchLock({
      issuedLots: issuedPrintedLots,
      pendingBatch: activePending,
    });

    setIssuedPrintedLots(nextIssuedLots);
    saveIssuedPrintedLots(nextIssuedLots);
    setLastLockedBatch(nextLockedSnapshot);
    saveLastLockedBatch(nextLockedSnapshot);
    setPendingPrintBatch(null);
    savePendingPrintBatch(null);
    setPrintPdfError(null);

    const nextPrefixReg = recordPrintedBatchToPrefixRegistry(
      prefixRegistry,
      activePending.lots,
      customLotPrefix
    );
    persistPrefixRegistry(nextPrefixReg);

    onShowToast?.(
      `Seri ${activePending.lots[0]}–${
        activePending.lots[activePending.lots.length - 1]
      } terkunci. Nomor berikutnya siap.`
    );
  };

  const handleCancelPendingBatch = () => {
    setPendingPrintBatch(null);
    savePendingPrintBatch(null);
    setPrintPdfError(null);
    onShowToast?.('Draft dibatalkan. Nomor seri tetap aman & tidak dikunci.');
  };

  const handleUnlockLastBatch = () => {
    if (!lastLockedBatch || lastLockedBatch.lots.length === 0) return;
    const { nextIssuedLots, restoredPendingBatch } = unlockLastLockedBatch({
      issuedLots: issuedPrintedLots,
      lastLockedBatch,
      paperFormat,
    });
    setIssuedPrintedLots(nextIssuedLots);
    saveIssuedPrintedLots(nextIssuedLots);
    setLastLockedBatch(null);
    saveLastLockedBatch(null);
    setPendingPrintBatch(restoredPendingBatch);
    savePendingPrintBatch(restoredPendingBatch);
    setPrintPdfError(null);
    if (lastLockedBatch.prefix) {
      const nextReg = selectActivePrefix(prefixRegistry, lastLockedBatch.prefix);
      persistPrefixRegistry(nextReg);
    }
    setPrintCount(snapPrintCountForFormat(lastLockedBatch.lots.length, paperFormat));
    onShowToast?.(
      `Kunci dibuka untuk ${lastLockedBatch.lots[0]}–${
        lastLockedBatch.lots[lastLockedBatch.lots.length - 1]
      }.`
    );
  };

  if (!isOpen) return null;

  const dailyPreviewPrefix =
    generateNextLotBatchNumbers(
      rawTobaccos,
      1,
      '',
      issuedPrintedLots,
      getPrefixStartSequence(prefixRegistry, '') ?? 1
    )[0]?.replace(/\d+$/, '') || 'LOT-';

  const batchRangeText =
    lotBatchNumbers.length === 0
      ? 'Pilih nomor seri'
      : lotBatchNumbers.length === 1
        ? lotBatchNumbers[0]
        : `${lotBatchNumbers[0]} – ${lotBatchNumbers[lotBatchNumbers.length - 1]}`;

  const outputYieldText = isThermalMode
    ? `${lotBatchNumbers.length} Slip ${paperFormat === 'THERMAL_58' ? '58mm' : '80mm'}`
    : `${a4Pages.length} Lbr A4 (${totalA4SheetPages} Hal${
        duplexMode !== 'OFF' ? ' Bolak-Balik' : ''
      })`;

  const primaryDisabled =
    isGeneratingPdf || lotBatchNumbers.length === 0 || !isReprintAllowed;

  return (
    <>
      {typeof document !== 'undefined' &&
        createPortal(
          <motion.div
            data-testid="dedicated-print-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Stasiun Cetak Kartu Grade"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[90] bg-[#040406] text-white flex flex-col overflow-hidden"
          >
            {/* Slim Single-Row Header */}
            <header className="px-4 sm:px-6 py-2.5 border-b border-zinc-800 bg-[#08090d] flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Left: Title + Live Range */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0d0f14] border border-amber-500/70 flex items-center justify-center text-amber-300 shrink-0">
                  <Printer className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
                    Cetak Kartu Grade
                  </h2>
                  <div className="text-[11px] text-zinc-400 font-mono tabular-nums truncate">
                    <span>{batchRangeText}</span>
                    <span className="text-zinc-600 mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span>{outputYieldText}</span>
                  </div>
                </div>
              </div>

              {/* Center: Mode Switch (New Batch vs Reprint Recovery) */}
              <div
                role="tablist"
                aria-label="Mode Cetak"
                className="inline-flex p-0.5 rounded-xl bg-black border border-zinc-800 gap-0.5 shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={printModeTab === 'new'}
                  data-testid="print-mode-new-tab"
                  onClick={() => {
                    setPrintModeTab('new');
                    setPrintPdfError(null);
                  }}
                  className={`h-8 px-3.5 rounded-lg text-xs font-extrabold border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    printModeTab === 'new'
                      ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                      : 'bg-transparent text-zinc-400 border-transparent hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Seri Baru</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={printModeTab === 'reprint'}
                  data-testid="print-mode-reprint-tab"
                  onClick={() => {
                    setPrintModeTab('reprint');
                    setPrintPdfError(null);
                  }}
                  className={`h-8 px-3.5 rounded-lg text-xs font-extrabold border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    printModeTab === 'reprint'
                      ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                      : 'bg-transparent text-zinc-400 border-transparent hover:text-white'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Cetak Ulang</span>
                </button>
              </div>

              {/* Right: Audit Launcher + Close */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {onSwitchToScanner && (
                  <button
                    type="button"
                    onClick={onSwitchToScanner}
                    aria-label="Ke Scan"
                    className="h-8 px-2.5 sm:px-3 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <span className="sm:hidden">Scan</span>
                    <span className="hidden sm:inline">Ke Scan</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="open-fullscreen-audit-panel-btn"
                  onClick={handleOpenAuditModal}
                  aria-label="Audit 100 Nomor"
                  className="h-8 px-2.5 sm:px-3 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/75 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span className="sm:hidden">Audit 100</span>
                  <span className="hidden sm:inline">Audit 100 Nomor</span>
                </button>
                <button
                  type="button"
                  data-testid="close-print-panel-btn"
                  onClick={onClose}
                  aria-label="Tutup Panel Cetak"
                  className="h-8 px-2.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tutup</span>
                </button>
              </div>
            </header>

            {/* Main 2-Column Workstation: Choice (Left) + Preview & Execute (Right) */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* LEFT PANE: Calm Controls Rail */}
              <aside className="lg:col-span-5 xl:col-span-4 bg-[#07080b] border-b lg:border-b-0 lg:border-r border-zinc-800 overflow-y-auto [scrollbar-gutter:stable] divide-y divide-zinc-800/80 max-h-[48vh] lg:max-h-none">
                {printModeTab === 'new' ? (
                  <>
                    {/* Section 1: Prefix Seri (Single Unified Selector — no duplicate dropdown) */}
                    <section className="p-3.5 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-zinc-200 tracking-wide">
                          1. Prefix Seri Kartu
                        </h3>
                        <button
                          type="button"
                          data-testid="toggle-skip-number-btn"
                          onClick={() => setShowSkipNumber((v) => !v)}
                          className="text-[11px] font-bold text-zinc-400 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                        >
                          <Hash className="w-3 h-3" />
                          <span>
                            {activeMinStartSeq > 1
                              ? `Mulai #${String(activeMinStartSeq).padStart(3, '0')}`
                              : 'Lompat Nomor'}
                          </span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectSavedPrefix('')}
                          className={`h-8 px-3 rounded-lg font-mono text-xs font-extrabold border whitespace-nowrap cursor-pointer transition-colors ${
                            customLotPrefix === ''
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          Harian ({dailyPreviewPrefix.replace(/-$/, '')})
                        </button>

                        {prefixRegistry.registeredPrefixes.map((pref) => {
                          const active = customLotPrefix === pref;
                          const confirmingThis = pendingDeletePrefix === pref;
                          return (
                            <div
                              key={pref}
                              className={`inline-flex items-center rounded-lg border overflow-hidden transition-colors ${
                                confirmingThis
                                  ? 'bg-[#1a080b] text-red-200 border-red-500/80'
                                  : active
                                    ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                                    : 'bg-black text-zinc-200 border-zinc-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectSavedPrefix(pref)}
                                className="h-8 px-3 font-mono text-xs font-black cursor-pointer"
                              >
                                {pref}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDeletePrefix((curr) => (curr === pref ? null : pref))
                                }
                                aria-label={`Hapus prefix ${pref}`}
                                title={`Hapus prefix ${pref}`}
                                className={`h-8 w-7 flex items-center justify-center border-l cursor-pointer transition-colors ${
                                  confirmingThis
                                    ? 'border-red-500/50 text-red-200'
                                    : active
                                      ? 'border-amber-500/40 text-amber-300/75 hover:text-red-300'
                                      : 'border-zinc-800 text-zinc-500 hover:text-red-300'
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
                            className="h-8 px-3 rounded-lg bg-black hover:bg-[#0d0f14] border border-dashed border-amber-500/65 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Prefix Baru</span>
                          </button>
                        )}
                      </div>

                      {isAddingPrefix && (
                        <div className="space-y-2 pt-1">
                          <form
                            onSubmit={handleRegisterNewPrefixSubmit}
                            className="flex flex-wrap items-center gap-1.5"
                          >
                            <input
                              type="text"
                              value={newPrefixDraft}
                              onChange={(e) => setNewPrefixDraft(e.target.value.toUpperCase())}
                              placeholder="Kode (mis. MTL)"
                              autoFocus
                              className="h-9 flex-1 min-w-[110px] px-3 rounded-lg bg-black border border-amber-500/70 text-xs font-mono font-bold text-white focus:outline-hidden focus:border-amber-400"
                            />
                            <input
                              type="number"
                              min={1}
                              max={99999}
                              value={newPrefixStartSeqDraft}
                              onChange={(e) => setNewPrefixStartSeqDraft(e.target.value)}
                              placeholder="Mulai # (opsional)"
                              className="h-9 w-36 px-3 rounded-lg bg-black border border-zinc-700 focus:border-amber-400 text-xs font-mono font-bold text-amber-300 focus:outline-hidden"
                            />
                            <button
                              type="submit"
                              className="h-9 px-3 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 font-extrabold text-xs cursor-pointer transition-colors"
                            >
                              {newPrefixDetection?.hasPreviousData ? 'Pulihkan' : 'Simpan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingPrefix(false);
                                setNewPrefixDraft('');
                                setNewPrefixStartSeqDraft('');
                              }}
                              className="h-9 px-2.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer"
                            >
                              Batal
                            </button>
                          </form>
                          {newPrefixDetection?.hasPreviousData && (
                            <PrefixHistoryResumeNotice detection={newPrefixDetection} />
                          )}
                        </div>
                      )}

                      {pendingDeletePrefix && (
                        <DeleteConfirmWarning
                          testId="confirm-delete-prefix-banner"
                          targetLabel={`prefix ${pendingDeletePrefix}`}
                          consequenceText="Dihapus dari daftar cepat saja. Riwayat cetak & stok di Audit 100 Nomor tetap utuh dan otomatis lanjut bila ditambah kembali."
                          confirmButtonLabel={`Hapus ${pendingDeletePrefix}`}
                          onCancel={() => setPendingDeletePrefix(null)}
                          onConfirm={handleConfirmRemoveSavedPrefix}
                        />
                      )}

                      {showSkipNumber && (
                        <form
                          data-testid="skip-number-bar"
                          onSubmit={handleApplySkipStartSequence}
                          className="pt-2 border-t border-zinc-800/70 flex flex-wrap items-center gap-1.5"
                        >
                          <input
                            type="number"
                            min={1}
                            max={99999}
                            value={skipStartSeqDraft}
                            onChange={(e) => setSkipStartSeqDraft(e.target.value)}
                            placeholder="Mulai nomor (mis. 19)"
                            aria-label="Mulai dari nomor urut"
                            className="h-8 flex-1 min-w-[140px] px-2.5 rounded-lg bg-black border border-amber-500/60 text-xs font-mono font-bold text-amber-300 focus:outline-hidden focus:border-amber-400"
                          />
                          <button
                            type="submit"
                            className="h-8 px-3 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 text-xs font-extrabold cursor-pointer"
                          >
                            Terapkan
                          </button>
                          {activeMinStartSeq > 1 && (
                            <button
                              type="button"
                              onClick={handleResetSkipStartSequence}
                              className="h-8 px-2.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                            >
                              Auto
                            </button>
                          )}
                        </form>
                      )}
                    </section>

                    {/* Section 2: Jumlah Kartu (Clean presets only — NO -6 / +6 buttons) */}
                    <section className="p-3.5 sm:p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-zinc-200 tracking-wide">
                          2. Jumlah Kartu
                        </h3>
                        <span className="text-xs font-mono font-bold text-amber-300 tabular-nums">
                          {isThermalMode
                            ? `${effectivePrintCount} Slip Thermal`
                            : `${effectivePrintCount} Kartu · ${a4Pages.length} Hal A4`}
                        </span>
                      </div>

                      {isThermalMode ? (
                        <div className="grid grid-cols-5 gap-1.5">
                          {THERMAL_COUNT_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setPrintCount(preset)}
                              className={`h-10 rounded-lg font-mono text-xs font-black border cursor-pointer transition-colors ${
                                effectivePrintCount === preset
                                  ? 'bg-[#0d0f14] text-amber-300 border-amber-500/85'
                                  : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-6 gap-1.5">
                          {A4_COUNT_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setPrintCount(preset)}
                              className={`h-10 rounded-lg font-mono text-xs font-black border cursor-pointer transition-colors ${
                                effectivePrintCount === preset
                                  ? 'bg-[#0d0f14] text-amber-300 border-amber-500/85'
                                  : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Section 3: Grader & Tahun Cetak */}
                    <section
                      data-testid="grader-and-year-bar"
                      className="p-3.5 sm:p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-zinc-200 tracking-wide inline-flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>3. Grader &amp; Tahun</span>
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label
                            htmlFor="print-year-input"
                            className="text-[11px] font-bold text-zinc-400 inline-flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3 text-amber-400" />
                            <span>Tahun</span>
                          </label>
                          <input
                            id="print-year-input"
                            type="number"
                            min={2020}
                            max={2099}
                            value={printYearDraft}
                            onChange={(e) => {
                              setPrintYearDraft(e.target.value);
                              const parsed = Number(e.target.value);
                              if (Number.isFinite(parsed) && parsed >= 2020 && parsed <= 2099) {
                                setPrintYear(Math.round(parsed));
                              }
                            }}
                            onBlur={(e) => handleCommitPrintYear(e.target.value)}
                            className="h-8 w-20 px-2 rounded-lg bg-black border border-zinc-700 focus:border-amber-400 font-mono text-xs font-black text-amber-300 text-center focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectSavedGrader('')}
                          className={`h-8 px-3 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                            activeGraderName === ''
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          Kosong (Tulis Tangan)
                        </button>

                        {graderRegistryRaw.registeredGraders.map((grader) => {
                          const active =
                            activeGraderName.toLowerCase() === grader.toLowerCase();
                          const confirming = pendingDeleteGrader === grader;
                          return (
                            <div
                              key={grader}
                              className={`inline-flex items-center rounded-lg border overflow-hidden transition-colors ${
                                confirming
                                  ? 'bg-[#1a080b] text-red-200 border-red-500/80'
                                  : active
                                    ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                                    : 'bg-black text-zinc-200 border-zinc-800'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectSavedGrader(grader)}
                                className="h-8 px-3 text-xs font-extrabold cursor-pointer"
                              >
                                {grader}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDeleteGrader((curr) =>
                                    curr === grader ? null : grader
                                  )
                                }
                                aria-label={`Hapus grader ${grader}`}
                                className="h-8 w-7 flex items-center justify-center border-l border-zinc-800 text-zinc-500 hover:text-red-300 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}

                        {!isAddingGrader && (
                          <button
                            type="button"
                            onClick={() => setIsAddingGrader(true)}
                            className="h-8 px-3 rounded-lg bg-black hover:bg-[#0d0f14] border border-dashed border-amber-500/65 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Grader</span>
                          </button>
                        )}
                      </div>

                      {isAddingGrader && (
                        <form
                          onSubmit={handleRegisterNewGraderSubmit}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={newGraderDraft}
                            onChange={(e) => setNewGraderDraft(e.target.value)}
                            placeholder="Nama grader (mis. Pak Slamet)"
                            autoFocus
                            className="h-9 flex-1 min-w-[160px] px-3 rounded-lg bg-black border border-amber-500/70 text-xs font-bold text-white focus:outline-hidden focus:border-amber-400"
                          />
                          <button
                            type="submit"
                            className="h-9 px-3 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 font-extrabold text-xs cursor-pointer"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingGrader(false);
                              setNewGraderDraft('');
                            }}
                            className="h-9 px-2.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </form>
                      )}

                      {pendingDeleteGrader && (
                        <DeleteConfirmWarning
                          targetLabel={`grader ${pendingDeleteGrader}`}
                          consequenceText="Nama grader akan dihapus dari pilihan cepat cetak."
                          confirmButtonLabel="Hapus"
                          onCancel={() => setPendingDeleteGrader(null)}
                          onConfirm={handleConfirmRemoveSavedGrader}
                        />
                      )}
                    </section>
                  </>
                ) : (
                  /* MODE 2: CETAK ULANG NOMOR LAMA / RUSAK */
                  <div className="divide-y divide-zinc-800/80">
                    <section className="p-3.5 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-zinc-200 tracking-wide">
                          1. Pilih Nomor Seri Lama / Rusak
                        </h3>
                        <button
                          type="button"
                          onClick={handleOpenAuditModal}
                          className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                        >
                          Pilih via Audit 100 Nomor
                        </button>
                      </div>

                      <input
                        id="reprint-lots-input"
                        type="text"
                        value={reprintLotsInput}
                        onChange={(e) => setReprintLotsInput(e.target.value.toUpperCase())}
                        placeholder="Ketik nomor seri (mis. MTL005 atau MTL005, MTL006)"
                        className="w-full h-10 px-3 rounded-lg bg-black border border-amber-500/70 font-mono text-xs font-bold text-amber-300 focus:outline-hidden focus:border-amber-400"
                      />

                      {recentPrintableLotsForChips.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-zinc-400">
                            Seri Terakhir:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {recentPrintableLotsForChips.map((lotCode) => {
                              const selected = parsedReprintLots.includes(lotCode);
                              return (
                                <button
                                  key={lotCode}
                                  type="button"
                                  onClick={() => handleToggleReprintChip(lotCode)}
                                  className={`h-7 px-2.5 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-colors ${
                                    selected
                                      ? 'bg-[#0d0f14] text-amber-300 border-amber-500/85'
                                      : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                                  }`}
                                >
                                  {lotCode}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="p-3.5 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-extrabold text-zinc-200 tracking-wide">
                          2. Penempatan Hemat Kertas
                        </h3>
                        {!isThermalMode && (
                          <button
                            type="button"
                            onClick={() => handleChangePaperFormat('THERMAL_80')}
                            className="text-[11px] font-bold text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Pakai Thermal 1 Slip</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReprintModeType('SLOT_TERPILIH')}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                            reprintModeType === 'SLOT_TERPILIH'
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/85'
                              : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="text-xs font-extrabold">Slot Terpilih 1–6</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Sisa kertas putih bersih, urutan baru tidak berubah
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReprintModeType('GABUNG_BARU')}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
                            reprintModeType === 'GABUNG_BARU'
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/85'
                              : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="text-xs font-extrabold">Gabung Seri Baru</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">
                            Isi slot sisa dengan seri baru agar penuh 1 A4
                          </div>
                        </button>
                      </div>

                      {!isThermalMode && reprintModeType === 'SLOT_TERPILIH' && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-semibold text-zinc-400">
                            Pilih posisi cetak pada lembar A4 (2 × 3):
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 max-w-[260px]">
                            {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                              const active = effectiveSelectedSlotIndexes.includes(slotIdx);
                              return (
                                <button
                                  key={slotIdx}
                                  type="button"
                                  onClick={() => handleToggleSlotIndex(slotIdx)}
                                  className={`h-9 px-3 rounded-lg font-mono text-xs font-black border cursor-pointer transition-colors ${
                                    active
                                      ? 'bg-[#0d0f14] text-amber-300 border-amber-500/85'
                                      : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                                  }`}
                                >
                                  Slot {slotIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>

                    {parsedReprintLots.length > 0 && (
                      <section className="p-3.5 sm:p-4">
                        <ReprintSafetyWarning
                          warning={reprintWarning}
                          selectedReason={reprintReason}
                          onSelectReason={(reason) => {
                            setReprintReason(reason);
                            setPrintPdfError(null);
                          }}
                          confirmed={reprintWarningConfirmed}
                          onConfirmedChange={(checked) => {
                            setReprintWarningConfirmed(checked);
                            if (checked) setPrintPdfError(null);
                          }}
                        />
                      </section>
                    )}
                  </div>
                )}

                {/* Section 4 (Shared): Default-First Format & Printer Setup */}
                <section className="p-3.5 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-zinc-400">
                        Printer &amp; Kertas Aktif
                      </div>
                      <div className="text-xs font-extrabold text-white truncate mt-0.5">
                        {formatPaperSummaryLabel({
                          paperFormat,
                          duplexMode,
                          printCount: effectivePrintCount,
                          includeThermalBarcode,
                          hasCustomizedBefore: true,
                          printYear,
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPaperSetup((v) => !v)}
                      className="h-9 px-3 rounded-lg bg-black hover:bg-[#0d0f14] border border-zinc-700 hover:border-amber-500/75 text-xs font-bold text-amber-300 inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{showPaperSetup ? 'Selesai' : 'Ubah Printer'}</span>
                      {showPaperSetup ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {showPaperSetup && (
                    <div className="space-y-3 pt-2 border-t border-zinc-800/70">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleChangePaperFormat('A4_6')}
                          className={`h-9 px-2 rounded-lg text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                            paperFormat === 'A4_6'
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span>A4 6/Hal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangePaperFormat('THERMAL_58')}
                          className={`h-9 px-2 rounded-lg text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                            paperFormat === 'THERMAL_58'
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5 shrink-0" />
                          <span>58mm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangePaperFormat('THERMAL_80')}
                          className={`h-9 px-2 rounded-lg text-xs font-extrabold border cursor-pointer inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors ${
                            paperFormat === 'THERMAL_80'
                              ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                              : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5 shrink-0" />
                          <span>80mm</span>
                        </button>
                      </div>

                      {isThermalMode ? (
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={includeThermalBarcode}
                            onChange={(e) => setIncludeThermalBarcode(e.target.checked)}
                            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                          />
                          <span>Sertakan Barcode Besar &amp; Prefix di Bawah Slip</span>
                        </label>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-zinc-400">
                            Mode Sisi Cetak A4 (Barcode Belakang):
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDuplexMode('OFF')}
                              className={`h-8 px-2 rounded-lg text-[11px] font-bold border cursor-pointer whitespace-nowrap transition-colors ${
                                duplexMode === 'OFF'
                                  ? 'bg-[#0d0f14] text-white border-zinc-500'
                                  : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                              }`}
                            >
                              1 Sisi
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplexMode('LONG_EDGE')}
                              title="Balik ke samping seperti buku"
                              className={`h-8 px-2 rounded-lg text-[11px] font-extrabold border cursor-pointer whitespace-nowrap transition-colors ${
                                duplexMode === 'LONG_EDGE'
                                  ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                                  : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                              }`}
                            >
                              2 Sisi · Buku
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuplexMode('SHORT_EDGE')}
                              title="Balik ke atas seperti kalender (otomatis putar 180°)"
                              className={`h-8 px-2 rounded-lg text-[11px] font-extrabold border cursor-pointer whitespace-nowrap transition-colors ${
                                duplexMode === 'SHORT_EDGE'
                                  ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                                  : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                              }`}
                            >
                              2 Sisi · Kalender
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </aside>

              {/* RIGHT PANE: Batch Scope + Live Sheet Preview + Pinned Action Bar */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 bg-[#040406]">
                {/* Batch Scope Readout Bar */}
                <div className="px-4 sm:px-6 py-2.5 border-b border-zinc-800/80 bg-[#08090d] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <span className="text-zinc-400">
                      {printModeTab === 'reprint' ? 'Cetak Ulang:' : 'Seri Berikutnya:'}
                    </span>
                    <span className="font-mono font-black text-amber-300 tabular-nums">
                      {batchRangeText}
                    </span>
                    {activeGraderName && (
                      <>
                        <span className="text-zinc-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-zinc-300">
                          Grader: <b className="text-white">{activeGraderName}</b>
                        </span>
                      </>
                    )}
                    <span className="text-zinc-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-zinc-300 font-mono tabular-nums">Tahun {printYear}</span>
                  </div>

                  <div className="text-[11px] font-mono text-zinc-400 inline-flex items-center gap-1.5 shrink-0">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span className="tabular-nums">{issuedPrintedLots.length} seri terkunci</span>
                  </div>
                </div>

                {/* Compact Print Confirmation / Retry Bar + Error Banner */}
                {((pendingPrintBatch || isRetryingPending) && freshLotsToLock.length > 0) ||
                printPdfError ? (
                  <div className="px-4 sm:px-6 pt-3 space-y-2 shrink-0">
                    {(pendingPrintBatch || isRetryingPending) && freshLotsToLock.length > 0 && (
                      <div
                        data-testid="pending-print-confirmation"
                        className="px-3.5 py-2.5 rounded-xl bg-[#0d0f14] border border-amber-500/80 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-extrabold text-amber-300 shrink-0">
                            Belum Dikunci
                          </span>
                          <span className="text-zinc-600" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono text-xs font-black text-white truncate tabular-nums">
                            {freshLotsToLock.length === 1
                              ? freshLotsToLock[0]
                              : `${freshLotsToLock[0]} – ${freshLotsToLock[freshLotsToLock.length - 1]}`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={handleConfirmPendingBatch}
                            className="h-8 px-3 rounded-lg bg-[#091510] hover:bg-emerald-950/60 border border-emerald-500/80 text-emerald-300 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Kunci Nomor</span>
                          </button>
                          <button
                            type="button"
                            onClick={isThermalMode ? handleSystemPrintAttempt : handleDownloadA4Pdf}
                            disabled={isGeneratingPdf}
                            className="h-8 px-3 rounded-lg bg-black hover:bg-[#0d0f14] border border-amber-500/75 text-amber-300 font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Ulangi</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelPendingBatch}
                            title="Tutup draft tanpa mengunci nomor"
                            className="h-8 px-2.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer transition-colors"
                          >
                            Batal Draft
                          </button>
                        </div>
                      </div>
                    )}

                    {printPdfError && <PrintErrorWarning message={printPdfError} />}
                  </div>
                ) : null}

                {/* Sheet Preview Canvas */}
                <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] p-4 sm:p-6">
                  {isWaitingReprintInput ? (
                    <div className="h-full min-h-[260px] rounded-xl border border-dashed border-zinc-800 bg-[#07080b] flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <RotateCcw className="w-7 h-7 text-zinc-500" />
                      <div className="space-y-1 max-w-md">
                        <div className="text-sm font-extrabold text-white">
                          Masukkan Nomor Seri yang Akan Dicetak Ulang
                        </div>
                        <p className="text-xs text-zinc-400">
                          Ketik nomor seri lama di panel kiri, pilih dari daftar seri terakhir, atau buka{' '}
                          <strong className="text-amber-300">Audit 100 Nomor</strong> untuk memilih kartu yang rusak.
                        </p>
                      </div>
                    </div>
                  ) : isThermalMode ? (
                    <div className="py-2 flex flex-wrap items-start justify-center gap-5">
                      {lotBatchNumbers.map((lot) => (
                        <div key={lot} className="shadow-2xl">
                          <ThermalGradeCardPaper
                            lotNumber={lot}
                            packagingChoices={masterDict.packagings}
                            profile={paperFormat === 'THERMAL_58' ? 'THERMAL_58' : 'THERMAL_80'}
                            includeBackBarcode={includeThermalBarcode}
                            customPrefix={customLotPrefix}
                            graderName={activeGraderName}
                            printYear={printYear}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6 max-w-4xl mx-auto">
                      {a4Pages.map((pageLots, pageIdx) => {
                        const backSlots =
                          duplexMode !== 'OFF'
                            ? arrangeDuplexBackSlots(pageLots, cardsPerA4Page, duplexMode)
                            : [];
                        return (
                          <React.Fragment key={pageIdx}>
                            {/* FRONT SIDE SHEET */}
                            <div className="bg-white text-black rounded-xl p-4 shadow-2xl border border-zinc-300">
                              <div className="text-[10px] font-mono font-bold text-zinc-600 mb-2.5 flex justify-between gap-2">
                                <span>HALAMAN A4 #{pageIdx + 1} — SISI DEPAN (6 KARTU)</span>
                                <span>POTONG GARIS TEPI HITAM</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-3 gap-3">
                                {pageLots.map((lot, sIdx) => (
                                  <PrintableGradeCardPaper
                                    key={lot || `empty-front-${pageIdx}-${sIdx}`}
                                    lotNumber={lot}
                                    packagingChoices={masterDict.packagings}
                                    compact={true}
                                    graderName={activeGraderName}
                                    printYear={printYear}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* BACK SIDE SHEET (DUPLEX) */}
                            {duplexMode !== 'OFF' && (
                              <div className="bg-white text-black rounded-xl p-4 shadow-2xl border border-amber-500/80">
                                <div className="text-[10px] font-mono font-bold text-zinc-700 mb-2.5 flex justify-between gap-2">
                                  <span>
                                    HALAMAN A4 #{pageIdx + 1} — SISI BELAKANG (
                                    {duplexMode === 'LONG_EDGE' ? 'LONG EDGE' : 'SHORT EDGE'})
                                  </span>
                                  <span>SEJAJAR DI BALIK KARTU DEPAN</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-3 gap-3">
                                  {backSlots.map((slot, sIdx) => (
                                    <PrintableGradeCardBackPaper
                                      key={`${pageIdx}-back-${sIdx}`}
                                      lotNumber={slot.lot}
                                      customPrefix={customLotPrefix}
                                      compact={true}
                                      rotate180={slot.rotate180}
                                      blankUnusedSlots={blankUnusedSlots}
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

                {/* Pinned Bottom Action Bar (Clear Hierarchy, Zero Amber Fill) */}
                <footer className="px-4 sm:px-6 py-3 border-t border-zinc-800 bg-[#08090d] flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {lastLockedBatch && !pendingPrintBatch && printModeTab === 'new' && (
                      <button
                        type="button"
                        onClick={handleUnlockLastBatch}
                        className="h-10 px-3 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-700 hover:border-amber-500/65 text-zinc-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          Buka Kunci ({lastLockedBatch.lots[0]}–
                          {lastLockedBatch.lots[lastLockedBatch.lots.length - 1]})
                        </span>
                      </button>
                    )}

                    {printModeTab === 'reprint' &&
                      parsedReprintLots.length > 0 &&
                      !isReprintAllowed && (
                        <span className="text-[11px] font-semibold text-red-300">
                          Pilih alasan &amp; centang konfirmasi peringatan untuk cetak ulang.
                        </span>
                      )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={handleSystemPrintAttempt}
                      disabled={lotBatchNumbers.length === 0 || !isReprintAllowed}
                      className={`h-10 px-4 rounded-xl font-extrabold text-xs inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors border ${
                        isThermalMode
                          ? 'bg-[#0d0f14] hover:bg-amber-500/10 border-amber-500/85 text-amber-300'
                          : 'bg-black hover:bg-zinc-900 border-zinc-700 hover:border-amber-500/70 text-zinc-100'
                      }`}
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>
                        {isThermalMode
                          ? `Cetak Thermal (${paperFormat === 'THERMAL_58' ? '58mm' : '80mm'})`
                          : `Print Sistem (${totalA4SheetPages} Hal)`}
                      </span>
                    </button>

                    {!isThermalMode && (
                      <button
                        type="button"
                        data-testid="download-a4-pdf-btn"
                        onClick={handleDownloadA4Pdf}
                        disabled={primaryDisabled}
                        className="h-10 px-5 rounded-xl bg-[#0d0f14] hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/85 text-amber-300 font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      >
                        {isGeneratingPdf ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>
                          {isGeneratingPdf
                            ? 'Membuat File PDF...'
                            : parsedReprintLots.length > 0 && freshLotsToLock.length === 0
                              ? `Download Ulang PDF A4 (${totalA4SheetPages} Hal)`
                              : `Download PDF A4 (${totalA4SheetPages} Hal${
                                  duplexMode !== 'OFF' ? ' Bolak-Balik' : ''
                                })`}
                        </span>
                      </button>
                    )}
                  </div>
                </footer>
              </div>
            </div>
          </motion.div>,
          document.body
        )}

      {/* Full-Screen Individual Panel: 100-Number 2-Box Prefix Audit Matrix (Read-Only) */}
      {typeof document !== 'undefined' &&
        isOpen &&
        isAuditModalOpen &&
        activeAuditLedger &&
        activeAuditGridBlock &&
        createPortal(
          <div
            data-testid="prefix-audit-ledger-panel"
            className="fixed inset-0 z-[140] bg-[#07080b] text-white flex flex-col overflow-hidden"
          >
            {/* Top Bar: Prefix Switcher (Prev / Select / Next) + Legend + Close */}
            <div className="px-3 sm:px-5 py-2.5 border-b border-zinc-800 bg-[#0b0c10] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black tracking-wide text-white">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Audit 100 Nomor</span>
                </span>
                <span className="text-[11px] font-semibold text-zinc-400">
                  · Read-Only ·{' '}
                  {activeAuditLedger.isDeletedPrefix
                    ? 'Arsip Terhapus'
                    : activeAuditLedger.isAutoDaily
                      ? 'Harian'
                      : 'Aktif'}
                </span>

                {activeAuditLedger.isDeletedPrefix && (
                  <button
                    type="button"
                    onClick={() => handleRestoreDeletedPrefix(activeAuditLedger.prefixKey)}
                    className="h-7 px-2.5 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 text-[11px] font-black cursor-pointer transition-colors"
                  >
                    Pulihkan Prefix Ini
                  </button>
                )}
              </div>

              {/* Prefix Series Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="audit-prev-prefix-btn"
                  disabled={prefixAuditLedgers.length <= 1}
                  onClick={() => handleStepAuditPrefix(-1)}
                  title="Prefix seri sebelumnya"
                  className="h-8 px-2.5 rounded-lg bg-black hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 hover:border-amber-500/70 text-xs font-extrabold text-zinc-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>Prev</span>
                </button>

                <select
                  data-testid="audit-prefix-select"
                  aria-label="Pilih atau ganti prefix seri"
                  value={activeAuditLedger.prefixKey}
                  onChange={(e) => handleSelectAuditPrefix(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-[#0d0f14] border border-amber-500/80 text-xs font-mono font-black text-amber-300 focus:outline-hidden cursor-pointer"
                >
                  {prefixAuditLedgers.map((l, idx) => (
                    <option key={l.prefixKey} value={l.prefixKey} className="bg-black text-white">
                      {`${idx + 1}/${prefixAuditLedgers.length} • ${l.displayLabel}${
                        l.isDeletedPrefix ? ' (Arsip Terhapus)' : ''
                      }`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  data-testid="audit-next-prefix-btn"
                  disabled={prefixAuditLedgers.length <= 1}
                  onClick={() => handleStepAuditPrefix(1)}
                  title="Ganti ke prefix seri berikutnya"
                  className="h-8 px-2.5 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/80 text-xs font-extrabold text-amber-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Tickbox Legend + Close */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden xl:flex items-center gap-2.5 text-[11px] font-bold text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-emerald-500 border border-emerald-400 text-black inline-flex items-center justify-center">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span>Stok / Terpakai</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-amber-400 border border-amber-300 text-black inline-flex items-center justify-center">
                      <Printer className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </span>
                    <span>Dicetak</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-black border border-zinc-700 inline-flex" />
                    <span>Belum Cetak</span>
                  </span>
                </div>

                <button
                  type="button"
                  data-testid="close-fullscreen-audit-panel-btn"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="h-8 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Sub-bar: Read-Only Summary + 100-Block Range Pagination */}
            <div className="px-3 sm:px-5 py-1.5 border-b border-zinc-800/80 bg-black/70 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
              <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-zinc-300">
                <span>
                  Stok: <b className="text-emerald-400">{activeAuditLedger.stockRegisteredCount}</b>
                </span>
                <span className="text-zinc-600" aria-hidden="true">
                  ·
                </span>
                <span>
                  Dicetak: <b className="text-amber-300">{activeAuditLedger.printedNotStockCount}</b>
                </span>
                <span className="text-zinc-600" aria-hidden="true">
                  ·
                </span>
                <span>
                  Lanjut: <b className="text-amber-300">{activeAuditLedger.nextNewLot}</b>
                </span>
                <span className="hidden md:inline text-zinc-500">
                  · Klik kotak Hijau/Kuning untuk muat ke Cetak Ulang
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {activeAuditGridBlock.totalBlocks > 1 && (
                  <button
                    type="button"
                    disabled={activeAuditGridBlock.blockIndex <= 0}
                    onClick={() => setAuditBlockIndex((b) => Math.max(0, b - 1))}
                    className="h-7 px-2 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-[10px] font-bold text-zinc-200 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>100</span>
                  </button>
                )}
                <span className="font-mono font-bold text-zinc-300 tabular-nums">
                  #{String(activeAuditGridBlock.startSeq).padStart(3, '0')} – #
                  {String(activeAuditGridBlock.endSeq).padStart(3, '0')} (100)
                </span>
                {activeAuditGridBlock.totalBlocks > 1 && (
                  <button
                    type="button"
                    disabled={activeAuditGridBlock.blockIndex >= activeAuditGridBlock.totalBlocks - 1}
                    onClick={() =>
                      setAuditBlockIndex((b) =>
                        Math.min(activeAuditGridBlock.totalBlocks - 1, b + 1)
                      )
                    }
                    className="h-7 px-2 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-700 text-[10px] font-bold text-zinc-200 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>100</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Main 100-Number 2-Box Matrix */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col justify-start">
              <div
                data-testid={`prefix-ledger-card-${activeAuditLedger.prefixKey}`}
                className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5"
              >
                {activeAuditGridBlock.entries.map((entry) => {
                  const isStock = entry.status === 'STOCK_REGISTERED';
                  const isPrintedOnly = entry.status === 'PRINTED_NOT_STOCK';
                  const isInteractiveReprint = isStock || isPrintedOnly;
                  const tooltip = isStock
                    ? `${entry.lotCode} · Terdaftar Stok: ${entry.stockName || 'Gudang'} (Klik untuk Cetak Ulang)`
                    : isPrintedOnly
                      ? `${entry.lotCode} · Sudah Dicetak, belum masuk stok (Klik untuk Cetak Ulang)`
                      : `${entry.lotCode} · Belum Dicetak`;

                  const content = (
                    <>
                      <span
                        className={`flex-1 py-2 font-mono font-black tracking-tight text-left truncate ${
                          entry.lotCode.length > 9 ? 'text-[10px] px-1.5' : 'text-xs px-2'
                        } ${
                          isStock
                            ? 'text-emerald-200'
                            : isPrintedOnly
                              ? 'text-amber-200'
                              : 'text-zinc-500'
                        }`}
                      >
                        {entry.lotCode}
                      </span>

                      <span
                        aria-label={
                          isStock
                            ? `${entry.lotCode}: Stok Terpakai`
                            : isPrintedOnly
                              ? `${entry.lotCode}: Sudah Dicetak`
                              : `${entry.lotCode}: Belum Dicetak`
                        }
                        className={`w-7 shrink-0 border-l flex items-center justify-center ${
                          isStock
                            ? 'bg-emerald-500 border-emerald-400 text-black'
                            : isPrintedOnly
                              ? 'bg-amber-400 border-amber-300 text-black'
                              : 'bg-black border-zinc-800'
                        }`}
                      >
                        {isStock ? (
                          <Check className="w-4 h-4" strokeWidth={3} />
                        ) : isPrintedOnly ? (
                          <Printer className="w-3.5 h-3.5" strokeWidth={2.5} />
                        ) : null}
                      </span>
                    </>
                  );

                  if (isInteractiveReprint) {
                    return (
                      <button
                        key={entry.lotCode}
                        type="button"
                        data-testid={`ledger-entry-${entry.lotCode}`}
                        title={tooltip}
                        onClick={() => handleLoadLotForRedownloadFromLedger(entry.lotCode)}
                        className={`h-10 rounded-lg border flex items-stretch overflow-hidden select-none cursor-pointer transition-colors ${
                          isStock
                            ? 'bg-[#08150f] hover:bg-[#0c2117] border-emerald-500/65 hover:border-emerald-400'
                            : 'bg-[#141007] hover:bg-[#1f1809] border-amber-500/65 hover:border-amber-400'
                        }`}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={entry.lotCode}
                      data-testid={`ledger-entry-${entry.lotCode}`}
                      title={tooltip}
                      className="h-10 rounded-lg border border-zinc-800/90 bg-[#09090c] flex items-stretch overflow-hidden select-none"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

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
                    graderName={activeGraderName}
                    printYear={printYear}
                  />
                ))
              : a4Pages.map((pageLots, pageIdx) => {
                  const backSlots =
                    duplexMode !== 'OFF'
                      ? arrangeDuplexBackSlots(pageLots, cardsPerA4Page, duplexMode)
                      : [];
                  return (
                    <React.Fragment key={pageIdx}>
                      <div
                        className="grade-card-a4-page grid grid-cols-2"
                        style={{
                          gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                          gap: `${A4_PRINT_PAGE_METRICS.gridGapMm}mm`,
                          height: `${A4_PRINT_PAGE_METRICS.pageHeightMm}mm`,
                          maxHeight: `${A4_PRINT_PAGE_METRICS.pageHeightMm}mm`,
                        }}
                      >
                        {pageLots.map((lot, sIdx) => (
                          <PrintableGradeCardPaper
                            key={lot || `empty-portal-front-${pageIdx}-${sIdx}`}
                            lotNumber={lot}
                            packagingChoices={masterDict.packagings}
                            compact={true}
                            graderName={activeGraderName}
                            printYear={printYear}
                          />
                        ))}
                      </div>

                      {duplexMode !== 'OFF' && (
                        <div
                          className="grade-card-a4-page grid grid-cols-2"
                          style={{
                            gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                            gap: `${A4_PRINT_PAGE_METRICS.gridGapMm}mm`,
                            height: `${A4_PRINT_PAGE_METRICS.pageHeightMm}mm`,
                            maxHeight: `${A4_PRINT_PAGE_METRICS.pageHeightMm}mm`,
                          }}
                        >
                          {backSlots.map((slot, sIdx) => (
                            <PrintableGradeCardBackPaper
                              key={`${pageIdx}-print-back-${sIdx}`}
                              lotNumber={slot.lot}
                              customPrefix={customLotPrefix}
                              compact={true}
                              rotate180={slot.rotate180}
                              blankUnusedSlots={blankUnusedSlots}
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
