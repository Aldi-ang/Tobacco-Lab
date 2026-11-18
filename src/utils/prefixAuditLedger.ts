import { RawTobacco } from '../types/tobacco';
import { normalizeLotNumber } from './gradeCardEngine';
import {
  PrefixRegistryState,
  extractCustomGenerationPrefixFromLot,
  getPrefixStartSequence,
  isAutoDailyPrefix,
  normalizePrefixInput,
} from './prefixRegistryEngine';

export type LedgerLotStatus =
  | 'STOCK_REGISTERED'
  | 'PRINTED_NOT_STOCK'
  | 'NOT_PRINTED';

export interface PrefixLedgerLotEntry {
  seq: number;
  lotCode: string;
  status: LedgerLotStatus;
  isPrinted: boolean;
  isRegisteredStock: boolean;
  stockName?: string;
  purchaseDate?: string;
  graderName?: string;
  colorGrade?: string;
}

export interface PrefixAuditLedgerSummary {
  prefixKey: string; // Custom prefix (e.g. 'MTL', 'TMG-') OR daily prefix (e.g. 'LOT-261116-')
  displayLabel: string;
  isAutoDaily: boolean;
  isActiveInQuickList: boolean;
  isDeletedPrefix: boolean; // Removed from quick-select, history preserved read-only
  highestSeq: number;
  minStartSeq: number;
  nextNewLot: string;
  stockRegisteredCount: number;
  printedNotStockCount: number;
  printedTotalCount: number;
  unprintedGapCount: number;
  entries: PrefixLedgerLotEntry[]; // Ordered seq ascending (#001..highestTracked)
  leadingSkippedRange: { fromSeq: number; toSeq: number; count: number } | null;
}

export interface PreviousPrefixDetection {
  prefixKey: string;
  hasPreviousData: boolean;
  wasDeletedFromQuickList: boolean;
  isCurrentlyActive: boolean;
  printedCount: number;
  stockCount: number;
  highestSeq: number;
  savedMinStartSeq: number | null;
  nextContinueSeq: number;
  nextContinueLot: string;
  highestLotCode: string | null;
}

export type ReprintReasonCode =
  | 'CACAT_TINTA'
  | 'KARTU_HILANG'
  | 'RUSAK_FISIK';

export const REPRINT_REASON_OPTIONS: {
  code: ReprintReasonCode;
  label: string;
  shortDesc: string;
}[] = [
  {
    code: 'CACAT_TINTA',
    label: 'Cacat Tinta / Macet',
    shortDesc: 'Hasil print buram, terpotong, atau tinta habis',
  },
  {
    code: 'KARTU_HILANG',
    label: 'Kartu Hilang',
    shortDesc: 'Kartu fisik tercecer sebelum / sesudah timbang',
  },
  {
    code: 'RUSAK_FISIK',
    label: 'Kartu Rusak / Sobek',
    shortDesc: 'Kartu basah, terlipat parah, atau barcode tidak terbaca',
  },
];

export interface ReprintWarningEvaluation {
  requestedLots: string[];
  stockedItems: {
    lotCode: string;
    stockName: string;
    purchaseDate: string;
    isAlsoPrinted: boolean;
  }[];
  printedOnlyLots: string[];
  unprintedLots: string[];
  hasCriticalStockWarning: boolean;
  hasPrintedWarning: boolean;
  requiresAcknowledgment: boolean;
  severity: 'NONE' | 'UNPRINTED_INFO' | 'PRINTED_WARNING' | 'CRITICAL_STOCK';
  title: string;
  description: string;
}

/**
 * Pure safety gate for factory reprint operations:
 * requires both an explicit reason code and operator confirmation
 * whenever a lot has already been printed or registered as warehouse stock.
 */
export function isReprintSafetySatisfied(params: {
  warning: ReprintWarningEvaluation;
  reason: ReprintReasonCode | null;
  confirmed: boolean;
}): boolean {
  if (!params.warning.requiresAcknowledgment) return true;
  return Boolean(params.reason) && Boolean(params.confirmed);
}

const DAILY_LOT_RE = /^(LOT-\d{6}-)(\d+)$/;

