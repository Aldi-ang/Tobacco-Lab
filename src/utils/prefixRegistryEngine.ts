import { RawTobacco } from '../types/tobacco';
import { normalizeLotNumber } from './gradeCardEngine';

export const PRINT_PREFIX_REGISTRY_STORAGE_KEY = 'tobacco_lab_print_prefix_registry_v1';

export interface PrefixRegistryState {
  registeredPrefixes: string[];
  lastSelectedPrefix: string; // '' means Daily Auto (LOT-YYMMDD-)
  dismissedPrefixes?: string[]; // Prefixes explicitly deleted by user so discovery won't re-add them automatically
  minStartSeqByPrefix?: Record<string, number>; // Optional per-prefix starting number override (skip number)
}

const AUTO_DAILY_PREFIX_RE = /^LOT-\d{6}-?$/;
const AUTO_DAILY_SEQ_KEY = '__AUTO_DAILY__';

export function isAutoDailyPrefix(prefix: string): boolean {
  return !prefix || AUTO_DAILY_PREFIX_RE.test(prefix.trim().toUpperCase());
}

/**
 * Normalizes a user-entered or historical Lot prefix while preserving hyphen convention
 * (e.g. " mtl " -> "MTL", "tmg-" -> "TMG-").
 */
export function normalizePrefixInput(raw?: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

function getPrefixSequenceKey(prefix?: string): string {
  const norm = normalizePrefixInput(prefix);
  if (!norm || isAutoDailyPrefix(norm)) return AUTO_DAILY_SEQ_KEY;
  return norm;
}

function normalizeMinStartSeqMap(raw?: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = key === AUTO_DAILY_SEQ_KEY ? AUTO_DAILY_SEQ_KEY : getPrefixSequenceKey(key);
    const num = Math.floor(Number(val));
    if (Number.isFinite(num) && num >= 2) {
      out[cleanKey] = num;
    }
  }
  return out;
}

export function getPrefixStartSequence(
  state: PrefixRegistryState,
  prefix?: string
): number | null {
  const map = normalizeMinStartSeqMap(state.minStartSeqByPrefix);
  const val = map[getPrefixSequenceKey(prefix)];
  return typeof val === 'number' && val >= 2 ? val : null;
}

export function setPrefixStartSequence(
  state: PrefixRegistryState,
  prefix: string,
  startSeq: number | null | undefined
): PrefixRegistryState {
  const nextMap = normalizeMinStartSeqMap(state.minStartSeqByPrefix);
  const key = getPrefixSequenceKey(prefix);
  const parsed = startSeq == null ? NaN : Math.floor(Number(startSeq));
  if (Number.isFinite(parsed) && parsed >= 2) {
    nextMap[key] = parsed;
  } else {
    delete nextMap[key];
  }
  return {
    ...state,
    dismissedPrefixes: normalizeDismissedList(state.dismissedPrefixes),
    minStartSeqByPrefix: nextMap,
  };
}

/**
 * Extracts exact generation prefix from an existing Lot code
 * (e.g. "MTL001" -> "MTL", "TMG-009" -> "TMG-", returns null for default daily "LOT-261115-001").
 */
export function extractCustomGenerationPrefixFromLot(lotNumber?: string): string | null {
  const norm = normalizeLotNumber(lotNumber);
  if (!norm) return null;

  // Match prefix followed by trailing serial digits (e.g. MTL001 -> MTL, TMG-001 -> TMG-)
  const match = norm.match(/^([A-Z0-9-]*?[A-Z]-?)(\d{2,})$/);
  if (!match || !match[1]) return null;

  const candidate = normalizePrefixInput(match[1]);
  if (!candidate || isAutoDailyPrefix(candidate)) return null;
  return candidate;
}

/**
 * Discovers custom prefixes already used in Gudang stocks or previously locked single-print Lots.
 */
export function discoverCustomPrefixesFromHistory(
  rawTobaccos: RawTobacco[],
  issuedPrintedLots: string[] = []
): string[] {
  const seen = new Set<string>();
  const allLots = [
    ...issuedPrintedLots,
    ...rawTobaccos.map((t) => t.lotNumber || ''),
  ];

  for (const lot of allLots) {
    const p = extractCustomGenerationPrefixFromLot(lot);
    if (p) seen.add(p);
  }
  return Array.from(seen);
}

