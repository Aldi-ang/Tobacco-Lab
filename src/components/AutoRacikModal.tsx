import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wand2,
  X,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  MapPin,
  Layers,
  Sparkles,
  Scale,
  TrendingUp,
  RotateCcw,
  Check,
  Info,
} from 'lucide-react';
import {
  RawTobacco,
  BlendIngredient,
  TobaccoGrade,
} from '../types/tobacco';
import {
  TOBACCO_GRADE_ORDER,
  getAllowedGradesForTarget,
  extractUniqueOrigins,
  solveAutoBlend,
  AutoBlendSensoryTargets,
  AutoBlendParameterDiagnostic,
  formatRupiah,
} from '../utils/tobaccoMath';

interface AutoRacikModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawTobaccos: RawTobacco[];
  defaultTargetFactory?: string;
  onApplyAutoBlend: (
    ingredients: BlendIngredient[],
    targetGrade: TobaccoGrade,
    summaryTitle: string
  ) => void;
}

const SENSORY_FIELDS: Array<{
  key: keyof AutoBlendSensoryTargets;
  label: string;
  shortDesc: string;
}> = [
  { key: 'power', label: 'Power', shortDesc: 'Tarikan' },
  { key: 'impact', label: 'Impact', shortDesc: 'Kenyang' },
  { key: 'bitter', label: 'Bitter', shortDesc: 'Pahit' },
  { key: 'burn', label: 'Burn', shortDesc: 'Api' },
  { key: 'sugar', label: 'Sugar', shortDesc: 'Manis' },
  { key: 'aroma', label: 'Aroma', shortDesc: 'Harum' },
];

