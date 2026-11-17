import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRollCompactStats,
  groupRollsIntoFolders,
  isSerialDecisionLocked,
} from './rollGrouping';
import { FinishedTobaccoSerial, TobaccoRollSample } from '../types/tobacco';

const makeRoll = (id: string, rollNumber: string, factory: string, dateIso: string): TobaccoRollSample => ({
  id,
  rollNumber,
  rackLocation: 'RAK-A1',
  serialNumber: `${rollNumber}-S1`,
  recipeName: `Racikan ${rollNumber}`,
  targetFactory: factory,
  sampleCreatedDate: dateIso,
  sampleWeightGrams: 500,
  sentToFactoryDate: dateIso,
  isSentToFactory: true,
  ingredientsSnapshot: [],
  ratingsSnapshot: {
    power: 3.5,
    impact: 3.5,
    bitter: 2.5,
    burn: 4,
    sugar: 4,
    aroma: 4,
    colorGrade: 'D',
    hppPerKg: 80000,
  },
});

const makeSerial = (
  id: string,
  rollId: string,
  rollNumber: string,
  status: 'PENDING' | 'ACCEPTED_CAIR' | 'REJECTED_STOCK'
): FinishedTobaccoSerial => ({
  id,
  serialNumber: id.toUpperCase(),
  rollId,
  rollNumber,
  recipeName: `Racikan ${rollNumber}`,
  targetFactory: 'CELLO',
  createdAt: '2026-11-15T10:00:00.000Z',
  ingredients: [],
  totalBlendNetKg: 50,
  compositeColorGrade: 'D',
  weightedPower: 3.5,
  weightedImpact: 3.5,
  weightedBitter: 2.5,
  weightedBurn: 4.0,
  weightedSugar: 4.0,
  weightedAroma: 4.0,
  totalMaterialCost: 4000000,
  additionalCosts: [],
  totalOverheadCost: 15000,
  totalProductionCost: 4000000,
  hppPerNetKg: 80000,
  effectiveHppAfterTaraPerKg: 80000,
  factoryDeductionKg: 2,
  factoryNetBillableKg: 50,
  factoryTargetPricePerKg: 100000,
  projectedRevenue: 5000000,
  projectedProfit: 1000000,
  profitMarginPercent: 20,
  packaging: {
    packagingType: 'KERANJANG MUNTILAN',
    packagingMassKg: 2,
    packageCount: 1,
    netTobaccoWeightKg: 50,
    grossWeightPerPackage: 52,
    packagingCostRp: 15000,
    factoryTaraFormula: {
      rawFormula: '2 kg',
      percent: 0,
      flatKg: 2,
      pricingBasis: 'NET_WEIGHT',
    },
  },
  factoryStatus: status,
});

test('isSerialDecisionLocked keeps PENDING unlocked and locks ACCEPTED/REJECTED unless unlocked manually', () => {
  assert.equal(isSerialDecisionLocked('PENDING', {}, 's1'), false);
  assert.equal(isSerialDecisionLocked(undefined, {}, 's1'), false);
  assert.equal(isSerialDecisionLocked('ACCEPTED_CAIR', {}, 's1'), true);
  assert.equal(isSerialDecisionLocked('REJECTED_STOCK', {}, 's1'), true);
  assert.equal(isSerialDecisionLocked('ACCEPTED_CAIR', { s1: true }, 's1'), false);
  assert.equal(isSerialDecisionLocked('REJECTED_STOCK', { s1: true }, 's1'), false);
});

test('groupRollsIntoFolders groups multiple rolls per day into newest-first folders with aggregated stats', () => {
  const rolls = [
    makeRoll('r1', 'GUL-01', 'CELLO', '2026-11-14T08:00:00.000Z'),
    makeRoll('r2', 'GUL-02', 'DJARUM', '2026-11-15T09:00:00.000Z'),
    makeRoll('r3', 'GUL-03', 'CELLO', '2026-11-15T14:00:00.000Z'),
  ];
  const serials = [
    makeSerial('s1', 'r1', 'GUL-01', 'ACCEPTED_CAIR'),
    makeSerial('s2', 'r2', 'GUL-02', 'ACCEPTED_CAIR'),
    makeSerial('s3', 'r2', 'GUL-02', 'REJECTED_STOCK'),
    makeSerial('s4', 'r3', 'GUL-03', 'ACCEPTED_CAIR'),
  ];

  const byDate = groupRollsIntoFolders(rolls, serials, 'date');
  assert.equal(byDate.length, 2);
  assert.equal(byDate[0].folderKey, 'DATE::2026-11-15');
  assert.equal(byDate[0].rolls.length, 2);
  assert.equal(byDate[0].rolls[0].id, 'r3');
  assert.equal(byDate[0].stats.acceptedCount, 2);
  assert.equal(byDate[0].stats.rejectedCount, 1);
  // 2 accepted serials * 50kg = 100kg netto
  assert.equal(byDate[0].stats.totalNettoKg, 100);
  assert.equal(byDate[0].stats.totalNotaRp, 10000000);

  const byFactory = groupRollsIntoFolders(rolls, serials, 'factory');
  assert.equal(byFactory.length, 2);
  const celloFolder = byFactory.find((f) => f.folderLabel === 'CELLO');
  assert.ok(celloFolder);
  assert.equal(celloFolder.rolls.length, 2);
});

test('computeRollCompactStats excludes rejected serials from billable netto and nota', () => {
  const roll = makeRoll('r1', 'GUL-01', 'CELLO', '2026-11-15T10:00:00.000Z');
  const serials = [
    makeSerial('s1', 'r1', 'GUL-01', 'ACCEPTED_CAIR'),
    makeSerial('s2', 'r1', 'GUL-01', 'REJECTED_STOCK'),
  ];
  const stats = computeRollCompactStats(roll, serials);
  assert.equal(stats.totalSerials, 2);
  assert.equal(stats.acceptedCount, 1);
  assert.equal(stats.rejectedCount, 1);
  assert.equal(stats.totalNettoKg, 50);
  assert.equal(stats.totalNotaRp, 5000000);
});
