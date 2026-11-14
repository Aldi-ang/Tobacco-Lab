/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calculator, AlertTriangle, Trash2, Undo2 } from 'lucide-react';
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
import { NolanAgentModal } from './components/NolanAgentModal';
import { SettingsView } from './components/SettingsView';
import {
  NolanBrainMemory,
  NolanDecisionEpisode,
  NolanNavTarget,
  NolanPendingAction,
} from './types/nolan';
import {
  getNolanStorageKey,
  buildDefaultNolanBrain,
  deriveFactoryProfilesFromData,
  computeAccountSummaryForABrain,
} from './utils/nolanBrain';
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
  const [isNolanModalOpen, setIsNolanModalOpen] = useState<boolean>(false);
  const [nolanInitialPrompt, setNolanInitialPrompt] = useState<string | null>(null);

  // Confirm Deletion & Undo Deletion State
  const [pendingDeletion, setPendingDeletion] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [undoDeletionSnapshot, setUndoDeletionSnapshot] = useState<{
    label: string;
    rawTobaccos: RawTobacco[];
    finishedBatches: FinishedTobaccoSerial[];
    rollSamples: TobaccoRollSample[];
    packagingList: PackagingMaster[];
    factoryList: FactoryMaster[];
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const recordUndoSnapshot = useCallback(
    (label: string) => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
      setUndoDeletionSnapshot({
        label,
        rawTobaccos: [...rawTobaccos],
        finishedBatches: [...finishedBatches],
        rollSamples: [...rollSamples],
        packagingList: [...packagingList],
        factoryList: [...factoryList],
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoDeletionSnapshot(null);
      }, 15000);
    },
    [rawTobaccos, finishedBatches, rollSamples, packagingList, factoryList]
  );

  const handleRestoreUndoSnapshot = useCallback(() => {
    if (!undoDeletionSnapshot) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    hasLocalUserMutationRef.current = true;
    setRawTobaccos(undoDeletionSnapshot.rawTobaccos);
    setFinishedBatches(undoDeletionSnapshot.finishedBatches);
    setRollSamples(undoDeletionSnapshot.rollSamples);
    setPackagingList(undoDeletionSnapshot.packagingList);
    setFactoryList(undoDeletionSnapshot.factoryList);
    setUndoDeletionSnapshot(null);
    showToast('Penghapusan dibatalkan (Undo) — Data berhasil dipulihkan utuh!');
  }, [undoDeletionSnapshot, showToast]);

  // Nolan Agentic Brain State (persisted per user email + synced with server & GitHub A-Brain)
  const [nolanBrain, setNolanBrain] = useState<NolanBrainMemory>(() => {
    try {
      const saved = localStorage.getItem(getNolanStorageKey(null));
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return buildDefaultNolanBrain(null, rawTobaccos, finishedBatches, factoryList);
  });

  // Load account-specific Nolan Brain when user logs in
  useEffect(() => {
    const email = currentUser?.email || 'adikaryasukses99@gmail.com';
    const storageKey = getNolanStorageKey(email);
    let localBrain: NolanBrainMemory | null = null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) localBrain = JSON.parse(saved);
    } catch {
      // ignore
    }

    fetch(`/api/nolan/brain?accountEmail=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.found && data?.brain) {
          setNolanBrain({
            ...data.brain,
            accountEmail: email,
            factoryProfiles: deriveFactoryProfilesFromData(finishedBatches, factoryList),
          });
        } else if (localBrain) {
          setNolanBrain({
            ...localBrain,
            accountEmail: email,
            factoryProfiles: deriveFactoryProfilesFromData(finishedBatches, factoryList),
          });
        } else {
          setNolanBrain(buildDefaultNolanBrain(email, rawTobaccos, finishedBatches, factoryList));
        }
      })
      .catch(() => {
        if (localBrain) {
          setNolanBrain(localBrain);
        }
      });
  }, [currentUser?.email]);

  const handleUpdateNolanBrain = useCallback(
    (nextBrain: NolanBrainMemory, triggerGithubAutoSync = true) => {
      const email = currentUser?.email || nextBrain.accountEmail || 'adikaryasukses99@gmail.com';
      const enriched: NolanBrainMemory = {
        ...nextBrain,
        accountEmail: email,
        autoSyncGithub: true,
        githubRepo: nextBrain.githubRepo || 'Aldi-ang/A-Brain',
        githubBranch: nextBrain.githubBranch || 'main',
        githubFilePath: nextBrain.githubFilePath || 'Tobacco-Business/nolan-brain.json',
        lastUpdated: new Date().toISOString(),
        factoryProfiles: deriveFactoryProfilesFromData(finishedBatches, factoryList),
      };
      setNolanBrain(enriched);
      try {
        localStorage.setItem(getNolanStorageKey(email), JSON.stringify(enriched));
      } catch {
        // ignore
      }
      fetch('/api/nolan/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountEmail: email, brain: enriched }),
      }).catch(() => {});

      if (
        triggerGithubAutoSync &&
        enriched.githubRepo &&
        enriched.githubRepo.includes('/')
      ) {
        const ghToken = localStorage.getItem('kretek_master_github_oauth_token') || '';
        const accountSummary = computeAccountSummaryForABrain(
          rawTobaccos,
          finishedBatches,
          rollSamples
        );
        fetch('/api/github/abrain/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(ghToken ? { 'x-github-token': ghToken } : {}),
          },
          body: JSON.stringify({
            repo: enriched.githubRepo,
            branch: enriched.githubBranch || 'main',
            filePath: enriched.githubFilePath || 'Tobacco-Business/nolan-brain.json',
            brain: enriched,
            accountSummary,
          }),
        }).catch(() => {});
      }
    },
    [currentUser?.email, factoryList, finishedBatches, rawTobaccos, rollSamples]
  );

  // Automatic Continuous Learning Helper for Nolan
  const recordNolanDecisionEpisode = useCallback(
    async (
      type: NolanDecisionEpisode['type'],
      summary: string,
      eventPayload: Record<string, unknown>
    ) => {
      try {
        const res = await fetch('/api/nolan/learn-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: type,
            eventData: eventPayload,
            currentMemory: nolanBrain,
          }),
        });
        const data = await res.json();
        const takeaway =
          data?.learnedTakeaway || 'Keputusan dicatat ke dalam memori pembelajaran Nolan.';
        const newEpisode: NolanDecisionEpisode = {
          id: `ep-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type,
          summary,
          learnedTakeaway: takeaway,
        };
        const nextRules =
          data?.newRule && !nolanBrain.learnedRules.includes(data.newRule)
            ? [data.newRule, ...nolanBrain.learnedRules]
            : nolanBrain.learnedRules;

        handleUpdateNolanBrain(
          {
            ...nolanBrain,
            learnedRules: nextRules,
            decisionEpisodes: [newEpisode, ...nolanBrain.decisionEpisodes].slice(0, 60),
          },
          true
        );
      } catch {
        // Fallback local episode recording if offline
        const fallbackEp: NolanDecisionEpisode = {
          id: `ep-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type,
          summary,
          learnedTakeaway: summary,
        };
        handleUpdateNolanBrain(
          {
            ...nolanBrain,
            decisionEpisodes: [fallbackEp, ...nolanBrain.decisionEpisodes].slice(0, 60),
          },
          true
        );
      }
    },
    [handleUpdateNolanBrain, nolanBrain]
  );

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
      recordNolanDecisionEpisode(
        'RAW_PURCHASE',
        `Stok Mentah Baru: ${tobacco.name} (${tobacco.origin}) [Grade ${tobacco.colorGrade}] • Netto ${tobacco.netWeightKg} kg • HPP Rp ${tobacco.realCostPerNetKg.toLocaleString('id-ID')}/kg`,
        {
          name: tobacco.name,
          origin: tobacco.origin,
          sellerName: tobacco.sellerName,
          grade: tobacco.colorGrade,
          netWeightKg: tobacco.netWeightKg,
          realCostPerNetKg: tobacco.realCostPerNetKg,
          weightProfitKg: tobacco.purchaseWeightProfitKg,
          weightProfitRp: tobacco.purchaseWeightProfitRp,
        }
      );
    }
    setEditingTobacco(null);
  };

  const handleDeleteRawTobacco = (id: string) => {
    const item = rawTobaccos.find((t) => t.id === id);
    if (!item) return;
    setPendingDeletion({
      title: `Hapus Stok Tembakau "${item.name}"?`,
      description: `Stok "${item.name}" (${item.origin}, Grade ${item.colorGrade}, Sisa ${item.currentStockNetKg} kg) akan dihapus dari daftar Stok Gudang. Anda masih bisa menekan tombol Urungkan (Undo) setelah dihapus.`,
      confirmLabel: 'Ya, Hapus Stok',
      onConfirm: () => {
        recordUndoSnapshot(`Stok "${item.name}" dihapus`);
        hasLocalUserMutationRef.current = true;
        setRawTobaccos((prev) => prev.filter((t) => t.id !== id));
        showToast(`Tembakau "${item.name}" telah dihapus.`);
      },
    });
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
    if (createdSerials.length === 0) return;
    hasLocalUserMutationRef.current = true;

    const existingWarehouseIds = new Set(
      rollSamples.filter((r) => !r.isSentToFactory).map((r) => r.id)
    );
    const needsAutoRoll = createdSerials.some(
      (s) => !s.rollId || s.rollId === 'NEW_AUTO_ROLL' || !existingWarehouseIds.has(s.rollId)
    );

    const autoRollId = `gul-auto-${Date.now()}`;
    const autoRollNumber = `GUL-${new Date().getFullYear()}-${String(
      rollSamples.length + 1
    ).padStart(3, '0')}`;
    const firstSer = createdSerials[0];
    const cleanRecipeTitle =
      firstSer.recipeName.replace(/\s*\[Seri\s+[^\]]+\]$/i, '').trim() ||
      `Setoran ${firstSer.targetFactory}`;

    const normalizedSerials = createdSerials.map((s) => {
      if (!s.rollId || s.rollId === 'NEW_AUTO_ROLL' || !existingWarehouseIds.has(s.rollId)) {
        return {
          ...s,
          rollId: autoRollId,
          rollNumber: autoRollNumber,
          rollRackNumber: 'Lemari Sampel Gudang A',
        };
      }
      return s;
    });

    setFinishedBatches([...normalizedSerials, ...finishedBatches]);

    // Update Gulungan samples that received these serials (or create a new Gulungan automatically)
    setRollSamples((prevRolls) => {
      const updatedExisting = prevRolls.map((roll) => {
        const matchingSerials = normalizedSerials.filter((s) => s.rollId === roll.id);
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
      });

      if (needsAutoRoll) {
        const autoSerials = normalizedSerials.filter((s) => s.rollId === autoRollId);
        const autoSerialNums = autoSerials.map((s) => s.serialNumber);
        const newAutoRoll: TobaccoRollSample = {
          id: autoRollId,
          rollNumber: autoRollNumber,
          serialNumbers: autoSerialNums,
          serialNumber: autoSerialNums.join(', '),
          recipeName: cleanRecipeTitle,
          targetFactory: firstSer.targetFactory,
          rackLocation: 'Lemari Sampel Gudang A',
          sampleWeightGrams: 250,
          sampleCreatedDate: new Date().toISOString().split('T')[0],
          isSentToFactory: false,
          ingredientsSnapshot: firstSer.ingredients,
          ratingsSnapshot: {
            power: firstSer.weightedPower,
            impact: firstSer.weightedImpact,
            bitter: firstSer.weightedBitter,
            burn: firstSer.weightedBurn,
            sugar: firstSer.weightedSugar,
            aroma: firstSer.weightedAroma ?? 4.2,
            colorGrade: firstSer.compositeColorGrade,
            hppPerKg: firstSer.hppPerNetKg,
          },
          smokingTest: {
            testerName: 'QC Internal Gudang',
            testDate: new Date().toISOString().split('T')[0],
            ashQuality: 'Putih Bersih',
            tastingNotes: `Sampel Gulungan ${autoRollNumber} (${cleanRecipeTitle})`,
            factoryVerdict: 'Diterima Penuh',
          },
        };
        return [newAutoRoll, ...updatedExisting];
      }

      return updatedExisting;
    });

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

    if (createdSerials.length > 0) {
      const sample = createdSerials[0];
      const ingSummary = (sample.ingredients || [])
        .map((i) => `${i.tobaccoName} (${i.usedNetKg}kg)`)
        .join(' + ');
      recordNolanDecisionEpisode(
        'BLEND_CREATED',
        `Racikan "${sample.recipeName}" (${createdSerials.length} Seri) → ${sample.targetFactory} [Grade ${sample.compositeColorGrade}] • HPP Rp ${sample.hppPerNetKg.toLocaleString('id-ID')}/kg`,
        {
          recipeName: sample.recipeName,
          targetFactory: sample.targetFactory,
          grade: sample.compositeColorGrade,
          serialCount: createdSerials.length,
          hppPerNetKg: sample.hppPerNetKg,
          targetPricePerKg: sample.factoryTargetPricePerKg,
          ingredients: ingSummary,
        }
      );
    }
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

    const targetSer = finishedBatches.find((s) => s.id === serialId);
    if (status === 'ACCEPTED_CAIR') {
      showToast('Status Seri diperbarui: Diterima / Accepted!');
      if (targetSer) {
        recordNolanDecisionEpisode(
          'FACTORY_ACCEPTED',
          `DITERIMA PABRIK: Seri ${targetSer.serialNumber} (${targetSer.recipeName}) di ${targetSer.targetFactory} [Grade ${targetSer.compositeColorGrade}]`,
          {
            serialNumber: targetSer.serialNumber,
            recipeName: targetSer.recipeName,
            targetFactory: targetSer.targetFactory,
            grade: targetSer.compositeColorGrade,
            hppPerNetKg: targetSer.hppPerNetKg,
            targetPricePerKg: targetSer.factoryTargetPricePerKg,
            profitRp: targetSer.projectedProfit,
            ingredients: (targetSer.ingredients || []).map((i) => ({
              name: i.tobaccoName,
              usedNetKg: i.usedNetKg,
            })),
          }
        );
      }
    } else if (status === 'REJECTED_STOCK') {
      showToast('Seri di-Reject & otomatis masuk ke Panel 2: Stok Tembakau Jadi (Kemasan & Berat Tetap)!');
      if (targetSer) {
        recordNolanDecisionEpisode(
          'FACTORY_REJECTED',
          `REJECT PABRIK: Seri ${targetSer.serialNumber} (${targetSer.recipeName}) direject oleh ${targetSer.targetFactory} [Grade ${targetSer.compositeColorGrade}]`,
          {
            serialNumber: targetSer.serialNumber,
            recipeName: targetSer.recipeName,
            targetFactory: targetSer.targetFactory,
            grade: targetSer.compositeColorGrade,
            hppPerNetKg: targetSer.hppPerNetKg,
            ingredients: (targetSer.ingredients || []).map((i) => ({
              name: i.tobaccoName,
              usedNetKg: i.usedNetKg,
            })),
          }
        );
      }
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

    setFinishedBatches((prev) => {
      const nextBatches = prev.map((s) =>
        s.id === normalizedSerial.id ? normalizedSerial : s
      );
      setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, nextBatches));
      return nextBatches;
    });
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
    setFinishedBatches((prev) => {
      const nextBatches = prev.map((ser) => {
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
      setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, nextBatches));
      return nextBatches;
    });
  };

  const handleDeleteFinished = (id: string) => {
    const item = finishedBatches.find((b) => b.id === id);
    if (!item) return;
    setPendingDeletion({
      title: `Hapus Nomor Seri "${item.serialNumber}"?`,
      description: `Nomor Seri "${item.serialNumber}" (${item.recipeName} • ${item.targetFactory}) akan dihapus dari Seri Jadi, Gulungan, dan Riwayat. Anda tetap dapat menekan tombol Urungkan (Undo) setelah dihapus.`,
      confirmLabel: 'Ya, Hapus Seri',
      onConfirm: () => {
        recordUndoSnapshot(`Nomor Seri "${item.serialNumber}" dihapus`);
        hasLocalUserMutationRef.current = true;
        const nextBatches = finishedBatches.filter((b) => b.id !== id);
        setFinishedBatches(nextBatches);
        setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, nextBatches));
        showToast(`Nomor Seri "${item.serialNumber}" dihapus.`);
      },
    });
  };

  const handleDeleteRoll = (rollId: string) => {
    const target = rollSamples.find((r) => r.id === rollId);
    if (!target) return;
    setPendingDeletion({
      title: `Hapus Gulungan "${target.rollNumber}"?`,
      description: `Gulungan "${target.rollNumber}" (${target.recipeName} • ${target.targetFactory}) beserta seri yang terikat di dalamnya akan dihapus. Anda tetap dapat menekan tombol Urungkan (Undo) setelah dihapus.`,
      confirmLabel: 'Ya, Hapus Gulungan',
      onConfirm: () => {
        recordUndoSnapshot(`Gulungan "${target.rollNumber}" dihapus`);
        hasLocalUserMutationRef.current = true;
        const nextRolls = rollSamples.filter((r) => r.id !== rollId);
        const nextBatches = finishedBatches.filter(
          (b) => b.rollId !== rollId && b.rollNumber !== target.rollNumber
        );
        setRollSamples(nextRolls);
        setFinishedBatches(nextBatches);
        if (selectedRoll?.id === rollId) {
          setSelectedRoll(null);
        }
        showToast(`Gulungan "${target.rollNumber}" beserta seri di dalamnya telah dihapus.`);
      },
    });
  };

  const handleClearAllSerials = () => {
    if (finishedBatches.length === 0) return;
    setPendingDeletion({
      title: `Hapus Semua Nomor Seri Jadi (${finishedBatches.length} Seri)?`,
      description: `Seluruh ${finishedBatches.length} Nomor Seri Tembakau Jadi akan dikosongkan. Anda tetap dapat menekan tombol Urungkan (Undo) bila ingin mengembalikannya.`,
      confirmLabel: 'Ya, Hapus Semua Seri',
      onConfirm: () => {
        recordUndoSnapshot(`Semua Nomor Seri (${finishedBatches.length} seri) dihapus`);
        hasLocalUserMutationRef.current = true;
        setFinishedBatches([]);
        setRollSamples((prevRolls) => syncRollsWithSerials(prevRolls, []));
        showToast('Semua Nomor Seri Tembakau Jadi berhasil dihapus.');
      },
    });
  };

  const handleClearAllDemoData = () => {
    setPendingDeletion({
      title: 'Bersihkan Semua Data Demo / Kosongkan Aplikasi?',
      description: `Seluruh Stok Mentah (${rawTobaccos.length}), Seri Jadi (${finishedBatches.length}), dan Gulungan & Riwayat (${rollSamples.length}) akan dikosongkan agar aplikasi bersih siap diisi data asli. Anda masih bisa menekan tombol Urungkan (Undo) setelah dikosongkan.`,
      confirmLabel: 'Ya, Bersihkan Semua',
      onConfirm: () => {
        recordUndoSnapshot('Seluruh data (Stok, Seri Jadi, Gulungan & Riwayat) dikosongkan');
        hasLocalUserMutationRef.current = true;
        setRawTobaccos([]);
        setFinishedBatches([]);
        setRollSamples([]);
        setSelectedRoll(null);
        showToast('Semua data demo (Stok Mentah, Seri Jadi, Gulungan & Riwayat) telah dikosongkan!');
      },
    });
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
          onOpenNolanAgent={() => setIsNolanModalOpen(true)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto py-4 sm:py-5 safe-main-container">
          <div key={activeTab}>
            {activeTab === 'inventory' && (
                <RawTobaccoList
                  tobaccos={rawTobaccos}
                  finishedBatches={finishedBatches}
                  rollSamples={rollSamples}
                  factoryList={factoryList}
                  packagingList={packagingList}
                  initialStockPanel={stockInitialPanel}
                  onAddNew={() => {
                    setEditingTobacco(null);
                    setIsRawModalOpen(true);
                  }}
                  onEdit={(tobacco) => {
                    setEditingTobacco(tobacco);
                    setIsRawModalOpen(true);
                  }}
                  onQuickUpdate={handleSaveRawTobacco}
                  onDelete={handleDeleteRawTobacco}
                  onDeleteFinished={handleDeleteFinished}
                  onClearAllDemoData={handleClearAllDemoData}
                  onAddToBlend={handleAddToBlend}
                  onReassignRejectedToRoll={handleReassignRejectedToRoll}
                  onUnpackRejectedToBlend={handleUnpackRejectedToBlend}
                />
              )}

              {activeTab === 'calculator' && (
                <BlendCalculator
                  key={blendPrefilledIngredients.map((i) => `${i.tobaccoId}-${i.usedNetKg}`).join('-')}
                  rawTobaccos={rawTobaccos}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  rollSamples={rollSamples}
                  existingSerialCount={finishedBatches.length}
                  onSaveMultipleFinished={handleSaveMultipleFinished}
                  initialIngredients={blendPrefilledIngredients}
                  onAskNolanRecommendation={() => {
                    setNolanInitialPrompt(
                      'Nolan, rekomendasikan komposisi racikan terbaik dari sisa stok tembakau mentah saat ini lengkap dengan takaran KG, estimasi HPP/kg, dan target harga pabrik.'
                    );
                    setIsNolanModalOpen(true);
                  }}
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
                  onDeleteRoll={handleDeleteRoll}
                  onClearAllSerials={handleClearAllSerials}
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
                  onDeleteRoll={handleDeleteRoll}
                  onDeleteSerial={handleDeleteFinished}
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
                  onDeleteRoll={handleDeleteRoll}
                  onDeleteSerial={handleDeleteFinished}
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
                  onDeleteRoll={handleDeleteRoll}
                  onDeleteSerial={handleDeleteFinished}
                  onClearAllDemoData={handleClearAllDemoData}
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

              {activeTab === 'settings' && (
                <SettingsView
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
                  rawTobaccos={rawTobaccos}
                  finishedBatches={finishedBatches}
                  rollSamples={rollSamples}
                  packagingList={packagingList}
                  factoryList={factoryList}
                  nolanBrain={nolanBrain}
                  onUpdateNolanBrain={(nextBrain) => handleUpdateNolanBrain(nextBrain, true)}
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
                  onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
                  onOpenSimulator={() => setIsSimulatorOpen(true)}
                  onExportData={handleExportData}
                  onOpenRestoreModal={() => setBackupModalMode('restore')}
                  onClearAllDemoData={handleClearAllDemoData}
                  onResetData={handleResetData}
                  onOpenPatchNotes={() => {
                    setIsPatchNotesOpen(true);
                    setHasUnreadPatch(false);
                    try {
                      localStorage.setItem(STORAGE_KEYS.SEEN_PATCH, CURRENT_APP_VERSION);
                    } catch {
                      // ignore
                    }
                  }}
                  onOpenNolanChat={() => setIsNolanModalOpen(true)}
                  onShowToast={showToast}
                  currentVersion={CURRENT_APP_VERSION}
                />
              )}
          </div>
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
                      Simulator
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

      <NolanAgentModal
        isOpen={isNolanModalOpen}
        onClose={() => setIsNolanModalOpen(false)}
        onOpen={() => setIsNolanModalOpen(true)}
        userEmail={currentUser?.email || null}
        rawTobaccos={rawTobaccos}
        finishedBatches={finishedBatches}
        rollSamples={rollSamples}
        packagingList={packagingList}
        factoryList={factoryList}
        nolanBrain={nolanBrain}
        onUpdateNolanBrain={(nextBrain) => handleUpdateNolanBrain(nextBrain, true)}
        onApplyRecommendedBlend={(recommendedIngs, recipeLabel) => {
          setBlendPrefilledIngredients(recommendedIngs);
          setActiveTab('calculator');
          showToast(
            `Rekomendasi Nolan ("${recipeLabel}") diterapkan ke Kalkulator Racikan!`
          );
        }}
        onNavigate={(target: NolanNavTarget) => {
          switch (target) {
            case 'inventory':
              setStockInitialPanel('raw');
              setActiveTab('inventory');
              showToast('🧭 Nolan membuka Stok Gudang Mentah.');
              break;
            case 'inventory_rejected':
              setStockInitialPanel('rejected-finished');
              setActiveTab('inventory');
              showToast('🧭 Nolan membuka Stok Tembakau Jadi (Eks-Reject).');
              break;
            case 'calculator':
              setActiveTab('calculator');
              showToast('🧭 Nolan membuka Kalkulator Racikan.');
              break;
            case 'rolls':
              setActiveTab('rolls');
              showToast('🧭 Nolan membuka menu Gulungan (Gudang).');
              break;
            case 'finished':
              setActiveTab('finished');
              showToast('🧭 Nolan membuka menu Status Barang (Pabrik).');
              break;
            case 'history':
              setActiveTab('history');
              showToast('🧭 Nolan membuka menu Riwayat & Laporan.');
              break;
            case 'settings':
              setActiveTab('settings');
              showToast('🧭 Nolan membuka menu Pengaturan.');
              break;
            case 'simulator':
              setIsSimulatorOpen(true);
              showToast('🧭 Nolan membuka Simulator.');
              break;
            case 'input_raw_modal':
              setEditingTobacco(null);
              setIsRawModalOpen(true);
              showToast('🧭 Nolan membuka Form Input Stok Baru.');
              break;
            case 'google_sheets':
              setIsGoogleSheetsModalOpen(true);
              showToast('🧭 Nolan membuka Sinkronisasi Google Sheets.');
              break;
            case 'backup':
              setBackupModalMode('backup');
              showToast('🧭 Nolan membuka menu Backup Data.');
              break;
            case 'restore':
              setBackupModalMode('restore');
              showToast('🧭 Nolan membuka menu Restore Data.');
              break;
            case 'patch_notes':
              setIsPatchNotesOpen(true);
              showToast('🧭 Nolan membuka Catatan Pembaruan.');
              break;
          }
        }}
        onExecutePendingAction={(action: NolanPendingAction) => {
          const addPayload = action.newTobacco || action.newRawTobacco;
          const editPayload = action.editTobacco || action.editRawTobacco;
          const statusPayload = action.statusUpdate || action.updateSerialStatus;

          if (action.type === 'ADD_RAW_TOBACCO' && addPayload) {
            const d = addPayload;
            const taraFormula = {
              type: 'Keranjang' as const,
              packagingName: d.packagingType || 'Keranjang',
              packagingMassKg: d.packagingMassKg ?? 3,
              percent: d.taraPercent ?? 0,
              flatKg: d.taraFlatKg ?? 3,
              rawFormula: `${d.taraFlatKg ?? 3} kg`,
              pricingBasis: 'NET_WEIGHT' as const,
            };
            const calc = calculateRawTobaccoCost({
              grossWeightKg: d.grossWeightKg,
              pricePerKgPurchase: d.pricePerKgPurchase,
              taraFormula,
              additionalCost: 0,
              realPackagingMassKg: d.packagingMassKg ?? 3,
              agentFees: [],
            });
            const newTobacco: RawTobacco = normalizeRawTobaccoRounding({
              id: `raw-nolan-${Date.now()}`,
              lotNumber: `LOT-${new Date().getFullYear()}-${String(rawTobaccos.length + 1).padStart(3, '0')}`,
              name: d.name,
              origin: d.origin,
              sellerName: d.sellerName || 'Petani / Agen Lokal',
              purchaseDate: new Date().toISOString().split('T')[0],
              grossWeightKg: d.grossWeightKg,
              packagingMassKg: d.packagingMassKg ?? 3,
              taraFormula,
              deductionKg: calc.deductionKg,
              netWeightKg: calc.netWeightKg,
              currentStockNetKg: calc.netWeightKg,
              pricePerKgPurchase: d.pricePerKgPurchase,
              additionalPurchaseCost: 0,
              totalModalAsal: calc.totalModalAsal,
              realCostPerNetKg: calc.realCostPerNetKg,
              realNetWeightKg: calc.realNetWeightKg,
              realStockValueRp: calc.realStockValueRp,
              purchaseWeightProfitKg: calc.purchaseWeightProfitKg,
              purchaseWeightProfitRp: calc.purchaseWeightProfitRp,
              effectiveCostPerRealKg: calc.effectiveCostPerRealKg,
              powerRating: d.powerRating ?? 3.8,
              impactRating: d.impactRating ?? 3.8,
              bitterRating: d.bitterRating ?? 3.5,
              burnRating: d.burnRating ?? 4.5,
              sugarRating: d.sugarRating ?? 4.0,
              aromaRating: d.aromaRating ?? 4.2,
              colorGrade: d.colorGrade || 'D',
              characterNotes: d.characterNotes || 'Diinput oleh Nolan AI atas izin pengguna',
            });
            handleSaveRawTobacco(newTobacco);
            setActiveTab('inventory');
          } else if (action.type === 'EDIT_RAW_TOBACCO' && editPayload) {
            const { tobaccoId, updates } = editPayload;
            const existing = rawTobaccos.find((t) => t.id === tobaccoId);
            if (existing) {
              const updatedRaw = normalizeRawTobaccoRounding({
                ...existing,
                name: updates.name !== undefined ? updates.name : existing.name,
                pricePerKgPurchase:
                  updates.pricePerKgPurchase !== undefined
                    ? updates.pricePerKgPurchase
                    : existing.pricePerKgPurchase,
                grossWeightKg:
                  updates.grossWeightKg !== undefined
                    ? updates.grossWeightKg
                    : existing.grossWeightKg,
                currentStockNetKg:
                  updates.currentStockNetKg !== undefined
                    ? updates.currentStockNetKg
                    : existing.currentStockNetKg,
                colorGrade:
                  updates.colorGrade !== undefined
                    ? updates.colorGrade
                    : existing.colorGrade,
                origin: updates.origin !== undefined ? updates.origin : existing.origin,
                sellerName:
                  updates.sellerName !== undefined
                    ? updates.sellerName
                    : existing.sellerName,
                characterNotes:
                  updates.characterNotes !== undefined
                    ? updates.characterNotes
                    : existing.characterNotes,
              });
              handleSaveRawTobacco(updatedRaw);
            }
          } else if (action.type === 'UPDATE_FACTORY_STATUS' && statusPayload) {
            const serialId = statusPayload.serialId;
            const nextStat =
              'newStatus' in statusPayload
                ? statusPayload.newStatus
                : statusPayload.factoryStatus;
            handleUpdateSerialStatus(serialId, nextStat);
          }
        }}
        onShowToast={showToast}
        initialPrompt={nolanInitialPrompt}
        onClearInitialPrompt={() => setNolanInitialPrompt(null)}
        onOpenSettings={() => setActiveTab('settings')}
      />

      {/* Confirm Deletion Modal */}
      <AnimatePresence>
        {pendingDeletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPendingDeletion(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#09090c] border-2 border-red-500/80 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.95)] space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/60 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-white">
                    {pendingDeletion.title}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {pendingDeletion.description}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeletion(null)}
                  className="h-9 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-extrabold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = pendingDeletion.onConfirm;
                    setPendingDeletion(null);
                    action();
                  }}
                  className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white border border-red-400 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{pendingDeletion.confirmLabel || 'Ya, Hapus Sekarang'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Deletion Banner (Bottom Left / Center) */}
      <AnimatePresence>
        {undoDeletionSnapshot && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            className="fixed bottom-16 md:bottom-5 left-4 z-[65] bg-[#09090c] border-2 border-amber-500 text-white px-4 py-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.9)] flex items-center gap-3 max-w-md"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Data Dihapus • Bisa Diurungkan
              </div>
              <div className="text-xs font-bold text-zinc-200 truncate">
                {undoDeletionSnapshot.label}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRestoreUndoSnapshot}
              className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md"
            >
              <Undo2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Urungkan (Undo)</span>
            </button>
            <button
              type="button"
              onClick={() => setUndoDeletionSnapshot(null)}
              className="h-8 w-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Tutup banner undo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
