import React, { useState } from 'react';
import {
  Calculator,
  TrendingUp,
  Plus,
  Trash2,
  Layers,
  Package,
  Sparkles,
} from 'lucide-react';
import {
  calculateTaraDeduction,
  calculateRawTobaccoCost,
  formatRupiah,
  formatTaraFormula,
} from '../utils/tobaccoMath';
import {
  PackagingMaster,
  FactoryMaster,
  RawTobacco,
  TobaccoRollSample,
} from '../types/tobacco';
import { NumericInput } from './NumericInput';
import { SegmentedControl } from './RatingSegmentSlider';
import {
  CalculationDetailModal,
  CalculationDetailData,
  CalcSymbolBadge,
  RawTobaccoCalcFocus,
  buildRawTobaccoCalcDetail,
} from './CalculationDetailModal';

interface SimulatedIngredient {
  id: string;
  name: string;
  origin: string;
  grossKg: number;
  realPackagingMassKg: number;
  taraFlatKg: number;
  taraPercent: number;
  pricePerKg: number;
  pricingBasis: 'NET_WEIGHT' | 'GROSS_WEIGHT';
}

interface TaraSimulatorProps {
  rawTobaccos?: RawTobacco[];
  rollSamples?: TobaccoRollSample[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
}

export const TaraSimulator: React.FC<TaraSimulatorProps> = ({
  rawTobaccos = [],
  rollSamples = [],
  packagingList = [],
  factoryList = [],
}) => {
  // Mobile one-by-one snapped panel switcher
  const [mobilePanel, setMobilePanel] = useState<'buy' | 'factory' | 'result'>('buy');
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  // 1. MULTI-TOBACCO COMBINATION STATE (Multiple kinds of tobacco combined into 1 blend before selling to factory)
  const [simIngredients, setSimIngredients] = useState<SimulatedIngredient[]>(() => {
    if (rawTobaccos.length >= 2) {
      return rawTobaccos.slice(0, 3).map((raw, idx) => ({
        id: `sim-ing-${idx + 1}`,
        name: raw.name,
        origin: raw.origin,
        grossKg: raw.grossWeightKg || (idx === 0 ? 60 : idx === 1 ? 55 : 50),
        realPackagingMassKg:
          raw.taraFormula.packagingMassKg ?? raw.taraFormula.flatKg ?? 3,
        taraFlatKg: raw.taraFormula.flatKg ?? 3,
        taraPercent: raw.taraFormula.percent ?? 0,
        pricePerKg: raw.pricePerKgPurchase,
        pricingBasis: raw.taraFormula.pricingBasis || 'NET_WEIGHT',
      }));
    }
    return [
      {
        id: 'sim-1',
        name: 'Muntilan Super Grade E',
        origin: 'Muntilan',
        grossKg: 60,
        realPackagingMassKg: 3,
        taraFlatKg: 3,
        taraPercent: 0,
        pricePerKg: 95000,
        pricingBasis: 'NET_WEIGHT',
      },
      {
        id: 'sim-2',
        name: 'Temanggung Kemloko Grade D+',
        origin: 'Temanggung',
        grossKg: 55,
        realPackagingMassKg: 3,
        taraFlatKg: 3,
        taraPercent: 0,
        pricePerKg: 82000,
        pricingBasis: 'NET_WEIGHT',
      },
      {
        id: 'sim-3',
        name: 'Madura Prancak Manis (Karung Goni 2kg • Potongan 10%+2)',
        origin: 'Madura',
        grossKg: 50,
        realPackagingMassKg: 2,
        taraFlatKg: 2,
        taraPercent: 10,
        pricePerKg: 70000,
        pricingBasis: 'NET_WEIGHT',
      },
    ];
  });

  const [selectedStockIdToAdd, setSelectedStockIdToAdd] = useState<string>(
    rawTobaccos[0]?.id || ''
  );

  // 2. Sisi Setor ke Pabrik (Combined Blend -> Divided into Keranjang/Seri)
  const [autoSyncWeightFromBlend, setAutoSyncWeightFromBlend] = useState<boolean>(true);
  const [factoryPackageCount, setFactoryPackageCount] = useState<number>(3);
  const [manualNetPerPack, setManualNetPerPack] = useState<number>(50);
  const [factoryPackagingMassKg, setFactoryPackagingMassKg] = useState<number>(3);
  const [factoryTaraPercent, setFactoryTaraPercent] = useState<number>(0);
  const [factoryTaraFlatKg, setFactoryTaraFlatKg] = useState<number>(3);
  const [factorySampleKg, setFactorySampleKg] = useState<number>(0);
  const [factoryTargetPricePerKg, setFactoryTargetPricePerKg] = useState<number>(135000);
  const [packagingCostPerUnit, setPackagingCostPerUnit] = useState<number>(35000);
  const [pressCostPerUnit, setPressCostPerUnit] = useState<number>(15000);
  const [factoryPackagingType, setFactoryPackagingType] = useState('KRJ MUNTILAN');
  const [selectedFactoryName, setSelectedFactoryName] = useState('CELLO MUNTILAN');

  // Calculate each ingredient's Bruto, Tarra, Netto Bayar, Netto Riil, Paid Value, Real Value & Weight Profit
  const calculatedIngredients = simIngredients.map((item) => {
    const calc = calculateRawTobaccoCost({
      grossWeightKg: Number(item.grossKg) || 0,
      pricePerKgPurchase: Number(item.pricePerKg) || 0,
      taraFormula: {
        rawFormula: formatTaraFormula(item.taraPercent, item.taraFlatKg),
        percent: Number(item.taraPercent) || 0,
        flatKg: Number(item.taraFlatKg) || 0,
        pricingBasis: item.pricingBasis,
        packagingType: factoryPackagingType,
        packagingMassKg:
          item.realPackagingMassKg !== undefined
            ? Number(item.realPackagingMassKg)
            : Number(item.taraFlatKg) || 0,
      },
      additionalCost: 0,
    });
    return {
      ...item,
      deductionKg: calc.deductionKg,
      netWeightKg: calc.netWeightKg,
      realNetWeightKg: calc.realNetWeightKg,
      subtotalModal: calc.totalModalAsal,
      realStockValueRp: calc.realStockValueRp,
      purchaseWeightProfitKg: calc.purchaseWeightProfitKg,
      purchaseWeightProfitRp: calc.purchaseWeightProfitRp,
      realCostPerNetKg: calc.realCostPerNetKg,
      effectiveCostPerRealKg: calc.effectiveCostPerRealKg,
    };
  });

  const totalCombinedGrossKg = Number(
    calculatedIngredients.reduce((acc, i) => acc + (Number(i.grossKg) || 0), 0).toFixed(2)
  );
  const totalCombinedPurchaseTaraKg = Number(
    calculatedIngredients.reduce((acc, i) => acc + i.deductionKg, 0).toFixed(2)
  );
  const totalCombinedNetKg = Number(
    calculatedIngredients.reduce((acc, i) => acc + i.netWeightKg, 0).toFixed(2)
  );
  const totalCombinedRealNetKg = Number(
    calculatedIngredients.reduce((acc, i) => acc + i.realNetWeightKg, 0).toFixed(2)
  );
  const totalCombinedRawModalRp = Math.round(
    calculatedIngredients.reduce((acc, i) => acc + i.subtotalModal, 0)
  );
  const totalCombinedRealValueRp = Math.round(
    calculatedIngredients.reduce((acc, i) => acc + i.realStockValueRp, 0)
  );
  const totalBuyWeightProfitKg = Number(
    (totalCombinedRealNetKg - totalCombinedNetKg).toFixed(2)
  );
  const totalBuyWeightProfitRp = totalCombinedRealValueRp - totalCombinedRawModalRp;

  const weightedBlendHppPerNetKg =
    totalCombinedRealNetKg > 0
      ? Math.round(totalCombinedRawModalRp / totalCombinedRealNetKg)
      : 0;

  // Factory Packaging & Seri Division Math (uses Real Physical Tobacco Weight available)
  const safePackageCount = Math.max(1, factoryPackageCount);
  const effectiveNetPerPack = autoSyncWeightFromBlend
    ? Number((totalCombinedRealNetKg / safePackageCount).toFixed(2))
    : Number(manualNetPerPack) || 0;

  const factoryGrossPerPack = Number(
    (effectiveNetPerPack + (Number(factoryPackagingMassKg) || 0)).toFixed(2)
  );
  const factoryGrossTotal = Number((safePackageCount * factoryGrossPerPack).toFixed(2));

  const singlePackTara = calculateTaraDeduction(factoryGrossPerPack, {
    percent: Number(factoryTaraPercent) || 0,
    flatKg: Number(factoryTaraFlatKg) || 0,
    sampleKg: Number(factorySampleKg) || 0,
  });

  const factoryTotalDeductionKg = Number(
    (singlePackTara.deductionKg * safePackageCount).toFixed(2)
  );
  const factoryNetBillableKg = Number(
    Math.max(0, factoryGrossTotal - factoryTotalDeductionKg).toFixed(2)
  );

  // Factory-Side Weight Profit / Loss:
  // Real tobacco sent = effectiveNetPerPack * safePackageCount
  const totalRealTobaccoSentKg = Number((effectiveNetPerPack * safePackageCount).toFixed(2));
  const factoryWeightProfitKg = Number(
    (factoryNetBillableKg - totalRealTobaccoSentKg).toFixed(2)
  );
  const factoryWeightProfitRp = Math.round(
    factoryWeightProfitKg * (Number(factoryTargetPricePerKg) || 0)
  );

  const totalPackagingAndPressRp =
    safePackageCount * ((Number(packagingCostPerUnit) || 0) + (Number(pressCostPerUnit) || 0));

  // If autoSyncWeightFromBlend is off, scale raw cost proportionally to the simulated total net weight
  const effectiveRawModalForSimulation = autoSyncWeightFromBlend
    ? totalCombinedRawModalRp
    : Math.round(effectiveNetPerPack * safePackageCount * weightedBlendHppPerNetKg);

  const totalModalRiil = effectiveRawModalForSimulation + totalPackagingAndPressRp;
  const totalOmzetPabrik = Math.round(factoryNetBillableKg * (Number(factoryTargetPricePerKg) || 0));
  const profitRiil = totalOmzetPabrik - totalModalRiil;
  const profitPerSeri = Math.round(profitRiil / safePackageCount);
  const marginPercent = totalOmzetPabrik > 0 ? (profitRiil / totalOmzetPabrik) * 100 : 0;
  const bepPricePerKg =
    factoryNetBillableKg > 0 ? Math.round(totalModalRiil / factoryNetBillableKg) : 0;

  // Handlers for adding/updating/removing tobaccos in the combined simulation
  const handleAddFromStock = () => {
    const found = rawTobaccos.find((r) => r.id === selectedStockIdToAdd) || rawTobaccos[0];
    if (!found) {
      handleAddBlankIngredient();
      return;
    }
    setSimIngredients((prev) => [
      ...prev,
      {
        id: `sim-${Date.now()}`,
        name: found.name,
        origin: found.origin,
        grossKg: found.grossWeightKg || 50,
        realPackagingMassKg:
          found.taraFormula.packagingMassKg ?? found.taraFormula.flatKg ?? 3,
        taraFlatKg: found.taraFormula.flatKg ?? 3,
        taraPercent: found.taraFormula.percent ?? 0,
        pricePerKg: found.pricePerKgPurchase,
        pricingBasis: found.taraFormula.pricingBasis || 'NET_WEIGHT',
      },
    ]);
  };

  const handleAddBlankIngredient = () => {
    setSimIngredients((prev) => [
      ...prev,
      {
        id: `sim-${Date.now()}`,
        name: `Bahan Tembakau #${prev.length + 1}`,
        origin: 'Lokal',
        grossKg: 50,
        realPackagingMassKg: 2,
        taraFlatKg: 2,
        taraPercent: 10,
        pricePerKg: 70000,
        pricingBasis: 'NET_WEIGHT',
      },
    ]);
  };

  const handleLoadFromRoll = (rollId: string) => {
    const roll = rollSamples.find((r) => r.id === rollId);
    if (!roll || !roll.ingredientsSnapshot || roll.ingredientsSnapshot.length === 0) return;

    const loaded: SimulatedIngredient[] = roll.ingredientsSnapshot.map((ing, idx) => ({
      id: `sim-roll-${idx}-${Date.now()}`,
      name: ing.tobaccoName,
      origin: ing.origin,
      grossKg: Number((ing.usedNetKg + 3).toFixed(2)),
      realPackagingMassKg: 3,
      taraFlatKg: 3,
      taraPercent: 0,
      pricePerKg: ing.realCostPerNetKg,
      pricingBasis: 'NET_WEIGHT',
    }));
    setSimIngredients(loaded);
    if (roll.serialNumbers && roll.serialNumbers.length > 0) {
      setFactoryPackageCount(roll.serialNumbers.length);
    }
  };

  const updateIngredient = (id: string, patch: Partial<SimulatedIngredient>) => {
    setSimIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeIngredient = (id: string) => {
    if (simIngredients.length <= 1) return;
    setSimIngredients((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-5 pb-16 md:pb-4">
      {/* Header & Mobile Snapped Segment Switcher */}
      <div className="requiem-card p-4 sm:p-5 rounded-2xl border border-zinc-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-black text-amber-400 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
            <Calculator className="w-5 h-5 stroke-[2.2]" />
          </span>
          <div>
            <h1 className="text-base sm:text-xl font-black text-white">
              Simulator Racikan Multi-Bahan, Tarra & Profit Pabrik
            </h1>
            <p className="text-xs text-zinc-400">
              Gabungkan beberapa jenis tembakau (beda harga & tarra) menjadi 1 racikan, bagi ke keranjang/seri, dan hitung BEP & Profit Nota Pabrik.
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
              {
                id: 'buy',
                label: `1. Gabungan Bahan (${simIngredients.length})`,
                fullLabel: '1. Kombinasi Beberapa Jenis Tembakau & Modal Gabungan',
              },
              {
                id: 'factory',
                label: '2. Setor Pabrik',
                fullLabel: '2. Pembagian Keranjang/Seri & Potongan Tarra Pabrik',
              },
              {
                id: 'result',
                label: '3. Profit & BEP',
                fullLabel: '3. Kesimpulan Modal Gabungan, BEP & Profit Bersih',
              },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (7 Cols on Desktop): MULTI-TOBACCO COMBINATION BUILDER */}
        <div
          className={`${
            mobilePanel === 'buy' ? 'block' : 'hidden lg:block'
          } lg:col-span-7 requiem-card border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-black text-amber-400 border border-amber-500 flex items-center justify-center font-mono font-black text-xs shrink-0">
                1
              </span>
              <div>
                <h2 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5">
                  <span>Gabungan Beberapa Jenis Tembakau</span>
                  <span className="px-2 py-0.5 rounded bg-black border border-amber-500/70 text-amber-400 font-mono text-[10px]">
                    {simIngredients.length} Jenis
                  </span>
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Tambahkan semua jenis tembakau yang dicampur sebelum disetor ke pabrik
                </p>
              </div>
            </div>

            {/* Optional: Load Preset from an Existing Gulungan */}
            {rollSamples.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleLoadFromRoll(e.target.value);
                }}
                className="h-8 px-2.5 bg-black border border-zinc-700 hover:border-amber-500 rounded-lg text-[11px] text-amber-300 font-bold cursor-pointer"
                title="Muat komposisi bahan dari Arsip Gulungan yang sudah ada"
              >
                <option value="" disabled>
                  Muat Komposisi Gulungan...
                </option>
                {rollSamples.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rollNumber} — {r.recipeName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick-Add Bar: Pick from Stok Mentah or Add Custom Tobacco Row */}
          <div className="flex flex-wrap items-center gap-2 bg-black p-2.5 rounded-xl border border-zinc-800/90">
            {rawTobaccos.length > 0 && (
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <select
                  value={selectedStockIdToAdd}
                  onChange={(e) => setSelectedStockIdToAdd(e.target.value)}
                  className="h-9 flex-1 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-bold min-w-0"
                >
                  {rawTobaccos.map((raw) => (
                    <option key={raw.id} value={raw.id}>
                      {raw.name} ({raw.origin}) — {formatRupiah(raw.pricePerKgPurchase)}/kg
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddFromStock}
                  className="btn-amber-outline h-9 px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Dari Stok</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddBlankIngredient}
              className="h-9 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-amber-500/60 text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Jenis Tembakau Lain</span>
            </button>
          </div>

          {/* List of Combined Tobacco Types */}
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {calculatedIngredients.map((item, idx) => {
              const sharePercent =
                totalCombinedNetKg > 0
                  ? ((item.netWeightKg / totalCombinedNetKg) * 100).toFixed(1)
                  : '0.0';

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-black/95 border border-zinc-800 hover:border-amber-500/60 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-amber-500/70 text-amber-400 font-mono font-black text-[10px] shrink-0">
                        BAHAN #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateIngredient(item.id, { name: e.target.value })
                        }
                        placeholder="Nama jenis tembakau..."
                        className="h-8 flex-1 min-w-0 px-2.5 bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-lg text-xs font-bold text-white focus:outline-hidden"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-amber-300 font-bold">
                        {sharePercent}% Campuran
                      </span>
                      {simIngredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredient(item.id)}
                          className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-red-400 border border-zinc-800 cursor-pointer"
                          title="Hapus jenis tembakau ini dari simulasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inputs Row: Bruto, Wadah Riil, Tarra Flat, Tarra %, Harga Beli/KG (Symmetrical & Inline) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="flex flex-col">
                      <label className="h-4 flex items-center text-[10px] text-zinc-400 font-bold whitespace-nowrap truncate mb-1">
                        Bruto (KG)
                      </label>
                      <NumericInput
                        value={item.grossKg}
                        onChange={(val) => updateIngredient(item.id, { grossKg: val })}
                        className="w-full h-8 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="h-4 flex items-center text-[10px] text-amber-300 font-bold whitespace-nowrap truncate mb-1">
                        Wadah Riil (KG)
                      </label>
                      <NumericInput
                        value={item.realPackagingMassKg}
                        onChange={(val) =>
                          updateIngredient(item.id, { realPackagingMassKg: val })
                        }
                        className="w-full h-8 px-2 bg-zinc-950 border border-amber-500/60 rounded-lg text-amber-300 font-mono font-bold text-xs"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="h-4 flex items-center text-[10px] text-zinc-400 font-bold whitespace-nowrap truncate mb-1">
                        Tarra Flat (KG)
                      </label>
                      <NumericInput
                        value={item.taraFlatKg}
                        onChange={(val) => updateIngredient(item.id, { taraFlatKg: val })}
                        className="w-full h-8 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="h-4 flex items-center text-[10px] text-zinc-400 font-bold whitespace-nowrap truncate mb-1">
                        Tarra (%)
                      </label>
                      <NumericInput
                        value={item.taraPercent}
                        onChange={(val) => updateIngredient(item.id, { taraPercent: val })}
                        className="w-full h-8 px-2 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1 flex flex-col">
                      <label className="h-4 flex items-center text-[10px] text-amber-400 font-bold whitespace-nowrap truncate mb-1">
                        Harga Beli / KG
                      </label>
                      <NumericInput
                        value={item.pricePerKg}
                        onChange={(val) => updateIngredient(item.id, { pricePerKg: val })}
                        className="w-full h-8 px-2 bg-zinc-950 border border-amber-500/60 rounded-lg text-amber-400 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  {/* Computed Row for this Ingredient: Paid vs Real Weight & Weight Profit */}
                  <button
                    type="button"
                    onClick={() =>
                      setCalcDetail(
                        buildRawTobaccoCalcDetail({
                          name: item.name,
                          packagingType: factoryPackagingType,
                          grossWeightKg: item.grossKg,
                          realPackagingMassKg: item.realPackagingMassKg,
                          percentTara: item.taraPercent,
                          flatKgTara: item.taraFlatKg,
                          pricePerKg: item.pricePerKg,
                          focus: 'WEIGHT_PROFIT',
                        })
                      )
                    }
                    className="w-full text-left group flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-zinc-900 text-[11px] font-mono cursor-pointer hover:text-amber-300 transition-colors"
                  >
                    <span className="text-zinc-400">
                      Bayar: <b className="text-white">{item.netWeightKg}kg</b> ({formatRupiah(item.subtotalModal)}) • Riil:{' '}
                      <b className="text-amber-300">{item.realNetWeightKg}kg</b> ({formatRupiah(item.realStockValueRp)})
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`font-bold ${
                          item.purchaseWeightProfitKg >= 0 ? 'text-amber-400' : 'text-red-400'
                        }`}
                      >
                        Weight Profit: {item.purchaseWeightProfitKg >= 0 ? '+' : ''}
                        {item.purchaseWeightProfitKg} kg ({item.purchaseWeightProfitRp >= 0 ? '+' : ''}
                        {formatRupiah(item.purchaseWeightProfitRp)})
                      </span>
                      <CalcSymbolBadge />
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Combined Multi-Tobacco Totals Box with Paid vs Real Value & Buy-Side Weight Profit (Specific Per-Panel Breakdown) */}
          {(() => {
            const openStep1CalcModal = (focus: RawTobaccoCalcFocus) => {
              if (focus === 'PAID_VALUE') {
                setCalcDetail({
                  title: `1. Nilai Kita Bayar (${formatRupiah(totalCombinedRawModalRp)})`,
                  subtitle: `Gabungan ${simIngredients.length} Jenis Tembakau • Total Netto Nota ${totalCombinedNetKg} kg`,
                  badgeText: 'PANEL 1 SIMULATOR • ASAL ANGKA NILAI KITA BAYAR',
                  coreFormula:
                    'Total Nilai Kita Bayar = Σ ((Bruto − Potongan Nota) × Harga Beli / KG)',
                  steps: calculatedIngredients.map((ing, i) => ({
                    stepNumber: i + 1,
                    title: `Bahan #${i + 1}: ${ing.name}`,
                    formula: `Netto Bayar = Bruto ${ing.grossKg} kg − Potongan Nota ${ing.deductionKg} kg = ${ing.netWeightKg} kg`,
                    substitution: `${ing.netWeightKg} kg × ${formatRupiah(ing.pricePerKg)} = ${formatRupiah(ing.subtotalModal)}`,
                    resultLabel: 'Subtotal Bayar',
                    resultValue: formatRupiah(ing.subtotalModal),
                    explanation: `Bruto ${ing.grossKg} kg dikurangi potongan nota ${ing.deductionKg} kg menghasilkan ${ing.netWeightKg} kg yang dibayar.`,
                    highlight: 'white' as const,
                  })),
                  summaryRows: [
                    {
                      label: 'Total Bruto Gabungan',
                      value: `${totalCombinedGrossKg} kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Netto Bayar Nota',
                      value: `${totalCombinedNetKg} kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Nilai Kita Bayar',
                      value: formatRupiah(totalCombinedRawModalRp),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Angka ${formatRupiah(totalCombinedRawModalRp)} berasal dari penjumlahan uang nota seluruh ${simIngredients.length} bahan (${totalCombinedNetKg} kg Netto Bayar).`,
                });
                return;
              }

              if (focus === 'REAL_VALUE') {
                setCalcDetail({
                  title: `2. Nilai Barang Riil (${formatRupiah(totalCombinedRealValueRp)})`,
                  subtitle: `Gabungan ${simIngredients.length} Jenis Tembakau • Netto Fisik Riil ${totalCombinedRealNetKg} kg`,
                  badgeText: 'PANEL 2 SIMULATOR • ASAL ANGKA NILAI BARANG RIIL',
                  coreFormula:
                    'Total Nilai Barang Riil = Σ ((Bruto − Berat Wadah Riil) × Harga Beli / KG)',
                  steps: calculatedIngredients.map((ing, i) => ({
                    stepNumber: i + 1,
                    title: `Bahan #${i + 1}: ${ing.name}`,
                    formula: `Netto Riil = Bruto ${ing.grossKg} kg − Wadah Riil ${ing.realPackagingMassKg} kg = ${ing.realNetWeightKg} kg`,
                    substitution: `${ing.realNetWeightKg} kg × ${formatRupiah(ing.pricePerKg)} = ${formatRupiah(ing.realStockValueRp)}`,
                    resultLabel: 'Subtotal Riil',
                    resultValue: formatRupiah(ing.realStockValueRp),
                    explanation: `Bruto ${ing.grossKg} kg dikurangi berat wadah asli ${ing.realPackagingMassKg} kg menghasilkan ${ing.realNetWeightKg} kg fisik tembakau.`,
                    highlight: 'amber' as const,
                  })),
                  summaryRows: [
                    {
                      label: 'Total Netto Fisik Riil',
                      value: `${totalCombinedRealNetKg} kg`,
                      highlight: 'amber',
                    },
                    {
                      label: 'HPP Fisik Rata-Rata',
                      value: `${formatRupiah(weightedBlendHppPerNetKg)}/kg`,
                      highlight: 'white',
                    },
                    {
                      label: 'Total Nilai Barang Riil',
                      value: formatRupiah(totalCombinedRealValueRp),
                      highlight: 'amber',
                    },
                  ],
                  conclusion: `Angka ${formatRupiah(totalCombinedRealValueRp)} berasal dari berat fisik tembakau sebenarnya (${totalCombinedRealNetKg} kg) dikalikan harga beli masing-masing bahan.`,
                });
                return;
              }

              // focus === 'WEIGHT_PROFIT'
              setCalcDetail({
                title: `3. Weight Profit Beli (${totalBuyWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(totalBuyWeightProfitRp)})`,
                subtitle: `Selisih Berat: ${totalBuyWeightProfitKg >= 0 ? '+' : ''}${totalBuyWeightProfitKg} kg tembakau ekstra`,
                badgeText: 'PANEL 3 SIMULATOR • ASAL ANGKA WEIGHT PROFIT BELI',
                coreFormula:
                  'Weight Profit Beli = Total Nilai Barang Riil − Total Nilai Kita Bayar',
                steps: calculatedIngredients.map((ing, i) => ({
                  stepNumber: i + 1,
                  title: `Bahan #${i + 1}: ${ing.name}`,
                  formula: `Selisih Kg = Netto Riil ${ing.realNetWeightKg} kg − Netto Bayar ${ing.netWeightKg} kg = ${ing.purchaseWeightProfitKg >= 0 ? '+' : ''}${ing.purchaseWeightProfitKg} kg`,
                  substitution: `${ing.purchaseWeightProfitKg >= 0 ? '+' : ''}${ing.purchaseWeightProfitKg} kg × ${formatRupiah(ing.pricePerKg)} = ${ing.purchaseWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(ing.purchaseWeightProfitRp)}`,
                  resultLabel: 'Weight Profit',
                  resultValue: `${ing.purchaseWeightProfitKg >= 0 ? '+' : ''}${ing.purchaseWeightProfitKg} kg (${ing.purchaseWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(ing.purchaseWeightProfitRp)})`,
                  explanation: `Potongan nota ${ing.deductionKg} kg vs berat wadah riil ${ing.realPackagingMassKg} kg.`,
                  highlight: (ing.purchaseWeightProfitKg >= 0 ? 'amber' : 'red') as 'amber' | 'red',
                })),
                summaryRows: [
                  {
                    label: 'Total Selisih Berat',
                    value: `${totalBuyWeightProfitKg >= 0 ? '+' : ''}${totalBuyWeightProfitKg} kg`,
                    highlight: totalBuyWeightProfitKg >= 0 ? 'amber' : 'red',
                  },
                  {
                    label: 'Nilai Riil − Nilai Bayar',
                    value: `${formatRupiah(totalCombinedRealValueRp)} − ${formatRupiah(totalCombinedRawModalRp)}`,
                    highlight: 'white',
                  },
                  {
                    label: 'Weight Profit Beli (Rp)',
                    value: `${totalBuyWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(totalBuyWeightProfitRp)}`,
                    highlight: totalBuyWeightProfitRp >= 0 ? 'amber' : 'red',
                  },
                ],
                conclusion: `Weight Profit Beli ${totalBuyWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(totalBuyWeightProfitRp)} berasal dari selisih antara Nilai Barang Riil (${formatRupiah(totalCombinedRealValueRp)}) dan Nilai Kita Bayar (${formatRupiah(totalCombinedRawModalRp)}).`,
              });
            };

            return (
              <div className="bg-black p-3.5 sm:p-4 rounded-xl border-2 border-amber-500/70 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-amber-400 font-black uppercase tracking-wider text-[11px] flex-wrap gap-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Total Gabungan ({simIngredients.length} Jenis Tembakau)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 font-normal normal-case">
                    <CalcSymbolBadge />
                    <span>Simbol rincian angka</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 items-stretch">
                  <button
                    type="button"
                    onClick={() => openStep1CalcModal('PAID_VALUE')}
                    className="text-left group bg-zinc-950 p-3 rounded-lg border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1"
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold truncate">
                          1. Nilai Kita Bayar (Paid Value)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <b className="font-mono text-white text-sm sm:text-base block mt-0.5">
                        {formatRupiah(totalCombinedRawModalRp)}
                      </b>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-900 block w-full">
                      Netto Bayar Nota: {totalCombinedNetKg} kg
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openStep1CalcModal('REAL_VALUE')}
                    className="text-left group bg-zinc-950 p-3 rounded-lg border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1"
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] text-amber-300 block uppercase font-bold truncate">
                          2. Nilai Barang Riil (Real Value)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <b className="font-mono text-amber-300 text-sm sm:text-base block mt-0.5">
                        {formatRupiah(totalCombinedRealValueRp)}
                      </b>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-900 block w-full">
                      Netto Fisik Riil: {totalCombinedRealNetKg} kg ({formatRupiah(weightedBlendHppPerNetKg)}/kg)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openStep1CalcModal('WEIGHT_PROFIT')}
                    className="text-left group bg-zinc-950 p-3 rounded-lg border-2 border-amber-500 hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between h-full space-y-1"
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[10px] text-amber-400 block uppercase font-black truncate">
                          3. Weight Profit Beli (Stok)
                        </span>
                        <CalcSymbolBadge />
                      </div>
                      <b className="font-mono text-amber-400 text-sm sm:text-base block mt-0.5">
                        {totalBuyWeightProfitRp >= 0 ? '+' : ''}
                        {formatRupiah(totalBuyWeightProfitRp)}
                      </b>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-300 pt-1 border-t border-zinc-900 block w-full">
                      Selisih: {totalBuyWeightProfitKg >= 0 ? '+' : ''}
                      {totalBuyWeightProfitKg} kg tembakau ekstra
                    </span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* RIGHT COLUMN (5 Cols on Desktop): PEMBAGIAN KERANJANG & SETOR NOTA PABRIK */}
        <div
          className={`${
            mobilePanel === 'factory' ? 'block' : 'hidden lg:block'
          } lg:col-span-5 requiem-card border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-black text-amber-400 border border-amber-500 flex items-center justify-center font-mono font-black text-xs shrink-0">
                2
              </span>
              <div>
                <h2 className="font-extrabold text-white text-sm sm:text-base">
                  Setor ke Pabrik (Bagi ke Seri)
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Bandingkan Wadah Riil vs Potongan Tarra Pabrik (Weight Profit / Loss Setor)
                </p>
              </div>
            </div>
          </div>

          {/* Format Kemasan & Pabrik Selectors */}
          <div className="grid grid-cols-2 gap-2.5">
            {packagingList.length > 0 && (
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold uppercase mb-1">
                  Jenis Kemasan
                </label>
                <select
                  value={factoryPackagingType}
                  onChange={(e) => {
                    setFactoryPackagingType(e.target.value);
                    const found = packagingList.find((p) => p.name === e.target.value);
                    if (found) {
                      setFactoryPackagingMassKg(found.packagingMassKg);
                      setFactoryTaraPercent(found.taraPercent);
                      setFactoryTaraFlatKg(found.taraFlatKg);
                      setPackagingCostPerUnit(found.packagingCostRp || 0);
                      setPressCostPerUnit(found.pressCostRp || 0);
                    }
                  }}
                  className="w-full h-9 px-2.5 bg-black border border-zinc-700 rounded-lg text-xs text-amber-400 font-bold"
                >
                  {packagingList.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {factoryList.length > 0 && (
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold uppercase mb-1">
                  Target Pabrik
                </label>
                <select
                  value={selectedFactoryName}
                  onChange={(e) => {
                    setSelectedFactoryName(e.target.value);
                    const found = factoryList.find((f) => f.name === e.target.value);
                    if (found) {
                      setFactorySampleKg(found.sampleDeductionKg);
                    }
                  }}
                  className="w-full h-9 px-2.5 bg-black border border-zinc-700 rounded-lg text-xs text-white font-bold"
                >
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Toggle Auto-Sync Netto from Combined Blend */}
          <div className="bg-black/90 p-3 rounded-xl border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Gunakan Netto Fisik Riil Gabungan ({totalCombinedRealNetKg} kg)
              </span>
              <button
                type="button"
                onClick={() => setAutoSyncWeightFromBlend((v) => !v)}
                className={`h-7 px-2.5 rounded-lg text-[10px] font-black border cursor-pointer transition-colors ${
                  autoSyncWeightFromBlend
                    ? 'bg-black text-amber-400 border-amber-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                {autoSyncWeightFromBlend ? 'Otomatis Aktif' : 'Input Manual'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Jumlah Seri</label>
                <NumericInput
                  allowDecimals={false}
                  value={factoryPackageCount}
                  onChange={(val) => setFactoryPackageCount(Math.max(1, val))}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-white font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Netto Isi/Seri</label>
                {autoSyncWeightFromBlend ? (
                  <div className="h-9 px-2.5 flex items-center bg-zinc-950 border border-amber-500/50 rounded-lg text-amber-300 font-mono font-bold text-xs">
                    {effectiveNetPerPack} kg
                  </div>
                ) : (
                  <NumericInput
                    value={manualNetPerPack}
                    onChange={setManualNetPerPack}
                    className="w-full h-9 px-2.5 bg-zinc-950 border border-amber-500 rounded-lg text-amber-400 font-mono font-bold text-xs"
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-amber-300 font-bold mb-1">
                  Wadah Riil (kg)
                </label>
                <NumericInput
                  value={factoryPackagingMassKg}
                  onChange={setFactoryPackagingMassKg}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-amber-500/60 rounded-lg text-amber-300 font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-400 font-bold mb-1">
                  Bruto/Seri
                </label>
                <div className="h-9 px-2.5 flex items-center bg-black border border-amber-500/60 rounded-lg text-amber-400 font-mono font-bold text-xs">
                  {factoryGrossPerPack} kg
                </div>
              </div>
            </div>
          </div>

          {/* Factory Deductions & Packaging Costs */}
          <div className="bg-black/90 p-3.5 rounded-xl border border-zinc-800 space-y-3">
            <div className="grid grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Tarra Pabrik %</label>
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

            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Ongkos Kemasan / Seri
                </label>
                <NumericInput
                  value={packagingCostPerUnit}
                  onChange={setPackagingCostPerUnit}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Ongkos Press / Seri
                </label>
                <NumericInput
                  value={pressCostPerUnit}
                  onChange={setPressCostPerUnit}
                  className="w-full h-9 px-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="block text-xs font-black text-amber-400 mb-1">
                Target Harga Setor Pabrik / KG (Rp)
              </label>
              <NumericInput
                value={factoryTargetPricePerKg}
                onChange={setFactoryTargetPricePerKg}
                className="w-full h-10 px-3 bg-zinc-950 border-2 border-amber-500 rounded-xl text-sm font-mono text-amber-400 font-black"
              />
            </div>
          </div>

          {/* Quick Breakdown Card including Factory Weight Profit / Loss (Clickable for Step-by-Step) */}
          {(() => {
            const openFactorySimCalcModal = () => {
              setCalcDetail({
                title: `Rincian Simulasi Setoran Pabrik & BEP (${safePackageCount} Nomor Seri)`,
                subtitle: `Kemasan ${factoryPackagingType} • Pabrik ${selectedFactoryName} • Target ${formatRupiah(factoryTargetPricePerKg)}/kg`,
                badgeText: 'SIMULATOR LANGKAH 2 & 3: SETOR PABRIK & PROFIT',
                coreFormula:
                  'Profit Bersih = Tagihan Nota Pabrik (Netto Tagih × Harga Pabrik) − Total Modal Bayar (Bahan + Kemasan/Press)',
                steps: [
                  {
                    stepNumber: 1,
                    title: 'Pembagian Tembakau Fisik ke Kemasan & Bruto Setoran',
                    formula: 'Bruto / Seri = Netto Isi / Seri + Berat Wadah Riil  →  Total Bruto = Bruto / Seri × Jumlah Seri',
                    substitution: `(${effectiveNetPerPack} kg + ${factoryPackagingMassKg} kg) × ${safePackageCount} Seri = ${factoryGrossPerPack} kg × ${safePackageCount} = ${factoryGrossTotal} kg`,
                    resultLabel: 'Total Bruto',
                    resultValue: `${factoryGrossTotal} kg`,
                    explanation: `Total ${totalRealTobaccoSentKg} kg tembakau riil dibagi ke ${safePackageCount} kemasan (@ ${effectiveNetPerPack} kg + wadah riil ${factoryPackagingMassKg} kg).`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 2,
                    title: 'Hitung Potongan Tarra Pabrik & Netto Tagih (Billable Weight)',
                    formula: 'Potongan / Seri = (Bruto × % Tarra) + Tarra Flat + Sampel  →  Netto Tagih = Total Bruto − Total Potongan',
                    substitution: `Potongan = −${singlePackTara.deductionKg} kg × ${safePackageCount} Seri = −${factoryTotalDeductionKg} kg  →  Netto Tagih = ${factoryGrossTotal} − ${factoryTotalDeductionKg} = ${factoryNetBillableKg} kg`,
                    resultLabel: 'Netto Tagih',
                    resultValue: `${factoryNetBillableKg} kg`,
                    explanation: `Setelah dikurangi potongan pabrik (${formatTaraFormula(factoryTaraPercent, factoryTaraFlatKg, factorySampleKg)}), berat bersih yang diakui nota pabrik adalah ${factoryNetBillableKg} kg.`,
                    highlight: 'amber',
                  },
                  {
                    stepNumber: 3,
                    title: 'Hitung Selisih Timbangan Pabrik (Factory Weight Profit / Loss)',
                    formula: 'Selisih Timbangan Pabrik = (Netto Tagih Pabrik − Netto Tembakau Riil Dikirim) × Harga Pabrik',
                    substitution: `(${factoryNetBillableKg} kg − ${totalRealTobaccoSentKg} kg) × ${formatRupiah(factoryTargetPricePerKg)} = ${factoryWeightProfitKg >= 0 ? '+' : ''}${factoryWeightProfitKg} kg (${factoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(factoryWeightProfitRp)})`,
                    resultLabel: 'Selisih Pabrik',
                    resultValue: `${factoryWeightProfitKg >= 0 ? '+' : ''}${factoryWeightProfitKg} kg (${factoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(factoryWeightProfitRp)})`,
                    explanation:
                      factoryWeightProfitKg >= 0
                        ? `Berat wadah riil (${factoryPackagingMassKg} kg/seri) dibanding potongan pabrik (${singlePackTara.deductionKg} kg/seri) memberikan selisih +${factoryWeightProfitKg} kg (+${formatRupiah(factoryWeightProfitRp)}).`
                        : `Potongan pabrik (${singlePackTara.deductionKg} kg/seri) lebih besar dari berat wadah riil (${factoryPackagingMassKg} kg/seri), sehingga terjadi susut timbangan ${factoryWeightProfitKg} kg (${formatRupiah(factoryWeightProfitRp)}).`,
                    highlight: factoryWeightProfitKg >= 0 ? 'amber' : 'red',
                  },
                  {
                    stepNumber: 4,
                    title: 'Hitung Total Modal Bayar & Harga Minimal BEP / KG',
                    formula: 'Total Modal = Modal Bahan + (Kemasan + Press)  →  BEP / KG = Total Modal ÷ Netto Tagih Pabrik',
                    substitution: `${formatRupiah(effectiveRawModalForSimulation)} + ${formatRupiah(totalPackagingAndPressRp)} = ${formatRupiah(totalModalRiil)}  →  BEP = ${formatRupiah(totalModalRiil)} ÷ ${factoryNetBillableKg} kg = ${formatRupiah(bepPricePerKg)}/kg`,
                    resultLabel: 'BEP / KG',
                    resultValue: `${formatRupiah(bepPricePerKg)}/kg`,
                    explanation: `Agar tidak rugi setelah potongan tarra pabrik, harga jual minimal (Break-Even Point) ke pabrik adalah ${formatRupiah(bepPricePerKg)}/kg.`,
                    highlight: 'white',
                  },
                  {
                    stepNumber: 5,
                    title: 'Hitung Total Tagihan Nota Pabrik & Profit Bersih',
                    formula: 'Tagihan Nota = Netto Tagih × Harga Pabrik  →  Profit Bersih = Tagihan Nota − Total Modal',
                    substitution: `${factoryNetBillableKg} kg × ${formatRupiah(factoryTargetPricePerKg)} = ${formatRupiah(totalOmzetPabrik)}  →  ${formatRupiah(totalOmzetPabrik)} − ${formatRupiah(totalModalRiil)} = ${formatRupiah(profitRiil)} (${marginPercent.toFixed(1)}%)`,
                    resultLabel: 'Profit Bersih',
                    resultValue: `${profitRiil >= 0 ? '+' : ''}${formatRupiah(profitRiil)}`,
                    explanation: `Rata-rata profit per Nomor Seri adalah ${formatRupiah(profitPerSeri)}/seri.`,
                    highlight: profitRiil >= 0 ? 'amber' : 'red',
                  },
                ],
                summaryRows: [
                  {
                    label: 'Total Modal Bayar',
                    value: formatRupiah(totalModalRiil),
                    highlight: 'white',
                  },
                  {
                    label: 'Weight Profit (Beli + Pabrik)',
                    value: `${totalBuyWeightProfitRp + factoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(totalBuyWeightProfitRp + factoryWeightProfitRp)}`,
                    highlight:
                      totalBuyWeightProfitRp + factoryWeightProfitRp >= 0 ? 'amber' : 'red',
                  },
                  {
                    label: 'Total Profit Bersih',
                    value: `${formatRupiah(profitRiil)} (${marginPercent.toFixed(1)}%)`,
                    highlight: profitRiil >= 0 ? 'amber' : 'red',
                  },
                ],
                conclusion: `Dari total modal bayar ${formatRupiah(totalModalRiil)} (BEP ${formatRupiah(bepPricePerKg)}/kg) dan tagihan nota pabrik ${formatRupiah(totalOmzetPabrik)} untuk ${factoryNetBillableKg} kg Netto Tagih, dihasilkan Profit Bersih ${formatRupiah(profitRiil)} (${formatRupiah(profitPerSeri)} per Seri).`,
              });
            };

            return (
              <>
                <button
                  type="button"
                  onClick={openFactorySimCalcModal}
                  className="w-full text-left group bg-black/95 p-3.5 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-900">
                    <span className="font-sans text-[10px] font-black uppercase text-amber-400">
                      Ringkasan Timbangan & Potongan Setor Pabrik
                    </span>
                    <CalcSymbolBadge />
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Bruto ({safePackageCount} Seri):</span>
                    <b className="text-white">{factoryGrossTotal} kg</b>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Netto Tembakau Riil Dikirim:</span>
                    <b className="text-amber-300">{totalRealTobaccoSentKg} kg</b>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Potongan Tarra Pabrik:</span>
                    <b className="text-amber-400">-{factoryTotalDeductionKg} kg</b>
                  </div>
                  <div className="flex justify-between text-zinc-200">
                    <span>Netto Diakui / Ditagih Pabrik:</span>
                    <b className="text-white">{factoryNetBillableKg} kg</b>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-zinc-900">
                    <span className="text-amber-400 font-bold">Selisih Timbangan Pabrik:</span>
                    <b className={factoryWeightProfitKg >= 0 ? 'text-amber-300' : 'text-red-400'}>
                      {factoryWeightProfitKg >= 0 ? '+' : ''}
                      {factoryWeightProfitKg} kg ({factoryWeightProfitRp >= 0 ? '+' : ''}
                      {formatRupiah(factoryWeightProfitRp)})
                    </b>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Total Kemasan + Press ({safePackageCount} Seri):</span>
                    <b className="text-white">{formatRupiah(totalPackagingAndPressRp)}</b>
                  </div>
                  <div className="flex justify-between text-amber-400 font-black border-t border-zinc-900 pt-2 text-sm">
                    <span>PROFIT BERSIH:</span>
                    <span>
                      {formatRupiah(profitRiil)} ({marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Bottom Summary Card (All 5 Panels Symmetrical & Specific Per-Panel Breakdown) */}
      {(() => {
        type Step3Focus =
          | 'TOTAL_MODAL'
          | 'COMBINED_WEIGHT_PROFIT'
          | 'BEP_PER_KG'
          | 'TOTAL_NOTA'
          | 'NET_PROFIT';

        const openStep3Modal = (focus: Step3Focus) => {
          if (focus === 'TOTAL_MODAL') {
            setCalcDetail({
              title: `1. Total Modal Bayar (${formatRupiah(totalModalRiil)})`,
              subtitle: `Modal Bahan ${formatRupiah(effectiveRawModalForSimulation)} + Kemasan & Press ${formatRupiah(totalPackagingAndPressRp)}`,
              badgeText: 'PANEL 1 KESIMPULAN • ASAL ANGKA TOTAL MODAL BAYAR',
              coreFormula:
                'Total Modal Bayar = Modal Bayar Nota Bahan + (Jumlah Seri × (Ongkos Kemasan + Ongkos Press))',
              steps: [
                {
                  stepNumber: 1,
                  title: 'Hitung Total Modal Bayar Bahan Baku',
                  formula: 'Modal Bahan = Σ (Netto Bayar Nota × Harga Beli / KG)',
                  substitution: `${simIngredients.length} Jenis Bahan = ${formatRupiah(effectiveRawModalForSimulation)}`,
                  resultLabel: 'Modal Bahan',
                  resultValue: formatRupiah(effectiveRawModalForSimulation),
                  explanation: `Total uang kas untuk membeli seluruh bahan tembakau adalah ${formatRupiah(effectiveRawModalForSimulation)}.`,
                  highlight: 'white',
                },
                {
                  stepNumber: 2,
                  title: 'Hitung Total Ongkos Kemasan & Pengepresan',
                  formula: 'Biaya Kemas & Press = Jumlah Seri × (Harga Kemasan + Ongkos Press)',
                  substitution: `${safePackageCount} Seri × (${formatRupiah(packagingCostPerUnit)} + ${formatRupiah(pressCostPerUnit)}) = ${formatRupiah(totalPackagingAndPressRp)}`,
                  resultLabel: 'Kemas & Press',
                  resultValue: formatRupiah(totalPackagingAndPressRp),
                  explanation: `Biaya operasional untuk ${safePackageCount} kemasan ${factoryPackagingType}.`,
                  highlight: 'white',
                },
                {
                  stepNumber: 3,
                  title: 'Jumlahkan Total Modal Bayar',
                  formula: 'Total Modal Bayar = Modal Bahan + Biaya Kemas & Press',
                  substitution: `${formatRupiah(effectiveRawModalForSimulation)} + ${formatRupiah(totalPackagingAndPressRp)} = ${formatRupiah(totalModalRiil)}`,
                  resultLabel: 'Total Modal Bayar',
                  resultValue: formatRupiah(totalModalRiil),
                  explanation: `Seluruh uang kas yang keluar sampai barang siap disetor ke pabrik adalah ${formatRupiah(totalModalRiil)}.`,
                  highlight: 'amber',
                },
              ],
              summaryRows: [
                {
                  label: 'Modal Bahan',
                  value: formatRupiah(effectiveRawModalForSimulation),
                  highlight: 'white',
                },
                {
                  label: `Kemas & Press (${safePackageCount} Seri)`,
                  value: formatRupiah(totalPackagingAndPressRp),
                  highlight: 'white',
                },
                {
                  label: 'Total Modal Bayar',
                  value: formatRupiah(totalModalRiil),
                  highlight: 'amber',
                },
              ],
              conclusion: `Total Modal Bayar sebesar ${formatRupiah(totalModalRiil)} berasal dari Modal Bahan ${formatRupiah(effectiveRawModalForSimulation)} ditambah biaya Kemas & Press ${formatRupiah(totalPackagingAndPressRp)}.`,
            });
            return;
          }

          if (focus === 'COMBINED_WEIGHT_PROFIT') {
            const combinedWpRp = totalBuyWeightProfitRp + factoryWeightProfitRp;
            setCalcDetail({
              title: `2. Weight Profit Beli + Pabrik (${combinedWpRp >= 0 ? '+' : ''}${formatRupiah(combinedWpRp)})`,
              subtitle: `Beli ${totalBuyWeightProfitKg >= 0 ? '+' : ''}${totalBuyWeightProfitKg} kg • Pabrik ${factoryWeightProfitKg >= 0 ? '+' : ''}${factoryWeightProfitKg} kg`,
              badgeText: 'PANEL 2 KESIMPULAN • ASAL ANGKA WEIGHT PROFIT GABUNGAN',
              coreFormula:
                'Total Weight Profit = Weight Profit Beli (Stok) + Selisih Timbangan Setor Pabrik',
              steps: [
                {
                  stepNumber: 1,
                  title: 'Weight Profit Saat Membeli Bahan (Stok Mentah)',
                  formula: 'Weight Profit Beli = Nilai Barang Riil − Nilai Kita Bayar',
                  substitution: `${totalCombinedRealNetKg} kg − ${totalCombinedNetKg} kg = ${totalBuyWeightProfitKg >= 0 ? '+' : ''}${totalBuyWeightProfitKg} kg (${totalBuyWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(totalBuyWeightProfitRp)})`,
                  resultLabel: 'Weight Profit Beli',
                  resultValue: `${totalBuyWeightProfitKg >= 0 ? '+' : ''}${totalBuyWeightProfitKg} kg (${totalBuyWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(totalBuyWeightProfitRp)})`,
                  explanation: `Keuntungan dari potongan tarra beli yang lebih besar daripada berat wadah asli.`,
                  highlight: totalBuyWeightProfitKg >= 0 ? 'amber' : 'red',
                },
                {
                  stepNumber: 2,
                  title: 'Weight Profit / Loss Saat Setor ke Pabrik',
                  formula: 'Selisih Timbangan Pabrik = (Netto Tagih Pabrik − Tembakau Riil) × Harga Pabrik',
                  substitution: `(${factoryNetBillableKg} kg − ${totalRealTobaccoSentKg} kg) × ${formatRupiah(factoryTargetPricePerKg)} = ${factoryWeightProfitKg >= 0 ? '+' : ''}${factoryWeightProfitKg} kg (${factoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(factoryWeightProfitRp)})`,
                  resultLabel: 'Selisih Pabrik',
                  resultValue: `${factoryWeightProfitKg >= 0 ? '+' : ''}${factoryWeightProfitKg} kg (${factoryWeightProfitRp >= 0 ? '+' : ''}${formatRupiah(factoryWeightProfitRp)})`,
                  explanation: `Selisih antara berat wadah ${factoryPackagingType} (${factoryPackagingMassKg} kg/seri) dengan potongan pabrik (${singlePackTara.deductionKg} kg/seri).`,
                  highlight: factoryWeightProfitKg >= 0 ? 'amber' : 'red',
                },
                {
                  stepNumber: 3,
                  title: 'Jumlahkan Total Weight Profit (Beli + Pabrik)',
                  formula: 'Total Weight Profit = Weight Profit Beli + Selisih Timbangan Pabrik',
                  substitution: `${formatRupiah(totalBuyWeightProfitRp)} + (${formatRupiah(factoryWeightProfitRp)}) = ${combinedWpRp >= 0 ? '+' : ''}${formatRupiah(combinedWpRp)}`,
                  resultLabel: 'Total Weight Profit',
                  resultValue: `${combinedWpRp >= 0 ? '+' : ''}${formatRupiah(combinedWpRp)}`,
                  explanation: `Total kontribusi selisih timbangan (beli + pabrik) terhadap profit keseluruhan.`,
                  highlight: combinedWpRp >= 0 ? 'amber' : 'red',
                },
              ],
              summaryRows: [
                {
                  label: 'Weight Profit Beli',
                  value: `${totalBuyWeightProfitKg >= 0 ? '+' : ''}${totalBuyWeightProfitKg} kg (${formatRupiah(totalBuyWeightProfitRp)})`,
                  highlight: totalBuyWeightProfitKg >= 0 ? 'amber' : 'red',
                },
                {
                  label: 'Selisih Timbangan Pabrik',
                  value: `${factoryWeightProfitKg >= 0 ? '+' : ''}${factoryWeightProfitKg} kg (${formatRupiah(factoryWeightProfitRp)})`,
                  highlight: factoryWeightProfitKg >= 0 ? 'amber' : 'red',
                },
                {
                  label: 'Total Weight Profit',
                  value: `${combinedWpRp >= 0 ? '+' : ''}${formatRupiah(combinedWpRp)}`,
                  highlight: combinedWpRp >= 0 ? 'amber' : 'red',
                },
              ],
              conclusion: `Angka ${combinedWpRp >= 0 ? '+' : ''}${formatRupiah(combinedWpRp)} berasal dari penggabungan Weight Profit Beli (${formatRupiah(totalBuyWeightProfitRp)}) dan Selisih Timbangan Pabrik (${formatRupiah(factoryWeightProfitRp)}).`,
            });
            return;
          }

          if (focus === 'BEP_PER_KG') {
            setCalcDetail({
              title: `3. Harga Minimal BEP / KG (${formatRupiah(bepPricePerKg)}/kg)`,
              subtitle: `Total Modal ${formatRupiah(totalModalRiil)} ÷ Netto Tagih Pabrik ${factoryNetBillableKg} kg`,
              badgeText: 'PANEL 3 KESIMPULAN • ASAL ANGKA HARGA MINIMAL BEP / KG',
              coreFormula:
                'Harga Minimal BEP / KG = Total Modal Bayar ÷ Netto Diakui Pabrik',
              steps: [
                {
                  stepNumber: 1,
                  title: 'Hitung Netto Diakui / Ditagih Pabrik',
                  formula: 'Netto Tagih Pabrik = Total Bruto Setoran − Total Potongan Tarra Pabrik',
                  substitution: `${factoryGrossTotal} kg − ${factoryTotalDeductionKg} kg = ${factoryNetBillableKg} kg`,
                  resultLabel: 'Netto Tagih Pabrik',
                  resultValue: `${factoryNetBillableKg} kg`,
                  explanation: `Berat bersih yang akan dikalikan harga beli oleh pabrik adalah ${factoryNetBillableKg} kg.`,
                  highlight: 'white',
                },
                {
                  stepNumber: 2,
                  title: 'Bagi Total Modal Bayar dengan Netto Tagih Pabrik',
                  formula: 'Harga BEP / KG = Total Modal Bayar ÷ Netto Tagih Pabrik',
                  substitution: `${formatRupiah(totalModalRiil)} ÷ ${factoryNetBillableKg} kg = ${formatRupiah(bepPricePerKg)}/kg`,
                  resultLabel: 'Harga BEP / KG',
                  resultValue: `${formatRupiah(bepPricePerKg)}/kg`,
                  explanation: `Jika pabrik membeli tepat di harga ${formatRupiah(bepPricePerKg)}/kg, maka tagihan nota sama persis dengan modal kita (impas / Break-Even Point).`,
                  highlight: 'amber',
                },
              ],
              summaryRows: [
                {
                  label: 'Total Modal Bayar',
                  value: formatRupiah(totalModalRiil),
                  highlight: 'white',
                },
                {
                  label: 'Netto Tagih Pabrik',
                  value: `${factoryNetBillableKg} kg`,
                  highlight: 'white',
                },
                {
                  label: 'Harga Minimal BEP / KG',
                  value: `${formatRupiah(bepPricePerKg)}/kg`,
                  highlight: 'amber',
                },
              ],
              conclusion: `Harga Minimal BEP ${formatRupiah(bepPricePerKg)}/kg berasal dari Total Modal Bayar ${formatRupiah(totalModalRiil)} dibagi Netto Tagih Pabrik ${factoryNetBillableKg} kg.`,
            });
            return;
          }

          if (focus === 'TOTAL_NOTA') {
            setCalcDetail({
              title: `4. Total Tagihan Nota Pabrik (${formatRupiah(totalOmzetPabrik)})`,
              subtitle: `Netto Tagih ${factoryNetBillableKg} kg × Harga Pabrik ${formatRupiah(factoryTargetPricePerKg)}/kg`,
              badgeText: 'PANEL 4 KESIMPULAN • ASAL ANGKA TOTAL TAGIHAN NOTA PABRIK',
              coreFormula:
                'Total Tagihan Nota Pabrik = Netto Tagih Pabrik × Target Harga Pabrik / KG',
              steps: [
                {
                  stepNumber: 1,
                  title: 'Hitung Netto Tagih Pabrik dari Seluruh Seri',
                  formula: 'Netto Tagih = Total Bruto − Total Potongan Tarra Pabrik',
                  substitution: `${factoryGrossTotal} kg (${safePackageCount} Seri) − ${factoryTotalDeductionKg} kg = ${factoryNetBillableKg} kg`,
                  resultLabel: 'Netto Tagih',
                  resultValue: `${factoryNetBillableKg} kg`,
                  explanation: `Total berat bersih di nota pabrik untuk ${safePackageCount} Nomor Seri.`,
                  highlight: 'white',
                },
                {
                  stepNumber: 2,
                  title: 'Kalikan Netto Tagih dengan Harga Pabrik / KG',
                  formula: 'Total Tagihan Nota = Netto Tagih × Harga Pabrik / KG',
                  substitution: `${factoryNetBillableKg} kg × ${formatRupiah(factoryTargetPricePerKg)} = ${formatRupiah(totalOmzetPabrik)}`,
                  resultLabel: 'Total Tagihan Nota',
                  resultValue: formatRupiah(totalOmzetPabrik),
                  explanation: `Total uang yang akan dicairkan oleh pabrik (${selectedFactoryName}) adalah ${formatRupiah(totalOmzetPabrik)}.`,
                  highlight: 'amber',
                },
              ],
              summaryRows: [
                {
                  label: 'Netto Tagih Pabrik',
                  value: `${factoryNetBillableKg} kg`,
                  highlight: 'white',
                },
                {
                  label: 'Target Harga Pabrik / KG',
                  value: `${formatRupiah(factoryTargetPricePerKg)}/kg`,
                  highlight: 'white',
                },
                {
                  label: 'Total Tagihan Nota',
                  value: formatRupiah(totalOmzetPabrik),
                  highlight: 'amber',
                },
              ],
              conclusion: `Angka ${formatRupiah(totalOmzetPabrik)} berasal dari Netto Tagih Pabrik ${factoryNetBillableKg} kg dikalikan harga pabrik ${formatRupiah(factoryTargetPricePerKg)}/kg.`,
            });
            return;
          }

          // focus === 'NET_PROFIT'
          setCalcDetail({
            title: `5. Total Profit Bersih (${formatRupiah(profitRiil)} • ${marginPercent.toFixed(1)}%)`,
            subtitle: `Tagihan Nota ${formatRupiah(totalOmzetPabrik)} − Total Modal ${formatRupiah(totalModalRiil)}`,
            badgeText: 'PANEL 5 KESIMPULAN • ASAL ANGKA TOTAL PROFIT BERSIH',
            coreFormula:
              'Total Profit Bersih = Total Tagihan Nota Pabrik − Total Modal Bayar',
            steps: [
              {
                stepNumber: 1,
                title: 'Kurangi Total Tagihan Nota Pabrik dengan Total Modal Bayar',
                formula: 'Total Profit Bersih = Total Tagihan Nota − Total Modal Bayar',
                substitution: `${formatRupiah(totalOmzetPabrik)} − ${formatRupiah(totalModalRiil)} = ${formatRupiah(profitRiil)}`,
                resultLabel: 'Profit Bersih',
                resultValue: formatRupiah(profitRiil),
                explanation: `Keuntungan bersih setelah seluruh modal bahan dan biaya kemasan/press kembali.`,
                highlight: profitRiil >= 0 ? 'amber' : 'red',
              },
              {
                stepNumber: 2,
                title: 'Hitung Persentase Margin & Profit Rata-Rata per Seri',
                formula: 'Margin (%) = (Profit Bersih ÷ Tagihan Nota) × 100%  |  Profit / Seri = Profit ÷ Jumlah Seri',
                substitution: `(${formatRupiah(profitRiil)} ÷ ${formatRupiah(totalOmzetPabrik)}) × 100% = ${marginPercent.toFixed(1)}%  |  ${formatRupiah(profitRiil)} ÷ ${safePackageCount} Seri = ${formatRupiah(profitPerSeri)}/seri`,
                resultLabel: 'Profit / Seri',
                resultValue: `${formatRupiah(profitPerSeri)} (${marginPercent.toFixed(1)}%)`,
                explanation: `Setiap 1 Nomor Seri menghasilkan profit bersih rata-rata ${formatRupiah(profitPerSeri)}.`,
                highlight: profitRiil >= 0 ? 'amber' : 'red',
              },
            ],
            summaryRows: [
              {
                label: 'Total Tagihan Nota Pabrik',
                value: formatRupiah(totalOmzetPabrik),
                highlight: 'white',
              },
              {
                label: 'Total Modal Bayar',
                value: formatRupiah(totalModalRiil),
                highlight: 'white',
              },
              {
                label: `Total Profit (${marginPercent.toFixed(1)}%)`,
                value: formatRupiah(profitRiil),
                highlight: profitRiil >= 0 ? 'amber' : 'red',
              },
            ],
            conclusion: `Total Profit Bersih sebesar ${formatRupiah(profitRiil)} (${marginPercent.toFixed(1)}%) berasal dari Total Tagihan Nota Pabrik ${formatRupiah(totalOmzetPabrik)} dikurangi Total Modal Bayar ${formatRupiah(totalModalRiil)}.`,
          });
        };

        return (
          <div
            className={`${
              mobilePanel === 'result' ? 'block' : 'hidden lg:block'
            } requiem-card border-2 border-amber-500/70 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Kesimpulan Gabungan {simIngredients.length} Jenis Tembakau ({safePackageCount} Nomor Seri)
              </h3>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono text-zinc-300 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  Profit Rata-rata per Seri: <b className="text-amber-400">{formatRupiah(profitPerSeri)}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                  <CalcSymbolBadge />
                  <span>Simbol rincian angka</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-left items-stretch">
              <button
                type="button"
                onClick={() => openStep3Modal('TOTAL_MODAL')}
                className="group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="text-[11px] text-zinc-400 font-bold">
                    Total Modal Bayar (Bahan + Kemas/Press)
                  </span>
                  <CalcSymbolBadge />
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-white mt-2">
                  {formatRupiah(totalModalRiil)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStep3Modal('COMBINED_WEIGHT_PROFIT')}
                className="group bg-black p-3.5 rounded-xl border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="text-[11px] text-amber-300 font-bold">
                    Weight Profit Beli + Pabrik
                  </span>
                  <CalcSymbolBadge />
                </div>
                <div className="mt-1.5">
                  <div className="text-xs sm:text-sm font-black font-mono text-amber-400">
                    Beli {totalBuyWeightProfitKg >= 0 ? '+' : ''}
                    {totalBuyWeightProfitKg}kg • Pabrik {factoryWeightProfitKg >= 0 ? '+' : ''}
                    {factoryWeightProfitKg}kg
                  </div>
                  <div className="text-[11px] font-mono text-zinc-300 mt-0.5">
                    {totalBuyWeightProfitRp + factoryWeightProfitRp >= 0 ? '+' : ''}
                    {formatRupiah(totalBuyWeightProfitRp + factoryWeightProfitRp)}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStep3Modal('BEP_PER_KG')}
                className="group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="text-[11px] text-zinc-400 font-bold">
                    Harga Minimal BEP / KG (Setelah Tarra)
                  </span>
                  <CalcSymbolBadge />
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-amber-300 mt-2">
                  {formatRupiah(bepPricePerKg)}/kg
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStep3Modal('TOTAL_NOTA')}
                className="group bg-black p-3.5 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="text-[11px] text-zinc-400 font-bold">
                    Total Tagihan Nota Pabrik
                  </span>
                  <CalcSymbolBadge />
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-amber-400 mt-2">
                  {formatRupiah(totalOmzetPabrik)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => openStep3Modal('NET_PROFIT')}
                className="group bg-black p-3.5 rounded-xl border-2 border-amber-500 hover:border-amber-300 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all cursor-pointer flex flex-col justify-between h-full"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <span className="text-[11px] font-extrabold uppercase">
                    TOTAL PROFIT BERSIH ({marginPercent.toFixed(1)}%)
                  </span>
                  <CalcSymbolBadge />
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-white mt-2">
                  {formatRupiah(profitRiil)}
                </div>
              </button>
            </div>
          </div>
        );
      })()}

      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
