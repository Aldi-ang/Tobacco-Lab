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

/**
 * Interactive Swappable & Auto-Spinning Statistic Panel for Tobacco Cards.
 * - Lets users toggle/swap between different metrics (5 Karakter /5, Timbangan, Modal, Profit)
 *   via quick-swap pill tabs, left/right mini arrows, or tapping the stat deck directly.
 * - Automatically cycles smoothly when idle so all metrics remain visible without taking extra space.
 */
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
      className="relative bg-black/95 border border-zinc-800 hover:border-amber-500/70 rounded-xl p-2.5 overflow-hidden transition-colors cursor-pointer select-none min-h-[108px] flex flex-col justify-between shadow-inner"
    >
      {/* Top Header: Active Metric Label + Interactive Swap Button */}
      <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-zinc-900">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 truncate">
          {current.label}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handlePrevMetric}
            title="Statistik Sebelumnya"
            aria-label="Statistik Sebelumnya"
            className="h-5 w-5 rounded bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-amber-400 border border-zinc-800 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleNextMetric}
            title="Tukar Statistik (Swap)"
            className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-zinc-950 hover:bg-zinc-900 text-[9px] font-mono font-bold text-amber-400 border border-amber-500/50 cursor-pointer"
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
            className="h-5 w-5 rounded bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-amber-400 border border-zinc-800 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Swappable 3D Animated Metric Body */}
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
              /* ALL 5 CHARACTER PARAMETERS (/5) INSIDE THE SWAPPABLE PANEL */
              <div className="grid grid-cols-5 gap-1 text-center">
                {current.characterParams.map((param) => (
                  <div
                    key={param.label}
                    className="bg-zinc-950 border border-zinc-800/90 rounded-lg py-1 px-0.5 flex flex-col items-center justify-center"
                  >
                    <span className="text-[8px] sm:text-[9px] font-bold uppercase text-zinc-400 leading-none">
                      {param.shortLabel}
                    </span>
                    <span className="font-mono font-black text-[11px] sm:text-xs text-amber-400 leading-tight mt-0.5">
                      {param.value.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* 2-LINE CLEAR STATISTIC DISPLAY */
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`font-mono font-black text-xs sm:text-sm whitespace-nowrap ${valueColor}`}
                  >
                    {current.value}
                  </span>
                  {current.subValue && (
                    <span className="font-mono text-[10px] font-bold text-amber-300 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 whitespace-nowrap shrink-0">
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

      {/* Quick-Swap Metric Pill Switcher at Bottom */}
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
                  ? 'bg-black text-amber-400 border border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
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
