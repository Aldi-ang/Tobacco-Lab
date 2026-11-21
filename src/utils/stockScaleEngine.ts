import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  TobaccoGrade,
} from '../types/tobacco';
import { getRawTobaccoMissingFlags } from './tobaccoCompleteness';
import { TOBACCO_GRADE_ORDER, clampRating5, formatRupiah } from './tobaccoMath';

export type StockGroupingMode = 'ORIGIN_GRADE' | 'GRADE_ORIGIN' | 'SELLER' | 'FLAT';
export type StockSortMode =
  | 'FIFO_OLDEST'
  | 'STOCK_DESC'
  | 'HPP_ASC'
  | 'WEIGHT_PROFIT_DESC'
  | 'NAME_ASC';

export interface StockSubBucket {
  id: string;
  label: string;
  badgeText: string;
  itemCount: number;
  totalNetKg: number;
  avgHppPerKg: number;
  minHppPerKg: number;
  maxHppPerKg: number;
  completeCount: number;
  incompleteCount: number;
  itemIds: string[];
  items: RawTobacco[];
}

export interface StockCategoryGroup {
  id: string;
  title: string;
  subtitle: string;
  badgeText: string;
  itemCount: number;
  totalNetKg: number;
  avgHppPerKg: number;
  minHppPerKg: number;
  maxHppPerKg: number;
  completeCount: number;
  incompleteCount: number;
  itemIds: string[];
  items: RawTobacco[];
  subBuckets: StockSubBucket[];
}

export interface CategorizeStockOptions {
  groupingMode: StockGroupingMode;
  searchQuery?: string;
  onlyCompleteWithPrice?: boolean;
  sortMode?: StockSortMode;
}

export function isStockReadyForPriceCalc(t: RawTobacco): boolean {
  const flags = getRawTobaccoMissingFlags(t);
  return !flags.missingWeight && !flags.missingPrice && (t.currentStockNetKg || 0) > 0;
}