function normalizeDismissedList(list?: string[]): string[] {
  if (!Array.isArray(list)) return [];
  return Array.from(
    new Set(
      list
        .map((p) => normalizePrefixInput(p))
        .filter((p) => p && !isAutoDailyPrefix(p))
    )
  );
}

export function mergeRegistryWithDiscoveredPrefixes(
  state: PrefixRegistryState,
  rawTobaccos: RawTobacco[],
  issuedPrintedLots: string[] = []
): PrefixRegistryState {
  const dismissedList = normalizeDismissedList(state.dismissedPrefixes);
  const dismissedSet = new Set(dismissedList);
  const minStartSeqByPrefix = normalizeMinStartSeqMap(state.minStartSeqByPrefix);
  const discovered = discoverCustomPrefixesFromHistory(
    rawTobaccos,
    issuedPrintedLots
  ).filter((p) => !dismissedSet.has(p));

  const registeredClean = state.registeredPrefixes
    .map((p) => normalizePrefixInput(p))
    .filter((p) => p && !isAutoDailyPrefix(p) && !dismissedSet.has(p));

  const merged = Array.from(new Set([...registeredClean, ...discovered]));
  const active = normalizePrefixInput(state.lastSelectedPrefix);
  const resolvedActive =
    active && !isAutoDailyPrefix(active) && !dismissedSet.has(active) ? active : '';
  return {
    registeredPrefixes: merged,
    lastSelectedPrefix: resolvedActive,
    dismissedPrefixes: dismissedList,
    minStartSeqByPrefix,
  };
}

export function registerNewPrefix(
  state: PrefixRegistryState,
  rawPrefix: string,
  initialStartSeq?: number | null
): { nextState: PrefixRegistryState; normalizedPrefix: string } {
  const normalized = normalizePrefixInput(rawPrefix);
  const dismissedList = normalizeDismissedList(state.dismissedPrefixes);
  const nextMap = normalizeMinStartSeqMap(state.minStartSeqByPrefix);

  if (!normalized || isAutoDailyPrefix(normalized)) {
    const baseState: PrefixRegistryState = {
      ...state,
      lastSelectedPrefix: '',
      dismissedPrefixes: dismissedList,
      minStartSeqByPrefix: nextMap,
    };
    return {
      nextState:
        initialStartSeq !== undefined
          ? setPrefixStartSequence(baseState, '', initialStartSeq)
          : baseState,
      normalizedPrefix: '',
    };
  }

  const withoutDup = state.registeredPrefixes.filter((p) => p !== normalized);
  const baseState: PrefixRegistryState = {
    registeredPrefixes: [normalized, ...withoutDup],
    lastSelectedPrefix: normalized,
    dismissedPrefixes: dismissedList.filter((p) => p !== normalized),
    minStartSeqByPrefix: nextMap,
  };
  return {
    nextState:
      initialStartSeq !== undefined
        ? setPrefixStartSequence(baseState, normalized, initialStartSeq)
        : baseState,
    normalizedPrefix: normalized,
  };
}

export function selectActivePrefix(
  state: PrefixRegistryState,
  rawPrefix: string
): PrefixRegistryState {
  const normalized = normalizePrefixInput(rawPrefix);
  const dismissedList = normalizeDismissedList(state.dismissedPrefixes);
  const minStartSeqByPrefix = normalizeMinStartSeqMap(state.minStartSeqByPrefix);
  if (!normalized || isAutoDailyPrefix(normalized)) {
    return {
      ...state,
      lastSelectedPrefix: '',
      dismissedPrefixes: dismissedList,
      minStartSeqByPrefix,
    };
  }
  const hasAlready = state.registeredPrefixes.includes(normalized);
  return {
    registeredPrefixes: hasAlready
      ? state.registeredPrefixes
      : [normalized, ...state.registeredPrefixes],
    lastSelectedPrefix: normalized,
    dismissedPrefixes: dismissedList.filter((p) => p !== normalized),
    minStartSeqByPrefix,
  };
}

