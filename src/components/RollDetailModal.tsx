import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  Layers,
  Save,
  Calendar,
  Sliders,
  Lock,
  UserCheck,
} from 'lucide-react';
import {
  TobaccoRollSample,
  FinishedTobaccoSerial,
  TobaccoGrade,
  RawTobacco,
} from '../types/tobacco';
import { GRADE_LABELS, TOBACCO_GRADE_ORDER, formatRupiah, clampRating5 } from '../utils/tobaccoMath';

export interface GradeCompositionGroup {
  grade: TobaccoGrade;
  serialNumbers: string[];
  serialCount: number;
  totalGradeNetKg: number;
  pointLines: string[];
  avgCharacter: {
    power: number;
    impact: number;
    bitter: number;
    burn: number;
    sugar: number;
    aroma: number;
  };
  ingredients: {
    tobaccoId: string;
    tobaccoName: string;
    origin: string;
    sellerName?: string;
    colorGrade: TobaccoGrade;
    usedNetKg: number;
    percentageInGrade: number;
    realCostPerNetKg: number;
    powerRating: number;
    impactRating: number;
    bitterRating: number;
    burnRating: number;
    sugarRating: number;
    aromaRating: number;
  }[];
}

/**
 * Formats an ingredient into a clean, readable point label like:
 * "Muntilan Yohan" or "Temanggung H. Daryono"
 */
function formatCleanIngredientLabel(ing: {
  tobaccoName: string;
  origin: string;
  sellerName?: string;
}): string {
  // Extract concise town/origin name
  let cleanOrigin = (ing.origin || '').trim();
  if (/muntilan/i.test(cleanOrigin)) {
    cleanOrigin = 'Muntilan';
  } else if (/temanggung/i.test(cleanOrigin)) {
    cleanOrigin = 'Temanggung';
  } else if (/madura/i.test(cleanOrigin)) {
    cleanOrigin = 'Madura';
  } else if (/boyolali/i.test(cleanOrigin)) {
    cleanOrigin = 'Boyolali';
  } else {
    cleanOrigin = cleanOrigin.replace(/\s*\(.*?\)\s*/g, '').trim();
  }

  let cleanSeller = (ing.sellerName || '').trim();
  if (cleanSeller) {
    // Strip redundant origin word from sellerName if already in cleanOrigin
    if (cleanOrigin) {
      const originRegex = new RegExp(`\\b${cleanOrigin}\\b`, 'gi');
      cleanSeller = cleanSeller.replace(originRegex, '').replace(/\s+/g, ' ').trim();
    }
    cleanSeller = cleanSeller.replace(/\s*\(.*?\)\s*/g, '').trim();
  }

  if (cleanOrigin && cleanSeller) {
    return `${cleanOrigin} ${cleanSeller}`;
  }
  if (cleanOrigin) {
    const shortName = (ing.tobaccoName || '')
      .replace(/^Tembakau\s+/i, '')
      .replace(/\s*\(.*?\)\s*/g, '')
      .trim();
    if (shortName && shortName.toLowerCase() !== cleanOrigin.toLowerCase()) {
      return shortName;
    }
    return cleanOrigin;
  }
  return (ing.tobaccoName || 'Tembakau').replace(/\s*\(.*?\)\s*/g, '').trim();
}

