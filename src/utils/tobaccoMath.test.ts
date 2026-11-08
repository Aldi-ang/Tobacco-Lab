import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTaraFormula,
  formatTaraFormula,
  calculateTaraDeduction,
  calculateRawTobaccoCost,
  calculateBlendMetrics,
  calculateFactoryDelivery,
  buildGoogleSheetText,
  buildFinishedBatchSyncCsv,
} from './tobaccoMath';
import { BlendIngredient, FinishedTobaccoSerial } from '../types/tobacco';

test('parseTaraFormula and formatTaraFormula support flat tara, percent+flat, and sample deduction', () => {
  const flatOnly = parseTaraFormula('3 kg');
  assert.equal(flatOnly.percent, 0);
  assert.equal(flatOnly.flatKg, 3);
  assert.equal(flatOnly.sampleKg, 0);

  const combo = parseTaraFormula('20% + 2');
  assert.equal(combo.percent, 20);
  assert.equal(combo.flatKg, 2);
  assert.equal(combo.sampleKg, 0);

  const withSample = parseTaraFormula('10% + 2 + 2');
  assert.equal(withSample.percent, 10);
  assert.equal(withSample.flatKg, 2);
  assert.equal(withSample.sampleKg, 2);

  assert.equal(formatTaraFormula(10, 2, 2), '10% + 2 kg + 2 kg Sampel');
  assert.equal(formatTaraFormula(0, 3, 0), '3 kg');
});

test('calculateRawTobaccoCost computes Netto = Bruto - Tarra and Modal Asal = Price * Netto', () => {
  // Bruto 55kg, Tarra eksklusif 3kg -> Netto = 52kg
  // Harga 100,000/kg -> Modal Asal = 52 * 100,000 = Rp 5,200,000
  const netPurchase = calculateRawTobaccoCost({
    grossWeightKg: 55,
    pricePerKgPurchase: 100000,
    taraFormula: {
      rawFormula: '3 kg',
      percent: 0,
      flatKg: 3,
      pricingBasis: 'NET_WEIGHT',
    },
    additionalCost: 0,
  });

  assert.equal(netPurchase.deductionKg, 3);
  assert.equal(netPurchase.netWeightKg, 52);
  assert.equal(netPurchase.totalModalAsal, 5200000);
  assert.equal(netPurchase.totalInvoiceCost, 5200000);
  assert.equal(netPurchase.realCostPerNetKg, 100000);
});

test('calculateBlendMetrics aggregates 5 sensory ratings on /5 maximum scale and HPP including per-seri packaging & press costs', () => {
  const ingredients: BlendIngredient[] = [
    {
      tobaccoId: '1',
      tobaccoName: 'Temanggung Srintil',
      origin: 'Temanggung',
      usedNetKg: 50,
      percentageInBlend: 0,
      realCostPerNetKg: 80000,
      subtotalCost: 0,
      powerRating: 4.5,
      impactRating: 4.0,
      bitterRating: 2.5,
      burnRating: 4.5,
      sugarRating: 4.0,
      colorGrade: 'A',
    },
    {
      tobaccoId: '2',
      tobaccoName: 'Muntilan Garangan',
      origin: 'Muntilan',
      usedNetKg: 50,
      percentageInBlend: 0,
      realCostPerNetKg: 60000,
      subtotalCost: 0,
      powerRating: 3.5,
      impactRating: 3.0,
      bitterRating: 3.5,
      burnRating: 4.5,
      sugarRating: 3.0,
      colorGrade: 'B',
    },
  ];

  // Overhead from 2 Seri of KRJ MUNTILAN (Kemasan 35,000 + Press 15,000 = 50,000 per seri -> 100,000 total)
  const metrics = calculateBlendMetrics({
    ingredients,
    additionalCosts: [{ id: 'pkg-all', name: 'Biaya Kemasan & Press (2 Seri)', amount: 100000 }],
  });

  assert.equal(metrics.totalBlendNetKg, 100);
  assert.equal(metrics.totalMaterialCost, 7000000);
  assert.equal(metrics.totalOverheadCost, 100000);
  assert.equal(metrics.totalProductionCost, 7100000);
  assert.equal(metrics.hppPerNetKg, 71000);
  assert.equal(metrics.weightedPower, 4.0);
  assert.equal(metrics.weightedImpact, 3.5);
  assert.equal(metrics.weightedBitter, 3.0);
  assert.equal(metrics.weightedBurn, 4.5);
  assert.equal(metrics.weightedSugar, 3.5);
});

