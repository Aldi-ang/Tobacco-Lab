export const GRADER_REGISTRY_STORAGE_KEY = 'tobacco_lab_grader_registry_v1';

export interface GraderRegistryState {
  registeredGraders: string[];
  lastSelectedGrader: string;
}

export const DEFAULT_GRADER_REGISTRY_STATE: GraderRegistryState = {
  registeredGraders: [],
  lastSelectedGrader: '',
};

export function normalizeGraderName(raw?: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 32);
}

export function sanitizeGraderRegistryState(
  raw: Partial<GraderRegistryState> | null | undefined
): GraderRegistryState {
  if (!raw || typeof raw !== 'object') {
    return {
      registeredGraders: [],
      lastSelectedGrader: '',
    };
  }

  const seenLower = new Set<string>();
  const registeredGraders: string[] = [];
  if (Array.isArray(raw.registeredGraders)) {
    for (const item of raw.registeredGraders) {
      const cleaned = normalizeGraderName(item);
      if (cleaned && !seenLower.has(cleaned.toLowerCase())) {
        seenLower.add(cleaned.toLowerCase());
        registeredGraders.push(cleaned);
      }
    }
  }

  const activeClean = normalizeGraderName(raw.lastSelectedGrader);
  const matchedActive = activeClean
    ? registeredGraders.find((g) => g.toLowerCase() === activeClean.toLowerCase()) || ''
    : '';

  return {
    registeredGraders,
    lastSelectedGrader: matchedActive,
  };
}

export function loadGraderRegistryState(): GraderRegistryState {
  try {
    const raw = localStorage.getItem(GRADER_REGISTRY_STORAGE_KEY);
    if (!raw) return sanitizeGraderRegistryState(null);
    return sanitizeGraderRegistryState(JSON.parse(raw));
  } catch {
    return sanitizeGraderRegistryState(null);
  }
}

export function saveGraderRegistryState(state: GraderRegistryState): void {
  try {
    localStorage.setItem(
      GRADER_REGISTRY_STORAGE_KEY,
      JSON.stringify(sanitizeGraderRegistryState(state))
    );
  } catch {
    // ignore storage failures
  }
}

export function registerGraderName(
  state: GraderRegistryState,
  rawName: string
): { nextState: GraderRegistryState; normalizedName: string } {
  const normalizedName = normalizeGraderName(rawName);
  if (!normalizedName) {
    return { nextState: state, normalizedName: '' };
  }

  const existingMatch = state.registeredGraders.find(
    (g) => g.toLowerCase() === normalizedName.toLowerCase()
  );
  const finalName = existingMatch || normalizedName;
  const registeredGraders = existingMatch
    ? state.registeredGraders
    : [...state.registeredGraders, finalName];

  return {
    nextState: sanitizeGraderRegistryState({
      registeredGraders,
      lastSelectedGrader: finalName,
    }),
    normalizedName: finalName,
  };
}

export function removeRegisteredGraderName(
  state: GraderRegistryState,
  nameToRemove: string
): GraderRegistryState {
  const target = normalizeGraderName(nameToRemove).toLowerCase();
  const nextList = state.registeredGraders.filter((g) => g.toLowerCase() !== target);
  const nextSelected =
    state.lastSelectedGrader.toLowerCase() === target ? '' : state.lastSelectedGrader;

  return sanitizeGraderRegistryState({
    registeredGraders: nextList,
    lastSelectedGrader: nextSelected,
  });
}

export function selectActiveGraderName(
  state: GraderRegistryState,
  graderName: string
): GraderRegistryState {
  const clean = normalizeGraderName(graderName);
  if (!clean) {
    return sanitizeGraderRegistryState({
      ...state,
      lastSelectedGrader: '',
    });
  }
  const registeredGraders = state.registeredGraders.some(
    (g) => g.toLowerCase() === clean.toLowerCase()
  )
    ? state.registeredGraders
    : [...state.registeredGraders, clean];

  return sanitizeGraderRegistryState({
    registeredGraders,
    lastSelectedGrader: clean,
  });
}

export function sanitizePrintYear(
  rawYear: unknown,
  fallbackYear: number = new Date().getFullYear()
): number {
  const safeFallback =
    Number.isFinite(fallbackYear) && fallbackYear >= 2020 && fallbackYear <= 2099
      ? Math.round(fallbackYear)
      : 2026;
  const parsed = Number(rawYear);
  if (!Number.isFinite(parsed)) return safeFallback;
  const rounded = Math.round(parsed);
  if (rounded >= 20 && rounded <= 99) {
    return 2000 + rounded;
  }
  if (rounded < 2020 || rounded > 2099) {
    return safeFallback;
  }
  return rounded;
}
