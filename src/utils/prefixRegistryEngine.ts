import { RawTobacco } from '../types/tobacco';
import { normalizeLotNumber } from './gradeCardEngine';

export const PRINT_PREFIX_REGISTRY_STORAGE_KEY = 'tobacco_lab_print_prefix_registry_v1';

export interface PrefixRegistryState {
  registeredPrefixes: string[];
  lastSelectedPrefix: string; // '' means Daily Auto (LOT-YYMMDD-)
}

const AUTO_DAILY_PREFIX_RE = /^LOT-\d{6}-?$/;

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

export function mergeRegistryWithDiscoveredPrefixes(
  state: PrefixRegistryState,
  rawTobaccos: RawTobacco[],
  issuedPrintedLots: string[] = []
): PrefixRegistryState {
  const discovered = discoverCustomPrefixesFromHistory(rawTobaccos, issuedPrintedLots);
  const merged = Array.from(
    new Set([
      ...state.registeredPrefixes.map((p) => normalizePrefixInput(p)).filter((p) => p && !isAutoDailyPrefix(p)),
      ...discovered,
    ])
  );
  const active = normalizePrefixInput(state.lastSelectedPrefix);
  const resolvedActive = active && !isAutoDailyPrefix(active) ? active : '';
  return {
    registeredPrefixes: merged,
    lastSelectedPrefix: resolvedActive,
  };
}

export function registerNewPrefix(
  state: PrefixRegistryState,
  rawPrefix: string
): { nextState: PrefixRegistryState; normalizedPrefix: string } {
  const normalized = normalizePrefixInput(rawPrefix);
  if (!normalized || isAutoDailyPrefix(normalized)) {
    return {
      nextState: {
        ...state,
        lastSelectedPrefix: '',
      },
      normalizedPrefix: '',
    };
  }

  const withoutDup = state.registeredPrefixes.filter((p) => p !== normalized);
  return {
    nextState: {
      registeredPrefixes: [normalized, ...withoutDup],
      lastSelectedPrefix: normalized,
    },
    normalizedPrefix: normalized,
  };
}

export function selectActivePrefix(
  state: PrefixRegistryState,
  rawPrefix: string
): PrefixRegistryState {
  const normalized = normalizePrefixInput(rawPrefix);
  if (!normalized || isAutoDailyPrefix(normalized)) {
    return {
      ...state,
      lastSelectedPrefix: '',
    };
  }
  const hasAlready = state.registeredPrefixes.includes(normalized);
  return {
    registeredPrefixes: hasAlready
      ? state.registeredPrefixes
      : [normalized, ...state.registeredPrefixes],
    lastSelectedPrefix: normalized,
  };
}

export function removeRegisteredPrefix(
  state: PrefixRegistryState,
  targetPrefix: string
): PrefixRegistryState {
  const normalized = normalizePrefixInput(targetPrefix);
  const filtered = state.registeredPrefixes.filter((p) => p !== normalized);
  const nextActive =
    state.lastSelectedPrefix === normalized ? '' : state.lastSelectedPrefix;
  return {
    registeredPrefixes: filtered,
    lastSelectedPrefix: nextActive,
  };
}

export function recordPrintedBatchToPrefixRegistry(
  state: PrefixRegistryState,
  printedLots: string[],
  activePrefixInput: string
): PrefixRegistryState {
  const activeNorm = normalizePrefixInput(activePrefixInput);
  if (activeNorm && !isAutoDailyPrefix(activeNorm)) {
    const withoutDup = state.registeredPrefixes.filter((p) => p !== activeNorm);
    return {
      registeredPrefixes: [activeNorm, ...withoutDup],
      lastSelectedPrefix: activeNorm,
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
    };
  }

  // Printed with Daily Auto prefix -> remember Daily Auto ('') as last used
  return {
    ...state,
    lastSelectedPrefix: '',
  };
}

export function loadPrefixRegistryState(): PrefixRegistryState {
  try {
    const raw = localStorage.getItem(PRINT_PREFIX_REGISTRY_STORAGE_KEY);
    if (!raw) {
      return { registeredPrefixes: [], lastSelectedPrefix: '' };
    }
    const parsed = JSON.parse(raw) as Partial<PrefixRegistryState>;
    const list = Array.isArray(parsed.registeredPrefixes)
      ? parsed.registeredPrefixes
          .map((p) => normalizePrefixInput(String(p || '')))
          .filter((p) => p && !isAutoDailyPrefix(p))
      : [];
    const last = normalizePrefixInput(String(parsed.lastSelectedPrefix || ''));
    return {
      registeredPrefixes: Array.from(new Set(list)),
      lastSelectedPrefix: last && !isAutoDailyPrefix(last) ? last : '',
    };
  } catch {
    return { registeredPrefixes: [], lastSelectedPrefix: '' };
  }
}

export function savePrefixRegistryState(state: PrefixRegistryState): void {
  try {
    localStorage.setItem(PRINT_PREFIX_REGISTRY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
