import React, { useState } from 'react';
import {
  X,
  Flame,
  Layers,
  Save,
  Calendar,
} from 'lucide-react';
import { TobaccoRollSample, FinishedTobaccoSerial, TobaccoGrade } from '../types/tobacco';
import { GRADE_LABELS, formatRupiah, clampRating5 } from '../utils/tobaccoMath';
import { RatingSegmentSlider } from './RatingSegmentSlider';

interface RollDetailModalProps {
  roll: TobaccoRollSample | null;
  finishedBatches: FinishedTobaccoSerial[];
  onClose: () => void;
  onUpdateSmokingTest: (
    rollId: string,
    updatedTest: NonNullable<TobaccoRollSample['smokingTest']>
  ) => void;
}

export const RollDetailModal: React.FC<RollDetailModalProps> = ({
  roll,
  finishedBatches,
  onClose,
  onUpdateSmokingTest,
}) => {
  if (!roll) return null;

  const [testerName, setTesterName] = useState(roll.smokingTest?.testerName || '');
  const [testDate, setTestDate] = useState(
    roll.smokingTest?.testDate || new Date().toISOString().split('T')[0]
  );
  const [aromaScore, setAromaScore] = useState<number>(
    clampRating5(roll.smokingTest?.aromaScore || 4.5)
  );
  const [smoothnessScore, setSmoothnessScore] = useState<number>(
    clampRating5(roll.smokingTest?.smoothnessScore || 4.4)
  );
  const [ashQuality, setAshQuality] = useState(roll.smokingTest?.ashQuality || 'Putih Bersih');
  const [burnRate, setBurnRate] = useState(roll.smokingTest?.burnRate || 'Sempurna');
  const [tastingNotes, setTastingNotes] = useState(roll.smokingTest?.tastingNotes || '');
  const [factoryVerdict, setFactoryVerdict] = useState<
    NonNullable<TobaccoRollSample['smokingTest']>['factoryVerdict']
  >(roll.smokingTest?.factoryVerdict || 'Diterima Penuh');

  const serialsInRoll = finishedBatches.filter(
    (b) => b.rollId === roll.id || b.rollNumber === roll.rollNumber
  );

  const displayIngredients =
    roll.ingredientsSnapshot && roll.ingredientsSnapshot.length > 0
      ? roll.ingredientsSnapshot
      : serialsInRoll[0]?.ingredients || [];

  // Calculate accurate multi-grade breakdown across all serials inside this Gulungan
  const gradeCounts = serialsInRoll.reduce<Record<string, number>>((acc, ser) => {
    const g = ser.compositeColorGrade || 'D';
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {});
  const multiGradeEntries = Object.entries(gradeCounts);

  const formattedRollDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleSaveTest = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSmokingTest(roll.id, {
      testDate,
      testerName: testerName.trim() || 'QC Tester Pabrik',
      aromaScore: Number(aromaScore) || 0,
      smoothnessScore: Number(smoothnessScore) || 0,
      ashQuality: ashQuality as any,
      burnRate: burnRate as any,
      tastingNotes,
      factoryVerdict,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-950 border-2 border-amber-500/80 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        {/* Header (Shows Gulungan Name, Code, and Date) */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-black flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-black text-amber-400 border border-amber-500 shrink-0">
              <Flame className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                Komposisi dan Evaluasi — {roll.rollNumber} ({roll.recipeName})
              </h2>
              <p className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                <span>
                  Pabrik: <b className="text-amber-400">{roll.targetFactory}</b>
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-mono text-zinc-300">
                  <Calendar className="w-3 h-3 text-amber-400" />
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
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors shrink-0"
            aria-label="Tutup modal komposisi dan evaluasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Locked Content Body (No Confusing < > Slider Inside!) */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-6 flex-1 text-xs">
          {/* SECTION 1: KOMPOSISI DAUN & MULTI-GRADE SERI BREAKDOWN */}
          <div className="space-y-3 bg-black/90 p-4 rounded-xl border border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-800">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                1. Rincian Komposisi Campuran Daun & Multi-Grade Seri
              </h3>

              {/* Accurate Multi-Grade Breakdown across all Serials in this Gulungan */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-zinc-400 font-bold">
                  Grade Seri di Gulungan Ini:
                </span>
                {multiGradeEntries.length > 0 ? (
                  multiGradeEntries.map(([gradeKey, count]) => {
                    const gInfo =
                      GRADE_LABELS[gradeKey as TobaccoGrade] || GRADE_LABELS['D'];
                    return (
                      <span
                        key={gradeKey}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black border ${gInfo.color}`}
                      >
                        Grade {gradeKey}: {count} Seri
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Multi-Grade Campuran
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {displayIngredients.map((ing, idx) => {
                const ingGradeInfo =
                  GRADE_LABELS[ing.colorGrade] || GRADE_LABELS['D'];
                return (
                  <div
                    key={idx}
                    className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs sm:text-sm">
                          {ing.tobaccoName}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${ingGradeInfo.color}`}
                        >
                          Daun Grade {ing.colorGrade}
                        </span>
                      </div>
                      <div className="text-zinc-400 text-[11px] mt-0.5">
                        Asal: {ing.origin} • Modal Daun: {formatRupiah(ing.realCostPerNetKg)}/kg
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-amber-400 text-xs sm:text-sm">
                        {ing.percentageInBlend}% ({ing.usedNetKg} kg)
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        P:{clampRating5(ing.powerRating)}/5 | I:{clampRating5(ing.impactRating)}/5 | B:
                        {clampRating5(ing.bitterRating)}/5
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: EVALUASI GRADER PABRIK (/5) */}
          <form
            onSubmit={handleSaveTest}
            className="space-y-4 bg-black/90 p-4 rounded-xl border border-zinc-800"
          >
            <div className="pb-2.5 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                2. Evaluasi Kualitas & Catatan Grader Pabrik (Skala /5)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Nama Grader / Penguji
                </label>
                <input
                  type="text"
                  value={testerName}
                  onChange={(e) => setTesterName(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Tanggal Evaluasi
                </label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RatingSegmentSlider
                label="Skor Aroma / Wangi"
                sublabel="Kualitas wangi saat dibakar"
                value={aromaScore}
                onChange={setAromaScore}
              />
              <RatingSegmentSlider
                label="Skor Kelembutan"
                sublabel="Halus di tenggorokan"
                value={smoothnessScore}
                onChange={setSmoothnessScore}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Kualitas Abu
                </label>
                <select
                  value={ashQuality}
                  onChange={(e) => setAshQuality(e.target.value as any)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs"
                >
                  <option value="Putih Bersih">Putih Bersih</option>
                  <option value="Abu Terang">Abu Terang</option>
                  <option value="Abu Sedang">Abu Sedang</option>
                  <option value="Hitam/Kotor">Hitam / Kotor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Laju Bakaran
                </label>
                <select
                  value={burnRate}
                  onChange={(e) => setBurnRate(e.target.value as any)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs"
                >
                  <option value="Sempurna">Sempurna</option>
                  <option value="Cepat">Terlalu Cepat</option>
                  <option value="Lambat">Lambat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Vonis Grader Pabrik
                </label>
                <select
                  value={factoryVerdict}
                  onChange={(e) => setFactoryVerdict(e.target.value as any)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-amber-500/60 rounded-xl text-amber-400 text-xs font-bold"
                >
                  <option value="Diterima Penuh">Diterima Penuh</option>
                  <option value="Diterima Bersyarat">Diterima Bersyarat</option>
                  <option value="Minta Ubah Komposisi">Ubah Komposisi</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Catatan Evaluasi Grader
              </label>
              <textarea
                rows={2}
                value={tastingNotes}
                onChange={(e) => setTastingNotes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-9 px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="btn-amber-outline min-h-9 px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Simpan Evaluasi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
