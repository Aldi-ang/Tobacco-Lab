export type TobaccoGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'E';

export type SerialFactoryStatus = 'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK';

export interface TaraFormula {
  rawFormula: string; // e.g. "3 kg" or "20% + 2 kg" or "10% + 2 kg + 2 kg Sampel"
  percent: number; // e.g. 20 or 0
  flatKg: number; // e.g. 3 or 2 (potongan tara eksklusif)
  sampleKg?: number; // e.g. 2 (ekstra potongan sampel pabrik)
  pricingBasis: 'GROSS_WEIGHT' | 'NET_WEIGHT';
  packagingType?: string;
  packagingMassKg?: number; // Berat riil wadah/kemasan kosong (kg)
  sellerName?: string; // Nama penjual/pengepul jika memiliki tara khusus
  notes?: string;
}

export interface PackagingMaster {
  id: string;
  name: string; // e.g. "KRJ MUNTILAN", "KRJ TEMANGGUNG", "BALL GONI"
  packagingMassKg: number; // Berat wadah/packaging kosong riil (kg), misal 3 kg atau 2 kg
  taraPercent: number; // Potongan % dari bruto, misal 0%, 10%, 20%
  taraFlatKg: number; // Potongan flat kg kemasan, misal 3 kg atau 2 kg
  packagingCostRp: number; // Harga beli/modal kemasan per unit (Rp)
  pressCostRp: number; // Ongkos packaging / press per unit (Rp)
  notes?: string;
}

export interface FactoryMaster {
  id: string;
  name: string; // e.g. "CELLO MUNTILAN", "PT Gudang Garam Tbk - Kediri"
  sampleDeductionKg: number; // Ekstra potongan sampel per kemasan (kg)
  defaultTaraPercent?: number;
  defaultTaraFlatKg?: number;
  notes?: string;
}

export interface RawTobacco {
  id: string;
  name: string; // e.g. "Tembakau Temanggung Srintil"
  origin: string; // e.g. "Temanggung", "Madura", "Boyolali", "Muntilan"
  sellerName?: string; // Penjual / Pengepul asal (bisa punya tara khusus)
  lotNumber: string; // e.g. "SERI-BELI-01"
  purchaseDate: string;

  // Pembelian & Timbangan (Netto Bayar = Bruto - Tarra Nota, Netto Riil = Bruto - Berat Wadah Riil)
  grossWeightKg: number; // Berat Bruto timbangan saat beli (kg)
  packagingMassKg?: number; // Berat wadah/kemasan kosong sebenarnya / riil (kg), misal Karung Goni 2 kg
  pricePerKgPurchase: number; // Harga beli per kg sesuai nota (Rp)
  taraFormula: TaraFormula; // Formula potongan tara nota eksklusif per seri/penjual (misal 10% + 2 kg)
  additionalPurchaseCost: number; // Opsional ongkos kirim (Rp)

  // Hasil Hitung Timbangan Nota (Paid Weight & Paid Value) vs Sebenarnya (Real Weight & Real Value)
  deductionKg: number; // Total Potongan Tarra Nota (kg), misal 7 kg (dari 10% + 2 pada Bruto 50 kg)
  netWeightKg: number; // Netto Bayar = Bruto - Tarra Nota (kg), misal 43 kg
  totalModalAsal?: number; // Paid Value (Nilai Bayar) = Netto Bayar * Harga Beli (Rp), misal 43 * Harga
  realCostPerNetKg: number; // Harga Modal Nota per kg Netto Bayar (Rp/kg)

  // Perhitungan Berat Sebenarnya (Real Weight) & Weight Profit Pembelian
  realNetWeightKg?: number; // Netto Riil = Bruto - Berat Kemasan Riil (kg), misal 50 - 2 = 48 kg
  realStockValueRp?: number; // Real Value (Nilai Barang Sebenarnya) = Netto Riil * Harga Beli (Rp), misal 48 * Harga
  purchaseWeightProfitKg?: number; // Selisih Berat Beli = Netto Riil - Netto Bayar (kg), misal +5 kg
  purchaseWeightProfitRp?: number; // Weight Profit Beli (Rp) = Real Value - Paid Value, misal +5 * Harga
  effectiveCostPerRealKg?: number; // Harga Modal Riil per KG Fisik Sebenarnya = Paid Value / Netto Riil (Rp/kg)

