import React, { useState, useEffect } from 'react';
import { X, Sparkles, Info, Check, UserCheck } from 'lucide-react';
import { RawTobacco, TobaccoGrade, PackagingMaster } from '../types/tobacco';
import {
  GRADE_LABELS,
  calculateRawTobaccoCost,
  formatRupiah,
  formatTaraFormula,
  clampRating5,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';
import { RatingSegmentSlider } from './RatingSegmentSlider';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
  RawTobaccoCalcFocus,
  buildRawTobaccoCalcDetail,
} from './CalculationDetailModal';

interface RawTobaccoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tobacco: RawTobacco) => void;
  editingTobacco: RawTobacco | null;
  packagingList: PackagingMaster[];
}

export const RawTobaccoModal: React.FC<RawTobaccoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTobacco,
  packagingList,
}) => {
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('Temanggung');
  const [sellerName, setSellerName] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  const [grossWeightKg, setGrossWeightKg] = useState<number>(50);
  const [packagingMassKg, setPackagingMassKg] = useState<number>(2);
  const [pricePerKgPurchase, setPricePerKgPurchase] = useState<number>(80000);
  const [percentTara, setPercentTara] = useState<number>(10);
  const [flatKgTara, setFlatKgTara] = useState<number>(2);
  const [packagingType, setPackagingType] = useState('KARUNG GONI (10% + 2)');
  const [taraNotes, setTaraNotes] = useState('');
  const [additionalCost, setAdditionalCost] = useState<number>(0);
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  const [powerRating, setPowerRating] = useState<number>(4.0);
  const [impactRating, setImpactRating] = useState<number>(4.0);
  const [bitterRating, setBitterRating] = useState<number>(2.5);
  const [burnRating, setBurnRating] = useState<number>(4.5);
  const [sugarRating, setSugarRating] = useState<number>(4.0);
  const [aromaRating, setAromaRating] = useState<number>(4.2);
  const [colorGrade, setColorGrade] = useState<TobaccoGrade>('D+');
  const [characterNotes, setCharacterNotes] = useState('');

  useEffect(() => {
    if (editingTobacco) {
      setName(editingTobacco.name);
      setOrigin(editingTobacco.origin);
      setSellerName(editingTobacco.sellerName || editingTobacco.taraFormula.sellerName || '');
      setLotNumber(editingTobacco.lotNumber);
      setPurchaseDate(editingTobacco.purchaseDate);
      setGrossWeightKg(editingTobacco.grossWeightKg);
      setPackagingMassKg(
        editingTobacco.packagingMassKg ??
          editingTobacco.taraFormula.packagingMassKg ??
          editingTobacco.taraFormula.flatKg ??
          3
      );
      setPricePerKgPurchase(editingTobacco.pricePerKgPurchase);
      setPercentTara(editingTobacco.taraFormula.percent);
      setFlatKgTara(editingTobacco.taraFormula.flatKg);
      setPackagingType(editingTobacco.taraFormula.packagingType || 'KRJ MUNTILAN');
      setTaraNotes(editingTobacco.taraFormula.notes || '');
      setAdditionalCost(editingTobacco.additionalPurchaseCost || 0);
      setPowerRating(clampRating5(editingTobacco.powerRating));
      setImpactRating(clampRating5(editingTobacco.impactRating));
      setBitterRating(clampRating5(editingTobacco.bitterRating));
      setBurnRating(clampRating5(editingTobacco.burnRating ?? 4.5));
      setSugarRating(clampRating5(editingTobacco.sugarRating ?? 4.0));
      setAromaRating(clampRating5(editingTobacco.aromaRating ?? 4.2));
      setColorGrade(editingTobacco.colorGrade);
      setCharacterNotes(editingTobacco.characterNotes || '');
    } else {
      const defaultPkg = packagingList[0];
      setName('Tembakau Muntilan Super');
      setOrigin('Muntilan');
      setSellerName('Pengepul Muntilan (Tara Eksklusif)');
      setLotNumber(`LOT-BAHAN-${Math.floor(100 + Math.random() * 900)}`);
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setGrossWeightKg(50);
      setPackagingMassKg(defaultPkg?.packagingMassKg ?? 3);
      setPricePerKgPurchase(80000);
      setPercentTara(defaultPkg?.taraPercent ?? 0);
      setFlatKgTara(defaultPkg?.taraFlatKg ?? 3);
      setPackagingType(defaultPkg?.name || 'KRJ MUNTILAN');
      setTaraNotes('Tara eksklusif seri/penjual. Netto Bayar = Bruto - Potongan Nota.');
      setAdditionalCost(0);
      setPowerRating(4.0);
      setImpactRating(4.0);
      setBitterRating(2.5);
      setBurnRating(4.5);
      setSugarRating(4.0);
      setAromaRating(4.2);
      setColorGrade('D+');
      setCharacterNotes(
        'Pegangan lemas berurat, gagang sedang, warna matang grade D+, burn & aroma bagus.'
      );
    }
  }, [editingTobacco, isOpen]);

  if (!isOpen) return null;

  const handleSelectPackaging = (pkgName: string) => {
    setPackagingType(pkgName);
    const found = packagingList.find((p) => p.name === pkgName);
    if (found) {
      setPackagingMassKg(found.packagingMassKg);
      setPercentTara(found.taraPercent);
      setFlatKgTara(found.taraFlatKg);
      if (found.notes) setTaraNotes(found.notes);
    }
  };

  const calculation = calculateRawTobaccoCost({
    grossWeightKg: Number(grossWeightKg) || 0,
    pricePerKgPurchase: Number(pricePerKgPurchase) || 0,
    realPackagingMassKg: Number(packagingMassKg) || 0,
    taraFormula: {
      rawFormula: formatTaraFormula(percentTara, flatKgTara),
      percent: Number(percentTara) || 0,
      flatKg: Number(flatKgTara) || 0,
      pricingBasis: 'NET_WEIGHT',
      packagingType,
      packagingMassKg: Number(packagingMassKg) || 0,
      sellerName,
    },
    additionalCost: Number(additionalCost) || 0,
  });

  const handleOpenStepByStep = (focus: RawTobaccoCalcFocus) => {
    setCalcDetail(
      buildRawTobaccoCalcDetail({
        name: name || 'Bahan Tembakau Mentah',
        packagingType,
        grossWeightKg: Number(grossWeightKg) || 0,
        realPackagingMassKg: Number(packagingMassKg) || 0,
        percentTara: Number(percentTara) || 0,
        flatKgTara: Number(flatKgTara) || 0,
        pricePerKg: Number(pricePerKgPurchase) || 0,
        additionalCost: Number(additionalCost) || 0,
        focus,
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const rawFormula = formatTaraFormula(percentTara, flatKgTara);
    const updated: RawTobacco = {
      id: editingTobacco ? editingTobacco.id : `tbk-raw-${Date.now()}`,
      name: name.trim(),
      origin: origin.trim(),
      sellerName: sellerName.trim(),
      lotNumber: lotNumber.trim() || `LOT-BAHAN-${Date.now()}`,
      purchaseDate,
      grossWeightKg: Number(grossWeightKg) || 0,
      packagingMassKg: Number(packagingMassKg) || 0,
      pricePerKgPurchase: Number(pricePerKgPurchase) || 0,
      taraFormula: {
        rawFormula,
        percent: Number(percentTara) || 0,
        flatKg: Number(flatKgTara) || 0,
        pricingBasis: 'NET_WEIGHT',
        packagingType,
        packagingMassKg: Number(packagingMassKg) || 0,
        sellerName: sellerName.trim(),
        notes: taraNotes,
      },
      additionalPurchaseCost: Number(additionalCost) || 0,
      deductionKg: calculation.deductionKg,
      netWeightKg: calculation.netWeightKg,
      totalModalAsal: calculation.totalModalAsal,
      realCostPerNetKg: calculation.realCostPerNetKg,
      realNetWeightKg: calculation.realNetWeightKg,
      realStockValueRp: calculation.realStockValueRp,
      purchaseWeightProfitKg: calculation.purchaseWeightProfitKg,
      purchaseWeightProfitRp: calculation.purchaseWeightProfitRp,
      effectiveCostPerRealKg: calculation.effectiveCostPerRealKg,
      currentStockNetKg: editingTobacco
        ? editingTobacco.currentStockNetKg
        : calculation.realNetWeightKg,
      powerRating: Number(powerRating) || 0,
      impactRating: Number(impactRating) || 0,
      bitterRating: Number(bitterRating) || 0,
      burnRating: Number(burnRating) || 0,
      sugarRating: Number(sugarRating) || 0,
      aromaRating: Number(aromaRating) || 0,
      colorGrade,
      characterNotes,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-black text-amber-400 border border-zinc-700">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {editingTobacco ? 'Edit Data Tembakau Mentah' : 'Tambah Bahan Tembakau & Kalkulasi Weight Profit'}
              </h2>
              <p className="text-xs text-zinc-400">
                Netto Bayar (Nota) vs Netto Riil (Sebenarnya) • Perbandingan Paid Value vs Real Value (Weight Profit)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-6 flex-1 text-sm">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 mb-3">
              1. Identitas Tembakau & Penjual (Tara Khusus Penjual/Seri)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Nama Tembakau / Rajangan *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Tembakau Muntilan Super"
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700 text-xs sm:text-sm"
                />
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Daerah Asal Tembakau *
                </label>
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white focus:outline-hidden focus:border-zinc-700 text-xs sm:text-sm"
                >
                  <option value="Temanggung">Temanggung (Sumbing/Sindoro)</option>
                  <option value="Muntilan">Muntilan / Magelang</option>
                  <option value="Madura">Madura (Pamekasan/Sumenep)</option>
                  <option value="Boyolali">Boyolali (Selo/Cepogo)</option>
                  <option value="Lombok">Lombok (Timur/Galep)</option>
                  <option value="Weleri">Weleri / Kendal</option>
                  <option value="Jember">Jember (Na-Oogst/Kasturi)</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center gap-1 text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                  <span>Nama Penjual / Pengepul</span>
                </label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Misal: H. Daryono (Tara Khusus)"
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-zinc-700"
                />
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Nomor Seri / Lot Beli
                </label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-hidden focus:border-zinc-700"
                />
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Tanggal Beli
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-zinc-700"
                />
              </div>
            </div>
          </div>

          <div className="bg-black p-4 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
                2. Perhitungan Timbangan Nota (Paid Value) vs Berat Sebenarnya (Real Value & Weight Profit)
              </h3>
              <span className="text-[11px] text-zinc-400 font-mono">
                Modal Bayar = Netto Nota × Harga Beli
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Pilih Jenis Kemasan (Otomatis Isi Wadah & Tarra)
                </label>
                <select
                  value={packagingType}
                  onChange={(e) => handleSelectPackaging(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs font-bold focus:outline-hidden focus:border-zinc-700"
                >
                  {packagingList.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} — Wadah Riil: {pkg.packagingMassKg}kg | Potongan Nota:{' '}
                      {formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)}
                    </option>
                  ))}
                </select>
                <p className="h-4 flex items-center text-[10px] text-zinc-400 truncate mt-1">
                  Otomatis memuat berat wadah asli & rumus tarra
                </p>
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Harga Beli / KG (Rp) *
                </label>
                <NumericInput
                  required
                  value={pricePerKgPurchase}
                  onChange={setPricePerKgPurchase}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-zinc-700"
                />
                <p className="h-4 flex items-center text-[10px] text-zinc-200 font-mono truncate mt-1">
                  Harga per KG: {formatRupiah(pricePerKgPurchase)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Berat Bruto (KG) *
                </label>
                <div className="relative">
                  <NumericInput
                    required
                    value={grossWeightKg}
                    onChange={setGrossWeightKg}
                    className="w-full h-10 px-3 pr-8 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-zinc-700"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                    kg
                  </span>
                </div>
                <p className="h-4 flex items-center text-[10px] text-zinc-400 truncate mt-1">
                  Misal: 50 kg
                </p>
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-zinc-200 whitespace-nowrap truncate mb-1">
                  Wadah Riil (KG) *
                </label>
                <div className="relative">
                  <NumericInput
                    value={packagingMassKg}
                    onChange={setPackagingMassKg}
                    className="w-full h-10 px-3 pr-8 bg-zinc-950 border border-zinc-700 rounded-xl text-zinc-200 font-mono font-bold text-sm focus:outline-hidden focus:border-white/70"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                    kg
                  </span>
                </div>
                <p className="h-4 flex items-center text-[10px] text-zinc-200 truncate mt-1">
                  Berat wadah asli (mis. 2kg)
                </p>
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-zinc-200 whitespace-nowrap truncate mb-1">
                  Tarra Flat Nota (KG) *
                </label>
                <div className="relative">
                  <NumericInput
                    value={flatKgTara}
                    onChange={setFlatKgTara}
                    className="w-full h-10 px-3 pr-8 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-zinc-700"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                    kg
                  </span>
                </div>
                <p className="h-4 flex items-center text-[10px] text-zinc-400 truncate mt-1">
                  Potongan kg nota
                </p>
              </div>

              <div className="flex flex-col">
                <label className="h-5 flex items-center text-xs font-bold text-white whitespace-nowrap truncate mb-1">
                  Tarra Persen Nota (%)
                </label>
                <div className="relative">
                  <NumericInput
                    value={percentTara}
                    onChange={setPercentTara}
                    className="w-full h-10 px-3 pr-8 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-zinc-700"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                    %
                  </span>
                </div>
                <p className="h-4 flex items-center text-[10px] text-zinc-400 truncate mt-1">
                  Misal: 10% (untuk 10%+2)
                </p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-zinc-300 shrink-0" />
                  <span>Perbandingan Nilai Bayar (Nota) vs Nilai Barang Riil (Real Value)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                  <CalcSymbolBadge />
                  <span>Simbol penanda rincian rumus</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                <button
                  type="button"
                  onClick={() => handleOpenStepByStep('PAID_VALUE')}
                  className="text-left group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-2"
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-400 uppercase font-extrabold truncate">
                        1. Hitungan Nota (Paid Value)
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-zinc-400">Potongan Nota:</span>
                      <b className="font-mono text-white">
                        -{calculation.deductionKg} kg ({formatTaraFormula(percentTara, flatKgTara)})
                      </b>
                    </div>
                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-zinc-400">Netto Bayar:</span>
                      <b className="font-mono text-white">{calculation.netWeightKg} kg</b>
                    </div>
                  </div>
                  <div className="w-full pt-2 border-t border-zinc-900 flex justify-between items-center text-xs">
                    <span className="text-zinc-300 font-bold">Total Kita Bayar:</span>
                    <b className="font-mono text-white text-sm">
                      {formatRupiah(calculation.totalModalAsal)}
                    </b>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenStepByStep('REAL_VALUE')}
                  className="text-left group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between h-full space-y-2"
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-200 uppercase font-extrabold truncate">
                        2. Berat & Nilai Riil (Real Value)
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-zinc-400">Potongan Wadah Riil:</span>
                      <b className="font-mono text-zinc-200">-{calculation.realPackagingMassKg} kg</b>
                    </div>
                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-zinc-400">Netto Riil Sebenarnya:</span>
                      <b className="font-mono text-white">{calculation.realNetWeightKg} kg</b>
                    </div>
                  </div>
                  <div className="w-full pt-2 border-t border-zinc-900 flex justify-between items-center text-xs">
                    <span className="text-zinc-200 font-bold">
                      Nilai Riil ({calculation.realNetWeightKg}×Harga):
                    </span>
                    <b className="font-mono text-zinc-200 text-sm">
                      {formatRupiah(calculation.realStockValueRp)}
                    </b>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenStepByStep('WEIGHT_PROFIT')}
                  className="text-left group bg-black p-3.5 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between h-full space-y-2"
                >
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-200 uppercase font-black truncate">
                        3. Weight Profit (Untung Timbangan)
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-zinc-300">Selisih Berat:</span>
                      <b
                        className={`font-mono ${
                          calculation.purchaseWeightProfitKg >= 0 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        {calculation.purchaseWeightProfitKg >= 0 ? '+' : ''}
                        {calculation.purchaseWeightProfitKg} kg
                      </b>
                    </div>
                    <div className="flex justify-between items-center text-xs gap-2">
                      <span className="text-zinc-300">Weight Profit (Rp):</span>
                      <b
                        className={`font-mono text-sm ${
                          calculation.purchaseWeightProfitRp >= 0 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        {calculation.purchaseWeightProfitRp >= 0 ? '+' : ''}
                        {formatRupiah(calculation.purchaseWeightProfitRp)}
                      </b>
                    </div>
                  </div>
                  <div className="w-full pt-2 border-t border-zinc-900 flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Modal Riil / KG Fisik:</span>
                    <b className="font-mono text-white">
                      {formatRupiah(calculation.effectiveCostPerRealKg)}/kg
                    </b>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200">
                3. Penilaian 6 Karakteristik Tembakau (Skala Maksimal /5)
              </h3>
              <span className="text-[11px] text-zinc-400">
                Geser slider atau klik tombol angka cepat (1 s/d 5)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <RatingSegmentSlider
                label="Power Rating"
                sublabel="Kekuatan nikotin & body"
                value={powerRating}
                onChange={setPowerRating}
              />
              <RatingSegmentSlider
                label="Impact Rating"
                sublabel="Tarikan tenggorokan (throat hit)"
                value={impactRating}
                onChange={setImpactRating}
              />
              <RatingSegmentSlider
                label="Bitter Rating"
                sublabel="Rasa pahit / gurih daun"
                value={bitterRating}
                onChange={setBitterRating}
              />
              <RatingSegmentSlider
                label="Burn Rating"
                sublabel="Daya bakar & kebersihan abu"
                value={burnRating}
                onChange={setBurnRating}
              />
              <RatingSegmentSlider
                label="Sugar Rating"
                sublabel="Kadar manis alami daun"
                value={sugarRating}
                onChange={setSugarRating}
              />
              <RatingSegmentSlider
                label="Aroma Rating"
                sublabel="Karakter aroma khas daun"
                value={aromaRating}
                onChange={setAromaRating}
              />
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-white">
                Pilih Grade Tembakau (A+, A, B+, B, C+, C, D+, D, E) *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
                {(Object.keys(GRADE_LABELS) as TobaccoGrade[]).map((grade) => {
                  const isSelected = colorGrade === grade;
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setColorGrade(grade)}
                      className={`h-10 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-black text-amber-400 border-zinc-700 font-black'
                          : 'bg-black border-zinc-800 text-white hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-sm font-black">{grade}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-200 mb-1">
                Deskripsi Fisik, Pegangan, Kadar Gagang & Catatan Tarra Penjual
              </label>
              <textarea
                rows={2}
                value={characterNotes}
                onChange={(e) => setCharacterNotes(e.target.value)}
                placeholder="Tulis detail pegangan (lemas/bergetah/kering), jumlah gagang, warna, serta catatan penjual..."
                className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700 text-xs"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-amber-outline h-10 px-5 rounded-xl font-black text-xs cursor-pointer"
            >
              {editingTobacco ? 'Simpan Perubahan' : 'Simpan Tembakau Mentah'}
            </button>
          </div>
        </form>
      </div>
      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
