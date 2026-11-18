import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('AppErrorBoundary caught runtime error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#040406] text-zinc-100 flex items-center justify-center p-4">
          <div className="requiem-card border border-amber-500/40 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Pemulihan Sistem
              </span>
              <h1 className="font-requiem text-lg font-extrabold text-white">
                Terjadi Gangguan Tampilan
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Data stok lokal Anda tetap aman. Muat ulang halaman untuk memulihkan sesi kerja.
              </p>
            </div>
            {this.state.errorMessage && (
              <pre className="p-2.5 rounded-xl bg-black border border-zinc-800 text-[11px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap break-words">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="alucard-edge-btn w-full h-10 rounded-xl font-extrabold text-xs cursor-pointer"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
