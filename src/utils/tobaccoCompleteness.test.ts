import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQuickPatchToRawTobacco,
  computeRadialWheelNodes,
  getNextFocusFieldId,
  getRawTobaccoMissingFlags,
  getSerialMissingFlags,
  resolveRadialOptionByVector,
} from './tobaccoCompleteness';
import { FinishedTobaccoSerial, PackagingMaster, RawTobacco } from '../types/tobacco';

const SAMPLE_PACKAGING: PackagingMaster[] = [
  {
    id: 'pkg-krj',
    name: 'KRJ MUNTILAN',
    packagingMassKg: 3,
    taraPercent: 0,
    taraFlatKg: 3,
    packagingCostRp: 35000,
    pressCostRp: 15000,
  },
  {
    id: 'pkg-bal',
    name: 'BALL GONI',
    packagingMassKg: 2,
    taraPercent: 10,
    taraFlatKg: 2,
    packagingCostRp: 25000,
    pressCostRp: 10000,
  },
];

function makeBaseRaw(overrides: Partial<RawTobacco> = {}): RawTobacco {
  return {
    id: 'raw-1',
    name: 'Wetan Kali',
    origin: 'Muntilan',
    sellerName: 'Pak Budi',
    lotNumber: 'LOT-01',
    purchaseDate: '2026-11-12',
    grossWeightKg: 0,
    packagingMassKg: 3,
    pricePerKgPurchase: 0,
    taraFormula: {
      rawFormula: '3 kg',
      percent: 0,
      flatKg: 3,
      pricingBasis: 'NET_WEIGHT',
      packagingType: 'KRJ MUNTILAN',
      packagingMassKg: 3,
      sellerName: 'Pak Budi',
    },
    additionalPurchaseCost: 0,
    deductionKg: 0,
    netWeightKg: 0,
    realCostPerNetKg: 0,
    currentStockNetKg: 0,
    powerRating: 4.0,
    impactRating: 3.5,
    bitterRating: 2.0,
    burnRating: 4.5,
    sugarRating: 3.5,
    aromaRating: 4.0,
    colorGrade: 'D+',
    characterNotes: '',
    ...overrides,
  };
}

test('getRawTobaccoMissingFlags detects timbangan & harga menyusul accurately', () => {
  const gradingOnly = makeBaseRaw({ grossWeightKg: 0, pricePerKgPurchase: 0 });
  const flags = getRawTobaccoMissingFlags(gradingOnly);

  assert.equal(flags.missingWeight, true);
  assert.equal(flags.missingPrice, true);
  assert.equal(flags.missingSeller, false);
  assert.equal(flags.missingPackaging, false);
  assert.equal(flags.missingOrigin, false);
  assert.equal(flags.missingAttributes, false);
  assert.deepEqual(flags.missingLabels, ['Timbangan', 'Harga']);
  assert.equal(flags.isIncomplete, true);
});

test('getRawTobaccoMissingFlags flags all-zero attributes and blank seller/kemasan', () => {
  const bare = makeBaseRaw({
    sellerName: '',
    origin: 'Belum Diisi',
    powerRating: 0,
    impactRating: 0,
    bitterRating: 0,
    burnRating: 0,
    sugarRating: 0,
    aromaRating: 0,
    taraFormula: {
      rawFormula: '0 kg',
      percent: 0,
      flatKg: 0,
      pricingBasis: 'NET_WEIGHT',
      packagingType: 'Belum Dipilih',
    },
  });
  const flags = getRawTobaccoMissingFlags(bare);
  assert.equal(flags.missingSeller, true);
  assert.equal(flags.missingOrigin, true);
  assert.equal(flags.missingPackaging, true);
  assert.equal(flags.missingAttributes, true);
  assert.equal(flags.unfilledAttributeCount, 6);
});

test('applyQuickPatchToRawTobacco recalculates netto, modal, stock, and profit after late weight & price', () => {
  const initial = makeBaseRaw({ grossWeightKg: 0, pricePerKgPurchase: 0 });
  const afterWeight = applyQuickPatchToRawTobacco(
    initial,
    { grossWeightKg: 53 },
    SAMPLE_PACKAGING
  );

  assert.equal(afterWeight.netWeightKg, 50);
  assert.equal(afterWeight.realNetWeightKg, 50);
  assert.equal(afterWeight.currentStockNetKg, 50);
  assert.equal(afterWeight.totalModalAsal, 0);
  assert.equal(getRawTobaccoMissingFlags(afterWeight).missingWeight, false);
  assert.equal(getRawTobaccoMissingFlags(afterWeight).missingPrice, true);

  const afterPrice = applyQuickPatchToRawTobacco(
    afterWeight,
    { pricePerKgPurchase: 80000 },
    SAMPLE_PACKAGING
  );
  assert.equal(afterPrice.totalModalAsal, 4000000);
  assert.equal(afterPrice.realCostPerNetKg, 80000);
  assert.equal(getRawTobaccoMissingFlags(afterPrice).isIncomplete, false);
});