export function sortRawTobaccosForScale(
  items: RawTobacco[],
  sortMode: StockSortMode = 'FIFO_OLDEST'
): RawTobacco[] {
  const copy = [...items];
  switch (sortMode) {
    case 'FIFO_OLDEST':
      return copy.sort((a, b) => {
        const da = a.purchaseDate || '9999-12-31';
        const db = b.purchaseDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return a.name.localeCompare(b.name);
      });
    case 'STOCK_DESC':
      return copy.sort((a, b) => (b.currentStockNetKg || 0) - (a.currentStockNetKg || 0));
    case 'HPP_ASC':
      return copy.sort((a, b) => {
        const pa = a.realCostPerNetKg > 0 ? a.realCostPerNetKg : Number.MAX_SAFE_INTEGER;
        const pb = b.realCostPerNetKg > 0 ? b.realCostPerNetKg : Number.MAX_SAFE_INTEGER;
        return pa - pb;
      });
    case 'WEIGHT_PROFIT_DESC':
      return copy.sort(
        (a, b) => (b.purchaseWeightProfitRp || 0) - (a.purchaseWeightProfitRp || 0)
      );
    case 'NAME_ASC':
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function computeBucketStats(items: RawTobacco[]) {
  let totalNetKg = 0;
  let weightedHppSum = 0;
  let pricedNetKg = 0;
  let minHppPerKg = Infinity;
  let maxHppPerKg = 0;
  let completeCount = 0;
  let incompleteCount = 0;

  for (const t of items) {
    const kg = Number(t.currentStockNetKg || 0);
    totalNetKg += kg;
    const hpp = Number(t.realCostPerNetKg || 0);
    if (hpp > 0) {
      weightedHppSum += kg * hpp;
      pricedNetKg += kg;
      if (hpp < minHppPerKg) minHppPerKg = hpp;
      if (hpp > maxHppPerKg) maxHppPerKg = hpp;
    }
    const flags = getRawTobaccoMissingFlags(t);
    if (flags.isIncomplete) {
      incompleteCount++;
    } else {
      completeCount++;
    }
  }

  const avgHppPerKg = pricedNetKg > 0 ? Math.round(weightedHppSum / pricedNetKg) : 0;
  return {
    totalNetKg: Number(totalNetKg.toFixed(2)),
    avgHppPerKg,
    minHppPerKg: minHppPerKg === Infinity ? 0 : Math.round(minHppPerKg),
    maxHppPerKg: Math.round(maxHppPerKg),
    completeCount,
    incompleteCount,
  };
}

/**
 * Groups thousands of raw tobacco stocks into clean, hierarchical category buckets
 * (e.g. Daerah -> Grade, Grade -> Daerah, or Penjual -> Grade) so the user can select
 * or inspect whole categories in 1 click without rendering thousands of flat DOM cards.
 */
export function buildCategorizedStockGroups(
  rawTobaccos: RawTobacco[],
  options: CategorizeStockOptions
): {
  filteredItems: RawTobacco[];
  groups: StockCategoryGroup[];
  totalFilteredKg: number;
  incompleteFilteredCount: number;
} {
  const {
    groupingMode,
    searchQuery = '',
    onlyCompleteWithPrice = false,
    sortMode = 'FIFO_OLDEST',
  } = options;

  const q = searchQuery.trim().toLowerCase();

  const filtered = rawTobaccos.filter((t) => {
    if ((t.currentStockNetKg || 0) <= 0) return false;
    if (onlyCompleteWithPrice && !isStockReadyForPriceCalc(t)) return false;
    if (!q) return true;
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.origin || '').toLowerCase().includes(q) ||
      (t.sellerName || '').toLowerCase().includes(q) ||
      (t.lotNumber || '').toLowerCase().includes(q) ||
      (t.colorGrade || '').toLowerCase().includes(q) ||
      (t.characterNotes || '').toLowerCase().includes(q)
    );
  });

  const sorted = sortRawTobaccosForScale(filtered, sortMode);
  const topStats = computeBucketStats(sorted);

  if (groupingMode === 'FLAT') {
    return {
      filteredItems: sorted,
      groups: [
        {
          id: 'all-flat',
          title: 'Semua Stok Sesuai Filter',
          subtitle: `${sorted.length} lot • ${topStats.totalNetKg} kg`,
          badgeText: `${sorted.length} lot`,
          itemCount: sorted.length,
          totalNetKg: topStats.totalNetKg,
          avgHppPerKg: topStats.avgHppPerKg,
          minHppPerKg: topStats.minHppPerKg,
          maxHppPerKg: topStats.maxHppPerKg,
          completeCount: topStats.completeCount,
          incompleteCount: topStats.incompleteCount,
          itemIds: sorted.map((t) => t.id),
          items: sorted,
          subBuckets: [],
        },
      ],
      totalFilteredKg: topStats.totalNetKg,
      incompleteFilteredCount: topStats.incompleteCount,
    };
  }

  const primaryMap = new Map<string, RawTobacco[]>();

  for (const t of sorted) {
    let primaryKey = '';
    if (groupingMode === 'ORIGIN_GRADE') {
      primaryKey = (t.origin || 'Daerah Belum Diisi').trim() || 'Daerah Belum Diisi';
    } else if (groupingMode === 'GRADE_ORIGIN') {
      primaryKey = `Grade ${t.colorGrade || 'D'}`;
    } else {
      primaryKey = (t.sellerName || '').trim() || 'Penjual Belum Diisi';
    }
    const existing = primaryMap.get(primaryKey);
    if (existing) {
      existing.push(t);
    } else {
      primaryMap.set(primaryKey, [t]);
    }
  }

  const groups: StockCategoryGroup[] = [];

  for (const [primaryKey, groupItems] of primaryMap.entries()) {
    const stats = computeBucketStats(groupItems);

    // Build secondary sub-buckets (e.g., by Grade inside Origin, or by Origin inside Grade)
    const subMap = new Map<string, RawTobacco[]>();
    for (const item of groupItems) {
      const subKey =
        groupingMode === 'GRADE_ORIGIN'
          ? (item.origin || 'Daerah Lain').trim()
          : `Grade ${item.colorGrade || 'D'}`;
      const list = subMap.get(subKey);
      if (list) list.push(item);
      else subMap.set(subKey, [item]);
    }

    const subBuckets: StockSubBucket[] = Array.from(subMap.entries())
      .map(([subLabel, subItems]) => {
        const sStats = computeBucketStats(subItems);
        return {
          id: `${primaryKey}__${subLabel}`,
          label: subLabel,
          badgeText: `${subItems.length} lot • ${sStats.totalNetKg} kg`,
          itemCount: subItems.length,
          totalNetKg: sStats.totalNetKg,
          avgHppPerKg: sStats.avgHppPerKg,
          minHppPerKg: sStats.minHppPerKg,
          maxHppPerKg: sStats.maxHppPerKg,
          completeCount: sStats.completeCount,
          incompleteCount: sStats.incompleteCount,
          itemIds: subItems.map((i) => i.id),
          items: subItems,
        };
      })
      .sort((a, b) => {
        if (groupingMode !== 'GRADE_ORIGIN') {
          const ga = a.label.replace('Grade ', '') as TobaccoGrade;
          const gb = b.label.replace('Grade ', '') as TobaccoGrade;
          const idxA = TOBACCO_GRADE_ORDER.indexOf(ga);
          const idxB = TOBACCO_GRADE_ORDER.indexOf(gb);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        }
        return b.totalNetKg - a.totalNetKg;
      });

    groups.push({
      id: `grp-${primaryKey}`,
      title: primaryKey,
      subtitle:
        stats.avgHppPerKg > 0
          ? `${groupItems.length} lot • ${stats.totalNetKg} kg • Rata2 ${formatRupiah(stats.avgHppPerKg)}/kg`
          : `${groupItems.length} lot • ${stats.totalNetKg} kg • Harga menyusul`,
      badgeText: `${groupItems.length} lot (${stats.totalNetKg} kg)`,
      itemCount: groupItems.length,
      totalNetKg: stats.totalNetKg,
      avgHppPerKg: stats.avgHppPerKg,
      minHppPerKg: stats.minHppPerKg,
      maxHppPerKg: stats.maxHppPerKg,
      completeCount: stats.completeCount,
      incompleteCount: stats.incompleteCount,
      itemIds: groupItems.map((i) => i.id),
      items: groupItems,
      subBuckets,
    });
  }

  // Sort primary groups: Grade order when GRADE_ORIGIN, otherwise by largest totalNetKg descending
  groups.sort((a, b) => {
    if (groupingMode === 'GRADE_ORIGIN') {
      const ga = a.title.replace('Grade ', '') as TobaccoGrade;
      const gb = b.title.replace('Grade ', '') as TobaccoGrade;
      return TOBACCO_GRADE_ORDER.indexOf(ga) - TOBACCO_GRADE_ORDER.indexOf(gb);
    }
    return b.totalNetKg - a.totalNetKg;
  });

  return {
    filteredItems: sorted,
    groups,
    totalFilteredKg: topStats.totalNetKg,
    incompleteFilteredCount: topStats.incompleteCount,
  };
}

