import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  TobaccoRollSample,
  SerialFactoryStatus,
} from '../types/tobacco';
import { GRADE_LABELS, formatRupiah } from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import { TobaccoRoll3D } from './TobaccoRoll3D';

interface ShipmentStatusViewProps {
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  onUpdateSerialStatus: (
    serialId: string,
    status: SerialFactoryStatus,
    currentRoll: TobaccoRollSample
  ) => void;
}

export const ShipmentStatusView: React.FC<ShipmentStatusViewProps> = ({
  finishedBatches,
  rollSamples,
  onUpdateSerialStatus,
}) => {
  const [statusFilter, setStatusFilter] = useState<
    'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK' | 'ALL'
  >('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  // Track which Gulungan cards are opened/unrolled (hidden until pressed!)
  const [expandedRollIds, setExpandedRollIds] = useState<Record<string, boolean>>({});

  const toggleRollOpen = (rollId: string) => {
    setExpandedRollIds((prev) => ({
      ...prev,
      [rollId]: !prev[rollId],
    }));
  };

  const pendingList = finishedBatches.filter(
    (b) => (b.factoryStatus || 'PENDING') === 'PENDING'
  );
  const acceptedList = finishedBatches.filter((b) => b.factoryStatus === 'ACCEPTED_CAIR');
  const rejectedList = finishedBatches.filter((b) => b.factoryStatus === 'REJECTED_STOCK');

  // Group serials by Gulungan so every status tab (Menunggu, Terima Cair, Reject)
  // keeps the Gulungan container with its Name, Date, and 3D Roll animation!
  const rollGroups = rollSamples
    .map((roll) => {
      const allInThisRoll = finishedBatches.filter(
        (b) =>
          b.rollId === roll.id ||
          b.rollNumber === roll.rollNumber ||
          b.previousRollId === roll.id ||
          (b.previousRollNumber && b.previousRollNumber.includes(roll.rollNumber))
      );

      const matchingStatusSerials = allInThisRoll.filter((b) => {
        const st = b.factoryStatus || 'PENDING';
        const matchTab = statusFilter === 'ALL' || st === statusFilter;
        const matchSearch =
          !searchTerm.trim() ||
          b.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          roll.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          roll.recipeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          roll.targetFactory.toLowerCase().includes(searchTerm.toLowerCase());
        return matchTab && matchSearch;
      });

      const pendingCount = allInThisRoll.filter(
        (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
      ).length;
      const acceptedCount = allInThisRoll.filter(
        (s) => s.factoryStatus === 'ACCEPTED_CAIR'
      ).length;
      const rejectedCount = allInThisRoll.filter(
        (s) => s.factoryStatus === 'REJECTED_STOCK'
      ).length;

      return {
        roll,
        serials: matchingStatusSerials,
        pendingCount,
        acceptedCount,
        rejectedCount,
        totalCount: allInThisRoll.length,
      };
    })
    .filter((group) => group.serials.length > 0);

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {/* Header & Bordered Segment Switcher */}
      <div className="requiem-card p-3.5 sm:p-5 rounded-2xl border border-zinc-800/90 space-y-3">
        <div>
          <h1 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-black text-amber-400 border border-amber-500 text-xs font-mono font-black shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              STATUS BARANG
            </span>
            <span>Verifikasi Kiriman per Gulungan (Terima Cair & Reject)</span>
          </h1>
          <p className="text-[11px] text-zinc-400 mt-1">
            Tekan <b>Gulungan 3D</b> terlebih dahulu untuk membuka daftar Nomor Seri dan memilih{' '}
            <b className="text-amber-400">Terima Cair</b> atau <b className="text-white">Reject</b>.
          </p>
        </div>

        {/* Distinct Spacing & Border between Header and Segment Bar */}
        <div className="pt-3 border-t border-zinc-800/90 flex items-center justify-between flex-wrap gap-2">
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              {
                id: 'PENDING',
                label: 'Menunggu QC',
                fullLabel: 'Gulungan dengan Seri Menunggu Keputusan QC Pabrik',
                icon: <Clock className="w-3.5 h-3.5" />,
                badge: pendingList.length,
              },
              {
                id: 'ACCEPTED_CAIR',
                label: 'Terima Cair',
                fullLabel: 'Gulungan dengan Seri yang Diterima Pabrik & Uang Cair',
                icon: <DollarSign className="w-3.5 h-3.5" />,
                badge: acceptedList.length,
              },
              {
                id: 'REJECTED_STOCK',
                label: 'Reject',
                fullLabel: 'Gulungan dengan Seri yang Direject (Masuk Stok Tembakau Jadi)',
                icon: <RotateCcw className="w-3.5 h-3.5" />,
                badge: rejectedList.length,
              },
              {
                id: 'ALL',
                label: 'Semua',
                fullLabel: 'Semua Gulungan & Status Nomor Seri',
                badge: finishedBatches.length,
              },
            ]}
          />
        </div>
      </div>

      {/* Minimalist Search Input */}
      <div className="requiem-card p-3 rounded-xl border border-zinc-800/90">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Nama Gulungan, Kode (GUL-...), Nomor Seri (57, 58...), atau Pabrik..."
            className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
          />
        </div>
      </div>

      {/* Gulungan Cards (Pressing a Gulungan unrolls the 3D Roll and reveals the Seri inside) */}
      {rollGroups.length === 0 ? (
        <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
          <ClipboardCheck className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
          <p className="text-white font-bold text-sm">
            Tidak ada Gulungan dengan Nomor Seri pada kategori status ini
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rollGroups.map(({ roll, serials, pendingCount, acceptedCount, rejectedCount }) => {
            const isOpen = !!expandedRollIds[roll.id];
            const formattedDate = new Date(roll.sampleCreatedDate).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });

            const totalNettoInView = serials.reduce(
              (acc, s) =>
                acc + Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg),
              0
            );
            const totalValueInView = serials.reduce((acc, s) => {
              const netto = Math.max(
                0,
                s.packaging.grossWeightPerPackage - s.factoryDeductionKg
              );
              return acc + Math.round(netto * s.factoryTargetPricePerKg);
            }, 0);

            return (
              <div
                key={roll.id}
                className={`requiem-card rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                  isOpen
                    ? 'border-amber-500 shadow-[0_0_28px_rgba(245,158,11,0.18)]'
                    : 'border-zinc-800/90 hover:border-amber-500/70'
                }`}
              >
                {/* Clickable Gulungan Card Header with 3D Gulungan Tembakau Animation */}
                <div
                  onClick={() => toggleRollOpen(roll.id)}
                  className="p-3.5 sm:p-5 cursor-pointer space-y-3 bg-gradient-to-b from-zinc-950/90 to-black"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs">
                          {roll.rollNumber}
                        </span>
                        <h2 className="font-black text-white text-sm sm:text-lg">
                          {roll.recipeName}
                        </h2>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-300">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          Pabrik: <b className="text-white">{roll.targetFactory}</b>
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-300 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>

                    {/* Status Breakdown Counters & Open/Close Button */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                          Pending: <b className="text-amber-400">{pendingCount}</b>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                          Cair: <b className="text-amber-400">{acceptedCount}</b>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                          Reject: <b className="text-white">{rejectedCount}</b>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRollOpen(roll.id);
                        }}
                        className="btn-amber-outline min-h-8 px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>
                          {isOpen
                            ? 'Tutup Gulungan'
                            : `Buka Gulungan (${serials.length} Seri)`}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 3D Gulungan Tembakau Interactive Visual (Closed Roll -> Unrolls when pressed!) */}
                  <TobaccoRoll3D isOpen={isOpen} rollNumber={roll.rollNumber} size="sm" />

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                    <span>
                      Menampilkan <b className="text-amber-400">{serials.length} Nomor Seri</b> di
                      segmen ini ({totalNettoInView} kg Netto • {formatRupiah(totalValueInView)})
                    </span>
                    <span className="text-amber-400 font-bold">
                      {isOpen ? 'Pilih Terima / Reject di bawah ↓' : 'Ketuk untuk membuka gulungan →'}
                    </span>
                  </div>
                </div>

                {/* HIDDEN UNTIL GULUNGAN IS PRESSED: List of Seri inside this Gulungan */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-zinc-800 bg-black/95 p-3.5 sm:p-5 overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {serials.map((ser) => {
                          const status = ser.factoryStatus || 'PENDING';
                          const bruto = ser.packaging.grossWeightPerPackage;
                          const tara = ser.factoryDeductionKg;
                          const netto = Math.max(0, bruto - tara);
                          const gradeInfo =
                            GRADE_LABELS[ser.compositeColorGrade] || GRADE_LABELS['D'];

                          return (
                            <div
                              key={ser.id}
                              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between gap-2.5"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-black text-amber-400 border border-amber-500 font-mono font-black text-xs">
                                    SERI {ser.serialNumber}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black border ${gradeInfo.color}`}
                                  >
                                    Grade {ser.compositeColorGrade}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                                  <span>{ser.packaging.packagingType}</span>
                                  <span className="text-white font-bold">
                                    Netto {netto}kg (Bruto {bruto})
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-zinc-900">
                                  <span className="text-zinc-400">
                                    Nota: {formatRupiah(ser.factoryTargetPricePerKg)}/kg
                                  </span>
                                  <b className="text-amber-400">
                                    {formatRupiah(Math.round(netto * ser.factoryTargetPricePerKg))}
                                  </b>
                                </div>
                              </div>

                              {/* Update Status Buttons inside this Gulungan: Terima Cair vs Reject */}
                              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-zinc-900">
                                <button
                                  type="button"
                                  title="Terima Pabrik & Uang Cair (Tetap tercatat di Gulungan ini pada tab Terima Cair)"
                                  onClick={() =>
                                    onUpdateSerialStatus(ser.id, 'ACCEPTED_CAIR', roll)
                                  }
                                  className={`min-h-8 px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                                    status === 'ACCEPTED_CAIR'
                                      ? 'bg-black text-amber-400 border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                                      : 'bg-black text-zinc-300 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/60'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Terima Cair</span>
                                </button>

                                <button
                                  type="button"
                                  title="Reject Pabrik (Tercatat di Gulungan ini pada tab Reject & masuk Stok Tembakau Jadi)"
                                  onClick={() =>
                                    onUpdateSerialStatus(ser.id, 'REJECTED_STOCK', roll)
                                  }
                                  className={`min-h-8 px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                                    status === 'REJECTED_STOCK'
                                      ? 'bg-black text-white border-2 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                                      : 'bg-black text-zinc-400 hover:text-white border border-zinc-800 hover:border-amber-500/60'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
