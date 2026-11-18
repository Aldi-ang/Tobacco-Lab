import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Cloud, ShieldCheck, Smartphone, HardDrive, AlertCircle, Loader2 } from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import { ALUCARD_EASE } from './AlucardMotion';

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
    <div className="min-h-screen bg-[#040406] text-white flex flex-col items-center justify-center p-4 safe-fullscreen-modal relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: ALUCARD_EASE }}
        className="w-full max-w-md requiem-card border border-zinc-800/90 rounded-2xl p-5 sm:p-6 space-y-5 relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative p-1 rounded-2xl border border-zinc-800 bg-[#07080b]">
            <img
              src="/awd-logo.png"
              alt="Tobacco Lab Logo"
              className="w-18 h-18 rounded-xl bg-black object-contain p-1.5"
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#0a0b0f] border border-zinc-800 text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-widest mb-1.5">
              <Cloud className="w-3 h-3 text-amber-400" /> Cloud Database Sync
            </div>
            <h1 className="font-requiem font-black text-2xl sm:text-3xl tracking-wider text-white">
              TOBACCO <span className="text-amber-400">LAB</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Sistem Racikan Tembakau • HPP • Arsip Gulungan • Status Barang
            </p>
          </div>
        </div>

        <div className="bg-[#06070a] border border-zinc-800/90 rounded-xl divide-y divide-zinc-800/80 text-xs">
          <div className="p-3.5 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-zinc-300 leading-relaxed">
              <b className="text-white">Akses Data dengan Login Google:</b> Seluruh data stok bahan, nomor seri jadi, arsip gulungan, dan status barang tersimpan terenkripsi di Cloud dan hanya dapat diakses oleh akun Google Anda.
            </p>
          </div>
          <div className="p-3.5 flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-zinc-300 leading-relaxed">
              <b className="text-white">Sinkronisasi Real-Time Semua Perangkat:</b> Buka dengan akun Google yang sama di <b>iPhone, Samsung, maupun PC</b> untuk melihat dan mengubah data yang sama secara otomatis.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#140709] border border-red-500/60 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={isSigningIn}
            onClick={handleGoogleLogin}
            className="alucard-edge-btn w-full h-11 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Menghubungkan ke Akun Google...</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 stroke-[2.2] text-amber-400" />
                <span>Masuk dengan Google (Sinkronisasi Cloud)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onContinueOffline}
            className="alucard-edge-btn-quiet w-full h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
            <span>Lanjutkan Mode Lokal / Offline Sementara</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
