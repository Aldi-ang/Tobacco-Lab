import React, { useState } from 'react';
import {
  X,
  Package,
  Building2,
  Scroll,
  Plus,
  Trash2,
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
  onDeletePackaging: (id: string) => void;
  factoryList: FactoryMaster[];
  onAddFactory: (fac: FactoryMaster) => void;
  onDeleteFactory: (id: string) => void;
  rollSamples: TobaccoRollSample[];
  onAddRollSample: (roll: TobaccoRollSample) => void;
}

export const MasterRegistryModal: React.FC<MasterRegistryModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'packaging',
  packagingList,
  onAddPackaging,
  onDeletePackaging,
  factoryList,
  onAddFactory,
  onDeleteFactory,
  rollSamples,
  onAddRollSample,
}) => {
  const [activeSection, setActiveSection] = useState<'packaging' | 'factory' | 'gulungan'>(
    initialSection
  );

  // Packaging form state (includes Harga Kemasan & Ongkos Packaging/Press)
  const [pkgName, setPkgName] = useState('');
  const [pkgMassKg, setPkgMassKg] = useState<number>(3);
  const [pkgTaraPercent, setPkgTaraPercent] = useState<number>(0);
  const [pkgTaraFlatKg, setPkgTaraFlatKg] = useState<number>(3);
  const [pkgCostRp, setPkgCostRp] = useState<number>(35000);
  const [pkgPressCostRp, setPkgPressCostRp] = useState<number>(15000);
  const [pkgNotes, setPkgNotes] = useState('');

  // Factory form state
  const [facName, setFacName] = useState('');
  const [facSampleKg, setFacSampleKg] = useState<number>(0);
  const [facNotes, setFacNotes] = useState('');

  // Gulungan form state
  const [rollNumber, setRollNumber] = useState(
    () => `GUL-${new Date().getFullYear()}-${String(rollSamples.length + 1).padStart(3, '0')}`
  );
  const [rollLabel, setRollLabel] = useState('');
  const [rollFactory, setRollFactory] = useState(factoryList[0]?.name || 'CELLO MUNTILAN');
  const [rollRack, setRollRack] = useState('Lemari Sampel Gudang A - Tabung Baru');
  const [rollWeightGrams, setRollWeightGrams] = useState<number>(250);

  if (!isOpen) return null;

  const handleCreatePackaging = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) return;
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
    setPkgName('');
    setPkgNotes('');
  };

  const handleCreateFactory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facName.trim()) return;
    onAddFactory({
      id: `fac-${Date.now()}`,
      name: facName.trim(),
      sampleDeductionKg: facSampleKg,
      notes: facNotes.trim(),
    });
    setFacName('');
    setFacNotes('');
  };

  const handleCreateGulungan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;
    const nowStr = new Date().toISOString().split('T')[0];
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
      <div className="bg-zinc-950 border-2 border-amber-500/70 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-black flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-white">
              Format: Kemasan (Harga & Press), Pabrik & Gulungan
            </h2>
            <p className="text-xs text-zinc-400">
              Daftarkan jenis kemasan lengkap dengan Tarra, Harga Kemasan (Rp), dan Ongkos Press (Rp)
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

        {/* Sub-tabs */}
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
                fullLabel: 'Master Gulungan Sampel Baru',
                icon: <Scroll className="w-3.5 h-3.5" />,
                badge: rollSamples.length,
              },
            ]}
          />
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeSection === 'packaging' && (
            <>
              <form
                onSubmit={handleCreatePackaging}
                className="bg-black p-4 rounded-xl border border-zinc-800 space-y-3"
              >
                <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                  + Tambah Jenis Packaging Baru (Tarra, Harga Kemasan & Ongkos Press)
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
                    <label className="block text-amber-400 font-bold mb-1">
                      Harga Kemasan / Wadah (Rp) *
                    </label>
                    <NumericInput
                      value={pkgCostRp}
                      onChange={setPkgCostRp}
                      className="w-full h-10 px-3 bg-zinc-950 border border-amber-500/50 rounded-xl text-white font-mono font-bold focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-amber-400 font-bold mb-1">
                      Ongkos Packaging / Press (Rp) *
                    </label>
                    <NumericInput
                      value={pkgPressCostRp}
                      onChange={setPkgPressCostRp}
                      className="w-full h-10 px-3 bg-zinc-950 border border-amber-500/50 rounded-xl text-amber-400 font-mono font-bold focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-amber-300 font-bold mb-1">
                      Berat Wadah Riil (kg)
                    </label>
                    <NumericInput
                      value={pkgMassKg}
                      onChange={setPkgMassKg}
                      className="w-full h-10 px-3 bg-zinc-950 border border-amber-500/60 rounded-xl text-amber-300 font-mono font-bold focus:outline-hidden"
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
                    <Plus className="w-4 h-4 stroke-[2.5]" /> Simpan Packaging
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                <div className="font-bold text-white">Daftar Jenis Packaging Terdaftar:</div>
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

                  return (
                    <div
                      key={pkg.id}
                      className="bg-black p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-white text-sm">{pkg.name}</span>
                          {buyWeightDiff50 !== 0 && (
                            <span className="px-2 py-0.5 rounded bg-zinc-950 border border-amber-500/60 font-mono text-[10px] text-amber-400 font-bold">
                              @50kg: Beli {buyWeightDiff50 > 0 ? `+${buyWeightDiff50}` : buyWeightDiff50}kg • Setor Pabrik {factoryWeightDiff50 > 0 ? `+${factoryWeightDiff50}` : factoryWeightDiff50}kg
                            </span>
                          )}
                        </div>
                        <div className="text-zinc-300 flex flex-wrap gap-3 font-mono text-[11px]">
                          <span>
                            Wadah Riil: <b className="text-amber-300">{pkg.packagingMassKg} kg</b>
                          </span>
                          <span>
                            Potongan Nota:{' '}
                            <b className="text-amber-400">
                              {formatTaraFormula(pkg.taraPercent, pkg.taraFlatKg)}
                            </b>
                          </span>
                          <span>
                            Harga Kemasan:{' '}
                            <b className="text-white">{formatRupiah(pkg.packagingCostRp || 0)}</b>
                          </span>
                          <span>
                            Ongkos Press:{' '}
                            <b className="text-amber-400">{formatRupiah(pkg.pressCostRp || 0)}</b>
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeletePackaging(pkg.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-900 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeSection === 'factory' && (
            <>
              <form
                onSubmit={handleCreateFactory}
                className="bg-black p-4 rounded-xl border border-zinc-800 space-y-3"
              >
                <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                  + Daftarkan Pabrik Tujuan Baru
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
                      className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white focus:outline-hidden"
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
                    <Plus className="w-4 h-4 stroke-[2.5]" /> Daftarkan Pabrik
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {factoryList.map((fac) => (
                  <div
                    key={fac.id}
                    className="bg-black p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{fac.name}</div>
                      <div className="text-zinc-400 mt-0.5">
                        Potongan Sampel: <b className="text-amber-400 font-mono">{fac.sampleDeductionKg} kg</b>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFactory(fac.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-900 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === 'gulungan' && (
            <>
              <form
                onSubmit={handleCreateGulungan}
                className="bg-black p-4 rounded-xl border border-zinc-800 space-y-3"
              >
                <div className="font-extrabold text-amber-400 uppercase tracking-wider">
                  + Buat Gulungan Sampel Baru
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-white font-bold mb-1">Kode Gulungan *</label>
                    <input
                      type="text"
                      required
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-amber-400 font-mono font-bold focus:outline-hidden"
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
                    <label className="block text-white font-bold mb-1">Berat Sampel (gram)</label>
                    <NumericInput
                      value={rollWeightGrams}
                      onChange={setRollWeightGrams}
                      className="w-full h-10 px-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white font-mono focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
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
                  <button
                    type="submit"
                    className="btn-amber-outline h-10 px-4 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" /> Buat Gulungan
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {rollSamples.map((r) => (
                  <div
                    key={r.id}
                    className="bg-black p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">{r.rollNumber}</span>
                        <span className="font-bold text-white">{r.recipeName}</span>
                      </div>
                      <div className="text-zinc-400 mt-0.5">
                        Pabrik: <b className="text-white">{r.targetFactory}</b> • Lokasi:{' '}
                        {r.rackLocation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
