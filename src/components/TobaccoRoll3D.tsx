import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Building2, Scroll } from 'lucide-react';

interface TobaccoRoll3DProps {
  isOpen?: boolean;
  rollNumber: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 3D Natural Cured Tobacco-Leaf & Roasted Walnut Scroll (Gulungan Tembakau)
 * Uses cohesive warm dark tobacco-umber, roasted walnut wood (#2d1d12 / #3e2818 / #1c110a),
 * and antique bronze-amber trim (#8c6434 / #b88748) so the outside scroll and inside workspace
 * blend naturally without any harsh white-vs-black contrast.
 */
export const TobaccoRoll3D: React.FC<TobaccoRoll3DProps> = ({
  isOpen = false,
  rollNumber,
  size = 'md',
}) => {
  const heightClass = size === 'sm' ? 'h-14' : size === 'lg' ? 'h-20' : 'h-16';

  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl bg-gradient-to-b from-[#140e0a] via-[#0c0907] to-[#140e0a] border border-[#3d2916]/90 overflow-hidden flex items-center justify-center px-2.5 select-none`}
      style={{ perspective: '900px' }}
    >
      {/* Subtle warm roasted tobacco-leaf ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(180,125,60,0.14),transparent_72%)] pointer-events-none" />

      {!isOpen ? (
        /* CLOSED NATURAL ROASTED TOBACCO & WALNUT SCROLL */
        <motion.div
          initial={{ rotateX: 10, scale: 0.98 }}
          animate={{ rotateX: 4, scale: 1 }}
          whileHover={{ rotateX: 0, scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative w-full max-w-[310px] h-9 sm:h-10 flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Left Turned Walnut Wood & Antique Bronze Handle */}
          <div className="flex items-center shrink-0 z-10">
            <div
              className="w-2.5 h-3.5 rounded-l-full border border-[#8c6434]"
              style={{
                background: 'linear-gradient(180deg, #59381f 0%, #331e0f 55%, #170d06 100%)',
              }}
            />
            <div
              className="w-1.5 h-6 border-y border-[#785328]"
              style={{
                background: 'linear-gradient(180deg, #2e1b0e 0%, #140b05 100%)',
              }}
            />
            <div
              className="w-2.5 h-9 sm:h-10 rounded-l-md border border-[#9e733e] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #b8894a 0%, #7d5829 50%, #422c12 100%)',
              }}
            />
          </div>

          {/* Rolled Natural Maduro Tobacco-Leaf & Warm Sepia Cylinder Body */}
          <div
            className="flex-1 h-8 sm:h-9 border-y border-[#7c582d] relative overflow-hidden flex items-center justify-between px-3 shadow-[0_8px_18px_rgba(0,0,0,0.9),inset_0_1px_4px_rgba(215,165,100,0.28)]"
            style={{
              background:
                'linear-gradient(180deg, #2a1b10 0%, #462e1b 35%, #382415 68%, #1e130b 100%)',
            }}
          >
            {/* Subtle natural tobacco leaf & rolled grain lines */}
            <div
              className="absolute inset-0 opacity-25 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(18,10,5,0.45) 0px, rgba(18,10,5,0.45) 1px, transparent 1px, transparent 9px)',
              }}
            />
            <div className="absolute inset-x-0 top-1 h-[1px] bg-[#c89b5a]/30 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-1 h-[1px] bg-black/50 pointer-events-none" />

            {/* Left Twine Binding */}
            <div
              className="w-1.5 h-full z-10 shrink-0 shadow-xs"
              style={{
                background: 'linear-gradient(180deg, #8a5a2b 0%, #5c3a1a 50%, #2e1b0b 100%)',
              }}
            />

            {/* Center Label */}
            <div className="relative z-10 px-2.5 py-0.5 rounded-md bg-[#120b07]/95 border border-[#8c6434] text-[10px] font-mono font-black text-[#f3e3c3] tracking-wider shadow-md truncate flex items-center gap-1.5">
              <Scroll className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{rollNumber}</span>
            </div>

            {/* Right Twine Binding */}
            <div
              className="w-1.5 h-full z-10 shrink-0 shadow-xs"
              style={{
                background: 'linear-gradient(180deg, #8a5a2b 0%, #5c3a1a 50%, #2e1b0b 100%)',
              }}
            />
          </div>

          {/* Right Turned Walnut Wood & Antique Bronze Handle */}
          <div className="flex items-center shrink-0 z-10">
            <div
              className="w-2.5 h-9 sm:h-10 rounded-r-md border border-[#9e733e] shadow-md"
              style={{
                background: 'linear-gradient(180deg, #b8894a 0%, #7d5829 50%, #422c12 100%)',
              }}
            />
            <div
              className="w-1.5 h-6 border-y border-[#785328]"
              style={{
                background: 'linear-gradient(180deg, #2e1b0e 0%, #140b05 100%)',
              }}
            />
            <div
              className="w-2.5 h-3.5 rounded-r-full border border-[#8c6434]"
              style={{
                background: 'linear-gradient(180deg, #59381f 0%, #331e0f 55%, #170d06 100%)',
              }}
            />
          </div>
        </motion.div>
      ) : (
        /* OPENED / UNROLLED NATURAL WARM WALNUT & TOBACCO BANNER */
        <motion.div
          initial={{ width: '18%', opacity: 0.5 }}
          animate={{ width: '100%', opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full h-11 sm:h-12 flex items-center justify-between overflow-hidden"
        >
          <div
            className="h-full w-3.5 rounded-l-md border border-[#8c6434] shrink-0 z-10"
            style={{
              background: 'linear-gradient(90deg, #3b2413 0%, #9e733e 50%, #4a2e18 100%)',
            }}
          />
          <div
            className="flex-1 h-10 sm:h-11 border-y border-[#7c582d] px-3 flex items-center justify-between gap-2 min-w-0 relative overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #26180e 0%, #3b2616 50%, #26180e 100%)',
            }}
          >
            <span className="px-2.5 py-0.5 rounded bg-[#120b07] border border-[#8c6434] text-amber-400 font-mono font-black text-[10px] truncate">
              GULUNGAN TERBUKA • {rollNumber}
            </span>
            <span className="text-[10px] font-mono text-[#e5cfa3] font-extrabold shrink-0 hidden sm:inline">
              Layar Penuh Aktif
            </span>
          </div>
          <div
            className="h-full w-3.5 rounded-r-md border border-[#8c6434] shrink-0 z-10"
            style={{
              background: 'linear-gradient(270deg, #3b2413 0%, #9e733e 50%, #4a2e18 100%)',
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
 * Full-Screen Natural Dark Walnut & Aged Tobacco Scroll Modal
 * - Cohesive dark roasted walnut & tobacco-umber palette (#24170e / #1a110a / #110c08)
 *   so the outside rollers, header banner, and inside workspace look natural together.
 * - Removed the redundant "Animasi Gulungan" button.
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
  const [isRollingUp, setIsRollingUp] = useState(false);

  const handleTriggerClose = () => {
    if (isRollingUp) return;
    setIsRollingUp(true);
    window.setTimeout(() => {
      setIsRollingUp(false);
      onClose();
    }, 360);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isRollingUp ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: isRollingUp ? 0.22 : 0.18,
          }}
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col items-center justify-center safe-fullscreen-modal sm:p-3 md:p-5 overflow-hidden"
        >
          {/* Natural Dark Walnut & Tobacco Scroll Container */}
          <motion.div
            initial={{ scaleY: 0.08, opacity: 0.8 }}
            animate={
              isRollingUp
                ? { scaleY: 0.08, opacity: 0.15 }
                : { scaleY: 1, opacity: 1 }
            }
            exit={{ scaleY: 0.08, opacity: 0 }}
            transition={{
              duration: isRollingUp ? 0.34 : 0.45,
              ease: isRollingUp ? [0.4, 0, 0.2, 1] : [0.16, 1, 0.3, 1],
            }}
            style={{ transformOrigin: '50% 50%' }}
            className="w-full max-w-[1440px] h-full max-h-full flex flex-col justify-between relative"
          >
            {/* TOP NATURAL WALNUT & TOBACCO SCROLL ROLLER ROD */}
            <div className="w-full flex items-center shrink-0 z-20 select-none">
              {/* Left Turned Walnut Wood & Bronze Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-l-full border border-[#8c6434] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #59381f 0%, #331e0f 55%, #170d06 100%)',
                  }}
                />
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#9e733e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #b8894a 0%, #7d5829 50%, #3d2810 100%)',
                  }}
                />
              </div>

              {/* Main Top Cylindrical Dark Walnut & Maduro Tobacco Bar */}
              <div
                className="flex-1 h-8 sm:h-9 rounded-md border border-[#7c582d] shadow-[0_10px_24px_rgba(0,0,0,0.92),inset_0_1px_3px_rgba(215,165,100,0.25)] relative overflow-hidden flex items-center justify-between px-3 sm:px-5 gap-2"
                style={{
                  background:
                    'linear-gradient(180deg, #2b1c11 0%, #3f2919 38%, #2e1e12 72%, #1a1009 100%)',
                }}
              >
                <div
                  className="absolute inset-0 opacity-25 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(15,8,4,0.4) 0px, rgba(15,8,4,0.4) 1px, transparent 1px, transparent 18px)',
                  }}
                />
                <div className="absolute inset-x-0 top-0.5 h-[1px] bg-[#c89b5a]/25 pointer-events-none" />

                {/* Left Label on Top Roller */}
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 z-10">
                  <span className="w-2 h-2 rounded-full bg-amber-400 border border-[#8c673a] shrink-0" />
                  <span className="text-[10px] sm:text-xs font-mono font-black uppercase tracking-wider text-[#f3e3c3] truncate">
                    {rollNumber}
                    <span className="hidden sm:inline text-[#d4b886]"> • GULUNGAN TEMBAKAU</span>
                  </span>
                </div>

                {/* Right Badge on Top Roller */}
                {badgeText && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#140c07] text-amber-400 border border-[#7c582d] text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider whitespace-nowrap shrink-0 z-10 shadow-xs">
                    {badgeText}
                  </span>
                )}
              </div>

              {/* Right Turned Walnut Wood & Bronze Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#9e733e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #b8894a 0%, #7d5829 50%, #3d2810 100%)',
                  }}
                />
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-r-full border border-[#8c6434] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #59381f 0%, #331e0f 55%, #170d06 100%)',
                  }}
                />
              </div>
            </div>

            {/* UNROLLED NATURAL WARM ESPRESSO-WALNUT SCROLL BODY (Cohesive Inside & Outside) */}
            <div
              className="flex-1 min-h-0 mx-1.5 sm:mx-4 border-x-2 sm:border-x-4 border-[#5c3f20] shadow-[inset_0_12px_24px_rgba(0,0,0,0.85),inset_0_-12px_24px_rgba(0,0,0,0.85),0_0_40px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden relative"
              style={{
                background:
                  'linear-gradient(90deg, #24170d 0%, #160f0a 2%, #0c0907 6%, #0c0907 94%, #160f0a 98%, #24170d 100%)',
              }}
            >
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Sticky Natural Dark Tobacco-Walnut Banner Header */}
                <div
                  className="px-3.5 sm:px-6 py-3 border-b border-[#4d351b] flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #1f150d 0%, #140d08 100%)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0e0906] text-amber-400 border border-[#7c582d] font-mono font-black text-xs sm:text-sm shadow-sm shrink-0">
                      {rollNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-black text-[#f7ebd4] text-sm sm:text-lg md:text-xl truncate">
                          {recipeName}
                        </h2>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] sm:text-xs text-[#cbb389] font-semibold mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                          Pabrik: <b className="text-white font-black">{targetFactory}</b>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#dfd0b2] font-mono font-bold">
                          <Calendar className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Single Primary Close Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isRollingUp}
                      onClick={handleTriggerClose}
                      className="h-9 px-3.5 sm:px-4 rounded-xl bg-[#0e0906] hover:bg-[#291b10] text-amber-400 border border-[#8c6434] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md transition-colors disabled:opacity-75"
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
              </div>
            </div>

            {/* BOTTOM NATURAL WALNUT & TOBACCO SCROLL ROLLER ROD */}
            <div className="w-full flex items-center shrink-0 z-20 select-none">
              {/* Left Turned Walnut Wood & Bronze Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-l-full border border-[#8c6434] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #59381f 0%, #331e0f 55%, #170d06 100%)',
                  }}
                />
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#9e733e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #b8894a 0%, #7d5829 50%, #3d2810 100%)',
                  }}
                />
              </div>

              {/* Main Bottom Cylindrical Rolled Walnut & Tobacco Bar */}
              <div
                className="flex-1 h-7 sm:h-8 rounded-md border border-[#7c582d] shadow-[0_-10px_24px_rgba(0,0,0,0.92),inset_0_1px_3px_rgba(215,165,100,0.22)] relative overflow-hidden flex items-center justify-center px-4"
                style={{
                  background:
                    'linear-gradient(180deg, #24170e 0%, #3b2616 42%, #291a0f 75%, #160d07 100%)',
                }}
              >
                <div
                  className="absolute inset-0 opacity-25 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, rgba(15,8,4,0.4) 0px, rgba(15,8,4,0.4) 1px, transparent 1px, transparent 18px)',
                  }}
                />
                <span className="text-[10px] font-mono font-extrabold text-[#e5d1ac] uppercase tracking-widest truncate z-10">
                  {recipeName} • {targetFactory} • {formattedDate}
                </span>
              </div>

              {/* Right Turned Walnut Wood & Bronze Spindle Handle */}
              <div className="flex items-center shrink-0">
                <div
                  className="w-1.5 sm:w-2.5 h-6 sm:h-7 border-y border-[#9e733e]"
                  style={{
                    background:
                      'linear-gradient(180deg, #b8894a 0%, #7d5829 50%, #3d2810 100%)',
                  }}
                />
                <div
                  className="w-2.5 sm:w-4 h-4 sm:h-5 rounded-r-full border border-[#8c6434] shadow-md"
                  style={{
                    background:
                      'linear-gradient(180deg, #59381f 0%, #331e0f 55%, #170d06 100%)',
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