interface RollCompositionPanelProps {
  roll: TobaccoRollSample;
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos?: RawTobacco[];
  onUpdateSmokingTest: (
    rollId: string,
    updatedTest: NonNullable<TobaccoRollSample['smokingTest']>
  ) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export const RollCompositionAndEvaluationPanel: React.FC<RollCompositionPanelProps> = ({
  roll,
  finishedBatches,
  rawTobaccos = [],
  onUpdateSmokingTest,
  onClose,
  isEmbedded = false,
}) => {
  const serialsInRoll = finishedBatches.filter(
    (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
  );

  // Build Per-Grade Composition Groups from the Serials in this Gulungan
  const gradeOrder: TobaccoGrade[] = TOBACCO_GRADE_ORDER;

  const buildGradeGroups = (): GradeCompositionGroup[] => {
    if (serialsInRoll.length === 0) {
      const fallbackGrade = roll.ratingsSnapshot?.colorGrade || 'D';
      const snapIngs = roll.ingredientsSnapshot || [];
      const totalKg = snapIngs.reduce((acc, i) => acc + (i.usedNetKg || 0), 0);
      const mappedIngs = snapIngs.map((ing) => {
        const rawMatch = rawTobaccos.find((r) => r.id === ing.tobaccoId);
        const pct =
          totalKg > 0
            ? Number(((ing.usedNetKg / totalKg) * 100).toFixed(1))
            : ing.percentageInBlend || 0;
        return {
          tobaccoId: ing.tobaccoId,
          tobaccoName: ing.tobaccoName,
          origin: ing.origin,
          sellerName: ing.sellerName || rawMatch?.sellerName,
          colorGrade: ing.colorGrade,
          usedNetKg: Number((ing.usedNetKg || 0).toFixed(1)),
          percentageInGrade: pct,
          realCostPerNetKg: ing.realCostPerNetKg,
          powerRating: clampRating5(ing.powerRating),
          impactRating: clampRating5(ing.impactRating),
          bitterRating: clampRating5(ing.bitterRating),
          burnRating: clampRating5(ing.burnRating ?? 4.5),
          sugarRating: clampRating5(ing.sugarRating ?? 4.0),
          aromaRating: clampRating5(ing.aromaRating ?? rawMatch?.aromaRating ?? 4.2),
        };
      });

      const pointLines =
        mappedIngs.length > 0
          ? mappedIngs.map(
              (i) =>
                `- ${formatCleanIngredientLabel(i)} ${i.percentageInGrade}% (${i.usedNetKg} KG) (${formatRupiah(i.realCostPerNetKg)})`
            )
          : ['- Belum ada komposisi daun'];

      return [
        {
          grade: fallbackGrade,
          serialNumbers: [],
          serialCount: 0,
          totalGradeNetKg: Number(totalKg.toFixed(1)),
          pointLines,
          avgCharacter: {
            power: clampRating5(roll.ratingsSnapshot?.power ?? 4.0),
            impact: clampRating5(roll.ratingsSnapshot?.impact ?? 4.0),
            bitter: clampRating5(roll.ratingsSnapshot?.bitter ?? 2.5),
            burn: clampRating5(roll.ratingsSnapshot?.burn ?? 4.5),
            sugar: clampRating5(roll.ratingsSnapshot?.sugar ?? 4.0),
            aroma: clampRating5(roll.ratingsSnapshot?.aroma ?? 4.2),
          },
          ingredients: mappedIngs,
        },
      ];
    }

    const byGrade = new Map<TobaccoGrade, FinishedTobaccoSerial[]>();
    for (const ser of serialsInRoll) {
      const g = (ser.compositeColorGrade || 'D') as TobaccoGrade;
      const existing = byGrade.get(g) || [];
      existing.push(ser);
      byGrade.set(g, existing);
    }

    const sortedGrades = Array.from(byGrade.keys()).sort(
      (a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b)
    );

    return sortedGrades.map((grade) => {
      const gSerials = byGrade.get(grade) || [];
      const ingMap = new Map<
        string,
        {
          tobaccoId: string;
          tobaccoName: string;
          origin: string;
          sellerName?: string;
          colorGrade: TobaccoGrade;
          usedNetKg: number;
          realCostPerNetKg: number;
          powerRating: number;
          impactRating: number;
          bitterRating: number;
          burnRating: number;
          sugarRating: number;
          aromaRating: number;
        }
      >();

      let gradeSerialWeightSum = 0;
      let pSum = 0;
      let iSum = 0;
      let bSum = 0;
      let brnSum = 0;
      let sgrSum = 0;
      let armSum = 0;

      for (const ser of gSerials) {
        const serNetKg =
          ser.packaging?.netTobaccoWeightKg ??
          ser.totalBlendNetKg ??
          Math.max(0, (ser.packaging?.grossWeightPerPackage || 0) - (ser.factoryDeductionKg || 0));
        const w = serNetKg > 0 ? serNetKg : 1;
        gradeSerialWeightSum += w;

        pSum += w * clampRating5(ser.weightedPower);
        iSum += w * clampRating5(ser.weightedImpact);
        bSum += w * clampRating5(ser.weightedBitter);
        brnSum += w * clampRating5(ser.weightedBurn ?? 4.5);
        sgrSum += w * clampRating5(ser.weightedSugar ?? 4.0);
        armSum += w * clampRating5(ser.weightedAroma ?? 4.2);

        const serIngs =
          ser.ingredients && ser.ingredients.length > 0
            ? ser.ingredients
            : roll.ingredientsSnapshot || [];

        for (const ing of serIngs) {
          const key = `${ing.tobaccoId || ing.tobaccoName}__${ing.origin}`;
          const rawMatch = rawTobaccos.find((r) => r.id === ing.tobaccoId);
          const existing = ingMap.get(key);
          const addKg = Number(ing.usedNetKg) || 0;
          if (existing) {
            existing.usedNetKg = Number((existing.usedNetKg + addKg).toFixed(2));
          } else {
            ingMap.set(key, {
              tobaccoId: ing.tobaccoId,
              tobaccoName: ing.tobaccoName,
              origin: ing.origin,
              sellerName: ing.sellerName || rawMatch?.sellerName,
              colorGrade: ing.colorGrade || grade,
              usedNetKg: Number(addKg.toFixed(2)),
              realCostPerNetKg: ing.realCostPerNetKg,
              powerRating: clampRating5(ing.powerRating),
              impactRating: clampRating5(ing.impactRating),
              bitterRating: clampRating5(ing.bitterRating),
              burnRating: clampRating5(ing.burnRating ?? 4.5),
              sugarRating: clampRating5(ing.sugarRating ?? 4.0),
              aromaRating: clampRating5(ing.aromaRating ?? rawMatch?.aromaRating ?? 4.2),
            });
          }
        }
      }

      const rawIngList = Array.from(ingMap.values());
      const totalIngKg = rawIngList.reduce((acc, item) => acc + item.usedNetKg, 0);
      const effectiveTotalKg = totalIngKg > 0 ? totalIngKg : gradeSerialWeightSum;

      const ingredients = rawIngList.map((item) => {
        const pct =
          totalIngKg > 0 ? Number(((item.usedNetKg / totalIngKg) * 100).toFixed(1)) : 0;
        return {
          ...item,
          usedNetKg: Number(item.usedNetKg.toFixed(1)),
          percentageInGrade: pct,
        };
      });

      const pointLines =
        ingredients.length > 0
          ? ingredients.map(
              (i) =>
                `- ${formatCleanIngredientLabel(i)} ${i.percentageInGrade}% (${i.usedNetKg} KG) (${formatRupiah(i.realCostPerNetKg)})`
            )
          : [`- ${gSerials.length} Seri (${Number(effectiveTotalKg.toFixed(1))} KG)`];

      const safeDiv = gradeSerialWeightSum > 0 ? gradeSerialWeightSum : 1;

      return {
        grade,
        serialNumbers: gSerials.map((s) => s.serialNumber),
        serialCount: gSerials.length,
        totalGradeNetKg: Number(effectiveTotalKg.toFixed(1)),
        pointLines,
        avgCharacter: {
          power: Number((pSum / safeDiv).toFixed(1)),
          impact: Number((iSum / safeDiv).toFixed(1)),
          bitter: Number((bSum / safeDiv).toFixed(1)),
          burn: Number((brnSum / safeDiv).toFixed(1)),
          sugar: Number((sgrSum / safeDiv).toFixed(1)),
          aroma: Number((armSum / safeDiv).toFixed(1)),
        },
        ingredients,
      };
    });
  };

  const gradeGroups = buildGradeGroups();
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');

  // Overall Gulungan Weighted Average Character across all Serials in this Gulungan (Fixed & Uneditable)
  const overallAvg = (() => {
    if (serialsInRoll.length === 0) {
      return {
        power: clampRating5(roll.ratingsSnapshot?.power ?? 4.0),
        impact: clampRating5(roll.ratingsSnapshot?.impact ?? 4.0),
        bitter: clampRating5(roll.ratingsSnapshot?.bitter ?? 2.5),
        burn: clampRating5(roll.ratingsSnapshot?.burn ?? 4.5),
        sugar: clampRating5(roll.ratingsSnapshot?.sugar ?? 4.0),
        aroma: clampRating5(roll.ratingsSnapshot?.aroma ?? 4.2),
      };
    }
    let totalW = 0;
    let p = 0;
    let im = 0;
    let bi = 0;
    let br = 0;
    let su = 0;
    let ar = 0;
    for (const s of serialsInRoll) {
      const w =
        s.packaging?.netTobaccoWeightKg ??
        s.totalBlendNetKg ??
        Math.max(1, (s.packaging?.grossWeightPerPackage || 0) - (s.factoryDeductionKg || 0));
      totalW += w;
      p += w * clampRating5(s.weightedPower);
      im += w * clampRating5(s.weightedImpact);
      bi += w * clampRating5(s.weightedBitter);
      br += w * clampRating5(s.weightedBurn ?? 4.5);
      su += w * clampRating5(s.weightedSugar ?? 4.0);
      ar += w * clampRating5(s.weightedAroma ?? 4.2);
    }
    const d = totalW > 0 ? totalW : 1;
    return {
      power: Number((p / d).toFixed(1)),
      impact: Number((im / d).toFixed(1)),
      bitter: Number((bi / d).toFixed(1)),
      burn: Number((br / d).toFixed(1)),
      sugar: Number((su / d).toFixed(1)),
      aroma: Number((ar / d).toFixed(1)),
    };
  })();

  const [testerName, setTesterName] = useState(roll.smokingTest?.testerName || '');
  const [testDate, setTestDate] = useState(
    roll.smokingTest?.testDate || new Date().toISOString().split('T')[0]
  );
  const [tastingNotes, setTastingNotes] = useState(roll.smokingTest?.tastingNotes || '');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setTesterName(roll.smokingTest?.testerName || '');
    setTestDate(roll.smokingTest?.testDate || new Date().toISOString().split('T')[0]);
    setTastingNotes(roll.smokingTest?.tastingNotes || '');
  }, [roll.id]);

