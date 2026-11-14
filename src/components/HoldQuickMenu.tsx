import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  computeRadialWheelNodes,
  resolveRadialOptionByVector,
} from '../utils/tobaccoCompleteness';

export interface HoldQuickDetailRow {
  label: string;
  value: string;
  tone?: 'emerald' | 'rose' | 'amber' | 'zinc' | 'white';
}

export interface HoldQuickOption {
  id: string;
  label: string;
  shortLabel?: string;
  sublabel?: string;
  detailRows?: HoldQuickDetailRow[];
  actionHint?: string;
  icon: React.ReactNode;
  isMissing?: boolean;
  missingLabel?: string;
  tone?: 'amber' | 'rose' | 'emerald' | 'zinc';
}

interface ActiveHoldMenuState {
  anchorX: number;
  anchorY: number;
  title: string;
  subtitle?: string;
  options: HoldQuickOption[];
  onSelect: (optionId: string) => void;
}

interface HoldQuickMenuOverlayProps {
  menu: ActiveHoldMenuState | null;
  hoveredOptionId: string | null;
  onSelectOption: (optionId: string) => void;
  onClose: () => void;
}

const CLUSTER_SPAN_PX = 276;
const CLUSTER_HALF_PX = CLUSTER_SPAN_PX / 2;
const ORBIT_RADIUS_PX = 94;
const NODE_DIAMETER_PX = 72;
const CORE_DIAMETER_PX = 84;

export function getClampedWheelCenter(anchorX: number, anchorY: number) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  // Ensure the 310px-wide detail panel and 276px cluster never clip horizontally or vertically
  const padX = Math.max(CLUSTER_HALF_PX + 24, 170);
  const topPad = CLUSTER_HALF_PX + 165;
  const bottomPad = CLUSTER_HALF_PX + 28;
  return {
    centerX: Math.max(padX, Math.min(anchorX, vw - padX)),
    centerY: Math.max(topPad, Math.min(anchorY, vh - bottomPad)),
  };
}

function getShortRadialLabel(opt: HoldQuickOption): string {
  if (opt.shortLabel) return opt.shortLabel;
  const lower = opt.label.toLowerCase();
  if (lower.includes('timbangan')) return 'Timbangan';
  if (lower.includes('harga')) return 'Harga / KG';
  if (lower.includes('atribut') || lower.includes('grade')) return '6 Atribut';
  if (lower.includes('penjual') || lower.includes('kemasan')) return 'Info & Kms';
  if (lower.includes('racikan')) return 'Ke Racikan';
  if (lower.includes('diterima') || lower.includes('accepted')) return 'Diterima';
  if (lower.includes('reject')) return 'Reject';
  if (lower.includes('lengkap')) return 'Edit Semua';

  const cleaned = opt.label
    .replace(/^Isi\s+/i, '')
    .replace(/^Edit\s+/i, '')
    .replace(/^Tandai\s+/i, '')
    .replace(/\s*\/.*$/, '')
    .replace(/\s*\(.*\)$/, '')
    .trim();
  if (cleaned.length <= 12) return cleaned;
  return `${cleaned.slice(0, 11)}…`;
}

