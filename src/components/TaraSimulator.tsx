import React, { useState } from 'react';
import {
  Calculator,
  TrendingUp,
} from 'lucide-react';
import {
  calculateTaraDeduction,
  calculateRawTobaccoCost,
  formatRupiah,
  formatTaraFormula,
} from '../utils/tobaccoMath';
import { PackagingMaster, FactoryMaster } from '../types/tobacco';
import { NumericInput } from './NumericInput';
import { SegmentedControl } from './RatingSegmentSlider';

interface TaraSimulatorProps {
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
}

export const TaraSimulator: React.FC<TaraSimulatorProps> = ({
  packagingList = [],
  factoryList = [],
}) => {
  // Mobile one-by-one snapped panel switcher
  const [mobilePanel, setMobilePanel] = useState<'buy' | 'factory' | 'result'>('buy');

  // Sisi Pembelian
  const [purchaseGrossKg, setPurchaseGrossKg] = useState<number>(55);
  const [purchasePricePerKg, setPurchasePricePerKg] = useState<number>(80000);
  const [purchaseTaraPercent, setPurchaseTaraPercent] = useState<number>(0);
  const [purchaseTaraFlatKg, setPurchaseTaraFlatKg] = useState<number>(3);
  const [purchasePricingBasis, setPurchasePricingBasis] = useState<'GROSS_WEIGHT' | 'NET_WEIGHT'>(
    'NET_WEIGHT'
  );
  const [purchasePackaging, setPurchasePackaging] = useState('KRJ MUNTILAN');

  // Sisi Pemrosesan (Kemasan + Press)
  const [processingCost, setProcessingCost] = useState<number>(50000);

  // Sisi Setor ke Pabrik
  const [factoryPackageCount, setFactoryPackageCount] = useState<number>(1);
  const [factoryNetPerPack, setFactoryNetPerPack] = useState<number>(52);
  const [factoryPackagingMassKg, setFactoryPackagingMassKg] = useState<number>(3);
  const [factoryTaraPercent, setFactoryTaraPercent] = useState<number>(0);
  const [factoryTaraFlatKg, setFactoryTaraFlatKg] = useState<number>(3);
  const [factorySampleKg, setFactorySampleKg] = useState<number>(0);
  const [factoryTargetPricePerKg, setFactoryTargetPricePerKg] = useState<number>(140000);
  const [factoryPackagingType, setFactoryPackagingType] = useState('KRJ MUNTILAN');
  const [selectedFactoryName, setSelectedFactoryName] = useState('CELLO MUNTILAN');

  const purchaseCalc = calculateRawTobaccoCost({
    grossWeightKg: Number(purchaseGrossKg) || 0,
    pricePerKgPurchase: Number(purchasePricePerKg) || 0,
    taraFormula: {
      rawFormula: formatTaraFormula(purchaseTaraPercent, purchaseTaraFlatKg),
      percent: Number(purchaseTaraPercent) || 0,
      flatKg: Number(purchaseTaraFlatKg) || 0,
      pricingBasis: purchasePricingBasis,
      packagingType: purchasePackaging,
    },
    additionalCost: 0,
  });

  const factoryGrossPerPack = Number((factoryNetPerPack + factoryPackagingMassKg).toFixed(2));
  const factoryGrossTotal = factoryPackageCount * factoryGrossPerPack;
  const singlePackTara = calculateTaraDeduction(factoryGrossPerPack, {
    percent: Number(factoryTaraPercent) || 0,
    flatKg: Number(factoryTaraFlatKg) || 0,
    sampleKg: Number(factorySampleKg) || 0,
  });
  const factoryTotalDeductionKg = Number(
    (singlePackTara.deductionKg * factoryPackageCount).toFixed(2)
  );
  const factoryNetBillableKg = Number(
    Math.max(0, factoryGrossTotal - factoryTotalDeductionKg).toFixed(2)
  );

  const totalModalRiil = purchaseCalc.totalInvoiceCost + processingCost;
  const totalOmzetPabrik = factoryNetBillableKg * factoryTargetPricePerKg;
  const profitRiil = totalOmzetPabrik - totalModalRiil;
  const marginPercent = totalOmzetPabrik > 0 ? (profitRiil / totalOmzetPabrik) * 100 : 0;
  const bepPricePerKg = factoryNetBillableKg > 0 ? totalModalRiil / factoryNetBillableKg : 0;

  return (
    <div className="space-y-5 pb-16 md:pb-4">
      <div className="requiem-card p-4 sm:p-5 rounded-2xl border border-zinc-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-black text-amber-400 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Calculator className="w-5 h-5 stroke-[2.2]" />
          </span>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white">
              Simulator Potongan Tarra & Profit Pabrik
            </h1>
            <p className="text-xs text-zinc-400">
              Netto = Bruto − Tarra • Modal Asal = Harga × Netto • Proyeksi Profit Setoran
            </p>
          </div>
        </div>

        {/* Mobile One-by-One Snapped Panel Switcher */}
        <div className="lg:hidden">
          <SegmentedControl
            value={mobilePanel}
            onChange={setMobilePanel}
            className="w-full"
            options={[
              { id: 'buy', label: '1. Sisi Beli', fullLabel: '1. Sisi Pembelian Bahan' },
              { id: 'factory', label: '2. Sisi Pabrik', fullLabel: '2. Sisi Setor Nota Pabrik' },
              { id: 'result', label: '3. Profit & BEP', fullLabel: '3. Kesimpulan Profit & BEP' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Box: SISI PEMBELIAN */}
        <div
          className={`${
            mobilePanel === 'buy' ? 'block' : 'hidden lg:block'
          } requiem-card border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-black text-amber-400 border border-amber-500 flex items-center justify-center font-mono font-black text-xs">
                1
              </span>
              <h2 className="font-extrabold text-white text-sm sm:text-base">
                Sisi Pembelian (Modal Asal)
              </h2>
            </div>
            {packagingList.length > 0 && (
              <select
                value={purchasePackaging}
                onChange={(e) => {
                  setPurchasePackaging(e.target.value);
                  const found = packagingList.find((p) => p.name === e.target.value);
                  if (found) {
                    setPurchaseTaraPercent(found.taraPercent);
                    setPurchaseTaraFlatKg(found.taraFlatKg);
                  }
                }}
                className="h-9 px-2.5 bg-black border border-zinc-700 rounded-lg text-xs text-amber-400 font-bold"
              >
                {packagingList.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Bruto Beli (KG)
              </label>
              <NumericInput
                value={purchaseGrossKg}
                onChange={setPurchaseGrossKg}
                className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-white font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Harga Beli / KG (Rp)
              </label>
              <NumericInput
                value={purchasePricePerKg}
                onChange={setPurchasePricePerKg}
                className="w-full h-10 px-3 bg-black border border-zinc-800 rounded-xl text-amber-400 font-mono font-bold text-sm"
              />
            </div>
          </div>

          <div className="bg-black/90 p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Tarra Flat (KG)</label>
                <NumericInput
                  value={purchaseTaraFlatKg}
                  onChange={setPurchaseTaraFlatKg}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">Tarra Persen (%)</label>
                <NumericInput
                  value={purchaseTaraPercent}
                  onChange={setPurchaseTaraPercent}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Dasar Hitung Modal</label>
              <select
                value={purchasePricingBasis}
                onChange={(e) => setPurchasePricingBasis(e.target.value as any)}
                className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-bold"
              >
                <option value="NET_WEIGHT">Modal Asal = Harga × Netto (Bruto − Tarra)</option>
                <option value="GROSS_WEIGHT">Bayar Berdasarkan Berat Kotor (Bruto)</option>
              </select>
            </div>
          </div>

          <div className="bg-black/90 p-3.5 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-300">
              <span>Netto (Bruto − Tarra):</span>
              <span className="font-mono font-extrabold text-white">
                {purchaseGrossKg}kg − {purchaseCalc.deductionKg}kg = {purchaseCalc.netWeightKg} kg
              </span>
            </div>
            <div className="flex justify-between text-amber-400 font-black border-t border-zinc-900 pt-1.5 text-sm">
              <span>Modal Asal:</span>
              <span className="font-mono">{formatRupiah(purchaseCalc.totalModalAsal)}</span>
            </div>
          </div>
        </div>

        {/* Right Box: SISI SETOR PABRIK */}
        <div
          className={`${
            mobilePanel === 'factory' ? 'block' : 'hidden lg:block'
          } requiem-card border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-black text-amber-400 border border-amber-500 flex items-center justify-center font-mono font-black text-xs">
                2
              </span>
              <h2 className="font-extrabold text-white text-sm sm:text-base">
                Sisi Setor Nota Pabrik
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {packagingList.length > 0 && (
                <select
                  value={factoryPackagingType}
                  onChange={(e) => {
                    setFactoryPackagingType(e.target.value);
                    const found = packagingList.find((p) => p.name === e.target.value);
                    if (found) {
                      setFactoryPackagingMassKg(found.packagingMassKg);
                      setFactoryTaraPercent(found.taraPercent);
                      setFactoryTaraFlatKg(found.taraFlatKg);
                      setProcessingCost((found.packagingCostRp || 0) + (found.pressCostRp || 0));
                    }
                  }}
                  className="h-9 px-2.5 bg-black border border-zinc-700 rounded-lg text-[11px] text-amber-400 font-bold"
                >
                  {packagingList.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              {factoryList.length > 0 && (
                <select
                  value={selectedFactoryName}
                  onChange={(e) => {
                    setSelectedFactoryName(e.target.value);
                    const found = factoryList.find((f) => f.name === e.target.value);
                    if (found) {
                      setFactorySampleKg(found.sampleDeductionKg);
                    }
                  }}
                  className="h-9 px-2.5 bg-black border border-zinc-700 rounded-lg text-[11px] text-white font-bold"
                >
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
            <div>
              <label className="block text-[11px] text-zinc-300 mb-1">Jumlah Seri</label>
              <NumericInput
                allowDecimals={false}
                value={factoryPackageCount}
                onChange={(val) => setFactoryPackageCount(Math.max(1, val))}
                className="w-full h-9 px-2.5 bg-black border border-zinc-800 rounded-lg text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-300 mb-1">Netto (kg)</label>
              <NumericInput
                value={factoryNetPerPack}
                onChange={setFactoryNetPerPack}
                className="w-full h-9 px-2.5 bg-black border border-zinc-800 rounded-lg text-amber-400 font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-300 mb-1">Wadah (kg)</label>
              <NumericInput
                value={factoryPackagingMassKg}
                onChange={setFactoryPackagingMassKg}
                className="w-full h-9 px-2.5 bg-black border border-zinc-800 rounded-lg text-white font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] text-amber-400 font-bold mb-1">Bruto/Seri</label>
              <div className="h-9 px-2.5 flex items-center bg-black border border-amber-500/50 rounded-lg text-amber-400 font-mono font-bold text-xs">
                {factoryGrossPerPack} kg
              </div>
            </div>
          </div>

          <div className="bg-black/90 p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
            <div className="grid grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Tarra %</label>
                <NumericInput
                  value={factoryTaraPercent}
                  onChange={setFactoryTaraPercent}
                  className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Tarra Flat (kg)</label>
                <NumericInput
                  value={factoryTaraFlatKg}
                  onChange={setFactoryTaraFlatKg}
                  className="w-full h-9 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-400 mb-1">Sampel (kg)</label>
                <NumericInput
                  value={factorySampleKg}
                  onChange={setFactorySampleKg}
                  className="w-full h-9 px-2 bg-zinc-950 border border-amber-500/50 rounded-lg text-amber-400 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1 items-end">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Harga Pabrik / KG</label>
                <NumericInput
                  value={factoryTargetPricePerKg}
                  onChange={setFactoryTargetPricePerKg}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-amber-500/50 rounded-lg text-xs font-mono text-amber-400 font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Kemasan + Press</label>
                <NumericInput
                  value={processingCost}
                  onChange={setProcessingCost}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-black/90 p-3.5 rounded-xl border border-zinc-800 space-y-1.5 text-xs">
            <div className="flex justify-between text-zinc-300">
              <span>Netto Diakui Pabrik:</span>
              <span className="font-mono font-extrabold text-white">{factoryNetBillableKg} kg</span>
            </div>
            <div className="flex justify-between text-amber-400 font-black border-t border-zinc-900 pt-1.5 text-sm">
              <span>PROFIT BERSIH:</span>
              <span className="font-mono">
                {formatRupiah(profitRiil)} ({marginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Summary Card */}
      <div
        className={`${
          mobilePanel === 'result' ? 'block' : 'hidden lg:block'
        } requiem-card border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
      >
        <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          Kesimpulan Modal, BEP & Profit Nota Pabrik
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-center">
          <div className="bg-black p-3.5 rounded-xl border border-zinc-800">
            <div className="text-xs text-zinc-400">Total Modal Riil</div>
            <div className="text-base sm:text-lg font-black font-mono text-white mt-1">
              {formatRupiah(totalModalRiil)}
            </div>
          </div>

          <div className="bg-black p-3.5 rounded-xl border border-zinc-800">
            <div className="text-xs text-zinc-400">Harga Minimal BEP / KG</div>
            <div className="text-base sm:text-lg font-black font-mono text-amber-400 mt-1">
              {formatRupiah(bepPricePerKg)}
            </div>
          </div>

          <div className="bg-black p-3.5 rounded-xl border-2 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <div className="text-xs font-extrabold uppercase">PROFIT BERSIH</div>
            <div className="text-base sm:text-lg font-black font-mono text-white mt-1">
              {formatRupiah(profitRiil)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
