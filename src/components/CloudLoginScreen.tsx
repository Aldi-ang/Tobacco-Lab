import React, { useState } from 'react';
import { Cloud, ShieldCheck, Smartphone, HardDrive, AlertCircle, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface CloudLoginScreenProps {
  onContinueOffline: () => void;
}

export const CloudLoginScreen: React.FC<CloudLoginScreenProps> = ({ onContinueOffline }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Gagal masuk dengan Google. Silakan coba lagi.';
      setErrorMsg(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030304] text-white flex flex-col items-center justify-center p-4 safe-fullscreen-modal relative overflow-hidden">
      <div className="w-full max-w-md requiem-card border-2 border-amber-500/80 rounded-2xl p-5 sm:p-6 shadow-[0_0_45px_rgba(245,158,11,0.22)] space-y-5 relative z-10">
        {/* Brand Header with Black-Background White-Leaf Logo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/awd-logo.png"
            alt="AWD Master Logo"
            className="w-20 h-20 rounded-2xl bg-black object-contain p-1.5 border-2 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.35)]"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black border border-amber-500/60 text-amber-400 text-[10px] font-mono font-black uppercase tracking-widest mb-1.5">
              <Cloud className="w-3 h-3" /> Cloud Database Sync
            </div>
            <h1 className="font-requiem font-black text-2xl sm:text-3xl tracking-wider text-white">
              AWD <span className="text-amber-400">MASTER</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Sistem Racikan Tembakau • HPP • Arsip Gulungan • Status Barang
            </p>
          </div>
        </div>

        {/* Cloud Features Box */}
        <div className="bg-black/90 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-zinc-300 leading-relaxed">
              <b className="text-white">Akses Data dengan Login Google:</b> Seluruh data stok bahan, nomor seri jadi, arsip gulungan, dan status barang tersimpan aman di Cloud dan hanya dapat diakses oleh akun Google Anda.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-zinc-300 leading-relaxed">
              <b className="text-white">Sinkronisasi Real-Time Semua Perangkat:</b> Buka dengan akun Google yang sama di <b>iPhone, Samsung, maupun PC</b> untuk melihat dan mengubah data yang sama secara otomatis.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-black border border-amber-500 text-amber-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Primary Google Sign-In Button */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={isSigningIn}
            onClick={handleGoogleLogin}
            className="btn-amber-outline w-full h-11 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menghubungkan ke Akun Google...</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 stroke-[2.4]" />
                <span>Masuk dengan Google (Sinkronisasi Cloud)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onContinueOffline}
            className="w-full h-9 px-3 rounded-xl bg-black hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>Lanjutkan Mode Lokal / Offline Sementara</span>
          </button>
        </div>
      </div>
    </div>
  );
};
