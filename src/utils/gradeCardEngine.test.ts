import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRating5 } from './tobaccoMath';
import {
  snapToMasterDictionary,
  clampWholeAttribute1to5,
  generateNextLotBatchNumbers,
  classifyScannedCardsForReview,
  materializeRawTobaccoFromReview,
  buildEditableReviewCardFromExistingStock,
  normalizeScannedPurchaseDate,
} from './gradeCardEngine';
import { PackagingMaster, RawTobacco } from '../types/tobacco';

const SAMPLE_PACKAGINGS: PackagingMaster[] = [
  {
    id: 'pkg-krj',
    name: 'KRJ MUNTILAN',
    packagingMassKg: 3,
    taraPercent: 5,
    taraFlatKg: 2,
    packagingCostRp: 35000,
    pressCostRp: 15000,
  },
  {
    id: 'pkg-bal',
    name: 'BAL',
    packagingMassKg: 1.5,
    taraPercent: 0,
    taraFlatKg: 2,
    packagingCostRp: 20000,
    pressCostRp: 10000,
  },
];

function makeSampleRaw(overrides: Partial<RawTobacco> = {}): RawTobacco {
  return {
    id: 'raw-1',
    lotNumber: 'LOT-260327-001',
    name: 'MTL Wetan Kali',
    origin: 'Muntilan',
    sellerName: 'Bu Menik',
    purchaseDate: '2026-03-27',
    grossWeightKg: 46,
    packagingMassKg: 3,
    taraFormula: {
      rawFormula: '5% + 2 kg',
      percent: 5,
      flatKg: 2,
      pricingBasis: 'NET_WEIGHT',
      packagingType: 'KRJ MUNTILAN',
      packagingMassKg: 3,
    },
    deductionKg: 4.3,
    netWeightKg: 41.7,
    currentStockNetKg: 41.7,
    pricePerKgPurchase: 100000,
    additionalPurchaseCost: 0,
    totalModalAsal: 4170000,
    realCostPerNetKg: 100000,
    realNetWeightKg: 43,
    realStockValueRp: 4300000,
    purchaseWeightProfitKg: 1.3,
    purchaseWeightProfitRp: 130000,
    effectiveCostPerRealKg: 96977,
    powerRating: 4,
    impactRating: 3,
    bitterRating: 3,
    burnRating: 4,
    sugarRating: 3,
    aromaRating: 4,
    colorGrade: 'D+',
    characterNotes: 'Sample',
    ...overrides,
  };
}

test('Kamus Master snaps handwritten misspellings accurately', () => {
  const originMatch = snapToMasterDictionary('Mntlian', ['Muntilan', 'Temanggung', 'Windusari']);
  assert.equal(originMatch.value, 'Muntilan');
  assert.equal(originMatch.wasAutoCorrected, true);

  const windusariMatch = snapToMasterDictionary('Wmdusari', ['Muntilan', 'Temanggung', 'Windusari']);
  assert.equal(windusariMatch.value, 'Windusari');
  assert.equal(windusariMatch.wasAutoCorrected, true);

  const sellerMatch = snapToMasterDictionary('Bu Menk', ['Bu Menik', 'Pak Karman']);
  assert.equal(sellerMatch.value, 'Bu Menik');
  assert.equal(sellerMatch.wasAutoCorrected, true);

  const shorthandMatch = snapToMasterDictionary('Mtl', ['Muntilan', 'Temanggung']);
  assert.equal(shorthandMatch.value, 'Muntilan');
  assert.equal(shorthandMatch.wasAutoCorrected, true);
});

test('clampWholeAttribute1to5 rounds and clamps to whole integer 1..5', () => {
  assert.equal(clampWholeAttribute1to5(3.6), 4);
  assert.equal(clampWholeAttribute1to5(0), 3);
  assert.equal(clampWholeAttribute1to5(9), 5);
  assert.equal(clampWholeAttribute1to5(0.4), 1);
});

