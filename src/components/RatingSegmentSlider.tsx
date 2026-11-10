import React, { useId } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RatingSegmentSliderProps {
  label: string;
  sublabel?: string;
  value: number; // 0 to 5
  onChange: (val: number) => void;
  disabled?: boolean;
  headerExtra?: React.ReactNode;
}

const QUICK_STEPS = [0, 1, 2, 3, 3.5, 4, 4.5, 5];

export const RatingSegmentSlider: React.FC<RatingSegmentSliderProps> = ({
  label,
  sublabel,
  value,
  onChange,
  disabled = false,
  headerExtra,
}) => {
  const safeVal = Math.max(0, Math.min(5, Number(value) || 0));
  const fillPercent = (safeVal / 5) * 100;
  const isEmptyZero = safeVal === 0;

  const handleStep = (delta: number) => {
    if (disabled) return;
    const next = Math.max(0, Math.min(5, Number((safeVal + delta).toFixed(1))));
    onChange(next);
  };

  return (
    <div
      className={`bg-black/95 p-3.5 rounded-xl border transition-all duration-200 space-y-3 ${
        disabled
          ? 'border-zinc-800/70 opacity-75'
          : isEmptyZero
            ? 'border-dashed border-amber-500/40 hover:border-amber-500/70'
            : 'border-zinc-800 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/90">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-white truncate">{label}</span>
            {isEmptyZero && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold">
                Kosong (0)
              </span>
            )}
            {headerExtra}
          </div>
          {sublabel && <span className="text-[10px] text-zinc-400 block truncate">{sublabel}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStep(-0.5)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Kurangi ${label}`}
            aria-label={`Kurangi ${label}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div
            className={`px-2.5 py-1 rounded-lg bg-black border font-mono font-extrabold text-xs min-w-[56px] text-center ${
              isEmptyZero
                ? 'text-zinc-500 border-zinc-800'
                : 'text-white border-zinc-700'
            }`}
          >
            {safeVal.toFixed(1)}<span className="text-amber-400">/5</span>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleStep(0.5)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Tambah ${label}`}
            aria-label={`Tambah ${label}`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="pt-0.5 space-y-2.5">
        <div className="relative h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <motion.div
            className="h-full bg-gradient-to-r from-zinc-400 via-white to-amber-400 rounded-full"
            initial={false}
            animate={{ width: `${fillPercent}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          />
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            disabled={disabled}
            value={safeVal}
            onChange={(e) => {
              if (!disabled) onChange(parseFloat(e.target.value));
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label={label}
          />
        </div>

        <div className="pt-2 border-t border-zinc-900 grid grid-cols-8 gap-1">
          {QUICK_STEPS.map((step) => {
            const isActive = Math.abs(safeVal - step) < 0.05;
            return (
              <button
                key={step}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (!disabled) onChange(step);
                }}
                className={`py-1 rounded-md font-mono text-[10px] font-bold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-black text-amber-400 border border-amber-500/80'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-600 border border-zinc-800/80'
                }`}
              >
                {step}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  fullLabel?: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  const groupId = useId();
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  );
  const currentOption = options[currentIndex] || options[0];

  const handlePrev = () => {
    const prevIdx = (currentIndex - 1 + options.length) % options.length;
    onChange(options[prevIdx].id);
  };

  const handleNext = () => {
    const nextIdx = (currentIndex + 1) % options.length;
    onChange(options[nextIdx].id);
  };

  return (
    <div
      className={`w-full flex items-center justify-between gap-1.5 p-1 rounded-xl bg-black/95 border border-zinc-800 ${className}`}
      role="tablist"
    >
      <button
        type="button"
        onClick={handlePrev}
        className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer"
        title="Segmen Sebelumnya"
        aria-label="Segmen Sebelumnya"
      >
        <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>

      <div className="sm:hidden flex-1 min-w-0 flex items-center justify-center">
        <div
          role="tab"
          aria-selected={true}
          title={currentOption.fullLabel || currentOption.label}
          className="w-full h-7 px-2.5 rounded-lg bg-black border border-amber-500/80 text-white flex items-center justify-center gap-1.5 text-[11px] font-extrabold whitespace-nowrap overflow-hidden select-none"
        >
          <span className="shrink-0 text-amber-400">{currentOption.icon}</span>
          <span className="truncate">{currentOption.label}</span>
          {currentOption.badge !== undefined && (
            <span className="text-[10px] font-mono text-zinc-300 font-bold shrink-0">
              ({currentOption.badge})
            </span>
          )}
        </div>
      </div>

      <div
        className="hidden sm:grid flex-1 min-w-0 gap-1"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))`,
        }}
      >
        {options.map((opt) => {
          const isActive = value === opt.id;
          const fullText = opt.fullLabel || opt.label;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={fullText}
              onClick={() => onChange(opt.id)}
              className={`group relative w-full h-8 px-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800/80'
              }`}
            >
              {isActive && (
                <div
                  key={`active-${groupId}`}
                  className="absolute inset-0 rounded-lg bg-black border border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.12)]"
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5 min-w-0">
                <span className={`shrink-0 ${isActive ? 'text-amber-400' : ''}`}>{opt.icon}</span>
                <span className="truncate">{opt.label}</span>
                {opt.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold shrink-0 ${
                      isActive ? 'text-amber-400' : 'text-zinc-400'
                    }`}
                  >
                    ({opt.badge})
                  </span>
                )}
              </span>

              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-9 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                {fullText}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer"
        title="Segmen Berikutnya"
        aria-label="Segmen Berikutnya"
      >
        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>
    </div>
  );
}