/**
 * Extracts normalized prefixKey & positive integer sequence from a Lot code.
 */
export function parseLotPrefixAndSeq(
  lotCode: string,
  knownCustomPrefixes: string[] = []
): { prefixKey: string; isAutoDaily: boolean; seq: number } | null {
  const norm = normalizeLotNumber(lotCode);
  if (!norm) return null;

  const dailyMatch = norm.match(DAILY_LOT_RE);
  if (dailyMatch) {
    const seq = parseInt(dailyMatch[2], 10);
    if (Number.isFinite(seq) && seq >= 1) {
      return { prefixKey: dailyMatch[1], isAutoDaily: true, seq };
    }
  }

  // Prefer longest known prefix match first (e.g. MTL2- vs MTL)
  const sortedKnown = Array.from(
    new Set(
      knownCustomPrefixes
        .map((p) => normalizePrefixInput(p))
        .filter((p) => p && !isAutoDailyPrefix(p))
    )
  ).sort((a, b) => b.length - a.length);

  for (const pref of sortedKnown) {
    if (norm.startsWith(pref)) {
      const rest = norm.slice(pref.length);
      if (/^\d+$/.test(rest)) {
        const seq = parseInt(rest, 10);
        if (Number.isFinite(seq) && seq >= 1) {
          return { prefixKey: pref, isAutoDaily: false, seq };
        }
      }
    }
  }

  const extracted = extractCustomGenerationPrefixFromLot(norm);
  if (extracted) {
    const rest = norm.slice(extracted.length);
    if (/^\d+$/.test(rest)) {
      const seq = parseInt(rest, 10);
      if (Number.isFinite(seq) && seq >= 1) {
        return { prefixKey: extracted, isAutoDaily: false, seq };
      }
    }
  }

  return null;
}

export function formatLotCode(prefixKey: string, seq: number): string {
  return `${prefixKey}${String(Math.max(1, Math.floor(seq))).padStart(3, '0')}`;
}

/**
 * Detects whether a prefix draft matches previously recorded / deleted prefix history
 * so re-adding it automatically preserves and continues the older sequence.
 */
export function detectPreviousPrefixHistory(params: {
  rawPrefix: string;
  rawTobaccos: RawTobacco[];
  issuedPrintedLots: string[];
  prefixRegistry: PrefixRegistryState;
}): PreviousPrefixDetection | null {
  const norm = normalizePrefixInput(params.rawPrefix);
  if (!norm || isAutoDailyPrefix(norm)) return null;

  const dismissedSet = new Set(
    (params.prefixRegistry.dismissedPrefixes || []).map((p) => normalizePrefixInput(p))
  );
  const activeSet = new Set(
    (params.prefixRegistry.registeredPrefixes || []).map((p) => normalizePrefixInput(p))
  );

  const knownPrefixes = Array.from(new Set([...activeSet, ...dismissedSet, norm]));
  let printedCount = 0;
  let stockCount = 0;
  let highestSeq = 0;
  let highestLotCode: string | null = null;

  const printedSet = new Set<string>();
  for (const lot of params.issuedPrintedLots) {
    const parsed = parseLotPrefixAndSeq(lot, knownPrefixes);
    if (parsed && parsed.prefixKey === norm) {
      const code = normalizeLotNumber(lot);
      if (!printedSet.has(code)) {
        printedSet.add(code);
        printedCount++;
      }
      if (parsed.seq > highestSeq) {
        highestSeq = parsed.seq;
        highestLotCode = code;
      }
    }
  }

  const stockSeen = new Set<string>();
  for (const item of params.rawTobaccos) {
    const parsed = parseLotPrefixAndSeq(item.lotNumber || '', knownPrefixes);
    if (parsed && parsed.prefixKey === norm) {
      const code = normalizeLotNumber(item.lotNumber);
      if (!stockSeen.has(code)) {
        stockSeen.add(code);
        stockCount++;
      }
      if (parsed.seq > highestSeq) {
        highestSeq = parsed.seq;
        highestLotCode = code;
      }
    }
  }

  const savedMinStartSeq = getPrefixStartSequence(params.prefixRegistry, norm);
  const wasDeletedFromQuickList = dismissedSet.has(norm) && !activeSet.has(norm);
  const isCurrentlyActive = activeSet.has(norm);
  const hasPreviousData =
    wasDeletedFromQuickList ||
    printedCount > 0 ||
    stockCount > 0 ||
    (savedMinStartSeq !== null && savedMinStartSeq >= 2);

  const nextContinueSeq = Math.max(highestSeq + 1, savedMinStartSeq ?? 1);
  const nextContinueLot = formatLotCode(norm, nextContinueSeq);

  return {
    prefixKey: norm,
    hasPreviousData,
    wasDeletedFromQuickList,
    isCurrentlyActive,
    printedCount,
    stockCount,
    highestSeq,
    savedMinStartSeq,
    nextContinueSeq,
    nextContinueLot,
    highestLotCode,
  };
}

