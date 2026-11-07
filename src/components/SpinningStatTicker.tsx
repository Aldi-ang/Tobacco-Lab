import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export interface CharacterParamBadge {
  label: string;
  shortLabel: string;
  value: number; // out of 5
}

export interface StatTickerItem {
  id: string;
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
 * 3D Spinning / Swappable Statistic Ticker for 2-Column Mobile Cards.
 * - Designed for ~150px narrow mobile card columns so numbers never get cut off with "...".
 * - Displays ALL 5 Character Parameters (/5: Power, Impact, Bitter, Bakar, Sugar)
 *   inside the moving panel as well as clear 2-line weight, cost, and profit breakdowns.
 * - Users can tap the panel directly to spin to the next stat on demand.
 */
export const SpinningStatTicker: React.FC<SpinningStatTickerProps> = ({
  items,
  intervalMs = 3000,
}) => {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, intervalMs, isPaused]);

  if (items.length === 0) return null;
  const current = items[index % items.length];

  const valueColor =
    current.accent === 'amber'
      ? 'text-amber-400'
      : current.accent === 'emerald'
      ? 'text-emerald-400'
      : current.accent === 'rose'
      ? 'text-rose-400'
      : 'text-white';

  const handleManualSpin = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div
      onClick={handleManualSpin}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      title="Panel Statistik Berputar (Ketuk untuk ganti statistik berikutnya)"
      className="relative bg-black/95 border border-zinc-800 hover:border-amber-500/70 rounded-xl px-2 py-2 overflow-hidden transition-colors cursor-pointer select-none min-h-[90px] sm:min-h-[96px] flex flex-col justify-between"
    >
      {/* Top micro header: current stat category + spinning counter */}
      <div className="flex items-center justify-between gap-1 pb-1 border-b border-zinc-900">
        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-400 truncate">
          {current.label}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[8px] sm:text-[9px] font-mono text-zinc-400 shrink-0">
          <RefreshCw
            className="w-2.5 h-2.5 text-amber-400 animate-spin"
            style={{ animationDuration: '5s' }}
          />
          {index + 1}/{items.length}
        </span>
      </div>

      {/* 3D Vertical Drum-Roll Animated Content Area */}
      <div className="relative my-auto py-1 min-h-[46px] flex items-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 14, rotateX: -60 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -14, rotateX: 60 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {current.characterParams && current.characterParams.length > 0 ? (
              /* ALL 5 CHARACTER PARAMETERS (/5) INSIDE THE MOVING PANEL */
              <div className="grid grid-cols-5 gap-1 text-center">
                {current.characterParams.map((param) => (
                  <div
                    key={param.label}
                    className="bg-zinc-950 border border-zinc-800/90 rounded-md py-1 px-0.5 flex flex-col items-center justify-center"
                  >
                    <span className="text-[8px] font-bold uppercase text-zinc-400 leading-none">
                      {param.shortLabel}
                    </span>
                    <span className="font-mono font-black text-[10px] sm:text-xs text-amber-400 leading-tight mt-0.5">
                      {param.value.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* 2-LINE CLEAR STATISTIC DISPLAY (Full width per line so numbers never truncate!) */
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-mono font-black text-[11px] sm:text-xs whitespace-nowrap ${valueColor}`}
                  >
                    {current.value}
                  </span>
                  {current.subValue && (
                    <span className="font-mono text-[9px] sm:text-[10px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                      {current.subValue}
                    </span>
                  )}
                </div>
                {current.detailLine && (
                  <div className="text-[9px] sm:text-[10px] font-mono text-zinc-400 truncate">
                    {current.detailLine}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots at bottom */}
      <div className="flex items-center justify-center gap-1 pt-0.5">
        {items.map((it, idx) => (
          <span
            key={it.id}
            className={`h-1 rounded-full transition-all duration-300 ${
              idx === index % items.length ? 'w-4 bg-amber-400' : 'w-1.5 bg-zinc-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
