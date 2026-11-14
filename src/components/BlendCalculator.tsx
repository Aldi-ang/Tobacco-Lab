import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Scale,
  Trash2,
  Sparkles,
  Save,
  Layers,
  AlertTriangle,
  RotateCcw,
  PackageCheck,
  Package,
  CopyCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
  Bot,
  Zap,
  Undo2,
} from 'lucide-react';
import {
  RawTobacco,
  BlendIngredient,
  AdditionalCostItem,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
  PackageDraftItem,
  SaveFinishedDraft,
  TobaccoGrade,
} from '../types/tobacco';
import {
  calculateBlendMetrics,
  calculateFactoryDelivery,
  calculateTaraDeduction,
  roundHalfUpKg,
  formatRupiah,
  formatTaraFormula,
  GRADE_LABELS,
  clampRating5,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';
import { SegmentedControl } from './RatingSegmentSlider';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
  buildSerialFactoryCalcDetail,
} from './CalculationDetailModal';
import { AutoRacikModal } from './AutoRacikModal';

const DRAFT_STORAGE_KEY = 'kretek_master_save_draft_v3';

interface BlendCalculatorProps {
  rawTobaccos: RawTobacco[];
  packagingList: PackagingMaster[];
  factoryList: FactoryMaster[];
  rollSamples: TobaccoRollSample[];
  existingSerialCount: number;
  onSaveMultipleFinished: (finishedList: FinishedTobaccoSerial[]) => void;
  initialIngredients?: BlendIngredient[];
  onAskNolanRecommendation?: () => void;
}

