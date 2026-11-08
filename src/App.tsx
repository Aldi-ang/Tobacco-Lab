/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Navbar, ActiveTab } from './components/Navbar';
import { RawTobaccoList } from './components/RawTobaccoList';
import { RawTobaccoModal } from './components/RawTobaccoModal';
import { BlendCalculator } from './components/BlendCalculator';
import { FinishedTobaccoList } from './components/FinishedTobaccoList';
import { ShipmentStatusView } from './components/ShipmentStatusView';
import { RollArchiveView } from './components/RollArchiveView';
import { RollDetailModal } from './components/RollDetailModal';
import { TaraSimulator } from './components/TaraSimulator';
import { MasterRegistryModal } from './components/MasterRegistryModal';
import { PatchNotesModal, CURRENT_APP_VERSION } from './components/PatchNotesModal';
import { ArchitecturalBackground } from './components/ArchitecturalBackground';
import { CloudLoginScreen } from './components/CloudLoginScreen';
import {
  auth,
  db,
  doc,
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
import { clampRating5 } from './utils/tobaccoMath';

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
      return saved ? JSON.parse(saved) : INITIAL_RAW_TOBACCO;
    } catch {
      return INITIAL_RAW_TOBACCO;
    }
  });

  const [finishedBatches, setFinishedBatches] = useState<FinishedTobaccoSerial[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FINISHED);
      return saved ? JSON.parse(saved) : INITIAL_FINISHED_TOBACCO;
    } catch {
      return INITIAL_FINISHED_TOBACCO;
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Track Firebase Google Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudSyncStatus('offline');
        initialCloudLoadDoneRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach real-time Firestore listener when user is signed in with Google
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const workspacePath = `workspaces/${currentUser.uid}`;
    const workspaceRef = doc(db, 'workspaces', currentUser.uid);
    setCloudSyncStatus('syncing');

    const unsubscribe = onSnapshot(
      workspaceRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          isApplyingRemoteRef.current = true;
          if (Array.isArray(data.rawTobaccos)) setRawTobaccos(data.rawTobaccos);
          if (Array.isArray(data.finishedBatches)) setFinishedBatches(data.finishedBatches);
          if (Array.isArray(data.rollSamples)) setRollSamples(data.rollSamples);
          if (Array.isArray(data.packagingList)) setPackagingList(data.packagingList);
          if (Array.isArray(data.factoryList)) setFactoryList(data.factoryList);
          initialCloudLoadDoneRef.current = true;
          setCloudSyncStatus('synced');
          setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 80);
        } else {
          // First time signing in: initialize cloud workspace with current data
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
            initialCloudLoadDoneRef.current = true;
            setCloudSyncStatus('synced');
          } catch (err) {
            setCloudSyncStatus('error');
            handleFirestoreError(err, OperationType.CREATE, workspacePath);
          }
        }
      },
      (err) => {
        setCloudSyncStatus('error');
        handleFirestoreError(err, OperationType.GET, workspacePath);
      }
    );

    return () => unsubscribe();
  }, [authReady, currentUser]);

  // Automatically sync local state changes to Firestore Cloud when logged in
  useEffect(() => {
    if (
      !authReady ||
      !currentUser ||
      !initialCloudLoadDoneRef.current ||
      isApplyingRemoteRef.current
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
    setRawTobaccos(rawTobaccos.filter((t) => t.id !== id));
    showToast(`Tembakau "${item.name}" telah dihapus.`);
  };

  const handleAddToBlend = (tobacco: RawTobacco) => {
    const newIng: BlendIngredient = {
      tobaccoId: tobacco.id,
      tobaccoName: tobacco.name,
      origin: tobacco.origin,
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
          colorGrade: serial.compositeColorGrade,
        },
      ]);
    }
    setActiveTab('calculator');
    showToast(`Seri ${serial.serialNumber} dibongkar ke Kalkulator Racikan.`);
  };

  // Save Multiple Finished Serials from 1 Mixture
  const handleSaveMultipleFinished = (createdSerials: FinishedTobaccoSerial[]) => {
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
      showToast('Status Seri diperbarui: Diterima Pabrik & Uang Cair!');
    } else if (status === 'REJECTED_STOCK') {
      showToast('Seri di-Reject & otomatis masuk ke Panel 2: Stok Tembakau Jadi (Kemasan & Berat Tetap)!');
    } else {
      showToast('Status Seri dikembalikan ke Menunggu QC Pabrik.');
    }
  };

  // Re-assign a Rejected Seri from Stok Tembakau Jadi into the Newest / Selected Gulungan (keeps packaging & weights intact)
  const handleReassignRejectedToRoll = (serialId: string, targetRollId: string) => {
    const targetRoll = rollSamples.find((r) => r.id === targetRollId);
    if (!targetRoll) return;

    const targetSerial = finishedBatches.find((b) => b.id === serialId);
    if (!targetSerial) return;

    setFinishedBatches((prev) =>
      prev.map((ser) => {
        if (ser.id !== serialId) return ser;
        return {
          ...ser,
          factoryStatus: 'PENDING',
          previousRollId: ser.previousRollId || ser.rollId,
          previousRollNumber:
            ser.previousRollNumber || `${ser.rollNumber || 'GUL-LAMA'} (${ser.targetFactory})`,
          previousFactory: ser.previousFactory || ser.targetFactory,
          rollId: targetRoll.id,
          rollNumber: targetRoll.rollNumber,
          rollRackNumber: targetRoll.rackLocation,
          targetFactory: targetRoll.targetFactory,
        };
      })
    );

    setRollSamples((prevRolls) =>
      prevRolls.map((r) => {
        if (r.id === targetRoll.id) {
          const existing = r.serialNumbers || [];
          const nextSerials = existing.includes(targetSerial.serialNumber)
            ? existing
            : [...existing, targetSerial.serialNumber];
          return {
            ...r,
            serialNumbers: nextSerials,
            serialNumber: nextSerials.join(', '),
          };
        }
        return r;
      })
    );

    showToast(
      `Seri ${targetSerial.serialNumber} (Kemasan & Berat Utuh) dimasukkan ke Gulungan ${targetRoll.rollNumber}!`
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
    setFinishedBatches((prev) =>
      prev.map((ser) => {
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
      })
    );
  };

  const handleDeleteFinished = (id: string) => {
    const item = finishedBatches.find((b) => b.id === id);
    if (!item) return;
    setFinishedBatches(finishedBatches.filter((b) => b.id !== id));
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
    setRollSamples(
      rollSamples.map((r) => (r.id === rollId ? { ...r, smokingTest: updatedTest } : r))
    );
    showToast('Catatan Evaluasi & Komposisi (/5) berhasil disimpan!');
  };

  const handleExportData = () => {
    const data = {
      rawTobaccos,
      finishedBatches,
      rollSamples,
      packagingList,
      factoryList,
      exportedAt: new Date().toISOString(),
      version: '3.0',
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `kretek_master_backup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Data berhasil diekspor ke file JSON.');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
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
        showToast('Data berhasil diimpor dari file JSON!');
      } catch {
        showToast('Format file JSON tidak valid!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetData = () => {
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
  const pendingQcCount = finishedBatches.filter(
    (b) => (b.factoryStatus || 'PENDING') === 'PENDING'
  ).length;

  if (authReady && !currentUser && !offlineBypass) {
    return (
      <div className="min-h-screen bg-[#030304] text-white relative">
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
    <div className="min-h-screen bg-[#030304] text-white flex flex-col font-sans selection:bg-amber-500 selection:text-black relative">
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
          pendingQcCount={pendingQcCount}
          rollCount={rollSamples.length}
          onOpenAddModal={() => {
            setEditingTobacco(null);
            setIsRawModalOpen(true);
          }}
          onOpenMasterModal={() => {
            setMasterInitialSection('packaging');
            setIsMasterModalOpen(true);
          }}
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
          onResetData={handleResetData}
          userEmail={currentUser?.email || null}
          cloudSyncStatus={cloudSyncStatus}
          onGoogleLogin={() => setOfflineBypass(false)}
          onGoogleLogout={async () => {
            await signOutFromCloud();
            setOfflineBypass(false);
            showToast('Berhasil keluar dari akun Google Cloud.');
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
                  onOpenRoll={handleOpenRollFromFinished}
                  onDelete={handleDeleteFinished}
                />
              )}

              {activeTab === 'qc-status' && (
                <ShipmentStatusView
                  finishedBatches={finishedBatches}
                  rollSamples={rollSamples}
                  onUpdateSerialStatus={handleUpdateSerialStatus}
                />
              )}

              {activeTab === 'rolls' && (
                <RollArchiveView
                  rollSamples={rollSamples}
                  finishedBatches={finishedBatches}
                  onSelectRoll={(roll) => setSelectedRoll(roll)}
                  onOpenNewRollModal={() => {
                    setMasterInitialSection('gulungan');
                    setIsMasterModalOpen(true);
                  }}
                  onRepriceSerial={handleRepriceSerial}
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

      <RawTobaccoModal
        isOpen={isRawModalOpen}
        onClose={() => {
          setIsRawModalOpen(false);
          setEditingTobacco(null);
        }}
        onSave={handleSaveRawTobacco}
        editingTobacco={editingTobacco}
        packagingList={packagingList}
      />

      <RollDetailModal
        roll={selectedRoll}
        finishedBatches={finishedBatches}
        onClose={() => setSelectedRoll(null)}
        onUpdateSmokingTest={handleUpdateSmokingTest}
      />

      <MasterRegistryModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        initialSection={masterInitialSection}
        packagingList={packagingList}
        onAddPackaging={(pkg) => {
          setPackagingList([...packagingList, pkg]);
          showToast(`Jenis Packaging "${pkg.name}" berhasil didaftarkan!`);
        }}
        onDeletePackaging={(id) => {
          setPackagingList(packagingList.filter((p) => p.id !== id));
          showToast('Jenis Packaging dihapus.');
        }}
        factoryList={factoryList}
        onAddFactory={(fac) => {
          setFactoryList([...factoryList, fac]);
          showToast(`Pabrik "${fac.name}" berhasil didaftarkan!`);
        }}
        onDeleteFactory={(id) => {
          setFactoryList(factoryList.filter((f) => f.id !== id));
          showToast('Data pabrik dihapus.');
        }}
        rollSamples={rollSamples}
        onAddRollSample={(roll) => {
          setRollSamples([...rollSamples, roll]);
          showToast(`Gulungan Sampel "${roll.rollNumber}" berhasil dibuat!`);
        }}
      />

      <PatchNotesModal
        isOpen={isPatchNotesOpen}
        onClose={() => setIsPatchNotesOpen(false)}
      />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-16 md:bottom-5 right-4 z-50 bg-black border-2 border-amber-500 text-white px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.3)] flex items-center gap-2.5 text-xs font-extrabold"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
