/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calculator } from 'lucide-react';
import { Navbar, ActiveTab } from './components/Navbar';
import { RawTobaccoList } from './components/RawTobaccoList';
import { RawTobaccoModal } from './components/RawTobaccoModal';
import { BlendCalculator } from './components/BlendCalculator';
import { FinishedTobaccoList } from './components/FinishedTobaccoList';
import { RollArchiveView } from './components/RollArchiveView';
import { RollDetailModal } from './components/RollDetailModal';
import { TaraSimulator } from './components/TaraSimulator';
import { MasterRegistryModal } from './components/MasterRegistryModal';
import { PatchNotesModal, CURRENT_APP_VERSION } from './components/PatchNotesModal';
import { ArchitecturalBackground } from './components/ArchitecturalBackground';
import { CloudLoginScreen } from './components/CloudLoginScreen';
import { HistoryView } from './components/HistoryView';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { BackupRestoreModal, TobaccoBackupPayload } from './components/BackupRestoreModal';
import {
  auth,
  db,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  serverTimestamp,
  onAuthStateChanged,
  signOutFromCloud,
  sanitizeForFirestore,
  handleFirestoreError,
  OperationType,
  User,
} from './firebase';
import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  BlendIngredient,
  PackagingMaster,
  FactoryMaster,
  SerialFactoryStatus,
  TobaccoGrade,
} from './types/tobacco';
import {
  INITIAL_RAW_TOBACCO,
  INITIAL_FINISHED_TOBACCO,
  INITIAL_ROLL_SAMPLES,
  INITIAL_PACKAGING_MASTERS,
  INITIAL_FACTORY_MASTERS,
} from './data/mockTobacco';
import {
  clampRating5,
  applyRejectedSerialReassignment,
  roundHalfUpKg,
  calculateRawTobaccoCost,
  calculateTaraDeduction,
} from './utils/tobaccoMath';

function normalizeRawTobaccoRounding(item: RawTobacco): RawTobacco {
  if (!item || !item.taraFormula) return item;
  const calc = calculateRawTobaccoCost({
    grossWeightKg: item.grossWeightKg || 0,
    pricePerKgPurchase: item.pricePerKgPurchase || 0,
    taraFormula: item.taraFormula,
    additionalCost: item.additionalPurchaseCost || 0,
    realPackagingMassKg: item.packagingMassKg,
    agentFees: item.agentFees,
  });
  return {
    ...item,
    grossWeightKg: roundHalfUpKg(item.grossWeightKg || 0),
    packagingMassKg: roundHalfUpKg(item.packagingMassKg ?? item.taraFormula.packagingMassKg ?? 0),
    deductionKg: calc.deductionKg,
    netWeightKg: calc.netWeightKg,
    totalModalAsal: calc.totalModalAsal,
    realCostPerNetKg: calc.realCostPerNetKg,
    realNetWeightKg: calc.realNetWeightKg,
    realStockValueRp: calc.realStockValueRp,
    purchaseWeightProfitKg: calc.purchaseWeightProfitKg,
    purchaseWeightProfitRp: calc.purchaseWeightProfitRp,
    effectiveCostPerRealKg: calc.effectiveCostPerRealKg,
  };
}

function normalizeFinishedSerialRounding(serial: FinishedTobaccoSerial): FinishedTobaccoSerial {
  if (!serial || !serial.packaging) return serial;
  const gross = roundHalfUpKg(serial.packaging.grossWeightPerPackage || 0);
  const pkgMass = roundHalfUpKg(
    serial.packaging.packagingMassKg ?? serial.factoryDeductionKg ?? 0
  );
  const realNet = Math.max(0, roundHalfUpKg(gross - pkgMass));
  const taraRule = serial.packaging.factoryTaraFormula;
  const deductionKg =
    taraRule && (Number(taraRule.percent) > 0 || Number(taraRule.flatKg) > 0)
      ? calculateTaraDeduction(gross, taraRule).deductionKg
      : roundHalfUpKg(serial.factoryDeductionKg || 0);
  const billableNet = Math.max(0, roundHalfUpKg(gross - deductionKg));
  const weightProfitKg = roundHalfUpKg(billableNet - realNet);
  const targetPrice = Number(serial.factoryTargetPricePerKg) || 0;
  const hppPerKg = Math.round(serial.effectiveHppAfterTaraPerKg || serial.hppPerNetKg || 0);
  const totalModalRp = Math.round(billableNet * hppPerKg);
  const totalNotaRp = Math.round(billableNet * targetPrice);
  const profitRp = totalNotaRp - totalModalRp;
  const marginPercent =
    totalNotaRp > 0 ? Number(((profitRp / totalNotaRp) * 100).toFixed(2)) : 0;

  return {
    ...serial,
    totalBlendNetKg: realNet,
    totalProductionCost: totalModalRp,
    packaging: {
      ...serial.packaging,
      grossWeightPerPackage: gross,
      packagingMassKg: pkgMass,
      netTobaccoWeightKg: realNet,
    },
    factoryDeductionKg: deductionKg,
    factoryNetBillableKg: billableNet,
    factoryWeightProfitKg: weightProfitKg,
    factoryWeightProfitRp: Math.round(weightProfitKg * targetPrice),
    projectedRevenue: totalNotaRp,
    projectedProfit: profitRp,
    profitMarginPercent: marginPercent,
  };
}

