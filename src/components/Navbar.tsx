import React, { useRef } from 'react';
import { motion } from 'motion/react';
import {
  Leaf,
  Scale,
  Package,
  Scroll,
  Calculator,
  Plus,
  Download,
  Upload,
  Warehouse,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Cloud,
  LogOut,
  CheckCircle2,
  Loader2,
  History,
  RefreshCw,
  AlertTriangle,
  Bot,
  Settings,
  Camera,
  Printer,
} from 'lucide-react';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';
import { CURRENT_APP_VERSION } from './PatchNotesModal';
import {
  OdometerNumber,
  MorphingIcon,
  ALUCARD_SPRING_SNAPPY,
} from './AlucardMotion';

export type ActiveTab =
  | 'inventory'
  | 'calculator'
  | 'finished'
  | 'rolls'
  | 'tara-simulator'
  | 'qc-status'
  | 'history'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  rawTobaccoCount: number;
  rejectedStockCount: number;
  pendingQcCount: number;
  totalNetStockKg: number;
  finishedCount: number;
  rollCount: number;
  onOpenMasterModal: () => void;
  onOpenSimulator?: () => void;
  isSimulatorOpen?: boolean;
  onOpenPatchNotes: () => void;
  hasUnreadPatch?: boolean;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenRestoreModal?: () => void;
  onResetData: () => void;
  userEmail?: string | null;
  cloudSyncStatus?: 'offline' | 'syncing' | 'synced' | 'error';
  onGoogleLogin?: () => void;
  onGoogleLogout?: () => void;
  onForceCloudSync?: () => void;
  onOpenNolanAgent?: () => void;
  onOpenGradeScanner?: (tab: 'scan' | 'print') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  rawTobaccoCount,
  rejectedStockCount,
  pendingQcCount,
  totalNetStockKg,
  finishedCount,
  rollCount,
  onOpenMasterModal,
  onOpenSimulator,
  isSimulatorOpen = false,
  onOpenPatchNotes,
  hasUnreadPatch = false,
  onExportData,
  onImportData,
  onOpenRestoreModal,
  onResetData,
  userEmail = null,
  cloudSyncStatus = 'offline',
  onGoogleLogin,
  onGoogleLogout,
  onForceCloudSync,
  onOpenNolanAgent,
  onOpenGradeScanner,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: {
    id: ActiveTab;
    shortLabel: string;
    mobileLabel: string;
    fullLabel: string;
    icon: React.ReactNode;
    countText?: string;
    desktopFlexClass?: string;
  }[] = [
    {
      id: 'inventory',
      shortLabel: 'Stok',
      mobileLabel: 'Stok',
      fullLabel: 'Stok Tembakau (Mentah & Jadi Eks-Reject)',
      icon: <Leaf className="w-4 h-4 shrink-0" />,
      countText: `${rawTobaccoCount + rejectedStockCount}`,
      desktopFlexClass: 'flex-[1]',
    },
    {
      id: 'calculator',
      shortLabel: 'Racikan',
      mobileLabel: 'Racikan',
      fullLabel: 'Kalkulator Racikan Tembakau & HPP',
      icon: <Scale className="w-4 h-4 shrink-0" />,
      desktopFlexClass: 'flex-[1]',
    },
    {
      id: 'finished',
      shortLabel: 'Seri Jadi',
      mobileLabel: 'Seri Jadi',
      fullLabel: 'Tembakau Jadi (Nomor Seri & Sinkron CSV)',
      icon: <Package className="w-4 h-4 shrink-0" />,
      countText: `${finishedCount}`,
      desktopFlexClass: 'flex-[1.05]',
    },
    {
      id: 'rolls',
      shortLabel: 'Gulungan',
      mobileLabel: 'Gulungan',
      fullLabel: 'Gulungan di Gudang (Belum Dikirim ke Pabrik)',
      icon: <Scroll className="w-4 h-4 shrink-0" />,
      countText: `${rollCount}`,
      desktopFlexClass: 'flex-[1.05]',
    },
    {
      id: 'qc-status',
      shortLabel: 'Status Barang',
      mobileLabel: 'Status',
      fullLabel: 'Status Barang Kiriman Pabrik (Menunggu Pabrik, Terima Cair & Reject)',
      icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
      countText: `${pendingQcCount}`,
      desktopFlexClass: 'flex-[1.35]',
    },
    {
      id: 'history',
      shortLabel: 'Riwayat',
      mobileLabel: 'Riwayat',
      fullLabel: 'Riwayat Nota Gulungan, Data Status Semua Seri & Google Sheets',
      icon: <History className="w-4 h-4 shrink-0" />,
      countText: `${finishedCount}`,
      desktopFlexClass: 'flex-[1.05]',
    },
    {
      id: 'settings',
      shortLabel: 'Setting',
      mobileLabel: 'Setting',
      fullLabel: 'Pengaturan Sistem, GitHub A-Brain Nolan, Cloud Sync & Master Data',
      icon: <Settings className="w-4 h-4 shrink-0" />,
      desktopFlexClass: 'flex-[1]',
    },
  ];

  const currentIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === activeTab)
  );

  const handlePrevTab = () => {
    const prevIdx = (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[prevIdx].id);
  };

  const handleNextTab = () => {
    const nextIdx = (currentIndex + 1) % tabs.length;
    setActiveTab(tabs[nextIdx].id);
  };

  return (
    <>
      <OfflineIndicator />
      <header className="safe-top-header bg-black/95 backdrop-blur-xl border-b border-zinc-800/90 text-white sticky top-0 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Top Panel: Wraps cleanly on intermediate/tablet screens so Brand & Controls NEVER collide */}
          <div className="py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {/* Left Brand + Mobile Quick Status */}
            <div className="flex items-center justify-between w-full sm:w-auto gap-2 shrink-0">
              <div className="flex items-center gap-2 shrink-0">
                <img
                  src="/awd-logo.png"
                  alt="Tobacco Lab Logo"
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-black object-contain p-0.5 border border-zinc-700 shrink-0"
                />
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-requiem font-black tracking-wide text-white text-[13px] sm:text-base lg:text-lg whitespace-nowrap">
                      TOBACCO <span className="text-amber-400">LAB</span>
                    </span>
                    <span className="hidden xl:inline-block text-[9px] uppercase font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 shrink-0">
                      CLOUD
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 hidden xl:block whitespace-nowrap">
                    HPP Racikan • Nomor Seri • Arsip Gulungan 3D • Cloud Sync Google
                  </p>
                </div>
              </div>

              {/* Mobile-only compact status badges (< 640px) — Fixed Icon-Only Slots */}
              <div className="sm:hidden flex items-center gap-1 shrink-0">
                {userEmail ? (
                  <button
                    type="button"
                    onClick={onForceCloudSync}
                    aria-label="Sinkronisasi Cloud"
                    className="group relative h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg bg-[#0a0b0f] hover:bg-[#111319] text-white border border-zinc-800 cursor-pointer active:scale-[0.97] transition-transform duration-150"
                  >
                    <MorphingIcon iconKey={cloudSyncStatus}>
                      {cloudSyncStatus === 'syncing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                      ) : cloudSyncStatus === 'error' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </MorphingIcon>
                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2 py-1 rounded bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                      Cloud Sync ({userEmail.split('@')[0]})
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    aria-label="Masuk Cloud Google"
                    className="group relative inline-flex items-center justify-center h-7 w-7 shrink-0 rounded-lg bg-[#0a0b0f] hover:bg-[#111319] text-white border border-zinc-800 cursor-pointer active:scale-[0.97] transition-transform duration-150"
                  >
                    <Cloud className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2 py-1 rounded bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                      Login Cloud Google
                    </span>
                  </button>
                )}

                <div
                  className="group relative bg-[#0a0b0f] h-7 px-2 rounded-lg border border-zinc-800 flex items-center gap-1 shrink-0"
                >
                  <Warehouse className="w-3 h-3 text-zinc-400 shrink-0" />
                  <div className="font-extrabold text-white font-mono tabular-nums text-[10px] whitespace-nowrap">
                    <OdometerNumber
                      value={totalNetStockKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                    />{' '}
                    <span className="text-zinc-400">kg</span>
                  </div>
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2 py-1 rounded bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                    Total Sisa Stok Mentah
                  </span>
                </div>
              </div>
            </div>

            {/* Right Controls: Streamlined Operational Controls Only */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto sm:ml-auto text-xs">
              <div
                className="group relative hidden sm:flex bg-[#0a0b0f] h-8 sm:h-9 px-2.5 rounded-lg border border-zinc-800/90 items-center gap-1.5 shrink-0"
              >
                <Warehouse className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <div className="font-extrabold text-white font-mono tabular-nums text-xs whitespace-nowrap">
                  <OdometerNumber
                    value={totalNetStockKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                  />{' '}
                  <span className="text-zinc-400 font-semibold">kg</span>
                </div>
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                  Total Sisa Stok Bersih Tembakau Mentah
                </span>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-1 sm:gap-1.5 w-full sm:w-auto">
                {userEmail ? (
                  <button
                    type="button"
                    onClick={onForceCloudSync}
                    aria-label="Sinkronisasi Cloud"
                    className="group relative hidden sm:inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg alucard-edge-btn-quiet cursor-pointer"
                  >
                    <MorphingIcon iconKey={cloudSyncStatus}>
                      {cloudSyncStatus === 'syncing' ? (
                        <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                      ) : cloudSyncStatus === 'error' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                    </MorphingIcon>
                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                      Cloud Aktif ({userEmail}) — Klik Segarkan
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    aria-label="Login Cloud Google"
                    className="group relative hidden sm:inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg alucard-edge-btn-quiet cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                    <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                      Login Cloud Google
                    </span>
                  </button>
                )}

                <PWAInstallButton />

                {onOpenGradeScanner && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenGradeScanner('scan')}
                      aria-label="Scan Kartu Grade"
                      className="alucard-edge-btn inline-flex items-center justify-center h-8 px-2 sm:h-9 sm:px-3 gap-1 sm:gap-1.5 rounded-lg cursor-pointer shrink-0 font-extrabold text-[10px] sm:text-xs"
                    >
                      <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                      <span>Scan Kartu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenGradeScanner('print')}
                      aria-label="Cetak Kartu Grade (A4 6/Hal)"
                      className="alucard-edge-btn-quiet inline-flex items-center justify-center h-8 px-2 sm:h-9 sm:px-3 gap-1 sm:gap-1.5 rounded-lg cursor-pointer shrink-0 font-bold text-[10px] sm:text-xs"
                    >
                      <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                      <span>Cetak Kartu</span>
                    </button>
                  </>
                )}

                {onOpenNolanAgent && (
                  <button
                    type="button"
                    onClick={onOpenNolanAgent}
                    aria-label="Buka Nolan"
                    className="alucard-edge-btn-quiet inline-flex items-center justify-center h-8 px-2 sm:h-9 sm:px-3 gap-1 sm:gap-1.5 rounded-lg cursor-pointer shrink-0 font-extrabold text-[10px] sm:text-xs border-zinc-700/90 hover:border-amber-500/65"
                  >
                    <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                    <span>Nolan</span>
                  </button>
                )}

                {onOpenSimulator && (
                  <button
                    type="button"
                    onClick={onOpenSimulator}
                    aria-label="Simulator"
                    className={`inline-flex items-center justify-center h-8 w-8 sm:w-auto sm:h-9 sm:px-3 gap-1.5 rounded-lg cursor-pointer shrink-0 font-bold text-xs whitespace-nowrap ${
                      isSimulatorOpen
                        ? 'alucard-edge-btn text-amber-300 bg-amber-500/10'
                        : 'alucard-edge-btn-quiet'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline">Simulator</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenPatchNotes}
                  aria-label={`Patch Notes ${CURRENT_APP_VERSION}`}
                  className={`relative inline-flex items-center justify-center h-8 w-8 sm:w-auto sm:h-9 sm:px-3 gap-1.5 rounded-lg cursor-pointer shrink-0 font-bold text-xs whitespace-nowrap ${
                    hasUnreadPatch ? 'alucard-edge-btn text-amber-200' : 'alucard-edge-btn-quiet'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Patch Notes</span>
                  {hasUnreadPatch && (
                    <span
                      className="text-[9px] font-mono font-black text-amber-400 hidden sm:inline border-l border-amber-500/35 pl-1.5"
                      aria-hidden="true"
                    >
                      BARU
                    </span>
                  )}
                  {hasUnreadPatch && (
                    <span
                      className="sm:hidden absolute top-1 right-1 w-1.5 h-1.5 rounded-xs bg-amber-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </div>
          </div>

          <nav
            className="hidden md:block pt-1.5 pb-2 border-t border-zinc-800/80"
            aria-label="Tabs Navigasi Desktop"
          >
            <div className="w-full flex items-center justify-between gap-1.5 lg:gap-2 p-1 rounded-xl bg-[#07080b] border border-zinc-800/90">
              <button
                type="button"
                onClick={handlePrevTab}
                className="group relative h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg alucard-edge-btn-quiet cursor-pointer"
                aria-label="Segmen Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-9 left-0 z-50 px-2.5 py-1 rounded-md bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-2xl">
                  Segmen Sebelumnya
                </span>
              </button>

              {/* Marked Tab Bar: raised slate plate + gold ink + sliding thin gold underline */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative ${
                        tab.desktopFlexClass || 'flex-1'
                      } min-w-fit h-9 px-2 lg:px-2.5 text-[11px] lg:text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors duration-150 active:scale-[0.98] ${
                        isActive
                          ? 'text-amber-300 font-extrabold'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03]'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="desktop-nav-active-surface"
                          transition={ALUCARD_SPRING_SNAPPY}
                          className="absolute inset-0 rounded-lg bg-[#12141c] border border-zinc-700/80"
                        />
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="desktop-nav-active-bar"
                          transition={ALUCARD_SPRING_SNAPPY}
                          className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-amber-400"
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1.5">
                        <span className={isActive ? 'text-amber-400 shrink-0' : 'text-zinc-400 group-hover:text-zinc-200 shrink-0'}>
                          {tab.icon}
                        </span>
                        <span className="whitespace-nowrap">{tab.shortLabel}</span>
                        {tab.countText !== undefined && (
                          <span
                            className={`text-[10px] font-mono tabular-nums font-bold shrink-0 ${
                              isActive
                                ? 'inline text-amber-300'
                                : 'hidden xl:inline text-zinc-500'
                            }`}
                          >
                            {tab.countText}
                          </span>
                        )}
                      </span>

                      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-9 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-2xl">
                        {tab.fullLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleNextTab}
                className="group relative h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg alucard-edge-btn-quiet cursor-pointer"
                aria-label="Segmen Berikutnya"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.2]" />
                <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-9 right-0 z-50 px-2.5 py-1 rounded-md bg-[#090a0e] border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-2xl">
                  Segmen Berikutnya
                </span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#06070a]/95 backdrop-blur-md border-t border-zinc-800/90 safe-bottom-nav shadow-[0_-10px_28px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-between gap-0.5 px-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.fullLabel}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[8.5px] tracking-tight font-bold transition-colors duration-150 active:scale-[0.96] cursor-pointer min-w-0 ${
                  isActive
                    ? 'bg-[#12141c] text-amber-300 font-extrabold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-active-bar"
                    transition={ALUCARD_SPRING_SNAPPY}
                    className="absolute top-0 left-2 right-2 h-[2px] rounded-full bg-amber-400"
                  />
                )}
                <span className={isActive ? 'text-amber-400 shrink-0' : 'shrink-0'}>
                  {tab.icon}
                </span>
                <span className="mt-0.5 whitespace-nowrap leading-tight">{tab.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
