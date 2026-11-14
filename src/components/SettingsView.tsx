import React, { useState, useEffect } from 'react';
import {
  Settings,
  Github,
  Cloud,
  RefreshCw,
  LogIn,
  LogOut,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
  Download,
  Upload,
  FolderGit2,
  FileText,
  ExternalLink,
  Calculator,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  Sparkles,
  Brain,
  Database,
  Building2,
  Package,
  Scroll,
  Plus,
  Edit3,
} from 'lucide-react';
import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
} from '../types/tobacco';
import { NolanBrainMemory } from '../types/nolan';
import { computeAccountSummaryForABrain } from '../utils/nolanBrain';
import { NumericInput } from './NumericInput';
import {
  formatTaraFormula,
  formatRupiah,
  calculateTaraDeduction,
  roundHalfUpKg,
} from '../utils/tobaccoMath';

export type SettingsSegment =
  | 'github'
  | 'cloud'
  | 'packaging'
  | 'factory'
  | 'gulungan'
  | 'data';

interface SettingsViewProps {
  userEmail: string | null;
  cloudSyncStatus: 'offline' | 'syncing' | 'synced' | 'error';
  onGoogleLogin: () => void;
  onGoogleLogout: () => void;
  onForceCloudSync: () => void;
  rawTobaccos: RawTobacco[];
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  packagingList: PackagingMaster[];
  factoryList: FactoryMaster[];
  nolanBrain: NolanBrainMemory;
  onUpdateNolanBrain: (nextBrain: NolanBrainMemory) => void;
  onAddPackaging: (pkg: PackagingMaster) => void;
  onUpdatePackaging: (pkg: PackagingMaster) => void;
  onDeletePackaging: (id: string) => void;
  onAddFactory: (fac: FactoryMaster) => void;
  onUpdateFactory: (fac: FactoryMaster) => void;
  onDeleteFactory: (id: string) => void;
  onAddRollSample: (roll: TobaccoRollSample) => void;
  onUpdateRollSample: (roll: TobaccoRollSample) => void;
  onDeleteRollSample: (id: string) => void;
  onOpenGoogleSheetsModal: () => void;
  onOpenSimulator: () => void;
  onExportData: () => void;
  onOpenRestoreModal: () => void;
  onClearAllDemoData: () => void;
  onResetData: () => void;
  onOpenPatchNotes: () => void;
  onOpenNolanChat: () => void;
  onShowToast: (msg: string) => void;
  currentVersion: string;
  initialSegment?: SettingsSegment;
}

const GITHUB_TOKEN_KEY = 'kretek_master_github_oauth_token';

