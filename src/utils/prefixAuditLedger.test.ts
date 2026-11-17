import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrefixAuditGridBlock,
  buildPrefixAuditLedgers,
  detectPreviousPrefixHistory,
  evaluateReprintWarnings,
  isReprintSafetySatisfied,
  parseLotPrefixAndSeq,
} from './prefixAuditLedger';
import {
  PrefixRegistryState,
  registerNewPrefix,
  removeRegisteredPrefix,
} from './prefixRegistryEngine';
import { generateNextLotBatchNumbers } from './gradeCardEngine';
import { extractLotPrefixCode } from './thermalPrintEngine';
import { RawTobacco } from '../types/tobacco';

const makeStock = (id: string, lotNumber: string, name: string): RawTobacco => ({
  id,
  lotNumber,
  name,
  origin: 'Muntilan',
  purchaseDate: '2026-11-16',
  grossWeightKg: 50,
  packagingMassKg: 3,
  taraFormula: {
    rawFormula: '0% + 3 kg',
    percent: 0,
    flatKg: 3,
    pricingBasis: 'NET_WEIGHT',
    packagingType: 'KRJ MUNTILAN',
    packagingMassKg: 3,
  },
  deductionKg: 3,
  netWeightKg: 47,
  currentStockNetKg: 47,
  pricePerKgPurchase: 80000,
  totalAgentFeePerKg: 0,
  totalAgentFeeRp: 0,
  additionalPurchaseCost: 0,
  totalModalAsal: 3760000,
  realCostPerNetKg: 80000,
  realNetWeightKg: 47,
  realStockValueRp: 3760000,
  purchaseWeightProfitKg: 0,
  purchaseWeightProfitRp: 0,
  effectiveCostPerRealKg: 80000,
  powerRating: 3,
  impactRating: 3,
  bitterRating: 3,
  burnRating: 4,
  sugarRating: 3,
  aromaRating: 4,
  colorGrade: 'D',
  characterNotes: '',
  graderName: 'Pak Slamet',
});

test('parseLotPrefixAndSeq parses custom, hyphenated, and daily lot codes accurately', () => {
  assert.deepEqual(parseLotPrefixAndSeq('MTL005', ['MTL']), {
    prefixKey: 'MTL',
    isAutoDaily: false,
    seq: 5,
  });
  assert.deepEqual(parseLotPrefixAndSeq('TMG-012', ['TMG-']), {
    prefixKey: 'TMG-',
    isAutoDaily: false,
    seq: 12,
  });
  assert.deepEqual(parseLotPrefixAndSeq('LOT-261116-009'), {
    prefixKey: 'LOT-261116-',
    isAutoDaily: true,
    seq: 9,
  });
});

test('buildPrefixAuditLedgers tracks Stock, Printed-Not-Stock, and Unprinted gaps AND preserves data when prefix is deleted', () => {
  const initialReg: PrefixRegistryState = {
    registeredPrefixes: ['MTL', 'TMG-'],
    lastSelectedPrefix: 'MTL',
    dismissedPrefixes: [],
    minStartSeqByPrefix: {},
  };

  // MTL has #1 (stock+printed), #2 (printed only), #3 (gap - never printed), #4 (printed only), #5 (stock without print log)
  const issuedPrintedLots = ['MTL001', 'MTL002', 'MTL004', 'TMG-001'];
  const rawTobaccos = [
    makeStock('s1', 'MTL001', 'Tembakau Muntilan Super'),
    makeStock('s2', 'MTL005', 'Tembakau Muntilan Manual'),
  ];

  // Delete MTL from quick list
  const afterDelete = removeRegisteredPrefix(initialReg, 'MTL');
  assert.deepEqual(afterDelete.registeredPrefixes, ['TMG-']);

  const ledgers = buildPrefixAuditLedgers({
    rawTobaccos,
    issuedPrintedLots,
    prefixRegistry: afterDelete,
  });

  // MTL ledger MUST STILL EXIST as archived deleted prefix with full non-editable audit statuses
  const mtlLedger = ledgers.find((l) => l.prefixKey === 'MTL');
  assert.ok(mtlLedger, 'Deleted prefix MTL must still keep its audit ledger');
  assert.equal(mtlLedger.isDeletedPrefix, true);
  assert.equal(mtlLedger.isActiveInQuickList, false);
  assert.equal(mtlLedger.stockRegisteredCount, 2); // MTL001, MTL005
  assert.equal(mtlLedger.printedNotStockCount, 2); // MTL002, MTL004
  assert.equal(mtlLedger.unprintedGapCount, 1); // MTL003
  assert.equal(mtlLedger.nextNewLot, 'MTL006');

  assert.deepEqual(
    mtlLedger.entries.map((e) => [e.lotCode, e.status, e.isPrinted, e.isRegisteredStock]),
    [
      ['MTL001', 'STOCK_REGISTERED', true, true],
      ['MTL002', 'PRINTED_NOT_STOCK', true, false],
      ['MTL003', 'NOT_PRINTED', false, false],
      ['MTL004', 'PRINTED_NOT_STOCK', true, false],
      ['MTL005', 'STOCK_REGISTERED', false, true],
    ]
  );
});

