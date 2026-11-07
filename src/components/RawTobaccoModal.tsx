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

  // Timbangan & Pembelian (Netto = Bruto - Tarra, Modal Asal = Price * Netto)
  const [grossWeightKg, setGrossWeightKg] = useState<number>(55);
  const [packagingMassKg, setPackagingMassKg] = useState<number>(3);
  const [pricePerKgPurchase, setPricePerKgPurchase] = useState<number>(80000);
  const [percentTara, setPercentTara] = useState<number>(0);
  const [flatKgTara, setFlatKgTara] = useState<number>(3);
  const [pricingBasis, setPricingBasis] = useState<'GROSS_WEIGHT' | 'NET_WEIGHT'>('NET_WEIGHT');
  const [packagingType, setPackagingType] = useState('KRJ MUNTILAN');
  const [taraNotes, setTaraNotes] = useState('');
  const [additionalCost, setAdditionalCost] = useState<number>(0);

  // 5 Penilaian Sensoris (Skala /5)
  const [powerRating, setPowerRating] = useState<number>(4.0);
  const [impactRating, setImpactRating] = useState<number>(4.0);
  const [bitterRating, setBitterRating] = useState<number>(2.5);
  const [burnRating, setBurnRating] = useState<number>(4.5);
  const [sugarRating, setSugarRating] = useState<number>(4.0);
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
      setPackagingMassKg(editingTobacco.packagingMassKg ?? 3);
      setPricePerKgPurchase(editingTobacco.pricePerKgPurchase);
      setPercentTara(editingTobacco.taraFormula.percent);
      setFlatKgTara(editingTobacco.taraFormula.flatKg);
      setPricingBasis(editingTobacco.taraFormula.pricingBasis || 'NET_WEIGHT');
      setPackagingType(editingTobacco.taraFormula.packagingType || 'KRJ MUNTILAN');
      setTaraNotes(editingTobacco.taraFormula.notes || '');
      setAdditionalCost(editingTobacco.additionalPurchaseCost || 0);
      setPowerRating(clampRating5(editingTobacco.powerRating));
      setImpactRating(clampRating5(editingTobacco.impactRating));
      setBitterRating(clampRating5(editingTobacco.bitterRating));
      setBurnRating(clampRating5(editingTobacco.burnRating ?? 4.5));
      setSugarRating(clampRating5(editingTobacco.sugarRating ?? 4.0));
      setColorGrade(editingTobacco.colorGrade);
      setCharacterNotes(editingTobacco.characterNotes || '');
    } else {
      setName('Tembakau Muntilan Super');
      setOrigin('Muntilan');
      setSellerName('Pengepul Muntilan (Tara Eksklusif)');
      setLotNumber(`LOT-BAHAN-${Math.floor(100 + Math.random() * 900)}`);
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setGrossWeightKg(55);
      setPackagingMassKg(3);
      setPricePerKgPurchase(80000);
      setPercentTara(0);
      setFlatKgTara(3);
      setPricingBasis('NET_WEIGHT');
      setPackagingType(packagingList[0]?.name || 'KRJ MUNTILAN');
      setTaraNotes('Tara eksklusif seri/penjual 3 kg. Netto = Bruto - Tara.');
      setAdditionalCost(0);
      setPowerRating(4.0);
      setImpactRating(4.0);
      setBitterRating(2.5);
      setBurnRating(4.5);
      setSugarRating(4.0);
      setColorGrade('D+');
      setCharacterNotes(
        'Pegangan lemas berurat, gagang sedang, warna matang grade D+, pembakaran bagus.'
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
    taraFormula: {
      rawFormula: formatTaraFormula(percentTara, flatKgTara),
      percent: Number(percentTara) || 0,
      flatKg: Number(flatKgTara) || 0,
      pricingBasis,
      packagingType,
      packagingMassKg,
      sellerName,
    },
    additionalCost: Number(additionalCost) || 0,
  });

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
        pricingBasis,
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
      currentStockNetKg: editingTobacco ? editingTobacco.currentStockNetKg : calculation.netWeightKg,
      powerRating: Number(powerRating) || 0,
      impactRating: Number(impactRating) || 0,
      bitterRating: Number(bitterRating) || 0,
      burnRating: Number(burnRating) || 0,
      sugarRating: Number(sugarRating) || 0,
      colorGrade,
      characterNotes,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-950 border-2 border-amber-500/70 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-black text-amber-400 border border-amber-500">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {editingTobacco ? 'Edit Data Tembakau Mentah' : 'Tambah Bahan Tembakau & Rating (/5)'}
              </h2>
              <p className="text-xs text-zinc-400">
                Netto = Bruto − Tarra (Eksklusif per Seri/Penjual) • Modal Asal = Harga × Netto • Skala Rating /5
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-6 flex-1 text-sm">
          {/* Section 1: Data Identitas Bahan & Penjual */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-3">
              1. Identitas Tembakau & Penjual (Tara Khusus Penjual/Seri)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-white mb-1">
                  Nama Tembakau / Rajangan *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Tembakau Muntilan Super"
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Daerah Asal Tembakau *
                </label>
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white focus:outline-hidden focus:border-amber-500 text-xs sm:text-sm"
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

              <div>
                <label className="block text-xs font-bold text-white mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  Nama Penjual / Pengepul
                </label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Misal: H. Daryono (Tara Khusus)"
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Nomor Seri / Lot Beli
                </label>
                <input
                  type="text"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-amber-400 font-mono font-bold text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Tanggal Beli
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pembelian, Jenis Packaging & Rumus Netto = Bruto - Tarra */}
          <div className="bg-black p-4 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                2. Perhitungan Timbangan: Netto = Bruto − Tarra & Modal Asal = Harga × Netto
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-white mb-1">
                  Pilih Jenis Packaging (Auto-Fill Tarra Standar atau Sesuaikan Tarra Penjual)
                </label>
                <select
                  value={packagingType}
                  onChange={(e) => handleSelectPackaging(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-amber-500/60 rounded-xl text-white text-xs font-bold focus:outline-hidden focus:border-amber-400"
                >
                  {packagingList.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} — Tarra: {formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Sistem Hitung Modal Asal
                </label>
                <select
                  value={pricingBasis}
                  onChange={(e) => setPricingBasis(e.target.value as 'GROSS_WEIGHT' | 'NET_WEIGHT')}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-xs font-bold focus:outline-hidden focus:border-amber-500"
                >
                  <option value="NET_WEIGHT">Modal Asal = Harga × Netto (Standar)</option>
                  <option value="GROSS_WEIGHT">Bayar Bruto (Harga × Bruto)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Berat Bruto (KG) *
                </label>
                <NumericInput
                  required
                  value={grossWeightKg}
                  onChange={setGrossWeightKg}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Berat kotor timbangan</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-400 mb-1">
                  Tarra Flat Eksklusif (KG) *
                </label>
                <div className="relative">
                  <NumericInput
                    value={flatKgTara}
                    onChange={setFlatKgTara}
                    className="w-full h-10 px-3 pr-8 bg-zinc-950 border border-amber-500/60 rounded-xl text-amber-400 font-mono font-bold text-sm focus:outline-hidden focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">kg</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">Tarra khusus seri/penjual</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Tarra Persen (%) Opsional
                </label>
                <div className="relative">
                  <NumericInput
                    value={percentTara}
                    onChange={setPercentTara}
                    className="w-full h-10 px-3 pr-8 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono text-sm focus:outline-hidden focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">%</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">0% jika tarra flat murni</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1">
                  Harga Beli / KG (Rp) *
                </label>
                <NumericInput
                  required
                  value={pricePerKgPurchase}
                  onChange={setPricePerKgPurchase}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-hidden focus:border-amber-500"
                />
                <p className="text-[10px] text-amber-400 font-mono mt-1">{formatRupiah(pricePerKgPurchase)}</p>
              </div>
            </div>

            {/* Live Modal Asal = Price * Netto Indicator Card */}
            <div className="bg-zinc-950 border-2 border-amber-500/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400 flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-400" />
                  Rumus Aktif: Netto ({calculation.netWeightKg} kg) = Bruto ({grossWeightKg} kg) − Tarra ({calculation.deductionKg} kg)
                </span>
                <span className="font-mono text-white bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
                  Modal Asal = {formatRupiah(pricePerKgPurchase)} × {calculation.netWeightKg} kg
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="bg-black p-2.5 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Bruto</div>
                  <div className="font-mono font-extrabold text-white text-sm">
                    {grossWeightKg} kg
                  </div>
                </div>

                <div className="bg-black p-2.5 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Tarra Eksklusif</div>
                  <div className="font-mono font-extrabold text-amber-400 text-sm">
                    -{calculation.deductionKg} kg
                  </div>
                </div>

                <div className="bg-black p-2.5 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Netto (Bruto−Tarra)</div>
                  <div className="font-mono font-extrabold text-white text-sm">
                    {calculation.netWeightKg} kg
                  </div>
                </div>

                <div className="bg-black p-2.5 rounded-lg border border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.18)]">
                  <div className="text-[10px] uppercase font-extrabold">Modal Asal (Price×Netto)</div>
                  <div className="font-mono font-black text-xs sm:text-sm text-white">
                    {formatRupiah(calculation.totalModalAsal)}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs text-zinc-300 font-semibold">
                  Modal Riil per KG Bersih:
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-amber-400">
                  {formatRupiah(calculation.realCostPerNetKg)} / kg
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: 5 Parameter Penilaian Sensoris (/5) & Grade */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                3. Penilaian Karakteristik Tembakau (Skala Maksimal /5)
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
                label="Pembakaran Rating"
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
            </div>

            {/* Color Grade Selector (Black Fill + Amber Outline) */}
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
                          ? 'bg-black text-amber-400 border-amber-500 font-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                          : 'bg-black border-zinc-800 text-white hover:border-amber-500/40'
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

            {/* Detailed Physical & Sensory Description */}
            <div>
              <label className="block text-xs font-bold text-amber-400 mb-1">
                Deskripsi Fisik, Pegangan, Kadar Gagang & Catatan Tarra Penjual
              </label>
              <textarea
                rows={2}
                value={characterNotes}
                onChange={(e) => setCharacterNotes(e.target.value)}
                placeholder="Tulis detail pegangan (lemas/bergetah/kering), jumlah gagang, warna, serta catatan penjual..."
                className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500 text-xs"
              />
            </div>
          </div>

          {/* Modal Actions */}
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
    </div>
  );
};
