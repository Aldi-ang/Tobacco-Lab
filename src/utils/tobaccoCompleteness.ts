import {
  AgentFeeItem,
  FinishedTobaccoSerial,
  PackagingMaster,
  RawTobacco,
  TobaccoGrade,
} from '../types/tobacco';
import {
  calculateRawTobaccoCost,
  clampRating5,
  formatTaraFormula,
} from './tobaccoMath';

export interface RawTobaccoMissingFlags {
  missingSeller: boolean;
  missingName: boolean;
  missingOrigin: boolean;
  missingPackaging: boolean;
  missingWeight: boolean;
  missingPrice: boolean;
  missingAttributes: boolean;
  unfilledAttributeCount: number;
  missingLabels: string[];
  missingCount: number;
  isIncomplete: boolean;
}

export interface SerialMissingFlags {
  missingWeight: boolean;
  missingFactoryPrice: boolean;
  missingAttributes: boolean;
  missingLabels: string[];
  missingCount: number;
  isIncomplete: boolean;
}

export interface RawQuickPatch {
  name?: string;
  sellerName?: string;
  origin?: string;
  packagingType?: string;
  packagingMassKg?: number;
  flatKgTara?: number;
  percentTara?: number;
  grossWeightKg?: number;
  pricePerKgPurchase?: number;
  agentFees?: AgentFeeItem[];
  additionalPurchaseCost?: number;
  colorGrade?: TobaccoGrade;
  powerRating?: number;
  impactRating?: number;
  bitterRating?: number;
  burnRating?: number;
  sugarRating?: number;
  aromaRating?: number;
  characterNotes?: string;
}

export function getRawTobaccoMissingFlags(t: RawTobacco): RawTobaccoMissingFlags {
  const seller = (t.sellerName || t.taraFormula?.sellerName || '').trim();
  const origin = (t.origin || '').trim();
  const pkgType = (t.taraFormula?.packagingType || '').trim();
  const name = (t.name || '').trim();

  const missingSeller = !seller;
  const missingName = !name || name.toLowerCase() === 'tembakau mentah';
  const missingOrigin = !origin || origin.toLowerCase() === 'belum diisi';
  const missingPackaging = !pkgType || pkgType.toLowerCase() === 'belum dipilih';
  const missingWeight = !(Number(t.grossWeightKg) > 0);
  const missingPrice = !(Number(t.pricePerKgPurchase) > 0);

  const attrValues = [
    Number(t.powerRating) || 0,
    Number(t.impactRating) || 0,
    Number(t.bitterRating) || 0,
    Number(t.burnRating) || 0,
    Number(t.sugarRating) || 0,
    Number(t.aromaRating) || 0,
  ];
  const unfilledAttributeCount = attrValues.filter((v) => v <= 0).length;
  const missingAttributes = attrValues.every((v) => v <= 0);

  const missingLabels: string[] = [];
  if (missingWeight) missingLabels.push('Timbangan');
  if (missingPrice) missingLabels.push('Harga');
  if (missingAttributes) missingLabels.push('Atribut');
  if (missingSeller) missingLabels.push('Penjual');
  if (missingPackaging) missingLabels.push('Kemasan');
  if (missingOrigin) missingLabels.push('Daerah');
  if (missingName) missingLabels.push('Jenis');

  return {
    missingSeller,
    missingName,
    missingOrigin,
    missingPackaging,
    missingWeight,
    missingPrice,
    missingAttributes,
    unfilledAttributeCount,
    missingLabels,
    missingCount: missingLabels.length,
    isIncomplete: missingLabels.length > 0,
  };
}

export function getSerialMissingFlags(s: FinishedTobaccoSerial): SerialMissingFlags {
  const bruto = Number(s.packaging?.grossWeightPerPackage) || 0;
  const price = Number(s.factoryTargetPricePerKg) || 0;
  const attrValues = [
    Number(s.weightedPower) || 0,
    Number(s.weightedImpact) || 0,
    Number(s.weightedBitter) || 0,
    Number(s.weightedBurn) || 0,
    Number(s.weightedSugar) || 0,
    Number(s.weightedAroma) || 0,
  ];

  const missingWeight = bruto <= 0;
  const missingFactoryPrice = price <= 0;
  const missingAttributes = attrValues.every((v) => v <= 0);

  const missingLabels: string[] = [];
  if (missingFactoryPrice) missingLabels.push('Harga Pabrik');
  if (missingWeight) missingLabels.push('Timbangan');
  if (missingAttributes) missingLabels.push('Atribut');

  return {
    missingWeight,
    missingFactoryPrice,
    missingAttributes,
    missingLabels,
    missingCount: missingLabels.length,
    isIncomplete: missingLabels.length > 0,
  };
}

