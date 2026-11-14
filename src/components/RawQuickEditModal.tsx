import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Check,
  Scale,
  DollarSign,
  Sparkles,
  UserCheck,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { PackagingMaster, RawTobacco, TobaccoGrade } from '../types/tobacco';
import {
  TOBACCO_GRADE_ORDER,
  clampRating5,
  formatRupiah,
  formatTaraFormula,
} from '../utils/tobaccoMath';
import {
  applyQuickPatchToRawTobacco,
  getNextFocusFieldId,
  getRawTobaccoMissingFlags,
} from '../utils/tobaccoCompleteness';
import { NumericInput } from './NumericInput';
import { RatingSegmentSlider } from './RatingSegmentSlider';

export type QuickEditSection = 'timbangan' | 'harga' | 'grade_attr' | 'info';

interface RawQuickEditModalProps {
  tobacco: RawTobacco | null;
  initialSection: QuickEditSection;
  packagingList: PackagingMaster[];
  onClose: () => void;
  onSave: (updated: RawTobacco) => void;
}

const CHARACTER_PRESETS = [
  {
    id: 'ringan',
    label: 'Ringan Halus',
    values: { power: 2.5, impact: 2.5, bitter: 1.5, burn: 4.5, sugar: 3.5, aroma: 4.0 },
  },
  {
    id: 'sedang',
    label: 'Sedang Seimbang',
    values: { power: 3.5, impact: 3.5, bitter: 2.5, burn: 4.0, sugar: 3.5, aroma: 4.0 },
  },
  {
    id: 'berat',
    label: 'Berat Mantap',
    values: { power: 4.5, impact: 4.5, bitter: 3.5, burn: 4.0, sugar: 3.0, aroma: 4.2 },
  },
  {
    id: 'manis',
    label: 'Manis Harum',
    values: { power: 3.0, impact: 3.0, bitter: 1.5, burn: 4.5, sugar: 4.5, aroma: 4.8 },
  },
];

