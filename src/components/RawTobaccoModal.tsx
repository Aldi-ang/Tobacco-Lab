import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Sparkles,
  Check,
  UserCheck,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Users,
  ArrowRight,
  Clock,
  RotateCw,
} from 'lucide-react';
import { RawTobacco, TobaccoGrade, PackagingMaster, AgentFeeItem } from '../types/tobacco';
import {
  TOBACCO_GRADE_ORDER,
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

const REMEMBERED_TOBACCO_NAMES_KEY = 'tobacco_lab_remembered_tobacco_names_v1';
const REMEMBERED_SELLER_NAMES_KEY = 'tobacco_lab_remembered_seller_names_v1';
const REMEMBERED_AGENT_NAMES_KEY = 'tobacco_lab_remembered_agent_names_v1';

function loadStringListFromStorage(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function saveStringToStorageList(key: string, value: string, existing: string[]): string[] {
  const clean = (value || '').trim();
  if (!clean) return existing;
  const next = [
    clean,
    ...existing.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
  ].slice(0, 25);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

type RawLockableFieldKey =
  | 'name'
  | 'origin'
  | 'sellerName'
  | 'lotNumber'
  | 'purchaseDate'
  | 'packagingType'
  | 'pricePerKgPurchase'
  | 'agentFees'
  | 'grossWeightKg'
  | 'packagingMassKg'
  | 'flatKgTara'
  | 'percentTara'
  | 'powerRating'
  | 'impactRating'
  | 'bitterRating'
  | 'burnRating'
  | 'sugarRating'
  | 'aromaRating'
  | 'colorGrade'
  | 'characterNotes';

const ALL_RAW_FIELD_KEYS: RawLockableFieldKey[] = [
  'name',
  'origin',
  'sellerName',
  'lotNumber',
  'purchaseDate',
  'packagingType',
  'pricePerKgPurchase',
  'agentFees',
  'grossWeightKg',
  'packagingMassKg',
  'flatKgTara',
  'percentTara',
  'powerRating',
  'impactRating',
  'bitterRating',
  'burnRating',
  'sugarRating',
  'aromaRating',
  'colorGrade',
  'characterNotes',
];

import { getNextFocusFieldId } from '../utils/tobaccoCompleteness';

type RawModalSectionTab = 'quick' | 'advanced' | 'all';

const QUICK_CHARACTER_PRESETS = [
  {
    id: 'ringan',
    label: 'Ringan',
    values: { power: 2.5, impact: 2.5, bitter: 1.5, burn: 4.5, sugar: 3.5, aroma: 4.0 },
  },
  {
    id: 'sedang',
    label: 'Sedang',
    values: { power: 3.5, impact: 3.5, bitter: 2.5, burn: 4.0, sugar: 3.5, aroma: 4.0 },
  },
  {
    id: 'mantap',
    label: 'Mantap',
    values: { power: 4.5, impact: 4.5, bitter: 3.5, burn: 4.0, sugar: 3.0, aroma: 4.2 },
  },
  {
    id: 'manis',
    label: 'Manis Harum',
    values: { power: 3.0, impact: 3.0, bitter: 1.5, burn: 4.5, sugar: 4.5, aroma: 4.8 },
  },
];

interface RawTobaccoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tobacco: RawTobacco) => void;
  editingTobacco: RawTobacco | null;
  packagingList: PackagingMaster[];
  existingTobaccos?: RawTobacco[];
}

export const RawTobaccoModal: React.FC<RawTobaccoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTobacco,
  packagingList,
  existingTobaccos = [],
}) => {
  const [activeSection, setActiveSection] = useState<RawModalSectionTab>('quick');

  // Refs for Enter-to-Advance focus sequencing
  const sellerInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);
  const packagingSelectRef = useRef<HTMLSelectElement>(null);
  const grossInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const lotInputRef = useRef<HTMLInputElement>(null);

  // All textboxes empty by default (with shadow placeholders) & all parameters 0 by default
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  const [grossWeightKg, setGrossWeightKg] = useState<number>(0);
  const [packagingMassKg, setPackagingMassKg] = useState<number>(0);
  const [pricePerKgPurchase, setPricePerKgPurchase] = useState<number>(0);
  const [agentFees, setAgentFees] = useState<AgentFeeItem[]>([]);
  const [percentTara, setPercentTara] = useState<number>(0);
  const [flatKgTara, setFlatKgTara] = useState<number>(0);
  const [packagingType, setPackagingType] = useState('');
  const [taraNotes, setTaraNotes] = useState('');
  const [additionalCost, setAdditionalCost] = useState<number>(0);
  const [calcDetail, setCalcDetail] = useState<CalculationDetailData | null>(null);

  // 6 sensory parameters default to 0
  const [powerRating, setPowerRating] = useState<number>(0);
  const [impactRating, setImpactRating] = useState<number>(0);
  const [bitterRating, setBitterRating] = useState<number>(0);
  const [burnRating, setBurnRating] = useState<number>(0);
  const [sugarRating, setSugarRating] = useState<number>(0);
  const [aromaRating, setAromaRating] = useState<number>(0);
  const [colorGrade, setColorGrade] = useState<TobaccoGrade>('D');
  const [characterNotes, setCharacterNotes] = useState('');

  // Auto-remembered Tobacco Names, Seller Names & Agent (Fee) Names
  const [storedTobaccoNames, setStoredTobaccoNames] = useState<string[]>(() =>
    loadStringListFromStorage(REMEMBERED_TOBACCO_NAMES_KEY)
  );
  const [storedSellerNames, setStoredSellerNames] = useState<string[]>(() =>
    loadStringListFromStorage(REMEMBERED_SELLER_NAMES_KEY)
  );
  const [storedAgentNames, setStoredAgentNames] = useState<string[]>(() =>
    loadStringListFromStorage(REMEMBERED_AGENT_NAMES_KEY)
  );

  // Lock state: UNLOCKED by default (`lockedMap[key] = false`), user can lock/unlock any field or all at once
  const [lockedMap, setLockedMap] = useState<Partial<Record<RawLockableFieldKey, boolean>>>({});

  const rememberedTobaccoNames = useMemo(() => {
    const combined = [
      ...storedTobaccoNames,
      ...existingTobaccos.map((t) => (t.name || '').trim()).filter(Boolean),
    ];
    const seen = new Set<string>();
    return combined.filter((item) => {
      const lower = item.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }, [storedTobaccoNames, existingTobaccos]);

  const rememberedSellerNames = useMemo(() => {
    const combined = [
      ...storedSellerNames,
      ...existingTobaccos
        .map((t) => (t.sellerName || t.taraFormula?.sellerName || '').trim())
        .filter(Boolean),
    ];
    const seen = new Set<string>();
    return combined.filter((item) => {
      const lower = item.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }, [storedSellerNames, existingTobaccos]);

  const rememberedAgentNames = useMemo(() => {
    const fromExistingFees = existingTobaccos.flatMap((t) =>
      Array.isArray(t.agentFees)
        ? t.agentFees.map((f) => (f.agentName || '').trim()).filter(Boolean)
        : []
    );
    const combined = [
      ...storedAgentNames,
      ...fromExistingFees,
      ...rememberedSellerNames,
    ];
    const seen = new Set<string>();
    return combined.filter((item) => {
      const lower = item.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }, [storedAgentNames, existingTobaccos, rememberedSellerNames]);

  useEffect(() => {
    setStoredTobaccoNames(loadStringListFromStorage(REMEMBERED_TOBACCO_NAMES_KEY));
    setStoredSellerNames(loadStringListFromStorage(REMEMBERED_SELLER_NAMES_KEY));
    setStoredAgentNames(loadStringListFromStorage(REMEMBERED_AGENT_NAMES_KEY));
    setActiveSection('quick');

    if (editingTobacco) {
      setName(editingTobacco.name || '');
      setOrigin(editingTobacco.origin || '');
      setSellerName(editingTobacco.sellerName || editingTobacco.taraFormula.sellerName || '');
      setLotNumber(editingTobacco.lotNumber || '');
      setPurchaseDate(editingTobacco.purchaseDate || '');
      setGrossWeightKg(editingTobacco.grossWeightKg || 0);
      setPackagingMassKg(
        editingTobacco.packagingMassKg ??
          editingTobacco.taraFormula.packagingMassKg ??
          0
      );
      setPricePerKgPurchase(editingTobacco.pricePerKgPurchase || 0);
      setAgentFees(
        Array.isArray(editingTobacco.agentFees)
          ? editingTobacco.agentFees.map((f) => ({
              id: f.id || `fee-${Math.random().toString(36).slice(2, 8)}`,
              agentName: f.agentName || '',
              feePerKg: Number(f.feePerKg) || 0,
            }))
          : []
      );
      setPercentTara(editingTobacco.taraFormula.percent || 0);
      setFlatKgTara(editingTobacco.taraFormula.flatKg || 0);
      setPackagingType(editingTobacco.taraFormula.packagingType || '');
      setTaraNotes(editingTobacco.taraFormula.notes || '');
      setAdditionalCost(editingTobacco.additionalPurchaseCost || 0);
      setPowerRating(clampRating5(editingTobacco.powerRating || 0));
      setImpactRating(clampRating5(editingTobacco.impactRating || 0));
      setBitterRating(clampRating5(editingTobacco.bitterRating || 0));
      setBurnRating(clampRating5(editingTobacco.burnRating ?? 0));
      setSugarRating(clampRating5(editingTobacco.sugarRating ?? 0));
      setAromaRating(clampRating5(editingTobacco.aromaRating ?? 0));
      setColorGrade(editingTobacco.colorGrade || 'D');
      setCharacterNotes(editingTobacco.characterNotes || '');

      const restoredLocks: Partial<Record<RawLockableFieldKey, boolean>> = {};
      if (Array.isArray(editingTobacco.lockedFields)) {
        editingTobacco.lockedFields.forEach((k) => {
          restoredLocks[k as RawLockableFieldKey] = true;
        });
      }
      setLockedMap(restoredLocks);
    } else {
      setName('');
      setOrigin('');
      setSellerName('');
      setLotNumber('');
      setPurchaseDate('');
      setGrossWeightKg(0);
      setPackagingMassKg(0);
      setPricePerKgPurchase(0);
      setAgentFees([]);
      setPercentTara(0);
      setFlatKgTara(0);
      setPackagingType('');
      setTaraNotes('');
      setAdditionalCost(0);
      setPowerRating(0);
      setImpactRating(0);
      setBitterRating(0);
      setBurnRating(0);
      setSugarRating(0);
      setAromaRating(0);
      setColorGrade('D');
      setCharacterNotes('');
      setLockedMap({});
    }

    if (isOpen) {
      window.setTimeout(() => {
        if (!editingTobacco) {
          sellerInputRef.current?.focus();
        }
      }, 60);
    }
  }, [editingTobacco, isOpen]);

  if (!isOpen) return null;

  const isLocked = (key: RawLockableFieldKey) => !!lockedMap[key];

  const toggleLock = (key: RawLockableFieldKey) => {
    setLockedMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLockAllFields = () => {
    const nextLocks: Partial<Record<RawLockableFieldKey, boolean>> = {};
    ALL_RAW_FIELD_KEYS.forEach((k) => {
      nextLocks[k] = true;
    });
    setLockedMap(nextLocks);
  };

  const handleUnlockAllFields = () => {
    setLockedMap({});
  };

  // Handlers for Agent Fees (Multiple persons, per KG)
  const handleAddAgentFeeRow = (prefillName = '') => {
    if (isLocked('agentFees')) return;
    setAgentFees((prev) => [
      ...prev,
      {
        id: `fee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agentName: prefillName,
        feePerKg: 0,
      },
    ]);
  };

  const handleUpdateAgentFeeRow = (
    id: string,
    updates: Partial<Pick<AgentFeeItem, 'agentName' | 'feePerKg'>>
  ) => {
    if (isLocked('agentFees')) return;
    setAgentFees((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row))
    );
  };

  const handleRemoveAgentFeeRow = (id: string) => {
    if (isLocked('agentFees')) return;
    setAgentFees((prev) => prev.filter((row) => row.id !== id));
  };

  const isFieldEmpty = (key: RawLockableFieldKey): boolean => {
    switch (key) {
      case 'name':
        return !name.trim();
      case 'origin':
        return !origin.trim();
      case 'sellerName':
        return !sellerName.trim();
      case 'lotNumber':
        return !lotNumber.trim();
      case 'purchaseDate':
        return !purchaseDate.trim();
      case 'packagingType':
        return !packagingType.trim();
      case 'pricePerKgPurchase':
        return !pricePerKgPurchase || pricePerKgPurchase <= 0;
      case 'agentFees':
        return (
          agentFees.length === 0 ||
          agentFees.every((f) => !f.agentName.trim() && (!f.feePerKg || f.feePerKg <= 0))
        );
      case 'grossWeightKg':
        return !grossWeightKg || grossWeightKg <= 0;
      case 'packagingMassKg':
        return !packagingMassKg || packagingMassKg <= 0;
      case 'flatKgTara':
        return !flatKgTara || flatKgTara <= 0;
      case 'percentTara':
        return !percentTara || percentTara <= 0;
      case 'powerRating':
        return !powerRating || powerRating <= 0;
      case 'impactRating':
        return !impactRating || impactRating <= 0;
      case 'bitterRating':
        return !bitterRating || bitterRating <= 0;
      case 'burnRating':
        return !burnRating || burnRating <= 0;
      case 'sugarRating':
        return !sugarRating || sugarRating <= 0;
      case 'aromaRating':
        return !aromaRating || aromaRating <= 0;
      case 'colorGrade':
        return false;
      case 'characterNotes':
        return !characterNotes.trim();
      default:
        return false;
    }
  };

  const trackableKeys: RawLockableFieldKey[] = [
    'name',
    'origin',
    'sellerName',
    'lotNumber',
    'purchaseDate',
    'packagingType',
    'pricePerKgPurchase',
    'grossWeightKg',
    'packagingMassKg',
    'flatKgTara',
    'percentTara',
    'powerRating',
    'impactRating',
    'bitterRating',
    'burnRating',
    'sugarRating',
    'aromaRating',
    'characterNotes',
  ];

  const emptyCount = trackableKeys.filter((k) => isFieldEmpty(k)).length;
  const filledCount = trackableKeys.length - emptyCount;

  const renderFieldLabel = (
    labelText: string,
    key: RawLockableFieldKey,
    icon?: React.ReactNode
  ) => {
    const locked = isLocked(key);
    return (
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <label className="text-[11px] font-bold text-zinc-200 flex items-center gap-1 truncate">
          {icon}
          <span className="truncate">{labelText}</span>
        </label>
        <button
          type="button"
          onClick={() => toggleLock(key)}
          aria-label={locked ? `Buka kunci ${labelText}` : `Kunci ${labelText}`}
          className={`group relative h-5 w-5 shrink-0 rounded border inline-flex items-center justify-center cursor-pointer transition-colors ${
            locked
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/60'
              : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
          }`}
        >
          {locked ? (
            <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
          ) : (
            <Unlock className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
          )}
          <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-7 right-0 z-50 px-2 py-0.5 rounded bg-black border border-zinc-700 text-white font-mono text-[9px] font-bold whitespace-nowrap shadow-xl">
            {locked ? 'Terkunci (Klik Buka)' : 'Terbuka (Klik Kunci)'}
          </span>
        </button>
      </div>
    );
  };

  const getTextboxClass = (key: RawLockableFieldKey, extra = '') => {
    const locked = isLocked(key);
    const empty = isFieldEmpty(key);
    if (locked) {
      return `w-full h-9 px-3 bg-zinc-900/60 border border-amber-500/40 rounded-lg text-zinc-300 placeholder-zinc-600 cursor-not-allowed opacity-80 text-xs ${extra}`;
    }
    if (empty) {
      return `w-full h-9 px-3 bg-black border border-dashed border-amber-500/45 focus:border-solid focus:border-amber-400 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden text-xs ${extra}`;
    }
    return `w-full h-9 px-3 bg-zinc-950 border border-zinc-700 focus:border-amber-400 rounded-lg text-white placeholder-zinc-500 focus:outline-hidden text-xs ${extra}`;
  };

  const handleSelectPackaging = (pkgName: string) => {
    if (isLocked('packagingType')) return;
    setPackagingType(pkgName);
    const found = packagingList.find((p) => p.name === pkgName);
    if (found) {
      if (!isLocked('packagingMassKg')) setPackagingMassKg(found.packagingMassKg);
      if (!isLocked('percentTara')) setPercentTara(found.taraPercent);
      if (!isLocked('flatKgTara')) setFlatKgTara(found.taraFlatKg);
      if (found.notes) setTaraNotes(found.notes);
    }
  };

  const calculation = calculateRawTobaccoCost({
    grossWeightKg: Number(grossWeightKg) || 0,
    pricePerKgPurchase: Number(pricePerKgPurchase) || 0,
    realPackagingMassKg: Number(packagingMassKg) || 0,
    agentFees,
    taraFormula: {
      rawFormula: formatTaraFormula(percentTara, flatKgTara),
      percent: Number(percentTara) || 0,
      flatKg: Number(flatKgTara) || 0,
      pricingBasis: 'NET_WEIGHT',
      packagingType: packagingType || 'Belum Dipilih',
      packagingMassKg: Number(packagingMassKg) || 0,
      sellerName,
    },
    additionalCost: Number(additionalCost) || 0,
  });

  const handleOpenStepByStep = (focus: RawTobaccoCalcFocus) => {
    setCalcDetail(
      buildRawTobaccoCalcDetail({
        name: name || 'Bahan Tembakau Mentah',
        packagingType: packagingType || 'Standar',
        grossWeightKg: Number(grossWeightKg) || 0,
        realPackagingMassKg: Number(packagingMassKg) || 0,
        percentTara: Number(percentTara) || 0,
        flatKgTara: Number(flatKgTara) || 0,
        pricePerKg: Number(pricePerKgPurchase) || 0,
        agentFees,
        additionalCost: Number(additionalCost) || 0,
        focus,
      })
    );
  };

  const QUICK_FIELD_ORDER = ['sellerName', 'name', 'origin', 'packagingType', 'grossWeightKg', 'pricePerKgPurchase'] as const;
  type QuickFocusField = (typeof QUICK_FIELD_ORDER)[number];

  const quickFieldRefMap: Record<
    QuickFocusField,
    React.RefObject<HTMLInputElement | HTMLSelectElement | null>
  > = {
    sellerName: sellerInputRef,
    name: nameInputRef,
    origin: originInputRef,
    packagingType: packagingSelectRef,
    grossWeightKg: grossInputRef,
    pricePerKgPurchase: priceInputRef,
  };

  const handleEnterAdvanceQuick = (
    e: React.KeyboardEvent,
    currentField: QuickFocusField
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const nextField = getNextFocusFieldId(QUICK_FIELD_ORDER, currentField, (f) =>
      isLocked(f)
    );
    if (nextField && quickFieldRefMap[nextField]?.current) {
      const target = quickFieldRefMap[nextField].current;
      target?.focus();
      if (target instanceof HTMLInputElement) {
        target.select();
      }
    } else {
      saveCurrentTobacco(false);
    }
  };

  const buildRawTobaccoPayload = (): RawTobacco => {
    const finalName =
      name.trim() ||
      rememberedTobaccoNames[0] ||
      'Tembakau Mentah';
    const finalSeller = sellerName.trim();

    const cleanedAgentFees: AgentFeeItem[] = agentFees
      .map((f, idx) => ({
        id: f.id || `fee-${Date.now()}-${idx}`,
        agentName: f.agentName.trim() || (Number(f.feePerKg) > 0 ? `Perantara #${idx + 1}` : ''),
        feePerKg: Math.max(0, Number(f.feePerKg) || 0),
      }))
      .filter((f) => f.agentName !== '' || f.feePerKg > 0);

    if (name.trim()) {
      const updatedNames = saveStringToStorageList(
        REMEMBERED_TOBACCO_NAMES_KEY,
        name.trim(),
        storedTobaccoNames
      );
      setStoredTobaccoNames(updatedNames);
    }
    if (finalSeller) {
      const updatedSellers = saveStringToStorageList(
        REMEMBERED_SELLER_NAMES_KEY,
        finalSeller,
        storedSellerNames
      );
      setStoredSellerNames(updatedSellers);
    }
    if (cleanedAgentFees.length > 0) {
      let currentAgentList = [...storedAgentNames];
      cleanedAgentFees.forEach((f) => {
        if (f.agentName && !f.agentName.startsWith('Perantara #')) {
          currentAgentList = saveStringToStorageList(
            REMEMBERED_AGENT_NAMES_KEY,
            f.agentName,
            currentAgentList
          );
        }
      });
      setStoredAgentNames(currentAgentList);
    }

    const activeLockedFields = ALL_RAW_FIELD_KEYS.filter((k) => !!lockedMap[k]);
    const rawFormula = formatTaraFormula(percentTara, flatKgTara);
    const todayStr = new Date().toISOString().split('T')[0];

    return {
      id: editingTobacco ? editingTobacco.id : `tbk-raw-${Date.now()}`,
      name: finalName,
      origin: origin.trim() || 'Belum Diisi',
      sellerName: finalSeller,
      lotNumber:
        lotNumber.trim() ||
        (editingTobacco?.lotNumber ? editingTobacco.lotNumber : `LOT-BAHAN-${Math.floor(100 + Math.random() * 900)}`),
      purchaseDate: purchaseDate.trim() || todayStr,
      grossWeightKg: Number(grossWeightKg) || 0,
      packagingMassKg: Number(packagingMassKg) || 0,
      pricePerKgPurchase: Number(pricePerKgPurchase) || 0,
      agentFees: cleanedAgentFees,
      totalAgentFeePerKg: calculation.totalAgentFeePerKg,
      totalAgentFeeRp: calculation.totalAgentFeeRp,
      taraFormula: {
        rawFormula,
        percent: Number(percentTara) || 0,
        flatKg: Number(flatKgTara) || 0,
        pricingBasis: 'NET_WEIGHT',
        packagingType: packagingType.trim() || 'Belum Dipilih',
        packagingMassKg: Number(packagingMassKg) || 0,
        sellerName: finalSeller,
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
        ? calculation.realNetWeightKg > 0
          ? calculation.realNetWeightKg
          : editingTobacco.currentStockNetKg
        : calculation.realNetWeightKg,
      powerRating: Number(powerRating) || 0,
      impactRating: Number(impactRating) || 0,
      bitterRating: Number(bitterRating) || 0,
      burnRating: Number(burnRating) || 0,
      sugarRating: Number(sugarRating) || 0,
      aromaRating: Number(aromaRating) || 0,
      colorGrade,
      characterNotes: characterNotes.trim(),
      lockedFields: activeLockedFields,
    };
  };

  const saveCurrentTobacco = (continueSameSeller: boolean) => {
    const updated = buildRawTobaccoPayload();
    onSave(updated);
    if (continueSameSeller && !editingTobacco) {
      // Keep seller, origin, and packaging for rapid consecutive basket grading
      setName('');
      setLotNumber('');
      setGrossWeightKg(0);
      setPricePerKgPurchase(0);
      setPowerRating(0);
      setImpactRating(0);
      setBitterRating(0);
      setBurnRating(0);
      setSugarRating(0);
      setAromaRating(0);
      setCharacterNotes('');
      window.setTimeout(() => {
        nameInputRef.current?.focus();
      }, 40);
      return;
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveCurrentTobacco(false);
  };

  const shadowNamePlaceholder = rememberedTobaccoNames[0] || 'Nama tembakau...';
  const shadowSellerPlaceholder = rememberedSellerNames[0] || 'Nama penjual / pengepul...';
  const shadowAgentPlaceholder = rememberedAgentNames[0] || 'Nama agen...';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        {/* Compact Modal Header with Kunci Semua & Buka Semua */}
        <div className="px-4 py-3 border-b border-zinc-800 bg-black flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-zinc-950 text-amber-400 border border-zinc-700 shrink-0">
              <Sparkles className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                {editingTobacco ? 'Edit Data Tembakau Mentah' : 'Tambah Tembakau Mentah'}
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                <span>
                  Terisi: <b className="text-white">{filledCount}</b>/{trackableKeys.length}
                </span>
                {emptyCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-300">Kosong: {emptyCount}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleLockAllFields}
              aria-label="Kunci semua kolom"
              className="group relative h-8 w-8 shrink-0 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/50 inline-flex items-center justify-center cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-amber-500/60 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                Kunci Semua Kolom
              </span>
            </button>
            <button
              type="button"
              onClick={handleUnlockAllFields}
              aria-label="Buka semua kolom"
              className="group relative h-8 w-8 shrink-0 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 inline-flex items-center justify-center cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 shrink-0" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -bottom-8 right-0 z-50 px-2.5 py-1 rounded-md bg-black border border-zinc-700 text-white text-[10px] font-bold whitespace-nowrap shadow-xl">
                Buka Semua Kolom
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              aria-label="Tutup modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean Mode Switcher: 1. Grading & Input Cepat (Default unified view) | 2. Lanjutan (Lot/Fee/Tarra/Kunci) */}
        <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800/90 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-black p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveSection('quick')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                activeSection === 'quick'
                  ? 'bg-amber-500 text-black font-black'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              1. Grading &amp; Input Cepat ({colorGrade})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('advanced')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                activeSection === 'advanced'
                  ? 'bg-amber-500 text-black font-black'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              2. Detail Lanjutan (Lot, Fee &amp; Tarra)
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                activeSection === 'all'
                  ? 'bg-zinc-800 text-amber-400 border border-amber-500/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Semua
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-zinc-400">
              <ArrowRight className="w-3 h-3 text-amber-400" />
              Enter = Lanjut Kolom
            </span>
            <span className="text-zinc-300">
              Modal: <b className="text-amber-400">{formatRupiah(calculation.totalModalAsal)}</b>
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-3.5 sm:p-4 space-y-3.5 flex-1 text-xs">
          {/* MODE 1: UNIFIED SIMULTANEOUS GRADING & INPUT (Penjual -> Jenis -> Daerah -> Kemasan -> Grade + 6 Karakter + Timbangan/Harga Opsional) */}
          {(activeSection === 'quick' || activeSection === 'all') && (
            <div className="space-y-3">
              {/* Step A: 4 Core Gudang Identity Inputs in Exact Grading Order with Enter-to-Advance */}
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <div className="flex flex-col">
                    {renderFieldLabel(
                      '1. Penjual / Petani',
                      'sellerName',
                      <UserCheck className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                    <input
                      ref={sellerInputRef}
                      type="text"
                      enterKeyHint="next"
                      list="remembered-seller-names-list"
                      disabled={isLocked('sellerName')}
                      value={sellerName}
                      onChange={(e) => setSellerName(e.target.value)}
                      onKeyDown={(e) => handleEnterAdvanceQuick(e, 'sellerName')}
                      placeholder={shadowSellerPlaceholder}
                      className={getTextboxClass('sellerName')}
                    />
                    <datalist id="remembered-seller-names-list">
                      {rememberedSellerNames.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {!isLocked('sellerName') && rememberedSellerNames.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {rememberedSellerNames.slice(0, 3).map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setSellerName(item)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer max-w-[120px] truncate ${
                              sellerName === item
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('2. Jenis Tembakau', 'name')}
                    <input
                      ref={nameInputRef}
                      type="text"
                      enterKeyHint="next"
                      list="remembered-tobacco-names-list"
                      disabled={isLocked('name')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => handleEnterAdvanceQuick(e, 'name')}
                      placeholder={shadowNamePlaceholder}
                      className={getTextboxClass('name')}
                    />
                    <datalist id="remembered-tobacco-names-list">
                      {rememberedTobaccoNames.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                    {!isLocked('name') && rememberedTobaccoNames.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {rememberedTobaccoNames.slice(0, 3).map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setName(item)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer max-w-[130px] truncate ${
                              name === item
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('3. Daerah Asal', 'origin')}
                    <input
                      ref={originInputRef}
                      type="text"
                      enterKeyHint="next"
                      list="tobacco-origins-datalist"
                      disabled={isLocked('origin')}
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      onKeyDown={(e) => handleEnterAdvanceQuick(e, 'origin')}
                      placeholder="Muntilan / Temanggung"
                      className={getTextboxClass('origin')}
                    />
                    <datalist id="tobacco-origins-datalist">
                      <option value="Temanggung" />
                      <option value="Muntilan" />
                      <option value="Madura" />
                      <option value="Boyolali" />
                      <option value="Lombok" />
                      <option value="Weleri" />
                      <option value="Jember" />
                    </datalist>
                    {!isLocked('origin') && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {['Muntilan', 'Temanggung', 'Boyolali'].map((orig) => (
                          <button
                            key={orig}
                            type="button"
                            onClick={() => setOrigin(orig)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              origin === orig
                                ? 'bg-amber-500 text-black border-amber-400'
                                : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border-zinc-800'
                            }`}
                          >
                            {orig}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('4. Kemasan', 'packagingType')}
                    <select
                      ref={packagingSelectRef}
                      disabled={isLocked('packagingType')}
                      value={packagingType}
                      onChange={(e) => handleSelectPackaging(e.target.value)}
                      onKeyDown={(e) => handleEnterAdvanceQuick(e, 'packagingType')}
                      className={getTextboxClass('packagingType', 'font-bold')}
                    >
                      <option value="">-- Pilih Kemasan --</option>
                      {packagingList.map((pkg) => (
                        <option key={pkg.id} value={pkg.name}>
                          {pkg.name} (Tarra {formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step B: Simultaneous Grade + 6 Karakter Grading on SAME Screen */}
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <span className="text-[11px] font-bold text-zinc-200">
                      5. Grade &amp; 6 Atribut Grading Lapangan
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {QUICK_CHARACTER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            if (!isLocked('powerRating')) setPowerRating(preset.values.power);
                            if (!isLocked('impactRating')) setImpactRating(preset.values.impact);
                            if (!isLocked('bitterRating')) setBitterRating(preset.values.bitter);
                            if (!isLocked('burnRating')) setBurnRating(preset.values.burn);
                            if (!isLocked('sugarRating')) setSugarRating(preset.values.sugar);
                            if (!isLocked('aromaRating')) setAromaRating(preset.values.aroma);
                          }}
                          className="px-2 py-0.5 rounded bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/60 text-[10px] font-bold text-amber-300 cursor-pointer"
                        >
                          Preset: {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {TOBACCO_GRADE_ORDER.map((grade) => {
                      const isSelected = colorGrade === grade;
                      return (
                        <button
                          key={grade}
                          type="button"
                          disabled={isLocked('colorGrade')}
                          onClick={() => {
                            if (!isLocked('colorGrade')) setColorGrade(grade);
                          }}
                          className={`h-8 rounded-lg border text-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-0.5 ${
                            isSelected
                              ? 'bg-amber-500 text-black border-amber-400 font-black'
                              : 'bg-zinc-950 border-zinc-800 text-white hover:border-zinc-700 font-bold'
                          }`}
                        >
                          <span className="text-xs">{grade}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 6 Sensory Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'powerRating' as RawLockableFieldKey, label: 'Power', value: powerRating, onChange: setPowerRating },
                      { key: 'impactRating' as RawLockableFieldKey, label: 'Impact', value: impactRating, onChange: setImpactRating },
                      { key: 'bitterRating' as RawLockableFieldKey, label: 'Bitter', value: bitterRating, onChange: setBitterRating },
                      { key: 'burnRating' as RawLockableFieldKey, label: 'Burn', value: burnRating, onChange: setBurnRating },
                      { key: 'sugarRating' as RawLockableFieldKey, label: 'Sugar', value: sugarRating, onChange: setSugarRating },
                      { key: 'aromaRating' as RawLockableFieldKey, label: 'Aroma', value: aromaRating, onChange: setAromaRating },
                    ] as const
                  ).map((param) => (
                    <RatingSegmentSlider
                      key={param.key}
                      label={param.label}
                      value={param.value}
                      onChange={param.onChange}
                      disabled={isLocked(param.key)}
                    />
                  ))}
                </div>

                <div>
                  <input
                    type="text"
                    disabled={isLocked('characterNotes')}
                    value={characterNotes}
                    onChange={(e) => setCharacterNotes(e.target.value)}
                    placeholder="Catatan pegangan / gagang / warna (opsional)..."
                    className={getTextboxClass('characterNotes')}
                  />
                </div>
              </div>

              {/* Step C: Timbangan & Harga (Opsional / Menyusul) */}
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-white inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    6. Timbangan &amp; Harga (Kosongkan / 0 Jika Menyusul)
                  </span>
                  <span className="text-[10px] font-mono text-amber-300">
                    {grossWeightKg <= 0 && pricePerKgPurchase <= 0
                      ? '⏳ Ditandai: Butuh Timbangan & Harga'
                      : grossWeightKg <= 0
                        ? '⏳ Ditandai: Butuh Timbangan'
                        : pricePerKgPurchase <= 0
                          ? '⏳ Ditandai: Butuh Harga'
                          : `Netto ${calculation.netWeightKg} kg • ${formatRupiah(calculation.totalModalAsal)}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  <div className="flex flex-col">
                    {renderFieldLabel('Bruto Timbangan (KG)', 'grossWeightKg')}
                    <div className="relative">
                      <NumericInput
                        ref={grossInputRef}
                        emptyWhenZero
                        enterKeyHint="next"
                        disabled={isLocked('grossWeightKg')}
                        value={grossWeightKg}
                        onChange={setGrossWeightKg}
                        onKeyDown={(e) => handleEnterAdvanceQuick(e, 'grossWeightKg')}
                        placeholder="Menyusul (0)"
                        className={getTextboxClass('grossWeightKg', 'pr-7 font-mono font-bold')}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[11px] pointer-events-none">
                        kg
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('Harga Tembakau / KG (Rp)', 'pricePerKgPurchase')}
                    <NumericInput
                      ref={priceInputRef}
                      emptyWhenZero
                      enterKeyHint="done"
                      disabled={isLocked('pricePerKgPurchase')}
                      value={pricePerKgPurchase}
                      onChange={setPricePerKgPurchase}
                      onKeyDown={(e) => handleEnterAdvanceQuick(e, 'pricePerKgPurchase')}
                      placeholder="Menyusul (0)"
                      className={getTextboxClass('pricePerKgPurchase', 'font-mono font-bold')}
                    />
                  </div>

                  <div className="h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between font-mono text-xs">
                    <span className="text-[10px] text-zinc-400">Netto Nota:</span>
                    <b className="text-amber-400 text-xs">{calculation.netWeightKg} kg</b>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: DETAIL LANJUTAN (Lot, Tanggal, Tarra Manual, Fee Perantara & Breakdown) */}
          {(activeSection === 'advanced' || activeSection === 'all') && (
            <div className="space-y-3.5">
              <div className="bg-black p-3.5 rounded-xl border border-zinc-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex flex-col">
                    {renderFieldLabel('Nomor Seri / Lot Beli', 'lotNumber')}
                    <input
                      ref={lotInputRef}
                      type="text"
                      disabled={isLocked('lotNumber')}
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="LOT-BAHAN-001"
                      className={getTextboxClass('lotNumber', 'font-mono font-bold')}
                    />
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('Tanggal Beli', 'purchaseDate')}
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        disabled={isLocked('purchaseDate')}
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className={getTextboxClass('purchaseDate')}
                      />
                      {!isLocked('purchaseDate') && !purchaseDate && (
                        <button
                          type="button"
                          onClick={() =>
                            setPurchaseDate(new Date().toISOString().split('T')[0])
                          }
                          className="h-9 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          Hari Ini
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
                  <div className="flex flex-col">
                    {renderFieldLabel('Tarra Flat (KG)', 'flatKgTara')}
                    <NumericInput
                      emptyWhenZero
                      disabled={isLocked('flatKgTara')}
                      value={flatKgTara}
                      onChange={setFlatKgTara}
                      placeholder="2"
                      className={getTextboxClass('flatKgTara', 'font-mono font-bold')}
                    />
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('Tarra (%)', 'percentTara')}
                    <NumericInput
                      emptyWhenZero
                      disabled={isLocked('percentTara')}
                      value={percentTara}
                      onChange={setPercentTara}
                      placeholder="10"
                      className={getTextboxClass('percentTara', 'font-mono font-bold')}
                    />
                  </div>

                  <div className="flex flex-col">
                    {renderFieldLabel('Berat Wadah Riil (KG)', 'packagingMassKg')}
                    <NumericInput
                      emptyWhenZero
                      disabled={isLocked('packagingMassKg')}
                      value={packagingMassKg}
                      onChange={setPackagingMassKg}
                      placeholder="3"
                      className={getTextboxClass('packagingMassKg', 'font-mono font-bold')}
                    />
                  </div>
                </div>

                {/* Compact Fee Perantara Bar */}
                <div className="pt-2.5 border-t border-zinc-900 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-white inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>Biaya Fee Perantara (Netto × Fee/KG)</span>
                      </span>

                      {calculation.totalAgentFeePerKg > 0 && (
                        <span className="text-[11px] font-mono font-bold text-amber-300">
                          {formatRupiah(calculation.totalAgentFeePerKg)}/kg × {calculation.netWeightKg} kg ={' '}
                          <b className="text-white">{formatRupiah(calculation.totalAgentFeeRp)}</b>
                        </span>
                      )}

                      {!isLocked('agentFees') &&
                        rememberedAgentNames.slice(0, 4).map((agentNameItem) => (
                          <button
                            key={agentNameItem}
                            type="button"
                            onClick={() => handleAddAgentFeeRow(agentNameItem)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-950 hover:bg-zinc-900 text-amber-300 border border-zinc-800 cursor-pointer"
                          >
                            + {agentNameItem}
                          </button>
                        ))}
                    </div>

                    {!isLocked('agentFees') && (
                      <button
                        type="button"
                        onClick={() => handleAddAgentFeeRow('')}
                        aria-label="Tambah Orang / Fee Perantara"
                        className="h-6 w-6 shrink-0 rounded bg-amber-500 hover:bg-amber-400 text-black font-black inline-flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                      </button>
                    )}
                  </div>

                  <datalist id="remembered-agent-names-list">
                    {rememberedAgentNames.map((agent) => (
                      <option key={agent} value={agent} />
                    ))}
                  </datalist>

                  {agentFees.length > 0 && (
                    <div className="space-y-1.5">
                      {agentFees.map((feeRow, index) => {
                        const rowLocked = isLocked('agentFees');
                        const rowFeePerKg = Math.max(0, Number(feeRow.feePerKg) || 0);
                        const rowTotalFeeRp = Math.round(calculation.netWeightKg * rowFeePerKg);
                        return (
                          <div
                            key={feeRow.id}
                            className="grid grid-cols-12 gap-2 items-center bg-zinc-950 p-2 rounded-lg border border-zinc-800"
                          >
                            <div className="col-span-5 sm:col-span-4">
                              <input
                                type="text"
                                list="remembered-agent-names-list"
                                disabled={rowLocked}
                                value={feeRow.agentName}
                                onChange={(e) =>
                                  handleUpdateAgentFeeRow(feeRow.id, {
                                    agentName: e.target.value,
                                  })
                                }
                                placeholder={rememberedAgentNames[index] || shadowAgentPlaceholder}
                                className="w-full h-8 px-2.5 bg-black border border-zinc-700 rounded-md text-xs font-bold text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-400"
                              />
                            </div>

                            <div className="col-span-4 sm:col-span-3 relative">
                              <NumericInput
                                emptyWhenZero
                                disabled={rowLocked}
                                value={feeRow.feePerKg}
                                onChange={(val) =>
                                  handleUpdateAgentFeeRow(feeRow.id, { feePerKg: val })
                                }
                                placeholder="1000"
                                className="w-full h-8 px-2.5 pr-8 bg-black border border-zinc-700 rounded-md text-xs font-mono font-bold text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-400"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[10px] font-mono pointer-events-none">
                                /kg
                              </span>
                            </div>

                            <div className="col-span-2 sm:col-span-4 font-mono text-[11px] text-zinc-300 truncate text-right">
                              <b className="text-white">{formatRupiah(rowTotalFeeRp)}</b>
                            </div>

                            <div className="col-span-1 flex justify-end">
                              {!rowLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAgentFeeRow(feeRow.id)}
                                  className="h-8 px-2 rounded-md bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-zinc-800 text-[10px] font-bold inline-flex items-center justify-center cursor-pointer"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3 Metric Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={() => handleOpenStepByStep('PAID_VALUE')}
                    className="text-left bg-zinc-950 p-2.5 rounded-lg border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-amber-400 uppercase font-bold truncate">
                        1. Total Modal / Inventori
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="font-mono font-black text-amber-400 text-xs sm:text-sm mt-1">
                      {formatRupiah(calculation.totalModalAsal)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenStepByStep('REAL_VALUE')}
                    className="text-left bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-zinc-200 uppercase font-bold truncate">
                        2. Weight Profit (Rupiah)
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="font-mono font-black text-white text-xs sm:text-sm mt-1">
                      {calculation.purchaseWeightProfitRp >= 0 ? '+' : ''}
                      {formatRupiah(calculation.purchaseWeightProfitRp)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenStepByStep('WEIGHT_PROFIT')}
                    className="text-left bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-zinc-300 uppercase font-bold truncate">
                        3. Weight Profit (KG)
                      </span>
                      <CalcSymbolBadge />
                    </div>
                    <div className="font-mono font-black text-amber-300 text-xs sm:text-sm mt-1">
                      {calculation.purchaseWeightProfitKg >= 0 ? '+' : ''}
                      {calculation.purchaseWeightProfitKg} kg
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Footer with Save & Repeat Same Seller */}
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Batal
            </button>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {!editingTobacco && (
                <button
                  type="button"
                  onClick={() => saveCurrentTobacco(true)}
                  className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  title="Simpan tembakau ini lalu langsung input keranjang berikutnya dari penjual/daerah/kemasan yang sama"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Simpan &amp; Lanjut Penjual Sama</span>
                </button>
              )}
              <button
                type="submit"
                className="btn-amber-outline h-9 px-5 rounded-xl font-black text-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{editingTobacco ? 'Simpan Perubahan' : 'Simpan Barang'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
      <CalculationDetailModal data={calcDetail} onClose={() => setCalcDetail(null)} />
    </div>
  );
};
