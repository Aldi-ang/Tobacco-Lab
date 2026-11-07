import React, { useRef } from 'react';
import {
  Leaf,
  Scale,
  Package,
  Scroll,
  Calculator,
  Plus,
  Download,
  Upload,
  RotateCcw,
  Warehouse,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';

export type ActiveTab =
  | 'inventory'
  | 'calculator'
  | 'finished'
  | 'rolls'
  | 'tara-simulator'
  | 'qc-status';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  rawTobaccoCount: number;
  rejectedStockCount: number;
  pendingQcCount: number;
  totalNetStockKg: number;
  finishedCount: number;
  rollCount: number;
  onOpenAddModal: () => void;
  onOpenMasterModal: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetData: () => void;
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
  onOpenAddModal,
  onOpenMasterModal,
  onExportData,
  onImportData,
  onResetData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ordered by real-world tobacco workflow: Status Barang (Accept/Reject) is the LAST segment
  const tabs: {
    id: ActiveTab;
    shortLabel: string;
    fullLabel: string;
    icon: React.ReactNode;
    countText?: string;
  }[] = [
    {
      id: 'inventory',
      shortLabel: 'Stok',
      fullLabel: 'Stok Tembakau (Mentah & Jadi Eks-Reject)',
      icon: <Leaf className="w-4 h-4 shrink-0" />,
      countText: `${rawTobaccoCount + rejectedStockCount}`,
    },
    {
      id: 'calculator',
      shortLabel: 'Racikan',
      fullLabel: 'Kalkulator Racikan Tembakau & HPP',
      icon: <Scale className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'finished',
      shortLabel: 'Seri Jadi',
      fullLabel: 'Tembakau Jadi (Nomor Seri & Sinkron CSV)',
      icon: <Package className="w-4 h-4 shrink-0" />,
      countText: `${finishedCount}`,
    },
    {
      id: 'rolls',
      shortLabel: 'Gulungan',
      fullLabel: 'Arsip Gulungan 3D, Nota Personal (Profit) & Nota Pabrik',
      icon: <Scroll className="w-4 h-4 shrink-0" />,
      countText: `${rollCount}`,
    },
    {
      id: 'tara-simulator',
      shortLabel: 'Simulator',
      fullLabel: 'Simulator Potongan Tarra & Nota Pabrik',
      icon: <Calculator className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'qc-status',
      shortLabel: 'Status Barang',
      fullLabel: 'Status Barang Kiriman per Gulungan (Menunggu QC, Terima Cair & Reject)',
      icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
      countText: `${pendingQcCount}`,
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
      <header className="bg-black/95 backdrop-blur-xl border-b border-zinc-800/90 text-white sticky top-0 z-30 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Top Brand & Compact Ergonomic Action Bar (Zero Horizontal Clipping on Phone!) */}
          <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Row 1 on Mobile / Left side on Desktop: Brand + Stock Pill (Mobile) */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-black flex items-center justify-center shadow-[0_0_18px_rgba(245,158,11,0.28)] border border-amber-500 shrink-0">
                  <Leaf className="w-4 h-4 text-amber-400 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-requiem font-black tracking-wider text-white text-sm sm:text-lg whitespace-nowrap">
                      KRETEK <span className="text-amber-400">MASTER</span>
                    </span>
                    <span className="text-[9px] uppercase font-extrabold tracking-widest px-1.5 py-0.5 rounded bg-black text-amber-400 border border-amber-500/60 shrink-0">
                      PRO /5
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 hidden lg:block">
                    HPP Racikan • Nomor Seri • Arsip Gulungan 3D • Status Barang (Terima & Reject)
                  </p>
                </div>
              </div>

              {/* Mobile-only Stock Pill on top-right of Row 1 */}
              <div
                className="sm:hidden bg-zinc-950/90 px-2.5 py-1 rounded-lg border border-zinc-800 flex items-center gap-1.5 shrink-0"
                title="Total Sisa Stok Bersih Tembakau Mentah"
              >
                <Warehouse className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="font-extrabold text-white font-mono text-xs whitespace-nowrap">
                  {totalNetStockKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}{' '}
                  <span className="text-amber-400">kg</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Format + Bahan + Backup Tools (Single aligned row on Phone & Desktop!) */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 text-xs">
              <div
                className="hidden sm:flex bg-zinc-950/90 px-2.5 py-1 rounded-lg border border-zinc-800 items-center gap-1.5 shrink-0"
                title="Total Sisa Stok Bersih Tembakau Mentah"
              >
                <Warehouse className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div className="font-extrabold text-white font-mono text-xs whitespace-nowrap">
                  {totalNetStockKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}{' '}
                  <span className="text-amber-400">kg</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <PWAInstallButton />

                {/* Short & Simple Button Name: "Format" (replaces "Kemasan & Pabrik") */}
                <button
                  type="button"
                  onClick={onOpenMasterModal}
                  className="group relative inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-black hover:bg-zinc-900 text-white border border-zinc-700 hover:border-amber-500 font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                  title="Format Kemasan (Tarra & Ongkos Press), Daftar Pabrik & Gulungan"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Format</span>
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded bg-black border border-amber-500 text-amber-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                    Atur Format Kemasan, Pabrik & Gulungan
                  </span>
                </button>

                {/* "+ Bahan" Button — Padded and Sized so its Right Border is Never Clipped */}
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="group relative btn-amber-outline inline-flex items-center justify-center gap-1 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg font-extrabold text-xs whitespace-nowrap cursor-pointer shrink-0"
                  title="Tambah Stok Tembakau Mentah Baru"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                  <span>Bahan</span>
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden md:block absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded bg-black border border-amber-500 text-amber-300 text-[10px] font-bold whitespace-nowrap shadow-xl">
                    Tambah Stok Tembakau Mentah
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={onExportData}
                  className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg bg-black hover:bg-zinc-900 text-white border border-zinc-800 hover:border-amber-500/60 transition-all cursor-pointer shrink-0"
                  title="Backup Data JSON"
                  aria-label="Ekspor Data JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={onImportData}
                  className="hidden"
                  id="import-json-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg bg-black hover:bg-zinc-900 text-white border border-zinc-800 hover:border-amber-500/60 transition-all cursor-pointer shrink-0"
                  title="Restore Data JSON"
                  aria-label="Impor Data JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onResetData}
                  className="h-8 w-8 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg bg-black hover:bg-zinc-900 text-zinc-400 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/60 transition-all cursor-pointer shrink-0"
                  title="Reset Data ke Contoh Awal"
                  aria-label="Reset Data ke Contoh Awal"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* DESKTOP & TABLET TOP NAVIGATION PANEL (Hidden on Phone! Fixed Equal-Width Columns on Desktop) */}
          <nav
            className="hidden md:block pt-2.5 pb-2.5 border-t border-zinc-800/90"
            aria-label="Tabs Navigasi Desktop"
          >
            <div className="w-full flex items-center justify-between gap-2 p-1.5 rounded-xl bg-zinc-950/95 border border-zinc-800/90">
              {/* Fixed Left Button to Step Segment */}
              <button
                type="button"
                onClick={handlePrevTab}
                className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-black hover:bg-zinc-900 text-amber-400 border border-amber-500/70 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.18)] transition-all cursor-pointer"
                title="Segmen Sebelumnya"
                aria-label="Segmen Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Desktop Segment Buttons (Equal-Width Grid so format never shifts) */}
              <div className="grid grid-cols-6 gap-1.5 flex-1 min-w-0">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      title={tab.fullLabel}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative w-full h-9 px-2.5 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-black text-amber-400 border border-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                          : 'text-zinc-400 hover:text-white border border-transparent hover:border-zinc-800'
                      }`}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-1.5 min-w-0">
                        {tab.icon}
                        <span className="truncate">{tab.shortLabel}</span>
                        {tab.countText !== undefined && (
                          <span
                            className={`text-[10px] font-mono font-bold shrink-0 ${
                              isActive ? 'text-amber-300' : 'text-zinc-500'
                            }`}
                          >
                            ({tab.countText})
                          </span>
                        )}
                      </span>

                      {/* Full Name Tooltip on Hover */}
                      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-9 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500 text-amber-300 text-[10px] font-bold whitespace-nowrap shadow-2xl">
                        {tab.fullLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Fixed Right Button to Step Segment */}
              <button
                type="button"
                onClick={handleNextTab}
                className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-black hover:bg-zinc-900 text-amber-400 border border-amber-500/70 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.18)] transition-all cursor-pointer"
                title="Segmen Berikutnya"
                aria-label="Segmen Berikutnya"
              >
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Ergonomic Mobile Bottom Navigation Bar (Phone Viewport Only — Saves Top Space) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-zinc-800 px-1.5 py-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.9)]">
        <div className="grid grid-cols-6 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.fullLabel}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[9px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-black text-amber-400 border border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'text-zinc-400 hover:text-white border border-transparent'
                }`}
              >
                {tab.icon}
                <span className="mt-0.5 truncate max-w-full">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