/**
 * Builds immutable, read-only audit ledgers for ALL prefixes ever used (active AND deleted/archived),
 * classifying each lot number as Registered as Stock, Printed (not yet stock), or Unprinted/Skipped gap.
 */
export function buildPrefixAuditLedgers(params: {
  rawTobaccos: RawTobacco[];
  issuedPrintedLots: string[];
  prefixRegistry: PrefixRegistryState;
}): PrefixAuditLedgerSummary[] {
  const { rawTobaccos, issuedPrintedLots, prefixRegistry } = params;

  const activeList = (prefixRegistry.registeredPrefixes || [])
    .map((p) => normalizePrefixInput(p))
    .filter((p) => p && !isAutoDailyPrefix(p));
  const activeSet = new Set(activeList);

  const dismissedList = (prefixRegistry.dismissedPrefixes || [])
    .map((p) => normalizePrefixInput(p))
    .filter((p) => p && !isAutoDailyPrefix(p));
  const dismissedSet = new Set(dismissedList);

  const skippedFloorKeys = Object.keys(prefixRegistry.minStartSeqByPrefix || {})
    .map((k) => normalizePrefixInput(k))
    .filter((k) => k && k !== '__AUTO_DAILY__' && !isAutoDailyPrefix(k));

  const knownCustomPrefixes = Array.from(
    new Set([...activeList, ...dismissedList, ...skippedFloorKeys])
  );

  interface Bucket {
    prefixKey: string;
    isAutoDaily: boolean;
    printedSet: Set<string>;
    stockMap: Map<string, RawTobacco>;
    seqsPresent: Set<number>;
    maxSeenSeq: number;
  }

  const buckets = new Map<string, Bucket>();
  const ensureBucket = (prefixKey: string, isAutoDaily: boolean): Bucket => {
    let existing = buckets.get(prefixKey);
    if (!existing) {
      existing = {
        prefixKey,
        isAutoDaily,
        printedSet: new Set(),
        stockMap: new Map(),
        seqsPresent: new Set(),
        maxSeenSeq: 0,
      };
      buckets.set(prefixKey, existing);
    }
    return existing;
  };

  for (const pref of knownCustomPrefixes) {
    ensureBucket(pref, false);
  }

  for (const lot of issuedPrintedLots) {
    const parsed = parseLotPrefixAndSeq(lot, knownCustomPrefixes);
    if (!parsed) continue;
    const b = ensureBucket(parsed.prefixKey, parsed.isAutoDaily);
    const normCode = normalizeLotNumber(lot);
    b.printedSet.add(normCode);
    b.seqsPresent.add(parsed.seq);
    if (parsed.seq > b.maxSeenSeq) b.maxSeenSeq = parsed.seq;
  }

  for (const item of rawTobaccos) {
    const parsed = parseLotPrefixAndSeq(item.lotNumber || '', knownCustomPrefixes);
    if (!parsed) continue;
    const b = ensureBucket(parsed.prefixKey, parsed.isAutoDaily);
    const normCode = normalizeLotNumber(item.lotNumber);
    if (!b.stockMap.has(normCode)) {
      b.stockMap.set(normCode, item);
    }
    b.seqsPresent.add(parsed.seq);
    if (parsed.seq > b.maxSeenSeq) b.maxSeenSeq = parsed.seq;
  }

  const ledgers: PrefixAuditLedgerSummary[] = [];

  for (const b of buckets.values()) {
    const isActiveInQuickList = !b.isAutoDaily && activeSet.has(b.prefixKey);
    const isDeletedPrefix = !b.isAutoDaily && dismissedSet.has(b.prefixKey) && !isActiveInQuickList;
    const savedMinStart = b.isAutoDaily
      ? getPrefixStartSequence(prefixRegistry, '') ?? 1
      : getPrefixStartSequence(prefixRegistry, b.prefixKey) ?? 1;

    // Skip dead dismissed buckets with zero data & no skip offset
    const hasAnyData =
      b.printedSet.size > 0 || b.stockMap.size > 0 || savedMinStart >= 2 || isActiveInQuickList;
    if (!hasAnyData) continue;

    const highestTracked = Math.max(b.maxSeenSeq, savedMinStart - 1);
    const nextSeq = Math.max(b.maxSeenSeq + 1, savedMinStart);
    const nextNewLot = formatLotCode(b.prefixKey, nextSeq);

    // Build status counters & gap-safe entries
    let stockRegisteredCount = 0;
    let printedNotStockCount = 0;
    let printedTotalCount = 0;
    let unprintedGapCount = 0;

    let minRealSeq = Number.POSITIVE_INFINITY;
    for (const s of b.seqsPresent) {
      if (s < minRealSeq) minRealSeq = s;
    }

    // If user jumped to e.g. #5000 with zero lots below #4950, collapse massive leading unprinted gap cleanly
    const MAX_LEADING_INDIVIDUAL_GAPS = 120;
    const effectiveAnchorStart =
      Number.isFinite(minRealSeq) && minRealSeq > MAX_LEADING_INDIVIDUAL_GAPS
        ? minRealSeq - 12
        : highestTracked > MAX_LEADING_INDIVIDUAL_GAPS && !Number.isFinite(minRealSeq)
          ? Math.max(1, highestTracked - 24)
          : 1;

    const leadingSkippedRange =
      effectiveAnchorStart > 1
        ? {
            fromSeq: 1,
            toSeq: effectiveAnchorStart - 1,
            count: effectiveAnchorStart - 1,
          }
        : null;

    if (leadingSkippedRange) {
      unprintedGapCount += leadingSkippedRange.count;
    }

    const entries: PrefixLedgerLotEntry[] = [];
    for (let seq = effectiveAnchorStart; seq <= highestTracked; seq++) {
      const lotCode = formatLotCode(b.prefixKey, seq);
      const stockItem = b.stockMap.get(lotCode);
      const isPrinted = b.printedSet.has(lotCode);
      const isRegisteredStock = Boolean(stockItem);

      if (isPrinted) printedTotalCount++;

      let status: LedgerLotStatus;
      if (isRegisteredStock) {
        status = 'STOCK_REGISTERED';
        stockRegisteredCount++;
      } else if (isPrinted) {
        status = 'PRINTED_NOT_STOCK';
        printedNotStockCount++;
      } else {
        status = 'NOT_PRINTED';
        unprintedGapCount++;
      }

      entries.push({
        seq,
        lotCode,
        status,
        isPrinted,
        isRegisteredStock,
        stockName: stockItem?.name,
        purchaseDate: stockItem?.purchaseDate,
        graderName: stockItem?.graderName,
        colorGrade: stockItem?.colorGrade,
      });
    }

    ledgers.push({
      prefixKey: b.prefixKey,
      displayLabel: b.isAutoDaily ? `Harian (${b.prefixKey.replace(/-$/, '')})` : b.prefixKey,
      isAutoDaily: b.isAutoDaily,
      isActiveInQuickList,
      isDeletedPrefix,
      highestSeq: b.maxSeenSeq,
      minStartSeq: savedMinStart,
      nextNewLot,
      stockRegisteredCount,
      printedNotStockCount,
      printedTotalCount,
      unprintedGapCount,
      entries,
      leadingSkippedRange,
    });
  }

  // Sort: Active selected/custom first, then other custom active, then daily, then deleted/archived prefixes
  return ledgers.sort((a, b) => {
    if (a.isDeletedPrefix !== b.isDeletedPrefix) return a.isDeletedPrefix ? 1 : -1;
    if (a.isAutoDaily !== b.isAutoDaily) return a.isAutoDaily ? 1 : -1;
    if (a.prefixKey === normalizePrefixInput(prefixRegistry.lastSelectedPrefix)) return -1;
    if (b.prefixKey === normalizePrefixInput(prefixRegistry.lastSelectedPrefix)) return 1;
    return b.highestSeq - a.highestSeq;
  });
}

