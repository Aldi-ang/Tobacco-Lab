import test from 'node:test';
import assert from 'node:assert/strict';
import { getRollStatusSummary, partitionShippedRolls } from './factoryStatusFlow';
import { FinishedTobaccoSerial, TobaccoRollSample } from '../types/tobacco';

const makeRoll = (id: string, isSentToFactory = true): TobaccoRollSample =>
  ({
    id,
    rollNumber: `GUL-2026-${id}`,
    rackLocation: 'RAK-A',
    serialNumber: '1',
    recipeName: 'TEST',
    targetFactory: 'PT A',
    sampleCreatedDate: '2026-01-01',
    sampleWeightGrams: 1000,
    isSentToFactory,
    ingredientsSnapshot: [],
    ratingsSnapshot: {
      power: 3,
      impact: 3,
      bitter: 1,
      burn: 4,
      sugar: 3,
      colorGrade: 'B',
      hppPerKg: 50000,
    },
  } as TobaccoRollSample);

const makeSerial = (
  id: string,
  rollId: string,
  factoryStatus?: 'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK',
  paymentStatus?: 'CAIR' | 'BELUM_CAIR'
): FinishedTobaccoSerial =>
  ({
    id,
    serialNumber: id,
    rollId,
    recipeName: 'TEST',
    targetFactory: 'PT A',
    createdAt: '2026-01-01',
    ingredients: [],
    totalBlendNetKg: 20,
    weightedPower: 3,
    weightedImpact: 3,
    weightedBitter: 1,
    weightedBurn: 4,
    weightedSugar: 3,
    compositeColorGrade: 'B',
    totalMaterialCost: 1000000,
    additionalCosts: [],
    totalOverheadCost: 0,
    totalProductionCost: 1000000,
    hppPerNetKg: 50000,
    packaging: {
      packagingType: 'KRJ',
      packagingMassKg: 2,
      packageCount: 1,
      netTobaccoWeightKg: 20,
      grossWeightPerPackage: 22,
      factoryTaraFormula: { rawFormula: '2 kg', percent: 0, flatKg: 2, pricingBasis: 'NET_WEIGHT' },
    },
    factoryDeductionKg: 2,
    factoryNetBillableKg: 20,
    factoryTargetPricePerKg: 70000,
    projectedRevenue: 1400000,
    projectedProfit: 400000,
    profitMarginPercent: 28.5,
    factoryStatus,
    paymentStatus,
  } as FinishedTobaccoSerial);

test('getRollStatusSummary counts pending, accepted, cair, and rejected accurately', () => {
  const roll = makeRoll('1', true);
  const serials = [
    makeSerial('S1', '1', 'PENDING'),
    makeSerial('S2', '1', 'ACCEPTED_CAIR', 'CAIR'),
    makeSerial('S3', '1', 'ACCEPTED_CAIR', 'BELUM_CAIR'),
    makeSerial('S4', '1', 'REJECTED_STOCK'),
  ];

  const summary = getRollStatusSummary(roll, serials);
  assert.equal(summary.totalSerials, 4);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.acceptedCount, 2);
  assert.equal(summary.cairCount, 1);
  assert.equal(summary.belumCairCount, 1);
  assert.equal(summary.rejectedCount, 1);
  assert.equal(summary.isFullyResolved, false);
});

test('partitionShippedRolls moves roll to completedShippedRolls only when all serials are resolved', () => {
  const rPending = makeRoll('1', true);
  const rCompleted = makeRoll('2', true);
  const rWarehouse = makeRoll('3', false);
  const rEmptyShipped = makeRoll('4', true);

  const serials = [
    makeSerial('S1', '1', 'PENDING'),
    makeSerial('S2', '1', 'ACCEPTED_CAIR', 'CAIR'),
    makeSerial('S3', '2', 'ACCEPTED_CAIR', 'BELUM_CAIR'),
    makeSerial('S4', '2', 'REJECTED_STOCK'),
    makeSerial('S5', '3', 'PENDING'),
  ];

  const { activePendingRolls, completedShippedRolls } = partitionShippedRolls(
    [rPending, rCompleted, rWarehouse, rEmptyShipped],
    serials
  );

  assert.deepEqual(
    activePendingRolls.map((r) => r.id),
    ['1', '4']
  );
  assert.deepEqual(
    completedShippedRolls.map((r) => r.id),
    ['2']
  );
});

test('marking the last pending serial as ACCEPTED_CAIR automatically moves roll along pipeline', () => {
  const roll = makeRoll('10', true);
  const before = [makeSerial('S1', '10', 'PENDING'), makeSerial('S2', '10', 'ACCEPTED_CAIR', 'CAIR')];
  assert.equal(partitionShippedRolls([roll], before).activePendingRolls.length, 1);

  const after = [
    makeSerial('S1', '10', 'ACCEPTED_CAIR', 'BELUM_CAIR'),
    makeSerial('S2', '10', 'ACCEPTED_CAIR', 'CAIR'),
  ];
  const resAfter = partitionShippedRolls([roll], after);
  assert.equal(resAfter.activePendingRolls.length, 0);
  assert.equal(resAfter.completedShippedRolls.length, 1);
});