test('buildGoogleSheetText formats columns and totals matching the Google Sheet screenshot', () => {
  const sampleSerial: FinishedTobaccoSerial = {
    id: 's-57',
    serialNumber: '57',
    recipeName: 'CELLO MUNTILAN',
    targetFactory: 'CELLO MUNTILAN',
    createdAt: '2026-11-03',
    ingredients: [],
    totalBlendNetKg: 52,
    weightedPower: 4.2,
    weightedImpact: 4.0,
    weightedBitter: 2.5,
    weightedBurn: 4.5,
    weightedSugar: 4.0,
    compositeColorGrade: 'E',
    totalMaterialCost: 5200000,
    additionalCosts: [],
    totalOverheadCost: 50000,
    totalProductionCost: 5250000,
    hppPerNetKg: 100962,
    effectiveHppAfterTaraPerKg: 100962,
    packaging: {
      packagingType: 'KRJ MUNTILAN',
      packagingMassKg: 3,
      packageCount: 1,
      netTobaccoWeightKg: 52,
      grossWeightPerPackage: 55,
      factoryTaraFormula: {
        rawFormula: '3 kg',
        percent: 0,
        flatKg: 3,
        pricingBasis: 'NET_WEIGHT',
      },
    },
    factoryDeductionKg: 3,
    factoryNetBillableKg: 52,
    factoryTargetPricePerKg: 140000,
    projectedRevenue: 7280000,
    projectedProfit: 2030000,
    profitMarginPercent: 27.88,
    rollId: 'gul-1',
    rollNumber: 'GUL-2026-001',
    factoryStatus: 'ACCEPTED_CAIR',
  };

  const tsv = buildGoogleSheetText({
    dateLabel: '3 November 2026',
    headerTitle: 'CELLO MUNTILAN',
    serials: [sampleSerial],
    mode: 'FACTORY_NOTA',
    separator: '\t',
  });

  const lines = tsv.split('\n');
  assert.equal(lines[0].startsWith('TANGGAL\t3 November 2026\tCELLO MUNTILAN'), true);
  assert.equal(lines[2], 'NO\tSERI\tBRUTO\tTARA\tNETTO\tPACKAGING\tGRADE\tHARGA\tJUMLAH');
  assert.equal(lines[3], '1\t57\t55\t3\t52\tKRJ MUNTILAN\tE\tRp140,000\tRp7,280,000');
  assert.equal(lines[4], '\t\t55\t3\t52\t\t\t\tRp7,280,000');

  // Verify Internal Personal Archive Sheet includes HARGA PABRIK, JUMLAH PABRIK, and PROFIT per Seri
  const internalTsv = buildGoogleSheetText({
    dateLabel: '3 November 2026',
    headerTitle: 'CELLO MUNTILAN',
    serials: [sampleSerial],
    mode: 'INTERNAL_COST',
    separator: '\t',
  });
  const internalLines = internalTsv.split('\n');
  assert.equal(
    internalLines[2],
    'NO\tSERI\tBRUTO\tTARA\tNETTO\tPACKAGING\tGRADE\tHARGA MODAL\tJUMLAH MODAL\tHARGA PABRIK\tJUMLAH PABRIK\tPROFIT'
  );
  // 52 * 100,962 = 5,250,024; 7,280,000 - 5,250,024 = 2,029,976
  assert.equal(internalLines[3].includes('Rp140,000'), true);
  assert.equal(internalLines[3].includes('Rp7,280,000'), true);
  assert.equal(internalLines[3].includes('Rp2,029,976'), true);

  // Verify CSV synchronization structure with production cost & billable price columns
  const syncCsv = buildFinishedBatchSyncCsv({
    batches: [sampleSerial],
    separator: ',',
  });
  const csvLines = syncCsv.split('\n');
  assert.equal(
    csvLines[0],
    'NO,SERI,TANGGAL,PABRIK TUJUAN,GULUNGAN,PACKAGING,GRADE,BRUTO (KG),TARA (KG),NETTO (KG),MODAL PRODUKSI / KG,TOTAL MODAL PRODUKSI,HARGA TAGIH / KG,TOTAL TAGIHAN NOTA,PROFIT BERSIH,STATUS PABRIK'
  );
  assert.equal(csvLines[1].includes('"Rp100,962"'), true);
  assert.equal(csvLines[1].includes('"Rp5,250,000"'), true);
  assert.equal(csvLines[1].includes('"Rp140,000"'), true);
  assert.equal(csvLines[1].includes('"Rp7,280,000"'), true);
  assert.equal(csvLines[2].startsWith('TOTAL,1 SERI'), true);
});