export interface PrefixAuditGridBlock {
  prefixKey: string;
  blockIndex: number;
  totalBlocks: number;
  startSeq: number;
  endSeq: number;
  entries: PrefixLedgerLotEntry[]; // Always 100 entries for the active block
}

/**
 * Builds an exact 100-slot read-only matrix block (#001-#100, #101-#200, ...)
 * for the full-screen per-prefix audit panel.
 */
export function buildPrefixAuditGridBlock(params: {
  ledger: PrefixAuditLedgerSummary;
  rawTobaccos: RawTobacco[];
  issuedPrintedLots: string[];
  prefixRegistry: PrefixRegistryState;
  blockIndex: number;
}): PrefixAuditGridBlock {
  const { ledger, rawTobaccos, issuedPrintedLots, prefixRegistry, blockIndex } = params;

  const activeList = (prefixRegistry.registeredPrefixes || [])
    .map((p) => normalizePrefixInput(p))
    .filter((p) => p && !isAutoDailyPrefix(p));
  const dismissedList = (prefixRegistry.dismissedPrefixes || [])
    .map((p) => normalizePrefixInput(p))
    .filter((p) => p && !isAutoDailyPrefix(p));
  const knownCustomPrefixes = Array.from(
    new Set([...activeList, ...dismissedList, ledger.isAutoDaily ? '' : ledger.prefixKey].filter(Boolean))
  );

  const printedSeqSet = new Set<number>();
  for (const lot of issuedPrintedLots) {
    const parsed = parseLotPrefixAndSeq(lot, knownCustomPrefixes);
    if (parsed && parsed.prefixKey === ledger.prefixKey) {
      printedSeqSet.add(parsed.seq);
    }
  }

  const stockBySeq = new Map<number, RawTobacco>();
  for (const item of rawTobaccos) {
    const parsed = parseLotPrefixAndSeq(item.lotNumber || '', knownCustomPrefixes);
    if (parsed && parsed.prefixKey === ledger.prefixKey && !stockBySeq.has(parsed.seq)) {
      stockBySeq.set(parsed.seq, item);
    }
  }

  const maxRelevantSeq = Math.max(100, ledger.highestSeq, ledger.minStartSeq);
  const totalBlocks = Math.max(1, Math.ceil(maxRelevantSeq / 100));
  const safeBlockIndex = Math.max(0, Math.min(totalBlocks - 1, Math.floor(blockIndex)));
  const startSeq = safeBlockIndex * 100 + 1;
  const endSeq = startSeq + 99;

  const entries: PrefixLedgerLotEntry[] = [];
  for (let seq = startSeq; seq <= endSeq; seq++) {
    const lotCode = formatLotCode(ledger.prefixKey, seq);
    const stockItem = stockBySeq.get(seq);
    const isPrinted = printedSeqSet.has(seq);
    const isRegisteredStock = Boolean(stockItem);

    const status: LedgerLotStatus = isRegisteredStock
      ? 'STOCK_REGISTERED'
      : isPrinted
        ? 'PRINTED_NOT_STOCK'
        : 'NOT_PRINTED';

    entries.push({
      seq,
      lotCode,
      status,
      isPrinted,
      isRegisteredStock,
      stockName: stockItem?.name,
      purchaseDate: stockItem?.purchaseDate,
      graderName: stockItem?.graderName,
      colorGrade: stockItem?.colorGrade,
    });
  }

  return {
    prefixKey: ledger.prefixKey,
    blockIndex: safeBlockIndex,
    totalBlocks,
    startSeq,
    endSeq,
    entries,
  };
}