export const HoldQuickMenuOverlay: React.FC<HoldQuickMenuOverlayProps> = ({
  menu,
  hoveredOptionId,
  onSelectOption,
  onClose,
}) => {
  useEffect(() => {
    if (!menu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menu, onClose]);

  if (!menu) return null;

  const { centerX, centerY } = getClampedWheelCenter(menu.anchorX, menu.anchorY);
  const clusterLeft = centerX - CLUSTER_HALF_PX;
  const clusterTop = centerY - CLUSTER_HALF_PX;

  const nodes = computeRadialWheelNodes(
    menu.options.map((o) => o.id),
    ORBIT_RADIUS_PX
  );
  const hoveredOption = menu.options.find((o) => o.id === hoveredOptionId) || null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-[3px] touch-none select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Menu Edit Cepat ${menu.title}`}
      >
        {/* Floating Mindmap Cluster (NO big outer circle, NO connecting lines) */}
        <div
          style={{
            left: clusterLeft,
            top: clusterTop,
            width: CLUSTER_SPAN_PX,
            height: CLUSTER_SPAN_PX,
          }}
          onClick={(e) => e.stopPropagation()}
          className="fixed flex items-center justify-center pointer-events-none"
        >
          {/* Floating Inspector / Detail Panel above the Mindmap when hovering a circle */}
          <div
            style={{
              bottom: CLUSTER_SPAN_PX + 10,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 312,
            }}
            className="absolute flex flex-col items-center justify-end pointer-events-none z-30"
          >
            {hoveredOption ? (
              <div
                key={hoveredOption.id}
                data-testid="hold-quick-detail-panel"
                style={{ backgroundColor: '#050507' }}
                className={`w-full rounded-2xl border-2 px-3.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.98)] transition-colors duration-150 ${
                  hoveredOption.isMissing
                    ? 'border-rose-500 shadow-[0_12px_36px_rgba(244,63,94,0.35)]'
                    : 'border-emerald-500 shadow-[0_12px_36px_rgba(16,185,129,0.35)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-zinc-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border ${
                        hoveredOption.isMissing
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/70'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/70'
                      }`}
                    >
                      {hoveredOption.icon}
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      {hoveredOption.label}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 border ${
                      hoveredOption.isMissing
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/70'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/70'
                    }`}
                  >
                    {hoveredOption.isMissing
                      ? hoveredOption.missingLabel || 'Belum Diisi'
                      : 'Sudah Terisi'}
                  </span>
                </div>

                {hoveredOption.detailRows && hoveredOption.detailRows.length > 0 ? (
                  <div className="space-y-1">
                    {hoveredOption.detailRows.map((row, rIdx) => {
                      const valColor =
                        row.tone === 'rose'
                          ? 'text-rose-400 font-black'
                          : row.tone === 'emerald'
                            ? 'text-emerald-400 font-black'
                            : row.tone === 'amber'
                              ? 'text-amber-400 font-black'
                              : 'text-white font-bold';
                      return (
                        <div
                          key={rIdx}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-zinc-300 truncate">{row.label}</span>
                          <span className={`font-mono text-right truncate max-w-[185px] ${valColor}`}>
                            {row.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-zinc-200 py-0.5">
                    {hoveredOption.sublabel || 'Lepas jari/kursor untuk membuka bagian ini.'}
                  </div>
                )}

                <div className="mt-1.5 pt-1 border-t border-zinc-800/90 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-zinc-300 truncate max-w-[180px]">
                    {menu.title}
                  </span>
                  <span
                    className={`font-black uppercase tracking-wider ${
                      hoveredOption.isMissing ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {hoveredOption.actionHint || 'Lepas → Buka'}
                  </span>
                </div>
              </div>
            ) : (
              <div
                key="idle-pill"
                style={{ backgroundColor: '#050507' }}
                className="px-4 py-1.5 rounded-full border border-amber-500/50 shadow-2xl flex items-center justify-center max-w-[280px]"
              >
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                  {menu.title}
                </span>
              </div>
            )}
          </div>

          {/* Core Mindmap Center Node ("GESER / PILIH") */}
          <motion.button
            type="button"
            data-testid="hold-quick-core"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: hoveredOption ? 0.95 : 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            aria-label="Tutup Menu Cepat"
            style={{
              width: CORE_DIAMETER_PX,
              height: CORE_DIAMETER_PX,
              backgroundColor: '#060608',
            }}
            className={`relative z-20 pointer-events-auto rounded-full border-2 flex flex-col items-center justify-center text-center px-2 transition-colors cursor-pointer ${
              hoveredOption
                ? hoveredOption.isMissing
                  ? 'border-rose-400 shadow-[0_0_28px_rgba(244,63,94,0.45)]'
                  : 'border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.45)]'
                : 'hover:bg-zinc-900 border-amber-500/85 shadow-[0_0_30px_rgba(245,158,11,0.28)]'
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-200 mb-0.5">
              <X className="w-3 h-3" />
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 leading-tight">
              {hoveredOption ? 'Lepas' : 'Geser'}
            </span>
            <span className="text-[8px] font-bold text-zinc-200 leading-tight mt-0.5 truncate max-w-[68px]">
              {hoveredOption ? getShortRadialLabel(hoveredOption) : 'Pilih Opsi'}
            </span>
          </motion.button>

          {/* Mindmap Satellite Circles: Bloom outward from center core, Green outline if filled, Red outline if blank */}
          {menu.options.map((opt, idx) => {
            const node = nodes[idx];
            const isHovered = hoveredOptionId === opt.id;
            const shortLabel = getShortRadialLabel(opt);
            const isBlank = !!opt.isMissing;

            const ringStyle = isBlank
              ? isHovered
                ? 'text-white border-rose-300 ring-4 ring-rose-500/50 shadow-[0_0_32px_rgba(244,63,94,0.9)]'
                : 'text-white border-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.35)] hover:border-rose-400'
              : isHovered
                ? 'text-white border-emerald-300 ring-4 ring-emerald-500/50 shadow-[0_0_32px_rgba(16,185,129,0.9)]'
                : 'text-white border-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.28)] hover:border-emerald-400';

            const iconStyle = isBlank
              ? isHovered
                ? 'bg-rose-500/35 text-rose-200 border border-rose-400/70'
                : 'bg-rose-500/15 text-rose-400'
              : isHovered
                ? 'bg-emerald-500/35 text-emerald-200 border border-emerald-400/70'
                : 'bg-emerald-500/15 text-emerald-400';

            return (
              <motion.button
                key={opt.id}
                type="button"
                data-testid={`hold-quick-option-${opt.id}`}
                data-hold-option-id={opt.id}
                aria-label={`${opt.label} ${opt.sublabel || ''} ${isBlank ? (opt.missingLabel || 'Belum Diisi') : 'Sudah Terisi'}`.trim()}
                onClick={() => onSelectOption(opt.id)}
                initial={{
                  x: -node.offsetX * 0.65,
                  y: -node.offsetY * 0.65,
                  scale: 0.35,
                  opacity: 0,
                }}
                animate={{
                  x: 0,
                  y: 0,
                  scale: isHovered ? 1.14 : 1,
                  opacity: 1,
                }}
                exit={{
                  x: -node.offsetX * 0.5,
                  y: -node.offsetY * 0.5,
                  scale: 0.35,
                  opacity: 0,
                }}
                transition={{
                  duration: 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  width: NODE_DIAMETER_PX,
                  height: NODE_DIAMETER_PX,
                  left: CLUSTER_HALF_PX + node.offsetX - NODE_DIAMETER_PX / 2,
                  top: CLUSTER_HALF_PX + node.offsetY - NODE_DIAMETER_PX / 2,
                  backgroundColor: isHovered
                    ? isBlank
                      ? '#2b0912'
                      : '#06281e'
                    : '#060608',
                }}
                className={`absolute z-20 pointer-events-auto rounded-full border-2 flex flex-col items-center justify-center text-center px-1.5 transition-colors cursor-pointer ${ringStyle}`}
              >
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mb-1 ${iconStyle}`}
                >
                  {opt.icon}
                </span>

                <span className="text-[10px] font-black leading-none tracking-tight whitespace-nowrap text-white">
                  {shortLabel}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

interface UseHoldDragMenuReturn {
  activeMenu: ActiveHoldMenuState | null;
  hoveredOptionId: string | null;
  isHoldingProgressId: string | null;
  bindHoldHandlers: (config: {
    id: string;
    title: string;
    subtitle?: string;
    options: HoldQuickOption[];
    onSelect: (optionId: string) => void;
    holdDelayMs?: number;
  }) => {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
  openMenuImmediate: (config: {
    anchorEl?: HTMLElement | null;
    title: string;
    subtitle?: string;
    options: HoldQuickOption[];
    onSelect: (optionId: string) => void;
  }) => void;
  closeMenu: () => void;
  selectOption: (optionId: string) => void;
  consumeRecentHoldFlag: () => boolean;
}

/**
 * Provides smooth Press-Hold-and-Drag floating mindmap radial interactions:
 * - Press & hold >= 260ms (without dragging > 12px) blooms the mindmap around the pointer.
 * - Dragging 24px+ in any direction from the core (or hovering over a satellite node) highlights that node
 *   and reveals its full detail card above the mindmap.
 * - Releasing over a highlighted option immediately fires `onSelect(optionId)`.
 */
export function useHoldDragMenu(): UseHoldDragMenuReturn {
  const [activeMenu, setActiveMenu] = useState<ActiveHoldMenuState | null>(null);
  const [hoveredOptionId, setHoveredOptionId] = useState<string | null>(null);
  const [isHoldingProgressId, setIsHoldingProgressId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const activeMenuRef = useRef<ActiveHoldMenuState | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const justCompletedHoldRef = useRef<boolean>(false);

  useEffect(() => {
    activeMenuRef.current = activeMenu;
  }, [activeMenu]);

  useEffect(() => {
    hoveredIdRef.current = hoveredOptionId;
  }, [hoveredOptionId]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsHoldingProgressId(null);
  };

  const closeMenu = () => {
    clearTimer();
    setActiveMenu(null);
    setHoveredOptionId(null);
  };

  const selectOption = (optionId: string) => {
    const current = activeMenuRef.current;
    closeMenu();
    if (current) {
      current.onSelect(optionId);
    }
  };

  const detectOptionAtPoint = (clientX: number, clientY: number): string | null => {
    const currentMenu = activeMenuRef.current;
    if (!currentMenu) return null;

    const { centerX, centerY } = getClampedWheelCenter(
      currentMenu.anchorX,
      currentMenu.anchorY
    );
    const distFromCenter = Math.hypot(clientX - centerX, clientY - centerY);
    if (distFromCenter < 38) {
      return null;
    }

    if (typeof document !== 'undefined') {
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const optionEl = el?.closest?.('[data-hold-option-id]') as HTMLElement | null;
      const directId = optionEl?.getAttribute('data-hold-option-id');
      if (directId) return directId;
    }

    return resolveRadialOptionByVector({
      clientX,
      clientY,
      centerX,
      centerY,
      optionIds: currentMenu.options.map((o) => o.id),
      minDeadzonePx: 38,
      maxOuterRadiusPx: 170,
    });
  };

  useEffect(() => {
    if (!activeMenu) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (e.buttons === 0 && e.pointerType === 'mouse' && !justCompletedHoldRef.current) {
        const hoverId = detectOptionAtPoint(e.clientX, e.clientY);
        if (hoverId !== hoveredIdRef.current) {
          setHoveredOptionId(hoverId);
        }
        return;
      }
      const optId = detectOptionAtPoint(e.clientX, e.clientY);
      if (optId !== hoveredIdRef.current) {
        if (optId && typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(8);
        }
        setHoveredOptionId(optId);
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      const optId = detectOptionAtPoint(e.clientX, e.clientY) || hoveredIdRef.current;
      if (justCompletedHoldRef.current && optId && activeMenuRef.current) {
        justCompletedHoldRef.current = false;
        const cb = activeMenuRef.current.onSelect;
        closeMenu();
        cb(optId);
      } else {
        justCompletedHoldRef.current = false;
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [activeMenu]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const bindHoldHandlers = (config: {
    id: string;
    title: string;
    subtitle?: string;
    options: HoldQuickOption[];
    onSelect: (optionId: string) => void;
    holdDelayMs?: number;
  }) => {
    const delay = config.holdDelayMs ?? 260;

    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button === 2) return;
        const targetEl = e.target as HTMLElement | null;
        if (
          targetEl?.closest('input, select, textarea, [data-no-card-hold="true"]')
        ) {
          return;
        }

        clearTimer();
        startPosRef.current = { x: e.clientX, y: e.clientY };
        setIsHoldingProgressId(config.id);
        const anchorX = e.clientX;
        const anchorY = e.clientY;

        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setIsHoldingProgressId(null);
          justCompletedHoldRef.current = true;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(18);
          }
          setHoveredOptionId(null);
          setActiveMenu({
            anchorX,
            anchorY,
            title: config.title,
            subtitle: config.subtitle,
            options: config.options,
            onSelect: config.onSelect,
          });
        }, delay);
      },

      onPointerMove: (e: React.PointerEvent) => {
        if (timerRef.current !== null && startPosRef.current) {
          const dx = e.clientX - startPosRef.current.x;
          const dy = e.clientY - startPosRef.current.y;
          if (Math.hypot(dx, dy) > 12) {
            clearTimer();
          }
        }
      },

      onPointerUp: () => {
        clearTimer();
        window.setTimeout(() => {
          justCompletedHoldRef.current = false;
        }, 80);
      },

      onPointerCancel: () => {
        clearTimer();
      },

      onContextMenu: (e: React.MouseEvent) => {
        if (isHoldingProgressId === config.id || activeMenuRef.current) {
          e.preventDefault();
        }
      },
    };
  };

  const openMenuImmediate = (config: {
    anchorEl?: HTMLElement | null;
    title: string;
    subtitle?: string;
    options: HoldQuickOption[];
    onSelect: (optionId: string) => void;
  }) => {
    clearTimer();
    const cardEl =
      (config.anchorEl?.closest('.requiem-card') as HTMLElement | null) ||
      config.anchorEl;
    const rect = cardEl?.getBoundingClientRect();
    const anchorX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const anchorY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    justCompletedHoldRef.current = false;
    setHoveredOptionId(null);
    setActiveMenu({
      anchorX,
      anchorY,
      title: config.title,
      subtitle: config.subtitle,
      options: config.options,
      onSelect: config.onSelect,
    });
  };

  const consumeRecentHoldFlag = () => {
    if (justCompletedHoldRef.current) {
      justCompletedHoldRef.current = false;
      return true;
    }
    return false;
  };

  return {
    activeMenu,
    hoveredOptionId,
    isHoldingProgressId,
    bindHoldHandlers,
    openMenuImmediate,
    closeMenu,
    selectOption,
    consumeRecentHoldFlag,
  };
}