test('generateNextLotBatchNumbers skips existing AND previously printed lots (single-print only)', () => {
  const existing = [
    makeSampleRaw({ lotNumber: 'LOT-TEST-001' }),
    makeSampleRaw({ id: 'raw-2', lotNumber: 'LOT-TEST-003' }),
  ];
  const firstPrintBatch = generateNextLotBatchNumbers(existing, 3, 'LOT-TEST-');
  assert.deepEqual(firstPrintBatch, ['LOT-TEST-004', 'LOT-TEST-005', 'LOT-TEST-006']);

  // Before any card from firstPrintBatch is scanned into Gudang, second print MUST advance to 007..009
  const secondPrintBatch = generateNextLotBatchNumbers(
    existing,
    3,
    'LOT-TEST-',
    firstPrintBatch
  );
  assert.deepEqual(secondPrintBatch, ['LOT-TEST-007', 'LOT-TEST-008', 'LOT-TEST-009']);

  // User skips ahead (e.g. printed up to #18 on physical paper before resetting/re-adding prefix)
  const skippedBatch = generateNextLotBatchNumbers(
    existing,
    6,
    'MTL',
    ['MTL001', 'MTL002'],
    19
  );
  assert.deepEqual(skippedBatch, ['MTL019', 'MTL020', 'MTL021', 'MTL022', 'MTL023', 'MTL024']);

  // Collision safety: if user enters lower than maxSeq+1, never re-issue an already-existing lot
  const collisionSafe = generateNextLotBatchNumbers(
    existing,
    3,
    'MTL',
    ['MTL001', 'MTL002', 'MTL006'],
    4
  );
  assert.deepEqual(collisionSafe, ['MTL007', 'MTL008', 'MTL009']);
});

test('buildEditableReviewCardFromExistingStock opens barcode-matched stock in editable UPDATE mode', () => {
  const existing = makeSampleRaw({
    lotNumber: 'LOT-260327-099',
    packagingMassKg: 3,
  });
  const editable = buildEditableReviewCardFromExistingStock(existing);
  assert.equal(editable.matchStatus, 'UPDATE_MENYUSUL');
  assert.equal(editable.selectedForSave, true);
  assert.equal(editable.lotNumber, 'LOT-260327-099');
  assert.equal(editable.packagingType, 'KRJ MUNTILAN');

  // Edit packaging from KRJ MUNTILAN (5% + 2kg) to BAL (0% + 2kg) and gross to 50kg
  const updated = materializeRawTobaccoFromReview({
    card: { ...editable, packagingType: 'BAL', grossWeightKg: 50 },
    existingRecord: existing,
    packagingList: SAMPLE_PACKAGINGS,
  });
  assert.equal(updated.taraFormula.packagingType, 'BAL');
  assert.equal(updated.deductionKg, 2);
  assert.equal(updated.netWeightKg, 48);
});