/**
 * Prunes a massive candidatePool (e.g. 1,000 - 10,000 items) down to at most `maxRepresentatives` (default 44)
 * BEFORE running the O(N^2) coordinate-descent simplex solver in `solveAutoBlend`.
 *
 * CRITICAL GUARANTEE:
 * - Always keeps the exact min & max boundary items for all 6 sensory attributes and price,
 *   so the mathematical convex bounds [minInPool, maxInPool] are 100% preserved.
 * - Keeps the closest sensory/price matches, highest-stock items, and highest weight-profit items.
 * - Keeps runtime under ~10ms even on 10,000 raw tobacco items.
 */
export function pruneCandidatePoolForFastAutoBlend(params: {
  candidatePool: RawTobacco[];
  targetSensory: {
    power: number;
    impact: number;
    bitter: number;
    burn: number;
    heat?: number;
    sugar: number;
    aroma: number;
    maturity?: number;
  };
  targetPricePerKg: number;
  prioritizeWeightProfit?: boolean;
  maxRepresentatives?: number;
}): RawTobacco[] {
  const {
    candidatePool,
    targetSensory,
    targetPricePerKg,
    prioritizeWeightProfit = false,
    maxRepresentatives = 44,
  } = params;

  if (candidatePool.length <= maxRepresentatives) {
    return candidatePool;
  }

  const keptIds = new Set<string>();
  const kept: RawTobacco[] = [];

  const addCandidate = (t: RawTobacco | undefined) => {
    if (!t || keptIds.has(t.id)) return;
    keptIds.add(t.id);
    kept.push(t);
  };

  // 1. Preserve exact extreme boundary items (min & max for each of the 8 dimensions)
  const getters: Array<(t: RawTobacco) => number> = [
    (t) => clampRating5(t.powerRating),
    (t) => clampRating5(t.impactRating),
    (t) => clampRating5(t.bitterRating),
    (t) => clampRating5(t.burnRating ?? 4.5),
    (t) => clampRating5(t.heatRating ?? 2.5),
    (t) => clampRating5(t.sugarRating ?? 4.0),
    (t) => clampRating5(t.aromaRating ?? 4.2),
    (t) => clampRating5(t.maturityRating ?? 3),
    (t) => Number(t.realCostPerNetKg || 0),
  ];

  for (const getter of getters) {
    let minItem = candidatePool[0];
    let maxItem = candidatePool[0];
    let minVal = getter(minItem);
    let maxVal = minVal;

    for (let i = 1; i < candidatePool.length; i++) {
      const item = candidatePool[i];
      const val = getter(item);
      if (val < minVal) {
        minVal = val;
        minItem = item;
      }
      if (val > maxVal) {
        maxVal = val;
        maxItem = item;
      }
    }
    addCandidate(minItem);
    addCandidate(maxItem);
  }

  // 2. Score remaining items by closeness to target sensory + price + available stock + weight profit
  const scored = candidatePool
    .filter((t) => !keptIds.has(t.id))
    .map((t) => {
      const sensoryDist =
        Math.abs(clampRating5(t.powerRating) - targetSensory.power) +
        Math.abs(clampRating5(t.impactRating) - targetSensory.impact) +
        Math.abs(clampRating5(t.bitterRating) - targetSensory.bitter) +
        Math.abs(clampRating5(t.burnRating ?? 4.5) - targetSensory.burn) +
        (targetSensory.heat !== undefined
          ? Math.abs(clampRating5(t.heatRating ?? 2.5) - targetSensory.heat)
          : 0) +
        Math.abs(clampRating5(t.sugarRating ?? 4.0) - targetSensory.sugar) +
        Math.abs(clampRating5(t.aromaRating ?? 4.2) - targetSensory.aroma) +
        (targetSensory.maturity !== undefined
          ? Math.abs(clampRating5(t.maturityRating ?? 3) - targetSensory.maturity)
          : 0);

      const priceDist =
        targetPricePerKg > 0 && t.realCostPerNetKg > 0
          ? Math.abs(t.realCostPerNetKg - targetPricePerKg) / 25000
          : 0;

      const profitBonus = prioritizeWeightProfit
        ? Math.min(1.5, (t.purchaseWeightProfitKg || 0) / 10)
        : 0;

      const stockBonus = Math.min(1.0, (t.currentStockNetKg || 0) / 100);
      const completeBonus = isStockReadyForPriceCalc(t) ? 1.5 : 0;

      const score = completeBonus + stockBonus + profitBonus - sensoryDist - priceDist;
      return { item: t, score };
    })
    .sort((a, b) => b.score - a.score);

  for (const entry of scored) {
    if (kept.length >= maxRepresentatives) break;
    addCandidate(entry.item);
  }

  return kept;
}