export const BlendCalculator: React.FC<BlendCalculatorProps> = ({
  rawTobaccos,
  packagingList,
  factoryList,
  rollSamples,
  existingSerialCount,
  onSaveMultipleFinished,
  initialIngredients = [],
  onAskNolanRecommendation,
}) => {
  // Mobile one-by-one snapped panel switcher (< lg)
  const [mobilePanel, setMobilePanel] = useState<'ingredients' | 'packaging' | 'summary'>(
    'ingredients'
  );

  // Collapsible states ("hidden until pressed" minimalism)
  const [expandedIngId, setExpandedIngId] = useState<string | null>(null);
  const [isPerSeriCostExpanded, setIsPerSeriCostExpanded] = useState<boolean>(false);
  const [isSensoryExpanded, setIsSensoryExpanded] = useState<boolean>(false);

  // Selected ingredients in the blend (Default clean [] unless prefilled from Stock/Nolan)
  const [ingredients, setIngredients] = useState<BlendIngredient[]>(() => {
    if (initialIngredients.length > 0) return initialIngredients;
    return [];
  });

  const [isAutoRacikOpen, setIsAutoRacikOpen] = useState(false);
  const [autoRacikBannerMsg, setAutoRacikBannerMsg] = useState<string | null>(null);
  const [confirmRemoveIngIdx, setConfirmRemoveIngIdx] = useState<number | null>(null);
  const [confirmClearAllBlend, setConfirmClearAllBlend] = useState<boolean>(false);
  const [undoBlendSnapshot, setUndoBlendSnapshot] = useState<{
    label: string;
    previousIngredients: BlendIngredient[];
  } | null>(null);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  // Helper to build a default package item with its own packaging type, packagingCostRp & pressCostRp
  const buildDefaultPackageItem = (
    index: number,
    totalCount: number,
    totalNetKg: number,
    baseSerialIndex: number
  ): PackageDraftItem => {
    const defaultPkg = packagingList[0] || {
      id: 'pkg-krj-muntilan',
      name: 'KRJ MUNTILAN',
      packagingMassKg: 3,
      taraPercent: 0,
      taraFlatKg: 3,
      packagingCostRp: 35000,
      pressCostRp: 15000,
    };
    const defaultFac = factoryList[0] || {
      id: 'fac-cello-muntilan',
      name: 'CELLO MUNTILAN',
      sampleDeductionKg: 0,
    };
    const activeWarehouseRoll = rollSamples.find((r) => !r.isSentToFactory);
    const defaultRoll = activeWarehouseRoll?.id || 'NEW_AUTO_ROLL';
    const evenNet = totalCount > 0 ? Number((totalNetKg / totalCount).toFixed(2)) : totalNetKg;
    const bruto = Number((evenNet + defaultPkg.packagingMassKg).toFixed(2));
    const nextNum = 1 + baseSerialIndex + index;

    return {
      serialNumber: String(nextNum),
      packagingId: defaultPkg.id,
      packagingType: defaultPkg.name,
      packagingMassKg: defaultPkg.packagingMassKg,
      packagingCostRp: defaultPkg.packagingCostRp ?? 35000,
      pressCostRp: defaultPkg.pressCostRp ?? 15000,
      netWeightKg: evenNet,
      brutoWeightKg: bruto,
      targetFactoryId: defaultFac.id,
      targetFactoryName: defaultFac.name,
      taraPercent: defaultPkg.taraPercent,
      taraFlatKg: defaultPkg.taraFlatKg,
      sampleDeductionKg: defaultFac.sampleDeductionKg,
      rollId: defaultRoll,
      targetPricePerKg: 135000,
      grade: 'E',
    };
  };

  // Load or initialize Draft State
  const [draft, setDraft] = useState<SaveFinishedDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.packages) && parsed.packages.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return {
      recipeName: '',
      packageCount: 2,
      packages: [
        buildDefaultPackageItem(0, 2, 103, existingSerialCount),
        buildDefaultPackageItem(1, 2, 103, existingSerialCount),
      ],
      blendNotes: '',
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  const additionalCostsFromPackages: AdditionalCostItem[] = draft.packages.flatMap((pkg, idx) => [
    {
      id: `pkg-cost-${idx}`,
      name: `Seri ${pkg.serialNumber} — Harga Kemasan (${pkg.packagingType})`,
      amount: Number(pkg.packagingCostRp) || 0,
    },
    {
      id: `press-cost-${idx}`,
      name: `Seri ${pkg.serialNumber} — Ongkos Packaging/Press (${pkg.packagingType})`,
      amount: Number(pkg.pressCostRp) || 0,
    },
  ]);

  const metrics = calculateBlendMetrics({
    ingredients,
    additionalCosts: additionalCostsFromPackages,
  });

  const redistributeWeightsEvenly = (
    count: number,
    currentPackages: PackageDraftItem[],
    totalNetKg: number
  ) => {
    const validCount = Math.max(1, Math.min(50, count));
    const evenNet = validCount > 0 ? Number((totalNetKg / validCount).toFixed(2)) : 0;
    const updated: PackageDraftItem[] = [];

    for (let i = 0; i < validCount; i++) {
      if (currentPackages[i]) {
        const existing = currentPackages[i];
        const itemNet =
          i === validCount - 1
            ? Number(Math.max(0, totalNetKg - evenNet * (validCount - 1)).toFixed(2))
            : evenNet;
        updated.push({
          ...existing,
          netWeightKg: itemNet,
          brutoWeightKg: Number((itemNet + existing.packagingMassKg).toFixed(2)),
        });
      } else {
        const basePkg =
          currentPackages[0] ||
          buildDefaultPackageItem(i, validCount, totalNetKg, existingSerialCount);
        const nextNum = 1 + existingSerialCount + i;
        const itemNet =
          i === validCount - 1
            ? Number(Math.max(0, totalNetKg - evenNet * (validCount - 1)).toFixed(2))
            : evenNet;
        updated.push({
          ...basePkg,
          serialNumber: String(nextNum),
          netWeightKg: itemNet,
          brutoWeightKg: Number((itemNet + basePkg.packagingMassKg).toFixed(2)),
        });
      }
    }
    return updated;
  };

  const handleOpenSaveModal = () => {
    const currentSum = draft.packages.reduce((acc, p) => acc + p.netWeightKg, 0);
    if (Math.abs(currentSum - metrics.totalBlendNetKg) > 0.1) {
      setDraft((prev) => ({
        ...prev,
        packages: redistributeWeightsEvenly(
          prev.packageCount,
          prev.packages,
          metrics.totalBlendNetKg
        ),
      }));
    }
    setIsSaveModalOpen(true);
  };

  const handlePackageCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(50, newCount || 1));
    setDraft((prev) => ({
      ...prev,
      packageCount: validCount,
      packages: redistributeWeightsEvenly(validCount, prev.packages, metrics.totalBlendNetKg),
    }));
  };

  const handleSplitByBasketKg = (targetBasketKg: number) => {
    const totalKg = metrics.totalBlendNetKg;
    if (totalKg <= 0 || targetBasketKg <= 0) return;
    const count = Math.max(1, Math.min(50, Math.ceil(totalKg / targetBasketKg)));
    setDraft((prev) => {
      const basePkg =
        prev.packages[0] || buildDefaultPackageItem(0, count, totalKg, existingSerialCount);
      const firstSerial = (prev.packages[0]?.serialNumber || String(1 + existingSerialCount)).trim();
      const trailingMatch = firstSerial.match(/^(.*?)(\d+)$/);

      const nextPackages: PackageDraftItem[] = [];
      let remaining = totalKg;
      for (let i = 0; i < count; i++) {
        const existing = prev.packages[i];
        const itemNet =
          i === count - 1
            ? Number(Math.max(0, remaining).toFixed(2))
            : Number(Math.min(remaining, targetBasketKg).toFixed(2));
        remaining = Number(Math.max(0, remaining - itemNet).toFixed(2));

        const autoSerial = trailingMatch
          ? `${trailingMatch[1]}${Number(trailingMatch[2]) + i}`
          : String(1 + existingSerialCount + i);

        const pkgMass = existing?.packagingMassKg ?? basePkg.packagingMassKg;
        nextPackages.push({
          ...(existing || basePkg),
          serialNumber: existing?.serialNumber || autoSerial,
          netWeightKg: itemNet,
          brutoWeightKg: Number((itemNet + pkgMass).toFixed(2)),
        });
      }
      return {
        ...prev,
        packageCount: count,
        packages: nextPackages,
      };
    });
  };

  const handleUpdatePackageItem = (index: number, patch: Partial<PackageDraftItem>) => {
    setDraft((prev) => {
      const nextPackages = [...prev.packages];
      const current = { ...nextPackages[index], ...patch };

      if (patch.packagingId !== undefined) {
        const foundPkg = packagingList.find((p) => p.id === patch.packagingId);
        if (foundPkg) {
          current.packagingType = foundPkg.name;
          current.packagingMassKg = foundPkg.packagingMassKg;
          current.taraPercent = foundPkg.taraPercent;
          current.taraFlatKg = foundPkg.taraFlatKg;
          current.packagingCostRp = foundPkg.packagingCostRp ?? 35000;
          current.pressCostRp = foundPkg.pressCostRp ?? 15000;
          current.brutoWeightKg = Number(
            (current.netWeightKg + foundPkg.packagingMassKg).toFixed(2)
          );
        }
      }

      if (patch.targetFactoryId !== undefined) {
        const foundFac = factoryList.find((f) => f.id === patch.targetFactoryId);
        if (foundFac) {
          current.targetFactoryName = foundFac.name;
          current.sampleDeductionKg = foundFac.sampleDeductionKg;
        }
      }

      if (patch.netWeightKg !== undefined || patch.packagingMassKg !== undefined) {
        current.brutoWeightKg = Number((current.netWeightKg + current.packagingMassKg).toFixed(2));
      }

      if (
        patch.brutoWeightKg !== undefined &&
        patch.netWeightKg === undefined &&
        patch.packagingMassKg === undefined
      ) {
        current.netWeightKg = Number(
          Math.max(0, patch.brutoWeightKg - current.packagingMassKg).toFixed(2)
        );
      }

      nextPackages[index] = current;
      return { ...prev, packages: nextPackages };
    });
  };

  const handleBulkApplyFromFirst = () => {
    if (draft.packages.length <= 1) return;
    const first = draft.packages[0];
    const firstSerial = first.serialNumber.trim();
    const trailingMatch = firstSerial.match(/^(.*?)(\d+)$/);

    setDraft((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg, idx) => {
        const nextSerial =
          idx === 0
            ? first.serialNumber
            : trailingMatch
            ? `${trailingMatch[1]}${Number(trailingMatch[2]) + idx}`
            : pkg.serialNumber;
        return {
          ...pkg,
          serialNumber: nextSerial,
          packagingId: first.packagingId,
          packagingType: first.packagingType,
          packagingMassKg: first.packagingMassKg,
          packagingCostRp: first.packagingCostRp,
          pressCostRp: first.pressCostRp,
          brutoWeightKg: Number((pkg.netWeightKg + first.packagingMassKg).toFixed(2)),
          targetFactoryId: first.targetFactoryId,
          targetFactoryName: first.targetFactoryName,
          taraPercent: first.taraPercent,
          taraFlatKg: first.taraFlatKg,
          sampleDeductionKg: first.sampleDeductionKg,
          rollId: first.rollId,
          targetPricePerKg: first.targetPricePerKg,
          grade: first.grade,
        };
      }),
    }));
  };

  const handleResetDraft = () => {
    const fresh: SaveFinishedDraft = {
      recipeName: '',
      packageCount: 1,
      packages: [buildDefaultPackageItem(0, 1, metrics.totalBlendNetKg, existingSerialCount)],
      blendNotes: '',
    };
    setDraft(fresh);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const handleAddIngredient = (tobaccoId: string) => {
    const raw = rawTobaccos.find((t) => t.id === tobaccoId);
    if (!raw) return;
    if (ingredients.some((item) => item.tobaccoId === tobaccoId)) return;

    const newItem: BlendIngredient = {
      tobaccoId: raw.id,
      tobaccoName: raw.name,
      origin: raw.origin,
      sellerName: raw.sellerName,
      usedNetKg: 25,
      percentageInBlend: 0,
      realCostPerNetKg: raw.realCostPerNetKg,
      effectiveCostPerRealKg: raw.effectiveCostPerRealKg ?? raw.realCostPerNetKg,
      subtotalCost: 25 * raw.realCostPerNetKg,
      powerRating: clampRating5(raw.powerRating),
      impactRating: clampRating5(raw.impactRating),
      bitterRating: clampRating5(raw.bitterRating),
      burnRating: clampRating5(raw.burnRating ?? 4.5),
      sugarRating: clampRating5(raw.sugarRating ?? 4.0),
      aromaRating: clampRating5(raw.aromaRating ?? 4.2),
      colorGrade: raw.colorGrade,
      characterNotes: raw.characterNotes,
    };

    setIngredients([...ingredients, newItem]);
  };

  const handleWeightChange = (index: number, weight: number) => {
    const newIngredients = [...ingredients];
    const item = newIngredients[index];
    const validWeight = Math.max(0, weight);
    item.usedNetKg = validWeight;
    item.subtotalCost = validWeight * item.realCostPerNetKg;
    setIngredients(newIngredients);
  };

  const handleRemoveIngredient = (index: number) => {
    const target = ingredients[index];
    if (!target) return;
    setUndoBlendSnapshot({
      label: `Bahan "${target.tobaccoName}" dihapus dari racikan`,
      previousIngredients: [...ingredients],
    });
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
    setConfirmRemoveIngIdx(null);
  };

  const handleClearAllIngredients = () => {
    if (ingredients.length === 0) return;
    setUndoBlendSnapshot({
      label: `Semua bahan racikan (${ingredients.length} jenis) dikosongkan`,
      previousIngredients: [...ingredients],
    });
    setIngredients([]);
    setConfirmClearAllBlend(false);
  };

  const handleSaveFinished = (e: React.FormEvent) => {
    e.preventDefault();
    if (ingredients.length === 0 || metrics.totalBlendNetKg <= 0) return;

    const nowStr = new Date().toISOString().split('T')[0];
    const mixtureBatchId = `MIX-${Date.now()}`;
    const autoLabel =
      draft.recipeName.trim() ||
      `Campuran ${ingredients.map((i) => i.origin.split(' ')[0]).join(' + ')} (${nowStr})`;

    const createdSerials: FinishedTobaccoSerial[] = draft.packages.map((pkg, idx) => {
      const weightRatio =
        metrics.totalBlendNetKg > 0
          ? pkg.netWeightKg / metrics.totalBlendNetKg
          : 1 / draft.packages.length;

      const packageIngredients: BlendIngredient[] = metrics.updatedIngredients.map((ing) => {
        const portionKg = Number((ing.usedNetKg * weightRatio).toFixed(2));
        return {
          ...ing,
          usedNetKg: portionKg,
          subtotalCost: Math.round(portionKg * ing.realCostPerNetKg),
        };
      });

      const packageMaterialCost = Math.round(metrics.totalMaterialCost * weightRatio);
      const packageOverheadCost = Math.round(
        (Number(pkg.packagingCostRp) || 0) + (Number(pkg.pressCostRp) || 0)
      );
      const packageProductionCost = packageMaterialCost + packageOverheadCost;
      const packageHppPerNetKg =
        pkg.netWeightKg > 0
          ? Math.round((packageProductionCost / pkg.netWeightKg) * 100) / 100
          : metrics.hppPerNetKg;

      const taraFormulaStr = formatTaraFormula(
        pkg.taraPercent,
        pkg.taraFlatKg,
        pkg.sampleDeductionKg
      );

      const packagingSpec = {
        packagingId: pkg.packagingId,
        packagingType: pkg.packagingType,
        packagingMassKg: pkg.packagingMassKg,
        packagingCostRp: pkg.packagingCostRp,
        pressCostRp: pkg.pressCostRp,
        packageCount: 1,
        netTobaccoWeightKg: pkg.netWeightKg,
        grossWeightPerPackage: pkg.brutoWeightKg,
        factoryTaraFormula: {
          rawFormula: taraFormulaStr,
          percent: pkg.taraPercent,
          flatKg: pkg.taraFlatKg,
          sampleKg: pkg.sampleDeductionKg,
          pricingBasis: 'NET_WEIGHT' as const,
          packagingType: pkg.packagingType,
          packagingMassKg: pkg.packagingMassKg,
        },
      };

      const delivery = calculateFactoryDelivery({
        packaging: packagingSpec,
        hppPerNetKg: packageHppPerNetKg,
        totalProductionCost: packageProductionCost,
        factoryTargetPricePerKg: pkg.targetPricePerKg,
      });

      const targetRoll = rollSamples.find((r) => r.id === pkg.rollId);

      return {
        id: `tbk-fin-${Date.now()}-${idx}`,
        serialNumber: pkg.serialNumber.trim() || `${1 + existingSerialCount + idx}`,
        mixtureBatchId,
        packageIndex: idx + 1,
        totalPackagesInMixture: draft.packages.length,
        recipeName:
          draft.packages.length > 1
            ? `${autoLabel} [Seri ${pkg.serialNumber}]`
            : autoLabel,
        targetFactoryId: pkg.targetFactoryId,
        targetFactory: pkg.targetFactoryName,
        createdAt: nowStr,
        ingredients: packageIngredients,
        totalBlendNetKg: pkg.netWeightKg,
        weightedPower: metrics.weightedPower,
        weightedImpact: metrics.weightedImpact,
        weightedBitter: metrics.weightedBitter,
        weightedBurn: metrics.weightedBurn,
        weightedSugar: metrics.weightedSugar,
        weightedAroma: metrics.weightedAroma,
        compositeColorGrade: pkg.grade || metrics.compositeColorGrade,
        totalMaterialCost: packageMaterialCost,
        additionalCosts: [
          {
            id: `pkg-${idx}`,
            name: `Harga Kemasan (${pkg.packagingType})`,
            amount: Number(pkg.packagingCostRp) || 0,
          },
          {
            id: `press-${idx}`,
            name: `Ongkos Packaging/Press (${pkg.packagingType})`,
            amount: Number(pkg.pressCostRp) || 0,
          },
        ],
        totalOverheadCost: packageOverheadCost,
        totalProductionCost: packageProductionCost,
        hppPerNetKg: packageHppPerNetKg,
        effectiveHppAfterTaraPerKg: delivery.effectiveHppAfterTaraPerKg,
        packaging: packagingSpec,
        factoryDeductionKg: delivery.factoryDeductionKg,
        factoryNetBillableKg: delivery.factoryNetBillableKg,
        factoryWeightProfitKg: delivery.factoryWeightProfitKg,
        factoryWeightProfitRp: delivery.factoryWeightProfitRp,
        buyWeightProfitRp: Math.round(metrics.totalBuyWeightProfitRp * weightRatio),
        factoryTargetPricePerKg: pkg.targetPricePerKg,
        projectedRevenue: delivery.projectedRevenue,
        projectedProfit: delivery.projectedProfit,
        profitMarginPercent: delivery.profitMarginPercent,
        factoryStatus: 'PENDING',
        rollId: pkg.rollId,
        rollNumber: targetRoll?.rollNumber || 'GUL-2026-001',
        rollRackNumber: targetRoll?.rackLocation || 'Rak Sampel Gudang',
        notes: draft.blendNotes,
      };
    });

    onSaveMultipleFinished(createdSerials);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setIsSaveModalOpen(false);
  };

  const unusedTobaccos = rawTobaccos.filter(
    (t) => !ingredients.some((i) => i.tobaccoId === t.id)
  );

  return (
    <div className="space-y-3 pb-16 md:pb-4">
      {/* Slideable Stepper + Save Action Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 lg:hidden min-w-0">
          <SegmentedControl
            value={mobilePanel}
            onChange={setMobilePanel}
            className="w-full"
            options={[
              {
                id: 'ingredients',
                label: '1. Komposisi',
                fullLabel: '1. Komposisi Bahan Baku Campuran',
                icon: <Layers className="w-3.5 h-3.5" />,
                badge: ingredients.length,
              },
              {
                id: 'packaging',
                label: '2. Kemas & Press',
                fullLabel: '2. Biaya Kemasan & Ongkos Press per Seri',
                icon: <Package className="w-3.5 h-3.5" />,
                badge: draft.packageCount,
              },
              {
                id: 'summary',
                label: '3. Hasil HPP',
                fullLabel: '3. Ringkasan HPP & Karakteristik (/5)',
                icon: <Scale className="w-3.5 h-3.5" />,
              },
            ]}
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsAutoRacikOpen(true)}
            className="h-9 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/80 font-black text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            title="Auto-Racik Otomatis dari Stok Tersedia (4 Parameter)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Auto-Racik</span>
          </button>

          {onAskNolanRecommendation && (
            <button
              type="button"
              aria-label="Minta Rekomendasi Racikan Nolan AI"
              onClick={onAskNolanRecommendation}
              className="group relative h-9 w-9 shrink-0 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/70 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Bot className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500/70 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                Tanya Nolan (Rekomendasi Racikan AI)
              </span>
            </button>
          )}

          {ingredients.length > 0 && (
            <button
              type="button"
              aria-label="Kosongkan Bahan Campuran"
              onClick={() => setConfirmClearAllBlend(true)}
              className="group relative h-9 w-9 shrink-0 rounded-xl bg-black hover:bg-zinc-900 text-white border border-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                Reset Komposisi
              </span>
            </button>
          )}

          <button
            type="button"
            title="Simpan Tembakau Jadi (Tetapkan Nomor Seri Kemasan)"
            disabled={ingredients.length === 0 || metrics.totalBlendNetKg <= 0}
            onClick={handleOpenSaveModal}
            className="btn-amber-outline h-9 px-3.5 rounded-xl font-black text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
            <span>Simpan Seri</span>
          </button>
        </div>
      </div>

      {/* Undo or Confirm Clear Banner inside Racikan */}
      {confirmClearAllBlend && (
        <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/70 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-white font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Konfirmasi: Kosongkan semua ({ingredients.length} jenis) bahan dari racikan ini?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmClearAllBlend(false)}
              className="h-7 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleClearAllIngredients}
              className="h-7 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black cursor-pointer"
            >
              Ya, Kosongkan
            </button>
          </div>
        </div>
      )}

      {undoBlendSnapshot && (
        <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/60 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-zinc-200 font-bold">{undoBlendSnapshot.label}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIngredients(undoBlendSnapshot.previousIngredients);
                setUndoBlendSnapshot(null);
              }}
              className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black inline-flex items-center gap-1 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Urungkan (Undo)</span>
            </button>
            <button
              type="button"
              onClick={() => setUndoBlendSnapshot(null)}
              className="h-7 px-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {autoRacikBannerMsg && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/50 flex items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{autoRacikBannerMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoRacikBannerMsg(null)}
            className="text-zinc-400 hover:text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Grid: Desktop shows 2 columns; Mobile shows 1 snapped panel at a time */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: 7 Cols */}
        <div className="lg:col-span-7 space-y-5">
          {/* PANEL 1: Ingredients Section */}
          <div
            className={`${
              mobilePanel === 'ingredients' ? 'block' : 'hidden lg:block'
            } requiem-card border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>1. Komposisi Bahan ({ingredients.length} Jenis)</span>
                </h2>
                {ingredients.length > 0 && (
                  <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                    Total Dipakai: <b className="text-white">{metrics.totalBlendNetKg} kg</b>
                    {' • '}
                    Total Sisa Bahan Terpilih:{' '}
                    <b className="text-amber-400">
                      {Number(
                        ingredients
                          .reduce((acc, ing) => {
                            const r = rawTobaccos.find((t) => t.id === ing.tobaccoId);
                            const stok = r ? r.currentStockNetKg : ing.usedNetKg;
                            return acc + Math.max(0, stok - ing.usedNetKg);
                          }, 0)
                          .toFixed(2)
                      )}{' '}
                      kg
                    </b>
                  </p>
                )}
              </div>

              {unusedTobaccos.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddIngredient(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="h-9 px-3 bg-black border border-zinc-800 rounded-xl text-xs font-bold text-white focus:outline-hidden focus:border-zinc-700 cursor-pointer max-w-[250px] sm:max-w-xs truncate"
                  aria-label="Tambah Bahan Tembakau"
                >
                  <option value="" disabled>
                    + Tambah Bahan...
                  </option>
                  {unusedTobaccos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} [{t.colorGrade}] • Stok: {t.currentStockNetKg} kg • {formatRupiah(t.realCostPerNetKg)}/kg
                    </option>
                  ))}
                </select>
              )}
            </div>

            {ingredients.length === 0 ? (
              <div className="py-8 px-4 text-center border-2 border-dashed border-zinc-800 rounded-xl bg-black/80 space-y-3">
                <Scale className="w-8 h-8 text-zinc-500 mx-auto" />
                <div className="space-y-1">
                  <p className="text-white text-xs sm:text-sm font-extrabold">
                    Meja Racikan Bersih (Belum Ada Bahan Tembakau)
                  </p>
                  <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                    Pilih bahan satu per satu melalui menu <b>+ Tambah Bahan...</b> di kanan atas, atau gunakan mesin <b>Auto-Racik</b> untuk meracik otomatis berdasarkan Grade, 6 Karakter, Daerah Asal & Target HPP.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAutoRacikOpen(true)}
                    className="btn-amber-outline h-9 px-4 rounded-xl font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Buka Mesin Auto-Racik (4 Parameter)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {ingredients.map((item, index) => {
                  const percentage =
                    metrics.totalBlendNetKg > 0
                      ? ((item.usedNetKg / metrics.totalBlendNetKg) * 100).toFixed(1)
                      : '0';

                  const rawData = rawTobaccos.find((t) => t.id === item.tobaccoId);
                  const availableStockKg = Number(
                    (rawData ? rawData.currentStockNetKg : item.usedNetKg).toFixed(2)
                  );
                  const remainingStockKg = Number(
                    (availableStockKg - item.usedNetKg).toFixed(2)
                  );
                  const isStockWarning = remainingStockKg < 0;
                  const isExpanded = expandedIngId === item.tobaccoId;

                  return (
                    <div
                      key={item.tobaccoId}
                      className="bg-black/90 p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-extrabold text-white text-xs sm:text-sm truncate">
                            {item.tobaccoName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-black bg-black text-zinc-200 border border-zinc-700 shrink-0">
                            Grade {item.colorGrade}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                            {formatRupiah(item.realCostPerNetKg)}/kg
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label="Lihat / Sembunyikan Info Karakter Bahan"
                            onClick={() =>
                              setExpandedIngId(isExpanded ? null : item.tobaccoId)
                            }
                            className={`group relative h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg border cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-8 right-0 z-50 px-2 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                              Info 6 Karakter Bahan
                            </span>
                          </button>

                          {confirmRemoveIngIdx === index ? (
                            <div className="inline-flex items-center gap-1 bg-red-950/60 border border-red-500/70 rounded-lg px-1.5 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredient(index)}
                                className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-black cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveIngIdx(null)}
                                className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 hover:text-white text-[10px] font-bold cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveIngIdx(index)}
                              className="group relative h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-white bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
                              aria-label={`Hapus ${item.tobaccoName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-8 right-0 z-50 px-2 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                                Hapus dari Racikan
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Remaining Weight Info Strip (Stok Gudang vs Dipakai vs Sisa Bahan) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800/90 text-[11px] font-mono">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-zinc-400">
                            Stok Gudang: <b className="text-white">{availableStockKg} kg</b>
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-400">
                            Dipakai: <b className="text-white">{item.usedNetKg} kg</b>
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className={isStockWarning ? 'text-rose-400 font-bold' : 'text-amber-300 font-bold'}>
                            Sisa Bahan:{' '}
                            <b className={isStockWarning ? 'text-rose-400' : 'text-amber-400'}>
                              {remainingStockKg} kg
                            </b>
                          </span>
                        </div>

                        {availableStockKg > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleWeightChange(
                                  index,
                                  Number((availableStockKg * 0.5).toFixed(1))
                                )
                              }
                              className="px-1.5 py-0.5 rounded bg-black hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 text-[10px] font-bold cursor-pointer"
                            >
                              50% ({Number((availableStockKg * 0.5).toFixed(1))} kg)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleWeightChange(index, availableStockKg)}
                              className="px-1.5 py-0.5 rounded bg-black hover:bg-zinc-900 text-amber-400 border border-zinc-800 text-[10px] font-bold cursor-pointer"
                            >
                              Semua ({availableStockKg} kg)
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Collapsible Sensory Info (Hidden until pressed) */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 space-y-1">
                              <div className="flex flex-wrap gap-3 font-mono">
                                <span>
                                  Power: <b className="text-white">{clampRating5(item.powerRating)}/5</b>
                                </span>
                                <span>
                                  Impact: <b className="text-white">{clampRating5(item.impactRating)}/5</b>
                                </span>
                                <span>
                                  Bitter: <b className="text-white">{clampRating5(item.bitterRating)}/5</b>
                                </span>
                                <span>
                                  Burn: <b className="text-white">{clampRating5(item.burnRating ?? 4.5)}/5</b>
                                </span>
                                <span>
                                  Sugar: <b className="text-white">{clampRating5(item.sugarRating ?? 4.0)}/5</b>
                                </span>
                                <span>
                                  Aroma: <b className="text-white">{clampRating5(item.aromaRating ?? 4.2)}/5</b>
                                </span>
                              </div>
                              {(item.characterNotes || rawData?.characterNotes) && (
                                <p className="text-zinc-400 flex items-center gap-1 pt-1">
                                  <FileText className="w-3 h-3 text-zinc-300 shrink-0" />
                                  <span>{item.characterNotes || rawData?.characterNotes}</span>
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Weight Controller & Share Percentage */}
                      <div className="grid grid-cols-12 gap-2.5 items-center pt-1.5 border-t border-zinc-900">
                        <div className="col-span-6 sm:col-span-5 flex items-center gap-2">
                          <label className="text-[11px] text-zinc-300 font-bold shrink-0">
                            Pakai:
                          </label>
                          <div className="relative flex-1 min-w-[70px]">
                            <NumericInput
                              value={item.usedNetKg}
                              onChange={(val) => handleWeightChange(index, val)}
                              aria-label={`Takaran Bersih ${item.tobaccoName}`}
                              className="w-full h-8 pr-7 pl-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden focus:border-zinc-700"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] pointer-events-none">
                              kg
                            </span>
                          </div>
                        </div>

                        <div className="col-span-2 sm:col-span-3 text-center">
                          <span className="font-mono font-extrabold text-amber-400 text-xs">
                            {percentage}%
                          </span>
                        </div>

                        <div className="col-span-4 text-right">
                          <div className="font-mono font-black text-white text-xs">
                            {formatRupiah(item.usedNetKg * item.realCostPerNetKg)}
                          </div>
                        </div>
                      </div>

                      {isStockWarning && (
                        <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-zinc-950 p-2 rounded-lg border border-rose-500/40">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>
                            Pemakaian melebihi stok gudang ({availableStockKg} kg) sebesar{' '}
                            <b>{Math.abs(remainingStockKg)} kg</b>.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PANEL 2: Biaya Tambahan Produksi (Kemasan & Ongkos Press per Seri — NO duplicate Master button! Fixes Screenshot 2) */}
          <div
            className={`${
              mobilePanel === 'packaging' ? 'block' : 'hidden lg:block'
            } requiem-card border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                  <Package className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>2. Biaya Tambahan Produksi (Kemasan & Press)</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Total Kemasan & Press ({draft.packageCount} Seri):{' '}
                  <b className="text-white font-mono">{formatRupiah(metrics.totalOverheadCost)}</b>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {metrics.totalBlendNetKg > 0 && (
                  <div className="inline-flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 px-1.5">Bagi Keranjang:</span>
                    {[45, 50, 55].map((kgVal) => (
                      <button
                        key={kgVal}
                        type="button"
                        onClick={() => handleSplitByBasketKg(kgVal)}
                        className="h-7 px-2 rounded-lg bg-black hover:bg-amber-500/20 text-zinc-200 hover:text-amber-300 border border-zinc-800 hover:border-amber-500/60 text-[10px] font-mono font-bold cursor-pointer transition-colors"
                        title={`Bagi otomatis ${metrics.totalBlendNetKg} kg menjadi keranjang @${kgVal} kg`}
                      >
                        @{kgVal}kg
                      </button>
                    ))}
                  </div>
                )}

                <div className="inline-flex items-center gap-2 bg-black px-3 h-9 rounded-xl border border-zinc-800">
                  <span className="text-xs font-bold text-zinc-300 whitespace-nowrap">
                    Jumlah Seri:
                  </span>
                  <NumericInput
                    allowDecimals={false}
                    value={draft.packageCount}
                    onChange={handlePackageCountChange}
                    aria-label="Jumlah Seri Kemasan"
                    className="w-14 h-7 px-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 font-mono font-black text-xs text-center focus:outline-hidden"
                  />
                </div>

                <button
                  type="button"
                  title="Tampilkan / Sembunyikan Pengaturan Kemasan & Press per Nomor Seri"
                  onClick={() => setIsPerSeriCostExpanded((v) => !v)}
                  className="btn-amber-outline min-h-9 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>{isPerSeriCostExpanded ? 'Tutup Rincian' : 'Atur per Seri'}</span>
                  {isPerSeriCostExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Per-Seri Packaging Dropdown + Packaging Cost + Press Cost Rows (Hidden until pressed) */}
            <AnimatePresence>
              {isPerSeriCostExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2.5 overflow-hidden pt-2 border-t border-zinc-800"
                >
                  {draft.packages.map((pkg, idx) => {
                    const totalSeriOverhead =
                      (Number(pkg.packagingCostRp) || 0) + (Number(pkg.pressCostRp) || 0);
                    return (
                      <div
                        key={idx}
                        className="bg-black/90 p-3 rounded-xl border border-zinc-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-black text-amber-400 border border-zinc-700 font-mono font-black text-[11px]">
                              SERI #{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={pkg.serialNumber}
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, { serialNumber: e.target.value })
                              }
                              placeholder="No. Seri"
                              className="w-24 h-7 px-2 bg-zinc-950 border border-zinc-700 rounded-md text-zinc-300 font-mono font-bold text-xs focus:outline-hidden focus:border-zinc-700"
                            />
                          </div>

                          <div className="text-[11px] font-mono text-zinc-400">
                            Subtotal: <b className="text-white">{formatRupiah(totalSeriOverhead)}</b>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 mb-1">
                              Pilih Packaging Seri {pkg.serialNumber}
                            </label>
                            <select
                              value={pkg.packagingId}
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, { packagingId: e.target.value })
                              }
                              aria-label={`Pilih Packaging Seri ${pkg.serialNumber}`}
                              className="w-full h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-bold text-xs focus:outline-hidden"
                            >
                              {packagingList.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Tara {p.taraFlatKg}kg)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 mb-1">
                              Harga Kemasan (Rp)
                            </label>
                            <NumericInput
                              value={pkg.packagingCostRp ?? 35000}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { packagingCostRp: val })
                              }
                              aria-label={`Harga Kemasan Seri ${pkg.serialNumber}`}
                              className="w-full h-8 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-zinc-200 mb-1">
                              Ongkos Press (Rp)
                            </label>
                            <NumericInput
                              value={pkg.pressCostRp ?? 15000}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { pressCostRp: val })
                              }
                              aria-label={`Ongkos Press Seri ${pkg.serialNumber}`}
                              className="w-full h-8 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: 5 Cols - Live Calculation & Collapsible /5 Sensory */}
        <div
          className={`${
            mobilePanel === 'summary' ? 'block' : 'hidden lg:block'
          } lg:col-span-5 space-y-5`}
        >
          <div className="requiem-card border border-zinc-700 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-black text-zinc-200">
                  KALKULATOR HPP REAL-TIME
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Modal Rata-Rata & Karakter (/5)
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-black text-amber-400 border border-zinc-700">
                Grade {metrics.compositeColorGrade}
              </span>
            </div>

            {/* Big Number: HPP Per Net KG & Breakdown (Specific Per-Panel Breakdown) */}
            {(() => {
              const openBlendHppModal = (focus: 'HPP_PER_KG' | 'TOTAL_PRODUCTION_COST') => {
                if (focus === 'HPP_PER_KG') {
                  setCalcDetail({
                    title: `1. Modal Rata-Rata / KG Campuran (${formatRupiah(metrics.hppPerNetKg)}/kg)`,
                    subtitle: `Total Modal ${formatRupiah(metrics.totalProductionCost)} ÷ Total Netto ${metrics.totalBlendNetKg} kg`,
                    badgeText: 'PANEL HPP / KG • ASAL ANGKA MODAL RATA-RATA PER KG',
                    coreFormula:
                      'HPP Rata-Rata / KG = Total Modal Produksi ÷ Total Netto Campuran',
                    appliedFormula: `HPP Rata-Rata / KG = ${formatRupiah(metrics.totalProductionCost)} ÷ ${metrics.totalBlendNetKg} kg = ${formatRupiah(metrics.hppPerNetKg)}/kg`,
                    steps: [
                      {
                        stepNumber: 1,
                        title: 'Jumlahkan Total Berat Netto Campuran',
                        formula: 'Total Netto = Σ Berat Netto Bahan yang Dipakai',
                        substitution:
                          metrics.updatedIngredients
                            .map((ing) => `${ing.usedNetKg} kg (${ing.tobaccoName})`)
                            .join(' + ') + ` = ${metrics.totalBlendNetKg} kg`,
                        resultLabel: 'Total Netto',
                        resultValue: `${metrics.totalBlendNetKg} kg`,
                        explanation: `Total berat bersih seluruh daun tembakau yang dicampur adalah ${metrics.totalBlendNetKg} kg.`,
                        highlight: 'white',
                      },
                      {
                        stepNumber: 2,
                        title: 'Jumlahkan Total Modal Produksi (Bahan + Kemasan & Press)',
                        formula: 'Total Modal Produksi = Nilai Bahan + Biaya Kemasan & Press',
                        substitution: `${formatRupiah(metrics.totalMaterialCost)} + ${formatRupiah(metrics.totalOverheadCost)} = ${formatRupiah(metrics.totalProductionCost)}`,
                        resultLabel: 'Total Modal',
                        resultValue: formatRupiah(metrics.totalProductionCost),
                        explanation: `Gabungan nilai bahan baku (${formatRupiah(metrics.totalMaterialCost)}) dan biaya ${draft.packageCount} kemasan & press (${formatRupiah(metrics.totalOverheadCost)}).`,
                        highlight: 'white',
                      },
                      {
                        stepNumber: 3,
                        title: 'Bagi Total Modal dengan Total Netto Campuran',
                        formula: 'HPP Rata-Rata / KG = Total Modal Produksi ÷ Total Netto Campuran',
                        substitution: `${formatRupiah(metrics.totalProductionCost)} ÷ ${metrics.totalBlendNetKg} kg = ${formatRupiah(metrics.hppPerNetKg)}/kg`,
                        resultLabel: 'HPP / KG',
                        resultValue: `${formatRupiah(metrics.hppPerNetKg)}/kg`,
                        explanation: `Modal rata-rata per 1 kg campuran adalah ${formatRupiah(metrics.hppPerNetKg)}/kg (HPP kas efektif setelah Weight Profit Beli: ${formatRupiah(metrics.effectiveRealPaidHppPerKg)}/kg).`,
                        highlight: 'amber',
                      },
                    ],
                    summaryRows: [
                      {
                        label: 'Total Modal Produksi',
                        value: formatRupiah(metrics.totalProductionCost),
                        highlight: 'white',
                      },
                      {
                        label: 'Total Netto Campuran',
                        value: `${metrics.totalBlendNetKg} kg`,
                        highlight: 'white',
                      },
                      {
                        label: 'HPP Rata-Rata / KG',
                        value: `${formatRupiah(metrics.hppPerNetKg)}/kg`,
                        highlight: 'amber',
                      },
                    ],
                    conclusion: `Angka ${formatRupiah(metrics.hppPerNetKg)}/kg berasal dari Total Modal Produksi ${formatRupiah(metrics.totalProductionCost)} dibagi Total Netto Campuran ${metrics.totalBlendNetKg} kg.`,
                  });
                  return;
                }

                // focus === 'TOTAL_PRODUCTION_COST'
                const ingSteps = metrics.updatedIngredients.map((ing, i) => ({
                  stepNumber: i + 1,
                  title: `Bahan #${i + 1}: ${ing.tobaccoName} (${ing.origin})`,
                  formula: 'Subtotal Bahan = Netto Dipakai × Harga Beli / KG Nota',
                  substitution: `${ing.usedNetKg} kg (${ing.percentageInBlend}%) × ${formatRupiah(ing.realCostPerNetKg)}/kg = ${formatRupiah(ing.subtotalCost)}`,
                  resultLabel: 'Subtotal Bahan',
                  resultValue: formatRupiah(ing.subtotalCost),
                  explanation:
                    ing.embeddedWeightProfitRp && ing.embeddedWeightProfitRp !== 0
                      ? `Mengandung Weight Profit Beli ${ing.embeddedWeightProfitRp > 0 ? '+' : ''}${formatRupiah(ing.embeddedWeightProfitRp)} (Modal kas riil: ${formatRupiah(ing.subtotalRealPaidCost || ing.subtotalCost)}).`
                      : `Proporsi ${ing.percentageInBlend}% dari total campuran ${metrics.totalBlendNetKg} kg.`,
                  highlight: 'white' as const,
                }));

                setCalcDetail({
                  title: `2. Rincian Total Modal Produksi (${formatRupiah(metrics.totalProductionCost)})`,
                  subtitle: `${ingredients.length} Jenis Bahan (${metrics.totalBlendNetKg} kg) + ${draft.packageCount} Kemasan Seri`,
                  badgeText: 'PANEL TOTAL MODAL • ASAL ANGKA NILAI BAHAN & KEMASAN',
                  coreFormula:
                    'Total Modal Produksi = Σ (Netto Bahan × Harga Beli) + Σ (Harga Kemasan + Ongkos Press)',
                  appliedFormula: `Total Modal Produksi = ${formatRupiah(metrics.totalMaterialCost)} + ${formatRupiah(metrics.totalOverheadCost)} (${draft.packageCount} Seri) = ${formatRupiah(metrics.totalProductionCost)}`,
                  steps: [
                    ...ingSteps,
                    {
                      stepNumber: ingSteps.length + 1,
                      title: 'Tambahkan Biaya Kemasan & Ongkos Press',
                      formula: 'Total Modal = Total Nilai Bahan + Biaya Kemasan & Press',
                      substitution: `${formatRupiah(metrics.totalMaterialCost)} + ${formatRupiah(metrics.totalOverheadCost)} (${draft.packageCount} Seri) = ${formatRupiah(metrics.totalProductionCost)}`,
                      resultLabel: 'Total Modal Produksi',
                      resultValue: formatRupiah(metrics.totalProductionCost),
                      explanation: `Total Nilai Bahan ${formatRupiah(metrics.totalMaterialCost)} ditambah biaya kemasan & press ${formatRupiah(metrics.totalOverheadCost)} = ${formatRupiah(metrics.totalProductionCost)}.`,
                      highlight: 'amber',
                    },
                  ],
                  summaryRows: [
                    {
                      label: 'Total Nilai Bahan',
                      value: formatRupiah(metrics.totalMaterialCost),
                      highlight: 'white',
                    },
                    {
                      label: 'Kemasan & Press',
                      value: formatRupiah(metrics.totalOverheadCost),
                      highlight: 'white',
                    },
                    {
                      label: 'Total Modal Produksi',
                      value: formatRupiah(metrics.totalProductionCost),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Total Modal Produksi sebesar ${formatRupiah(metrics.totalProductionCost)} berasal dari penjumlahan nilai ${ingredients.length} bahan (${formatRupiah(metrics.totalMaterialCost)}) ditambah biaya kemasan & press (${formatRupiah(metrics.totalOverheadCost)}).`,
                });
              };

              return (
                <>
                  <button
                    type="button"
                    onClick={() => openBlendHppModal('HPP_PER_KG')}
                    className="w-full relative bg-black/95 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all text-center space-y-1 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-5" />
                      <span className="text-[11px] text-zinc-300 font-bold uppercase">
                        MODAL RATA-RATA / KG CAMPURAN:
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
                      {formatRupiah(metrics.hppPerNetKg)}{' '}
                      <span className="text-xs font-normal text-zinc-400">/ kg</span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Netto {metrics.totalBlendNetKg} kg + Kemasan & Press ({draft.packageCount} Seri)
                    </p>
                  </button>

                  {/* Compact Breakdown (Specific Total Production Cost Breakdown) */}
                  <button
                    type="button"
                    onClick={() => openBlendHppModal('TOTAL_PRODUCTION_COST')}
                    className="w-full text-left bg-black/80 hover:bg-black p-3 rounded-xl border border-zinc-800 hover:border-zinc-800 transition-all space-y-1.5 text-xs cursor-pointer group"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-900">
                      <span className="text-[10px] font-black uppercase text-zinc-200">
                        Rincian Komponen Modal Produksi
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-900 text-zinc-300">
                      <span>Total Netto Campuran:</span>
                      <span className="font-mono font-bold text-white">{metrics.totalBlendNetKg} kg</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-zinc-900 text-zinc-300">
                      <span>Nilai Bahan (Harga Nota × Netto):</span>
                      <span className="font-mono font-bold text-white">
                        {formatRupiah(metrics.totalMaterialCost)}
                      </span>
                    </div>
                    {metrics.totalBuyWeightProfitRp !== 0 && (
                      <div className="flex items-center justify-between py-1 border-b border-zinc-900 text-zinc-200">
                        <span>Weight Profit Beli Terkandung:</span>
                        <span className="font-mono font-bold text-white">
                          {metrics.totalBuyWeightProfitRp > 0 ? '+' : ''}
                          {formatRupiah(metrics.totalBuyWeightProfitRp)} (Kas Riil:{' '}
                          {formatRupiah(metrics.totalRealPaidMaterialCost)})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1 border-b border-zinc-900 text-zinc-300">
                      <span>Biaya Kemasan & Press ({draft.packageCount} Seri):</span>
                      <span className="font-mono font-bold text-white">
                        {formatRupiah(metrics.totalOverheadCost)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 font-black text-white">
                      <span>Total Modal Produksi:</span>
                      <span className="font-mono text-amber-400 text-sm">
                        {formatRupiah(metrics.totalProductionCost)}
                      </span>
                    </div>
                  </button>
                </>
              );
            })()}

            {/* Collapsible 5 Sensory Ratings (/5) — Hidden Until Pressed */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsSensoryExpanded((v) => !v)}
                className="w-full min-h-9 px-3 py-1.5 rounded-xl bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-800 flex items-center justify-between text-xs font-bold text-amber-400 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    5 Karakteristik (/5): P:{metrics.weightedPower} • I:{metrics.weightedImpact} • B:
                    {metrics.weightedBitter}
                  </span>
                </span>
                {isSensoryExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              <AnimatePresence>
                {isSensoryExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 overflow-hidden pt-1"
                  >
                    {[
                      { label: 'Power (Kekuatan)', val: metrics.weightedPower },
                      { label: 'Impact (Tarikan)', val: metrics.weightedImpact },
                      { label: 'Bitter (Pahit/Gurih)', val: metrics.weightedBitter },
                      { label: 'Burn (Daya Bakar)', val: metrics.weightedBurn },
                      { label: 'Sugar (Manis)', val: metrics.weightedSugar },
                      { label: 'Aroma (Karakter Wangi)', val: metrics.weightedAroma },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-black/90 p-2 rounded-xl border border-zinc-800"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white font-semibold">{s.label}:</span>
                          <span className="font-mono font-black text-amber-400">{s.val} / 5</span>
                        </div>
                        <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (s.val / 5) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              title="Bagi Campuran ke Kemasan & Tetapkan Nomor Seri"
              disabled={ingredients.length === 0 || metrics.totalBlendNetKg <= 0}
              onClick={handleOpenSaveModal}
              className="btn-amber-outline w-full min-h-10 py-2 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <PackageCheck className="w-4 h-4 stroke-[2.2] shrink-0" />
              <span>Simpan Seri ({draft.packageCount} Kemasan)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save Modal: "Simpan Tembakau Jadi = Nomor Seri Eksklusif per Kemasan" */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl text-white overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-black text-amber-400 border border-zinc-700">
                    <PackageCheck className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-extrabold text-white">
                        Simpan Tembakau Jadi (Nomor Seri)
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-200 border border-zinc-800 font-bold">
                        Draft Aktif
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDraft}
                    className="min-h-8 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-300" /> Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                    aria-label="Tutup modal simpan"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSaveFinished}
                className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1 text-xs"
              >
                {/* Top Info Banner: Average Cost / KG vs Total Mixture */}
                <div className="bg-black border border-zinc-800 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <div className="text-[10px] text-zinc-200 font-extrabold uppercase">
                      Modal Rata-Rata / KG (Average Cost/KG)
                    </div>
                    <div className="text-lg font-mono font-black text-amber-400 mt-0.5">
                      {formatRupiah(metrics.hppPerNetKg)} / kg
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-white font-bold uppercase">
                      Total Netto & Modal Produksi
                    </div>
                    <div className="text-sm font-mono font-extrabold text-white mt-0.5">
                      {metrics.totalBlendNetKg} kg Netto • {formatRupiah(metrics.totalProductionCost)}
                    </div>
                  </div>
                </div>

                {/* Row 1: Jumlah Packaging Dihasilkan & Optional Keterangan Campuran */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-black p-3.5 rounded-xl border border-zinc-800 items-end">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-extrabold text-zinc-200 mb-1">
                      Jumlah Seri *
                    </label>
                    <NumericInput
                      allowDecimals={false}
                      value={draft.packageCount}
                      onChange={handlePackageCountChange}
                      className="w-full h-9 px-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-black text-sm focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-xs font-bold text-white mb-1">
                      Label Setoran / Catatan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={draft.recipeName}
                      onChange={(e) => setDraft({ ...draft, recipeName: e.target.value })}
                      placeholder="Contoh: CELLO MUNTILAN (Opsional)"
                      className="w-full h-9 px-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-xs focus:outline-hidden focus:border-zinc-700"
                    />
                  </div>

                  <div className="sm:col-span-3 flex justify-end">
                    {draft.packages.length > 1 && (
                      <button
                        type="button"
                        onClick={handleBulkApplyFromFirst}
                        className="btn-amber-outline w-full min-h-9 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CopyCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Samakan Seri #1</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Package List */}
                <div className="space-y-3">
                  {draft.packages.map((pkg, idx) => {
                    const weightRatio =
                      metrics.totalBlendNetKg > 0
                        ? pkg.netWeightKg / metrics.totalBlendNetKg
                        : 1 / draft.packages.length;
                    const pkgOverhead =
                      (Number(pkg.packagingCostRp) || 0) + (Number(pkg.pressCostRp) || 0);
                    const pkgProdCost =
                      Math.round(metrics.totalMaterialCost * weightRatio) + pkgOverhead;
                    const pkgTaraCalc = calculateTaraDeduction(pkg.brutoWeightKg, {
                      percent: Number(pkg.taraPercent) || 0,
                      flatKg: Number(pkg.taraFlatKg) || 0,
                      sampleKg: Number(pkg.sampleDeductionKg) || 0,
                    });
                    const pkgTaraDeductionKg = pkgTaraCalc.deductionKg;
                    const pkgBillableNetKg = pkgTaraCalc.netWeightKg;
                    const pkgRealNetKg = roundHalfUpKg(pkg.netWeightKg);
                    const pkgFactoryWeightProfitKg = roundHalfUpKg(
                      pkgBillableNetKg - pkgRealNetKg
                    );
                    const pkgFactoryWeightProfitRp = Math.round(
                      pkgFactoryWeightProfitKg * (Number(pkg.targetPricePerKg) || 0)
                    );

                    return (
                      <div
                        key={idx}
                        className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-900 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded bg-black text-amber-400 border border-zinc-700 font-black font-mono text-xs">
                              SERI #{idx + 1} — {pkg.serialNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCalcDetail(
                                  buildSerialFactoryCalcDetail({
                                    serialNumber: pkg.serialNumber,
                                    packagingType: pkg.packagingType,
                                    targetFactory: pkg.targetFactoryName,
                                    brutoKg: pkg.brutoWeightKg,
                                    realTobaccoNetKg: pkg.netWeightKg,
                                    realPackagingMassKg: pkg.packagingMassKg,
                                    factoryTaraPercent: pkg.taraPercent,
                                    factoryTaraFlatKg: pkg.taraFlatKg,
                                    factorySampleKg: pkg.sampleDeductionKg,
                                    factoryDeductionKg: pkgTaraDeductionKg,
                                    factoryBillableNetKg: pkgBillableNetKg,
                                    materialCostRp: Math.round(
                                      metrics.totalMaterialCost * weightRatio
                                    ),
                                    overheadCostRp: pkgOverhead,
                                    totalProductionCostRp: pkgProdCost,
                                    hppPerNetKg:
                                      pkg.netWeightKg > 0
                                        ? Math.round(pkgProdCost / pkg.netWeightKg)
                                        : metrics.hppPerNetKg,
                                    factoryPricePerKg: Number(pkg.targetPricePerKg) || 0,
                                    focus: 'FACTORY_WEIGHT',
                                  })
                                )
                              }
                              className={`group inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] font-bold border cursor-pointer transition-colors ${
                                pkgFactoryWeightProfitKg >= 0
                                  ? 'bg-zinc-950 text-white border-zinc-800 hover:border-zinc-700'
                                  : 'bg-zinc-950 text-red-400 border-red-500/60 hover:border-red-400'
                              }`}
                            >
                              <span>
                                Timbangan Pabrik:{' '}
                                {pkgFactoryWeightProfitKg >= 0 ? '+' : ''}
                                {pkgFactoryWeightProfitKg} kg ({pkgFactoryWeightProfitRp >= 0 ? '+' : ''}
                                {formatRupiah(pkgFactoryWeightProfitRp)})
                              </span>
                              <CalcSymbolBadge />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCalcDetail(
                                buildSerialFactoryCalcDetail({
                                  serialNumber: pkg.serialNumber,
                                  packagingType: pkg.packagingType,
                                  targetFactory: pkg.targetFactoryName,
                                  brutoKg: pkg.brutoWeightKg,
                                  realTobaccoNetKg: pkg.netWeightKg,
                                  realPackagingMassKg: pkg.packagingMassKg,
                                  factoryTaraPercent: pkg.taraPercent,
                                  factoryTaraFlatKg: pkg.taraFlatKg,
                                  factorySampleKg: pkg.sampleDeductionKg,
                                  factoryDeductionKg: pkgTaraDeductionKg,
                                  factoryBillableNetKg: pkgBillableNetKg,
                                  materialCostRp: Math.round(
                                    metrics.totalMaterialCost * weightRatio
                                  ),
                                  overheadCostRp: pkgOverhead,
                                  totalProductionCostRp: pkgProdCost,
                                  hppPerNetKg:
                                    pkg.netWeightKg > 0
                                      ? Math.round(pkgProdCost / pkg.netWeightKg)
                                      : metrics.hppPerNetKg,
                                  factoryPricePerKg: Number(pkg.targetPricePerKg) || 0,
                                  focus: 'FACTORY_PROFIT',
                                })
                              )
                            }
                            className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 hover:border-zinc-800 font-mono text-zinc-400 text-xs cursor-pointer transition-colors"
                          >
                            <span>
                              Modal: <b className="text-white">{formatRupiah(pkgProdCost)}</b> • Tagih:{' '}
                              <b className="text-white">{pkgBillableNetKg} kg</b>
                            </span>
                            <CalcSymbolBadge />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] font-bold text-zinc-200 whitespace-nowrap truncate mb-1">
                              Nomor Seri *
                            </label>
                            <input
                              type="text"
                              required
                              value={pkg.serialNumber}
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, { serialNumber: e.target.value })
                              }
                              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="sm:col-span-2 flex flex-col">
                            <label className="h-4 flex items-center text-[10px] font-bold text-white whitespace-nowrap truncate mb-1">
                              Jenis Kemasan
                            </label>
                            <select
                              value={pkg.packagingId}
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, { packagingId: e.target.value })
                              }
                              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-bold text-xs focus:outline-hidden"
                            >
                              {packagingList.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] font-bold text-white whitespace-nowrap truncate mb-1">
                              Grade
                            </label>
                            <select
                              value={pkg.grade || metrics.compositeColorGrade}
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, {
                                  grade: e.target.value as TobaccoGrade,
                                })
                              }
                              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-black text-xs focus:outline-hidden"
                            >
                              {(Object.keys(GRADE_LABELS) as TobaccoGrade[]).map((g) => (
                                <option key={g} value={g}>
                                  Grade {g}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] font-bold text-white whitespace-nowrap truncate mb-1">
                              Harga Kemasan
                            </label>
                            <NumericInput
                              value={pkg.packagingCostRp}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { packagingCostRp: val })
                              }
                              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] font-bold text-zinc-200 whitespace-nowrap truncate mb-1">
                              Ongkos Press
                            </label>
                            <NumericInput
                              value={pkg.pressCostRp}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { pressCostRp: val })
                              }
                              className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono text-xs focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 border-t border-zinc-900">
                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-400 whitespace-nowrap truncate mb-1">
                              Netto Isi (kg)
                            </label>
                            <NumericInput
                              value={pkg.netWeightKg}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { netWeightKg: val })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-200 font-bold whitespace-nowrap truncate mb-1">
                              Wadah Riil (kg)
                            </label>
                            <NumericInput
                              value={pkg.packagingMassKg}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { packagingMassKg: val })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-400 whitespace-nowrap truncate mb-1">
                              Bruto (kg)
                            </label>
                            <NumericInput
                              value={pkg.brutoWeightKg}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { brutoWeightKg: val })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-200 whitespace-nowrap truncate mb-1">
                              Tarra Flat (kg)
                            </label>
                            <NumericInput
                              value={pkg.taraFlatKg}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { taraFlatKg: val })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-200 whitespace-nowrap truncate mb-1">
                              Tarra (%)
                            </label>
                            <NumericInput
                              value={pkg.taraPercent}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { taraPercent: val })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-400 whitespace-nowrap truncate mb-1">
                              Pabrik Tujuan
                            </label>
                            <select
                              value={pkg.targetFactoryId}
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, { targetFactoryId: e.target.value })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-xs focus:outline-hidden"
                            >
                              {factoryList.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] text-zinc-400 whitespace-nowrap truncate mb-1">
                              Gulungan
                            </label>
                            <select
                              value={
                                rollSamples.some((r) => !r.isSentToFactory && r.id === pkg.rollId)
                                  ? pkg.rollId
                                  : 'NEW_AUTO_ROLL'
                              }
                              onChange={(e) =>
                                handleUpdatePackageItem(idx, { rollId: e.target.value })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-bold text-xs focus:outline-hidden"
                            >
                              <option value="NEW_AUTO_ROLL">
                                + Buat Gulungan Baru Otomatis
                              </option>
                              {rollSamples
                                .filter((r) => !r.isSentToFactory)
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.rollNumber} — {r.recipeName}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="flex flex-col">
                            <label className="h-4 flex items-center text-[10px] font-bold text-zinc-200 whitespace-nowrap truncate mb-1">
                              Harga Pabrik/KG
                            </label>
                            <NumericInput
                              value={pkg.targetPricePerKg}
                              onChange={(val) =>
                                handleUpdatePackageItem(idx, { targetPricePerKg: val })
                              }
                              className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs focus:outline-hidden"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(false)}
                    className="min-h-9 px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-xs cursor-pointer"
                  >
                    Tutup Draft
                  </button>
                  <button
                    type="submit"
                    className="btn-amber-outline min-h-9 px-4 py-1.5 rounded-xl font-black text-xs cursor-pointer"
                  >
                    Terbitkan {draft.packages.length} Seri
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />

      <AutoRacikModal
        isOpen={isAutoRacikOpen}
        onClose={() => setIsAutoRacikOpen(false)}
        rawTobaccos={rawTobaccos}
        onApplyAutoBlend={(recommendedIngs, summaryNote) => {
          if (ingredients.length > 0) {
            setUndoBlendSnapshot({
              label: 'Komposisi sebelumnya diganti oleh Auto-Racik',
              previousIngredients: [...ingredients],
            });
          }
          setIngredients(recommendedIngs);
          setAutoRacikBannerMsg(summaryNote);
        }}
      />
    </div>
  );
};