export const AutoRacikModal: React.FC<AutoRacikModalProps> = ({
  isOpen,
  onClose,
  rawTobaccos,
  onApplyAutoBlend,
}) => {
  const availableTobaccos = useMemo(
    () => rawTobaccos.filter((t) => (t.currentStockNetKg || 0) > 0),
    [rawTobaccos]
  );

  const allUniqueOrigins = useMemo(
    () => extractUniqueOrigins(availableTobaccos),
    [availableTobaccos]
  );

  // 1. Stock Scope ('ALL' vs 'SELECTED')
  const [stockMode, setStockMode] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedTobaccoIds, setSelectedTobaccoIds] = useState<string[]>(() =>
    availableTobaccos.map((t) => t.id)
  );

  // 2. Grade Target & Automatic Grade Window (-1 level below to +2 levels above)
  const [targetGrade, setTargetGrade] = useState<TobaccoGrade>('D');
  const [strictCrossGradeOnly, setStrictCrossGradeOnly] = useState<boolean>(false);
  const [allowedGrades, setAllowedGrades] = useState<TobaccoGrade[]>(() =>
    getAllowedGradesForTarget('D', { includeTargetFamily: true, includeTopPlus: false })
  );

  // 3. Sensory Character Expectations (0.0 - 5.0 scale, initialized from actual stock pool)
  const [targetSensory, setTargetSensory] = useState<AutoBlendSensoryTargets>(() => {
    if (availableTobaccos.length === 0) {
      return {
        power: 4.1,
        impact: 4.0,
        bitter: 2.5,
        burn: 4.5,
        sugar: 4.0,
        aroma: 4.2,
      };
    }
    const avg = (fn: (t: RawTobacco) => number) =>
      Number((availableTobaccos.reduce((s, t) => s + fn(t), 0) / availableTobaccos.length).toFixed(1));
    return {
      power: avg((t) => Number(t.powerRating ?? 0)),
      impact: avg((t) => Number(t.impactRating ?? 0)),
      bitter: avg((t) => Number(t.bitterRating ?? 0)),
      burn: avg((t) => Number(t.burnRating ?? 0)),
      sugar: avg((t) => Number(t.sugarRating ?? 0)),
      aroma: avg((t) => Number(t.aromaRating ?? 0)),
    };
  });

  // 4. Daerah Asal & Target Price (HPP/kg) + Total Blend Weight (kg)
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
  const [targetPricePerKg, setTargetPricePerKg] = useState<number>(() => {
    if (availableTobaccos.length === 0) return 78000;
    return (
      Math.round(
        availableTobaccos.reduce((s, t) => s + t.realCostPerNetKg, 0) /
          availableTobaccos.length /
          500
      ) * 500
    );
  });
  const [targetTotalKg, setTargetTotalKg] = useState<number>(100);
  const [respectStockCap, setRespectStockCap] = useState<boolean>(true);
  const [prioritizeWeightProfit, setPrioritizeWeightProfit] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setSelectedTobaccoIds((prev) => {
        const validIds = availableTobaccos.map((t) => t.id);
        const filtered = prev.filter((id) => validIds.includes(id));
        return filtered.length > 0 ? filtered : validIds;
      });
    }
  }, [isOpen, availableTobaccos]);

  const handleSelectTargetGrade = (grade: TobaccoGrade, strictCross = strictCrossGradeOnly) => {
    setTargetGrade(grade);
    const autoGrades = getAllowedGradesForTarget(grade, {
      includeTargetFamily: !strictCross,
      includeTopPlus: false,
    });
    setAllowedGrades(autoGrades);
  };

  const toggleAllowedGrade = (grade: TobaccoGrade) => {
    setAllowedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  const toggleOrigin = (origin: string) => {
    setAllowedOrigins((prev) =>
      prev.includes(origin) ? prev.filter((o) => o !== origin) : [...prev, origin]
    );
  };

  const toggleSelectedTobacco = (id: string) => {
    setSelectedTobaccoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const result = useMemo(
    () =>
      solveAutoBlend({
        rawTobaccos: availableTobaccos,
        stockMode,
        selectedTobaccoIds,
        targetGrade,
        allowedGrades,
        targetSensory,
        allowedOrigins,
        targetPricePerKg,
        targetTotalKg,
        respectStockCap,
        prioritizeWeightProfit,
      }),
    [
      availableTobaccos,
      stockMode,
      selectedTobaccoIds,
      targetGrade,
      allowedGrades,
      targetSensory,
      allowedOrigins,
      targetPricePerKg,
      targetTotalKg,
      respectStockCap,
      prioritizeWeightProfit,
    ]
  );

  const handleSetPoolAverageTargets = () => {
    if (result.candidatePool.length === 0) return;
    const pool = result.candidatePool;
    const avg = (fn: (t: RawTobacco) => number) =>
      Number((pool.reduce((s, t) => s + fn(t), 0) / pool.length).toFixed(1));

    setTargetSensory({
      power: avg((t) => Number(t.powerRating ?? 0)),
      impact: avg((t) => Number(t.impactRating ?? 0)),
      bitter: avg((t) => Number(t.bitterRating ?? 0)),
      burn: avg((t) => Number(t.burnRating ?? 0)),
      sugar: avg((t) => Number(t.sugarRating ?? 0)),
      aroma: avg((t) => Number(t.aromaRating ?? 0)),
    });
    const avgPrice = Math.round(
      pool.reduce((s, t) => s + t.realCostPerNetKg, 0) / pool.length / 500
    ) * 500;
    setTargetPricePerKg(avgPrice);
  };

  // Snap any out-of-bounds target directly to its nearest stock bound [minInPool, maxInPool]
  const handleSnapOutOfBoundsToStock = () => {
    const nextSensory = { ...targetSensory };
    for (const f of SENSORY_FIELDS) {
      const diag = result.parameterDiagnostics.find((d) => d.key === f.key);
      if (!diag) continue;
      if (diag.status === 'IMPOSSIBLE_TOO_LOW') {
        nextSensory[f.key] = diag.minInPool;
      } else if (diag.status === 'IMPOSSIBLE_TOO_HIGH') {
        nextSensory[f.key] = diag.maxInPool;
      }
    }
    setTargetSensory(nextSensory);

    const priceDiag = result.parameterDiagnostics.find((d) => d.key === 'price');
    if (priceDiag && priceDiag.status === 'IMPOSSIBLE_TOO_LOW') {
      setTargetPricePerKg(priceDiag.minInPool);
    }
  };

  const sensoryDiagnostics = result.parameterDiagnostics.filter((d) => d.key !== 'price');
  const optimalCount = sensoryDiagnostics.filter((d) => d.status === 'OPTIMAL').length;
  const outOfBoundsCount = result.parameterDiagnostics.filter(
    (d) => d.status === 'IMPOSSIBLE_TOO_LOW' || d.status === 'IMPOSSIBLE_TOO_HIGH'
  ).length;
  const priceDiag = result.parameterDiagnostics.find((d) => d.key === 'price');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-start justify-center overflow-y-auto p-2 sm:p-4 md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl bg-[#070709] border-2 border-amber-500/70 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden my-2 sm:my-4"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-xl px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    Auto-Racik Presisi (4 Parameter & Visual Zona Stok)
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 text-[10px] font-extrabold uppercase">
                    Indikator Kejujuran Aktif
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Bar hijau/kuning di tiap karakter menunjukkan langsung batas stok riil [Min–Maks] tanpa rekayasa angka
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup</span>
            </button>
          </div>

          <div className="p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* LEFT COLUMN: 4 SETTINGS */}
            <div className="lg:col-span-7 space-y-3.5">
              {/* SETTING 1: PILIHAN STOK TEMBAKAU */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-500 text-black font-black text-[11px] flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      Sumber Stok yang Diracak
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setStockMode('ALL')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold cursor-pointer transition-colors ${
                        stockMode === 'ALL'
                          ? 'bg-amber-500 text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Semua Stok ({availableTobaccos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockMode('SELECTED')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold cursor-pointer transition-colors ${
                        stockMode === 'SELECTED'
                          ? 'bg-amber-500 text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Pilih Manual ({selectedTobaccoIds.length})
                    </button>
                  </div>
                </div>

                {stockMode === 'SELECTED' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>Centang stok yang boleh dipakai Auto-Racik:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTobaccoIds(availableTobaccos.map((t) => t.id))}
                          className="text-amber-400 hover:underline font-bold cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTobaccoIds([])}
                          className="text-zinc-400 hover:text-white font-bold cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                      {availableTobaccos.map((t) => {
                        const checked = selectedTobaccoIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleSelectedTobacco(t.id)}
                            className={`text-left p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              checked
                                ? 'bg-amber-500/15 border-amber-500/60 text-white'
                                : 'bg-black/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-extrabold truncate">{t.name}</div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {t.origin} • Sisa {t.currentStockNetKg} kg •{' '}
                                {formatRupiah(t.realCostPerNetKg)}
                              </div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] font-mono font-bold text-amber-300 shrink-0">
                              {t.colorGrade}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SETTING 2: TARGET GRADE & RENTANG SORTIR OTOMATIS (-1 s/d +2 LEVEL) */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-500 text-black font-black text-[11px] flex items-center justify-center">
                      2
                    </span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white">
                        Target Grade & Sortir (-1 Level Bawah s/d +2 Level Atas)
                      </h3>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={strictCrossGradeOnly}
                      onChange={(e) => {
                        const nextStrict = e.target.checked;
                        setStrictCrossGradeOnly(nextStrict);
                        handleSelectTargetGrade(targetGrade, nextStrict);
                      }}
                      className="accent-amber-500"
                    />
                    <span>Silang Murni (Tanpa Grade {targetGrade.replace('+', '')})</span>
                  </label>
                </div>

                {/* Target Grade Selector */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 mr-1">
                    Target:
                  </span>
                  {TOBACCO_GRADE_ORDER.map((g) => {
                    const active = targetGrade === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleSelectTargetGrade(g, strictCrossGradeOnly)}
                        className={`h-7 min-w-8 px-2 rounded-lg text-[11px] font-mono font-black border cursor-pointer transition-all ${
                          active
                            ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                            : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>

                {/* Auto-Selected Allowed Grades Window */}
                <div className="bg-black/70 border border-zinc-800/90 rounded-lg p-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase text-emerald-400 mr-1">
                      Stok Grade Aktif:
                    </span>
                    {TOBACCO_GRADE_ORDER.map((g) => {
                      const isIncluded = allowedGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleAllowedGrade(g)}
                          className={`h-6 px-1.5 rounded text-[10px] font-mono font-extrabold border cursor-pointer transition-colors ${
                            isIncluded
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                              : 'bg-zinc-950 text-zinc-600 border-zinc-900 hover:text-zinc-400'
                          }`}
                        >
                          {g}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTargetGrade(targetGrade, strictCrossGradeOnly)}
                    className="text-[10px] text-amber-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* SETTING 3: COMPACT VISUAL PSYCHOLOGICAL GAUGES FOR TOBACCO ATTRIBUTES */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-500 text-black font-black text-[11px] flex items-center justify-center">
                      3
                    </span>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white">
                        Atribut Tembakau (Tobacco Attributes)
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {outOfBoundsCount > 0 && (
                      <button
                        type="button"
                        onClick={handleSnapOutOfBoundsToStock}
                        className="h-6 px-2 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Pasang ke Batas Stok ({outOfBoundsCount})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSetPoolAverageTargets}
                      className="h-6 px-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Rata-rata Stok</span>
                    </button>
                  </div>
                </div>

                {/* Legend for Visual Psychological Bar */}
                <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/60 border border-zinc-800/80 text-[10px] text-zinc-400">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-2 rounded-xs bg-emerald-500/40 border border-emerald-400 inline-block" />
                      <span>Zona Stok [Min–Maks]</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-white border border-amber-500 inline-block" />
                      <span>Target Anda</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      <span>Hasil Racikan</span>
                    </span>
                  </div>
                  <span className="font-mono text-zinc-500 hidden sm:inline">Skala 0.0 – 5.0</span>
                </div>

                {/* Compact 2-Column Grid of 6 Sensory Attributes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SENSORY_FIELDS.map((field) => {
                    const val = targetSensory[field.key];
                    const diag: AutoBlendParameterDiagnostic | undefined =
                      result.parameterDiagnostics.find((d) => d.key === field.key);

                    const minPool = diag ? diag.minInPool : 0.0;
                    const maxPool = diag ? diag.maxInPool : 5.0;
                    const achieved = diag ? diag.achievedValue : val;

                    // Convert 0.0..5.0 to 0%..100% for the psychological bar
                    const toPct = (v: number) =>
                      Math.max(0, Math.min(100, (v / 5) * 100));
                    const zoneLeftPct = toPct(minPool);
                    const zoneWidthPct = Math.max(2, toPct(maxPool) - zoneLeftPct);
                    const targetPct = toPct(val);
                    const achievedPct = toPct(achieved);

                    const isTooLow = diag?.status === 'IMPOSSIBLE_TOO_LOW';
                    const isTooHigh = diag?.status === 'IMPOSSIBLE_TOO_HIGH';
                    const isTradeoff = diag?.status === 'CLOSE_TRADEOFF';
                    const isOptimal = diag?.status === 'OPTIMAL';

                    return (
                      <div
                        key={field.key}
                        className={`px-2.5 py-2 rounded-xl border transition-colors ${
                          isTooLow || isTooHigh
                            ? 'bg-red-950/20 border-red-500/60'
                            : isTradeoff
                            ? 'bg-amber-950/15 border-amber-500/50'
                            : 'bg-black/75 border-zinc-800/90'
                        }`}
                      >
                        {/* Row 1: Attribute Title + Target Input + Achieved Value */}
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-black text-white truncate">
                              {field.label}
                            </span>
                            <span className="text-[10px] text-zinc-500 hidden xl:inline">
                              ({field.shortDesc})
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 font-mono">
                            <span className="text-[10px] text-zinc-400">Target</span>
                            <input
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              value={val}
                              onChange={(e) => {
                                const parsed = parseFloat(e.target.value);
                                const num = Number.isNaN(parsed)
                                  ? 0
                                  : Math.max(0, Math.min(5, parsed));
                                setTargetSensory((prev) => ({
                                  ...prev,
                                  [field.key]: num,
                                }));
                              }}
                              className="w-12 h-6 px-1 rounded bg-zinc-900 border border-zinc-700 text-right text-[11px] font-black text-amber-400 focus:outline-none focus:border-amber-400"
                            />
                            <span
                              className={`px-1.5 h-6 rounded inline-flex items-center text-[11px] font-black border ${
                                isOptimal
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : isTooLow || isTooHigh
                                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                                  : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                              }`}
                              title="Hasil rata-rata racikan"
                            >
                              → {achieved.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Visual Psychological Range Track (Zona Stok + Target Thumb + Hasil Dot) */}
                        <div className="relative h-5 flex items-center select-none">
                          {/* Full 0.0 - 5.0 Track */}
                          <div className="w-full h-2 rounded-full bg-zinc-900 border border-zinc-800 relative overflow-hidden">
                            {/* Shaded Stock Availability Zone [minPool, maxPool] */}
                            {diag && (
                              <div
                                style={{
                                  left: `${zoneLeftPct}%`,
                                  width: `${zoneWidthPct}%`,
                                }}
                                className={`absolute top-0 bottom-0 border-x ${
                                  isTooLow || isTooHigh
                                    ? 'bg-amber-500/35 border-amber-400'
                                    : 'bg-emerald-500/35 border-emerald-400'
                                }`}
                              />
                            )}
                          </div>

                          {/* Achieved Value Glowing Marker */}
                          {diag && (
                            <div
                              style={{ left: `calc(${achievedPct}% - 5px)` }}
                              className="pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] border border-black z-10"
                              title={`Hasil: ${achieved}`}
                            />
                          )}

                          {/* User Target Marker Pin */}
                          <div
                            style={{ left: `calc(${targetPct}% - 6px)` }}
                            className={`pointer-events-none absolute w-3 h-3.5 rounded-xs border-2 z-20 ${
                              isTooLow || isTooHigh
                                ? 'bg-red-500 border-white shadow-[0_0_8px_rgba(239,68,68,0.9)]'
                                : 'bg-amber-400 border-black shadow-sm'
                            }`}
                          />

                          {/* Native Interactive Range Input Overlaid (0.0 to 5.0) */}
                          <input
                            type="range"
                            min={0}
                            max={5}
                            step={0.1}
                            value={val}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              setTargetSensory((prev) => ({
                                ...prev,
                                [field.key]: Number.isNaN(parsed) ? 0 : parsed,
                              }));
                            }}
                            aria-label={field.label}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                          />
                        </div>

                        {/* Row 3: Compact 1-Line Reasoning & Quick-Fix Chip Directly Under Parameter */}
                        {diag && (
                          <div className="mt-1 flex items-center justify-between gap-1 text-[10px] leading-tight">
                            {isTooLow ? (
                              <>
                                <span className="text-red-300 font-bold truncate">
                                  ↓ Mentok bawah (Stok {minPool}–{maxPool})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTargetSensory((prev) => ({
                                      ...prev,
                                      [field.key]: minPool,
                                    }))
                                  }
                                  className="px-1.5 py-0.5 rounded bg-red-500/25 hover:bg-red-500/40 border border-red-400/50 text-red-200 font-mono font-black shrink-0 cursor-pointer"
                                >
                                  Set {minPool}
                                </button>
                              </>
                            ) : isTooHigh ? (
                              <>
                                <span className="text-red-300 font-bold truncate">
                                  ↑ Mentok atas (Stok {minPool}–{maxPool})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTargetSensory((prev) => ({
                                      ...prev,
                                      [field.key]: maxPool,
                                    }))
                                  }
                                  className="px-1.5 py-0.5 rounded bg-red-500/25 hover:bg-red-500/40 border border-red-400/50 text-red-200 font-mono font-black shrink-0 cursor-pointer"
                                >
                                  Set {maxPool}
                                </button>
                              </>
                            ) : isTradeoff ? (
                              <>
                                <span className="text-amber-300 font-bold truncate">
                                  ⚖ Kompromi di {achieved} (Stok {minPool}–{maxPool})
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTargetSensory((prev) => ({
                                      ...prev,
                                      [field.key]: achieved,
                                    }))
                                  }
                                  className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 font-mono font-bold shrink-0 cursor-pointer"
                                >
                                  Ikuti {achieved}
                                </button>
                              </>
                            ) : (
                              <span className="text-zinc-400 truncate">
                                <b className="text-emerald-400">✓ Pas</b> • Zona stok {minPool}–{maxPool}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SETTING 4: DAERAH ASAL & TARGET HARGA MODAL (HPP/KG) */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-amber-500 text-black font-black text-[11px] flex items-center justify-center">
                    4
                  </span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Filter Daerah Asal & Target Harga Modal (HPP/KG)
                  </h3>
                </div>

                {/* Origin Multi-Select Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 flex items-center gap-1 mr-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span>Daerah:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAllowedOrigins([])}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border cursor-pointer transition-colors ${
                      allowedOrigins.length === 0
                        ? 'bg-amber-500 text-black border-amber-300'
                        : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    Semua ({allUniqueOrigins.length})
                  </button>
                  {allUniqueOrigins.map((origin) => {
                    const selected = allowedOrigins.includes(origin);
                    return (
                      <button
                        key={origin}
                        type="button"
                        onClick={() => toggleOrigin(origin)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border cursor-pointer transition-colors ${
                          selected
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                            : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {origin}
                      </button>
                    );
                  })}
                </div>

                {/* Price & Weight Inputs with Compact Inline Diagnostic Under Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      priceDiag?.status === 'IMPOSSIBLE_TOO_LOW'
                        ? 'bg-red-950/20 border-red-500/60'
                        : priceDiag?.status === 'CLOSE_TRADEOFF'
                        ? 'bg-amber-950/15 border-amber-500/50'
                        : 'bg-black/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400">
                        Target HPP / KG (Rp)
                      </label>
                      {priceDiag && (
                        <span className="text-[10px] font-mono font-bold text-emerald-300">
                          Hasil: {formatRupiah(priceDiag.achievedValue)}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={targetPricePerKg}
                      onChange={(e) => setTargetPricePerKg(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono font-black text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                    {priceDiag && (
                      <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px]">
                        <span
                          className={`truncate font-bold ${
                            priceDiag.status === 'IMPOSSIBLE_TOO_LOW'
                              ? 'text-red-300'
                              : priceDiag.status === 'CLOSE_TRADEOFF'
                              ? 'text-amber-300'
                              : 'text-zinc-400'
                          }`}
                        >
                          {priceDiag.status === 'IMPOSSIBLE_TOO_LOW'
                            ? `↓ Stok termurah ${formatRupiah(priceDiag.minInPool)}`
                            : priceDiag.status === 'CLOSE_TRADEOFF'
                            ? `⚖ Kompromi rasa (${formatRupiah(priceDiag.achievedValue)})`
                            : `✓ Zona ${formatRupiah(priceDiag.minInPool)}–${formatRupiah(priceDiag.maxInPool)}`}
                        </span>
                        {priceDiag.status === 'IMPOSSIBLE_TOO_LOW' && (
                          <button
                            type="button"
                            onClick={() => setTargetPricePerKg(priceDiag.minInPool)}
                            className="px-1.5 py-0.5 rounded bg-red-500/25 border border-red-400/50 text-red-200 font-mono font-black shrink-0 cursor-pointer"
                          >
                            Set Min
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-black/70 border border-zinc-800">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label className="text-[10px] font-bold uppercase text-zinc-400">
                        Target Total Berat (KG)
                      </label>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Maks: <b className="text-white">{result.maxAvailablePoolKg} kg</b>
                      </span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      step={5}
                      value={targetTotalKg}
                      onChange={(e) => setTargetTotalKg(Math.max(1, Number(e.target.value) || 100))}
                      className="w-full h-8 px-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono font-black text-white focus:outline-none focus:border-amber-500"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-zinc-400">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={respectStockCap}
                          onChange={(e) => setRespectStockCap(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>Batasi Sisa Stok</span>
                      </label>
                      <label
                        title="Jika dicentang, saat ada dua stok tembakau dengan rasa & grade mirip, sistem memprioritaskan stok yang memberi keuntungan selisih timbangan beli (Weight Profit) tertinggi."
                        className="inline-flex items-center gap-1 cursor-pointer text-emerald-300"
                      >
                        <input
                          type="checkbox"
                          checked={prioritizeWeightProfit}
                          onChange={(e) => setPrioritizeWeightProfit(e.target.checked)}
                          className="accent-emerald-500"
                        />
                        <span>+Weight Profit</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: COMPACT STATUS & RECOMMENDED BLEND */}
            <div className="lg:col-span-5 space-y-3.5 lg:sticky lg:top-16">
              {/* Compact Kejujuran Scorecard Banner */}
              <div
                className={`rounded-xl p-3 border transition-colors ${
                  result.isPoolEmpty
                    ? 'bg-red-950/30 border-red-500/80'
                    : result.hasOutOfBoundsTarget
                    ? 'bg-red-950/25 border-red-500/70'
                    : result.hasCoupledTradeoff
                    ? 'bg-amber-950/25 border-amber-500/70'
                    : 'bg-emerald-950/25 border-emerald-500/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {result.isFullyFeasible ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${
                          result.hasOutOfBoundsTarget ? 'text-red-400' : 'text-amber-400'
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase tracking-wider text-white truncate">
                        {result.isPoolEmpty
                          ? 'Stok Kosong di Filter Ini'
                          : result.isFullyFeasible
                          ? `Kejujuran: ${optimalCount}/6 Karakter Pas`
                          : result.hasOutOfBoundsTarget
                          ? `${outOfBoundsCount} Target di Luar Batas Stok`
                          : `Kompromi Terbaik (${optimalCount}/6 Pas)`}
                      </div>
                      <p className="text-[11px] text-zinc-300 truncate">{result.summaryMessage}</p>
                    </div>
                  </div>

                  {outOfBoundsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleSnapOutOfBoundsToStock}
                      className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black shrink-0 cursor-pointer shadow-sm"
                    >
                      Ikuti Stok
                    </button>
                  )}
                </div>
              </div>

              {/* Result Metrics & Ingredients */}
              {!result.isPoolEmpty && (
                <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Hasil Komposisi Terdekat</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {result.candidatePool.length} kandidat disortir
                    </span>
                  </div>

                  {/* 3 Key Summary Boxes */}
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div className="bg-black/80 border border-zinc-800 rounded-lg p-2">
                      <span className="text-[9px] text-zinc-400 block uppercase">Grade Hasil</span>
                      <span className="text-sm font-black text-amber-400">
                        {result.achievedMetrics.compositeColorGrade}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        Target: {targetGrade}
                      </span>
                    </div>
                    <div className="bg-black/80 border border-zinc-800 rounded-lg p-2">
                      <span className="text-[9px] text-zinc-400 block uppercase">HPP / KG</span>
                      <span className="text-xs font-black text-emerald-400">
                        {formatRupiah(result.achievedMetrics.hppPerNetKg)}
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        Target: {formatRupiah(targetPricePerKg)}
                      </span>
                    </div>
                    <div className="bg-black/80 border border-zinc-800 rounded-lg p-2">
                      <span className="text-[9px] text-zinc-400 block uppercase">Total Netto</span>
                      <span className="text-sm font-black text-white">
                        {result.achievedMetrics.totalBlendNetKg} kg
                      </span>
                      <span className="text-[9px] text-zinc-500 block">
                        {result.recommendedIngredients.length} bahan
                      </span>
                    </div>
                  </div>

                  {/* Compact Visual 6-Bar Summary */}
                  <div className="grid grid-cols-6 gap-1 text-center font-mono">
                    {SENSORY_FIELDS.map((f) => {
                      const diag = result.parameterDiagnostics.find((d) => d.key === f.key);
                      if (!diag) return null;
                      const isOk = diag.status === 'OPTIMAL';
                      const isOut = !diag.isWithinPoolBounds && !isOk;
                      return (
                        <div
                          key={f.key}
                          className={`p-1.5 rounded-lg border ${
                            isOk
                              ? 'bg-emerald-950/20 border-emerald-500/40'
                              : isOut
                              ? 'bg-red-950/25 border-red-500/50'
                              : 'bg-amber-950/20 border-amber-500/40'
                          }`}
                        >
                          <div className="text-[9px] font-sans font-bold text-zinc-400 truncate">
                            {f.label}
                          </div>
                          <div
                            className={`text-xs font-black ${
                              isOk
                                ? 'text-emerald-300'
                                : isOut
                                ? 'text-red-300'
                                : 'text-amber-300'
                            }`}
                          >
                            {diag.achievedValue}
                          </div>
                          <div className="text-[8px] text-zinc-500">T:{diag.targetValue}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recommended Ingredients List */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                      Rincian Takaran Bahan ({result.recommendedIngredients.length} Tembakau):
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {result.achievedMetrics.updatedIngredients.map((ing) => (
                        <div
                          key={ing.tobaccoId}
                          className="p-2 rounded-lg bg-black/80 border border-zinc-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-extrabold text-white truncate flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px]">
                                {ing.colorGrade}
                              </span>
                              <span className="truncate">{ing.tobaccoName}</span>
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {ing.origin} • {formatRupiah(ing.realCostPerNetKg)}/kg
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-black text-amber-400">
                              {ing.usedNetKg} kg ({ing.percentageInBlend}%)
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {formatRupiah(ing.subtotalCost)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {result.achievedMetrics.totalBuyWeightProfitRp > 0 && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Weight Profit Pembelian di Racikan Ini:</span>
                      </span>
                      <b className="font-mono text-emerald-400">
                        +{formatRupiah(result.achievedMetrics.totalBuyWeightProfitRp)}
                      </b>
                    </div>
                  )}

                  {/* Apply Button */}
                  <button
                    type="button"
                    disabled={result.recommendedIngredients.length === 0}
                    onClick={() => {
                      onApplyAutoBlend(
                        result.achievedMetrics.updatedIngredients,
                        targetGrade,
                        `Auto-Racik Grade ${targetGrade} (${result.achievedMetrics.totalBlendNetKg} kg)`
                      );
                      onClose();
                    }}
                    className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_25px_rgba(245,158,11,0.3)] disabled:opacity-40"
                  >
                    <Scale className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      Terapkan ke Meja Racikan ({result.achievedMetrics.totalBlendNetKg} KG)
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
