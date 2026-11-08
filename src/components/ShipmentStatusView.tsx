import React, { useState } from 'react';
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
  Maximize2,
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  TobaccoRollSample,
  SerialFactoryStatus,
} from '../types/tobacco';
import { GRADE_LABELS, formatRupiah } from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';
import { TobaccoRoll3D, FullScreenScrollModal } from './TobaccoRoll3D';

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
  // Track which Gulungan is opened in the Full-Screen Unrolling Scroll Modal
  const [activeFullScreenRollId, setActiveFullScreenRollId] = useState<string | null>(null);
  const [modalShowAllInRoll, setModalShowAllInRoll] = useState<boolean>(false);

  const pendingList = finishedBatches.filter(
    (b) => (b.factoryStatus || 'PENDING') === 'PENDING'
  );
  const acceptedList = finishedBatches.filter((b) => b.factoryStatus === 'ACCEPTED_CAIR');
  const rejectedList = finishedBatches.filter((b) => b.factoryStatus === 'REJECTED_STOCK');

  // Group serials by Gulungan so every status tab (Menunggu, Terima Cair, Reject)
  // keeps the Gulungan container with its Name, Date, and 3D Scroll animation!
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
        allInThisRoll,
        serials: matchingStatusSerials,
        pendingCount,
        acceptedCount,
        rejectedCount,
        totalCount: allInThisRoll.length,
      };
    })
    .filter((group) => group.serials.length > 0);

  const activeGroup =
    rollGroups.find((g) => g.roll.id === activeFullScreenRollId) ||
    (activeFullScreenRollId
      ? (() => {
          const foundRoll = rollSamples.find((r) => r.id === activeFullScreenRollId);
          if (!foundRoll) return null;
          const allInThisRoll = finishedBatches.filter(
            (b) =>
              b.rollId === foundRoll.id ||
              b.rollNumber === foundRoll.rollNumber ||
              b.previousRollId === foundRoll.id ||
              (b.previousRollNumber && b.previousRollNumber.includes(foundRoll.rollNumber))
          );
          return {
            roll: foundRoll,
            allInThisRoll,
            serials: allInThisRoll,
            pendingCount: allInThisRoll.filter(
              (s) => (s.factoryStatus || 'PENDING') === 'PENDING'
            ).length,
            acceptedCount: allInThisRoll.filter(
              (s) => s.factoryStatus === 'ACCEPTED_CAIR'
            ).length,
            rejectedCount: allInThisRoll.filter(
              (s) => s.factoryStatus === 'REJECTED_STOCK'
            ).length,
            totalCount: allInThisRoll.length,
          };
        })()
      : null);

  return (
    <div className="space-y-3 pb-20 md:pb-4">
      {/* Slideable Button Panel Only */}
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

      {/* Minimalist Search Input */}
      <div className="requiem-card p-3 rounded-xl border border-zinc-800/90">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Nama Gulungan, Kode (GUL-...), Nomor Seri (57, 58...), atau Pabrik..."
            className="w-full h-9 sm:h-10 pl-9 pr-3 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Gulungan Cards (Pressing a Gulungan opens the Full-Screen Unrolling Scroll Modal!) */}
      {rollGroups.length === 0 ? (
        <div className="text-center py-12 requiem-card rounded-2xl border border-zinc-800">
          <ClipboardCheck className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
          <p className="text-white font-bold text-sm">
            Tidak ada Gulungan dengan Nomor Seri pada kategori status ini
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rollGroups.map(({ roll, serials, pendingCount, acceptedCount, rejectedCount }) => {
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
                onClick={() => {
                  setModalShowAllInRoll(false);
                  setActiveFullScreenRollId(roll.id);
                }}
                className="requiem-card rounded-2xl border-2 border-zinc-800/90 hover:border-zinc-700 transition-all duration-200 overflow-hidden cursor-pointer p-3.5 sm:p-5 space-y-3 bg-gradient-to-b from-zinc-950/90 to-black shadow-[0_7px_0_0_#09090b,0_12px_20px_rgba(0,0,0,0.85)] hover:shadow-[0_9px_0_0_#f59e0b,0_16px_28px_rgba(245,158,11,0.2)]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg bg-black text-amber-400 border border-zinc-700 font-mono font-black text-xs">
                        {roll.rollNumber}
                      </span>
                      <h2 className="font-black text-white text-sm sm:text-lg">
                        {roll.recipeName}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-300">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        Pabrik: <b className="text-white">{roll.targetFactory}</b>
                      </span>
                      <span className="inline-flex items-center gap-1 text-zinc-200 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Status Breakdown Counters & Full-Screen Open Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      <span className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                        Pending: <b className="text-white">{pendingCount}</b>
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                        Cair: <b className="text-white">{acceptedCount}</b>
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-black border border-zinc-800 text-zinc-300">
                        Reject: <b className="text-white">{rejectedCount}</b>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalShowAllInRoll(false);
                        setActiveFullScreenRollId(roll.id);
                      }}
                      className="btn-amber-outline min-h-8 px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Buka Gulungan ({serials.length} Seri)</span>
                    </button>
                  </div>
                </div>

                {/* Closed 3D Antique Scroll Preview */}
                <TobaccoRoll3D isOpen={false} rollNumber={roll.rollNumber} size="sm" />

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <span>
                    <b className="text-white">{serials.length} Nomor Seri</b> (
                    {totalNettoInView} kg Netto • {formatRupiah(totalValueInView)})
                  </span>
                  <span className="text-amber-400 font-bold">
                    Buka Layar Penuh →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL-SCREEN UNROLLING SCROLL MODAL FOR GULUNGAN SERI INSPECTION & QC */}
      {activeGroup && (
        <FullScreenScrollModal
          isOpen={!!activeGroup}
          onClose={() => setActiveFullScreenRollId(null)}
          rollNumber={activeGroup.roll.rollNumber}
          recipeName={activeGroup.roll.recipeName}
          targetFactory={activeGroup.roll.targetFactory}
          formattedDate={new Date(activeGroup.roll.sampleCreatedDate).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          badgeText={`STATUS BARANG • ${activeGroup.allInThisRoll.length} SERI`}
        >
          {(() => {
            const displayedSerials = modalShowAllInRoll
              ? activeGroup.allInThisRoll
              : activeGroup.serials.length > 0
                ? activeGroup.serials
                : activeGroup.allInThisRoll;

            const sumNetto = displayedSerials.reduce(
              (acc, s) =>
                acc + Math.max(0, s.packaging.grossWeightPerPackage - s.factoryDeductionKg),
              0
            );
            const sumNota = displayedSerials.reduce((acc, s) => {
              const netto = Math.max(
                0,
                s.packaging.grossWeightPerPackage - s.factoryDeductionKg
              );
              return acc + Math.round(netto * s.factoryTargetPricePerKg);
            }, 0);

            return (
              <div className="space-y-4">
                {/* Summary KPI Strip & Filter Toggle inside Full-Screen Scroll */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-black p-3.5 sm:p-4 rounded-xl border border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      Menunggu QC: <b className="text-white">{activeGroup.pendingCount} Seri</b>
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      Terima Cair:{' '}
                      <b className="text-white">{activeGroup.acceptedCount} Seri</b>
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                      Reject (Ke Stok Jadi):{' '}
                      <b className="text-white">{activeGroup.rejectedCount} Seri</b>
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-bold">
                      Total Ditampilkan: {displayedSerials.length} Seri ({sumNetto} kg •{' '}
                      {formatRupiah(sumNota)})
                    </span>
                  </div>

                  {statusFilter !== 'ALL' &&
                    activeGroup.allInThisRoll.length !== activeGroup.serials.length && (
                      <button
                        type="button"
                        onClick={() => setModalShowAllInRoll((v) => !v)}
                        className="btn-amber-outline h-8 px-3 rounded-lg text-xs font-extrabold cursor-pointer self-start lg:self-auto"
                      >
                        {modalShowAllInRoll
                          ? `Tampilkan Sesuai Filter (${activeGroup.serials.length} Seri)`
                          : `Tampilkan Semua Seri di Gulungan Ini (${activeGroup.allInThisRoll.length} Seri)`}
                      </button>
                    )}
                </div>

                {/* Full-Screen Spacious Grid of All Nomor Seri inside this Gulungan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {displayedSerials.map((ser) => {
                    const status = ser.factoryStatus || 'PENDING';
                    const bruto = ser.packaging.grossWeightPerPackage;
                    const tara = ser.factoryDeductionKg;
                    const netto = Math.max(0, bruto - tara);
                    const modalPerKg = Math.round(
                      ser.effectiveHppAfterTaraPerKg || ser.hppPerNetKg
                    );
                    const totalModal = Math.round(netto * modalPerKg);
                    const totalNota = Math.round(netto * ser.factoryTargetPricePerKg);
                    const profit = totalNota - totalModal;
                    const gradeInfo =
                      GRADE_LABELS[ser.compositeColorGrade] || GRADE_LABELS['D'];

                    return (
                      <div
                        key={ser.id}
                        className={`bg-black rounded-xl p-3.5 flex flex-col justify-between gap-3 border-2 transition-all ${
                          status === 'ACCEPTED_CAIR'
                            ? 'border-zinc-700'
                            : status === 'REJECTED_STOCK'
                              ? 'border-zinc-500 bg-zinc-950/90'
                              : 'border-zinc-800 hover:border-zinc-800'
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Top Row: Nomor Seri Badge, Status Badge & Grade */}
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white border border-zinc-700 font-mono font-black text-xs sm:text-sm">
                              SERI {ser.serialNumber}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black border ${gradeInfo.color}`}
                              >
                                Grade {ser.compositeColorGrade}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${
                                  status === 'ACCEPTED_CAIR'
                                    ? 'bg-black text-amber-400 border-zinc-700'
                                    : status === 'REJECTED_STOCK'
                                      ? 'bg-zinc-900 text-white border-zinc-500'
                                      : 'bg-zinc-950 text-zinc-400 border-zinc-700'
                                }`}
                              >
                                {status === 'ACCEPTED_CAIR'
                                  ? 'CAIR'
                                  : status === 'REJECTED_STOCK'
                                    ? 'REJECT'
                                    : 'PENDING'}
                              </span>
                            </div>
                          </div>

                          {/* Weight & Packaging Box */}
                          <div className="bg-zinc-950 border border-zinc-800/90 rounded-lg p-2.5 space-y-1.5 font-mono text-xs">
                            <div className="flex items-center justify-between text-zinc-400">
                              <span className="text-[10px] uppercase font-bold">Kemasan</span>
                              <b className="text-white">{ser.packaging.packagingType}</b>
                            </div>
                            <div className="flex items-center justify-between text-zinc-400">
                              <span className="text-[10px] uppercase font-bold">
                                Bruto / Tarra
                              </span>
                              <span className="text-zinc-200">
                                {bruto} kg / <b className="text-white">-{tara} kg</b>
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-900">
                              <span className="text-[10px] uppercase font-bold text-zinc-200">
                                Netto Tagih
                              </span>
                              <b className="text-white text-sm">{netto} kg</b>
                            </div>
                          </div>

                          {/* Financial Box: Modal, Harga Pabrik, Total Nota & Profit */}
                          <div className="bg-zinc-950 border border-zinc-800/90 rounded-lg p-2.5 space-y-1 font-mono text-[11px]">
                            <div className="flex items-center justify-between text-zinc-400">
                              <span>Modal/KG:</span>
                              <span className="text-zinc-200">{formatRupiah(modalPerKg)}</span>
                            </div>
                            <div className="flex items-center justify-between text-zinc-300">
                              <span>Harga Pabrik/KG:</span>
                              <b className="text-zinc-200">
                                {formatRupiah(ser.factoryTargetPricePerKg)}
                              </b>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-zinc-900">
                              <span className="text-zinc-400">Total Nota:</span>
                              <b className="text-white text-xs">{formatRupiah(totalNota)}</b>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">Profit Seri:</span>
                              <b
                                className={
                                  profit >= 0 ? 'text-amber-400' : 'text-red-400'
                                }
                              >
                                {profit >= 0 ? '+' : ''}
                                {formatRupiah(profit)}
                              </b>
                            </div>
                          </div>

                          {/* All 5 Character Parameters (/5) Strip */}
                          <div className="grid grid-cols-5 gap-1 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900 text-center font-mono text-[10px]">
                            <div>
                              <span className="text-[8px] text-zinc-500 block font-bold">PWR</span>
                              <b className="text-white">{ser.weightedPower}</b>
                            </div>
                            <div>
                              <span className="text-[8px] text-zinc-500 block font-bold">IMP</span>
                              <b className="text-white">{ser.weightedImpact}</b>
                            </div>
                            <div>
                              <span className="text-[8px] text-zinc-500 block font-bold">BIT</span>
                              <b className="text-white">{ser.weightedBitter}</b>
                            </div>
                            <div>
                              <span className="text-[8px] text-zinc-500 block font-bold">BKR</span>
                              <b className="text-white">{ser.weightedBurn ?? 4.5}</b>
                            </div>
                            <div>
                              <span className="text-[8px] text-zinc-500 block font-bold">SGR</span>
                              <b className="text-zinc-200">{ser.weightedSugar ?? 4.0}</b>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Terima Cair vs Reject */}
                        <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              title="Terima Pabrik & Uang Cair"
                              onClick={() =>
                                onUpdateSerialStatus(
                                  ser.id,
                                  'ACCEPTED_CAIR',
                                  activeGroup.roll
                                )
                              }
                              className={`min-h-9 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                                status === 'ACCEPTED_CAIR'
                                  ? 'bg-black text-amber-400 border border-zinc-700'
                                  : 'bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-800'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Terima Cair</span>
                            </button>

                            <button
                              type="button"
                              title="Reject Pabrik (Masuk ke Stok Tembakau Jadi)"
                              onClick={() =>
                                onUpdateSerialStatus(
                                  ser.id,
                                  'REJECTED_STOCK',
                                  activeGroup.roll
                                )
                              }
                              className={`min-h-9 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                                status === 'REJECTED_STOCK'
                                  ? 'bg-black text-white border border-zinc-700'
                                  : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-800'
                              }`}
                            >
                              <XCircle className="w-4 h-4 shrink-0" />
                              <span>Reject</span>
                            </button>
                          </div>

                          {status !== 'PENDING' && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSerialStatus(ser.id, 'PENDING', activeGroup.roll)
                              }
                              className="w-full h-7 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-[10px] font-bold cursor-pointer"
                            >
                              Kembalikan ke Menunggu QC (Pending)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </FullScreenScrollModal>
      )}
    </div>
  );
};