const STORAGE_KEYS = {
  RAW: 'kretek_master_raw_tobacco_v3',
  FINISHED: 'kretek_master_finished_tobacco_v3',
  ROLLS: 'kretek_master_rolls_v3',
  PACKAGING: 'kretek_master_packaging_v3',
  FACTORIES: 'kretek_master_factories_v3',
  SEEN_PATCH: 'kretek_master_seen_patch_version',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');

  const [rawTobaccos, setRawTobaccos] = useState<RawTobacco[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RAW);
      const parsed: RawTobacco[] = saved ? JSON.parse(saved) : INITIAL_RAW_TOBACCO;
      return parsed.map(normalizeRawTobaccoRounding);
    } catch {
      return INITIAL_RAW_TOBACCO.map(normalizeRawTobaccoRounding);
    }
  });

  const [finishedBatches, setFinishedBatches] = useState<FinishedTobaccoSerial[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FINISHED);
      const parsed: FinishedTobaccoSerial[] = saved
        ? JSON.parse(saved)
        : INITIAL_FINISHED_TOBACCO;
      return parsed.map(normalizeFinishedSerialRounding);
    } catch {
      return INITIAL_FINISHED_TOBACCO.map(normalizeFinishedSerialRounding);
    }
  });

  const [rollSamples, setRollSamples] = useState<TobaccoRollSample[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLLS);
      return saved ? JSON.parse(saved) : INITIAL_ROLL_SAMPLES;
    } catch {
      return INITIAL_ROLL_SAMPLES;
    }
  });

  const [packagingList, setPackagingList] = useState<PackagingMaster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PACKAGING);
      return saved ? JSON.parse(saved) : INITIAL_PACKAGING_MASTERS;
    } catch {
      return INITIAL_PACKAGING_MASTERS;
    }
  });

  const [factoryList, setFactoryList] = useState<FactoryMaster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FACTORIES);
      return saved ? JSON.parse(saved) : INITIAL_FACTORY_MASTERS;
    } catch {
      return INITIAL_FACTORY_MASTERS;
    }
  });

  // Modals
  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [editingTobacco, setEditingTobacco] = useState<RawTobacco | null>(null);
  const [selectedRoll, setSelectedRoll] = useState<TobaccoRollSample | null>(null);
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [masterInitialSection, setMasterInitialSection] = useState<
    'packaging' | 'factory' | 'gulungan'
  >('packaging');
  const [isPatchNotesOpen, setIsPatchNotesOpen] = useState(false);
  const [hasUnreadPatch, setHasUnreadPatch] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SEEN_PATCH) !== CURRENT_APP_VERSION;
    } catch {
      return true;
    }
  });

  const [blendPrefilledIngredients, setBlendPrefilledIngredients] = useState<BlendIngredient[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);
  const [backupModalMode, setBackupModalMode] = useState<'backup' | 'restore' | null>(null);
  const [stockInitialPanel, setStockInitialPanel] = useState<'raw' | 'rejected-finished'>('raw');

  // Firebase Auth & Real-Time Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [offlineBypass, setOfflineBypass] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return true;
    }
    return false;
  });
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'offline' | 'syncing' | 'synced' | 'error'>(
    'offline'
  );
  const isApplyingRemoteRef = useRef<boolean>(false);
  const initialCloudLoadDoneRef = useRef<boolean>(false);
  // Strict guard: never push local state to Firestore unless the user actually mutated data after cloud load
  const hasLocalUserMutationRef = useRef<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const applyRemoteWorkspaceData = useCallback(
    (data: Record<string, unknown>, notifyToast?: string) => {
      isApplyingRemoteRef.current = true;
      if (Array.isArray(data.rawTobaccos))
        setRawTobaccos((data.rawTobaccos as RawTobacco[]).map(normalizeRawTobaccoRounding));
      if (Array.isArray(data.finishedBatches))
        setFinishedBatches(
          (data.finishedBatches as FinishedTobaccoSerial[]).map(normalizeFinishedSerialRounding)
        );
      if (Array.isArray(data.rollSamples))
        setRollSamples(data.rollSamples as TobaccoRollSample[]);
      if (Array.isArray(data.packagingList))
        setPackagingList(data.packagingList as PackagingMaster[]);
      if (Array.isArray(data.factoryList)) setFactoryList(data.factoryList as FactoryMaster[]);

      initialCloudLoadDoneRef.current = true;
      setCloudSyncStatus('synced');
      if (notifyToast) {
        showToast(notifyToast);
      }
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 150);
    },
    [showToast]
  );

  /**
   * Explicit HTTP/Long-Polling Cloud Pull (Crucial for iPhone / iOS Safari / Home Screen PWA
   * where passive `onSnapshot` streams can stall after Google OAuth sign-in).
   */
  const pullCloudWorkspace = useCallback(
    async (user: User, options?: { showSuccessToast?: boolean }) => {
      const workspacePath = `workspaces/${user.uid}`;
      const workspaceRef = doc(db, 'workspaces', user.uid);
      setCloudSyncStatus('syncing');

      try {
        // Race getDocFromServer against a 5s timer on mobile networks, falling back to getDoc
        const snapshot = await Promise.race([
          getDocFromServer(workspaceRef),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('SERVER_PULL_TIMEOUT')), 5000)
          ),
        ]).catch(async () => {
          return await getDoc(workspaceRef);
        });

        if (snapshot.exists()) {
          applyRemoteWorkspaceData(
            snapshot.data() as Record<string, unknown>,
            options?.showSuccessToast
              ? 'Data Cloud terbaru berhasil dimuat dari server!'
              : undefined
          );
          return true;
        } else if (!snapshot.metadata.fromCache) {
          // Only initialize a brand-new cloud workspace if the live server confirmed no document exists yet
          await setDoc(workspaceRef, {
            ownerId: user.uid,
            rawTobaccos: sanitizeForFirestore(rawTobaccos.slice(0, 300)),
            finishedBatches: sanitizeForFirestore(finishedBatches.slice(0, 500)),
            rollSamples: sanitizeForFirestore(rollSamples.slice(0, 200)),
            packagingList: sanitizeForFirestore(packagingList.slice(0, 100)),
            factoryList: sanitizeForFirestore(factoryList.slice(0, 100)),
            updatedAt: serverTimestamp(),
          });
          initialCloudLoadDoneRef.current = true;
          setCloudSyncStatus('synced');
          return true;
        }
        return false;
      } catch (err) {
        console.warn('Cloud pull warning:', err);
        setCloudSyncStatus('error');
        if (options?.showSuccessToast) {
          showToast('Gagal menarik data Cloud. Periksa koneksi internet lalu ketuk ikon Cloud.');
        }
        return false;
      }
    },
    [
      applyRemoteWorkspaceData,
      factoryList,
      finishedBatches,
      packagingList,
      rawTobaccos,
      rollSamples,
      showToast,
    ]
  );

  // Track Firebase Google Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudSyncStatus('offline');
        initialCloudLoadDoneRef.current = false;
        hasLocalUserMutationRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Dual-Path Cloud Sync on Login: Immediate Server Pull + Real-Time Listener + Watchdog
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const workspacePath = `workspaces/${currentUser.uid}`;
    const workspaceRef = doc(db, 'workspaces', currentUser.uid);
    let isCancelled = false;

    // 1. Immediately pull from server so iPhone / iOS Safari never hangs waiting on stream
    pullCloudWorkspace(currentUser, { showSuccessToast: false });

    // 2. Attach real-time listener for live multi-device updates
    const unsubscribe = onSnapshot(
      workspaceRef,
      (snapshot) => {
        if (isCancelled) return;
        if (snapshot.exists()) {
          applyRemoteWorkspaceData(snapshot.data() as Record<string, unknown>);
        }
      },
      (err) => {
        if (isCancelled) return;
        setCloudSyncStatus('error');
        try {
          handleFirestoreError(err, OperationType.GET, workspacePath);
        } catch {
          // Logged by handleFirestoreError
        }
      }
    );

    // 3. Watchdog: if still syncing after 6.5s on mobile, retry explicit pull
    const watchdogTimer = setTimeout(() => {
      if (!isCancelled && !initialCloudLoadDoneRef.current) {
        pullCloudWorkspace(currentUser, { showSuccessToast: false });
      }
    }, 6500);

    return () => {
      isCancelled = true;
      clearTimeout(watchdogTimer);
      unsubscribe();
    };
  }, [authReady, currentUser]);

  // Automatically sync local state changes to Firestore Cloud ONLY after initial cloud pull AND real user edit
  useEffect(() => {
    if (
      !authReady ||
      !currentUser ||
      !initialCloudLoadDoneRef.current ||
      isApplyingRemoteRef.current ||
      !hasLocalUserMutationRef.current
    ) {
      return;
    }

    const workspacePath = `workspaces/${currentUser.uid}`;
    const workspaceRef = doc(db, 'workspaces', currentUser.uid);
    setCloudSyncStatus('syncing');

    const timer = setTimeout(async () => {
      try {
        await setDoc(workspaceRef, {
          ownerId: currentUser.uid,
          rawTobaccos: sanitizeForFirestore(rawTobaccos.slice(0, 300)),
          finishedBatches: sanitizeForFirestore(finishedBatches.slice(0, 500)),
          rollSamples: sanitizeForFirestore(rollSamples.slice(0, 200)),
          packagingList: sanitizeForFirestore(packagingList.slice(0, 100)),
          factoryList: sanitizeForFirestore(factoryList.slice(0, 100)),
          updatedAt: serverTimestamp(),
        });
        hasLocalUserMutationRef.current = false;
        setCloudSyncStatus('synced');
      } catch (err) {
        setCloudSyncStatus('error');
        handleFirestoreError(err, OperationType.WRITE, workspacePath);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    rawTobaccos,
    finishedBatches,
    rollSamples,
    packagingList,
    factoryList,
    authReady,
    currentUser,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.RAW, JSON.stringify(rawTobaccos));
    } catch (e) {
      console.error('Error saving raw tobaccos', e);
    }
  }, [rawTobaccos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FINISHED, JSON.stringify(finishedBatches));
    } catch (e) {
      console.error('Error saving finished batches', e);
    }
  }, [finishedBatches]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLLS, JSON.stringify(rollSamples));
    } catch (e) {
      console.error('Error saving rolls', e);
    }
  }, [rollSamples]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PACKAGING, JSON.stringify(packagingList));
    } catch (e) {
      console.error('Error saving packaging', e);
    }
  }, [packagingList]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FACTORIES, JSON.stringify(factoryList));
    } catch (e) {
      console.error('Error saving factories', e);
    }
  }, [factoryList]);

  const handleSaveRawTobacco = (tobacco: RawTobacco) => {
    hasLocalUserMutationRef.current = true;
    const exists = rawTobaccos.some((t) => t.id === tobacco.id);
    if (exists) {
      setRawTobaccos(rawTobaccos.map((t) => (t.id === tobacco.id ? tobacco : t)));
      showToast(`Data "${tobacco.name}" berhasil diperbarui.`);
    } else {
      setRawTobaccos([tobacco, ...rawTobaccos]);
      showToast(`Tembakau baru "${tobacco.name}" berhasil ditambahkan.`);
    }
    setEditingTobacco(null);
  };

  const handleDeleteRawTobacco = (id: string) => {
    const item = rawTobaccos.find((t) => t.id === id);
    if (!item) return;
    hasLocalUserMutationRef.current = true;
    setRawTobaccos(rawTobaccos.filter((t) => t.id !== id));
    showToast(`Tembakau "${item.name}" telah dihapus.`);
  };

  const handleAddToBlend = (tobacco: RawTobacco) => {
    const newIng: BlendIngredient = {
      tobaccoId: tobacco.id,
      tobaccoName: tobacco.name,
      origin: tobacco.origin,
      sellerName: tobacco.sellerName,
      usedNetKg: 25,
      percentageInBlend: 0,
      realCostPerNetKg: tobacco.realCostPerNetKg,
      effectiveCostPerRealKg: tobacco.effectiveCostPerRealKg ?? tobacco.realCostPerNetKg,
      subtotalCost: 25 * tobacco.realCostPerNetKg,
      powerRating: clampRating5(tobacco.powerRating),
      impactRating: clampRating5(tobacco.impactRating),
      bitterRating: clampRating5(tobacco.bitterRating),
      burnRating: clampRating5(tobacco.burnRating ?? 4.5),
      sugarRating: clampRating5(tobacco.sugarRating ?? 4.0),
      aromaRating: clampRating5(tobacco.aromaRating ?? 4.2),
      colorGrade: tobacco.colorGrade,
      characterNotes: tobacco.characterNotes,
    };

    setBlendPrefilledIngredients((prev) => {
      if (prev.some((p) => p.tobaccoId === tobacco.id)) return prev;
      return [...prev, newIng];
    });

    setActiveTab('calculator');
    showToast(`"${tobacco.name}" dimasukkan ke Kalkulator Campuran.`);
  };

  // Optional rare action: unpack a rejected finished serial back into BlendCalculator
  const handleUnpackRejectedToBlend = (serial: FinishedTobaccoSerial) => {
    if (serial.ingredients && serial.ingredients.length > 0) {
      setBlendPrefilledIngredients(serial.ingredients);
    } else {
      setBlendPrefilledIngredients([
        {
          tobaccoId: `unpacked-${serial.id}`,
          tobaccoName: `Bongkaran Seri ${serial.serialNumber} (${serial.recipeName})`,
          origin: serial.targetFactory,
          usedNetKg: serial.factoryNetBillableKg,
          percentageInBlend: 100,
          realCostPerNetKg: serial.hppPerNetKg,
          subtotalCost: Math.round(serial.factoryNetBillableKg * serial.hppPerNetKg),
          powerRating: clampRating5(serial.weightedPower),
          impactRating: clampRating5(serial.weightedImpact),
          bitterRating: clampRating5(serial.weightedBitter),
          burnRating: clampRating5(serial.weightedBurn ?? 4.5),
          sugarRating: clampRating5(serial.weightedSugar ?? 4.0),
          aromaRating: clampRating5(serial.weightedAroma ?? 4.2),
          colorGrade: serial.compositeColorGrade,
        },
      ]);
    }
    setActiveTab('calculator');
    showToast(`Seri ${serial.serialNumber} dibongkar ke Kalkulator Racikan.`);
  };

  // Save Multiple Finished Serials from 1 Mixture
  const handleSaveMultipleFinished = (createdSerials: FinishedTobaccoSerial[]) => {
    hasLocalUserMutationRef.current = true;
    setFinishedBatches([...createdSerials, ...finishedBatches]);

    // Update Gulungan samples that received these serials
    setRollSamples((prevRolls) =>
      prevRolls.map((roll) => {
        const matchingSerials = createdSerials.filter((s) => s.rollId === roll.id);
        if (matchingSerials.length === 0) return roll;

        const existingSerialNums = roll.serialNumbers || [];
        const newSerialNums = [
          ...existingSerialNums,
          ...matchingSerials.map((s) => s.serialNumber),
        ];

        const firstMatch = matchingSerials[0];
        return {
          ...roll,
          serialNumbers: newSerialNums,
          serialNumber: newSerialNums.join(', '),
          ingredientsSnapshot:
            roll.ingredientsSnapshot && roll.ingredientsSnapshot.length > 0
              ? roll.ingredientsSnapshot
              : firstMatch.ingredients,
          ratingsSnapshot:
            roll.ratingsSnapshot && roll.ratingsSnapshot.hppPerKg > 0
              ? roll.ratingsSnapshot
              : {
                  power: firstMatch.weightedPower,
                  impact: firstMatch.weightedImpact,
                  bitter: firstMatch.weightedBitter,
                  burn: firstMatch.weightedBurn,
                  sugar: firstMatch.weightedSugar,
                  aroma: firstMatch.weightedAroma ?? 4.2,
                  colorGrade: firstMatch.compositeColorGrade,
                  hppPerKg: firstMatch.hppPerNetKg,
                },
        };
      })
    );

    // Deduct total used net weight from raw tobaccos
    setRawTobaccos((prev) =>
      prev.map((raw) => {
        const totalUsedForThisRaw = createdSerials.reduce((sum, ser) => {
          const found = ser.ingredients.find((i) => i.tobaccoId === raw.id);
          return sum + (found ? found.usedNetKg : 0);
        }, 0);

        if (totalUsedForThisRaw > 0) {
          return {
            ...raw,
            currentStockNetKg: Math.max(
              0,
              Number((raw.currentStockNetKg - totalUsedForThisRaw).toFixed(2))
            ),
          };
        }
        return raw;
      })
    );

    setActiveTab('rolls');
    showToast(`${createdSerials.length} Nomor Seri Tembakau Jadi berhasil diterbitkan & masuk ke Gulungan!`);
  };

  // Update Factory Delivery Status for a Seri (Accepted Cair vs Reject -> Stok Tembakau Jadi)
  const handleUpdateSerialStatus = (
    serialId: string,
    status: SerialFactoryStatus,
    currentRoll?: TobaccoRollSample
  ) => {
    hasLocalUserMutationRef.current = true;
    setFinishedBatches((prev) =>
      prev.map((ser) => {
        if (ser.id !== serialId) return ser;
        const matchedRoll =
          currentRoll || rollSamples.find((r) => r.id === ser.rollId);
        if (status === 'REJECTED_STOCK') {
          return {
            ...ser,
            factoryStatus: 'REJECTED_STOCK',
            previousRollId: matchedRoll?.id || ser.rollId,
            previousRollNumber: matchedRoll
              ? `${matchedRoll.rollNumber} (${matchedRoll.recipeName})`
              : ser.rollNumber || 'GUL-LAMA',
            previousFactory: matchedRoll?.targetFactory || ser.targetFactory,
            rejectedAt: new Date().toISOString().split('T')[0],
            rejectionNotes:
              ser.rejectionNotes ||
              `Direject dari ${matchedRoll?.rollNumber || ser.rollNumber || 'Gulungan'} (${matchedRoll?.targetFactory || ser.targetFactory}), kemasan & berat tetap utuh di Stok Tembakau Jadi.`,
          };
        }
        return {
          ...ser,
          factoryStatus: status,
        };
      })
    );

    if (status === 'ACCEPTED_CAIR') {
      showToast('Status Seri diperbarui: Diterima / Accepted!');
    } else if (status === 'REJECTED_STOCK') {
      showToast('Seri di-Reject & otomatis masuk ke Panel 2: Stok Tembakau Jadi (Kemasan & Berat Tetap)!');
    } else {
      showToast('Status Seri dikembalikan ke Menunggu Pabrik.');
    }
  };

  // Send a Gulungan from Gudang (Gulungan tab) to Pabrik (Status Barang tab), or recall it back to Gudang
  const handleSendRollToFactory = (rollId: string, isSent: boolean) => {
    const targetRoll = rollSamples.find((r) => r.id === rollId);
    if (!targetRoll) return;
    hasLocalUserMutationRef.current = true;
    const todayStr = new Date().toISOString().split('T')[0];

    setRollSamples((prev) =>
      prev.map((r) =>
        r.id === rollId
          ? {
              ...r,
              isSentToFactory: isSent,
              sentToFactoryDate: isSent ? r.sentToFactoryDate || todayStr : undefined,
            }
          : r
      )
    );

    if (isSent) {
      showToast(
        `Gulungan "${targetRoll.rollNumber}" dikirim ke ${targetRoll.targetFactory} & dipindahkan ke menu Status Barang!`
      );
    } else {
      showToast(
        `Gulungan "${targetRoll.rollNumber}" ditarik kembali ke menu Gulungan (Gudang).`
      );
    }
  };

  // Re-assign a Rejected Seri from Stok Tembakau Jadi into the Newest / Selected Gulungan (with optional serial rename e.g. AK 1 -> AL 1 and new factory)
  const handleReassignRejectedToRoll = (
    serialId: string,
    targetRollId: string,
    newSerialNumber?: string,
    newTargetFactory?: string
  ) => {
    const targetRoll = rollSamples.find((r) => r.id === targetRollId);
    if (!targetRoll) return;

    const targetSerial = finishedBatches.find((b) => b.id === serialId);
    if (!targetSerial) return;

    hasLocalUserMutationRef.current = true;
    const oldSerialNum = targetSerial.serialNumber;
    const { updatedSerial, updatedTargetRollSerialNumbers, lineageDisplay } =
      applyRejectedSerialReassignment({
        serial: targetSerial,
        targetRoll,
        newSerialNumber,
        newTargetFactory,
      });

    const nextBatches = finishedBatches.map((ser) =>
      ser.id === serialId ? updatedSerial : ser
    );
    setFinishedBatches(nextBatches);

    setRollSamples((prevRolls) =>
      syncRollsWithSerials(
        prevRolls.map((r) =>
          r.id === targetRoll.id
            ? {
                ...r,
                serialNumbers: updatedTargetRollSerialNumbers,
                serialNumber: updatedTargetRollSerialNumbers.join(', '),
              }
            : r
        ),
        nextBatches
      )
    );

    if (updatedSerial.serialNumber !== oldSerialNum) {
      showToast(
        `Seri ${oldSerialNum} diubah menjadi ${updatedSerial.serialNumber} (${lineageDisplay}) & dimasukkan ke Gulungan ${targetRoll.rollNumber} (${updatedSerial.targetFactory})!`
      );
    } else {
      showToast(
        `Seri ${updatedSerial.serialNumber} (Kemasan & Berat Utuh) dimasukkan ke Gulungan ${targetRoll.rollNumber} (${updatedSerial.targetFactory})!`
      );
    }
  };

  // Synchronize all Gulungan (rollSamples) metadata & snapshots whenever any Seri Jadi is edited or moved
  const syncRollsWithSerials = (
    rolls: TobaccoRollSample[],
    batches: FinishedTobaccoSerial[]
  ): TobaccoRollSample[] => {
    return rolls.map((roll) => {
      const serialsInRoll = batches.filter(
        (b) => b.rollId === roll.id || (!b.rollId && b.rollNumber === roll.rollNumber)
      );
      const nextSerialNumbers = serialsInRoll.map((s) => s.serialNumber);
      const count = serialsInRoll.length;
      if (count === 0) {
        return {
          ...roll,
          serialNumbers: [],
          serialNumber: '-',
        };
      }

      const avg = (getter: (s: FinishedTobaccoSerial) => number) =>
        Number(
          (serialsInRoll.reduce((acc, s) => acc + getter(s), 0) / count).toFixed(1)
        );
      const avgHpp = Math.round(
        serialsInRoll.reduce((acc, s) => acc + (s.hppPerNetKg || 0), 0) / count
      );

      return {
        ...roll,
        serialNumbers: nextSerialNumbers,
        serialNumber: nextSerialNumbers.join(', '),
        ratingsSnapshot: {
          power: avg((s) => s.weightedPower),
          impact: avg((s) => s.weightedImpact),
          bitter: avg((s) => s.weightedBitter),
          burn: avg((s) => s.weightedBurn ?? 4.5),
          sugar: avg((s) => s.weightedSugar ?? 4.0),
          aroma: avg((s) => s.weightedAroma ?? 4.2),
          colorGrade: serialsInRoll[0].compositeColorGrade || roll.ratingsSnapshot.colorGrade,
          hppPerKg: avgHpp || roll.ratingsSnapshot.hppPerKg,
        },
      };
    });
  };

  // Full Edit of a Seri Jadi (shared automatically with its Gulungan)
  const handleUpdateFinishedSerial = (updated: FinishedTobaccoSerial) => {
    hasLocalUserMutationRef.current = true;
    const linkedRoll = rollSamples.find((r) => r.id === updated.rollId);
    const normalizedSerial: FinishedTobaccoSerial = {
      ...updated,
      rollNumber: linkedRoll ? linkedRoll.rollNumber : updated.rollNumber,
      rollRackNumber: linkedRoll ? linkedRoll.rackLocation : updated.rollRackNumber,
    };

    const nextBatches = finishedBatches.map((s) =>
      s.id === normalizedSerial.id ? normalizedSerial : s
    );
    setFinishedBatches(nextBatches);
    setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, nextBatches));
    showToast(
      `Seri ${normalizedSerial.serialNumber} diperbarui & otomatis tersinkron ke Gulungan ${normalizedSerial.rollNumber || ''}!`
    );
  };

  // Live Repricing of a Nomor Seri inside Arsip Gulungan (Price, Grade, Bruto, Tara)
  const handleRepriceSerial = (
    serialId: string,
    updates: {
      factoryTargetPricePerKg?: number;
      compositeColorGrade?: TobaccoGrade;
      brutoKg?: number;
      taraKg?: number;
    }
  ) => {
    hasLocalUserMutationRef.current = true;
    const nextBatches = finishedBatches.map((ser) => {
      if (ser.id !== serialId) return ser;
      const nextBruto =
        updates.brutoKg !== undefined
          ? updates.brutoKg
          : ser.packaging.grossWeightPerPackage;
      const nextTara =
        updates.taraKg !== undefined ? updates.taraKg : ser.factoryDeductionKg;
      const nextNetto = Math.max(0, Number((nextBruto - nextTara).toFixed(2)));
      const nextPrice =
        updates.factoryTargetPricePerKg !== undefined
          ? updates.factoryTargetPricePerKg
          : ser.factoryTargetPricePerKg;
      const nextGrade =
        updates.compositeColorGrade !== undefined
          ? updates.compositeColorGrade
          : ser.compositeColorGrade;

      const nextRevenue = Math.round(nextNetto * nextPrice);
      const nextProfit = nextRevenue - ser.totalProductionCost;
      const nextMargin =
        nextRevenue > 0 ? Number(((nextProfit / nextRevenue) * 100).toFixed(2)) : 0;

      const realPkgMassKg =
        ser.packaging.packagingMassKg ?? ser.factoryDeductionKg;
      const nextRealTobaccoNetKg = Number(
        Math.max(0, nextBruto - realPkgMassKg).toFixed(2)
      );
      const nextFactoryWeightProfitKg = Number(
        (nextNetto - nextRealTobaccoNetKg).toFixed(2)
      );
      const nextFactoryWeightProfitRp = Math.round(
        nextFactoryWeightProfitKg * nextPrice
      );

      return {
        ...ser,
        compositeColorGrade: nextGrade,
        totalBlendNetKg: nextRealTobaccoNetKg,
        packaging: {
          ...ser.packaging,
          grossWeightPerPackage: nextBruto,
          netTobaccoWeightKg: nextRealTobaccoNetKg,
          packagingMassKg: realPkgMassKg,
        },
        factoryDeductionKg: nextTara,
        factoryNetBillableKg: nextNetto,
        factoryWeightProfitKg: nextFactoryWeightProfitKg,
        factoryWeightProfitRp: nextFactoryWeightProfitRp,
        factoryTargetPricePerKg: nextPrice,
        projectedRevenue: nextRevenue,
        projectedProfit: nextProfit,
        profitMarginPercent: nextMargin,
      };
    });
    setFinishedBatches(nextBatches);
    setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, nextBatches));
  };

  const handleDeleteFinished = (id: string) => {
    const item = finishedBatches.find((b) => b.id === id);
    if (!item) return;
    hasLocalUserMutationRef.current = true;
    const nextBatches = finishedBatches.filter((b) => b.id !== id);
    setFinishedBatches(nextBatches);
    setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, nextBatches));
    showToast(`Nomor Seri "${item.serialNumber}" dihapus.`);
  };

  const handleOpenRollFromFinished = (rollId: string) => {
    const roll = rollSamples.find((r) => r.id === rollId);
    if (roll) {
      setSelectedRoll(roll);
    } else {
      setActiveTab('rolls');
    }
  };

  const handleUpdateSmokingTest = (
    rollId: string,
    updatedTest: NonNullable<TobaccoRollSample['smokingTest']>
  ) => {
    hasLocalUserMutationRef.current = true;
    setRollSamples(
      rollSamples.map((r) => (r.id === rollId ? { ...r, smokingTest: updatedTest } : r))
    );
    showToast('Catatan Evaluasi & Komposisi (/5) berhasil disimpan!');
  };

  const applyRestoredPayload = (parsed: TobaccoBackupPayload) => {
    hasLocalUserMutationRef.current = true;
    if (parsed.rawTobaccos && Array.isArray(parsed.rawTobaccos))
      setRawTobaccos(parsed.rawTobaccos);
    if (parsed.finishedBatches && Array.isArray(parsed.finishedBatches))
      setFinishedBatches(parsed.finishedBatches);
    if (parsed.rollSamples && Array.isArray(parsed.rollSamples))
      setRollSamples(parsed.rollSamples);
    if (parsed.packagingList && Array.isArray(parsed.packagingList))
      setPackagingList(parsed.packagingList);
    if (parsed.factoryList && Array.isArray(parsed.factoryList))
      setFactoryList(parsed.factoryList);
    showToast('Data berhasil diimpor & dipulihkan dari Backup JSON!');
  };

  const handleExportData = () => {
    setBackupModalMode('backup');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as TobaccoBackupPayload;
        applyRestoredPayload(parsed);
      } catch {
        showToast('Format file JSON tidak valid!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetData = () => {
    hasLocalUserMutationRef.current = true;
    setRawTobaccos(INITIAL_RAW_TOBACCO);
    setFinishedBatches(INITIAL_FINISHED_TOBACCO);
    setRollSamples(INITIAL_ROLL_SAMPLES);
    setPackagingList(INITIAL_PACKAGING_MASTERS);
    setFactoryList(INITIAL_FACTORY_MASTERS);
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    showToast('Data berhasil di-reset ke contoh awal.');
  };

  const totalNetStockKg = rawTobaccos.reduce(
    (acc, curr) => acc + (curr.currentStockNetKg || 0),
    0
  );
  const rejectedStockCount = finishedBatches.filter(
    (b) => b.factoryStatus === 'REJECTED_STOCK'
  ).length;
  const warehouseRollCount = rollSamples.filter((r) => !r.isSentToFactory).length;
  const shippedRollCount = rollSamples.filter((r) => !!r.isSentToFactory).length;

  if (authReady && !currentUser && !offlineBypass) {
    return (
      <div className="min-h-screen bg-[#020203] text-white relative">
        <ArchitecturalBackground />
        <CloudLoginScreen
          onContinueOffline={() => {
            setOfflineBypass(true);
            showToast('Mode Lokal Aktif — Klik "Login Cloud" di atas kapan saja untuk sinkronisasi Google.');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020203] text-white flex flex-col font-sans selection:bg-amber-500 selection:text-black relative">
      {/* Artistic Resident Evil 9 Requiem Architectural Background */}
      <ArchitecturalBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          rawTobaccoCount={rawTobaccos.length}
          rejectedStockCount={rejectedStockCount}
          totalNetStockKg={totalNetStockKg}
          finishedCount={finishedBatches.length}
          pendingQcCount={shippedRollCount}
          rollCount={warehouseRollCount}
          onOpenAddModal={() => {
            setEditingTobacco(null);
            setIsRawModalOpen(true);
          }}
          onOpenMasterModal={() => {
            setMasterInitialSection('packaging');
            setIsMasterModalOpen(true);
          }}
          onOpenSimulator={() => setIsSimulatorOpen((prev) => !prev)}
          isSimulatorOpen={isSimulatorOpen}
          onOpenPatchNotes={() => {
            setIsPatchNotesOpen(true);
            setHasUnreadPatch(false);
            try {
              localStorage.setItem(STORAGE_KEYS.SEEN_PATCH, CURRENT_APP_VERSION);
            } catch {
              // ignore
            }
          }}
          hasUnreadPatch={hasUnreadPatch}
          onExportData={handleExportData}
          onImportData={handleImportData}
          onOpenRestoreModal={() => setBackupModalMode('restore')}
          onResetData={handleResetData}
          userEmail={currentUser?.email || null}
          cloudSyncStatus={cloudSyncStatus}
          onGoogleLogin={() => setOfflineBypass(false)}
          onGoogleLogout={async () => {
            await signOutFromCloud();
            setOfflineBypass(false);
            showToast('Berhasil keluar dari akun Google Cloud.');
          }}
          onForceCloudSync={() => {
            if (currentUser) {
              pullCloudWorkspace(currentUser, { showSuccessToast: true });
            }
          }}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto py-4 sm:py-5 safe-main-container">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeTab === 'inventory' && (
                <RawTobaccoList
                  tobaccos={rawTobaccos}
                  finishedBatches={finishedBatches}
                  rollSamples={rollSamples}
                  factoryList={factoryList}
                  initialStockPanel={stockInitialPanel}
                  onAddNew={() => {
                    setEditingTobacco(null);
                    setIsRawModalOpen(true);
                  }}
                  onEdit={(tobacco) => {
                    setEditingTobacco(tobacco);
                    setIsRawModalOpen(true);
                  }}
                  onDelete={handleDeleteRawTobacco}
                  onAddToBlend={handleAddToBlend}
                  onReassignRejectedToRoll={handleReassignRejectedToRoll}
                  onUnpackRejectedToBlend={handleUnpackRejectedToBlend}
                />
              )}

              {activeTab === 'calculator' && (
                <BlendCalculator
                  key={blendPrefilledIngredients.map((i) => i.tobaccoId).join('-')}
                  rawTobaccos={rawTobaccos}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  rollSamples={rollSamples}
                  existingSerialCount={finishedBatches.length}
                  onSaveMultipleFinished={handleSaveMultipleFinished}
                  initialIngredients={blendPrefilledIngredients}
                />
              )}

              {activeTab === 'finished' && (
                <FinishedTobaccoList
                  finishedBatches={finishedBatches}
                  rollSamples={rollSamples}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  onOpenRoll={handleOpenRollFromFinished}
                  onUpdateSerial={handleUpdateFinishedSerial}
                  onDelete={handleDeleteFinished}
                  onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
                />
              )}

              {activeTab === 'qc-status' && (
                <RollArchiveView
                  viewMode="shipped"
                  rollSamples={rollSamples}
                  finishedBatches={finishedBatches}
                  rawTobaccos={rawTobaccos}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  onSelectRoll={(roll) => setSelectedRoll(roll)}
                  onOpenNewRollModal={() => {
                    setMasterInitialSection('gulungan');
                    setIsMasterModalOpen(true);
                  }}
                  onUpdateSerial={handleUpdateFinishedSerial}
                  onUpdateSmokingTest={handleUpdateSmokingTest}
                  onRepriceSerial={handleRepriceSerial}
                  onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
                  onSendRollToFactory={handleSendRollToFactory}
                  onUpdateSerialStatus={handleUpdateSerialStatus}
                />
              )}

              {activeTab === 'rolls' && (
                <RollArchiveView
                  viewMode="warehouse"
                  rollSamples={rollSamples}
                  finishedBatches={finishedBatches}
                  rawTobaccos={rawTobaccos}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  onSelectRoll={(roll) => setSelectedRoll(roll)}
                  onOpenNewRollModal={() => {
                    setMasterInitialSection('gulungan');
                    setIsMasterModalOpen(true);
                  }}
                  onUpdateSerial={handleUpdateFinishedSerial}
                  onUpdateSmokingTest={handleUpdateSmokingTest}
                  onRepriceSerial={handleRepriceSerial}
                  onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
                  onSendRollToFactory={handleSendRollToFactory}
                  onUpdateSerialStatus={handleUpdateSerialStatus}
                />
              )}

              {activeTab === 'history' && (
                <HistoryView
                  rollSamples={rollSamples}
                  finishedBatches={finishedBatches}
                  rawTobaccos={rawTobaccos}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  onUpdateSerial={handleUpdateFinishedSerial}
                  onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
                  onGoToRejectedStock={() => {
                    setStockInitialPanel('rejected-finished');
                    setActiveTab('inventory');
                  }}
                />
              )}

              {activeTab === 'tara-simulator' && (
                <TaraSimulator
                  rawTobaccos={rawTobaccos}
                  rollSamples={rollSamples}
                  packagingList={packagingList}
                  factoryList={factoryList}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Top Animated Slide-Down Simulator Drawer Modal */}
      <AnimatePresence>
        {isSimulatorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 md:p-6"
            onClick={() => setIsSimulatorOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-6xl bg-[#050507] border-2 border-amber-500/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden my-2 sm:my-4"
            >
              <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-xl px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                      Simulator Potongan Tarra & Kalkulasi Coba-Coba
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Alat bantu hitung cepat tanpa mengubah data stok atau gulungan asli
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSimulatorOpen(false)}
                  className="min-h-9 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 text-zinc-200 hover:text-white border border-zinc-700 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup Simulator</span>
                </button>
              </div>
              <div className="p-3 sm:p-5 max-h-[82vh] overflow-y-auto">
                <TaraSimulator
                  rawTobaccos={rawTobaccos}
                  rollSamples={rollSamples}
                  packagingList={packagingList}
                  factoryList={factoryList}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RawTobaccoModal
        isOpen={isRawModalOpen}
        onClose={() => {
          setIsRawModalOpen(false);
          setEditingTobacco(null);
        }}
        onSave={handleSaveRawTobacco}
        editingTobacco={editingTobacco}
        packagingList={packagingList}
        existingTobaccos={rawTobaccos}
      />

      <RollDetailModal
        roll={selectedRoll}
        finishedBatches={finishedBatches}
        rawTobaccos={rawTobaccos}
        onClose={() => setSelectedRoll(null)}
        onUpdateSmokingTest={handleUpdateSmokingTest}
      />

      <MasterRegistryModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        initialSection={masterInitialSection}
        packagingList={packagingList}
        onAddPackaging={(pkg) => {
          hasLocalUserMutationRef.current = true;
          setPackagingList([...packagingList, pkg]);
          showToast(`Jenis Packaging "${pkg.name}" berhasil didaftarkan!`);
        }}
        onUpdatePackaging={(updatedPkg) => {
          hasLocalUserMutationRef.current = true;
          setPackagingList((prev) =>
            prev.map((p) => (p.id === updatedPkg.id ? updatedPkg : p))
          );
          showToast(`Jenis Packaging "${updatedPkg.name}" berhasil diperbarui!`);
        }}
        onDeletePackaging={(id) => {
          hasLocalUserMutationRef.current = true;
          setPackagingList(packagingList.filter((p) => p.id !== id));
          showToast('Jenis Packaging dihapus.');
        }}
        factoryList={factoryList}
        onAddFactory={(fac) => {
          hasLocalUserMutationRef.current = true;
          setFactoryList([...factoryList, fac]);
          showToast(`Pabrik "${fac.name}" berhasil didaftarkan!`);
        }}
        onUpdateFactory={(updatedFac) => {
          hasLocalUserMutationRef.current = true;
          setFactoryList((prev) =>
            prev.map((f) => (f.id === updatedFac.id ? updatedFac : f))
          );
          showToast(`Data Pabrik "${updatedFac.name}" berhasil diperbarui!`);
        }}
        onDeleteFactory={(id) => {
          hasLocalUserMutationRef.current = true;
          setFactoryList(factoryList.filter((f) => f.id !== id));
          showToast('Data pabrik dihapus.');
        }}
        rollSamples={rollSamples}
        onAddRollSample={(roll) => {
          hasLocalUserMutationRef.current = true;
          setRollSamples([...rollSamples, roll]);
          showToast(`Gulungan Sampel "${roll.rollNumber}" berhasil dibuat!`);
        }}
        onUpdateRollSample={(updatedRoll) => {
          hasLocalUserMutationRef.current = true;
          setRollSamples((prev) =>
            prev.map((r) => (r.id === updatedRoll.id ? updatedRoll : r))
          );
          setFinishedBatches((prev) =>
            prev.map((ser) =>
              ser.rollId === updatedRoll.id
                ? {
                    ...ser,
                    rollNumber: updatedRoll.rollNumber,
                    rollRackNumber: updatedRoll.rackLocation,
                    targetFactory: updatedRoll.targetFactory,
                  }
                : ser
            )
          );
          showToast(`Gulungan "${updatedRoll.rollNumber}" berhasil diperbarui!`);
        }}
        onDeleteRollSample={(id) => {
          hasLocalUserMutationRef.current = true;
          setRollSamples((prev) => prev.filter((r) => r.id !== id));
          showToast('Gulungan Sampel dihapus.');
        }}
      />

      <PatchNotesModal
        isOpen={isPatchNotesOpen}
        onClose={() => setIsPatchNotesOpen(false)}
      />

      <GoogleSheetsExportModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        rawTobaccos={rawTobaccos}
        finishedBatches={finishedBatches}
        rollSamples={rollSamples}
        userEmail={currentUser?.email || null}
        onShowToast={showToast}
        onSaveLinkedSpreadsheet={(title, url) => {
          if (!currentUser?.email) return;
          const ownerEmail = currentUser.email.trim().toLowerCase();
          hasLocalUserMutationRef.current = true;
          setRollSamples((prev) =>
            prev.map((r) => ({
              ...r,
              linkedSpreadsheetTitle: title.trim() || r.linkedSpreadsheetTitle,
              linkedSpreadsheetUrl: url.trim() || r.linkedSpreadsheetUrl,
              linkedSpreadsheetOwnerEmail: ownerEmail,
            }))
          );
        }}
      />

      <BackupRestoreModal
        isOpen={backupModalMode !== null}
        initialMode={backupModalMode || 'backup'}
        onClose={() => setBackupModalMode(null)}
        backupData={{
          rawTobaccos,
          finishedBatches,
          rollSamples,
          packagingList,
          factoryList,
          exportedAt: new Date().toISOString(),
          version: CURRENT_APP_VERSION,
        }}
        onRestorePayload={applyRestoredPayload}
        onShowToast={showToast}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-16 md:bottom-5 right-4 z-50 bg-black border border-zinc-700 text-white px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
