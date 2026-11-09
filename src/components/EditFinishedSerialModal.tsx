import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
  TobaccoGrade,
  SerialFactoryStatus,
} from '../types/tobacco';
import {
  GRADE_LABELS,
  formatRupiah,
  clampRating5,
  formatSerialLineage,
} from '../utils/tobaccoMath';
import { NumericInput } from './NumericInput';

interface EditFinishedSerialModalProps {
  serial: FinishedTobaccoSerial | null;
  rollSamples: TobaccoRollSample[];
  packagingList?: PackagingMaster[];
  factoryList?: FactoryMaster[];
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
  | 'packagingType'
  | 'brutoKg'
  | 'packagingMassKg'
  | 'taraKg'
  | 'hppPerNetKg'
  | 'power'
  | 'impact'
  | 'bitter'
  | 'burn'
  | 'sugar';

const ALL_LOCKABLE_KEYS: LockableFieldKey[] = [
  'serialNumber',
  'grade',
  'rollId',
  'recipeName',
  'targetFactory',
  'factoryStatus',
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
];

export const EditFinishedSerialModal: React.FC<EditFinishedSerialModalProps> = ({
  serial,
  rollSamples,
  packagingList = [],
  factoryList = [],
  onClose,
  onSave,
}) => {
  const [serialNumber, setSerialNumber] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [rollId, setRollId] = useState('');
  const [targetFactory, setTargetFactory] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [grade, setGrade] = useState<TobaccoGrade>('D');
  const [factoryStatus, setFactoryStatus] = useState<SerialFactoryStatus>('PENDING');

  const [brutoKg, setBrutoKg] = useState(0);
  const [packagingMassKg, setPackagingMassKg] = useState(0);
  const [taraKg, setTaraKg] = useState(0);

  const [hppPerNetKg, setHppPerNetKg] = useState(0);
  const [factoryPricePerKg, setFactoryPricePerKg] = useState(0);

  const [power, setPower] = useState(4.5);
  const [impact, setImpact] = useState(4.5);
  const [bitter, setBitter] = useState(4.0);
  const [burn, setBurn] = useState(4.5);
  const [sugar, setSugar] = useState(4.0);

  // All fields EXCEPT Harga Pabrik are locked by default to prevent accidental edits
  const [unlockedFields, setUnlockedFields] = useState<
    Partial<Record<LockableFieldKey, boolean>>
  >({});

  useEffect(() => {
    if (!serial) return;
    const gross = serial.packaging.grossWeightPerPackage || 0;
    const tara = serial.factoryDeductionKg || 0;
    const realNet =
      serial.packaging.netTobaccoWeightKg ??
      serial.totalBlendNetKg ??
      Math.max(0, gross - (serial.packaging.packagingMassKg ?? tara));
    const pkgMass =
      serial.packaging.packagingMassKg ??
      Number(Math.max(0, gross - realNet).toFixed(2));

    setSerialNumber(serial.serialNumber);
    setRecipeName(serial.recipeName || '');
    setRollId(serial.rollId || rollSamples[0]?.id || '');
    setTargetFactory(serial.targetFactory || '');
    setPackagingType(serial.packaging.packagingType || 'KRJ MUNTILAN');
    setGrade(serial.compositeColorGrade || 'D');
    setFactoryStatus(serial.factoryStatus || 'PENDING');
    setBrutoKg(gross);
    setPackagingMassKg(pkgMass);
    setTaraKg(tara);
    setHppPerNetKg(Math.round(serial.effectiveHppAfterTaraPerKg || serial.hppPerNetKg || 0));
    setFactoryPricePerKg(serial.factoryTargetPricePerKg || 0);
    setPower(clampRating5(serial.weightedPower));
    setImpact(clampRating5(serial.weightedImpact));
    setBitter(clampRating5(serial.weightedBitter));
    setBurn(clampRating5(serial.weightedBurn ?? 4.5));
    setSugar(clampRating5(serial.weightedSugar ?? 4.0));

    // Reset all locks whenever a serial is opened
    setUnlockedFields({});
  }, [serial, rollSamples]);

  if (!serial) return null;

  const isUnlocked = (key: LockableFieldKey) => !!unlockedFields[key];

  const toggleFieldLock = (key: LockableFieldKey) => {
    setUnlockedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allUnlocked = ALL_LOCKABLE_KEYS.every((k) => unlockedFields[k]);

  const handleToggleAllLocks = () => {
    if (allUnlocked) {
      setUnlockedFields({});
    } else {
      const next: Partial<Record<LockableFieldKey, boolean>> = {};
      ALL_LOCKABLE_KEYS.forEach((k) => {
        next[k] = true;
      });
      setUnlockedFields(next);
    }
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
              {!centered && <span>Terbuka</span>}
            </>
          ) : (
            <>
              <Lock className="w-2.5 h-2.5 text-zinc-400" />
              {!centered && <span>Terkunci</span>}
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

  const realNetTobaccoKg = Number(Math.max(0, brutoKg - packagingMassKg).toFixed(2));
  const billableNetKg = Number(Math.max(0, brutoKg - taraKg).toFixed(2));
  const weightProfitKg = Number((billableNetKg - realNetTobaccoKg).toFixed(2));
  const weightProfitRp = Math.round(weightProfitKg * factoryPricePerKg);
  const totalModalRp = Math.round(billableNetKg * hppPerNetKg);
  const totalNotaRp = Math.round(billableNetKg * factoryPricePerKg);
  const profitRp = totalNotaRp - totalModalRp;
  const marginPercent =
    totalNotaRp > 0 ? Number(((profitRp / totalNotaRp) * 100).toFixed(2)) : 0;

  const handleSelectPackagingPreset = (pkgName: string) => {
    setPackagingType(pkgName);
    const found = packagingList.find((p) => p.name === pkgName);
    if (found) {
      setPackagingMassKg(found.packagingMassKg);
      const calcTara = Number(
        ((brutoKg * (found.taraPercent || 0)) / 100 + (found.taraFlatKg || 0)).toFixed(2)
      );
      setTaraKg(calcTara);
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
      totalBlendNetKg: realNetTobaccoKg,
      hppPerNetKg: Math.round(hppPerNetKg),
      effectiveHppAfterTaraPerKg: Math.round(hppPerNetKg),
      totalProductionCost: totalModalRp,
      packaging: {
        ...serial.packaging,
        packagingType: packagingType.trim() || 'KRJ MUNTILAN',
        packagingMassKg,
        netTobaccoWeightKg: realNetTobaccoKg,
        grossWeightPerPackage: brutoKg,
      },
      factoryDeductionKg: taraKg,
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
          {/* Compact Modal Header */}
          <div className="px-4 py-3 border-b border-zinc-800 bg-black flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-zinc-950 border border-amber-500/70 text-amber-400 shrink-0">
                <Edit3 className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-black text-white truncate">
                  Edit Seri Jadi — SERI {formatSerialLineage(serial)}
                </h2>
                <p className="text-[10px] text-zinc-400 truncate">
                  Harga Pabrik siap diedit • Tekan ikon gembok untuk mengubah kolom lain
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleAllLocks}
                title={
                  allUnlocked
                    ? 'Kunci kembali semua kolom tetap'
                    : 'Buka kunci semua kolom untuk diedit'
                }
                className={`h-7 px-2.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all ${
                  allUnlocked
                    ? 'bg-black text-amber-400 border border-amber-500/80'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700'
                }`}
              >
                {allUnlocked ? (
                  <>
                    <Unlock className="w-3 h-3 text-amber-400" />
                    <span>Kunci Semua</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-zinc-400" />
                    <span>Buka Semua</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3.5 text-xs"
          >
            {/* Primary Unlocked Field at Top: Harga Pabrik & Live Profit */}
            <div className="bg-black p-3 rounded-xl border-2 border-amber-500/70 space-y-2.5 shadow-[0_4px_0_0_#18181b]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  Harga Pabrik & Profit Seri (Aktif Diedit)
                </span>
                <span
                  className={`font-mono font-black text-xs ${
                    profitRp >= 0 ? 'text-amber-400' : 'text-red-400'
                  }`}
                >
                  Profit: {profitRp >= 0 ? '+' : ''}
                  {formatRupiah(profitRp)} ({marginPercent}%)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label className="text-[10px] font-black text-white uppercase">
                      Harga Pabrik / KG (Rp)
                    </label>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 border border-amber-500/50 text-[9px] font-mono font-bold">
                      Terbuka Otomatis
                    </span>
                  </div>
                  <NumericInput
                    value={factoryPricePerKg}
                    onChange={setFactoryPricePerKg}
                    autoFocus
                    className="w-full h-9 px-3 bg-zinc-950 border-2 border-amber-500/80 focus:border-amber-400 rounded-lg text-white font-mono font-black text-sm focus:outline-hidden"
                  />
                  <span className="text-[10px] font-mono text-zinc-300 mt-1 block">
                    Jumlah Nota Pabrik ({billableNetKg} kg):{' '}
                    <b className="text-amber-400">{formatRupiah(totalNotaRp)}</b>
                  </span>
                </div>

                <div>
                  {renderFieldLabel('Harga Modal HPP / KG (Rp)', 'hppPerNetKg')}
                  <NumericInput
                    value={hppPerNetKg}
                    onChange={setHppPerNetKg}
                    disabled={!isUnlocked('hppPerNetKg')}
                    className={`${getLockedInputClass('hppPerNetKg', 'font-mono font-bold')} h-9`}
                  />
                  <span className="text-[10px] font-mono text-zinc-400 mt-1 block">
                    Jumlah Modal Produksi: <b className="text-white">{formatRupiah(totalModalRp)}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Identity, Roll & Status (Locked by Default) */}
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
                  {renderFieldLabel('Grade Warna', 'grade')}
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value as TobaccoGrade)}
                    disabled={!isUnlocked('grade')}
                    className={getLockedInputClass('grade', 'font-bold')}
                  >
                    {(Object.keys(GRADE_LABELS) as TobaccoGrade[]).map((g) => (
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
                      const nextRollId = e.target.value;
                      setRollId(nextRollId);
                      const foundRoll = rollSamples.find((r) => r.id === nextRollId);
                      if (foundRoll) {
                        setTargetFactory(foundRoll.targetFactory);
                        if (!recipeName) setRecipeName(foundRoll.recipeName);
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  {renderFieldLabel('Nama Racikan', 'recipeName')}
                  <input
                    type="text"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    disabled={!isUnlocked('recipeName')}
                    className={getLockedInputClass('recipeName', 'font-semibold')}
                  />
                </div>

                <div>
                  {renderFieldLabel('Pabrik Tujuan', 'targetFactory')}
                  <input
                    type="text"
                    list="edit-seri-factory-list"
                    value={targetFactory}
                    onChange={(e) => setTargetFactory(e.target.value)}
                    disabled={!isUnlocked('targetFactory')}
                    className={getLockedInputClass('targetFactory', 'font-semibold')}
                  />
                  <datalist id="edit-seri-factory-list">
                    {factoryList.map((f) => (
                      <option key={f.id} value={f.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  {renderFieldLabel('Status QC', 'factoryStatus')}
                  <select
                    value={factoryStatus}
                    onChange={(e) => setFactoryStatus(e.target.value as SerialFactoryStatus)}
                    disabled={!isUnlocked('factoryStatus')}
                    className={getLockedInputClass('factoryStatus', 'font-bold')}
                  >
                    <option value="PENDING">Menunggu QC</option>
                    <option value="ACCEPTED_CAIR">Terima Cair</option>
                    <option value="REJECTED_STOCK">Reject (Stok Jadi)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Packaging & Timbangan (Locked by Default) */}
            <div className="bg-black p-3 rounded-xl border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-zinc-400" />
                  Timbangan Kemasan & Tarra (Terkunci Default)
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
                    value={brutoKg}
                    onChange={setBrutoKg}
                    disabled={!isUnlocked('brutoKg')}
                    className={getLockedInputClass('brutoKg', 'font-mono font-bold')}
                  />
                </div>

                <div>
                  {renderFieldLabel('Wadah (KG)', 'packagingMassKg')}
                  <NumericInput
                    value={packagingMassKg}
                    onChange={setPackagingMassKg}
                    disabled={!isUnlocked('packagingMassKg')}
                    className={getLockedInputClass('packagingMassKg', 'font-mono font-bold')}
                  />
                </div>

                <div>
                  {renderFieldLabel('Tarra (KG)', 'taraKg')}
                  <NumericInput
                    value={taraKg}
                    onChange={setTaraKg}
                    disabled={!isUnlocked('taraKg')}
                    className={getLockedInputClass('taraKg', 'font-mono font-bold')}
                  />
                </div>
              </div>
            </div>

            {/* Section 4: 5 Karakteristik (/5) (Locked by Default) */}
            <div className="bg-black p-3 rounded-xl border border-zinc-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                5 Karakteristik Rasa (/5) (Terkunci Default)
              </span>
              <div className="grid grid-cols-5 gap-2">
                {(
                  [
                    { label: 'Power', key: 'power' as LockableFieldKey, val: power, set: setPower },
                    { label: 'Impact', key: 'impact' as LockableFieldKey, val: impact, set: setImpact },
                    { label: 'Bitter', key: 'bitter' as LockableFieldKey, val: bitter, set: setBitter },
                    { label: 'Bakar', key: 'burn' as LockableFieldKey, val: burn, set: setBurn },
                    { label: 'Sugar', key: 'sugar' as LockableFieldKey, val: sugar, set: setSugar },
                  ]
                ).map((item) => {
                  const unlocked = isUnlocked(item.key);
                  return (
                    <div key={item.label}>
                      {renderFieldLabel(item.label, item.key, true)}
                      <NumericInput
                        value={item.val}
                        onChange={(v) => item.set(clampRating5(v))}
                        disabled={!unlocked}
                        className={`w-full h-10 px-1.5 rounded-lg text-center font-mono font-black text-base sm:text-lg text-amber-400 transition-all focus:outline-hidden ${
                          unlocked
                            ? 'bg-zinc-950 border-2 border-amber-500/80 focus:border-amber-400'
                            : 'bg-zinc-950 border border-zinc-700 cursor-not-allowed select-none'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-amber-outline h-9 px-4 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span>Simpan Perubahan Seri</span>
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
