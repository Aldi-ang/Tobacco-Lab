import React, { useId } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RatingSegmentSliderProps {
  label: string;
  sublabel?: string;
  value: number; // 0 to 5
  onChange: (val: number) => void;
}

const QUICK_STEPS = [1, 2, 3, 3.5, 4, 4.5, 5];

export const RatingSegmentSlider: React.FC<RatingSegmentSliderProps> = ({
  label,
  sublabel,
  value,
  onChange,
}) => {
  const safeVal = Math.max(0, Math.min(5, Number(value) || 0));
  const fillPercent = (safeVal / 5) * 100;

  const handleStep = (delta: number) => {
    const next = Math.max(0, Math.min(5, Number((safeVal + delta).toFixed(1))));
    onChange(next);
  };

  return (
    <div className="bg-black/95 p-3.5 rounded-xl border border-zinc-800 hover:border-amber-500/50 transition-all duration-200 space-y-3">
      {/* Top Row: Label & Stepper Buttons */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-800/90">
        <div className="min-w-0">
          <span className="text-xs font-bold text-white block truncate">{label}</span>
          {sublabel && <span className="text-[10px] text-zinc-400 block truncate">{sublabel}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleStep(-0.5)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-zinc-800 hover:border-amber-500 cursor-pointer"
            title={`Kurangi ${label}`}
            aria-label={`Kurangi ${label}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="px-2.5 py-1 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-extrabold text-xs min-w-[56px] text-center shadow-[0_0_12px_rgba(245,158,11,0.2)]">
            {safeVal.toFixed(1)}/5
          </div>
          <button
            type="button"
            onClick={() => handleStep(0.5)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-zinc-800 hover:border-amber-500 cursor-pointer"
            title={`Tambah ${label}`}
            aria-label={`Tambah ${label}`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Smooth Track + Native Range Overlay with spacing */}
      <div className="pt-0.5 space-y-2.5">
        <div className="relative h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-700/90">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 rounded-full"
            initial={false}
            animate={{ width: `${fillPercent}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          />
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={safeVal}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
          />
        </div>

        {/* Ergonomic Segment Quick-Select Buttons separated by border & spacing */}
        <div className="pt-2 border-t border-zinc-900 grid grid-cols-7 gap-1">
          {QUICK_STEPS.map((step) => {
            const isActive = Math.abs(safeVal - step) < 0.05;
            return (
              <button
                key={step}
                type="button"
                onClick={() => onChange(step)}
                className={`py-1 rounded-md font-mono text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-black text-amber-400 border border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white hover:border-amber-500/40 border border-zinc-800/80'
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
  label: string; // Short label displayed on button
  fullLabel?: string; // Full descriptive name shown on hover tooltip
  badge?: string | number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
}

/**
 * Fixed-Position Left/Right Navigator + Segment Switcher
 * - Full-width locked container (`w-full`) so the `<` and `>` navigator buttons stay
 *   in the exact same pixel position and never shift, resize, or snap when pressed.
 * - On Phone (`< sm`): Fixed-width center display between left `<` and right `>`.
 * - On Desktop (`>= sm`): Equal-width columns for every option between left `<` and right `>`.
 */
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
      className={`w-full flex items-center justify-between gap-2 p-1.5 rounded-xl bg-black/95 border border-zinc-800 ${className}`}
      role="tablist"
    >
      {/* Fixed Left Navigator Button */}
      <button
        type="button"
        onClick={handlePrev}
        className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-amber-500/70 hover:border-amber-400 transition-colors cursor-pointer"
        title="Segmen Sebelumnya"
        aria-label="Segmen Sebelumnya"
      >
        <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* PHONE VIEW (< sm): Fixed-Width Center Indicator so `<` and `>` NEVER move */}
      <div className="sm:hidden flex-1 min-w-0 flex items-center justify-center">
        <div
          role="tab"
          aria-selected={true}
          title={currentOption.fullLabel || currentOption.label}
          className="w-full h-9 px-3 rounded-lg bg-black border border-amber-500 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)] flex items-center justify-center gap-1.5 text-xs font-extrabold whitespace-nowrap overflow-hidden select-none"
        >
          <span className="shrink-0">{currentOption.icon}</span>
          <span className="truncate">{currentOption.label}</span>
          {currentOption.badge !== undefined && (
            <span className="text-[10px] font-mono text-zinc-300 font-bold shrink-0">
              ({currentOption.badge})
            </span>
          )}
        </div>
      </div>

      {/* TABLET & DESKTOP VIEW (>= sm): Equal-Width Columns so format never shifts */}
      <div
        className="hidden sm:grid flex-1 min-w-0 gap-1.5"
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
              className={`group relative w-full h-9 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-xs font-extrabold whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'text-amber-400'
                  : 'text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800/80'
              }`}
            >
              {isActive && (
                <div
                  key={`active-${groupId}`}
                  className="absolute inset-0 rounded-lg bg-black border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5 min-w-0">
                <span className="shrink-0">{opt.icon}</span>
                <span className="truncate">{opt.label}</span>
                {opt.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold shrink-0 ${
                      isActive ? 'text-amber-300' : 'text-zinc-400'
                    }`}
                  >
                    ({opt.badge})
                  </span>
                )}
              </span>

              {/* Sleek Hover Tooltip showing Full Segment Name */}
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-9 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500 text-amber-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                {fullText}
              </span>
            </button>
          );
        })}
      </div>

      {/* Fixed Right Navigator Button */}
      <button
        type="button"
        onClick={handleNext}
        className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-amber-500/70 hover:border-amber-400 transition-colors cursor-pointer"
        title="Segmen Berikutnya"
        aria-label="Segmen Berikutnya"
      >
        <ChevronRight className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
}