test('detectPreviousPrefixHistory detects deleted prefix and resumes sequence automatically upon re-add', () => {
  const reg: PrefixRegistryState = {
    registeredPrefixes: ['MTL'],
    lastSelectedPrefix: 'MTL',
    dismissedPrefixes: [],
    minStartSeqByPrefix: {},
  };

  const issuedPrintedLots = ['MTL001', 'MTL002', 'MTL003', 'MTL004', 'MTL005', 'MTL006'];
  const rawTobaccos = [makeStock('s1', 'MTL002', 'Muntilan D')];

  const deletedState = removeRegisteredPrefix(reg, 'MTL');
  const detection = detectPreviousPrefixHistory({
    rawPrefix: ' mtl ',
    rawTobaccos,
    issuedPrintedLots,
    prefixRegistry: deletedState,
  });

  assert.ok(detection);
  assert.equal(detection.hasPreviousData, true);
  assert.equal(detection.wasDeletedFromQuickList, true);
  assert.equal(detection.printedCount, 6);
  assert.equal(detection.stockCount, 1);
  assert.equal(detection.highestSeq, 6);
  assert.equal(detection.nextContinueSeq, 7);
  assert.equal(detection.nextContinueLot, 'MTL007');

  // Re-adding MTL restores it to active list and continues from MTL007 (never restarts at MTL001)
  const { nextState: readded } = registerNewPrefix(deletedState, 'MTL');
  assert.equal(readded.lastSelectedPrefix, 'MTL');
  assert.ok(readded.registeredPrefixes.includes('MTL'));
  assert.ok(!readded.dismissedPrefixes?.includes('MTL'));

  const nextBatch = generateNextLotBatchNumbers(rawTobaccos, 6, 'MTL', issuedPrintedLots, 1);
  assert.deepEqual(nextBatch, ['MTL007', 'MTL008', 'MTL009', 'MTL010', 'MTL011', 'MTL012']);
});

test('detectPreviousPrefixHistory preserves prior Lompat Nomor skip floor when deleted prefix had no printed lots yet', () => {
  const reg: PrefixRegistryState = {
    registeredPrefixes: ['WDS'],
    lastSelectedPrefix: 'WDS',
    dismissedPrefixes: [],
    minStartSeqByPrefix: { WDS: 19 },
  };
  const deleted = removeRegisteredPrefix(reg, 'WDS');
  const detection = detectPreviousPrefixHistory({
    rawPrefix: 'WDS',
    rawTobaccos: [],
    issuedPrintedLots: [],
    prefixRegistry: deleted,
  });
  assert.ok(detection);
  assert.equal(detection.hasPreviousData, true);
  assert.equal(detection.wasDeletedFromQuickList, true);
  assert.equal(detection.savedMinStartSeq, 19);
  assert.equal(detection.nextContinueSeq, 19);
  assert.equal(detection.nextContinueLot, 'WDS019');
});

test('evaluateReprintWarnings flags STOCK_REGISTERED and PRINTED lots with explicit warning requirement', () => {
  const issuedPrintedLots = ['MTL001', 'MTL002'];
  const rawTobaccos = [makeStock('s1', 'MTL001', 'Tembakau Muntilan Super')];

  const stockWarning = evaluateReprintWarnings({
    reprintLots: ['MTL001'],
    rawTobaccos,
    issuedPrintedLots,
  });
  assert.equal(stockWarning.severity, 'CRITICAL_STOCK');
  assert.equal(stockWarning.hasCriticalStockWarning, true);
  assert.equal(stockWarning.requiresAcknowledgment, true);
  assert.equal(stockWarning.stockedItems[0].stockName, 'Tembakau Muntilan Super');

  const printedWarning = evaluateReprintWarnings({
    reprintLots: ['MTL002'],
    rawTobaccos,
    issuedPrintedLots,
  });
  assert.equal(printedWarning.severity, 'PRINTED_WARNING');
  assert.equal(printedWarning.hasPrintedWarning, true);
  assert.equal(printedWarning.requiresAcknowledgment, true);

  const unprintedInfo = evaluateReprintWarnings({
    reprintLots: ['MTL003'],
    rawTobaccos,
    issuedPrintedLots,
  });
  assert.equal(unprintedInfo.severity, 'UNPRINTED_INFO');
  assert.equal(unprintedInfo.requiresAcknowledgment, false);
});