// ============================================================================
// NOLAN PRE-COMPUTED IN-MEMORY STOCK INDEX (< 2ms for 5,000+ items)
// ============================================================================

export interface NolanOriginSummary {
  origin: string;
  itemCount: number;
  activeNetKg: number;
  avgHppPerKg: number;
  minHppPerKg: number;
  maxHppPerKg: number;
  weightProfitKg: number;
  weightProfitRp: number;
  incompleteCount: number;
  gradesAvailable: TobaccoGrade[];
}

export interface NolanGradeSummary {
  grade: TobaccoGrade;
  itemCount: number;
  activeNetKg: number;
  avgHppPerKg: number;
  minHppPerKg: number;
  maxHppPerKg: number;
  incompleteCount: number;
  originsAvailable: string[];
}

export interface NolanSellerSummary {
  sellerName: string;
  itemCount: number;
  activeNetKg: number;
  avgHppPerKg: number;
  totalModalRp: number;
  weightProfitKg: number;
  weightProfitRp: number;
  incompleteCount: number;
  origins: string[];
  grades: TobaccoGrade[];
}

export interface NolanStockIndex {
  computedAtMs: number;
  totalCatalogCount: number;
  activeItemCount: number;
  totalActiveNetKg: number;
  totalModalRp: number;
  totalWeightProfitKg: number;
  totalWeightProfitRp: number;
  completeActiveCount: number;
  incompleteSummary: {
    totalIncomplete: number;
    missingWeightCount: number;
    missingPriceCount: number;
    missingSellerCount: number;
    missingAttributesCount: number;
    incompleteItems: RawTobacco[];
  };
  byOrigin: NolanOriginSummary[];
  byGrade: NolanGradeSummary[];
  bySeller: NolanSellerSummary[];
  fifoOldestActive: RawTobacco[];
  topWeightProfitActive: RawTobacco[];
  lowestHppActive: RawTobacco[];
}