test('applyQuickPatchToRawTobacco switches packaging preset & preserves consumed kg', () => {
  const initial = applyQuickPatchToRawTobacco(
    makeBaseRaw(),
    { grossWeightKg: 53, pricePerKgPurchase: 100000 },
    SAMPLE_PACKAGING
  );
  const partiallyUsed: RawTobacco = {
    ...initial,
    currentStockNetKg: 40, // 10 kg used out of 50 realNet
  };

  const updated = applyQuickPatchToRawTobacco(
    partiallyUsed,
    { packagingType: 'BALL GONI', grossWeightKg: 50 },
    SAMPLE_PACKAGING
  );
  // BALL GONI has 10% + 2kg tarra on 50kg => 5 + 2 = 7kg tarra => netWeight = 43kg
  // realPkgMass = 2kg => realNet = 48kg; consumed 10kg => stock = 38kg
  assert.equal(updated.deductionKg, 7);
  assert.equal(updated.netWeightKg, 43);
  assert.equal(updated.realNetWeightKg, 48);
  assert.equal(updated.currentStockNetKg, 38);
  assert.equal(updated.purchaseWeightProfitKg, 5);
  assert.equal(updated.purchaseWeightProfitRp, 500000);
});

test('getSerialMissingFlags flags missing factory price & missing weight', () => {
  const mockSerial = {
    id: 'ser-1',
    serialNumber: 'S1',
    recipeName: 'Test',
    targetFactory: 'CELLO',
    createdAt: '2026-11-12',
    ingredients: [],
    totalBlendNetKg: 0,
    weightedPower: 4,
    weightedImpact: 4,
    weightedBitter: 3,
    weightedBurn: 4,
    weightedSugar: 3,
    weightedAroma: 4,
    compositeColorGrade: 'D',
    totalMaterialCost: 0,
    additionalCosts: [],
    totalOverheadCost: 0,
    totalProductionCost: 0,
    hppPerNetKg: 0,
    packaging: {
      packagingType: 'KRJ MUNTILAN',
      packagingMassKg: 3,
      packageCount: 1,
      netTobaccoWeightKg: 0,
      grossWeightPerPackage: 0,
      factoryTaraFormula: {
        rawFormula: '3 kg',
        percent: 0,
        flatKg: 3,
        pricingBasis: 'NET_WEIGHT',
      },
    },
    factoryDeductionKg: 3,
    factoryNetBillableKg: 0,
    factoryTargetPricePerKg: 0,
    projectedRevenue: 0,
    projectedProfit: 0,
    profitMarginPercent: 0,
    rollId: 'r1',
  } as FinishedTobaccoSerial;

  const flags = getSerialMissingFlags(mockSerial);
  assert.equal(flags.missingFactoryPrice, true);
  assert.equal(flags.missingWeight, true);
  assert.equal(flags.missingAttributes, false);
  assert.deepEqual(flags.missingLabels, ['Harga Pabrik', 'Timbangan']);
});

test('getNextFocusFieldId advances sequentially and skips locked fields', () => {
  const order = ['seller', 'name', 'origin', 'packaging', 'gross', 'price'] as const;
  assert.equal(getNextFocusFieldId(order, 'seller'), 'name');
  assert.equal(
    getNextFocusFieldId(order, 'origin', (id) => id === 'packaging'),
    'gross'
  );
  assert.equal(getNextFocusFieldId(order, 'price'), null);
});

test('computeRadialWheelNodes places options in a circle starting at 12 oclock', () => {
  const ids = ['timbangan', 'harga', 'grade_attr', 'info', 'full'];
  const nodes = computeRadialWheelNodes(ids, 90);
  assert.equal(nodes.length, 5);
  // First option at 12 o'clock (offsetX = 0, offsetY = -90)
  assert.equal(nodes[0].offsetX, 0);
  assert.equal(nodes[0].offsetY, -90);
  // Second option in upper-right quadrant (offsetX > 0, offsetY < 0)
  assert.ok(nodes[1].offsetX > 70);
  assert.ok(nodes[1].offsetY < -20);
});

test('resolveRadialOptionByVector detects short directional drag from wheel center', () => {
  const ids = ['timbangan', 'harga', 'grade_attr', 'info', 'full'];
  // Inside 24px deadzone -> null
  assert.equal(
    resolveRadialOptionByVector({
      clientX: 200,
      clientY: 190,
      centerX: 200,
      centerY: 200,
      optionIds: ids,
    }),
    null
  );
  // Short 35px drag straight up -> 'timbangan' (12 o'clock)
  assert.equal(
    resolveRadialOptionByVector({
      clientX: 200,
      clientY: 165,
      centerX: 200,
      centerY: 200,
      optionIds: ids,
    }),
    'timbangan'
  );
  // Short 40px drag up-right (~72 deg clockwise from top) -> 'harga'
  assert.equal(
    resolveRadialOptionByVector({
      clientX: 238,
      clientY: 188,
      centerX: 200,
      centerY: 200,
      optionIds: ids,
    }),
    'harga'
  );
  // Short 40px drag up-left -> 'full'
  assert.equal(
    resolveRadialOptionByVector({
      clientX: 162,
      clientY: 188,
      centerX: 200,
      centerY: 200,
      optionIds: ids,
    }),
    'full'
  );
});