test('extractLotPrefixCode derives real prefix from lot when customPrefix belongs to another active prefix', () => {
  assert.equal(extractLotPrefixCode('MTL005', 'TMG'), 'MTL');
  assert.equal(extractLotPrefixCode('TMG-009', 'MTL'), 'TMG');
  assert.equal(extractLotPrefixCode('PANEN-005', 'PANEN-'), 'PANEN');
});

test('buildPrefixAuditGridBlock always generates 100 consecutive slots per block across pages and deleted prefixes', () => {
  const reg: PrefixRegistryState = {
    registeredPrefixes: ['MTL'],
    lastSelectedPrefix: 'MTL',
    dismissedPrefixes: [],
    minStartSeqByPrefix: {},
  };
  const deletedReg = removeRegisteredPrefix(reg, 'MTL');
  const issuedPrintedLots = ['MTL001', 'MTL002', 'MTL145'];
  const rawTobaccos = [makeStock('s1', 'MTL001', 'Muntilan Uji')];

  const ledgers = buildPrefixAuditLedgers({
    rawTobaccos,
    issuedPrintedLots,
    prefixRegistry: deletedReg,
  });
  const mtlLedger = ledgers.find((l) => l.prefixKey === 'MTL');
  assert.ok(mtlLedger);

  const page1 = buildPrefixAuditGridBlock({
    ledger: mtlLedger,
    rawTobaccos,
    issuedPrintedLots,
    prefixRegistry: deletedReg,
    blockIndex: 0,
  });
  assert.equal(page1.totalBlocks, 2);
  assert.equal(page1.startSeq, 1);
  assert.equal(page1.endSeq, 100);
  assert.equal(page1.entries.length, 100);
  assert.equal(page1.entries[0].status, 'STOCK_REGISTERED'); // MTL001
  assert.equal(page1.entries[1].status, 'PRINTED_NOT_STOCK'); // MTL002
  assert.equal(page1.entries[2].status, 'NOT_PRINTED'); // MTL003
  assert.equal(page1.entries[99].lotCode, 'MTL100');
  assert.equal(page1.entries[99].status, 'NOT_PRINTED');

  const page2 = buildPrefixAuditGridBlock({
    ledger: mtlLedger,
    rawTobaccos,
    issuedPrintedLots,
    prefixRegistry: deletedReg,
    blockIndex: 1,
  });
  assert.equal(page2.startSeq, 101);
  assert.equal(page2.endSeq, 200);
  assert.equal(page2.entries.length, 100);
  assert.equal(page2.entries[44].lotCode, 'MTL145');
  assert.equal(page2.entries[44].status, 'PRINTED_NOT_STOCK');
});

test('isReprintSafetySatisfied enforces both reason selection and confirmation for risky reprints', () => {
  const issuedPrintedLots = ['MTL001', 'MTL002'];
  const rawTobaccos = [makeStock('s1', 'MTL001', 'Tembakau Muntilan Super')];

  const stockWarning = evaluateReprintWarnings({
    reprintLots: ['MTL001'],
    rawTobaccos,
    issuedPrintedLots,
  });

  assert.equal(
    isReprintSafetySatisfied({ warning: stockWarning, reason: null, confirmed: false }),
    false
  );
  assert.equal(
    isReprintSafetySatisfied({ warning: stockWarning, reason: 'CACAT_TINTA', confirmed: false }),
    false
  );
  assert.equal(
    isReprintSafetySatisfied({ warning: stockWarning, reason: null, confirmed: true }),
    false
  );
  assert.equal(
    isReprintSafetySatisfied({ warning: stockWarning, reason: 'CACAT_TINTA', confirmed: true }),
    true
  );

  const unprintedWarning = evaluateReprintWarnings({
    reprintLots: ['MTL099'],
    rawTobaccos,
    issuedPrintedLots,
  });
  assert.equal(
    isReprintSafetySatisfied({ warning: unprintedWarning, reason: null, confirmed: false }),
    true
  );
});