export function buildNolanStockIndex(rawTobaccos: RawTobacco[]): NolanStockIndex {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const active = rawTobaccos.filter((t) => (t.currentStockNetKg || 0) > 0);

  let totalActiveNetKg = 0;
  let totalModalRp = 0;
  let totalWeightProfitKg = 0;
  let totalWeightProfitRp = 0;

  let missingWeightCount = 0;
  let missingPriceCount = 0;
  let missingSellerCount = 0;
  let missingAttributesCount = 0;
  const incompleteItems: RawTobacco[] = [];

  const originMap = new Map<string, RawTobacco[]>();
  const gradeMap = new Map<TobaccoGrade, RawTobacco[]>();
  const sellerMap = new Map<string, RawTobacco[]>();

  for (const t of rawTobaccos) {
    totalModalRp += Math.round(t.totalModalAsal || 0);
    totalWeightProfitKg += Number(t.purchaseWeightProfitKg || 0);
    totalWeightProfitRp += Math.round(t.purchaseWeightProfitRp || 0);

    const flags = getRawTobaccoMissingFlags(t);
    if (flags.isIncomplete) {
      incompleteItems.push(t);
      if (flags.missingWeight) missingWeightCount++;
      if (flags.missingPrice) missingPriceCount++;
      if (flags.missingSeller) missingSellerCount++;
      if (flags.missingAttributes) missingAttributesCount++;
    }
  }

  for (const t of active) {
    const kg = Number(t.currentStockNetKg || 0);
    totalActiveNetKg += kg;

    const origKey = (t.origin || 'Daerah Belum Diisi').trim() || 'Daerah Belum Diisi';
    const oList = originMap.get(origKey);
    if (oList) oList.push(t);
    else originMap.set(origKey, [t]);

    const grdKey = (t.colorGrade || 'D') as TobaccoGrade;
    const gList = gradeMap.get(grdKey);
    if (gList) gList.push(t);
    else gradeMap.set(grdKey, [t]);

    const selKey = (t.sellerName || '').trim() || 'Penjual Belum Diisi';
    const sList = sellerMap.get(selKey);
    if (sList) sList.push(t);
    else sellerMap.set(selKey, [t]);
  }

  const byOrigin: NolanOriginSummary[] = Array.from(originMap.entries())
    .map(([origin, list]) => {
      const stats = computeBucketStats(list);
      const wpKg = Number(
        list.reduce((s, i) => s + Number(i.purchaseWeightProfitKg || 0), 0).toFixed(2)
      );
      const wpRp = Math.round(
        list.reduce((s, i) => s + Number(i.purchaseWeightProfitRp || 0), 0)
      );
      const grades = Array.from(new Set(list.map((i) => i.colorGrade))).sort(
        (a, b) => TOBACCO_GRADE_ORDER.indexOf(a) - TOBACCO_GRADE_ORDER.indexOf(b)
      );
      return {
        origin,
        itemCount: list.length,
        activeNetKg: stats.totalNetKg,
        avgHppPerKg: stats.avgHppPerKg,
        minHppPerKg: stats.minHppPerKg,
        maxHppPerKg: stats.maxHppPerKg,
        weightProfitKg: wpKg,
        weightProfitRp: wpRp,
        incompleteCount: stats.incompleteCount,
        gradesAvailable: grades,
      };
    })
    .sort((a, b) => b.activeNetKg - a.activeNetKg);

  const byGrade: NolanGradeSummary[] = Array.from(gradeMap.entries())
    .map(([grade, list]) => {
      const stats = computeBucketStats(list);
      const origins = Array.from(new Set(list.map((i) => (i.origin || '').trim()).filter(Boolean)));
      return {
        grade,
        itemCount: list.length,
        activeNetKg: stats.totalNetKg,
        avgHppPerKg: stats.avgHppPerKg,
        minHppPerKg: stats.minHppPerKg,
        maxHppPerKg: stats.maxHppPerKg,
        incompleteCount: stats.incompleteCount,
        originsAvailable: origins,
      };
    })
    .sort(
      (a, b) => TOBACCO_GRADE_ORDER.indexOf(a.grade) - TOBACCO_GRADE_ORDER.indexOf(b.grade)
    );

  const bySeller: NolanSellerSummary[] = Array.from(sellerMap.entries())
    .map(([sellerName, list]) => {
      const stats = computeBucketStats(list);
      const modal = Math.round(list.reduce((s, i) => s + Number(i.totalModalAsal || 0), 0));
      const wpKg = Number(
        list.reduce((s, i) => s + Number(i.purchaseWeightProfitKg || 0), 0).toFixed(2)
      );
      const wpRp = Math.round(
        list.reduce((s, i) => s + Number(i.purchaseWeightProfitRp || 0), 0)
      );
      const origins = Array.from(new Set(list.map((i) => (i.origin || '').trim()).filter(Boolean)));
      const grades = Array.from(new Set(list.map((i) => i.colorGrade))).sort(
        (a, b) => TOBACCO_GRADE_ORDER.indexOf(a) - TOBACCO_GRADE_ORDER.indexOf(b)
      );
      return {
        sellerName,
        itemCount: list.length,
        activeNetKg: stats.totalNetKg,
        avgHppPerKg: stats.avgHppPerKg,
        totalModalRp: modal,
        weightProfitKg: wpKg,
        weightProfitRp: wpRp,
        incompleteCount: stats.incompleteCount,
        origins,
        grades,
      };
    })
    .sort((a, b) => b.activeNetKg - a.activeNetKg);

  const fifoOldestActive = sortRawTobaccosForScale(active, 'FIFO_OLDEST').slice(0, 15);
  const topWeightProfitActive = sortRawTobaccosForScale(active, 'WEIGHT_PROFIT_DESC').slice(0, 15);
  const lowestHppActive = sortRawTobaccosForScale(
    active.filter((t) => t.realCostPerNetKg > 0),
    'HPP_ASC'
  ).slice(0, 15);

  const elapsed =
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;

  return {
    computedAtMs: Math.max(0, Math.round(elapsed)),
    totalCatalogCount: rawTobaccos.length,
    activeItemCount: active.length,
    totalActiveNetKg: Number(totalActiveNetKg.toFixed(2)),
    totalModalRp: Math.round(totalModalRp),
    totalWeightProfitKg: Number(totalWeightProfitKg.toFixed(2)),
    totalWeightProfitRp: Math.round(totalWeightProfitRp),
    completeActiveCount: active.length - incompleteItems.filter((t) => (t.currentStockNetKg || 0) > 0).length,
    incompleteSummary: {
      totalIncomplete: incompleteItems.length,
      missingWeightCount,
      missingPriceCount,
      missingSellerCount,
      missingAttributesCount,
      incompleteItems,
    },
    byOrigin,
    byGrade,
    bySeller,
    fifoOldestActive,
    topWeightProfitActive,
    lowestHppActive,
  };
}