export function applyQuickPatchToRawTobacco(
  existing: RawTobacco,
  patch: RawQuickPatch,
  packagingList: PackagingMaster[] = []
): RawTobacco {
  const nextSeller =
    patch.sellerName !== undefined
      ? patch.sellerName.trim()
      : (existing.sellerName || existing.taraFormula?.sellerName || '').trim();
  const nextName =
    patch.name !== undefined ? patch.name.trim() || 'Tembakau Mentah' : existing.name;
  const nextOrigin =
    patch.origin !== undefined ? patch.origin.trim() || 'Belum Diisi' : existing.origin;

  let nextPackagingType =
    patch.packagingType !== undefined
      ? patch.packagingType.trim() || 'Belum Dipilih'
      : existing.taraFormula?.packagingType || 'Belum Dipilih';

  let nextPkgMassKg =
    patch.packagingMassKg !== undefined
      ? Math.max(0, Number(patch.packagingMassKg) || 0)
      : Number(existing.packagingMassKg ?? existing.taraFormula?.packagingMassKg ?? 0);

  let nextFlatTara =
    patch.flatKgTara !== undefined
      ? Math.max(0, Number(patch.flatKgTara) || 0)
      : Number(existing.taraFormula?.flatKg ?? 0);

  let nextPercentTara =
    patch.percentTara !== undefined
      ? Math.max(0, Number(patch.percentTara) || 0)
      : Number(existing.taraFormula?.percent ?? 0);

  // If packagingType changed and caller didn't explicitly override tarra fields, apply master preset
  if (
    patch.packagingType !== undefined &&
    patch.packagingMassKg === undefined &&
    patch.flatKgTara === undefined &&
    patch.percentTara === undefined
  ) {
    const matched = packagingList.find((p) => p.name === nextPackagingType);
    if (matched) {
      nextPkgMassKg = matched.packagingMassKg;
      nextFlatTara = matched.taraFlatKg;
      nextPercentTara = matched.taraPercent;
    }
  }

  const nextGrossWeightKg =
    patch.grossWeightKg !== undefined
      ? Math.max(0, Number(patch.grossWeightKg) || 0)
      : Number(existing.grossWeightKg) || 0;

  const nextPricePerKg =
    patch.pricePerKgPurchase !== undefined
      ? Math.max(0, Number(patch.pricePerKgPurchase) || 0)
      : Number(existing.pricePerKgPurchase) || 0;

  const nextAgentFees =
    patch.agentFees !== undefined ? patch.agentFees : existing.agentFees || [];

  const nextAdditionalCost =
    patch.additionalPurchaseCost !== undefined
      ? Math.max(0, Number(patch.additionalPurchaseCost) || 0)
      : Number(existing.additionalPurchaseCost) || 0;

  const nextTaraFormula = {
    ...(existing.taraFormula || { pricingBasis: 'NET_WEIGHT' as const }),
    rawFormula: formatTaraFormula(nextPercentTara, nextFlatTara),
    percent: nextPercentTara,
    flatKg: nextFlatTara,
    pricingBasis: 'NET_WEIGHT' as const,
    packagingType: nextPackagingType,
    packagingMassKg: nextPkgMassKg,
    sellerName: nextSeller,
  };

  const calc = calculateRawTobaccoCost({
    grossWeightKg: nextGrossWeightKg,
    pricePerKgPurchase: nextPricePerKg,
    realPackagingMassKg: nextPkgMassKg,
    taraFormula: nextTaraFormula,
    agentFees: nextAgentFees,
    totalAgentFeePerKg:
      patch.agentFees !== undefined ? undefined : existing.totalAgentFeePerKg,
    additionalCost: nextAdditionalCost,
  });

  // Preserve consumed stock ratio if part of the lot was already used in blends,
  // or set full realNetWeightKg if previously 0 / unused.
  const prevRealNet = Number(existing.realNetWeightKg ?? existing.netWeightKg ?? 0);
  const prevStock = Number(existing.currentStockNetKg ?? prevRealNet);
  const consumedKg = Math.max(0, Number((prevRealNet - prevStock).toFixed(2)));
  const nextCurrentStockNetKg =
    calc.realNetWeightKg > 0
      ? Math.max(0, Number((calc.realNetWeightKg - consumedKg).toFixed(2)))
      : 0;

  return {
    ...existing,
    name: nextName,
    origin: nextOrigin,
    sellerName: nextSeller,
    grossWeightKg: nextGrossWeightKg,
    packagingMassKg: nextPkgMassKg,
    pricePerKgPurchase: nextPricePerKg,
    agentFees: nextAgentFees,
    totalAgentFeePerKg: calc.totalAgentFeePerKg,
    totalAgentFeeRp: calc.totalAgentFeeRp,
    taraFormula: nextTaraFormula,
    additionalPurchaseCost: nextAdditionalCost,
    deductionKg: calc.deductionKg,
    netWeightKg: calc.netWeightKg,
    totalModalAsal: calc.totalModalAsal,
    realCostPerNetKg: calc.realCostPerNetKg,
    realNetWeightKg: calc.realNetWeightKg,
    realStockValueRp: calc.realStockValueRp,
    purchaseWeightProfitKg: calc.purchaseWeightProfitKg,
    purchaseWeightProfitRp: calc.purchaseWeightProfitRp,
    effectiveCostPerRealKg: calc.effectiveCostPerRealKg,
    currentStockNetKg: nextCurrentStockNetKg,
    colorGrade: patch.colorGrade ?? existing.colorGrade,
    powerRating:
      patch.powerRating !== undefined
        ? clampRating5(patch.powerRating)
        : existing.powerRating,
    impactRating:
      patch.impactRating !== undefined
        ? clampRating5(patch.impactRating)
        : existing.impactRating,
    bitterRating:
      patch.bitterRating !== undefined
        ? clampRating5(patch.bitterRating)
        : existing.bitterRating,
    burnRating:
      patch.burnRating !== undefined
        ? clampRating5(patch.burnRating)
        : existing.burnRating,
    sugarRating:
      patch.sugarRating !== undefined
        ? clampRating5(patch.sugarRating)
        : existing.sugarRating,
    aromaRating:
      patch.aromaRating !== undefined
        ? clampRating5(patch.aromaRating)
        : existing.aromaRating,
    characterNotes:
      patch.characterNotes !== undefined
        ? patch.characterNotes.trim()
        : existing.characterNotes,
  };
}

