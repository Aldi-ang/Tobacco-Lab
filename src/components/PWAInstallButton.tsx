import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Smartphone,
  Share,
  PlusSquare,
  X,
  WifiOff,
  Copy,
  Check,
  Globe,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-black text-white border-b border-zinc-800 px-4 py-1.5 text-center text-xs font-extrabold flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Mode Offline Aktif — Semua perhitungan & data tetap tersimpan di perangkat Anda.</span>
    </div>
  );
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const OFFICIAL_VERCEL_URL = 'https://tobaccolab.vercel.app';

  const isRunApp =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.run.app');
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const PUBLIC_SAFARI_URL =
    !isRunApp && !isLocalhost && typeof window !== 'undefined'
      ? window.location.origin
      : OFFICIAL_VERCEL_URL;

  const displayDomain =
    !isRunApp && !isLocalhost && typeof window !== 'undefined'
      ? window.location.host
      : 'tobaccolab.vercel.app';

  const handleCopyCurrentUrl = () => {
    navigator.clipboard.writeText(PUBLIC_SAFARI_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tobacco Lab — Sistem Racikan & HPP Tembakau',
          text: 'Buka Aplikasi Resmi Tobacco Lab:',
          url: PUBLIC_SAFARI_URL,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyCurrentUrl();
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Install Aplikasi Tobacco Lab ke Layar Utama"
        className="group relative inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-black hover:bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
        <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
          Install Aplikasi
        </span>
      </button>

      {showGuideModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setShowGuideModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-lg w-full p-4 sm:p-5 text-white shadow-[0_20px_50px_rgba(0,0,0,0.95)] space-y-3.5 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/awd-logo.png"
                    alt="Tobacco Lab Logo"
                    className="w-9 h-9 rounded-xl bg-black object-contain p-0.5 border border-zinc-700 shrink-0"
                  />
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-white">
                      Tobacco Lab — Install Aplikasi Resmi
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Akses Cepat Layar Penuh untuk iPhone, Android &amp; PC
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-black text-white flex items-center gap-1.5 text-xs sm:text-sm">
                  <Globe className="w-4 h-4 text-amber-400 shrink-0" />
                  Tautan Akses Resmi Tobacco Lab:
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-amber-400 font-bold flex items-center justify-between gap-2">
                  <span className="truncate">{displayDomain}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-black text-zinc-300 border border-zinc-800 shrink-0">
                    HTTPS Aman
                  </span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Gunakan tombol di bawah untuk menyalin tautan aplikasi atau membagikannya langsung ke Safari (iPhone) maupun Chrome (Android/PC).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyCurrentUrl}
                  className="btn-amber-outline h-9 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5] text-amber-400" />
                      <span>Tautan Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Salin Tautan Tobacco Lab</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="h-9 px-3 rounded-xl bg-black hover:bg-zinc-900 text-white border border-zinc-800 hover:border-zinc-600 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Bagikan ke Safari / Perangkat</span>
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-zinc-300" /> Install ke Layar Utama iPhone (Safari iOS):
                  </div>
                  <ol className="list-decimal list-inside text-zinc-300 space-y-1 text-[11px] sm:text-xs">
                    <li>
                      Buka tautan di <b>Safari</b>, lalu ketuk tombol <b>Share / Bagikan</b> di bagian bawah.
                    </li>
                    <li>
                      Pilih <b>&quot;Add to Home Screen&quot; (Tambah ke Layar Utama)</b>.
                    </li>
                    <li>
                      Ketuk <b>Add / Tambah</b> — aplikasi <b>Tobacco Lab</b> siap dibuka penuh seperti aplikasi native.
                    </li>
                  </ol>
                </div>

                <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <PlusSquare className="w-3.5 h-3.5 text-zinc-300" /> Install di Android &amp; PC (Chrome / Edge):
                  </div>
                  <ol className="list-decimal list-inside text-zinc-300 space-y-1 text-[11px] sm:text-xs">
                    <li>Ketuk ikon menu <b>⋮</b> di pojok kanan atas browser.</li>
                    <li>Pilih <b>&quot;Install App&quot;</b> atau <b>&quot;Tambahkan ke Layar Utama&quot;</b>.</li>
                  </ol>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="btn-amber-outline w-full h-10 rounded-xl font-extrabold text-xs cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
