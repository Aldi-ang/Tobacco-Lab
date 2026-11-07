import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
    <div className="bg-black text-amber-400 border-b border-amber-500 px-4 py-1.5 text-center text-xs font-extrabold flex items-center justify-center gap-2 z-50">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Mode Offline Aktif — Semua perhitungan & data tetap tersimpan di perangkat Anda.</span>
    </div>
  );
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
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
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-black hover:bg-zinc-900 text-amber-400 border border-amber-500/60 font-bold text-xs transition-all cursor-pointer"
        title="Install Aplikasi di iOS, Android, atau PC"
      >
        <Smartphone className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden lg:inline">Install App (iOS/Android)</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-950 border-2 border-amber-500/70 rounded-2xl max-w-md w-full p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-black text-amber-400 border border-amber-500">
                  <Download className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Install KRETEK MASTER di Perangkat</h3>
                  <p className="text-[11px] text-zinc-400">Bisa digunakan penuh di iPhone/iPad, Android & PC</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Share className="w-3.5 h-3.5" /> iPhone / iPad (Safari iOS):
                </div>
                <ol className="list-decimal list-inside text-zinc-300 space-y-1">
                  <li>Ketuk tombol <b>Share / Bagikan</b> di bagian bawah Safari.</li>
                  <li>Pilih <b>&quot;Add to Home Screen&quot; (Tambah ke Layar Utama)</b>.</li>
                  <li>Ketuk <b>Add</b> untuk membuka aplikasi layar penuh seperti aplikasi native.</li>
                </ol>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <PlusSquare className="w-3.5 h-3.5" /> Android & Desktop (Chrome / Edge):
                </div>
                <ol className="list-decimal list-inside text-zinc-300 space-y-1">
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
        </div>
      )}
    </>
  );
};
