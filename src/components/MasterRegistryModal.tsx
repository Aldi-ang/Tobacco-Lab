import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Package,
  Building2,
  Scroll,
  Plus,
  Trash2,
  Edit3,
  Check,
  RotateCcw,
} from 'lucide-react';
import { PackagingMaster, FactoryMaster, TobaccoRollSample } from '../types/tobacco';
import { NumericInput } from './NumericInput';
import { formatTaraFormula, formatRupiah } from '../utils/tobaccoMath';
import { SegmentedControl } from './RatingSegmentSlider';

interface MasterRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: 'packaging' | 'factory' | 'gulungan';
  packagingList: PackagingMaster[];
  onAddPackaging: (pkg: PackagingMaster) => void;
  onUpdatePackaging?: (pkg: PackagingMaster) => void;
  onDeletePackaging: (id: string) => void;
  factoryList: FactoryMaster[];
  onAddFactory: (fac: FactoryMaster) => void;
  onUpdateFactory?: (fac: FactoryMaster) => void;
  onDeleteFactory: (id: string) => void;
  rollSamples: TobaccoRollSample[];
  onAddRollSample: (roll: TobaccoRollSample) => void;
  onUpdateRollSample?: (roll: TobaccoRollSample) => void;
  onDeleteRollSample?: (id: string) => void;
}

export const MasterRegistryModal: React.FC<MasterRegistryModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'packaging',
  packagingList,
  onAddPackaging,
  onUpdatePackaging,
  onDeletePackaging,
  factoryList,
  onAddFactory,
  onUpdateFactory,
  onDeleteFactory,
  rollSamples,
  onAddRollSample,
  onUpdateRollSample,
  onDeleteRollSample,
}) => {
  const [activeSection, setActiveSection] = useState<'packaging' | 'factory' | 'gulungan'>(
    initialSection
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  const slideUpToEditForm = () => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  };

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
    }
  }, [initialSection, isOpen]);

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

  if (!isOpen) return null;

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
    slideUpToEditForm();
  };

  const handleSubmitPackaging = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) return;
    if (editingPkgId && onUpdatePackaging) {
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
    slideUpToEditForm();
  };

  const handleSubmitFactory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facName.trim()) return;
    if (editingFacId && onUpdateFactory) {
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
    slideUpToEditForm();
  };

  const handleSubmitGulungan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;
    if (editingRollId && onUpdateRollSample) {
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 bg-black flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              Format: Kemasan (Harga & Press), Pabrik & Gulungan
            </h2>
            <p className="text-xs text-zinc-400">
              Tambah, Edit, atau Hapus jenis Kemasan, Pabrik Tujuan, dan Gulungan Sampel
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
            aria-label="Tutup modal master"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-950">
          <SegmentedControl
            value={activeSection}
            onChange={setActiveSection}
            options={[
              {
                id: 'packaging',
                label: 'Kemasan',
                fullLabel: 'Master Jenis Kemasan, Tarra & Ongkos Press',
                icon: <Package className="w-3.5 h-3.5" />,
                badge: packagingList.length,
              },
              {
                id: 'factory',
                label: 'Pabrik',
                fullLabel: 'Master Pabrik Tujuan & Potongan Sampel',
                icon: <Building2 className="w-3.5 h-3.5" />,
                badge: factoryList.length,
              },
              {
                id: 'gulungan',
                label: 'Gulungan',
                fullLabel: 'Master Gulungan Sampel',
                icon: <Scroll className="w-3.5 h-3.5" />,
                badge: rollSamples.length,
              },
            ]}
          />
        </div>

        <div
          ref={scrollContainerRef}
          className="p-5 overflow-y-auto flex-1 space-y-5 text-xs scroll-smooth"
        >
          <div ref={formTopRef} />
          {activeSection === 'packaging' && (
            <>
              <form
                onSubmit={handleSubmitPackaging}
                className={`p-4 rounded-xl border space-y-3 ${
                  editingPkgId
                    ? 'bg-zinc-950 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                    : 'bg-black border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                    {editingPkgId
                      ? `✎ Mode Edit Kemasan: ${pkgName || 'Kemasan'}`
                      : '+ Tambah Jenis Packaging Baru (Tarra, Harga Kemasan & Ongkos Press)'}
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
                        <Plus className="w-4 h-4 stroke-[2.5]" /> Simpan Packaging
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="font-bold text-white">
                  Daftar Jenis Packaging Terdaftar (Klik Edit untuk mengubah):
                </div>
                {packagingList.map((pkg) => {
                  const refDeduction50 = Number(
                    ((50 * (pkg.taraPercent || 0)) / 100 + (pkg.taraFlatKg || 0)).toFixed(2)
                  );
                  const buyWeightDiff50 = Number(
                    (refDeduction50 - (pkg.packagingMassKg || 0)).toFixed(2)
                  );
                  const factoryWeightDiff50 = Number(
                    ((pkg.packagingMassKg || 0) - refDeduction50).toFixed(2)
                  );
                  const isBeingEdited = editingPkgId === pkg.id;

                  return (
                    <div
                      key={pkg.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isBeingEdited
                          ? 'bg-zinc-900 border-amber-500/70'
                          : 'bg-black border-zinc-800'
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
                          title={`Edit ${pkg.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePackaging(pkg.id)}
                          className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center cursor-pointer"
                          title={`Hapus ${pkg.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeSection === 'factory' && (
            <>
              <form
                onSubmit={handleSubmitFactory}
                className={`p-4 rounded-xl border space-y-3 ${
                  editingFacId
                    ? 'bg-zinc-950 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                    : 'bg-black border-zinc-800'
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
                <div className="font-bold text-white">
                  Daftar Pabrik Terdaftar (Klik Edit untuk mengubah):
                </div>
                {factoryList.map((fac) => {
                  const isBeingEdited = editingFacId === fac.id;
                  return (
                    <div
                      key={fac.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isBeingEdited
                          ? 'bg-zinc-900 border-amber-500/70'
                          : 'bg-black border-zinc-800'
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
                          title={`Edit ${fac.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFactory(fac.id)}
                          className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center cursor-pointer"
                          title={`Hapus ${fac.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeSection === 'gulungan' && (
            <>
              <form
                onSubmit={handleSubmitGulungan}
                className={`p-4 rounded-xl border space-y-3 ${
                  editingRollId
                    ? 'bg-zinc-950 border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                    : 'bg-black border-zinc-800'
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
                <div className="font-bold text-white">
                  Daftar Gulungan Terdaftar (Klik Edit untuk mengubah):
                </div>
                {rollSamples.map((r) => {
                  const isBeingEdited = editingRollId === r.id;
                  return (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isBeingEdited
                          ? 'bg-zinc-900 border-amber-500/70'
                          : 'bg-black border-zinc-800'
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
                          title={`Edit ${r.rollNumber}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        {onDeleteRollSample && (
                          <button
                            type="button"
                            onClick={() => onDeleteRollSample(r.id)}
                            className="h-8 w-8 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center cursor-pointer"
                            title={`Hapus ${r.rollNumber}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