  const handleSaveTest = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSmokingTest(roll.id, {
      testDate,
      testerName: testerName.trim() || 'Grader Pabrik',
      powerScore: overallAvg.power,
      impactScore: overallAvg.impact,
      bitterScore: overallAvg.bitter,
      burnScore: overallAvg.burn,
      sugarScore: overallAvg.sugar,
      aromaScore: overallAvg.aroma,
      tastingNotes,
      factoryVerdict: roll.smokingTest?.factoryVerdict || 'Diterima Penuh',
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    if (!isEmbedded && onClose) {
      onClose();
    }
  };

  const visibleGradeGroups =
    selectedGradeFilter === 'ALL'
      ? gradeGroups
      : gradeGroups.filter((g) => g.grade === selectedGradeFilter);

  return (
    <div className="space-y-5 text-sm">
      {/* SECTION 0: RATA-RATA KARAKTER TEMBAKAU DI GULUNGAN INI (FIXED & UNEDITABLE, LARGE MOBILE-FRIENDLY CARDS) */}
      <div className="bg-black p-4 sm:p-5 rounded-2xl border-2 border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-zinc-800">
          <div>
            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-amber-400 flex items-center gap-2">
              <Sliders className="w-5 h-5 shrink-0" />
              <span>Rata-Rata Karakter Tembakau Per Gulungan ({serialsInRoll.length} Seri)</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1">
              Nilai tetap (otomatis dari campuran seluruh Seri di dalam Gulungan{' '}
              <b className="text-white">{roll.rollNumber}</b>)
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 font-mono text-xs font-bold text-amber-400 inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Parameter Tetap (/5)</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          {[
            { label: 'Power', val: overallAvg.power, desc: 'Kekuatan Body' },
            { label: 'Impact', val: overallAvg.impact, desc: 'Tarikan' },
            { label: 'Bitter', val: overallAvg.bitter, desc: 'Pahit / Gurih' },
            { label: 'Burn', val: overallAvg.burn, desc: 'Daya Bakar' },
            { label: 'Sugar', val: overallAvg.sugar, desc: 'Manis Alami' },
            { label: 'Aroma', val: overallAvg.aroma, desc: 'Karakter Aroma' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-zinc-950 p-3.5 sm:p-4 rounded-xl border border-zinc-800 flex flex-col items-center justify-center shadow-xs"
            >
              <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-200">
                {item.label}
              </span>
              <span className="font-mono font-black text-amber-400 text-2xl sm:text-3xl mt-1">
                {item.val.toFixed(1)}
                <span className="text-xs sm:text-sm text-zinc-400 font-bold">/5</span>
              </span>
              <span className="text-xs text-zinc-400 mt-1 font-medium">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 1: KOMPOSISI TEMBAKAU PER GRADE */}
      <div className="space-y-4 bg-black p-4 sm:p-5 rounded-2xl border-2 border-zinc-800">
        <div className="flex flex-col gap-3.5 pb-4 border-b border-zinc-800">
          <div>
            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Komposisi Tembakau Per Grade di Gulungan Ini</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1">
              Pilih Grade di bawah untuk melihat rincian komposisi poin per poin, persentase (%), berat (KG), harga per KG, dan rata-rata karakternya
            </p>
          </div>

          {/* BIG, PHONE-READABLE GRADE FILTER BUTTONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedGradeFilter('ALL')}
              className={`min-h-11 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-black border-2 cursor-pointer transition-all flex items-center justify-center gap-2 ${
                selectedGradeFilter === 'ALL'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : 'bg-zinc-950 text-zinc-200 hover:text-white border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <span>Semua Grade ({gradeGroups.length} Grade)</span>
            </button>
            {gradeGroups.map((grp) => (
              <button
                key={grp.grade}
                type="button"
                onClick={() => setSelectedGradeFilter(grp.grade)}
                className={`min-h-11 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-black border-2 cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  selectedGradeFilter === grp.grade
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                    : 'bg-zinc-950 text-zinc-200 hover:text-white border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span>
                  Grade {grp.grade} ({grp.serialCount} Seri • {grp.totalGradeNetKg} KG)
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Card for Each Grade */}
        <div className="space-y-5">
          {visibleGradeGroups.map((grp) => {
            const gInfo = GRADE_LABELS[grp.grade] || GRADE_LABELS['D'];
            return (
              <div
                key={grp.grade}
                className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 sm:p-5 space-y-4"
              >
                {/* Grade Header + Seri list */}
                <div className="flex flex-col gap-3 pb-3.5 border-b border-zinc-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`px-3.5 py-1.5 rounded-xl text-sm sm:text-base font-mono font-black border ${gInfo.color}`}
                      >
                        GRADE {grp.grade}
                      </span>
                      <span className="text-sm sm:text-base font-black text-white">
                        Total {grp.totalGradeNetKg} KG ({grp.serialCount} Seri)
                      </span>
                    </div>

                    {grp.serialNumbers.length > 0 && (
                      <span className="text-xs sm:text-sm font-mono text-zinc-300 bg-black px-3 py-1 rounded-lg border border-zinc-800">
                        Nomor Seri: <b className="text-amber-400">{grp.serialNumbers.join(', ')}</b>
                      </span>
                    )}
                  </div>

                  {/* Readable 6-parameter fixed average strip for this Grade */}
                  <div className="bg-black p-3 rounded-xl border border-zinc-800/90 space-y-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                      Rata-Rata Karakter Grade {grp.grade} (Tetap):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center font-mono">
                      {[
                        { label: 'Power', val: grp.avgCharacter.power },
                        { label: 'Impact', val: grp.avgCharacter.impact },
                        { label: 'Bitter', val: grp.avgCharacter.bitter },
                        { label: 'Burn', val: grp.avgCharacter.burn },
                        { label: 'Sugar', val: grp.avgCharacter.sugar },
                        { label: 'Aroma', val: grp.avgCharacter.aroma },
                      ].map((pItem) => (
                        <div
                          key={pItem.label}
                          className="px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between sm:justify-center gap-1.5"
                        >
                          <span className="text-xs text-zinc-300 font-bold">{pItem.label}:</span>
                          <b className="text-sm sm:text-base text-amber-400 font-black">
                            {pItem.val}
                          </b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Point-by-Point Summary Box:
                    Grade D+
                    - Muntilan Yohan 50% (50 KG) (Rp 50,000)
                    - Temanggung Samuel 50% (50 KG) (Rp 75,000)
                */}
                <div className="bg-black p-4 sm:p-5 rounded-xl border-2 border-amber-500/45 space-y-2.5">
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-300">
                    Ringkasan Komposisi Grade {grp.grade}:
                  </div>
                  <div className="font-mono font-black text-amber-400 text-base sm:text-lg">
                    Grade {grp.grade}
                  </div>
                  <ul className="space-y-2 font-mono font-bold text-sm sm:text-base text-white">
                    {grp.pointLines.map((line, lineIdx) => (
                      <li key={lineIdx} className="leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Detailed Ingredient Rows for This Grade */}
                <div className="space-y-2.5">
                  {grp.ingredients.map((ing, idx) => {
                    const ingGradeInfo = GRADE_LABELS[ing.colorGrade] || GRADE_LABELS['D'];
                    return (
                      <div
                        key={`${grp.grade}-${ing.tobaccoId}-${idx}`}
                        className="bg-black p-3.5 sm:p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-sm sm:text-base">
                              {ing.tobaccoName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-black border ${ingGradeInfo.color}`}
                            >
                              Daun Grade {ing.colorGrade}
                            </span>
                          </div>
                          <div className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
                            Asal: <b className="text-white">{ing.origin}</b>
                            {ing.sellerName ? (
                              <>
                                {' '}
                                • Petani/Penjual: <b className="text-white">{ing.sellerName}</b>
                              </>
                            ) : null}{' '}
                            • Harga Daun:{' '}
                            <b className="text-amber-400">{formatRupiah(ing.realCostPerNetKg)}/kg</b>
                          </div>
                        </div>

                        <div className="sm:text-right space-y-1.5">
                          <div className="font-mono font-black text-amber-400 text-sm sm:text-base">
                            {ing.percentageInGrade}% ({ing.usedNetKg} KG)
                          </div>
                          <div className="text-xs text-zinc-300 font-mono flex flex-wrap sm:justify-end gap-2.5">
                            <span>
                              Power:<b className="text-white ml-0.5">{ing.powerRating}</b>
                            </span>
                            <span>
                              Impact:<b className="text-white ml-0.5">{ing.impactRating}</b>
                            </span>
                            <span>
                              Bitter:<b className="text-white ml-0.5">{ing.bitterRating}</b>
                            </span>
                            <span>
                              Burn:<b className="text-white ml-0.5">{ing.burnRating}</b>
                            </span>
                            <span>
                              Sugar:<b className="text-white ml-0.5">{ing.sugarRating}</b>
                            </span>
                            <span>
                              Aroma:<b className="text-white ml-0.5">{ing.aromaRating}</b>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: DATA GRADER & TANGGAL EVALUASI (FIXED CHARACTER PARAMETERS, NO VONIS GRADER, NO SLIDERS) */}
      <form
        onSubmit={handleSaveTest}
        className="space-y-4 bg-black p-4 sm:p-5 rounded-2xl border-2 border-zinc-800"
      >
        <div className="pb-3 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black uppercase tracking-wide text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Data Grader & Tanggal Evaluasi</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1">
              Parameter karakter campuran sudah tetap sesuai Seri di dalam Gulungan. Catat Nama Grader dan Tanggal Evaluasi di bawah ini.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-white mb-1.5">
              Nama Grader / Penguji
            </label>
            <input
              type="text"
              value={testerName}
              onChange={(e) => setTesterName(e.target.value)}
              placeholder="Contoh: Pak Yohan / Tim Grader"
              className="w-full h-11 px-3.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-sm font-bold focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-white mb-1.5">
              Tanggal Evaluasi
            </label>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full h-11 px-3.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-sm font-mono font-bold focus:outline-hidden focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-bold text-white mb-1.5">
            Catatan Grader (Opsional)
          </label>
          <textarea
            rows={2}
            value={tastingNotes}
            onChange={(e) => setTastingNotes(e.target.value)}
            placeholder="Catatan tambahan dari grader (opsional)..."
            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-amber-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          {!isEmbedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-sm cursor-pointer"
            >
              Tutup
            </button>
          )}
          <button
            type="submit"
            className="btn-amber-outline min-h-11 px-5 py-2 rounded-xl font-black text-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savedNotice ? 'Tersimpan ✓' : 'Simpan Nama Grader & Tanggal'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

interface RollDetailModalProps {
  roll: TobaccoRollSample | null;
  finishedBatches: FinishedTobaccoSerial[];
  rawTobaccos?: RawTobacco[];
  onClose: () => void;
  onUpdateSmokingTest: (
    rollId: string,
    updatedTest: NonNullable<TobaccoRollSample['smokingTest']>
  ) => void;
}

export const RollDetailModal: React.FC<RollDetailModalProps> = ({
  roll,
  finishedBatches,
  rawTobaccos = [],
  onClose,
  onUpdateSmokingTest,
}) => {
  if (!roll) return null;

  const serialsInRoll = finishedBatches.filter(
    (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
  );

  const formattedRollDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-xl bg-black text-amber-400 border border-zinc-700 shrink-0">
              <Flame className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                Komposisi dan Evaluasi — {roll.rollNumber} ({roll.recipeName})
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 flex items-center gap-2 flex-wrap mt-0.5">
                <span>
                  Pabrik: <b className="text-white">{roll.targetFactory}</b>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-mono text-zinc-300">
                  <Calendar className="w-3.5 h-3.5 text-zinc-300" />
                  {formattedRollDate}
                </span>
                <span>•</span>
                <span>{serialsInRoll.length} Seri</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors shrink-0"
            aria-label="Tutup modal komposisi dan evaluasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5 flex-1">
          <RollCompositionAndEvaluationPanel
            roll={roll}
            finishedBatches={finishedBatches}
            rawTobaccos={rawTobaccos}
            onUpdateSmokingTest={onUpdateSmokingTest}
            onClose={onClose}
            isEmbedded={false}
          />
        </div>
      </div>
    </div>
  );
};