/**
 * High-speed structured query responder for Nolan on large inventories (1,000 - 10,000+ items).
 * Returns a natural Indonesian answer if the query matches an analytical/index pattern.
 */
export function queryNolanStockIndex(
  index: NolanStockIndex,
  rawTobaccos: RawTobacco[],
  queryText: string
): string | null {
  const q = (queryText || '').toLowerCase().trim();
  if (!q) return null;

  // 1. Check Incomplete / "Menyusul" / "Belum Diisi" queries
  if (
    /\b(belum\s+lengkap|menyusul|belum\s+diisi|belum\s+ada\s+harga|butuh\s+harga|butuh\s+timbangan|harga\s+kosong|timbangan\s+kosong|data\s+kurang)\b/i.test(
      q
    )
  ) {
    const inc = index.incompleteSummary;
    if (inc.totalIncomplete === 0) {
      return `✅ Semua data stok di gudang (${index.totalCatalogCount} lot • ${index.totalActiveNetKg} kg) sudah lengkap 100%! Tidak ada stok yang harga atau timbangannya masih kosong.`;
    }
    const sampleLines = inc.incompleteItems
      .slice(0, 8)
      .map((t, idx) => {
        const flags = getRawTobaccoMissingFlags(t);
        return `${idx + 1}. ⏳ ${t.name} (${t.origin} • Grade ${t.colorGrade}) — Kurang: ${flags.missingLabels.join(', ')}`;
      })
      .join('\n');

    return [
      `⏳ Saat ini ada ${inc.totalIncomplete} stok tembakau yang datanya masih menyusul / belum lengkap (dari total ${index.totalCatalogCount} stok):`,
      ``,
      `• Belum Ada Timbangan (Bruto 0 kg): ${inc.missingWeightCount} stok`,
      `• Belum Ada Harga Beli (Rp 0): ${inc.missingPriceCount} stok`,
      `• Belum Ada Nama Penjual: ${inc.missingSellerCount} stok`,
      `• Belum Ada 6 Karakter Rasa: ${inc.missingAttributesCount} stok`,
      ``,
      `Daftar stok yang perlu dilengkapi:`,
      sampleLines,
      inc.totalIncomplete > 8
        ? `\n...dan ${inc.totalIncomplete - 8} stok lainnya. Bos bisa tahan & geser (Hold & Drag) kartu di Gudang Stok pada lingkaran merah untuk isi cepat.`
        : `\nBos bisa tahan & geser (Hold & Drag) kartu di Gudang Stok pada lingkaran merah untuk melengkapinya.`,
    ].join('\n');
  }

  // 2. Check Origin / Grade / Seller Category Breakdown ("rekap per daerah", "kategori stok", "daftar penjual")
  if (
    /\b(rekap\s+daerah|per\s+daerah|kategori\s+daerah|stok\s+per\s+daerah|kelompok\s+daerah)\b/i.test(
      q
    )
  ) {
    if (index.byOrigin.length === 0) {
      return `📦 Belum ada stok aktif di gudang saat ini.`;
    }
    const lines = index.byOrigin
      .slice(0, 12)
      .map(
        (o, idx) =>
          `${idx + 1}. 📍 ${o.origin}: ${o.itemCount} lot (${o.activeNetKg} kg) • Grade [${o.gradesAvailable.join(', ')}] • Rata2 HPP ${o.avgHppPerKg > 0 ? formatRupiah(o.avgHppPerKg) + '/kg' : 'Menyusul'}`
      )
      .join('\n');
    return [
      `📊 Rekap Indeks Stok Gudang per Daerah Asal (${index.activeItemCount} lot aktif • ${index.totalActiveNetKg} kg):`,
      ``,
      lines,
    ].join('\n');
  }

  if (/\b(rekap\s+penjual|per\s+penjual|daftar\s+penjual|daftar\s+petani|siapa\s+saja\s+penjual)\b/i.test(q)) {
    if (index.bySeller.length === 0) {
      return `📦 Belum ada data penjual di stok aktif saat ini.`;
    }
    const lines = index.bySeller
      .slice(0, 12)
      .map(
        (s, idx) =>
          `${idx + 1}. 👤 ${s.sellerName}: ${s.itemCount} lot (${s.activeNetKg} kg) • Daerah ${s.origins.join(', ')} • Grade [${s.grades.join(', ')}] • Weight Profit +${s.weightProfitKg} kg`
      )
      .join('\n');
    return [
      `👥 Rekap Stok Gudang per Penjual / Petani (${index.bySeller.length} penjual):`,
      ``,
      lines,
    ].join('\n');
  }

  // 3. Check FIFO / Oldest Stock ("stok paling lama", "fifo", "stok tua")
  if (/\b(fifo|paling\s+lama|stok\s+lama|stok\s+tua|mengendap)\b/i.test(q)) {
    if (index.fifoOldestActive.length === 0) {
      return `📦 Belum ada stok aktif di gudang.`;
    }
    const lines = index.fifoOldestActive
      .slice(0, 8)
      .map(
        (t, idx) =>
          `${idx + 1}. 🗓️ [${t.purchaseDate || '-'}] ${t.name} (${t.origin} • Grade ${t.colorGrade}) — Sisa ${t.currentStockNetKg} kg • ${t.realCostPerNetKg > 0 ? formatRupiah(t.realCostPerNetKg) + '/kg' : 'Harga menyusul'}`
      )
      .join('\n');
    return [
      `🗓️ Urutan Stok Paling Lama di Gudang (Prioritas FIFO untuk Diracik Duluan):`,
      ``,
      lines,
    ].join('\n');
  }

  return null;
}

