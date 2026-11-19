import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Archive,
  ArrowLeftRight,
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
  buildSlotAssignedReprintPlan,
  confirmPendingBatchLock,
  createPendingPrintBatch,
  loadIssuedPrintedLots,
  loadLastLockedBatch,
  loadPendingPrintBatch,
  resolveActiveBatchLots,
  saveIssuedPrintedLots,
  saveLastLockedBatch,
  savePendingPrintBatch,
  upsertPrintedLotMetadata,
  snapPrintCountForFormat,
  unlockLastLockedBatch,
} from '../utils/printBatchLockEngine';
import { generateA4GradeCardsPdf } from '../utils/a4PdfExportEngine';
import {
  buildPrefixAuditGridBlock,
  buildPrefixAuditLedgers,
  detectPreviousPrefixHistory,
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
} from './PrintWarningBanner';

interface GradeCardPrintPanelProps {
  isOpen: boolean;
  onClose: () => void;
  rawTobaccos: RawTobacco[];
  packagingList: PackagingMaster[];
  onShowToast?: (msg: string) => void;
  onSwitchToScanner?: () => void;
}

const A4_COUNT_PRESETS = [4, 8, 12, 16, 20, 24] as const;
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
  const [pendingDeleteGrader, setPendingDeleteGrader] = useState(null as string | null);

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

  // Reprint Recovery State (1-to-1 per-slot A4 position assignment: Slots 1..4)
  const [reprintModeType, setReprintModeType] = useState<ReprintMode>('SLOT_TERPILIH');
  const [reprintSlotCodes, setReprintSlotCodes] = useState<string[]>(['', '', '', '']);
  const [activeReprintSlotIndex, setActiveReprintSlotIndex] = useState<number>(0);

  // 100-Number Read-Only Audit Portal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditSelectedPrefixKey, setAuditSelectedPrefixKey] = useState<string>('');
  const [auditBlockIndex, setAuditBlockIndex] = useState<number>(0);
  const [auditAssignedInSession, setAuditAssignedInSession] = useState(false);

  const effectivePrintCount = snapPrintCountForFormat(printCount, paperFormat);
  const activeGraderName = graderRegistryRaw.lastSelectedGrader;
  const isThermalMode = isThermalPaperFormat(paperFormat);
  const cardsPerA4Page = 4 as const;

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
          if (auditAssignedInSession) {
            setPrintModeTab('reprint');
            setPrintPdfError(null);
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isAuditModalOpen, auditAssignedInSession, onClose]);

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

  // Dynamic Kemasan list for printed cards: always mirrors ALL Master Kemasan entries cleanly
  const cardPackagingChoices = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of packagingList) {
      const name = (p.name || '').trim();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    return out.length > 0 ? out : masterDict.packagings;
  }, [packagingList, masterDict.packagings]);

  const stockedLotSet = useMemo(
    () =>
      new Set(
        rawTobaccos.map((t) => normalizeLotNumber(t.lotNumber)).filter(Boolean)
      ),
    [rawTobaccos]
  );

  const printedLotSet = useMemo(
    () =>
      new Set(
        issuedPrintedLots.map((l) => normalizeLotNumber(l)).filter(Boolean)
      ),
    [issuedPrintedLots]
  );

  const printedOrStockedLotSet = useMemo(
    () => new Set([...printedLotSet, ...stockedLotSet]),
    [printedLotSet, stockedLotSet]
  );

  const parsedReprintLots = useMemo(
    () =>
      printModeTab === 'reprint'
        ? Array.from(
            new Set(
              reprintSlotCodes
                .map((c) => normalizeLotNumber(c))
                .filter(Boolean)
            )
          )
        : [],
    [printModeTab, reprintSlotCodes]
  );

  const slotAssignmentsByLot = useMemo(() => {
    const map = new Map<string, number[]>();
    reprintSlotCodes.forEach((rawCode, idx) => {
      const norm = normalizeLotNumber(rawCode);
      if (!norm) return;
      const existing = map.get(norm);
      if (existing) {
        existing.push(idx + 1);
      } else {
        map.set(norm, [idx + 1]);
      }
    });
    return map;
  }, [reprintSlotCodes]);

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
    setAuditAssignedInSession(false);
    setIsAuditModalOpen(true);
  };

  const handleCloseAuditModal = (forceReprintTab = false) => {
    setIsAuditModalOpen(false);
    const hasAnySlot = reprintSlotCodes.some((c) => Boolean(normalizeLotNumber(c)));
    if (forceReprintTab || (auditAssignedInSession && hasAnySlot)) {
      setPrintModeTab('reprint');
      setPrintPdfError(null);
    }
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

  const occupiedReprintSlotCount = useMemo(
    () => reprintSlotCodes.filter((c) => Boolean(normalizeLotNumber(c))).length,
    [reprintSlotCodes]
  );

  const reprintFreshNeededCount = useMemo(() => {
    if (printModeTab !== 'reprint' || parsedReprintLots.length === 0) return effectivePrintCount;
    if (reprintModeType === 'SLOT_TERPILIH') return 0;
    if (isThermalMode) {
      return Math.max(0, Math.max(parsedReprintLots.length, effectivePrintCount) - parsedReprintLots.length);
    }
    const snappedTarget = snapPrintCountForFormat(effectivePrintCount, 'A4_6');
    return Math.max(0, snappedTarget - occupiedReprintSlotCount);
  }, [
    printModeTab,
    parsedReprintLots.length,
    occupiedReprintSlotCount,
    reprintModeType,
    isThermalMode,
    effectivePrintCount,
  ]);

  const generatedBatchNumbers = useMemo(
    () =>
      customLotPrefix
        ? generateNextLotBatchNumbers(
            rawTobaccos,
            Math.max(effectivePrintCount, reprintFreshNeededCount),
            customLotPrefix,
            issuedPrintedLots,
            activeMinStartSeq
          )
        : [],
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

  const activeReprintPlan = useMemo(
    () =>
      buildSlotAssignedReprintPlan({
        slotCodes: printModeTab === 'reprint' ? reprintSlotCodes : ['', '', '', ''],
        mode: printModeTab === 'reprint' ? reprintModeType : 'GABUNG_BARU',
        generatedFreshLots: freshLotsForBatch,
        requestedCount: effectivePrintCount,
        paperFormat,
      }),
    [
      printModeTab,
      reprintModeType,
      reprintSlotCodes,
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

  const handleSelectReprintSlot = (slotIdx: number) => {
    setActiveReprintSlotIndex(Math.max(0, Math.min(3, slotIdx)));
  };

  const handleClearReprintSlot = (slotIdx: number) => {
    setReprintSlotCodes((prev) => {
      const next = [...prev];
      next[slotIdx] = '';
      return next;
    });
    setPrintPdfError(null);
  };

  const handleUpdateActiveSlotInput = (rawVal: string) => {
    const cleaned = rawVal
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9-]/g, '');
    setReprintSlotCodes((prev) => {
      const next = [...prev];
      next[activeReprintSlotIndex] = cleaned;
      return next;
    });
    setPrintPdfError(null);
  };

  const handleAssignChipToActiveSlot = (lotCode: string) => {
    const norm = normalizeLotNumber(lotCode);
    setReprintSlotCodes((prev) => {
      const next = [...prev];
      const current = normalizeLotNumber(next[activeReprintSlotIndex]);
      next[activeReprintSlotIndex] = current === norm ? '' : norm;
      return next;
    });
    setPrintPdfError(null);
  };

  const handleLoadLotForRedownloadFromLedger = (lotCode: string) => {
    const norm = normalizeLotNumber(lotCode);
    setReprintSlotCodes((prev) => {
      const next = [...prev];
      next[activeReprintSlotIndex] = norm;
      return next;
    });
    setAuditAssignedInSession(true);
    setPrintPdfError(null);
    onShowToast?.(`${norm} → Slot ${activeReprintSlotIndex + 1}.`);
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
    if (!customLotPrefix) {
      onShowToast?.('Buat atau pilih prefix seri terlebih dahulu.');
      return;
    }
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
      `Urutan "${customLotPrefix}" diatur mulai dari #${String(parsed).padStart(3, '0')}.`
    );
  };

  const handleResetSkipStartSequence = () => {
    if (!customLotPrefix) return;
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

    const slotSnapshot = [...activePrintSlots];
    const freshSnapshot = [...freshLotsToLock];
    setPrintPdfError(null);
    setIsGeneratingPdf(true);

    try {
      const { blob, filename, physicalPageCount } = generateA4GradeCardsPdf({
        lotBatchNumbers: slotSnapshot,
        packagingChoices: cardPackagingChoices,
        duplexMode,
        customPrefix: customLotPrefix,
        graderName: activeGraderName,
        printYear,
        blankUnusedSlots,
      });

      const validPrintedLots = slotSnapshot.filter((l): l is string => Boolean(l));
      if (validPrintedLots.length > 0) {
        upsertPrintedLotMetadata({
          lots: validPrintedLots,
          graderName: activeGraderName,
          printYear,
        });
      }

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
          `PDF Custom Printing (${parsedReprintLots.join(', ')}) dibuat — urutan nomor baru tetap aman.`
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

    const freshSnapshot = [...freshLotsToLock];
    setPrintPdfError(null);

    upsertPrintedLotMetadata({
      lots: lotBatchNumbers,
      graderName: activeGraderName,
      printYear,
    });

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

    upsertPrintedLotMetadata({
      lots: activePending.lots,
      graderName: activeGraderName,
      printYear,
    });

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

  const batchRangeText =
    lotBatchNumbers.length === 0
      ? printModeTab === 'new' && !customLotPrefix
        ? 'Tambah prefix dulu'
        : 'Pilih nomor seri'
      : lotBatchNumbers.length === 1
        ? lotBatchNumbers[0]
        : printModeTab === 'reprint'
          ? lotBatchNumbers.length <= 3
            ? lotBatchNumbers.join(', ')
            : `${lotBatchNumbers.slice(0, 2).join(', ')} +${lotBatchNumbers.length - 2} lainnya`
          : `${lotBatchNumbers[0]} – ${lotBatchNumbers[lotBatchNumbers.length - 1]}`;

  const outputYieldText = isThermalMode
    ? `${lotBatchNumbers.length} Slip ${paperFormat === 'THERMAL_58' ? '58mm' : '80mm'}`
    : `${a4Pages.length} Lbr A4 (${totalA4SheetPages} Hal${
        duplexMode !== 'OFF' ? ' Bolak-Balik' : ''
      })`;

  const primaryDisabled = isGeneratingPdf || lotBatchNumbers.length === 0;

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
            <header className="px-4 sm:px-6 py-2.5 border-b border-zinc-800/90 bg-[#08090d] flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Left: Title + Live Range */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0d0f14] border border-amber-500/65 flex items-center justify-center text-amber-300 shrink-0">
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

              {/* Center: Alucard Marked Edge-Plate Swapper (Seri Baru ⇄ Custom Printing) */}
              <div
                role="tablist"
                aria-label="Mode Cetak"
                className="inline-flex items-center p-1 rounded-xl bg-[#040507] border border-amber-500/50 gap-1 shrink-0"
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
                  className={`relative h-8 px-3.5 rounded-lg text-xs border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] ${
                    printModeTab === 'new'
                      ? 'bg-[#12141c] text-amber-200 border-amber-500/80 font-extrabold'
                      : 'bg-[#090a0e] text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white font-semibold'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Seri Baru</span>
                  {printModeTab === 'new' && (
                    <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-amber-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintModeTab((prev) => (prev === 'new' ? 'reprint' : 'new'));
                    setPrintPdfError(null);
                  }}
                  aria-label="Tukar Mode Cetak"
                  title="Tukar antara Seri Baru dan Custom Printing"
                  className="h-7 w-7 rounded-lg text-amber-400/85 hover:text-amber-300 hover:bg-amber-500/10 inline-flex items-center justify-center shrink-0 cursor-pointer transition-[color,background-color,transform] duration-150 active:scale-95"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
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
                  className={`relative h-8 px-3.5 rounded-lg text-xs border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] ${
                    printModeTab === 'reprint'
                      ? 'bg-[#12141c] text-amber-200 border-amber-500/80 font-extrabold'
                      : 'bg-[#090a0e] text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white font-semibold'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Custom Printing</span>
                  {printModeTab === 'reprint' && (
                    <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-amber-400" />
                  )}
                </button>
              </div>

              {/* Right: Audit Launcher + Close */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {onSwitchToScanner && (
                  <button
                    type="button"
                    onClick={onSwitchToScanner}
                    aria-label="Ke Scan"
                    className="alucard-edge-btn-quiet h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="alucard-edge-btn h-8 px-2.5 sm:px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="alucard-edge-btn-quiet h-8 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
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
                        {customLotPrefix && (
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
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
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
                            data-testid="add-prefix-btn"
                            onClick={() => setIsAddingPrefix(true)}
                            className="h-8 px-3 rounded-lg bg-black hover:bg-[#0d0f14] border border-dashed border-amber-500/65 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Prefix Baru</span>
                          </button>
                        )}
                      </div>

                      {prefixRegistry.registeredPrefixes.length === 0 && !isAddingPrefix && (
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          Belum ada prefix. Klik <strong className="text-amber-300">+ Prefix Baru</strong> (mis. MTL, TMG) untuk membuat nomor seri.
                        </p>
                      )}

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
                  (() => {
                    const activeSlotRaw = reprintSlotCodes[activeReprintSlotIndex] || '';
                    const activeSlotNorm = normalizeLotNumber(activeSlotRaw);
                    const isActiveSlotStocked = Boolean(
                      activeSlotNorm && stockedLotSet.has(activeSlotNorm)
                    );
                    const isActiveSlotPrinted = Boolean(
                      activeSlotNorm && printedLotSet.has(activeSlotNorm)
                    );
                    const isActiveSlotRed = isActiveSlotStocked || isActiveSlotPrinted;

                    return (
                      <div className="divide-y divide-zinc-800/80">
                        <section className="p-3.5 sm:p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <h3 className="text-xs font-extrabold text-zinc-200 tracking-wide truncate">
                                1. Pilih Nomor · Slot {activeReprintSlotIndex + 1}
                              </h3>
                              {activeSlotNorm && (
                                <span
                                  className={`text-[10px] font-extrabold shrink-0 ${
                                    isActiveSlotRed ? 'text-red-400' : 'text-amber-300'
                                  }`}
                                >
                                  {isActiveSlotStocked
                                    ? 'Sudah di Stok'
                                    : isActiveSlotPrinted
                                      ? 'Sudah Dicetak'
                                      : 'Belum Tercatat'}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              data-testid="reprint-pick-audit-btn"
                              onClick={handleOpenAuditModal}
                              className="h-7 px-2.5 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/75 text-[11px] font-extrabold text-amber-300 cursor-pointer shrink-0 transition-colors"
                            >
                              Pilih Nomor
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              id="reprint-lots-input"
                              type="text"
                              value={activeSlotRaw}
                              onChange={(e) => handleUpdateActiveSlotInput(e.target.value)}
                              placeholder={`Nomor untuk Slot ${activeReprintSlotIndex + 1} (mis. MTL005)`}
                              className={`flex-1 min-w-0 h-10 px-3 rounded-lg bg-black border font-mono text-xs font-bold focus:outline-hidden transition-colors ${
                                isActiveSlotRed
                                  ? 'border-red-500/85 text-red-300 focus:border-red-400'
                                  : 'border-amber-500/70 text-amber-300 focus:border-amber-400'
                              }`}
                            />
                            {activeSlotRaw && (
                              <button
                                type="button"
                                onClick={() => handleClearReprintSlot(activeReprintSlotIndex)}
                                aria-label={`Kosongkan Slot ${activeReprintSlotIndex + 1}`}
                                title={`Kosongkan Slot ${activeReprintSlotIndex + 1}`}
                                className="h-10 px-2.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-xs font-bold shrink-0 cursor-pointer transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Quick Slot 1..4 Position Switcher inside Pilih Nomor */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-zinc-400">
                                {isThermalMode
                                  ? 'Slot Kartu Cetak (1–4):'
                                  : 'Slot Posisi Kertas A4 (1–4 · digabung dalam 1 lembar):'}
                              </span>
                              {parsedReprintLots.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReprintSlotCodes(['', '', '', ''])
                                  }
                                  className="text-[10px] font-bold text-zinc-400 hover:text-red-300 cursor-pointer"
                                >
                                  Reset Semua
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[0, 1, 2, 3].map((slotIdx) => {
                                const code = normalizeLotNumber(reprintSlotCodes[slotIdx]);
                                const isActiveSlot = activeReprintSlotIndex === slotIdx;
                                const isRedCode = Boolean(
                                  code && printedOrStockedLotSet.has(code)
                                );
                                return (
                                  <div
                                    key={slotIdx}
                                    className={`flex items-stretch rounded-lg border overflow-hidden transition-colors ${
                                      isActiveSlot
                                        ? isRedCode
                                          ? 'bg-[#170709] border-red-400'
                                          : 'bg-[#0d0f14] border-amber-500/90'
                                        : isRedCode
                                          ? 'bg-[#100507] border-red-500/45 hover:border-red-400/80'
                                          : 'bg-black border-zinc-800 hover:border-zinc-700'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      data-testid={`reprint-slot-btn-${slotIdx + 1}`}
                                      onClick={() => handleSelectReprintSlot(slotIdx)}
                                      className="flex-1 min-w-0 px-2.5 py-1.5 text-left cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span
                                          className={`text-[10px] font-extrabold uppercase tracking-wider ${
                                            isActiveSlot ? 'text-amber-300' : 'text-zinc-500'
                                          }`}
                                        >
                                          Slot {slotIdx + 1}
                                        </span>
                                      </div>
                                      <div
                                        className={`font-mono text-xs font-black truncate mt-0.5 ${
                                          !code
                                            ? 'text-zinc-600 font-semibold'
                                            : isRedCode
                                              ? 'text-red-400'
                                              : 'text-amber-300'
                                        }`}
                                      >
                                        {code || 'Kosong'}
                                      </div>
                                    </button>
                                    {code && (
                                      <button
                                        type="button"
                                        data-testid={`clear-reprint-slot-${slotIdx + 1}`}
                                        onClick={() => handleClearReprintSlot(slotIdx)}
                                        aria-label={`Hapus nomor dari Slot ${slotIdx + 1}`}
                                        title={`Hapus dari Slot ${slotIdx + 1}`}
                                        className="w-7 flex items-center justify-center border-l border-zinc-800/80 text-zinc-500 hover:text-red-300 hover:bg-black/40 cursor-pointer shrink-0 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {recentPrintableLotsForChips.length > 0 && (
                            <div className="space-y-1.5 pt-0.5">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold text-zinc-400">
                                  Seri Terakhir:
                                </span>
                                <span className="text-[10px] font-bold text-red-400">
                                  Merah = Sudah dicetak / stok
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {recentPrintableLotsForChips.map((lotCode) => {
                                  const isInActiveSlot = activeSlotNorm === lotCode;
                                  const isInAnySlot = parsedReprintLots.includes(lotCode);
                                  const isPrintedOrStock = printedOrStockedLotSet.has(lotCode);
                                  return (
                                    <button
                                      key={lotCode}
                                      type="button"
                                      onClick={() => handleAssignChipToActiveSlot(lotCode)}
                                      className={`h-7 px-2.5 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-colors ${
                                        isPrintedOrStock
                                          ? isInActiveSlot
                                            ? 'bg-[#21090c] text-red-200 border-red-400'
                                            : isInAnySlot
                                              ? 'bg-[#170609] text-red-300 border-red-500/80'
                                              : 'bg-[#110507] hover:bg-[#1a080b] text-red-400 border-red-500/45'
                                          : isInActiveSlot
                                            ? 'bg-[#0d0f14] text-amber-300 border-amber-400'
                                            : isInAnySlot
                                              ? 'bg-[#0d0f14] text-amber-200 border-amber-500/60'
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
                              <div className="text-xs font-extrabold">Slot Terpilih 1–4</div>
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
                                Isi slot kosong dengan seri baru agar penuh 1 A4
                              </div>
                            </button>
                          </div>
                        </section>

                      </div>
                    );
                  })()
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
                          <span>A4 4/Hal</span>
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
                      {printModeTab === 'reprint' ? 'Custom Printing:' : 'Seri Berikutnya:'}
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
                  {printModeTab === 'new' && !customLotPrefix ? (
                    <div className="h-full min-h-[260px] rounded-xl border border-dashed border-zinc-800 bg-[#07080b] flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <Layers className="w-7 h-7 text-amber-400" />
                      <div className="space-y-1 max-w-md">
                        <div className="text-sm font-extrabold text-white">
                          Belum Ada Prefix Seri Kartu
                        </div>
                        <p className="text-xs text-zinc-400">
                          Buat prefix seri terlebih dahulu (contoh: <b className="font-mono text-amber-300">MTL</b> atau <b className="font-mono text-amber-300">TMG</b>) agar nomor kartu dan barcode bisa dicetak.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingPrefix(true)}
                        className="h-9 px-4 rounded-xl bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat Prefix Baru</span>
                      </button>
                    </div>
                  ) : isWaitingReprintInput ? (
                    <div className="h-full min-h-[260px] rounded-xl border border-dashed border-zinc-800 bg-[#07080b] flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <RotateCcw className="w-7 h-7 text-zinc-500" />
                      <div className="space-y-1 max-w-md">
                        <div className="text-sm font-extrabold text-white">
                          Pilih Slot 1–4 &amp; Isi Nomor Kartu
                        </div>
                        <p className="text-xs text-zinc-400">
                          Klik Slot 1–4 di panel kiri lalu ketik nomor seri, pilih dari{' '}
                          <strong className="text-red-400">Seri Terakhir</strong>, atau tekan{' '}
                          <strong className="text-amber-300">Pilih Nomor</strong> untuk menggabungkan beberapa kartu pada 1 lembar A4 (4 Kartu Besar).
                        </p>
                      </div>
                    </div>
                  ) : isThermalMode ? (
                    <div className="py-2 flex flex-wrap items-start justify-center gap-5">
                      {lotBatchNumbers.map((lot, tIdx) => (
                        <div key={`${tIdx}-${lot}`} className="shadow-2xl">
                          <ThermalGradeCardPaper
                            lotNumber={lot}
                            packagingChoices={cardPackagingChoices}
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
                                <span>HALAMAN A4 #{pageIdx + 1} — SISI DEPAN (4 KARTU BESAR)</span>
                                <span>POTONG GARIS TEPI HITAM</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr gap-4">
                                {pageLots.map((lot, sIdx) => (
                                  <PrintableGradeCardPaper
                                    key={`${pageIdx}-front-${sIdx}-${lot || 'empty'}`}
                                    lotNumber={lot}
                                    packagingChoices={cardPackagingChoices}
                                    compact={false}
                                    graderName={activeGraderName}
                                    printYear={printYear}
                                    previewEmptySlotLabel={
                                      printModeTab === 'reprint' &&
                                      reprintModeType === 'SLOT_TERPILIH'
                                        ? `Slot ${sIdx + 1} · Kosong`
                                        : undefined
                                    }
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr gap-4">
                                  {backSlots.map((slot, sIdx) => (
                                    <PrintableGradeCardBackPaper
                                      key={`${pageIdx}-back-${sIdx}`}
                                      lotNumber={slot.lot}
                                      customPrefix={customLotPrefix}
                                      compact={false}
                                      rotate180={slot.rotate180}
                                      blankUnusedSlots={blankUnusedSlots}
                                      graderName={activeGraderName}
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
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={handleSystemPrintAttempt}
                      disabled={lotBatchNumbers.length === 0}
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

      {/* Full-Screen Individual Panel: 100-Number 2-Box Prefix Audit Matrix (Read-Only) + Slot 1–6 Picker */}
      {typeof document !== 'undefined' &&
        isOpen &&
        isAuditModalOpen &&
        createPortal(
          <div
            data-testid="prefix-audit-ledger-panel"
            className="fixed inset-0 z-[140] bg-[#07080b] text-white flex flex-col overflow-hidden"
          >
            {/* Top Bar: Prefix Switcher (Prev / Select / Next) + Legend + Apply/Close */}
            <div className="px-3 sm:px-5 py-2.5 border-b border-zinc-800 bg-[#0b0c10] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black tracking-wide text-white">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Audit 100 Nomor</span>
                </span>
                {activeAuditLedger && (
                  <span className="text-[11px] font-semibold text-zinc-400">
                    · Read-Only ·{' '}
                    {activeAuditLedger.isDeletedPrefix
                      ? 'Arsip Terhapus'
                      : activeAuditLedger.isAutoDaily
                        ? 'Arsip Harian'
                        : 'Aktif'}
                  </span>
                )}

                {activeAuditLedger?.isDeletedPrefix && (
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
              {activeAuditLedger && prefixAuditLedgers.length > 0 && (
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
              )}

              {/* Status Tickbox Legend + Apply/Close */}
              <div className="flex flex-wrap items-center gap-2.5">
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

                {occupiedReprintSlotCount > 0 && (
                  <button
                    type="button"
                    data-testid="apply-audit-slots-btn"
                    onClick={() => handleCloseAuditModal(true)}
                    className="alucard-edge-btn h-8 px-3 rounded-lg text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Pakai ke Cetak ({occupiedReprintSlotCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="close-fullscreen-audit-panel-btn"
                  onClick={() => handleCloseAuditModal(false)}
                  className="alucard-edge-btn-quiet h-8 px-3 rounded-lg text-xs font-black inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>

            {/* Embedded Slot 1–6 Picker Bar inside Audit Panel */}
            <div
              data-testid="audit-panel-slots-bar"
              className="px-3 sm:px-5 py-2 border-b border-zinc-800/80 bg-[#050608] space-y-1.5 shrink-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-extrabold text-zinc-200">
                    Slot Custom Printing (1–4)
                  </span>
                  <span className="text-zinc-500 hidden sm:inline">
                    · Pilih slot aktif lalu klik kotak Hijau/Kuning di bawah
                  </span>
                  <span className="font-bold text-red-400">
                    · Merah = sudah dicetak / stok
                  </span>
                </div>
                {occupiedReprintSlotCount > 0 && (
                  <button
                    type="button"
                    data-testid="audit-reset-slots-btn"
                    onClick={() => setReprintSlotCodes(['', '', '', ''])}
                    className="text-[11px] font-bold text-zinc-400 hover:text-red-300 cursor-pointer"
                  >
                    Reset Semua
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const code = normalizeLotNumber(reprintSlotCodes[slotIdx]);
                  const isActiveSlot = activeReprintSlotIndex === slotIdx;
                  const isRedCode = Boolean(code && printedOrStockedLotSet.has(code));
                  return (
                    <div
                      key={slotIdx}
                      className={`flex items-stretch rounded-lg border overflow-hidden transition-colors ${
                        isActiveSlot
                          ? isRedCode
                            ? 'bg-[#170709] border-red-400'
                            : 'bg-[#0d0f14] border-amber-500/90'
                          : isRedCode
                            ? 'bg-[#100507] border-red-500/45 hover:border-red-400/80'
                            : 'bg-black border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <button
                        type="button"
                        data-testid={`audit-slot-btn-${slotIdx + 1}`}
                        onClick={() => handleSelectReprintSlot(slotIdx)}
                        className="flex-1 min-w-0 px-2.5 py-1 text-left cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wider ${
                              isActiveSlot ? 'text-amber-300' : 'text-zinc-500'
                            }`}
                          >
                            Slot {slotIdx + 1}
                          </span>
                        </div>
                        <div
                          className={`font-mono text-xs font-black truncate ${
                            !code
                              ? 'text-zinc-600 font-semibold'
                              : isRedCode
                                ? 'text-red-400'
                                : 'text-amber-300'
                          }`}
                        >
                          {code || 'Kosong'}
                        </div>
                      </button>
                      {code && (
                        <button
                          type="button"
                          data-testid={`clear-audit-slot-${slotIdx + 1}`}
                          onClick={() => handleClearReprintSlot(slotIdx)}
                          aria-label={`Hapus nomor dari Slot ${slotIdx + 1}`}
                          title={`Hapus dari Slot ${slotIdx + 1}`}
                          className="w-7 flex items-center justify-center border-l border-zinc-800/80 text-zinc-500 hover:text-red-300 hover:bg-black/40 cursor-pointer shrink-0 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {activeAuditLedger && activeAuditGridBlock ? (
              <>
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
                      const assignedSlots = slotAssignmentsByLot.get(entry.lotCode);
                      const isInActiveSlot =
                        normalizeLotNumber(reprintSlotCodes[activeReprintSlotIndex]) ===
                        entry.lotCode;
                      const tooltip = isStock
                        ? `${entry.lotCode} · Terdaftar Stok: ${entry.stockName || 'Gudang'} (Klik untuk pasang ke Slot ${activeReprintSlotIndex + 1})`
                        : isPrintedOnly
                          ? `${entry.lotCode} · Sudah Dicetak, belum masuk stok (Klik untuk pasang ke Slot ${activeReprintSlotIndex + 1})`
                          : `${entry.lotCode} · Belum Dicetak`;

                      const content = (
                        <>
                          <span
                            className={`flex-1 py-2 font-mono font-black tracking-tight text-left truncate flex items-center justify-between gap-1 ${
                              entry.lotCode.length > 9 ? 'text-[10px] px-1.5' : 'text-xs px-2'
                            } ${
                              isStock
                                ? 'text-emerald-200'
                                : isPrintedOnly
                                  ? 'text-amber-200'
                                  : 'text-zinc-500'
                            }`}
                          >
                            <span className="truncate">{entry.lotCode}</span>
                            {assignedSlots && assignedSlots.length > 0 && (
                              <span
                                className={`text-[9px] font-black px-1 py-0.5 rounded shrink-0 ${
                                  isInActiveSlot
                                    ? 'bg-red-500 text-white'
                                    : 'bg-red-950/90 text-red-300 border border-red-500/60'
                                }`}
                              >
                                S{assignedSlots.join(',')}
                              </span>
                            )}
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
                              isInActiveSlot
                                ? 'bg-[#1c090c] border-red-400 ring-1 ring-red-400/70'
                                : assignedSlots
                                  ? 'bg-[#140709] border-red-500/75 hover:border-red-400'
                                  : isStock
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
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2">
                <Grid3X3 className="w-8 h-8 text-zinc-600" />
                <div className="text-sm font-extrabold text-white">
                  Belum Ada Riwayat Nomor
                </div>
                <p className="text-xs text-zinc-400 max-w-md">
                  Buat <strong className="text-amber-300">Prefix Baru</strong> di tab{' '}
                  <strong className="text-white">Seri Baru</strong> (contoh: MTL, TMG) untuk mulai mencatat status 100 nomor per seri.
                </p>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Dedicated Dynamic Print Portal (A4 Front/Back Duplex or Thermal 58mm/80mm) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="grade-card-print-portal">
            <style>{buildDynamicPrintPageCss(paperFormat)}</style>
            {isThermalMode
              ? lotBatchNumbers.map((lot, tIdx) => (
                  <ThermalGradeCardPaper
                    key={`portal-thermal-${tIdx}-${lot}`}
                    lotNumber={lot}
                    packagingChoices={cardPackagingChoices}
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
                          gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                          gap: `${A4_PRINT_PAGE_METRICS.gridGapMm}mm`,
                          height: `${A4_PRINT_PAGE_METRICS.pageHeightMm}mm`,
                          maxHeight: `${A4_PRINT_PAGE_METRICS.pageHeightMm}mm`,
                        }}
                      >
                        {pageLots.map((lot, sIdx) => (
                          <PrintableGradeCardPaper
                            key={`portal-front-${pageIdx}-${sIdx}-${lot || 'empty'}`}
                            lotNumber={lot}
                            packagingChoices={cardPackagingChoices}
                            compact={false}
                            graderName={activeGraderName}
                            printYear={printYear}
                          />
                        ))}
                      </div>

                      {duplexMode !== 'OFF' && (
                        <div
                          className="grade-card-a4-page grid grid-cols-2"
                          style={{
                            gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
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
                              compact={false}
                              rotate180={slot.rotate180}
                              blankUnusedSlots={blankUnusedSlots}
                              graderName={activeGraderName}
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