export function removeRegisteredPrefix(
  state: PrefixRegistryState,
  targetPrefix: string
): PrefixRegistryState {
  const normalized = normalizePrefixInput(targetPrefix);
  const filtered = state.registeredPrefixes
    .map((p) => normalizePrefixInput(p))
    .filter((p) => p && p !== normalized);
  const currentActive = normalizePrefixInput(state.lastSelectedPrefix);
  const nextActive = currentActive === normalized ? '' : currentActive;
  const dismissedList = normalizeDismissedList([
    ...(state.dismissedPrefixes || []),
    ...(normalized ? [normalized] : []),
  ]);
  const minStartSeqByPrefix = normalizeMinStartSeqMap(state.minStartSeqByPrefix);
  return {
    registeredPrefixes: filtered,
    lastSelectedPrefix: nextActive,
    dismissedPrefixes: dismissedList,
    minStartSeqByPrefix,
  };
}

export function recordPrintedBatchToPrefixRegistry(
  state: PrefixRegistryState,
  printedLots: string[],
  activePrefixInput: string
): PrefixRegistryState {
  const dismissedList = normalizeDismissedList(state.dismissedPrefixes);
  const minStartSeqByPrefix = normalizeMinStartSeqMap(state.minStartSeqByPrefix);
  const activeNorm = normalizePrefixInput(activePrefixInput);
  if (activeNorm && !isAutoDailyPrefix(activeNorm)) {
    const withoutDup = state.registeredPrefixes.filter((p) => p !== activeNorm);
    return {
      registeredPrefixes: [activeNorm, ...withoutDup],
      lastSelectedPrefix: activeNorm,
      dismissedPrefixes: dismissedList.filter((p) => p !== activeNorm),
      minStartSeqByPrefix,
    };
  }

  // Fallback: inspect first lot in batch
  const fromLot =
    printedLots.length > 0 ? extractCustomGenerationPrefixFromLot(printedLots[0]) : null;
  if (fromLot) {
    const withoutDup = state.registeredPrefixes.filter((p) => p !== fromLot);
    return {
      registeredPrefixes: [fromLot, ...withoutDup],
      lastSelectedPrefix: fromLot,
      dismissedPrefixes: dismissedList.filter((p) => p !== fromLot),
      minStartSeqByPrefix,
    };
  }

  // Printed with Daily Auto prefix -> remember Daily Auto ('') as last used
  return {
    ...state,
    lastSelectedPrefix: '',
    dismissedPrefixes: dismissedList,
    minStartSeqByPrefix,
  };
}

export function loadPrefixRegistryState(): PrefixRegistryState {
  try {
    const raw = localStorage.getItem(PRINT_PREFIX_REGISTRY_STORAGE_KEY);
    if (!raw) {
      return {
        registeredPrefixes: [],
        lastSelectedPrefix: '',
        dismissedPrefixes: [],
        minStartSeqByPrefix: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<PrefixRegistryState>;
    const dismissed = normalizeDismissedList(parsed.dismissedPrefixes);
    const dismissedSet = new Set(dismissed);
    const minStartSeqByPrefix = normalizeMinStartSeqMap(parsed.minStartSeqByPrefix);
    const list = Array.isArray(parsed.registeredPrefixes)
      ? parsed.registeredPrefixes
          .map((p) => normalizePrefixInput(String(p || '')))
          .filter((p) => p && !isAutoDailyPrefix(p) && !dismissedSet.has(p))
      : [];
    const last = normalizePrefixInput(String(parsed.lastSelectedPrefix || ''));
    return {
      registeredPrefixes: Array.from(new Set(list)),
      lastSelectedPrefix:
        last && !isAutoDailyPrefix(last) && !dismissedSet.has(last) ? last : '',
      dismissedPrefixes: dismissed,
      minStartSeqByPrefix,
    };
  } catch {
    return {
      registeredPrefixes: [],
      lastSelectedPrefix: '',
      dismissedPrefixes: [],
      minStartSeqByPrefix: {},
    };
  }
}

export function savePrefixRegistryState(state: PrefixRegistryState): void {
  try {
    localStorage.setItem(PRINT_PREFIX_REGISTRY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
