import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Calendar, Building2, Scroll } from 'lucide-react';

interface TobaccoRoll3DProps {
  isOpen?: boolean;
  rollNumber: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 3D Old Medieval Cream Parchment Scroll (Gulungan Tembakau)
 * Inspired by https://www.youtube.com/shorts/GJLmQ5SQtio (Old Paper Scroll Animation)
 * Uses natural medieval cream vellum (#f5ebd6 / #e6d5b2 / #cbb082) with turned walnut wood
 * spindle handles (#4a2c18 / #2b180c) and antique brass rings.
 */
export const TobaccoRoll3D: React.FC<TobaccoRoll3DProps> = ({
  isOpen = false,
  rollNumber,
  size = 'md',
}) => {
  const heightClass = size === 'sm' ? 'h-14' : size === 'lg' ? 'h-20' : 'h-16';

  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl bg-gradient-to-b from-zinc-950 via-black to-zinc-950 border border-zinc-800/90 overflow-hidden flex items-center justify-center px-2.5 select-none`}
      style={{ perspective: '900px' }}
    >
      {/* Warm antique parchment ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(232,216,181,0.16),transparent_72%)] pointer-events-none" />

      {!isOpen ? (
        /* CLOSED MEDIEVAL CREAM PARCHMENT SCROLL WITH WALNUT WOOD SPINDLES */
        <motion.div
          initial={{ rotateX: 14, scale: 0.97 }}
          animate={{ rotateX: 6, scale: 1 }}
          whileHover={{ rotateX: 0, scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative w-full max-w-[310px] h-9 sm:h-10 flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Left Turned Walnut Wood & Brass Finial Handle */}
          <div className="flex items-center shrink-0 z-10">
            <div
              className="w-2.5 h-3.5 rounded-l-full border border-[#c8a96e]"
              style={{
                background: 'linear-gradient(180deg, #6e472b 0%, #3d2312 55%, #1f1007 100%)',
              }}
            />
            <div
              className="w-1.5 h-6 border-y border-[#b89758]"
              style={{
                background: 'linear-gradient(180deg, #3b2212 0%, #1c0f07 100%)',
              }}
            />
            <div
              className="w-2.5 h-9 sm:h-10 rounded-l-md border border-[#d8be8a] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #e2c992 0%, #a88648 50%, #5e441e 100%)',
              }}
            />
          </div>

          {/* Rolled Natural Cream Medieval Parchment Cylinder Body */}
          <div
            className="flex-1 h-8 sm:h-9 border-y border-[#bfa36f] relative overflow-hidden flex items-center justify-between px-3 shadow-[0_8px_18px_rgba(0,0,0,0.9),inset_0_2px_6px_rgba(255,250,235,0.65)]"
            style={{
              background:
                'linear-gradient(180deg, #cbb282 0%, #f5ebd6 32%, #efe0c2 62%, #b89b67 100%)',
            }}
          >
            {/* Subtle aged parchment paper grain & rolled layer lines */}
            <div
              className="absolute inset-0 opacity-25 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(92,58,33,0.22) 0px, rgba(92,58,33,0.22) 1px, transparent 1px, transparent 9px)',
              }}
            />
            <div className="absolute inset-x-0 top-1 h-[1px] bg-white/60 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-1 h-[1px] bg-[#785932]/40 pointer-events-none" />

            {/* Left Crimson/Wax Twine Binding */}
            <div
              className="w-1.5 h-full z-10 shrink-0 shadow-xs"
              style={{
                background: 'linear-gradient(180deg, #7c2d12 0%, #991b1b 50%, #450a0a 100%)',
              }}
            />

            {/* Center Medieval Parchment Ink Label */}
            <div className="relative z-10 px-2.5 py-0.5 rounded-md bg-[#23170d]/95 border border-[#c8a96e] text-[10px] font-mono font-black text-[#f7eed7] tracking-wider shadow-md truncate flex items-center gap-1.5">
              <Scroll className="w-3 h-3 text-[#e8cf9c] shrink-0" />
              <span className="truncate">{rollNumber}</span>
            </div>

            {/* Right Crimson/Wax Twine Binding */}
            <div
              className="w-1.5 h-full z-10 shrink-0 shadow-xs"
              style={{
                background: 'linear-gradient(180deg, #7c2d12 0%, #991b1b 50%, #450a0a 100%)',
              }}
            />
          </div>

          {/* Right Turned Walnut Wood & Brass Finial Handle */}
          <div className="flex items-center shrink-0 z-10">
            <div
              className="w-2.5 h-9 sm:h-10 rounded-r-md border border-[#d8be8a] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #e2c992 0%, #a88648 50%, #5e441e 100%)',
              }}
            />
            <div
              className="w-1.5 h-6 border-y border-[#b89758]"
              style={{
                background: 'linear-gradient(180deg, #3b2212 0%, #1c0f07 100%)',
              }}
            />
            <div
              className="w-2.5 h-3.5 rounded-r-full border border-[#c8a96e]"
              style={{
                background: 'linear-gradient(180deg, #6e472b 0%, #3d2312 55%, #1f1007 100%)',
              }}
            />
          </div>
        </motion.div>
      ) : (
        /* OPENED / UNROLLED MEDIEVAL CREAM PARCHMENT BANNER */
        <motion.div
          initial={{ width: '18%', opacity: 0.5 }}
          animate={{ width: '100%', opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-11 sm:h-12 flex items-center justify-between overflow-hidden"
        >
          <div
            className="h-full w-3.5 rounded-l-md border border-[#c8a96e] shrink-0 z-10"
            style={{
              background: 'linear-gradient(90deg, #5c3a21 0%, #d8be8a 50%, #6e472b 100%)',
            }}
          />
          <div
            className="flex-1 h-10 sm:h-11 border-y border-[#bfa36f] px-3 flex items-center justify-between gap-2 min-w-0 relative overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #d8c398 0%, #f5ebd6 50%, #d8c398 100%)',
            }}
          >
            <span className="px-2.5 py-0.5 rounded bg-[#23170d] border border-[#b89758] text-[#f5ebd6] font-mono font-black text-[10px] truncate">
              GULUNGAN TERBUKA • {rollNumber}
            </span>
            <span className="text-[10px] font-mono text-[#3d2514] font-extrabold shrink-0 hidden sm:inline">
              Layar Penuh Aktif
            </span>
          </div>
          <div
            className="h-full w-3.5 rounded-r-md border border-[#c8a96e] shrink-0 z-10"
            style={{
              background: 'linear-gradient(270deg, #5c3a21 0%, #d8be8a 50%, #6e472b 100%)',
            }}
          />
        </motion.div>
      )}
    </div>
  );
};

interface FullScreenScrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  rollNumber: string;
  recipeName: string;
  targetFactory: string;
  formattedDate: string;
  badgeText?: string;
  children: React.ReactNode;
}

/**
 * Full-Screen Old Medieval Cream Paper Scroll Modal
 * Matches the scroll unrolling animation from https://www.youtube.com/shorts/GJLmQ5SQtio:
 * - Natural cream medieval parchment color (#f4ead2 / #e7d6b3 / #cbb282) with turned dark wood
 *   spindle handles on the left & right ends of the top & bottom rollers.
 * - Crystal-clear single-line top roller crest (never clipped or wrapped).
 * - Clean bottom scroll roller (no duplicate close button at the bottom).
 */
export const FullScreenScrollModal: React.FC<FullScreenScrollModalProps> = ({
  isOpen,
  onClose,
  rollNumber,
  recipeName,
  targetFactory,
  formattedDate,
  badgeText,
  children,
}) => {
  const [replayKey, setReplayKey] = useState(0);
  const [isRollingUp, setIsRollingUp] = useState(false);

  const handleTriggerClose = () => {
    if (isRollingUp) return;
    setIsRollingUp(true);
    window.setTimeout(() => {
      setIsRollingUp(false);
      onClose();
    }, 540);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isRollingUp ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: isRollingUp ? 0.25 : 0.2,
            delay: isRollingUp ? 0.32 : 0,
          }}
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col items-center justify-center safe-fullscreen-modal sm:p-3 md:p-5 overflow-hidden"
        >
          {/* Animated Unrolling & Rolling-Shut Medieval Scroll Container */}
          <motion.div
            key={replayKey}
            initial={{ scaleY: 0.03, opacity: 0.75 }}
            animate={
              isRollingUp
                ? { scaleY: 0.035, opacity: 0.18 }
                : { scaleY: 1, opacity: 1 }
            }
            exit={{ scaleY: 0.03, opacity: 0 }}
            transition={{
              duration: isRollingUp ? 0.52 : 0.65,
              ease: isRollingUp ? [0.4, 0, 0.2, 1] : [0.16, 1, 0.3, 1],
            }}
            style={{ transformOrigin: '50% 50%' }}
            className="w-full max-w-[1440px] h-full max-h-full flex flex-col justify-between relative"
          >
            {/* TOP MEDIEVAL PARCHMENT SCROLL ROLLER ROD (Natural Cream Rolled Parchment + Walnut Wood Finials) */}
            <div className="w-full flex items-center shrink-0 z-20 select-none">
              {/* Left Turned Walnut Wood & Brass Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-l-full border border-[#c8a96e] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #754c2e 0%, #3e2413 55%, #1c0f07 100%)',
                  }}
                />
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#d4b87e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #e5ce9a 0%, #9c7a3e 50%, #4a3314 100%)',
                  }}
                />
              </div>

              {/* Main Top Cylindrical Rolled Cream Parchment Bar — Generous Height & Crystal-Clear Single Line */}
              <div
                className="flex-1 h-8 sm:h-9 rounded-md border-2 border-[#bfa36f] shadow-[0_10px_24px_rgba(0,0,0,0.92),inset_0_2px_6px_rgba(255,252,242,0.85)] relative overflow-hidden flex items-center justify-between px-3 sm:px-5 gap-2"
                style={{
                  background:
                    'linear-gradient(180deg, #c7ad7c 0%, #f7efe0 30%, #ede0c5 65%, #b59763 100%)',
                }}
              >
                {/* Subtle vertical parchment roll creases */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(74,44,24,0.3) 0px, rgba(74,44,24,0.3) 1px, transparent 1px, transparent 18px)',
                  }}
                />
                <div className="absolute inset-x-0 top-1 h-[1px] bg-white/75 pointer-events-none" />

                {/* Left Label on Top Roller: Clear Dark Espresso Ink on Cream Parchment */}
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 z-10">
                  <span className="w-2 h-2 rounded-full bg-[#3d2312] border border-[#8c673a] shrink-0" />
                  <span className="text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider text-[#26160a] truncate">
                    {rollNumber}
                    <span className="hidden sm:inline"> • GULUNGAN TEMBAKAU</span>
                  </span>
                </div>

                {/* Right Badge on Top Roller: Single-line Pill, Never Wraps or Clips */}
                {badgeText && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#26160a] text-[#f5ebd6] border border-[#8c673a] text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider whitespace-nowrap shrink-0 z-10 shadow-xs">
                    {badgeText}
                  </span>
                )}
              </div>

              {/* Right Turned Walnut Wood & Brass Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#d4b87e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #e5ce9a 0%, #9c7a3e 50%, #4a3314 100%)',
                  }}
                />
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-r-full border border-[#c8a96e] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #754c2e 0%, #3e2413 55%, #1c0f07 100%)',
                  }}
                />
              </div>
            </div>

            {/* UNROLLED MEDIEVAL PARCHMENT SCROLL BODY (Natural Cream Vellum Frame + High-Contrast Workspace) */}
            <div
              className="flex-1 min-h-0 mx-1.5 sm:mx-4 border-x-4 sm:border-x-[6px] border-[#cbb282] shadow-[inset_0_14px_24px_rgba(0,0,0,0.85),inset_0_-14px_24px_rgba(0,0,0,0.85),0_0_45px_rgba(235,220,185,0.14)] flex flex-col overflow-hidden relative"
              style={{
                background:
                  'linear-gradient(90deg, #d8c398 0%, #f3e7ce 1.5%, #09090b 1.5%, #09090b 98.5%, #f3e7ce 98.5%, #d8c398 100%)',
              }}
            >
              {/* Unfurling / Rolling-Up Content Fade */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={
                  isRollingUp
                    ? { opacity: 0, y: -18 }
                    : { opacity: 1, y: 0 }
                }
                transition={{
                  delay: isRollingUp ? 0 : 0.22,
                  duration: isRollingUp ? 0.22 : 0.35,
                }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden px-1 sm:px-2"
              >
                {/* Sticky Medieval Cream Parchment Banner Header */}
                <div
                  className="px-3.5 sm:px-6 py-3 border-b-2 border-[#bfa36f] flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #f5ebd6 0%, #ead9b7 100%)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2.5 py-1 rounded-lg bg-[#23170d] text-[#f5ebd6] border border-[#8c673a] font-mono font-black text-xs sm:text-sm shadow-sm shrink-0">
                      {rollNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-black text-[#1f1309] text-sm sm:text-lg md:text-xl truncate">
                          {recipeName}
                        </h2>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] sm:text-xs text-[#4a321c] font-semibold mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-[#6e472b] shrink-0" />
                          Pabrik: <b className="text-[#1f1309] font-black">{targetFactory}</b>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#3d2514] font-mono font-bold">
                          <Calendar className="w-3.5 h-3.5 text-[#6e472b] shrink-0" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Controls: Replay Scroll Unroll & Primary Close Button with Roll-Up Animation */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isRollingUp}
                      onClick={() => setReplayKey((k) => k + 1)}
                      className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#23170d] hover:bg-[#352315] text-[#f5ebd6] border border-[#8c673a] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                      title="Putar ulang animasi membuka gulungan kertas"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#e8cf9c] shrink-0" />
                      <span className="hidden sm:inline">Animasi Gulungan</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRollingUp}
                      onClick={handleTriggerClose}
                      className="h-9 px-3.5 sm:px-4 rounded-xl bg-black hover:bg-zinc-900 text-amber-400 border-2 border-[#23170d] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-75"
                      aria-label="Tutup gulungan layar penuh"
                    >
                      <span>{isRollingUp ? 'Menggulung...' : 'Tutup Gulungan'}</span>
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Full-Screen Content Area */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
                  {children}
                </div>
              </motion.div>
            </div>

            {/* BOTTOM MEDIEVAL PARCHMENT SCROLL ROLLER ROD (Clean Rolled Cream Cylinder — No Duplicate Close Button) */}
            <div className="w-full flex items-center shrink-0 z-20 select-none">
              {/* Left Turned Walnut Wood & Brass Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-l-full border border-[#c8a96e] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #754c2e 0%, #3e2413 55%, #1c0f07 100%)',
                  }}
                />
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#d4b87e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #e5ce9a 0%, #9c7a3e 50%, #4a3314 100%)',
                  }}
                />
              </div>

              {/* Main Bottom Cylindrical Rolled Cream Parchment Bar */}
              <div
                className="flex-1 h-7 sm:h-8 rounded-md border-2 border-[#bfa36f] shadow-[0_-10px_24px_rgba(0,0,0,0.92),inset_0_2px_6px_rgba(255,252,242,0.8)] relative overflow-hidden flex items-center justify-center px-4"
                style={{
                  background:
                    'linear-gradient(180deg, #b59763 0%, #f5ebd6 40%, #e8d7b4 70%, #9e804e 100%)',
                }}
              >
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(74,44,24,0.3) 0px, rgba(74,44,24,0.3) 1px, transparent 1px, transparent 18px)',
                  }}
                />
                <span className="text-[10px] font-mono font-extrabold text-[#2b1a0e] uppercase tracking-widest truncate z-10">
                  {recipeName} • {targetFactory} • {formattedDate}
                </span>
              </div>

              {/* Right Turned Walnut Wood & Brass Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#d4b87e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #e5ce9a 0%, #9c7a3e 50%, #4a3314 100%)',
                  }}
                />
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-r-full border border-[#c8a96e] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #754c2e 0%, #3e2413 55%, #1c0f07 100%)',
                  }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