test('Case Study 1 (Buy-Side Weight Profit): Karung Goni 2kg real mass with 10% + 2kg potongan on 50kg Bruto yields 43kg Paid vs 48kg Real (+5kg Weight Profit)', () => {
  const goniPurchase = calculateRawTobaccoCost({
    grossWeightKg: 50,
    pricePerKgPurchase: 70000,
    realPackagingMassKg: 2, // Karung goni riil hanya 2 kg
    taraFormula: {
      rawFormula: '10% + 2 kg',
      percent: 10,
      flatKg: 2,
      pricingBasis: 'NET_WEIGHT',
      packagingType: 'BALL GONI PRESS',
      packagingMassKg: 2,
    },
  });

  // Potongan Nota = 10% of 50 (5 kg) + 2 kg = 7 kg -> Netto Bayar = 43 kg
  assert.equal(goniPurchase.deductionKg, 7);
  assert.equal(goniPurchase.netWeightKg, 43);
  assert.equal(goniPurchase.totalModalAsal, 43 * 70000); // Rp 3,010,000 Paid Value

  // Berat Riil = 50 kg - 2 kg Goni = 48 kg -> Real Value = 48 * 70,000 = Rp 3,360,000
  assert.equal(goniPurchase.realNetWeightKg, 48);
  assert.equal(goniPurchase.realStockValueRp, 48 * 70000);

  // Weight Profit = +5 kg (+Rp 350,000) before even sending sample to factory!
  assert.equal(goniPurchase.purchaseWeightProfitKg, 5);
  assert.equal(goniPurchase.purchaseWeightProfitRp, 350000);
  // Effective cost per real kg = 3,010,000 / 48 = 62,708.33
  assert.equal(goniPurchase.effectiveCostPerRealKg, 62708.33);
});

test('Case Study 2 & 3 (Factory-Side Weight Profit & Loss): 3kg real packaging with 2kg factory potongan (+1kg gain) vs 6kg Keranjang Muntilan with 10%+2 potongan on 50kg (-1kg loss)', () => {
  // Case Study 2: Real packaging 3kg, 48kg real tobacco (Bruto 51kg), Factory potongan 2kg -> Billable 49kg (+1kg gain)
  const factoryGain = calculateFactoryDelivery({
    packaging: {
      packagingType: 'KRJ MUNTILAN',
      packagingMassKg: 3, // Real packaging weight = 3 kg
      packageCount: 1,
      netTobaccoWeightKg: 48, // Real tobacco weight = 48 kg
      grossWeightPerPackage: 51,
      factoryTaraFormula: {
        rawFormula: '2 kg',
        percent: 0,
        flatKg: 2, // Factory only deducts 2 kg
        pricingBasis: 'NET_WEIGHT',
      },
    },
    hppPerNetKg: 80000,
    totalProductionCost: 3840000,
    factoryTargetPricePerKg: 120000,
  });

  assert.equal(factoryGain.factoryDeductionKg, 2);
  assert.equal(factoryGain.factoryNetBillableKg, 49);
  assert.equal(factoryGain.realTobaccoNetTotalKg, 48);
  assert.equal(factoryGain.factoryWeightProfitKg, 1); // +1 kg gained from packaging weight!
  assert.equal(factoryGain.factoryWeightProfitRp, 120000);

  // Case Study 3: Bruto 50kg, Real Keranjang Muntilan weight 6kg (Real tobacco = 44kg), Factory potongan 10% + 2 = 7kg -> Billable 43kg (-1kg loss)
  const factoryLoss = calculateFactoryDelivery({
    packaging: {
      packagingType: 'KRJ MUNTILAN TEBAL',
      packagingMassKg: 6, // Real basket weight = 6 kg
      packageCount: 1,
      netTobaccoWeightKg: 44, // Real tobacco inside = 50 - 6 = 44 kg
      grossWeightPerPackage: 50,
      factoryTaraFormula: {
        rawFormula: '10% + 2 kg',
        percent: 10,
        flatKg: 2, // 10% of 50 (5kg) + 2kg = 7kg deduction
        pricingBasis: 'NET_WEIGHT',
      },
    },
    hppPerNetKg: 80000,
    totalProductionCost: 3520000,
    factoryTargetPricePerKg: 120000,
  });

  assert.equal(factoryLoss.factoryDeductionKg, 7);
  assert.equal(factoryLoss.factoryNetBillableKg, 43);
  assert.equal(factoryLoss.realTobaccoNetTotalKg, 44);
  assert.equal(factoryLoss.factoryWeightProfitKg, -1); // -1 kg loss of tobacco value!
  assert.equal(factoryLoss.factoryWeightProfitRp, -120000);
});