  currentStockNetKg: number; // Sisa stok fisik di gudang (kg)

  // 5 Penilaian Sensoris & Fisik (Skala Maksimal /5)
  powerRating: number; // 0 - 5
  impactRating: number; // 0 - 5
  bitterRating: number; // 0 - 5
  burnRating: number; // 0 - 5
  sugarRating: number; // 0 - 5
  colorGrade: TobaccoGrade; // Grade warna: A+, A, B+, B, C+, C, D+, D, E
  characterNotes: string; // Deskripsi fisik: pegangan, kadar gagang, warna, aroma
}

export interface BlendIngredient {
  tobaccoId: string;
  tobaccoName: string;
  origin: string;
  usedNetKg: number;
  percentageInBlend: number; // % dari total racikan
  realCostPerNetKg: number; // Harga nota / kg
  effectiveCostPerRealKg?: number; // Harga efektif riil / kg setelah diskon untung timbangan beli
  subtotalCost: number;
  subtotalRealPaidCost?: number; // Modal riil yang benar-benar keluar untuk takaran ini
  embeddedWeightProfitRp?: number; // Keuntungan timbangan beli yang terkandung dalam bahan ini
  powerRating: number; // /5
  impactRating: number; // /5
  bitterRating: number; // /5
  burnRating: number; // /5
  sugarRating: number; // /5
  colorGrade: TobaccoGrade;
  characterNotes?: string;
}

export interface AdditionalCostItem {
  id: string;
  name: string;
  amount: number;
}

export interface PackagingSpec {
  packagingId?: string;
  packagingType: string; // e.g. "KRJ MUNTILAN"
  packagingMassKg: number; // Berat wadah/packaging fisik sebenarnya (kg), misal 3 kg atau 6 kg
  packageCount: number; // 1 karena 1 nomor seri = 1 kemasan eksklusif
  netTobaccoWeightKg: number; // Berat bersih tembakau sebenarnya (Netto Riil) di dalam kemasan ini (kg)
  grossWeightPerPackage: number; // Bruto = Netto Riil Tembakau + Berat Wadah Riil (kg)
  packagingCostRp?: number; // Harga kemasan untuk seri ini (Rp)
  pressCostRp?: number; // Ongkos packaging/press untuk seri ini (Rp)
  factoryTaraFormula: TaraFormula; // Potongan tara nota pabrik seri ini
}

export interface SerialTransferRecord {
  id: string;
  date: string;
  fromSerialNumber: string;
  toSerialNumber: string;
  fromRollId?: string;
  fromRollNumber: string;
  toRollId: string;
  toRollNumber: string;
  fromFactory: string;
  toFactory: string;
  notes?: string;
}

export interface FinishedTobaccoSerial {
  id: string;
  serialNumber: string; // Nomor Seri aktif saat ini per 1 kemasan (misal "57", "AL 1")
  previousSerialNumber?: string; // Nomor Seri sebelum diganti saat masuk gulungan baru (misal "AK 1")
  serialHistory?: string[]; // Jejak perubahan nomor seri berurutan, misal ["AK 1", "AL 1"]
  transferHistory?: SerialTransferRecord[]; // Riwayat perpindahan gulungan / pabrik & pergantian seri
  mixtureBatchId?: string;
  packageIndex?: number;
  totalPackagesInMixture?: number;
  recipeName: string; // Opsional: Catatan / Label Campuran
  targetFactoryId?: string;
  targetFactory: string; // Pabrik tujuan (misal "CELLO MUNTILAN")
  createdAt: string;

  // Komposisi Bahan
  ingredients: BlendIngredient[];
  totalBlendNetKg: number; // Netto tembakau fisik (riil) pada kemasan seri ini (kg)

  // 5 Nilai Sensoris Campuran (Skala /5)
  weightedPower: number;
  weightedImpact: number;
  weightedBitter: number;
  weightedBurn: number;
  weightedSugar: number;
  compositeColorGrade: TobaccoGrade;

