import { PrintPaperFormat, isThermalPaperFormat } from './thermalPrintEngine';

export const ISSUED_PRINT_LOTS_STORAGE_KEY = 'tobacco_lab_issued_print_lots_v1';
export const PENDING_PRINT_BATCH_STORAGE_KEY = 'tobacco_lab_pending_print_batch_v1';
export const LAST_LOCKED_PRINT_BATCH_STORAGE_KEY = 'tobacco_lab_last_locked_print_batch_v1';

export type PrintAttemptMode = 'PDF' | 'SYSTEM_PRINT' | 'THERMAL';

export interface PendingPrintBatch {
  lots: string[];
  prefix: string;
  paperFormat: PrintPaperFormat;
  mode: PrintAttemptMode;
  createdAt: number;
}

export interface LockedBatchSnapshot {
  lots: string[];
  prefix: string;
  lockedAt: number;
}

function normalizeLotList(lots: string[]): string[] {
  return Array.from(
    new Set(
      (lots || [])
        .map((l) => String(l || '').trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function normalizePrefix(prefix?: string): string {
  return String(prefix || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

/**
 * Snaps card count for fixed 4-card A4 layout into exact multiples of 4 [4..60],
 * or preserves 1..60 for single-roll Thermal modes.
 */
export function snapPrintCountForFormat(count: number, format: PrintPaperFormat): number {
  const num = Number.isFinite(count) ? count : 4;
  if (isThermalPaperFormat(format)) {
    return Math.max(1, Math.min(60, Math.round(num)));
  }
  const rounded = Math.round(num / 4) * 4;
  return Math.max(4, Math.min(60, rounded || 4));
}

/**
 * Creates a non-locking pending print draft so failed / cancelled PDF or Print attempts
 * NEVER burn or advance prefix serial numbers.
 */
export function createPendingPrintBatch(params: {
  lots: string[];
  prefix: string;
  paperFormat: PrintPaperFormat;
  mode: PrintAttemptMode;
  now?: number;
}): PendingPrintBatch | null {
  const normalizedLots = normalizeLotList(params.lots);
  if (normalizedLots.length === 0) return null;
  return {
    lots: normalizedLots,
    prefix: normalizePrefix(params.prefix),
    paperFormat: params.paperFormat,
    mode: params.mode,
    createdAt: params.now ?? Date.now(),
  };
}

/**
 * Resolves which Lot numbers should be displayed & printed next.
 * CRITICAL RULE: When a pending (unconfirmed) batch exists for the active prefix,
 * keep returning those exact same numbers so retries re-attempt failed numbers
 * instead of skipping forward!
 */
export function resolveActiveBatchLots(params: {
  pendingBatch: PendingPrintBatch | null;
  generatedBatchLots: string[];
  activePrefix: string;
  requestedCount: number;
}): {
  lots: string[];
  isRetryingPending: boolean;
} {
  const { pendingBatch, generatedBatchLots, activePrefix, requestedCount } = params;
  const activePrefNorm = normalizePrefix(activePrefix);
  if (
    pendingBatch &&
    pendingBatch.lots.length > 0 &&
    normalizePrefix(pendingBatch.prefix) === activePrefNorm &&
    pendingBatch.lots.length === requestedCount
  ) {
    return {
      lots: pendingBatch.lots,
      isRetryingPending: true,
    };
  }
  return {
    lots: generatedBatchLots,
    isRetryingPending: false,
  };
}

/**
 * Only locks printed numbers into issuedPrintedLots when explicitly confirmed by the user.
 */
export function confirmPendingBatchLock(params: {
  issuedLots: string[];
  pendingBatch: PendingPrintBatch;
  now?: number;
}): {
  nextIssuedLots: string[];
  lastLockedBatch: LockedBatchSnapshot;
} {
  const nextIssuedLots = normalizeLotList([...params.issuedLots, ...params.pendingBatch.lots]);
  return {
    nextIssuedLots,
    lastLockedBatch: {
      lots: [...params.pendingBatch.lots],
      prefix: params.pendingBatch.prefix,
      lockedAt: params.now ?? Date.now(),
    },
  };
}

/**
 * Unlocks the most recently locked batch back out of issuedPrintedLots and restores it
 * as a retryable PendingPrintBatch in case print/PDF actually failed on paper or file.
 */
export function unlockLastLockedBatch(params: {
  issuedLots: string[];
  lastLockedBatch: LockedBatchSnapshot;
  paperFormat: PrintPaperFormat;
  now?: number;
}): {
  nextIssuedLots: string[];
  restoredPendingBatch: PendingPrintBatch | null;
} {
  const toUnlock = new Set(normalizeLotList(params.lastLockedBatch.lots));
  const nextIssuedLots = normalizeLotList(params.issuedLots).filter((lot) => !toUnlock.has(lot));
  const restoredPendingBatch = createPendingPrintBatch({
    lots: params.lastLockedBatch.lots,
    prefix: params.lastLockedBatch.prefix,
    paperFormat: params.paperFormat,
    mode: 'PDF',
    now: params.now,
  });
  return {
    nextIssuedLots,
    restoredPendingBatch,
  };
}

export function loadIssuedPrintedLots(): string[] {
  try {
    const raw = localStorage.getItem(ISSUED_PRINT_LOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeLotList(parsed) : [];
  } catch {
    return [];
  }
}

export function saveIssuedPrintedLots(lots: string[]): void {
  try {
    localStorage.setItem(ISSUED_PRINT_LOTS_STORAGE_KEY, JSON.stringify(normalizeLotList(lots)));
  } catch {
    // ignore quota failures
  }
}

export function loadPendingPrintBatch(): PendingPrintBatch | null {
  try {
    const raw = localStorage.getItem(PENDING_PRINT_BATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPrintBatch>;
    if (!parsed || !Array.isArray(parsed.lots) || parsed.lots.length === 0) return null;
    return createPendingPrintBatch({
      lots: parsed.lots,
      prefix: parsed.prefix || '',
      paperFormat: parsed.paperFormat || 'A4_6',
      mode: parsed.mode || 'PDF',
      now: parsed.createdAt || Date.now(),
    });
  } catch {
    return null;
  }
}

export function savePendingPrintBatch(batch: PendingPrintBatch | null): void {
  try {
    if (!batch) {
      localStorage.removeItem(PENDING_PRINT_BATCH_STORAGE_KEY);
    } else {
      localStorage.setItem(PENDING_PRINT_BATCH_STORAGE_KEY, JSON.stringify(batch));
    }
  } catch {
    // ignore quota failures
  }
}

export function loadLastLockedBatch(): LockedBatchSnapshot | null {
  try {
    const raw = localStorage.getItem(LAST_LOCKED_PRINT_BATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LockedBatchSnapshot>;
    if (!parsed || !Array.isArray(parsed.lots) || parsed.lots.length === 0) return null;
    const lots = normalizeLotList(parsed.lots);
    if (lots.length === 0) return null;
    return {
      lots,
      prefix: normalizePrefix(parsed.prefix),
      lockedAt: typeof parsed.lockedAt === 'number' ? parsed.lockedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export const PRINTED_LOT_METADATA_STORAGE_KEY = 'tobacco_lab_printed_lot_metadata_v1';

export interface PrintedLotMetadata {
  lotNumber: string;
  graderName: string;
  printYear: number;
  updatedAt: number;
}

export function loadPrintedLotMetadataMap(): Record<string, PrintedLotMetadata> {
  try {
    const raw = localStorage.getItem(PRINTED_LOT_METADATA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, PrintedLotMetadata> = {};
    for (const [k, val] of Object.entries(parsed)) {
      const normLot = String(k || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9-]/g, '');
      if (!normLot || !val || typeof val !== 'object') continue;
      const v = val as Partial<PrintedLotMetadata>;
      clean[normLot] = {
        lotNumber: normLot,
        graderName: String(v.graderName || '').trim().slice(0, 32),
        printYear:
          Number.isFinite(v.printYear) && Number(v.printYear) >= 2020 && Number(v.printYear) <= 2099
            ? Math.round(Number(v.printYear))
            : new Date().getFullYear(),
        updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
      };
    }
    return clean;
  } catch {
    return {};
  }
}

export function savePrintedLotMetadataMap(map: Record<string, PrintedLotMetadata>): void {
  try {
    const entries = Object.entries(map);
    const trimmed =
      entries.length > 2000
        ? Object.fromEntries(
            entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0)).slice(0, 2000)
          )
        : map;
    localStorage.setItem(PRINTED_LOT_METADATA_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage quota failures
  }
}

/**
 * Persists fixed card metadata (e.g. Grader Name, Print Year) keyed by normalized Lot Number
 * whenever cards are printed/exported, enabling deterministic fallback correlation at scan time.
 */
export function upsertPrintedLotMetadata(params: {
  lots: string[];
  graderName?: string;
  printYear?: number;
  now?: number;
}): Record<string, PrintedLotMetadata> {
  const existing = loadPrintedLotMetadataMap();
  const cleanGrader = String(params.graderName || '').trim().slice(0, 32);
  const safeYear =
    Number.isFinite(params.printYear) &&
    Number(params.printYear) >= 2020 &&
    Number(params.printYear) <= 2099
      ? Math.round(Number(params.printYear))
      : new Date().getFullYear();
  const timestamp = params.now ?? Date.now();

  const normLots = normalizeLotList(params.lots);
  for (const lot of normLots) {
    if (!lot) continue;
    existing[lot] = {
      lotNumber: lot,
      graderName: cleanGrader || existing[lot]?.graderName || '',
      printYear: safeYear,
      updatedAt: timestamp,
    };
  }
  savePrintedLotMetadataMap(existing);
  return existing;
}

export function saveLastLockedBatch(snapshot: LockedBatchSnapshot | null): void {
  try {
    if (!snapshot || snapshot.lots.length === 0) {
      localStorage.removeItem(LAST_LOCKED_PRINT_BATCH_STORAGE_KEY);
    } else {
      localStorage.setItem(LAST_LOCKED_PRINT_BATCH_STORAGE_KEY, JSON.stringify(snapshot));
    }
  } catch {
    // ignore quota failures
  }
}

export type ReprintMode = 'GABUNG_BARU' | 'SLOT_TERPILIH';

export interface ReprintSlotPlan {
  slots: (string | null)[];
  reprintedLots: string[];
  freshLotsToLock: string[];
  blankUnusedSlots: boolean;
  pageCount: number;
}

/**
 * Parses comma/space/newline-separated lot numbers for damaged/older card reprinting.
 */
export function parseReprintLotCodes(rawInput: string): string[] {
  const tokens = String(rawInput || '')
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((t) => t.replace(/[^A-Z0-9-]/g, '').trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

/**
 * Zero-waste reprint layout planner:
 * - GABUNG_BARU: places reprinted old/damaged lots in leading slots and fills remaining
 *   slots on the 6-card A4 page(s) with fresh sequential lots. ONLY fresh lots are locked
 *   when confirmed so reprinted old lots never double-advance the counter.
 * - SLOT_TERPILIH: places reprinted lot(s) at exact chosen 0-based slot(s) (1..6 on A4 page)
 *   and leaves all other slots null (100% pure blank white, zero ink) on A4, or prints
 *   only the selected lot(s) on Thermal slips. Zero new numbers are locked.
 */
export function buildReprintSlotPlan(params: {
  mode: ReprintMode;
  reprintLots: string[];
  selectedSlotIndexes?: number[];
  generatedFreshLots: string[];
  requestedCount: number;
  paperFormat: PrintPaperFormat;
}): ReprintSlotPlan {
  const reprintLots = normalizeLotList(params.reprintLots);
  const freshPool = normalizeLotList(params.generatedFreshLots).filter(
    (lot) => !reprintLots.includes(lot)
  );
  const isThermal = isThermalPaperFormat(params.paperFormat);

  if (reprintLots.length === 0) {
    const activeFresh = freshPool.slice(0, params.requestedCount);
    const pageCount = isThermal
      ? activeFresh.length
      : Math.max(1, Math.ceil(activeFresh.length / 4));
    return {
      slots: activeFresh,
      reprintedLots: [],
      freshLotsToLock: activeFresh,
      blankUnusedSlots: false,
      pageCount,
    };
  }

  if (params.mode === 'GABUNG_BARU') {
    if (isThermal) {
      const targetTotal = Math.max(reprintLots.length, params.requestedCount);
      const freshNeeded = Math.max(0, targetTotal - reprintLots.length);
      const freshUsed = freshPool.slice(0, freshNeeded);
      const slots = [...reprintLots, ...freshUsed];
      return {
        slots,
        reprintedLots: reprintLots,
        freshLotsToLock: freshUsed,
        blankUnusedSlots: false,
        pageCount: slots.length,
      };
    }

    const snappedRequested = snapPrintCountForFormat(params.requestedCount, 'A4_6');
    const minPages = Math.ceil(reprintLots.length / 4);
    const targetSlots = Math.max(snappedRequested, minPages * 4);
    const freshNeeded = Math.max(0, targetSlots - reprintLots.length);
    const freshUsed = freshPool.slice(0, freshNeeded);
    const slots = [...reprintLots, ...freshUsed];
    return {
      slots,
      reprintedLots: reprintLots,
      freshLotsToLock: freshUsed,
      blankUnusedSlots: false,
      pageCount: Math.max(1, Math.ceil(slots.length / 4)),
    };
  }

  // SLOT_TERPILIH: blank white everywhere else, zero fresh numbers locked
  if (isThermal) {
    return {
      slots: reprintLots,
      reprintedLots: reprintLots,
      freshLotsToLock: [],
      blankUnusedSlots: false,
      pageCount: reprintLots.length,
    };
  }

  const normalizedIndices = Array.from(
    new Set(
      (params.selectedSlotIndexes || [])
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 0)
    )
  ).sort((a, b) => a - b);

  // Assign each reprint lot to chosen slot index (or sequential 0,1,2... if not enough picked)
  const targetIndices: number[] = [];
  const usedIdx = new Set<number>();
  for (let i = 0; i < reprintLots.length; i++) {
    const preferred = normalizedIndices[i];
    if (preferred !== undefined && !usedIdx.has(preferred)) {
      usedIdx.add(preferred);
      targetIndices.push(preferred);
    } else {
      let fallback = 0;
      while (usedIdx.has(fallback)) fallback++;
      usedIdx.add(fallback);
      targetIndices.push(fallback);
    }
  }

  const maxIndex = Math.max(3, ...targetIndices);
  const pageCount = Math.ceil((maxIndex + 1) / 4);
  const totalSlots = pageCount * 4;
  const slots: (string | null)[] = new Array(totalSlots).fill(null);
  targetIndices.forEach((slotIdx, lotIdx) => {
    slots[slotIdx] = reprintLots[lotIdx];
  });

  return {
    slots,
    reprintedLots: reprintLots,
    freshLotsToLock: [],
    blankUnusedSlots: true,
    pageCount,
  };
}

function normalizeSingleSlotCode(raw?: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

/**
 * Direct per-slot A4 planner where Slots 1..4 map 1-to-1 to the 4 positions on a single A4 sheet:
 * - Each slot holds its own distinct (or empty) lot number (e.g. Slot 1 = MTL008, Slot 2 = YH41, Slot 4 = BM1).
 * - SLOT_TERPILIH prints all filled slots combined onto that 1 A4 sheet while leaving empty slots blank white.
 * - GABUNG_BARU preserves every filled slot in its exact position and fills empty slots with fresh sequential lots.
 */
export function buildSlotAssignedReprintPlan(params: {
  slotCodes: string[];
  mode: ReprintMode;
  generatedFreshLots: string[];
  requestedCount: number;
  paperFormat: PrintPaperFormat;
}): ReprintSlotPlan {
  const fixedSlots: string[] = Array.from({ length: 4 }, (_, idx) =>
    normalizeSingleSlotCode(params.slotCodes?.[idx])
  );
  const uniqueAssignedLots = Array.from(new Set(fixedSlots.filter(Boolean)));
  const freshPool = normalizeLotList(params.generatedFreshLots).filter(
    (lot) => !uniqueAssignedLots.includes(lot)
  );
  const isThermal = isThermalPaperFormat(params.paperFormat);

  if (uniqueAssignedLots.length === 0) {
    if (params.mode === 'SLOT_TERPILIH') {
      return {
        slots: isThermal ? [] : [null, null, null, null],
        reprintedLots: [],
        freshLotsToLock: [],
        blankUnusedSlots: !isThermal,
        pageCount: isThermal ? 0 : 1,
      };
    }
    const activeFresh = freshPool.slice(0, params.requestedCount);
    return {
      slots: activeFresh,
      reprintedLots: [],
      freshLotsToLock: activeFresh,
      blankUnusedSlots: false,
      pageCount: isThermal ? activeFresh.length : Math.max(1, Math.ceil(activeFresh.length / 4)),
    };
  }

  if (isThermal) {
    if (params.mode === 'SLOT_TERPILIH') {
      return {
        slots: uniqueAssignedLots,
        reprintedLots: uniqueAssignedLots,
        freshLotsToLock: [],
        blankUnusedSlots: false,
        pageCount: uniqueAssignedLots.length,
      };
    }
    const targetTotal = Math.max(uniqueAssignedLots.length, params.requestedCount);
    const freshUsed = freshPool.slice(0, Math.max(0, targetTotal - uniqueAssignedLots.length));
    const slots = [...uniqueAssignedLots, ...freshUsed];
    return {
      slots,
      reprintedLots: uniqueAssignedLots,
      freshLotsToLock: freshUsed,
      blankUnusedSlots: false,
      pageCount: slots.length,
    };
  }

  if (params.mode === 'SLOT_TERPILIH') {
    return {
      slots: fixedSlots.map((code) => code || null),
      reprintedLots: uniqueAssignedLots,
      freshLotsToLock: [],
      blankUnusedSlots: true,
      pageCount: 1,
    };
  }

  // GABUNG_BARU on A4: preserve filled slot positions on sheet #1 and pack fresh lots into remaining slots
  const snappedTarget = snapPrintCountForFormat(params.requestedCount, 'A4_6');
  const slots: (string | null)[] = new Array(snappedTarget).fill(null);
  const freshUsed: string[] = [];
  let freshCursor = 0;

  for (let i = 0; i < 4; i++) {
    if (fixedSlots[i]) {
      slots[i] = fixedSlots[i];
    } else if (freshCursor < freshPool.length) {
      const lot = freshPool[freshCursor++];
      slots[i] = lot;
      freshUsed.push(lot);
    }
  }
  for (let i = 4; i < snappedTarget; i++) {
    if (freshCursor < freshPool.length) {
      const lot = freshPool[freshCursor++];
      slots[i] = lot;
      freshUsed.push(lot);
    }
  }

  return {
    slots,
    reprintedLots: uniqueAssignedLots,
    freshLotsToLock: freshUsed,
    blankUnusedSlots: false,
    pageCount: Math.max(1, Math.ceil(slots.length / 4)),
  };
}