test('Stage 1 NEW_STOCK -> Stage 2 UPDATE_MENYUSUL -> Anti-Dobel DUPLICATE_COMPLETE & BATCH_DUPLICATE', () => {
  // 1. Stage 1 scan (attributes & grade filled, weight & price still 0)
  const stage1Reviewed = classifyScannedCardsForReview({
    scannedCards: [
      {
        lotNumber: 'LOT-260327-010',
        name: 'Srinthil Pagi',
        origin: 'Tmanggung',
        sellerName: 'Pak Karman',
        colorGrade: 'B+',
        packagingType: 'KRJ MUNTILAN',
        grossWeightKg: 0,
        pricePerKgPurchase: 0,
        powerRating: 5,
        impactRating: 4,
        bitterRating: 2,
        burnRating: 4,
        sugarRating: 4,
        aromaRating: 5,
        confidenceScore: 92,
      },
    ],
    rawTobaccos: [],
    packagingList: SAMPLE_PACKAGINGS,
  });

  assert.equal(stage1Reviewed.length, 1);
  assert.equal(stage1Reviewed[0].matchStatus, 'NEW_STOCK');
  assert.equal(stage1Reviewed[0].origin, 'Temanggung');
  assert.equal(stage1Reviewed[0].selectedForSave, true);

  const stage1Saved = materializeRawTobaccoFromReview({
    card: stage1Reviewed[0],
    packagingList: SAMPLE_PACKAGINGS,
  });
  assert.equal(stage1Saved.grossWeightKg, 0);
  assert.equal(stage1Saved.pricePerKgPurchase, 0);

  // 2. Stage 2 rescan of the same Lot with Bruto=50kg & Harga=120000
  const stage2Reviewed = classifyScannedCardsForReview({
    scannedCards: [
      {
        lotNumber: 'LOT-260327-010',
        name: 'Srinthil Pagi',
        origin: 'Temanggung',
        sellerName: 'Pak Karman',
        colorGrade: 'B+',
        packagingType: 'KRJ MUNTILAN',
        grossWeightKg: 50,
        pricePerKgPurchase: 120000,
        powerRating: 5,
        impactRating: 4,
        bitterRating: 2,
        burnRating: 4,
        sugarRating: 4,
        aromaRating: 5,
        confidenceScore: 95,
      },
    ],
    rawTobaccos: [stage1Saved],
    packagingList: SAMPLE_PACKAGINGS,
  });

  assert.equal(stage2Reviewed[0].matchStatus, 'UPDATE_MENYUSUL');
  assert.equal(stage2Reviewed[0].selectedForSave, true);
  assert.equal(stage2Reviewed[0].matchedExistingId, stage1Saved.id);

  const stage2Updated = materializeRawTobaccoFromReview({
    card: stage2Reviewed[0],
    existingRecord: stage1Saved,
    packagingList: SAMPLE_PACKAGINGS,
  });
  // Tara for KRJ MUNTILAN: 5% of 50 (2.5) + 2 = 4.5 -> roundHalfUpKg(4.5) = 5 kg;
  // Netto Nota = 50 - 5 = 45 kg; realPkgMassKg = 3 -> realNet = 47 -> weightProfitKg = +2
  assert.equal(stage2Updated.id, stage1Saved.id);
  assert.equal(stage2Updated.deductionKg, 5);
  assert.equal(stage2Updated.netWeightKg, 45);
  assert.equal(stage2Updated.totalModalAsal, 5400000);
  assert.equal(stage2Updated.purchaseWeightProfitKg, 2);

  // 3. Duplicate rescan of already-complete Lot + duplicate inside same photo
  const dupCheck = classifyScannedCardsForReview({
    scannedCards: [
      {
        lotNumber: 'LOT-260327-010',
        name: 'Srinthil Pagi',
        origin: 'Temanggung',
        sellerName: 'Pak Karman',
        colorGrade: 'B+',
        packagingType: 'KRJ MUNTILAN',
        grossWeightKg: 50,
        pricePerKgPurchase: 120000,
        confidenceScore: 96,
      },
      {
        lotNumber: 'LOT-260327-010',
        name: 'Srinthil Pagi',
        origin: 'Temanggung',
        sellerName: 'Pak Karman',
        colorGrade: 'B+',
        packagingType: 'KRJ MUNTILAN',
        grossWeightKg: 50,
        pricePerKgPurchase: 120000,
        confidenceScore: 90,
      },
    ],
    rawTobaccos: [stage2Updated],
    packagingList: SAMPLE_PACKAGINGS,
  });

  assert.equal(dupCheck[0].matchStatus, 'DUPLICATE_COMPLETE');
  assert.equal(dupCheck[0].selectedForSave, false);
  assert.equal(dupCheck[1].matchStatus, 'BATCH_DUPLICATE');
  assert.equal(dupCheck[1].selectedForSave, false);
});

test('formatRating5 hides .0 for integers while keeping legacy historical decimals intact', () => {
  assert.equal(formatRating5(4), '4');
  assert.equal(formatRating5(0), '0');
  assert.equal(formatRating5(3.5), '3.5');
  assert.equal(formatRating5(4.2), '4.2');

  const legacyStock = makeSampleRaw({
    lotNumber: 'LOT-LEGACY-001',
    powerRating: 3.5,
    impactRating: 4.5,
    bitterRating: 2.5,
    burnRating: 4,
    sugarRating: 3.5,
    aromaRating: 4.2,
    grossWeightKg: 0,
  });
  const card = buildEditableReviewCardFromExistingStock(legacyStock);
  assert.equal(card.powerRating, 3.5);
  assert.equal(card.impactRating, 4.5);
  assert.equal(card.aromaRating, 4.2);

  const updatedWeightOnly = materializeRawTobaccoFromReview({
    card: { ...card, grossWeightKg: 45 },
    existingRecord: legacyStock,
    packagingList: SAMPLE_PACKAGINGS,
  });
  assert.equal(updatedWeightOnly.powerRating, 3.5);
  assert.equal(updatedWeightOnly.aromaRating, 4.2);
});

