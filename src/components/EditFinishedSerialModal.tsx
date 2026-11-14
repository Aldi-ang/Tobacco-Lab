import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Save,
  Edit3,
  Scale,
  DollarSign,
  Sliders,
  Lock,
  Unlock,
  ArrowRight,
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
  TobaccoGrade,
  SerialFactoryStatus,
  SerialPaymentStatus,
} from '../types/tobacco';
import {
  TOBACCO_GRADE_ORDER,
  formatRupiah,
  clampRating5,
  formatSerialLineage,
  calculateTaraDeduction,
  roundHalfUpKg,
  formatTaraFormula,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';

interface EditFinishedSerialModalProps {
  serial: FinishedTobaccoSerial | null;
  rollSamples: TobaccoRollSample[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
  initialSection?: 'main' | 'weights' | 'character' | 'all';
  onClose: () => void;
  onSave: (updated: FinishedTobaccoSerial) => void;
}

type LockableFieldKey =
  | 'serialNumber'
  | 'grade'
  | 'rollId'
  | 'recipeName'
  | 'targetFactory'
  | 'factoryStatus'
  | 'paymentStatus'
  | 'packagingType'
  | 'brutoKg'
  | 'packagingMassKg'
  | 'taraKg'
  | 'hppPerNetKg'
  | 'power'
  | 'impact'
  | 'bitter'
  | 'burn'
  | 'sugar'
  | 'aroma';

const ALL_LOCKABLE_KEYS: LockableFieldKey[] = [
  'serialNumber',
  'grade',
  'rollId',
  'recipeName',
  'targetFactory',
  'factoryStatus',
  'paymentStatus',
  'packagingType',
  'brutoKg',
  'packagingMassKg',
  'taraKg',
  'hppPerNetKg',
  'power',
  'impact',
  'bitter',
  'burn',
  'sugar',
  'aroma',
];

type SerialEditTab = 'main' | 'weights' | 'character' | 'all';

export const EditFinishedSerialModal: React.FC<EditFinishedSerialModalProps> = ({
  serial,
  rollSamples,
  packagingList = [],
  factoryList = [],
  initialSection = 'main',
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<SerialEditTab>(initialSection);
  const [serialNumber, setSerialNumber] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [rollId, setRollId] = useState('');
  const [targetFactory, setTargetFactory] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [grade, setGrade] = useState<TobaccoGrade>('D');
  const [factoryStatus, setFactoryStatus] = useState<SerialFactoryStatus>('PENDING');
  const [paymentStatus, setPaymentStatus] = useState<SerialPaymentStatus>('BELUM_CAIR');

  const [brutoKg, setBrutoKg] = useState(0);
  const [packagingMassKg, setPackagingMassKg] = useState(0);
  const [taraFlatKg, setTaraFlatKg] = useState(0);
  const [taraPercent, setTaraPercent] = useState(0);
  const [taraKg, setTaraKg] = useState(0);

  const [hppPerNetKg, setHppPerNetKg] = useState(0);
  const [factoryPricePerKg, setFactoryPricePerKg] = useState(0);

  const [power, setPower] = useState(4.5);
  const [impact, setImpact] = useState(4.5);
  const [bitter, setBitter] = useState(4.0);
  const [burn, setBurn] = useState(4.5);
  const [sugar, setSugar] = useState(4.0);
  const [aroma, setAroma] = useState(4.2);

  // Refs for Enter-to-Advance focus sequencing
  const factoryPriceInputRef = useRef<HTMLInputElement>(null);
  const hppInputRef = useRef<HTMLInputElement>(null);
  const brutoInputRef = useRef<HTMLInputElement>(null);
  const pkgMassInputRef = useRef<HTMLInputElement>(null);
  const taraInputRef = useRef<HTMLInputElement>(null);

  // All fields EXCEPT Harga Pabrik are locked by default to prevent accidental edits
  // (Automatically unlock weights or character fields when opened directly to those tabs!)
  const [unlockedFields, setUnlockedFields] = useState<
    Partial<Record<LockableFieldKey, boolean>>
  >({});

  useEffect(() => {
    if (!serial) return;
    setActiveTab(initialSection);
    const gross = roundHalfUpKg(serial.packaging.grossWeightPerPackage || 0);
    const tara = roundHalfUpKg(serial.factoryDeductionKg || 0);
    const realNet = roundHalfUpKg(
      serial.packaging.netTobaccoWeightKg ??
        serial.totalBlendNetKg ??
        Math.max(0, gross - (serial.packaging.packagingMassKg ?? tara))
    );
    const pkgMass = roundHalfUpKg(
      serial.packaging.packagingMassKg ?? Math.max(0, gross - realNet)
    );
    const matchedPkg = packagingList.find(
      (p) => p.name === (serial.packaging.packagingType || 'KRJ MUNTILAN')
    );
    const initPercent = Number(
      serial.packaging.factoryTaraFormula?.percent ?? matchedPkg?.taraPercent ?? 0
    );
    const initFlat = roundHalfUpKg(
      serial.packaging.factoryTaraFormula?.flatKg ??
        (initPercent > 0 ? (matchedPkg?.taraFlatKg ?? 0) : tara)
    );
    const computedTara =
      initPercent > 0
        ? calculateTaraDeduction(gross, {
            percent: initPercent,
            flatKg: initFlat,
          }).deductionKg
        : tara;

    setSerialNumber(serial.serialNumber);
    setRecipeName(serial.recipeName || '');
    setRollId(serial.rollId || rollSamples[0]?.id || '');
    setTargetFactory(serial.targetFactory || '');
    setPackagingType(serial.packaging.packagingType || 'KRJ MUNTILAN');
    setGrade(serial.compositeColorGrade || 'D');
    setFactoryStatus(serial.factoryStatus || 'PENDING');
    setPaymentStatus(serial.paymentStatus || 'BELUM_CAIR');
    setBrutoKg(gross);
    setPackagingMassKg(pkgMass);
    setTaraFlatKg(initFlat);
    setTaraPercent(initPercent);
    setTaraKg(computedTara);
    setHppPerNetKg(Math.round(serial.effectiveHppAfterTaraPerKg || serial.hppPerNetKg || 0));
    setFactoryPricePerKg(serial.factoryTargetPricePerKg || 0);
    setPower(clampRating5(serial.weightedPower));
    setImpact(clampRating5(serial.weightedImpact));
    setBitter(clampRating5(serial.weightedBitter));
    setBurn(clampRating5(serial.weightedBurn ?? 4.5));
    setSugar(clampRating5(serial.weightedSugar ?? 4.0));
    setAroma(clampRating5(serial.weightedAroma ?? 4.2));

    if (initialSection === 'weights') {
      setUnlockedFields({
        packagingType: true,
        brutoKg: true,
        packagingMassKg: true,
        taraKg: true,
      });
      window.setTimeout(() => {
        brutoInputRef.current?.focus();
        brutoInputRef.current?.select();
      }, 60);
    } else if (initialSection === 'character') {
      setUnlockedFields({
        grade: true,
        power: true,
        impact: true,
        bitter: true,
        burn: true,
        sugar: true,
        aroma: true,
      });
    } else {
      setUnlockedFields({});
      window.setTimeout(() => {
        factoryPriceInputRef.current?.focus();
        factoryPriceInputRef.current?.select();
      }, 60);
    }
  }, [serial, rollSamples, packagingList, initialSection]);

  useEffect(() => {
    if (!serial) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [serial, onClose]);

  if (!serial) return null;

  const isUnlocked = (key: LockableFieldKey) => !!unlockedFields[key];

  const toggleFieldLock = (key: LockableFieldKey) => {
    setUnlockedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLockAll = () => {
    setUnlockedFields({});
  };

  const handleUnlockAll = () => {
    const next: Partial<Record<LockableFieldKey, boolean>> = {};
    ALL_LOCKABLE_KEYS.forEach((k) => {
      next[k] = true;
    });
    setUnlockedFields(next);
  };

  const renderFieldLabel = (label: string, fieldKey: LockableFieldKey, centered = false) => {
    const unlocked = isUnlocked(fieldKey);
    return (
      <div
        className={`flex items-center ${
          centered ? 'justify-center gap-1' : 'justify-between gap-1'
        } mb-1`}
      >
        <label className="text-[10px] font-bold text-zinc-300 uppercase truncate">
          {label}
        </label>
        <button
          type="button"
          onClick={() => toggleFieldLock(fieldKey)}
          title={
            unlocked
              ? `Kunci kembali kolom ${label}`
              : `Buka kunci untuk mengubah ${label}`
          }
          className={`h-5 px-1.5 rounded inline-flex items-center gap-1 text-[9px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
            unlocked
              ? 'bg-black text-amber-400 border border-amber-500/80'
              : 'bg-zinc-900/90 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          {unlocked ? (
            <>
              <Unlock className="w-2.5 h-2.5 text-amber-400" />
              {!centered && <span>Buka</span>}
            </>
          ) : (
            <>
              <Lock className="w-2.5 h-2.5 text-zinc-400" />
              {!centered && <span>Kunci</span>}
            </>
          )}
        </button>
      </div>
    );
  };

  const getLockedInputClass = (fieldKey: LockableFieldKey, extra = '') => {
    const unlocked = isUnlocked(fieldKey);
    return `w-full h-8 px-2.5 rounded-lg text-xs transition-all focus:outline-hidden ${
      unlocked
        ? 'bg-zinc-950 border border-amber-500/70 focus:border-amber-400 text-white'
        : 'bg-black/60 border border-zinc-800/80 text-zinc-400 opacity-65 cursor-not-allowed select-none'
    } ${extra}`;
  };

  const roundedBrutoKg = roundHalfUpKg(brutoKg);
  const roundedPackagingMassKg = roundHalfUpKg(packagingMassKg);
  const roundedTaraKg = roundHalfUpKg(taraKg);
  const rawPercentPart = Number(((roundedBrutoKg * (taraPercent || 0)) / 100).toFixed(2));
  const roundedPercentPart = roundHalfUpKg(rawPercentPart);

  const realNetTobaccoKg = Math.max(0, roundHalfUpKg(roundedBrutoKg - roundedPackagingMassKg));
  const billableNetKg = Math.max(0, roundHalfUpKg(roundedBrutoKg - roundedTaraKg));
  const weightProfitKg = roundHalfUpKg(billableNetKg - realNetTobaccoKg);
  const weightProfitRp = Math.round(weightProfitKg * factoryPricePerKg);
  const totalModalRp = Math.round(billableNetKg * hppPerNetKg);
  const totalNotaRp = Math.round(billableNetKg * factoryPricePerKg);
  const profitRp = totalNotaRp - totalModalRp;
  const marginPercent =
    totalNotaRp > 0 ? Number(((profitRp / totalNotaRp) * 100).toFixed(2)) : 0;

  const recomputeTaraFromRule = (nextBruto: number, nextFlat: number, nextPercent: number) => {
    const calc = calculateTaraDeduction(roundHalfUpKg(nextBruto), {
      percent: nextPercent || 0,
      flatKg: roundHalfUpKg(nextFlat || 0),
    });
    setTaraKg(calc.deductionKg);
  };

  const handleBrutoChange = (nextBruto: number) => {
    const cleanBruto = roundHalfUpKg(nextBruto);
    setBrutoKg(cleanBruto);
    if (taraPercent > 0 || taraFlatKg > 0) {
      recomputeTaraFromRule(cleanBruto, taraFlatKg, taraPercent);
    }
  };

  const handleTaraFlatChange = (nextFlat: number) => {
    const cleanFlat = roundHalfUpKg(nextFlat);
    setTaraFlatKg(cleanFlat);
    recomputeTaraFromRule(brutoKg, cleanFlat, taraPercent);
  };

  const handleTaraPercentChange = (nextPercent: number) => {
    setTaraPercent(nextPercent);
    recomputeTaraFromRule(brutoKg, taraFlatKg, nextPercent);
  };

  const handleDirectTaraChange = (nextTara: number) => {
    const cleanTara = roundHalfUpKg(nextTara);
    setTaraKg(cleanTara);
    if (taraPercent === 0) {
      setTaraFlatKg(cleanTara);
    }
  };

  const handleSelectPackagingPreset = (pkgName: string) => {
    setPackagingType(pkgName);
    const found = packagingList.find((p) => p.name === pkgName);
    if (found) {
      setPackagingMassKg(roundHalfUpKg(found.packagingMassKg));
      const pPercent = found.taraPercent || 0;
      const pFlat = roundHalfUpKg(found.taraFlatKg || 0);
      setTaraPercent(pPercent);
      setTaraFlatKg(pFlat);
      recomputeTaraFromRule(brutoKg, pFlat, pPercent);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedRoll = rollSamples.find((r) => r.id === rollId);
    const nextSerialNumber = serialNumber.trim() || serial.serialNumber;
    const isSerialRenamed = nextSerialNumber !== serial.serialNumber;
    const baseHistory =
      serial.serialHistory && serial.serialHistory.length > 0
        ? [...serial.serialHistory]
        : serial.previousSerialNumber && serial.previousSerialNumber !== serial.serialNumber
          ? [serial.previousSerialNumber, serial.serialNumber]
          : [serial.serialNumber];
    if (isSerialRenamed && baseHistory[baseHistory.length - 1] !== nextSerialNumber) {
      baseHistory.push(nextSerialNumber);
    }

    const updated: FinishedTobaccoSerial = {
      ...serial,
      serialNumber: nextSerialNumber,
      previousSerialNumber: isSerialRenamed
        ? serial.serialNumber
        : serial.previousSerialNumber,
      serialHistory: baseHistory,
      recipeName: recipeName.trim() || matchedRoll?.recipeName || serial.recipeName,
      rollId: matchedRoll?.id || rollId || serial.rollId,
      rollNumber: matchedRoll?.rollNumber || serial.rollNumber,
      rollRackNumber: matchedRoll?.rackLocation || serial.rollRackNumber,
      targetFactory: targetFactory.trim() || matchedRoll?.targetFactory || serial.targetFactory,
      compositeColorGrade: grade,
      factoryStatus,
      paymentStatus,
      totalBlendNetKg: realNetTobaccoKg,
      hppPerNetKg: Math.round(hppPerNetKg),
      effectiveHppAfterTaraPerKg: Math.round(hppPerNetKg),
      totalProductionCost: totalModalRp,
      packaging: {
        ...serial.packaging,
        packagingType: packagingType.trim() || 'KRJ MUNTILAN',
        packagingMassKg: roundedPackagingMassKg,
        netTobaccoWeightKg: realNetTobaccoKg,
        grossWeightPerPackage: roundedBrutoKg,
        factoryTaraFormula: {
          ...(serial.packaging.factoryTaraFormula || {
            pricingBasis: 'NET_WEIGHT',
          }),
          rawFormula:
            taraPercent > 0
              ? formatTaraFormula(taraPercent, taraFlatKg)
              : `${roundedTaraKg} kg`,
          percent: taraPercent || 0,
          flatKg: taraPercent > 0 ? roundHalfUpKg(taraFlatKg) : roundedTaraKg,
        },
      },
      factoryDeductionKg: roundedTaraKg,
      factoryNetBillableKg: billableNetKg,
      factoryWeightProfitKg: weightProfitKg,
      factoryWeightProfitRp: weightProfitRp,
      factoryTargetPricePerKg: factoryPricePerKg,
      projectedRevenue: totalNotaRp,
      projectedProfit: profitRp,
      profitMarginPercent: marginPercent,
      weightedPower: clampRating5(power),
      weightedImpact: clampRating5(impact),
      weightedBitter: clampRating5(bitter),
      weightedBurn: clampRating5(burn),
      weightedSugar: clampRating5(sugar),
      weightedAroma: clampRating5(aroma),
    };

    onSave(updated);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[65] overflow-y-auto bg-black/90 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden"
        >
          {/* Compact Modal Header with Explicit Kunci Semua & Buka Semua */}
          <div className="px-4 py-3 border-b border-zinc-800 bg-black flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-zinc-950 border border-amber-500/70 text-amber-400 shrink-0">
                <Edit3 className="w-4 h-4" />
              </span>
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                Edit Seri — SERI {formatSerialLineage(serial)}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleLockAll}
                className="h-7 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/50 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                title="Kunci semua kolom"
              >
                <Lock className="w-3 h-3" />
                <span>Kunci Semua</span>
              </button>

              <button
                type="button"
                onClick={handleUnlockAll}
                className="h-7 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                title="Buka semua kolom"
              >
                <Unlock className="w-3 h-3" />
                <span>Buka Semua</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup modal edit seri"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section Switcher Bar */}
          <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800/90 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-black p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('main')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  activeTab === 'main'
                    ? 'bg-amber-500 text-black font-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                1. Harga &amp; Status
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weights')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  activeTab === 'weights'
                    ? 'bg-amber-500 text-black font-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                2. Timbangan ({billableNetKg} kg)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('character')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  activeTab === 'character'
                    ? 'bg-amber-500 text-black font-black'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                3. Karakter (/5)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-zinc-800 text-amber-400 border border-amber-500/50'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Semua
              </button>
            </div>

            <span
              className={`font-mono font-black text-xs ${
                profitRp >= 0 ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              Profit: {profitRp >= 0 ? '+' : ''}
              {formatRupiah(profitRp)} ({marginPercent}%)
            </span>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3 text-xs"
          >
            {/* TAB 1: Harga Pabrik & Identitas */}
            {(activeTab === 'main' || activeTab === 'all') && (
              <div className="space-y-3">
                <div className="bg-black p-3 rounded-xl border border-amber-500/60 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      Harga Pabrik &amp; Modal
                    </span>
                    <span className="text-[10px] font-mono text-zinc-300">
                      Nota ({billableNetKg} kg): <b className="text-amber-400">{formatRupiah(totalNotaRp)}</b>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-[10px] font-black text-white uppercase flex items-center gap-1.5">
                          <span>Harga Pabrik / KG (Rp)</span>
                          {factoryPricePerKg <= 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/50 text-[9px]">
                              Belum Diisi
                            </span>
                          )}
                        </label>
                        <span className="text-[9px] text-zinc-400 inline-flex items-center gap-0.5">
                          <ArrowRight className="w-2.5 h-2.5 text-amber-400" />
                          Enter = {isUnlocked('hppPerNetKg') ? 'Lanjut' : 'Simpan'}
                        </span>
                      </div>
                      <NumericInput
                        ref={factoryPriceInputRef}
                        emptyWhenZero
                        value={factoryPricePerKg}
                        onChange={setFactoryPricePerKg}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (isUnlocked('hppPerNetKg') && hppInputRef.current) {
                              hppInputRef.current.focus();
                              hppInputRef.current.select();
                            } else {
                              handleSubmit(e as unknown as React.FormEvent);
                            }
                          }
                        }}
                        autoFocus
                        placeholder="0"
                        className="w-full h-9 px-3 bg-zinc-950 border border-amber-500/80 focus:border-amber-400 rounded-lg text-white font-mono font-black text-sm focus:outline-hidden"
                      />
                    </div>

                    <div>
                      {renderFieldLabel('Modal HPP / KG (Rp)', 'hppPerNetKg')}
                      <NumericInput
                        ref={hppInputRef}
                        value={hppPerNetKg}
                        onChange={setHppPerNetKg}
                        disabled={!isUnlocked('hppPerNetKg')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSubmit(e as unknown as React.FormEvent);
                          }
                        }}
                        className={`${getLockedInputClass('hppPerNetKg', 'font-mono font-bold')} h-9`}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-black p-3 rounded-xl border border-zinc-800 space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      {renderFieldLabel('Nomor Seri', 'serialNumber')}
                      <input
                        type="text"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        disabled={!isUnlocked('serialNumber')}
                        className={getLockedInputClass('serialNumber', 'font-mono font-black')}
                        required
                      />
                    </div>

                    <div>
                      {renderFieldLabel('Grade', 'grade')}
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value as TobaccoGrade)}
                        disabled={!isUnlocked('grade')}
                        className={getLockedInputClass('grade', 'font-bold')}
                      >
                        {TOBACCO_GRADE_ORDER.map((g) => (
                          <option key={g} value={g}>
                            Grade {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      {renderFieldLabel('Gulungan Terkait', 'rollId')}
                      <select
                        value={rollId}
                        disabled={!isUnlocked('rollId')}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setRollId(nextId);
                          const r = rollSamples.find((item) => item.id === nextId);
                          if (r) {
                            setTargetFactory(r.targetFactory);
                            setRecipeName(r.recipeName);
                          }
                        }}
                        className={getLockedInputClass('rollId', 'font-bold')}
                      >
                        {rollSamples.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.rollNumber} — {r.recipeName} ({r.targetFactory})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      {renderFieldLabel('Label Setoran / Campuran', 'recipeName')}
                      <input
                        type="text"
                        value={recipeName}
                        onChange={(e) => setRecipeName(e.target.value)}
                        disabled={!isUnlocked('recipeName')}
                        className={getLockedInputClass('recipeName')}
                      />
                    </div>

                    <div>
                      {renderFieldLabel('Pabrik Tujuan', 'targetFactory')}
                      {factoryList.length > 0 ? (
                        <select
                          value={targetFactory}
                          onChange={(e) => setTargetFactory(e.target.value)}
                          disabled={!isUnlocked('targetFactory')}
                          className={getLockedInputClass('targetFactory', 'font-bold')}
                        >
                          {!factoryList.some((f) => f.name === targetFactory) && (
                            <option value={targetFactory}>{targetFactory}</option>
                          )}
                          {factoryList.map((f) => (
                            <option key={f.id} value={f.name}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={targetFactory}
                          onChange={(e) => setTargetFactory(e.target.value)}
                          disabled={!isUnlocked('targetFactory')}
                          className={getLockedInputClass('targetFactory')}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    {renderFieldLabel('Status Pabrik', 'factoryStatus')}
                    <select
                      value={factoryStatus}
                      onChange={(e) => setFactoryStatus(e.target.value as SerialFactoryStatus)}
                      disabled={!isUnlocked('factoryStatus')}
                      className={getLockedInputClass('factoryStatus', 'font-bold')}
                    >
                      <option value="PENDING">Menunggu Pabrik</option>
                      <option value="ACCEPTED_CAIR">Diterima / Accepted</option>
                      <option value="REJECTED_STOCK">Reject (Masuk Stok Jadi)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Packaging & Timbangan */}
            {(activeTab === 'weights' || activeTab === 'all') && (
              <div className="bg-black p-3 rounded-xl border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-zinc-400" />
                    Timbangan &amp; Tarra
                  </span>
                  <span className="font-mono text-[11px] text-zinc-300">
                    Tagih: <b className="text-white">{billableNetKg} kg</b> • Riil:{' '}
                    <b className="text-white">{realNetTobaccoKg} kg</b>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    {renderFieldLabel('Kemasan', 'packagingType')}
                    {packagingList.length > 0 ? (
                      <select
                        value={packagingType}
                        disabled={!isUnlocked('packagingType')}
                        onChange={(e) => handleSelectPackagingPreset(e.target.value)}
                        className={getLockedInputClass('packagingType', 'font-bold')}
                      >
                        {!packagingList.some((p) => p.name === packagingType) && (
                          <option value={packagingType}>{packagingType}</option>
                        )}
                        {packagingList.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={packagingType}
                        disabled={!isUnlocked('packagingType')}
                        onChange={(e) => setPackagingType(e.target.value)}
                        className={getLockedInputClass('packagingType', 'font-bold')}
                      />
                    )}
                  </div>

                  <div>
                    {renderFieldLabel('Bruto (KG)', 'brutoKg')}
                    <NumericInput
                      ref={brutoInputRef}
                      value={brutoKg}
                      onChange={handleBrutoChange}
                      disabled={!isUnlocked('brutoKg')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isUnlocked('packagingMassKg') && pkgMassInputRef.current) {
                            pkgMassInputRef.current.focus();
                            pkgMassInputRef.current.select();
                          } else if (isUnlocked('taraKg') && taraInputRef.current) {
                            taraInputRef.current.focus();
                            taraInputRef.current.select();
                          } else {
                            handleSubmit(e as unknown as React.FormEvent);
                          }
                        }
                      }}
                      className={getLockedInputClass('brutoKg', 'font-mono font-bold')}
                    />
                  </div>

                  <div>
                    {renderFieldLabel('Wadah (KG)', 'packagingMassKg')}
                    <NumericInput
                      ref={pkgMassInputRef}
                      value={packagingMassKg}
                      onChange={(v) => setPackagingMassKg(roundHalfUpKg(v))}
                      disabled={!isUnlocked('packagingMassKg')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isUnlocked('taraKg') && taraInputRef.current) {
                            taraInputRef.current.focus();
                            taraInputRef.current.select();
                          } else {
                            handleSubmit(e as unknown as React.FormEvent);
                          }
                        }
                      }}
                      className={getLockedInputClass('packagingMassKg', 'font-mono font-bold')}
                    />
                  </div>

                  <div>
                    {renderFieldLabel('Total Tarra (KG)', 'taraKg')}
                    <NumericInput
                      ref={taraInputRef}
                      value={taraKg}
                      onChange={handleDirectTaraChange}
                      disabled={!isUnlocked('taraKg')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSubmit(e as unknown as React.FormEvent);
                        }
                      }}
                      className={getLockedInputClass('taraKg', 'font-mono font-bold')}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-900 grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
                  <div>
                    {renderFieldLabel('Flat (KG)', 'taraKg')}
                    <NumericInput
                      value={taraFlatKg}
                      onChange={handleTaraFlatChange}
                      disabled={!isUnlocked('taraKg')}
                      className={getLockedInputClass('taraKg', 'font-mono font-bold')}
                    />
                  </div>
                  <div>
                    {renderFieldLabel('Tarra (%)', 'taraKg')}
                    <NumericInput
                      value={taraPercent}
                      onChange={handleTaraPercentChange}
                      disabled={!isUnlocked('taraKg')}
                      className={getLockedInputClass('taraKg', 'font-mono font-bold')}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-zinc-300">
                    {taraPercent > 0 ? (
                      <b className="text-amber-400">
                        {roundHalfUpKg(taraFlatKg)} kg + {taraPercent}% ({rawPercentPart} →{' '}
                        {roundedPercentPart} kg) = {roundedTaraKg} kg
                      </b>
                    ) : (
                      <span>
                        Total Tarra: <b className="text-amber-400">{roundedTaraKg} kg</b>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 6 Karakteristik (/5) */}
            {(activeTab === 'character' || activeTab === 'all') && (
              <div className="bg-black p-3 rounded-xl border border-zinc-800 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  6 Karakteristik Rasa (/5)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(
                    [
                      { key: 'power' as LockableFieldKey, lbl: 'Power', val: power, set: setPower },
                      { key: 'impact' as LockableFieldKey, lbl: 'Impact', val: impact, set: setImpact },
                      { key: 'bitter' as LockableFieldKey, lbl: 'Bitter', val: bitter, set: setBitter },
                      { key: 'burn' as LockableFieldKey, lbl: 'Burn', val: burn, set: setBurn },
                      { key: 'sugar' as LockableFieldKey, lbl: 'Sugar', val: sugar, set: setSugar },
                      { key: 'aroma' as LockableFieldKey, lbl: 'Aroma', val: aroma, set: setAroma },
                    ] as const
                  ).map((item) => (
                    <div key={item.lbl} className="text-center">
                      {renderFieldLabel(item.lbl, item.key, true)}
                      <NumericInput
                        value={item.val}
                        onChange={(v) => item.set(clampRating5(v))}
                        disabled={!isUnlocked(item.key)}
                        className={getLockedInputClass(
                          item.key,
                          'text-center font-mono font-black !px-1.5'
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compact Footer Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-amber-outline h-9 px-4 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