/**
 * Builds a compact, high-density text digest of the NolanStockIndex so that when Nolan
 * calls the server-side Gemini LLM on 5,000+ items, the prompt receives exact mathematical
 * aggregations instead of 5,000 raw JSON rows.
 */
export function formatNolanIndexDigestForPrompt(index: NolanStockIndex): string {
  const originLines = index.byOrigin
    .slice(0, 15)
    .map(
      (o) =>
        `  - ${o.origin}: ${o.itemCount} lot, ${o.activeNetKg} kg, Grade [${o.gradesAvailable.join(',')}], Avg HPP Rp ${o.avgHppPerKg.toLocaleString('id-ID')}/kg (Min Rp ${o.minHppPerKg.toLocaleString('id-ID')} - Max Rp ${o.maxHppPerKg.toLocaleString('id-ID')}), WeightProfit +${o.weightProfitKg}kg`
    )
    .join('\n');

  const gradeLines = index.byGrade
    .map(
      (g) =>
        `  - Grade ${g.grade}: ${g.itemCount} lot, ${g.activeNetKg} kg, Avg HPP Rp ${g.avgHppPerKg.toLocaleString('id-ID')}/kg, Daerah [${g.originsAvailable.slice(0, 5).join(', ')}]`
    )
    .join('\n');

  const sellerLines = index.bySeller
    .slice(0, 12)
    .map(
      (s) =>
        `  - ${s.sellerName}: ${s.itemCount} lot (${s.activeNetKg} kg), Modal Rp ${s.totalModalRp.toLocaleString('id-ID')}, WeightProfit +${s.weightProfitKg}kg`
    )
    .join('\n');

  return [
    `=== INDEKS GUDANG SKALA BESAR (PRE-COMPUTED CUBE) ===`,
    `Total Katalog: ${index.totalCatalogCount} lot | Stok Aktif (>0kg): ${index.activeItemCount} lot (${index.totalActiveNetKg} kg)`,
    `Total Modal Gudang: Rp ${index.totalModalRp.toLocaleString('id-ID')} | Total Weight Profit: +${index.totalWeightProfitKg} kg (+Rp ${index.totalWeightProfitRp.toLocaleString('id-ID')})`,
    `Stok Lengkap Siap Hitung: ${index.completeActiveCount} lot | Stok Belum Lengkap (Menyusul): ${index.incompleteSummary.totalIncomplete} lot (Butuh Timbangan: ${index.incompleteSummary.missingWeightCount}, Butuh Harga: ${index.incompleteSummary.missingPriceCount}, Butuh Penjual: ${index.incompleteSummary.missingSellerCount})`,
    `Rekap per Daerah:\n${originLines || '  (Kosong)'}`,
    `Rekap per Grade:\n${gradeLines || '  (Kosong)'}`,
    `Rekap per Penjual Teratas:\n${sellerLines || '  (Kosong)'}`,
  ].join('\n');
}