export const SettingsView: React.FC<SettingsViewProps> = ({
  userEmail,
  cloudSyncStatus,
  onGoogleLogin,
  onGoogleLogout,
  onForceCloudSync,
  rawTobaccos,
  finishedBatches,
  rollSamples,
  packagingList,
  factoryList,
  nolanBrain,
  onUpdateNolanBrain,
  onAddPackaging,
  onUpdatePackaging,
  onDeletePackaging,
  onAddFactory,
  onUpdateFactory,
  onDeleteFactory,
  onAddRollSample,
  onUpdateRollSample,
  onDeleteRollSample,
  onOpenGoogleSheetsModal,
  onOpenSimulator,
  onExportData,
  onOpenRestoreModal,
  onClearAllDemoData,
  onResetData,
  onOpenPatchNotes,
  onOpenNolanChat,
  onShowToast,
  currentVersion,
  initialSegment = 'github',
}) => {
  const [activeSegment, setActiveSegment] = useState<SettingsSegment>(initialSegment);

  useEffect(() => {
    setActiveSegment(initialSegment);
  }, [initialSegment]);

  // GitHub A-Brain State
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem(GITHUB_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [showManualTokenBox, setShowManualTokenBox] = useState<boolean>(false);
  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [githubUser, setGithubUser] = useState<{
    login: string;
    name: string;
    avatarUrl: string;
  } | null>(null);
  const [githubMethod, setGithubMethod] = useState<string>('none');
  const [serverOauthConfigured, setServerOauthConfigured] = useState<boolean>(false);
  const [serverHasToken, setServerHasToken] = useState<boolean>(false);
  const [githubSyncing, setGithubSyncing] = useState<boolean>(false);
  const [githubRepoInput, setGithubRepoInput] = useState<string>(
    nolanBrain.githubRepo || 'Aldi-ang/A-Brain'
  );
  const [githubBranchInput, setGithubBranchInput] = useState<string>(
    nolanBrain.githubBranch || 'main'
  );
  const [githubPathInput, setGithubPathInput] = useState<string>(
    nolanBrain.githubFilePath || 'Tobacco-Business/nolan-brain.json'
  );
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState<boolean>(false);
  const [abrainRepoFiles, setAbrainRepoFiles] = useState<
    Array<{ path: string; size: number; url: string }>
  >([]);
  const [abrainNotesSnippet, setAbrainNotesSnippet] = useState<string>('');

  // Packaging Form & Edit State
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgMassKg, setPkgMassKg] = useState<number>(3);
  const [pkgTaraPercent, setPkgTaraPercent] = useState<number>(0);
  const [pkgTaraFlatKg, setPkgTaraFlatKg] = useState<number>(3);
  const [pkgCostRp, setPkgCostRp] = useState<number>(35000);
  const [pkgPressCostRp, setPkgPressCostRp] = useState<number>(15000);
  const [pkgNotes, setPkgNotes] = useState('');

  // Factory Form & Edit State
  const [editingFacId, setEditingFacId] = useState<string | null>(null);
  const [facName, setFacName] = useState('');
  const [facSampleKg, setFacSampleKg] = useState<number>(0);
  const [facNotes, setFacNotes] = useState('');

  // Gulungan Form & Edit State
  const [editingRollId, setEditingRollId] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState(
    () => `GUL-${new Date().getFullYear()}-${String(rollSamples.length + 1).padStart(3, '0')}`
  );
  const [rollLabel, setRollLabel] = useState('');
  const [rollFactory, setRollFactory] = useState(factoryList[0]?.name || 'CELLO MUNTILAN');
  const [rollRack, setRollRack] = useState('Lemari Sampel Gudang A - Tabung Baru');
  const [rollWeightGrams, setRollWeightGrams] = useState<number>(250);
  const [rollDate, setRollDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setGithubRepoInput(nolanBrain.githubRepo || 'Aldi-ang/A-Brain');
    setGithubBranchInput(nolanBrain.githubBranch || 'main');
    setGithubPathInput(nolanBrain.githubFilePath || 'Tobacco-Business/nolan-brain.json');
  }, [
    nolanBrain.githubRepo,
    nolanBrain.githubBranch,
    nolanBrain.githubFilePath,
  ]);

  // Verify GitHub connection status
  useEffect(() => {
    fetch('/api/github/status', {
      headers: githubToken ? { 'x-github-token': githubToken } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        setGithubConnected(!!data.connected);
        const loginName = data.username || data.user?.login || '';
        setGithubUser(
          loginName
            ? {
                login: loginName,
                name: data.user?.name || loginName,
                avatarUrl: data.avatarUrl || data.user?.avatarUrl || '',
              }
            : null
        );
        setGithubMethod(data.authMethod || data.method || 'none');
        setServerOauthConfigured(!!data.oauthConfigured);
        setServerHasToken(!!data.hasServerToken || data.authMethod === 'env_token');
      })
      .catch(() => {});
  }, [githubToken]);

  // Listen for OAuth popup callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.endsWith('.vercel.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS' && event.data?.accessToken) {
        const token = String(event.data.accessToken);
        setGithubToken(token);
        try {
          localStorage.setItem(GITHUB_TOKEN_KEY, token);
        } catch {
          // ignore
        }
        onShowToast('GitHub A-Brain berhasil terhubung melalui OAuth!');
      } else if (event.data?.type === 'GITHUB_AUTH_ERROR') {
        onShowToast(`Gagal login GitHub: ${event.data.error || 'Unknown error'}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onShowToast]);

  const handleSaveManualToken = () => {
    const trimmed = manualTokenInput.trim();
    if (!trimmed) {
      onShowToast('Masukkan Personal Access Token GitHub terlebih dahulu.');
      return;
    }
    setGithubToken(trimmed);
    try {
      localStorage.setItem(GITHUB_TOKEN_KEY, trimmed);
    } catch {
      // ignore
    }
    setManualTokenInput('');
    setShowManualTokenBox(false);
    onShowToast('GitHub Personal Access Token berhasil disimpan & diaktifkan!');
  };

  const handleConnectGithubOAuth = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/github/callback`;
      const res = await fetch(
        `/api/auth/github/url?redirectUri=${encodeURIComponent(redirectUri)}`
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        setShowManualTokenBox(true);
        onShowToast(
          data.error ||
            'Gunakan Personal Access Token (ghp_...) di bawah atau atur GITHUB_CLIENT_ID.'
        );
        return;
      }
      window.open(data.url, 'github_oauth_popup', 'width=600,height=720');
    } catch {
      setShowManualTokenBox(true);
      onShowToast('Gagal membuka jendela login GitHub OAuth.');
    }
  };

  const handlePushToGithubABrain = async () => {
    if (!githubRepoInput.trim() || !githubRepoInput.includes('/')) {
      onShowToast('Masukkan format repository GitHub yang benar, contoh: Aldi-ang/A-Brain');
      return;
    }
    setGithubSyncing(true);
    try {
      const accountSummary = computeAccountSummaryForABrain(
        rawTobaccos,
        finishedBatches,
        rollSamples
      );
      const updatedBrain: NolanBrainMemory = {
        ...nolanBrain,
        githubRepo: githubRepoInput.trim(),
        githubBranch: githubBranchInput.trim() || 'main',
        githubFilePath: githubPathInput.trim() || 'Tobacco-Business/nolan-brain.json',
        autoSyncGithub: true,
      };

      const res = await fetch('/api/github/abrain/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubToken ? { 'x-github-token': githubToken } : {}),
        },
        body: JSON.stringify({
          repo: updatedBrain.githubRepo,
          branch: updatedBrain.githubBranch,
          filePath: updatedBrain.githubFilePath,
          brain: updatedBrain,
          accountSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast(data.error || 'Gagal push memori Nolan ke GitHub A-Brain.');
        return;
      }

      const syncedBrain: NolanBrainMemory = {
        ...updatedBrain,
        lastSyncedToGithub: data.syncedAt || new Date().toISOString(),
      };
      onUpdateNolanBrain(syncedBrain);
      onShowToast(`Memori Nolan berhasil di-push ke GitHub (${updatedBrain.githubRepo})!`);
    } catch {
      onShowToast('Terjadi kesalahan koneksi saat push ke GitHub A-Brain.');
    } finally {
      setGithubSyncing(false);
    }
  };

  const handlePullFromGithubABrain = async () => {
    if (!githubRepoInput.trim() || !githubRepoInput.includes('/')) {
      onShowToast('Masukkan format repository GitHub yang benar, contoh: Aldi-ang/A-Brain');
      return;
    }
    setGithubSyncing(true);
    try {
      const qs = new URLSearchParams({
        repo: githubRepoInput.trim(),
        branch: githubBranchInput.trim() || 'main',
        filePath: githubPathInput.trim() || 'Tobacco-Business/nolan-brain.json',
        accountEmail: userEmail || 'adikaryasukses99@gmail.com',
      });
      const res = await fetch(`/api/github/abrain/pull?${qs.toString()}`, {
        headers: githubToken ? { 'x-github-token': githubToken } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast(data.error || 'Gagal menarik memori Nolan dari GitHub A-Brain.');
        return;
      }

      if (Array.isArray(data.repoTreeSummary)) {
        setAbrainRepoFiles(data.repoTreeSummary);
      }
      if (typeof data.markdownContext === 'string' && data.markdownContext.trim()) {
        setAbrainNotesSnippet(data.markdownContext);
      }

      if (!data.found || !data.payload?.nolanBrain) {
        const syncedBrain: NolanBrainMemory = {
          ...nolanBrain,
          githubRepo: githubRepoInput.trim(),
          githubBranch: githubBranchInput.trim() || 'main',
          githubFilePath: githubPathInput.trim() || 'Tobacco-Business/nolan-brain.json',
          autoSyncGithub: true,
          lastSyncedToGithub: new Date().toISOString(),
        };
        onUpdateNolanBrain(syncedBrain);
        onShowToast(
          data.message ||
            `Terhubung ke ${githubRepoInput.trim()} (${data.repoTreeSummary?.length || 0} file ditemukan). Klik "Simpan (Push) ke A-Brain" untuk membuat file JSON perdana.`
        );
        return;
      }

      const remoteBrain = data.payload.nolanBrain as NolanBrainMemory;
      const mergedRules = Array.from(
        new Set([...(remoteBrain.learnedRules || []), ...nolanBrain.learnedRules])
      );
      const nextBrain: NolanBrainMemory = {
        ...nolanBrain,
        ...remoteBrain,
        learnedRules: mergedRules,
        githubRepo: githubRepoInput.trim(),
        githubBranch: githubBranchInput.trim() || 'main',
        githubFilePath: githubPathInput.trim() || 'Tobacco-Business/nolan-brain.json',
        autoSyncGithub: true,
        lastSyncedToGithub: new Date().toISOString(),
      };
      onUpdateNolanBrain(nextBrain);
      onShowToast(`Memori Nolan berhasil ditarik & digabungkan dari ${githubRepoInput.trim()}!`);
    } catch {
      onShowToast('Terjadi kesalahan saat menarik data dari GitHub A-Brain.');
    } finally {
      setGithubSyncing(false);
    }
  };

  const handleSaveGithubSettingsLocal = () => {
    onUpdateNolanBrain({
      ...nolanBrain,
      githubRepo: githubRepoInput.trim() || 'Aldi-ang/A-Brain',
      githubBranch: githubBranchInput.trim() || 'main',
      githubFilePath: githubPathInput.trim() || 'Tobacco-Business/nolan-brain.json',
      autoSyncGithub: true,
    });
    onShowToast('Pengaturan repositori GitHub A-Brain disimpan.');
  };

  // Packaging Handlers
  const resetPackagingForm = () => {
    setEditingPkgId(null);
    setPkgName('');
    setPkgMassKg(3);
    setPkgTaraPercent(0);
    setPkgTaraFlatKg(3);
    setPkgCostRp(35000);
    setPkgPressCostRp(15000);
    setPkgNotes('');
  };

  const handleStartEditPackaging = (pkg: PackagingMaster) => {
    setEditingPkgId(pkg.id);
    setPkgName(pkg.name);
    setPkgMassKg(pkg.packagingMassKg || 0);
    setPkgTaraPercent(pkg.taraPercent || 0);
    setPkgTaraFlatKg(pkg.taraFlatKg || 0);
    setPkgCostRp(pkg.packagingCostRp || 0);
    setPkgPressCostRp(pkg.pressCostRp || 0);
    setPkgNotes(pkg.notes || '');
  };

  const handleSubmitPackaging = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) return;
    if (editingPkgId) {
      onUpdatePackaging({
        id: editingPkgId,
        name: pkgName.trim().toUpperCase(),
        packagingMassKg: pkgMassKg,
        taraPercent: pkgTaraPercent,
        taraFlatKg: pkgTaraFlatKg,
        packagingCostRp: pkgCostRp,
        pressCostRp: pkgPressCostRp,
        notes: pkgNotes.trim(),
      });
      resetPackagingForm();
      return;
    }

    onAddPackaging({
      id: `pkg-${Date.now()}`,
      name: pkgName.trim().toUpperCase(),
      packagingMassKg: pkgMassKg,
      taraPercent: pkgTaraPercent,
      taraFlatKg: pkgTaraFlatKg,
      packagingCostRp: pkgCostRp,
      pressCostRp: pkgPressCostRp,
      notes: pkgNotes.trim(),
    });
    resetPackagingForm();
  };

  // Factory Handlers
  const resetFactoryForm = () => {
    setEditingFacId(null);
    setFacName('');
    setFacSampleKg(0);
    setFacNotes('');
  };

  const handleStartEditFactory = (fac: FactoryMaster) => {
    setEditingFacId(fac.id);
    setFacName(fac.name);
    setFacSampleKg(fac.sampleDeductionKg || 0);
    setFacNotes(fac.notes || '');
  };

  const handleSubmitFactory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facName.trim()) return;
    if (editingFacId) {
      onUpdateFactory({
        id: editingFacId,
        name: facName.trim(),
        sampleDeductionKg: facSampleKg,
        notes: facNotes.trim(),
      });
      resetFactoryForm();
      return;
    }

    onAddFactory({
      id: `fac-${Date.now()}`,
      name: facName.trim(),
      sampleDeductionKg: facSampleKg,
      notes: facNotes.trim(),
    });
    resetFactoryForm();
  };

  // Gulungan Handlers
  const resetRollForm = () => {
    setEditingRollId(null);
    setRollNumber(
      `GUL-${new Date().getFullYear()}-${String(rollSamples.length + 1).padStart(3, '0')}`
    );
    setRollLabel('');
    setRollFactory(factoryList[0]?.name || 'CELLO MUNTILAN');
    setRollRack('Lemari Sampel Gudang A - Tabung Baru');
    setRollWeightGrams(250);
    setRollDate(new Date().toISOString().split('T')[0]);
  };

  const handleStartEditRoll = (r: TobaccoRollSample) => {
    setEditingRollId(r.id);
    setRollNumber(r.rollNumber);
    setRollLabel(r.recipeName);
    setRollFactory(r.targetFactory);
    setRollRack(r.rackLocation || 'Rak Gudang Utama');
    setRollWeightGrams(r.sampleWeightGrams || 250);
    setRollDate(r.sampleCreatedDate || new Date().toISOString().split('T')[0]);
  };

  const handleSubmitGulungan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;
    if (editingRollId) {
      const existing = rollSamples.find((r) => r.id === editingRollId);
      if (existing) {
        onUpdateRollSample({
          ...existing,
          rollNumber: rollNumber.trim(),
          recipeName: rollLabel.trim() || `${rollFactory}`,
          targetFactory: rollFactory,
          rackLocation: rollRack.trim() || 'Rak Gudang Utama',
          sampleWeightGrams: rollWeightGrams || 250,
          sampleCreatedDate: rollDate || existing.sampleCreatedDate,
        });
      }
      resetRollForm();
      return;
    }

    const nowStr = rollDate || new Date().toISOString().split('T')[0];
    onAddRollSample({
      id: `gul-${Date.now()}`,
      rollNumber: rollNumber.trim(),
      rackLocation: rollRack.trim() || 'Rak Gudang Utama',
      serialNumbers: [],
      serialNumber: 'Belum ada seri',
      recipeName: rollLabel.trim() || `${rollFactory}`,
      targetFactory: rollFactory,
      sampleCreatedDate: nowStr,
      sampleWeightGrams: rollWeightGrams || 250,
      ingredientsSnapshot: [],
      ratingsSnapshot: {
        power: 4.0,
        impact: 4.0,
        bitter: 2.5,
        burn: 4.5,
        sugar: 4.0,
        aroma: 4.2,
        colorGrade: 'E',
        hppPerKg: 0,
      },
    });
    setRollNumber(
      `GUL-${new Date().getFullYear()}-${String(rollSamples.length + 2).padStart(3, '0')}`
    );
    setRollLabel('');
  };

  const segments: Array<{
    id: SettingsSegment;
    label: string;
    shortDesc: string;
    icon: React.ReactNode;
    badge?: string | number;
  }> = [
    {
      id: 'github',
      label: 'GitHub A-Brain',
      shortDesc: 'Memori Nolan & OAuth',
      icon: <Github className="w-4 h-4 shrink-0" />,
      badge: githubConnected ? 'ON' : undefined,
    },
    {
      id: 'cloud',
      label: 'Cloud & Sheets',
      shortDesc: 'Akun Google & Spreadsheet',
      icon: <Cloud className="w-4 h-4 shrink-0" />,
      badge: cloudSyncStatus === 'synced' ? 'Sync' : undefined,
    },
    {
      id: 'packaging',
      label: 'Format Kemasan',
      shortDesc: 'Tarra, Harga & Press',
      icon: <Package className="w-4 h-4 shrink-0" />,
      badge: packagingList.length,
    },
    {
      id: 'factory',
      label: 'Master Pabrik',
      shortDesc: 'Pabrik Tujuan & Sampel',
      icon: <Building2 className="w-4 h-4 shrink-0" />,
      badge: factoryList.length,
    },
    {
      id: 'gulungan',
      label: 'Master Gulungan',
      shortDesc: 'Daftar Lot & Rak Gudang',
      icon: <Scroll className="w-4 h-4 shrink-0" />,
      badge: rollSamples.length,
    },
    {
      id: 'data',
      label: 'Data & Backup',
      shortDesc: 'Backup & Restore JSON',
      icon: <Database className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div className="space-y-4 pb-10">
      {/* Page Header */}
      <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                  Pengaturan Sistem & Master Data
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-700 text-[10px] font-mono font-bold text-amber-400">
                  {currentVersion}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pilih segmen kategori di bawah untuk mengatur GitHub A-Brain, Cloud, Format Kemasan, Pabrik, Gulungan, atau Backup Data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenNolanChat}
              className="h-9 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Brain className="w-4 h-4 text-emerald-400" />
              <span>Buka Chat & Memori Nolan</span>
            </button>
            <button
              type="button"
              onClick={onOpenPatchNotes}
              className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Catatan Versi</span>
            </button>
          </div>
        </div>

        {/* Category Segment Bar inside Setting */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-zinc-800/80">
          {segments.map((seg) => {
            const isActive = activeSegment === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => setActiveSegment(seg.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  isActive
                    ? 'bg-black border-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.16)]'
                    : 'bg-zinc-950/70 border-zinc-800/90 hover:border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className={isActive ? 'text-amber-400' : 'text-zinc-400'}>
                    {seg.icon}
                  </span>
                  {seg.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                      }`}
                    >
                      {seg.badge}
                    </span>
                  )}
                </div>
                <div>
                  <div
                    className={`text-xs font-black truncate ${
                      isActive ? 'text-white' : 'text-zinc-200'
                    }`}
                  >
                    {seg.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">{seg.shortDesc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          SEGMENT 1: GITHUB A-BRAIN & MEMORI NOLAN
          ==================================================================== */}
      {activeSegment === 'github' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white shrink-0">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Integrasi GitHub & Memori Nolan (A-Brain)
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Sinkronisasi aturan belajar Nolan & ringkasan akun ke repositori GitHub pribadi Anda
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border shrink-0 ${
                githubConnected
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              {githubConnected ? 'Terhubung' : 'Belum Terhubung'}
            </span>
          </div>

          <div className="bg-black/60 border border-zinc-800/90 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                    githubConnected
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                >
                  <Github className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">
                    {githubConnected
                      ? `GitHub Aktif: @${
                          githubUser?.login || githubRepoInput.split('/')[0] || 'Aldi-ang'
                        }`
                      : 'Autentikasi Akun GitHub'}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {githubConnected
                      ? `Metode: ${
                          githubMethod === 'env_token' || githubMethod === 'server_env_token'
                            ? 'Server GITHUB_TOKEN (Otomatis)'
                            : 'OAuth / Personal Token'
                        }`
                      : serverHasToken
                      ? 'Token Server terdeteksi'
                      : 'Gunakan Login OAuth atau Personal Access Token (ghp_...)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowManualTokenBox((prev) => !prev)}
                  className="h-8 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 font-extrabold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Input Token (ghp_...)</span>
                </button>
                <button
                  type="button"
                  onClick={handleConnectGithubOAuth}
                  className="h-8 px-3 rounded-lg bg-white hover:bg-zinc-200 text-black font-black text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>{githubConnected ? 'Ganti Akun' : 'Login GitHub OAuth'}</span>
                </button>
              </div>
            </div>

            {(showManualTokenBox || (!githubConnected && !serverOauthConfigured)) && (
              <div className="bg-zinc-950/90 border border-amber-500/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Cara Cepat: Tempel GitHub Personal Access Token (Tanpa Client ID)
                  </span>
                  {githubToken && (
                    <button
                      type="button"
                      onClick={() => {
                        setGithubToken('');
                        try {
                          localStorage.removeItem(GITHUB_TOKEN_KEY);
                        } catch {
                          // ignore
                        }
                        onShowToast('Token GitHub lokal dihapus.');
                      }}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Hapus Token Lokal
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Buka{' '}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Tobacco+Lab+Nolan+ABrain"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 underline font-bold"
                  >
                    GitHub Token Generator (centang scope &quot;repo&quot;)
                  </a>
                  , lalu tempel kode <code className="text-emerald-300 font-mono">ghp_...</code> di bawah ini:
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 h-8 px-3 rounded-lg bg-black border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveManualToken}
                    className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs cursor-pointer shrink-0"
                  >
                    Simpan Token
                  </button>
                </div>
              </div>
            )}

            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Authorization Callback URL (Redirect URI untuk GitHub OAuth App)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const url = 'https://tobaccolab.vercel.app/auth/github/callback';
                    navigator.clipboard.writeText(url);
                    setCopiedCallbackUrl(true);
                    setTimeout(() => setCopiedCallbackUrl(false), 2000);
                    onShowToast('Callback URL Vercel berhasil disalin!');
                  }}
                  className="h-6 px-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedCallbackUrl ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin URL Vercel</span>
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="px-2 py-1 rounded bg-black border border-emerald-500/30 text-emerald-300 truncate">
                  https://tobaccolab.vercel.app/auth/github/callback
                </div>
                <div className="px-2 py-1 rounded bg-black border border-zinc-800 text-zinc-400 truncate">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/auth/github/callback`
                    : '/auth/github/callback'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                Repository (Owner/Nama)
              </label>
              <input
                type="text"
                value={githubRepoInput}
                onChange={(e) => setGithubRepoInput(e.target.value)}
                onBlur={handleSaveGithubSettingsLocal}
                placeholder="Aldi-ang/A-Brain"
                className="w-full h-9 px-3 rounded-lg bg-black border border-zinc-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={githubBranchInput}
                onChange={(e) => setGithubBranchInput(e.target.value)}
                onBlur={handleSaveGithubSettingsLocal}
                placeholder="main"
                className="w-full h-9 px-3 rounded-lg bg-black border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                Lokasi File JSON di Repo
              </label>
              <input
                type="text"
                value={githubPathInput}
                onChange={(e) => setGithubPathInput(e.target.value)}
                onBlur={handleSaveGithubSettingsLocal}
                placeholder="Tobacco-Business/nolan-brain.json"
                className="w-full h-9 px-3 rounded-lg bg-black border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-extrabold text-emerald-300">
                  Sinkronisasi Memori Nolan 100% Otomatis Aktif
                </div>
                <div className="text-[11px] text-zinc-300">
                  Semua aktivitas stok, racikan, status pabrik, dan diskusi Nolan otomatis tercatat & di-commit ke{' '}
                  <span className="font-mono text-white">{githubRepoInput || 'Aldi-ang/A-Brain'}</span> tanpa perlu pengaturan manual.
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-[10px] font-black text-emerald-300 uppercase shrink-0">
              ALWAYS ON
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={githubSyncing}
              onClick={handlePullFromGithubABrain}
              className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>Tarik (Pull) dari A-Brain</span>
            </button>
            <button
              type="button"
              disabled={githubSyncing}
              onClick={handlePushToGithubABrain}
              className="h-10 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>Simpan (Push) ke A-Brain</span>
            </button>
          </div>

          {nolanBrain.lastSyncedToGithub && (
            <div className="text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Terakhir disinkronkan ke GitHub:{' '}
                {new Date(nolanBrain.lastSyncedToGithub).toLocaleString('id-ID')}
              </span>
            </div>
          )}

          {abrainRepoFiles.length > 0 && (
            <div className="bg-black/50 border border-emerald-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>Isi Repositori {githubRepoInput}</span>
                </div>
                <a
                  href={`https://github.com/${githubRepoInput}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-zinc-400 hover:text-white inline-flex items-center gap-1"
                >
                  <span>Buka GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {abrainRepoFiles.slice(0, 8).map((f) => (
                  <a
                    key={f.path}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between gap-2 text-[11px] text-zinc-200"
                  >
                    <span className="inline-flex items-center gap-1.5 truncate font-mono">
                      <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{f.path}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 shrink-0">{f.size} B</span>
                  </a>
                ))}
              </div>
              {abrainNotesSnippet && (
                <div className="mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                  {abrainNotesSnippet}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          SEGMENT 2: AKUN GOOGLE CLOUD, SPREADSHEET & SIMULATOR TARRA
          ==================================================================== */}
      {activeSegment === 'cloud' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/50 flex items-center justify-center text-sky-400 shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Akun Google Cloud, Spreadsheet & Simulator
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Sinkronisasi database real-time antar perangkat (iPhone, Android & PC) serta ekspor laporan Google Sheets
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : cloudSyncStatus === 'syncing'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              {cloudSyncStatus === 'synced'
                ? 'Cloud Aktif'
                : cloudSyncStatus === 'syncing'
                ? 'Sinkronisasi...'
                : 'Mode Lokal'}
            </span>
          </div>

          <div className="bg-black/60 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Status Akun Google Cloud (Firestore)
              </div>
              <div className="text-sm font-extrabold text-white truncate mt-0.5">
                {userEmail || 'Belum login (Data tersimpan di browser lokal)'}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {userEmail
                  ? 'Seluruh perubahan stok, seri jadi, gulungan, dan kemasan otomatis tersimpan ke Cloud.'
                  : 'Login dengan akun Google agar data Anda tersinkronisasi otomatis di semua perangkat.'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {userEmail ? (
                <>
                  <button
                    type="button"
                    onClick={onForceCloudSync}
                    className="h-9 px-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Sinkronkan Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={onGoogleLogout}
                    className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400" />
                    <span>Keluar Akun</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login Google Cloud</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onOpenGoogleSheetsModal}
              className="p-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-left space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Sinkronisasi & Ekspor Google Sheets</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Salin tabel nota pabrik, arsip HPP personal, atau hubungkan langsung dengan tautan Google Spreadsheet Anda.
              </p>
            </button>

            <button
              type="button"
              onClick={onOpenSimulator}
              className="p-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-left space-y-1.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase">
                <Calculator className="w-4 h-4" />
                <span>Simulator</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Simulasikan potongan tarra petani vs pabrik dan hitung potensi Weight Profit (KG & Rp) tanpa mengubah data stok.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          SEGMENT 3: FORMAT KEMASAN (INLINE CRUD)
          ==================================================================== */}
      {activeSegment === 'packaging' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Master Format Kemasan ({packagingList.length} Terdaftar)
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Atur Berat Wadah Riil, Potongan Tarra Nota, Harga Kemasan, dan Ongkos Press
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmitPackaging}
            className={`p-4 rounded-xl border space-y-3 ${
              editingPkgId
                ? 'bg-zinc-950 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : 'bg-black/60 border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                {editingPkgId
                  ? `✎ Mode Edit Kemasan: ${pkgName || 'Kemasan'}`
                  : '+ Tambah Format Kemasan Baru'}
              </div>
              {editingPkgId && (
                <button
                  type="button"
                  onClick={resetPackagingForm}
                  className="px-2.5 py-1 rounded-lg bg-black hover:bg-zinc-900 text-zinc-300 border border-zinc-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Batal Edit</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-white font-bold mb-1">
                  Nama Jenis Packaging *
                </label>
                <input
                  type="text"
                  required
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  placeholder="Contoh: KRJ MUNTILAN"
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-bold focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-zinc-200 font-bold mb-1">
                  Harga Kemasan / Wadah (Rp) *
                </label>
                <NumericInput
                  value={pkgCostRp}
                  onChange={setPkgCostRp}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono font-bold focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-zinc-200 font-bold mb-1">
                  Ongkos Packaging / Press (Rp) *
                </label>
                <NumericInput
                  value={pkgPressCostRp}
                  onChange={setPkgPressCostRp}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono font-bold focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-zinc-200 font-bold mb-1">
                  Berat Wadah Riil (kg)
                </label>
                <NumericInput
                  value={pkgMassKg}
                  onChange={setPkgMassKg}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 font-mono font-bold focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-1">Potongan Tarra Flat (kg)</label>
                <NumericInput
                  value={pkgTaraFlatKg}
                  onChange={setPkgTaraFlatKg}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-1">Potongan Tarra % Bruto</label>
                <NumericInput
                  value={pkgTaraPercent}
                  onChange={setPkgTaraPercent}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="btn-amber-outline h-10 px-4 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {editingPkgId ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" /> Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" /> Simpan Kemasan
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {packagingList.map((pkg) => {
              const refDeduction50 = calculateTaraDeduction(50, {
                percent: pkg.taraPercent || 0,
                flatKg: pkg.taraFlatKg || 0,
              }).deductionKg;
              const buyWeightDiff50 = roundHalfUpKg(
                refDeduction50 - roundHalfUpKg(pkg.packagingMassKg || 0)
              );
              const factoryWeightDiff50 = roundHalfUpKg(
                roundHalfUpKg(pkg.packagingMassKg || 0) - refDeduction50
              );
              const isBeingEdited = editingPkgId === pkg.id;

              return (
                <div
                  key={pkg.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    isBeingEdited
                      ? 'bg-zinc-900 border-amber-500/70'
                      : 'bg-black/70 border-zinc-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-white text-sm">{pkg.name}</span>
                      {buyWeightDiff50 !== 0 && (
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-200 font-bold">
                          @50kg: Beli {buyWeightDiff50 > 0 ? `+${buyWeightDiff50}` : buyWeightDiff50}kg • Setor Pabrik{' '}
                          {factoryWeightDiff50 > 0 ? `+${factoryWeightDiff50}` : factoryWeightDiff50}kg
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-300 flex flex-wrap gap-3 font-mono text-[11px]">
                      <span>
                        Wadah Riil: <b className="text-zinc-200">{pkg.packagingMassKg} kg</b>
                      </span>
                      <span>
                        Potongan Nota:{' '}
                        <b className="text-white">
                          {formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)}
                        </b>
                      </span>
                      <span>
                        Harga Kemasan:{' '}
                        <b className="text-white">{formatRupiah(pkg.packagingCostRp || 0)}</b>
                      </span>
                      <span>
                        Ongkos Press:{' '}
                        <b className="text-white">{formatRupiah(pkg.pressCostRp || 0)}</b>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditPackaging(pkg)}
                      className="h-8 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-zinc-700 hover:border-amber-500/70 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePackaging(pkg.id)}
                      className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          SEGMENT 4: MASTER PABRIK (INLINE CRUD)
          ==================================================================== */}
      {activeSegment === 'factory' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/50 flex items-center justify-center text-sky-400 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Master Pabrik Tujuan ({factoryList.length} Terdaftar)
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Kelola daftar pabrik rokok tujuan setoran beserta aturan potongan sampel ekstra
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmitFactory}
            className={`p-4 rounded-xl border space-y-3 ${
              editingFacId
                ? 'bg-zinc-950 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : 'bg-black/60 border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                {editingFacId
                  ? `✎ Mode Edit Pabrik: ${facName || 'Pabrik'}`
                  : '+ Daftarkan Pabrik Tujuan Baru'}
              </div>
              {editingFacId && (
                <button
                  type="button"
                  onClick={resetFactoryForm}
                  className="px-2.5 py-1 rounded-lg bg-black hover:bg-zinc-900 text-zinc-300 border border-zinc-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Batal Edit</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-white font-bold mb-1">
                  Nama Pabrik Rokok / Pembeli *
                </label>
                <input
                  type="text"
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="Contoh: CELLO MUNTILAN"
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-white font-bold mb-1">
                  Potongan Sampel Ekstra (kg)
                </label>
                <NumericInput
                  value={facSampleKg}
                  onChange={setFacSampleKg}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-zinc-300 mb-1">Catatan Sistem Pembelian</label>
                <input
                  type="text"
                  value={facNotes}
                  onChange={(e) => setFacNotes(e.target.value)}
                  placeholder="Catatan tambahan aturan pabrik..."
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="btn-amber-outline h-10 px-4 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {editingFacId ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" /> Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" /> Daftarkan Pabrik
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {factoryList.map((fac) => {
              const isBeingEdited = editingFacId === fac.id;
              return (
                <div
                  key={fac.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isBeingEdited
                      ? 'bg-zinc-900 border-amber-500/70'
                      : 'bg-black/70 border-zinc-800'
                  }`}
                >
                  <div>
                    <div className="font-bold text-white text-sm">{fac.name}</div>
                    <div className="text-zinc-400 mt-0.5">
                      Potongan Sampel:{' '}
                      <b className="text-white font-mono">{fac.sampleDeductionKg} kg</b>
                      {fac.notes ? <span> • {fac.notes}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditFactory(fac)}
                      className="h-8 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-zinc-700 hover:border-amber-500/70 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFactory(fac.id)}
                      className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          SEGMENT 5: MASTER GULUNGAN (INLINE CRUD)
          ==================================================================== */}
      {activeSegment === 'gulungan' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                <Scroll className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  Master Gulungan Sampel ({rollSamples.length} Terdaftar)
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Buat atau ubah kode gulungan sampel, pabrik tujuan, dan lokasi rak penyimpanan
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmitGulungan}
            className={`p-4 rounded-xl border space-y-3 ${
              editingRollId
                ? 'bg-zinc-950 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : 'bg-black/60 border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                {editingRollId
                  ? `✎ Mode Edit Gulungan: ${rollNumber}`
                  : '+ Buat Gulungan Sampel Baru'}
              </div>
              {editingRollId && (
                <button
                  type="button"
                  onClick={resetRollForm}
                  className="px-2.5 py-1 rounded-lg bg-black hover:bg-zinc-900 text-zinc-300 border border-zinc-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Batal Edit</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-white font-bold mb-1">Kode Gulungan *</label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono font-bold focus:outline-hidden focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-white font-bold mb-1">Pabrik Tujuan *</label>
                <select
                  value={rollFactory}
                  onChange={(e) => setRollFactory(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white focus:outline-hidden"
                >
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-white font-bold mb-1">Tanggal Gulungan</label>
                <input
                  type="date"
                  value={rollDate}
                  onChange={(e) => setRollDate(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-zinc-300 mb-1">Judul Setoran / Nota</label>
                <input
                  type="text"
                  value={rollLabel}
                  onChange={(e) => setRollLabel(e.target.value)}
                  placeholder="Contoh: CELLO MUNTILAN"
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-1">Lokasi Rak</label>
                <input
                  type="text"
                  value={rollRack}
                  onChange={(e) => setRollRack(e.target.value)}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-1">Berat Sampel (gram)</label>
                <NumericInput
                  value={rollWeightGrams}
                  onChange={setRollWeightGrams}
                  className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="btn-amber-outline h-10 px-4 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {editingRollId ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" /> Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" /> Buat Gulungan
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {rollSamples.map((r) => {
              const isBeingEdited = editingRollId === r.id;
              return (
                <div
                  key={r.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isBeingEdited
                      ? 'bg-zinc-900 border-amber-500/70'
                      : 'bg-black/70 border-zinc-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 font-mono font-bold text-amber-400">
                        {r.rollNumber}
                      </span>
                      <span className="font-bold text-white">{r.recipeName}</span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        ({r.sampleCreatedDate})
                      </span>
                    </div>
                    <div className="text-zinc-400 mt-0.5">
                      Pabrik: <b className="text-white">{r.targetFactory}</b> • Lokasi:{' '}
                      {r.rackLocation}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditRoll(r)}
                      className="h-8 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-amber-400 border border-zinc-700 hover:border-amber-500/70 font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRollSample(r.id)}
                      className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          SEGMENT 6: DATA & BACKUP JSON
          ==================================================================== */}
      {activeSegment === 'data' && (
        <div className="bg-[#09090c] border border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-zinc-800/80 pb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Manajemen Data & Backup / Restore JSON
              </h2>
              <p className="text-[11px] text-zinc-400">
                Ekspor cadangan seluruh data gudang ke file JSON atau pulihkan kembali kapan saja
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onExportData}
              className="h-11 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Backup / Ekspor Seluruh Data (JSON)</span>
            </button>
            <button
              type="button"
              onClick={onOpenRestoreModal}
              className="h-11 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Restore / Impor Data dari JSON</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
