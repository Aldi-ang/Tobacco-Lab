import React from 'react';
import { motion } from 'motion/react';

interface TobaccoRoll3DProps {
  isOpen?: boolean;
  rollNumber: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 3D Gulungan Tembakau (Indonesian Woven Mat & Shredded Tobacco Sample Roll)
 * - Closed state (`isOpen = false`): Renders a 3D cylindrical rolled bamboo/pandan mat
 *   with golden-brown shredded tobacco core visible at the ends and binding cords.
 * - Opened state (`isOpen = true`): Animates the 3D cylinder unrolling flat to reveal
 *   the golden-amber shredded kretek tobacco blend inside.
 */
export const TobaccoRoll3D: React.FC<TobaccoRoll3DProps> = ({
  isOpen = false,
  rollNumber,
  size = 'md',
}) => {
  const heightClass = size === 'sm' ? 'h-12' : size === 'lg' ? 'h-20' : 'h-14';

  return (
    <div
      className={`relative w-full ${heightClass} rounded-xl bg-gradient-to-b from-zinc-950 to-black border border-zinc-800/90 overflow-hidden flex items-center justify-center px-3 select-none`}
      style={{ perspective: '700px' }}
    >
      {/* Subtle ambient amber glow behind the 3D roll */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.16),transparent_70%)] pointer-events-none" />

      {!isOpen ? (
        /* CLOSED 3D CYLINDRICAL GULUNGAN TEMBAKAU */
        <motion.div
          initial={{ rotateX: 18, rotateY: -8, scale: 0.96 }}
          animate={{ rotateX: 12, rotateY: 0, scale: 1 }}
          whileHover={{ rotateX: 4, rotateY: 6, scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="relative w-full max-w-[240px] h-8 sm:h-9 flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Left Exposed Shredded Tobacco Core */}
          <div className="w-3.5 h-full rounded-l-full bg-gradient-to-b from-amber-700 via-amber-500 to-amber-900 border-y border-l border-amber-400/80 shadow-inner flex items-center justify-center z-10">
            <div className="w-1.5 h-3/5 rounded-full bg-amber-950/90 border border-amber-400/50" />
          </div>

          {/* Cylindrical Woven Bamboo/Tikar Body */}
          <div className="flex-1 h-full bg-gradient-to-b from-amber-950/90 via-zinc-900 to-black border-y border-amber-500/60 relative overflow-hidden flex items-center justify-between px-3 shadow-[0_6px_16px_rgba(0,0,0,0.9),inset_0_2px_6px_rgba(245,158,11,0.25)]">
            {/* Woven bamboo ribs texture */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(245,158,11,0.35) 0px, rgba(245,158,11,0.35) 2px, transparent 2px, transparent 8px)',
              }}
            />

            {/* Left Twine Cord */}
            <div className="w-1.5 h-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_6px_rgba(245,158,11,0.5)] z-10" />

            {/* Center Sample Tag on the Roll */}
            <div className="relative z-10 px-2 py-0.5 rounded bg-black/95 border border-amber-500/80 text-[9px] sm:text-[10px] font-mono font-black text-amber-400 tracking-wider shadow-md truncate">
              {rollNumber}
            </div>

            {/* Right Twine Cord */}
            <div className="w-1.5 h-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_6px_rgba(245,158,11,0.5)] z-10" />
          </div>

          {/* Right Spiral End Cap of the Cylinder */}
          <div className="w-4 h-full rounded-r-full bg-gradient-to-b from-amber-600 via-amber-400 to-amber-800 border border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)] flex items-center justify-center z-10">
            <div className="w-2 h-2 rounded-full border border-black bg-amber-950" />
          </div>
        </motion.div>
      ) : (
        /* OPENED / UNROLLED 3D GULUNGAN TEMBAKAU ANIMATION */
        <motion.div
          initial={{ width: '35%', rotateX: 35, opacity: 0.4 }}
          animate={{ width: '100%', rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full h-11 sm:h-12 rounded-lg bg-gradient-to-r from-amber-950/80 via-zinc-950 to-amber-950/80 border border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center justify-between px-3 overflow-hidden"
        >
          {/* Left Unrolled Scroll Edge */}
          <motion.div
            initial={{ x: 30 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-3 h-full rounded-l bg-gradient-to-b from-amber-500 via-amber-700 to-amber-950 border-r border-amber-400/70 shrink-0"
          />

          {/* Exposed Shredded Tobacco Blend Layer */}
          <div className="flex-1 px-2.5 sm:px-3 flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Animated tobacco leaf strands badge */}
              <motion.div
                initial={{ scale: 0.7, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.12, type: 'spring', stiffness: 300 }}
                className="px-2 py-0.5 rounded bg-black border border-amber-500 text-amber-400 font-mono font-black text-[10px] truncate shadow-[0_0_10px_rgba(245,158,11,0.3)]"
              >
                GULUNGAN TERBUKA • {rollNumber}
              </motion.div>
              <span className="text-[10px] sm:text-xs text-amber-200/90 font-semibold truncate hidden md:inline">
                Rajangan Sampel Tembakau Terbuka
              </span>
            </div>

            <span className="text-[10px] font-mono text-amber-400 font-bold shrink-0 hidden sm:inline">
              3D Sample Roll
            </span>
          </div>

          {/* Right Unrolled Scroll Edge */}
          <motion.div
            initial={{ x: -30 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-3 h-full rounded-r bg-gradient-to-b from-amber-500 via-amber-700 to-amber-950 border-l border-amber-400/70 shrink-0"
          />
        </motion.div>
      )}
    </div>
  );
};