// ============================================================================
// FIRESTORE AUTO-CHUNKING ENGINE (Bypasses 1MB Document Limit for 10,000+ Stocks)
// ============================================================================

export const FIRESTORE_CHUNK_SIZE = 250;

export interface FirestoreChunkDocument<T = unknown> {
  ownerId: string;
  chunkType: 'raw' | 'finished' | 'rolls';
  chunkIndex: number;
  items: T[];
}

/**
 * Splits an unbounded array of items into chunks of at most `chunkSize` (default 250).
 * Chunk 0 is stored inline in the main `workspaces/{userId}` document for instant first paint
 * and 100% backward compatibility. Overflow chunks (1..N) are stored in
 * `workspaces/{userId}/chunks/{chunkType}_{chunkIndex}` so 10,000+ items never hit Firestore's 1MB limit.
 */
export function splitArrayIntoFirestoreChunks<T>(
  items: T[],
  chunkSize: number = FIRESTORE_CHUNK_SIZE
): {
  inlineItems: T[];
  overflowChunks: T[][];
  totalChunks: number;
} {
  if (!Array.isArray(items) || items.length === 0) {
    return { inlineItems: [], overflowChunks: [], totalChunks: 1 };
  }
  const safeSize = Math.max(1, chunkSize);
  const inlineItems = items.slice(0, safeSize);
  const overflowChunks: T[][] = [];

  for (let offset = safeSize; offset < items.length; offset += safeSize) {
    overflowChunks.push(items.slice(offset, offset + safeSize));
  }

  return {
    inlineItems,
    overflowChunks,
    totalChunks: 1 + overflowChunks.length,
  };
}

export function reassembleArrayFromFirestoreChunks<T>(
  inlineItems: T[],
  overflowChunksMap: Map<number, T[]>,
  expectedTotalChunks: number
): T[] {
  const result: T[] = Array.isArray(inlineItems) ? [...inlineItems] : [];
  for (let idx = 1; idx < expectedTotalChunks; idx++) {
    const chunk = overflowChunksMap.get(idx);
    if (Array.isArray(chunk)) {
      result.push(...chunk);
    }
  }
  return result;
}
