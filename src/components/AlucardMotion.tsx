import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Alucard Motion Primitives (sourced from A-Brain: emil-design-eng,
 * make-interfaces-feel-better, and Aldi's Framer Motion Picks #1 & #4).
 */
export const ALUCARD_EASE = [0.23, 1, 0.32, 1] as const;
export const ALUCARD_EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
export const ALUCARD_SPRING_SNAPPY = {
  type: 'spring' as const,
  duration: 0.28,
  bounce: 0,
};

interface OdometerNumberProps {
  value: string | number;
  className?: string;
}

/**
 * Framer Motion Pick #1: Rolling digit reel with tabular numerals.
 * Uses initial={false} so first page paint never jumps.
 */
export const OdometerNumber: React.FC<OdometerNumberProps> = ({ value, className = '' }) => {
  const str = String(value);
  return (
    <span className={`inline-flex items-baseline overflow-hidden tabular-nums ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={str}
          initial={{ y: '45%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-45%', opacity: 0 }}
          transition={{ duration: 0.24, ease: ALUCARD_EASE }}
          className="inline-block"
        >
          {str}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

interface MorphingIconProps {
  iconKey: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Contextual Icon Morph (make-interfaces-feel-better #7):
 * Smooth opacity + scale(0.25 -> 1) + subtle blur(4px -> 0) with zero bounce.
 */
export const MorphingIcon: React.FC<MorphingIconProps> = ({
  iconKey,
  children,
  className = 'inline-flex items-center justify-center',
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={iconKey}
        initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
        transition={ALUCARD_SPRING_SNAPPY}
        className={className}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
};

interface AlucardToastProps {
  message: string | null;
}

function isErrorLikeToast(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('gagal') ||
    lower.includes('error') ||
    lower.includes('ditolak') ||
    lower.includes('tidak dapat') ||
    lower.includes('kosong') ||
    lower.includes('invalid')
  );
}

/**
 * Framer Motion Pick #4: Toast in/out + self-drawing SVG checkmark on success.
 * Failure messages never display a checkmark (red edge + crisp X instead).
 */
export const AlucardToast: React.FC<AlucardToastProps> = ({ message }) => {
  const isError = message ? isErrorLikeToast(message) : false;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: ALUCARD_EASE }}
          className={`fixed bottom-16 md:bottom-5 right-4 z-[240] pointer-events-none max-w-[90vw] sm:max-w-md px-3.5 py-2.5 rounded-xl border backdrop-blur-md flex items-center gap-2.5 text-xs font-bold shadow-[0_14px_34px_rgba(0,0,0,0.85)] ${
            isError
              ? 'bg-[#120709]/95 border-red-500/75 text-red-100'
              : 'bg-[#0b0c10]/95 border-amber-500/70 text-zinc-100'
          }`}
        >
          {isError ? (
            <span className="w-5 h-5 rounded-lg bg-red-500/15 border border-red-500/60 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" className="w-3 h-3 text-red-400" fill="none">
                <motion.path
                  d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.24, ease: ALUCARD_EASE }}
                />
              </svg>
            </span>
          ) : (
            <span className="w-5 h-5 rounded-lg bg-amber-500/12 border border-amber-500/60 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-amber-400" fill="none">
                <motion.path
                  d="M3.5 8.5L6.5 11.5L12.5 4.8"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.34, delay: 0.05, ease: ALUCARD_EASE }}
                />
              </svg>
            </span>
          )}
          <span className="leading-snug">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