/**
 * Evaluates reprint/redownload risk for requested older lot codes and builds explicit warnings.
 */
export function evaluateReprintWarnings(params: {
  reprintLots: string[];
  rawTobaccos: RawTobacco[];
  issuedPrintedLots: string[];
}): ReprintWarningEvaluation {
  const requestedLots = Array.from(
    new Set((params.reprintLots || []).map((l) => normalizeLotNumber(l)).filter(Boolean))
  );

  if (requestedLots.length === 0) {
    return {
      requestedLots: [],
      stockedItems: [],
      printedOnlyLots: [],
      unprintedLots: [],
      hasCriticalStockWarning: false,
      hasPrintedWarning: false,
      requiresAcknowledgment: false,
      severity: 'NONE',
      title: '',
      description: '',
    };
  }

  const printedSet = new Set(params.issuedPrintedLots.map((l) => normalizeLotNumber(l)).filter(Boolean));
  const stockMap = new Map<string, RawTobacco>();
  for (const t of params.rawTobaccos) {
    const code = normalizeLotNumber(t.lotNumber);
    if (code && !stockMap.has(code)) stockMap.set(code, t);
  }

  const stockedItems: ReprintWarningEvaluation['stockedItems'] = [];
  const printedOnlyLots: string[] = [];
  const unprintedLots: string[] = [];

  for (const lotCode of requestedLots) {
    const stock = stockMap.get(lotCode);
    const isPrinted = printedSet.has(lotCode);
    if (stock) {
      stockedItems.push({
        lotCode,
        stockName: stock.name,
        purchaseDate: stock.purchaseDate,
        isAlsoPrinted: isPrinted,
      });
    } else if (isPrinted) {
      printedOnlyLots.push(lotCode);
    } else {
      unprintedLots.push(lotCode);
    }
  }

  const hasCriticalStockWarning = stockedItems.length > 0;
  const hasPrintedWarning = printedOnlyLots.length > 0;
  const requiresAcknowledgment = hasCriticalStockWarning || hasPrintedWarning;

  if (hasCriticalStockWarning) {
    const stockNames = stockedItems
      .map((s) => `${s.lotCode} (${s.stockName})`)
      .slice(0, 3)
      .join(', ');
    return {
      requestedLots,
      stockedItems,
      printedOnlyLots,
      unprintedLots,
      hasCriticalStockWarning,
      hasPrintedWarning,
      requiresAcknowledgment,
      severity: 'CRITICAL_STOCK',
      title: 'PERINGATAN KRITIS: Nomor Sudah Terdaftar di Stok Gudang!',
      description: `${stockNames}${stockedItems.length > 3 ? ` +${stockedItems.length - 3} lainnya` : ''} SUDAH masuk stok gudang${printedOnlyLots.length > 0 ? ` dan ${printedOnlyLots.length} nomor lain sudah pernah dicetak` : ''}. Download / cetak ulang hanya boleh dilakukan jika kartu fisik asli rusak/hilang agar tidak terjadi kartu barcode ganda.`,
    };
  }

  if (hasPrintedWarning) {
    return {
      requestedLots,
      stockedItems,
      printedOnlyLots,
      unprintedLots,
      hasCriticalStockWarning,
      hasPrintedWarning,
      requiresAcknowledgment,
      severity: 'PRINTED_WARNING',
      title: 'PERINGATAN: Download / Cetak Ulang Nomor Lama',
      description: `${printedOnlyLots.join(', ')} sudah pernah diterbitkan/dicetak sebelumnya. Pastikan kartu lama yang cacat dimusnahkan setelah kartu pengganti tercetak agar nomor lot tidak dobel di lapangan.`,
    };
  }

  return {
    requestedLots,
    stockedItems,
    printedOnlyLots,
    unprintedLots,
    hasCriticalStockWarning: false,
    hasPrintedWarning: false,
    requiresAcknowledgment: false,
    severity: 'UNPRINTED_INFO',
    title: 'Nomor Lama Belum Pernah Dicetak di Aplikasi',
    description: `${unprintedLots.join(', ')} belum tercatat tercetak sebelumnya. Tetap berhati-hati bila nomor ini sudah pernah dibuat manual.`,
  };
}