/**
 * Computes the next focusable/important field ID in an ordered form flow,
 * skipping any disabled/locked fields. Returns null when at the final field
 * so the form can submit cleanly on Enter.
 */
export function getNextFocusFieldId<T extends string>(
  orderedIds: readonly T[],
  currentId: T,
  isFieldSkip?: (id: T) => boolean
): T | null {
  const startIdx = orderedIds.indexOf(currentId);
  if (startIdx < 0) return orderedIds.find((id) => !isFieldSkip?.(id)) ?? null;
  for (let i = startIdx + 1; i < orderedIds.length; i++) {
    const candidate = orderedIds[i];
    if (!isFieldSkip?.(candidate)) {
      return candidate;
    }
  }
  return null;
}

export interface RadialWheelNodePosition {
  id: string;
  index: number;
  angleDeg: number;
  angleRad: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Computes evenly spaced circular coordinates around (0,0) starting at -90 deg (12 o'clock)
 * and proceeding clockwise so options are equidistant and close to drag from the center.
 */
export function computeRadialWheelNodes(
  optionIds: readonly string[],
  orbitRadiusPx = 94
): RadialWheelNodePosition[] {
  const count = optionIds.length;
  if (count === 0) return [];
  const stepDeg = 360 / count;
  return optionIds.map((id, index) => {
    const angleDeg = -90 + index * stepDeg;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      id,
      index,
      angleDeg,
      angleRad,
      offsetX: Number((Math.cos(angleRad) * orbitRadiusPx).toFixed(2)),
      offsetY: Number((Math.sin(angleRad) * orbitRadiusPx).toFixed(2)),
    };
  });
}

/**
 * Given a pointer position (clientX, clientY) and the wheel center (centerX, centerY),
 * resolves which radial option sector the user is dragging toward once they move
 * beyond `minDeadzonePx` (e.g. 24px) and within `maxOuterRadiusPx` (e.g. 165px).
 */
export function resolveRadialOptionByVector(params: {
  clientX: number;
  clientY: number;
  centerX: number;
  centerY: number;
  optionIds: readonly string[];
  minDeadzonePx?: number;
  maxOuterRadiusPx?: number;
}): string | null {
  const {
    clientX,
    clientY,
    centerX,
    centerY,
    optionIds,
    minDeadzonePx = 24,
    maxOuterRadiusPx = 165,
  } = params;
  if (optionIds.length === 0) return null;

  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const dist = Math.hypot(dx, dy);
  if (dist < minDeadzonePx || dist > maxOuterRadiusPx) {
    return null;
  }

  // Convert atan2 angle (-180..180, where -90 is 12 o'clock) to clockwise degrees from 12 o'clock [0..360)
  const rawDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const clockwiseFromTop = (rawDeg + 90 + 360) % 360;
  const sectorSize = 360 / optionIds.length;
  const closestIndex =
    Math.floor((clockwiseFromTop + sectorSize / 2) / sectorSize) % optionIds.length;

  return optionIds[closestIndex] ?? null;
}