test('Paper-First Update: rescanning complete card via Kamera Stok Baru updates existing stock when paper has new writing', () => {
  const submittedBefore = makeSampleRaw({
    id: 'raw-mtl-1',
    lotNumber: 'MTL001',
    name: 'Muntilan Pagi',
    origin: 'Muntilan',
    sellerName: 'Bu Menik',
    colorGrade: 'D+',
    grossWeightKg: 46,
    pricePerKgPurchase: 100000,
    powerRating: 4,
    impactRating: 3,
    bitterRating: 3,
    burnRating: 4,
    sugarRating: 3,
    aromaRating: 4,
    characterNotes: 'Daun agak tebal',
  });

  // 1. User wrote updated price (115000), updated weight (52kg), and new note on paper card MTL001
  const paperEditedRescan = classifyScannedCardsForReview({
    scannedCards: [
      {
        lotNumber: 'MTL001',
        name: 'Muntilan Pagi',
        origin: 'Muntilan',
        sellerName: 'Bu Menik',
        colorGrade: 'C',
        packagingType: 'KRJ MUNTILAN',
        grossWeightKg: 52,
        pricePerKgPurchase: 115000,
        characterNotes: 'Daun tebal + kering bagus',
        confidenceScore: 93,
      },
    ],
    rawTobaccos: [submittedBefore],
    packagingList: SAMPLE_PACKAGINGS,
  });

  assert.equal(paperEditedRescan.length, 1);
  assert.equal(paperEditedRescan[0].matchStatus, 'UPDATE_MENYUSUL');
  assert.equal(paperEditedRescan[0].selectedForSave, true);
  assert.equal(paperEditedRescan[0].matchedExistingId, 'raw-mtl-1');
  assert.ok(paperEditedRescan[0].updateDiffSummary.some((s) => s.includes('Bruto diubah')));
  assert.ok(paperEditedRescan[0].updateDiffSummary.some((s) => s.includes('Harga diubah')));
  assert.ok(paperEditedRescan[0].updateDiffSummary.some((s) => s.includes('Grade diubah')));
  assert.ok(paperEditedRescan[0].updateDiffSummary.some((s) => s.includes('Catatan diubah')));

  const savedUpdate = materializeRawTobaccoFromReview({
    card: paperEditedRescan[0],
    existingRecord: submittedBefore,
    packagingList: SAMPLE_PACKAGINGS,
  });

  assert.equal(savedUpdate.id, 'raw-mtl-1');
  assert.equal(savedUpdate.grossWeightKg, 52);
  assert.equal(savedUpdate.pricePerKgPurchase, 115000);
  assert.equal(savedUpdate.colorGrade, 'C');
  assert.equal(savedUpdate.characterNotes, 'Daun tebal + kering bagus');
  // Unchanged ratings stay preserved (not wiped to defaults)
  assert.equal(savedUpdate.powerRating, 4);
  assert.equal(savedUpdate.impactRating, 3);
});

test('normalizeScannedPurchaseDate parses DMY with editable card year & defaults blank scans to today', () => {
  assert.deepEqual(normalizeScannedPurchaseDate('15/11', 2027, '2026-11-16'), {
    isoDate: '2027-11-15',
    wasAutoDefaulted: false,
  });
  assert.deepEqual(normalizeScannedPurchaseDate('___ / ___ / 2026', 2026, '2026-11-16'), {
    isoDate: '2026-11-16',
    wasAutoDefaulted: true,
  });
  assert.deepEqual(normalizeScannedPurchaseDate('', 2026, '2026-11-16'), {
    isoDate: '2026-11-16',
    wasAutoDefaulted: true,
  });

  // Classify a new scan with blank date & handwritten grader name -> today's date + matched Grader
  const reviewed = classifyScannedCardsForReview({
    scannedCards: [
      {
        lotNumber: 'MTL099',
        graderName: 'Pak Jko',
        purchaseDate: '',
        name: 'Klaten Harum',
        origin: 'Klaten',
        colorGrade: 'C+',
        confidenceScore: 91,
      },
    ],
    rawTobaccos: [],
    packagingList: SAMPLE_PACKAGINGS,
    defaultPrintYear: 2027,
    registeredGraders: ['Pak Joko'],
    todayIsoOverride: '2026-11-16',
  });
  assert.equal(reviewed[0].purchaseDate, '2026-11-16');
  assert.equal(reviewed[0].dateWasAutoDefaulted, true);
  assert.equal(reviewed[0].graderName, 'Pak Joko');

  const materialized = materializeRawTobaccoFromReview({
    card: reviewed[0],
    packagingList: SAMPLE_PACKAGINGS,
  });
  assert.equal(materialized.purchaseDate, '2026-11-16');
  assert.equal(materialized.graderName, 'Pak Joko');
});