  // Biaya & HPP
  totalMaterialCost: number;
  additionalCosts: AdditionalCostItem[];
  totalOverheadCost: number; // Termasuk Harga Kemasan + Ongkos Press seri ini
  totalProductionCost: number; // Modal Asal / Total HPP seri ini
  hppPerNetKg: number; // Modal / KG campuran
  effectiveHppAfterTaraPerKg?: number;

  // Spesifikasi Packaging, Setor Pabrik & Weight Profit / Loss Pabrik
  packaging: PackagingSpec;
  factoryDeductionKg: number; // Potongan Tarra Pabrik (kg) eksklusif seri ini
  factoryNetBillableKg: number; // Netto Tagih Pabrik = Bruto - Potongan Tarra Pabrik (kg)
  factoryWeightProfitKg?: number; // Selisih Timbangan Pabrik = Netto Tagih Pabrik - Netto Riil Tembakau (= Berat Wadah Riil - Potongan Tarra Pabrik)
  factoryWeightProfitRp?: number; // Nilai Untung/Rugi Timbangan Pabrik (Rp) = factoryWeightProfitKg * factoryTargetPricePerKg
  buyWeightProfitRp?: number; // Untung timbangan dari saat pembelian bahan mentah untuk seri ini (Rp)
  factoryTargetPricePerKg: number; // Harga Nota Pabrik / Repricing per KG (Rp/kg)
  projectedRevenue: number; // Jumlah Nota Pabrik = Netto Tagih * Harga Pabrik
  projectedProfit: number;
  profitMarginPercent: number;

  // Status Pabrik & Riwayat Reject (Diterima Cair vs Reject Masuk Stok Tembakau Jadi)
  factoryStatus?: SerialFactoryStatus; // 'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK'
  previousRollId?: string; // ID gulungan sebelum di-reject
  previousRollNumber?: string; // Kode gulungan sebelum di-reject (misal "GUL-2026-001")
  previousFactory?: string; // Pabrik yang me-reject sebelum dipindah ke gulungan baru
  rejectedAt?: string;
  rejectionNotes?: string;

  // Hubungan ke Gulungan Sampel
  rollId: string;
  rollNumber?: string;
  rollRackNumber?: string;
  notes?: string;
}

export interface TobaccoRollSample {
  id: string;
  rollNumber: string; // e.g. "GUL-2026-001"
  rackLocation: string;
  finishedTobaccoId?: string;
  serialNumbers?: string[];
  serialNumber: string;
  recipeName: string; // Label gulungan (misal "CELLO MUNTILAN")
  targetFactory: string;
  sampleCreatedDate: string;
  sampleWeightGrams: number;

  // Salinan campuran lengkap untuk arsip
  ingredientsSnapshot: BlendIngredient[];
  ratingsSnapshot: {
    power: number; // /5
    impact: number; // /5
    bitter: number; // /5
    burn: number; // /5
    sugar: number; // /5
    colorGrade: TobaccoGrade;
    hppPerKg: number;
  };

  // Hasil Uji Hisap / Smoking Test dari Grader Pabrik (Skala /5)
  smokingTest?: {
    testDate?: string;
    testerName?: string;
    aromaScore?: number; // /5
    smoothnessScore?: number; // /5
    ashQuality?: 'Putih Bersih' | 'Abu Terang' | 'Abu Sedang' | 'Hitam/Kotor';
    burnRate?: 'Sempurna' | 'Cepat' | 'Lambat';
    tastingNotes?: string;
    factoryVerdict?: 'Diterima Penuh' | 'Diterima Bersyarat' | 'Minta Ubah Komposisi' | 'Ditolak';
  };
}

export interface PackageDraftItem {
  serialNumber: string;
  packagingId: string;
  packagingType: string;
  packagingMassKg: number;
  packagingCostRp: number; // Harga Kemasan (Rp)
  pressCostRp: number; // Ongkos Packaging / Press (Rp)
  netWeightKg: number;
  brutoWeightKg: number;
  targetFactoryId: string;
  targetFactoryName: string;
  taraPercent: number;
  taraFlatKg: number;
  sampleDeductionKg: number;
  rollId: string;
  targetPricePerKg: number;
  grade?: TobaccoGrade;
}

export interface SaveFinishedDraft {
  recipeName: string;
  packageCount: number;
  packages: PackageDraftItem[];
  blendNotes: string;
}