export const RawQuickEditModal: React.FC<RawQuickEditModalProps> = ({
  tobacco,
  initialSection,
  packagingList,
  onClose,
  onSave,
}) => {
  const [section, setSection] = useState<QuickEditSection>(initialSection);

  // Local editable values
  const [sellerName, setSellerName] = useState('');
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [packagingMassKg, setPackagingMassKg] = useState(0);
  const [flatKgTara, setFlatKgTara] = useState(0);
  const [percentTara, setPercentTara] = useState(0);
  const [grossWeightKg, setGrossWeightKg] = useState(0);
  const [pricePerKgPurchase, setPricePerKgPurchase] = useState(0);
  const [colorGrade, setColorGrade] = useState<TobaccoGrade>('D');
  const [powerRating, setPowerRating] = useState(0);
  const [impactRating, setImpactRating] = useState(0);
  const [bitterRating, setBitterRating] = useState(0);
  const [burnRating, setBurnRating] = useState(0);
  const [sugarRating, setSugarRating] = useState(0);
  const [aromaRating, setAromaRating] = useState(0);
  const [characterNotes, setCharacterNotes] = useState('');

  // Input refs for Enter-to-Advance
  const sellerRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const originRef = useRef<HTMLInputElement>(null);
  const pkgRef = useRef<HTMLSelectElement>(null);
  const grossRef = useRef<HTMLInputElement>(null);
  const flatTaraRef = useRef<HTMLInputElement>(null);
  const percentTaraRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tobacco) return;
    setSection(initialSection);
    setSellerName(tobacco.sellerName || tobacco.taraFormula?.sellerName || '');
    setName(tobacco.name || '');
    setOrigin(tobacco.origin === 'Belum Diisi' ? '' : tobacco.origin || '');
    setPackagingType(
      tobacco.taraFormula?.packagingType === 'Belum Dipilih'
        ? ''
        : tobacco.taraFormula?.packagingType || ''
    );
    setPackagingMassKg(
      tobacco.packagingMassKg ?? tobacco.taraFormula?.packagingMassKg ?? 0
    );
    setFlatKgTara(tobacco.taraFormula?.flatKg ?? 0);
    setPercentTara(tobacco.taraFormula?.percent ?? 0);
    setGrossWeightKg(tobacco.grossWeightKg || 0);
    setPricePerKgPurchase(tobacco.pricePerKgPurchase || 0);
    setColorGrade(tobacco.colorGrade || 'D');
    setPowerRating(clampRating5(tobacco.powerRating || 0));
    setImpactRating(clampRating5(tobacco.impactRating || 0));
    setBitterRating(clampRating5(tobacco.bitterRating || 0));
    setBurnRating(clampRating5(tobacco.burnRating || 0));
    setSugarRating(clampRating5(tobacco.sugarRating || 0));
    setAromaRating(clampRating5(tobacco.aromaRating || 0));
    setCharacterNotes(tobacco.characterNotes || '');
  }, [tobacco, initialSection]);

  // Auto-focus primary input whenever modal or section opens
  useEffect(() => {
    if (!tobacco) return;
    const t = window.setTimeout(() => {
      if (section === 'timbangan') {
        grossRef.current?.focus();
        grossRef.current?.select();
      } else if (section === 'harga') {
        priceRef.current?.focus();
        priceRef.current?.select();
      } else if (section === 'info') {
        sellerRef.current?.focus();
        sellerRef.current?.select();
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [tobacco, section]);

  useEffect(() => {
    if (!tobacco) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [tobacco, onClose]);

  if (!tobacco) return null;

  const previewUpdated = applyQuickPatchToRawTobacco(
    tobacco,
    {
      sellerName,
      name,
      origin,
      packagingType: packagingType || 'Belum Dipilih',
      packagingMassKg,
      flatKgTara,
      percentTara,
      grossWeightKg,
      pricePerKgPurchase,
      colorGrade,
      powerRating,
      impactRating,
      bitterRating,
      burnRating,
      sugarRating,
      aromaRating,
      characterNotes,
    },
    packagingList
  );

  const missingFlags = getRawTobaccoMissingFlags(previewUpdated);

  const handleSelectPackaging = (nextPkgName: string) => {
    setPackagingType(nextPkgName);
    const found = packagingList.find((p) => p.name === nextPkgName);
    if (found) {
      setPackagingMassKg(found.packagingMassKg);
      setFlatKgTara(found.taraFlatKg);
      setPercentTara(found.taraPercent);
    }
  };

  const handleSaveAndClose = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(previewUpdated);
    onClose();
  };

  // Enter-to-Advance across inputs per active quick section
  const handleEnterAdvance = (
    e: React.KeyboardEvent,
    currentField: string,
    orderedFields: readonly string[],
    refMap: Record<string, React.RefObject<HTMLInputElement | HTMLSelectElement | null>>
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nextId = getNextFocusFieldId(orderedFields, currentField);
    if (nextId && refMap[nextId]?.current) {
      refMap[nextId].current?.focus();
      if (refMap[nextId].current instanceof HTMLInputElement) {
        (refMap[nextId].current as HTMLInputElement).select();
      }
    } else {
      handleSaveAndClose();
    }
  };

  const tabs: Array<{
    id: QuickEditSection;
    label: string;
    icon: React.ReactNode;
    isMissing: boolean;
  }> = [
    {
      id: 'timbangan',
      label: 'Timbangan',
      icon: <Scale className="w-3.5 h-3.5" />,
      isMissing: missingFlags.missingWeight,
    },
    {
      id: 'harga',
      label: 'Harga',
      icon: <DollarSign className="w-3.5 h-3.5" />,
      isMissing: missingFlags.missingPrice,
    },
    {
      id: 'grade_attr',
      label: 'Grade & Atribut',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      isMissing: missingFlags.missingAttributes,
    },
    {
      id: 'info',
      label: 'Info & Kemasan',
      icon: <UserCheck className="w-3.5 h-3.5" />,
      isMissing:
        missingFlags.missingSeller ||
        missingFlags.missingOrigin ||
        missingFlags.missingPackaging,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border-2 border-amber-500/75 rounded-2xl w-full max-w-xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] text-white overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit Cepat ${tobacco.name}`}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-black border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/50 text-amber-300 text-[10px] font-black uppercase">
                Edit Cepat
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Grade {colorGrade} · {origin || 'Belum Diisi'}
              </span>
            </div>
            <h3 className="font-black text-sm text-white truncate mt-0.5">
              {name || tobacco.name}
              {sellerName ? (
                <span className="text-zinc-400 font-semibold"> — {sellerName}</span>
              ) : null}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Edit Cepat"
            className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs with Unfilled Dot Marks */}
        <div className="px-3 py-2 bg-zinc-950 border-b border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {tabs.map((tab) => {
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`relative px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-black border-amber-400 font-black'
                    : tab.isMissing
                      ? 'bg-black text-amber-300 border-amber-500/50 hover:border-amber-400'
                      : 'bg-black text-zinc-300 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
                {tab.isMissing && (
                  <span
                    title="Belum diisi"
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      active ? 'bg-black' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSaveAndClose} className="p-4 space-y-3.5 text-xs">
          {/* SECTION 1: TIMBANGAN (plus optional Harga right next on Enter!) */}
          {section === 'timbangan' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 bg-black px-3 py-2 rounded-xl border border-zinc-800">
                <span>
                  Ketik angka lalu tekan <b className="text-amber-400">Enter</b> untuk langsung lanjut ke kolom berikutnya & simpan.
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-amber-400 mb-1">
                    Bruto Timbangan (KG)
                  </label>
                  <NumericInput
                    ref={grossRef}
                    emptyWhenZero
                    enterKeyHint="next"
                    value={grossWeightKg}
                    onChange={setGrossWeightKg}
                    onKeyDown={(e) =>
                      handleEnterAdvance(
                        e,
                        'gross',
                        ['gross', 'price'],
                        { gross: grossRef, price: priceRef }
                      )
                    }
                    placeholder="Contoh: 45"
                    className="w-full h-11 px-3 bg-black border-2 border-amber-500/75 focus:border-amber-400 rounded-xl font-mono font-black text-base text-white placeholder-zinc-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-200 mb-1">
                    Harga / KG (Rp) {pricePerKgPurchase <= 0 && <span className="text-amber-400">· Menyusul</span>}
                  </label>
                  <NumericInput
                    ref={priceRef}
                    emptyWhenZero
                    enterKeyHint="done"
                    value={pricePerKgPurchase}
                    onChange={setPricePerKgPurchase}
                    onKeyDown={(e) =>
                      handleEnterAdvance(
                        e,
                        'price',
                        ['gross', 'price'],
                        { gross: grossRef, price: priceRef }
                      )
                    }
                    placeholder="Isi atau 0"
                    className="w-full h-11 px-3 bg-black border border-zinc-700 focus:border-amber-400 rounded-xl font-mono font-black text-base text-white placeholder-zinc-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">
                    Kemasan
                  </label>
                  <select
                    ref={pkgRef}
                    value={packagingType}
                    onChange={(e) => handleSelectPackaging(e.target.value)}
                    className="w-full h-9 px-2 bg-black border border-zinc-800 focus:border-amber-400 rounded-lg text-xs font-bold text-white focus:outline-hidden"
                  >
                    <option value="">-- Kemasan --</option>
                    {packagingList.map((pkg) => (
                      <option key={pkg.id} value={pkg.name}>
                        {pkg.name} ({formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">
                    Tarra Flat (KG)
                  </label>
                  <NumericInput
                    ref={flatTaraRef}
                    emptyWhenZero
                    value={flatKgTara}
                    onChange={setFlatKgTara}
                    placeholder="2"
                    className="w-full h-9 px-2.5 bg-black border border-zinc-800 focus:border-amber-400 rounded-lg font-mono font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1">
                    Tarra (%)
                  </label>
                  <NumericInput
                    ref={percentTaraRef}
                    emptyWhenZero
                    value={percentTara}
                    onChange={setPercentTara}
                    placeholder="10"
                    className="w-full h-9 px-2.5 bg-black border border-zinc-800 focus:border-amber-400 rounded-lg font-mono font-bold text-white"
                  />
                </div>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-2.5 flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-300">
                  Netto Bayar: <b className="text-white">{previewUpdated.netWeightKg} kg</b>{' '}
                  <span className="text-zinc-500">(Tarra −{previewUpdated.deductionKg} kg)</span>
                </span>
                <span className="text-amber-400 font-black">
                  Modal: {formatRupiah(previewUpdated.totalModalAsal || 0)}
                </span>
              </div>
            </div>
          )}

          {/* SECTION 2: HARGA CEPAT */}
          {section === 'harga' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-amber-400 mb-1">
                  Harga Tembakau / KG (Rp)
                </label>
                <NumericInput
                  ref={priceRef}
                  emptyWhenZero
                  enterKeyHint="done"
                  value={pricePerKgPurchase}
                  onChange={setPricePerKgPurchase}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveAndClose();
                    }
                  }}
                  placeholder="Contoh: 85000"
                  className="w-full h-12 px-3.5 bg-black border-2 border-amber-500/80 focus:border-amber-400 rounded-xl font-mono font-black text-lg text-white placeholder-zinc-500 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[50000, 75000, 90000, 100000, 120000, 150000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPricePerKgPurchase(preset)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border cursor-pointer transition-colors ${
                      pricePerKgPurchase === preset
                        ? 'bg-amber-500 text-black border-amber-400'
                        : 'bg-black hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                    }`}
                  >
                    {(preset / 1000).toFixed(0)}rb
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPricePerKgPurchase((p) => Math.max(0, (p || 0) + 5000))}
                  className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-700 cursor-pointer"
                >
                  +5rb
                </button>
              </div>

              <div className="bg-black border border-zinc-800 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">
                  Netto: <b className="text-white">{previewUpdated.netWeightKg} kg</b>
                  {previewUpdated.netWeightKg === 0 && (
                    <span className="text-amber-400 ml-1.5">(Timbangan menyusul)</span>
                  )}
                </span>
                <span className="font-black text-amber-400 text-sm">
                  {formatRupiah(previewUpdated.totalModalAsal || 0)}
                </span>
              </div>
            </div>
          )}

          {/* SECTION 3: GRADE & 6 ATRIBUT */}
          {section === 'grade_attr' && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[11px] font-bold text-zinc-200 mb-1.5">
                  Grade Tembakau
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {TOBACCO_GRADE_ORDER.map((gr) => {
                    const active = colorGrade === gr;
                    return (
                      <button
                        key={gr}
                        type="button"
                        onClick={() => setColorGrade(gr)}
                        className={`h-8 rounded-lg border text-xs transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500 text-black border-amber-400 font-black'
                            : 'bg-black border-zinc-800 text-zinc-200 hover:border-zinc-600 font-bold'
                        }`}
                      >
                        {gr}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold text-zinc-300">
                    Preset Cepat 6 Atribut:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {CHARACTER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPowerRating(p.values.power);
                        setImpactRating(p.values.impact);
                        setBitterRating(p.values.bitter);
                        setBurnRating(p.values.burn);
                        setSugarRating(p.values.sugar);
                        setAromaRating(p.values.aroma);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/60 text-[10px] font-bold text-amber-300 cursor-pointer transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <RatingSegmentSlider label="Power" value={powerRating} onChange={setPowerRating} />
                <RatingSegmentSlider label="Impact" value={impactRating} onChange={setImpactRating} />
                <RatingSegmentSlider label="Bitter" value={bitterRating} onChange={setBitterRating} />
                <RatingSegmentSlider label="Burn" value={burnRating} onChange={setBurnRating} />
                <RatingSegmentSlider label="Sugar" value={sugarRating} onChange={setSugarRating} />
                <RatingSegmentSlider label="Aroma" value={aromaRating} onChange={setAromaRating} />
              </div>
            </div>
          )}

          {/* SECTION 4: INFO & KEMASAN */}
          {section === 'info' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-black px-3 py-1.5 rounded-xl border border-zinc-800">
                <span>
                  Tekan <b className="text-amber-400">Enter</b> untuk berpindah kotak input
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-200 mb-1">
                  Penjual / Petani {!sellerName.trim() && <span className="text-amber-400">(Kosong)</span>}
                </label>
                <input
                  ref={sellerRef}
                  type="text"
                  enterKeyHint="next"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  onKeyDown={(e) =>
                    handleEnterAdvance(
                      e,
                      'seller',
                      ['seller', 'name', 'origin', 'pkg'],
                      { seller: sellerRef, name: nameRef, origin: originRef, pkg: pkgRef }
                    )
                  }
                  placeholder="Nama penjual..."
                  className="w-full h-10 px-3 bg-black border border-zinc-700 focus:border-amber-400 rounded-xl text-xs font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-200 mb-1">
                  Jenis / Nama Tembakau
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  enterKeyHint="next"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) =>
                    handleEnterAdvance(
                      e,
                      'name',
                      ['seller', 'name', 'origin', 'pkg'],
                      { seller: sellerRef, name: nameRef, origin: originRef, pkg: pkgRef }
                    )
                  }
                  placeholder="Wetan Kali / Windusari..."
                  className="w-full h-10 px-3 bg-black border border-zinc-700 focus:border-amber-400 rounded-xl text-xs font-bold text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-200 mb-1">
                    Daerah Asal
                  </label>
                  <input
                    ref={originRef}
                    type="text"
                    enterKeyHint="next"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    onKeyDown={(e) =>
                      handleEnterAdvance(
                        e,
                        'origin',
                        ['seller', 'name', 'origin', 'pkg'],
                        { seller: sellerRef, name: nameRef, origin: originRef, pkg: pkgRef }
                      )
                    }
                    placeholder="Muntilan / Temanggung"
                    className="w-full h-10 px-3 bg-black border border-zinc-700 focus:border-amber-400 rounded-xl text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-200 mb-1">
                    Jenis Kemasan
                  </label>
                  <select
                    ref={pkgRef}
                    value={packagingType}
                    onChange={(e) => handleSelectPackaging(e.target.value)}
                    onKeyDown={(e) =>
                      handleEnterAdvance(
                        e,
                        'pkg',
                        ['seller', 'name', 'origin', 'pkg'],
                        { seller: sellerRef, name: nameRef, origin: originRef, pkg: pkgRef }
                      )
                    }
                    className="w-full h-10 px-2.5 bg-black border border-zinc-700 focus:border-amber-400 rounded-xl text-xs font-bold text-white"
                  >
                    <option value="">-- Pilih Kemasan --</option>
                    {packagingList.map((pkg) => (
                      <option key={pkg.id} value={pkg.name}>
                        {pkg.name} ({formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Unfilled status summary + Footer */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
            {missingFlags.isIncomplete ? (
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Masih kosong: {missingFlags.missingLabels.join(', ')}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Semua data utama lengkap</span>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-amber-outline h-9 px-4 rounded-xl font-black text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Simpan Cepat</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
