import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';

export interface CharacterParamBadge {
  label: string;
  shortLabel: string;
  value: number; // out of 5
}

export interface StatTickerItem {
  id: string;
  shortTab?: string;
  label: string;
  value: string;
  subValue?: string;
  detailLine?: string;
  accent?: 'amber' | 'white' | 'emerald' | 'rose';
  characterParams?: CharacterParamBadge[];
}

interface SpinningStatTickerProps {
  items: StatTickerItem[];
  intervalMs?: number;
}

export const SpinningStatTicker: React.FC<SpinningStatTickerProps> = ({
  items,
  intervalMs = 3400,
}) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, intervalMs, isPaused]);

  if (items.length === 0) return null;
  const safeIndex = index % items.length;
  const current = items[safeIndex];

  const valueColor =
    current.accent === 'amber'
      ? 'text-amber-400'
      : current.accent === 'emerald'
      ? 'text-emerald-400'
      : current.accent === 'rose'
      ? 'text-rose-400'
      : 'text-white';

  const handleNextMetric = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrevMetric = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleSelectMetric = (e: React.MouseEvent, targetIdx: number) => {
    e.stopPropagation();
    setDirection(targetIdx >= safeIndex ? 1 : -1);
    setIndex(targetIdx);
    setIsPaused(true);
  };

  return (
    <div
      onClick={handleNextMetric}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      title="Ketuk untuk menukar (swap) tampilan statistik"
      className="relative bg-black/95 border border-zinc-800 hover:border-zinc-600 rounded-xl p-2.5 overflow-hidden transition-colors cursor-pointer select-none min-h-[108px] flex flex-col justify-between shadow-inner"
    >
      <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-zinc-900">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-300 truncate">
          {current.label}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handlePrevMetric}
            title="Statistik Sebelumnya"
            aria-label="Statistik Sebelumnya"
            className="h-5 w-5 rounded bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleNextMetric}
            title="Tukar Statistik (Swap)"
            className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-zinc-950 hover:bg-zinc-900 text-[9px] font-mono font-bold text-white border border-zinc-700 cursor-pointer"
          >
            <ArrowLeftRight className="w-2.5 h-2.5 text-amber-400" />
            <span>
              {safeIndex + 1}/{items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={handleNextMetric}
            title="Statistik Berikutnya"
            aria-label="Statistik Berikutnya"
            className="h-5 w-5 rounded bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="relative my-auto py-1.5 min-h-[48px] flex items-center overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            initial={{ opacity: 0, y: direction * 14, rotateX: direction * -55, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction * -14, rotateX: direction * 55, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {current.characterParams && current.characterParams.length > 0 ? (
              <div
                className={`grid ${
                  current.characterParams.length >= 6 ? 'grid-cols-6' : 'grid-cols-5'
                } gap-1 text-center`}
              >
                {current.characterParams.map((param) => (
                  <div
                    key={param.label}
                    className="bg-zinc-950 border border-zinc-800/90 rounded-lg py-1 px-0.5 flex flex-col items-center justify-center"
                  >
                    <span className="text-[8px] sm:text-[9px] font-bold uppercase text-zinc-400 leading-none truncate max-w-full">
                      {param.shortLabel}
                    </span>
                    <span className="font-mono font-black text-xs sm:text-sm text-amber-400 leading-tight mt-0.5">
                      {param.value.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`font-mono font-black text-xs sm:text-sm whitespace-nowrap ${valueColor}`}
                  >
                    {current.value}
                  </span>
                  {current.subValue && (
                    <span className="font-mono text-[10px] font-bold text-zinc-200 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 whitespace-nowrap shrink-0">
                      {current.subValue}
                    </span>
                  )}
                </div>
                {current.detailLine && (
                  <div className="text-[10px] font-mono text-zinc-400 truncate">
                    {current.detailLine}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-zinc-900/90">
        {items.map((it, idx) => {
          const isActive = idx === safeIndex;
          const tabText =
            it.shortTab ||
            (idx === 0 ? 'Rasa' : idx === 1 ? 'Berat' : idx === 2 ? 'Modal' : 'Info');
          return (
            <button
              key={it.id}
              type="button"
              onClick={(e) => handleSelectMetric(e, idx)}
              className={`py-0.5 px-1 rounded text-[8px] sm:text-[9px] font-extrabold uppercase tracking-tight transition-all cursor-pointer truncate ${
                isActive
                  ? 'bg-black text-amber-400 border border-amber-500/80'
                  : 'bg-zinc-950/90 text-zinc-400 hover:text-white border border-zinc-800/70'
              }`}
            >
              {tabText}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export interface AutoSlideValueSlide {
  id: string;
  tabLabel: string;
  title: string;
  mainValue: string;
  subLabel: string;
  subValue: string;
  formulaHint?: string;
  accent?: 'white' | 'amber' | 'red';
  onOpenCalc?: () => void;
}

interface AutoSlideValueTickerProps {
  slides: AutoSlideValueSlide[];
  intervalMs?: number;
}

export const AutoSlideValueTicker: React.FC<AutoSlideValueTickerProps> = ({
  slides,
  intervalMs = 3800,
}) => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, intervalMs, isPaused]);

  if (slides.length === 0) return null;
  const safeIndex = index % slides.length;
  const current = slides[safeIndex];

  const mainValueColor =
    current.accent === 'amber'
      ? 'text-amber-400'
      : current.accent === 'red'
      ? 'text-red-400'
      : 'text-white';

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="requiem-card p-3 sm:p-3.5 rounded-xl border border-zinc-700/90 bg-black/95 space-y-2.5 select-none shadow-[0_4px_0_0_#18181b,0_10px_20px_rgba(0,0,0,0.85)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-zinc-200 truncate">
            {current.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {current.onOpenCalc && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                current.onOpenCalc?.();
              }}
              aria-label="Lihat rincian rumus & asal angka"
              className="group relative h-7 w-7 shrink-0 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-amber-500/60 font-serif italic font-black text-xs inline-flex items-center justify-center cursor-pointer transition-colors"
            >
              <span>ƒx</span>
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500/70 text-white font-sans not-italic text-[10px] font-bold whitespace-nowrap shadow-xl">
                Rincian Rumus (ƒx)
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrev}
            aria-label="Slide Sebelumnya"
            className="group relative h-7 w-7 shrink-0 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
               Metrik Sebelumnya
            </span>
          </button>

          <span className="text-[10px] font-mono font-bold text-zinc-400 px-1 shrink-0">
            {safeIndex + 1}/{slides.length}
          </span>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Slide Berikutnya"
            className="group relative h-7 w-7 shrink-0 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
              Metrik Berikutnya
            </span>
          </button>
        </div>
      </div>

      <div
        onClick={() => current.onOpenCalc?.()}
        className="relative overflow-hidden bg-zinc-950/95 border border-zinc-800 hover:border-zinc-600 rounded-xl px-3.5 py-2.5 cursor-pointer transition-colors"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
          >
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span
                className={`font-mono font-black text-xl sm:text-2xl tracking-tight ${mainValueColor}`}
              >
                {current.mainValue}
              </span>
              {current.formulaHint && (
                <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400">
                  ({current.formulaHint})
                </span>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 bg-black px-2.5 py-1 rounded-lg border border-zinc-800 self-start sm:self-auto">
              <span className="text-[11px] font-mono text-zinc-400">{current.subLabel}:</span>
              <b className="text-xs sm:text-sm font-mono font-black text-white">
                {current.subValue}
              </b>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {slides.map((s, idx) => {
          const isActive = idx === safeIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setDirection(idx >= safeIndex ? 1 : -1);
                setIndex(idx);
              }}
              className={`group relative py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-tight transition-colors cursor-pointer truncate ${
                isActive
                  ? 'bg-black text-amber-400 border border-amber-500/80 shadow-xs'
                  : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <span className="truncate block">{s.tabLabel}</span>
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:block absolute -top-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                {s.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
