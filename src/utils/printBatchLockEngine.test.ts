import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReprintSlotPlan,
  buildSlotAssignedReprintPlan,
  confirmPendingBatchLock,
  createPendingPrintBatch,
  parseReprintLotCodes,
  resolveActiveBatchLots,
  snapPrintCountForFormat,
  unlockLastLockedBatch,
} from './printBatchLockEngine';
import { generateNextLotBatchNumbers } from './gradeCardEngine';

test('Failed PDF/Print does NOT lock numbers; retries stay on exact same pending lots until confirmed', () => {
  const initialIssued = ['MTL001', 'MTL002', 'MTL003', 'MTL004'];

  // Next generated batch starts at MTL005..MTL008 (4 cards per A4 page)
  const firstGenerated = generateNextLotBatchNumbers([], 4, 'MTL', initialIssued);
  assert.deepEqual(firstGenerated, ['MTL005', 'MTL006', 'MTL007', 'MTL008']);

  // User clicks PDF/Print -> creates pending batch, does NOT modify issuedLots yet!
  const pending = createPendingPrintBatch({
    lots: firstGenerated,
    prefix: 'MTL',
    paperFormat: 'A4_6',
    mode: 'PDF',
    now: 1000,
  });
  assert.ok(pending);

  // Even after repeated failed retries, generatedLots against unchanged initialIssued still yields MTL005..MTL008
  const retryView = resolveActiveBatchLots({
    pendingBatch: pending,
    generatedBatchLots: generateNextLotBatchNumbers([], 4, 'MTL', initialIssued),
    activePrefix: 'MTL',
    requestedCount: 4,
  });
  assert.equal(retryView.isRetryingPending, true);
  assert.deepEqual(retryView.lots, ['MTL005', 'MTL006', 'MTL007', 'MTL008']);

  // Only AFTER explicit user confirmation does issuedLots advance to MTL009..MTL012
  const confirmed = confirmPendingBatchLock({
    issuedLots: initialIssued,
    pendingBatch: pending!,
    now: 2000,
  });
  assert.equal(confirmed.nextIssuedLots.length, 8);
  assert.deepEqual(
    generateNextLotBatchNumbers([], 4, 'MTL', confirmed.nextIssuedLots),
    ['MTL009', 'MTL010', 'MTL011', 'MTL012']
  );

  // If print/PDF actually jammed on paper after confirmation, unlocking restores MTL005..MTL008!
  const unlocked = unlockLastLockedBatch({
    issuedLots: confirmed.nextIssuedLots,
    lastLockedBatch: confirmed.lastLockedBatch,
    paperFormat: 'A4_6',
    now: 3000,
  });
  assert.deepEqual(unlocked.nextIssuedLots, initialIssued);
  assert.deepEqual(unlocked.restoredPendingBatch?.lots, [
    'MTL005',
    'MTL006',
    'MTL007',
    'MTL008',
  ]);
  assert.deepEqual(
    generateNextLotBatchNumbers([], 4, 'MTL', unlocked.nextIssuedLots),
    ['MTL005', 'MTL006', 'MTL007', 'MTL008']
  );
});

test('snapPrintCountForFormat strictly enforces multiples of 4 [4..60] for A4 (4 large cards per A4 page)', () => {
  assert.equal(snapPrintCountForFormat(1, 'A4_6'), 4);
  assert.equal(snapPrintCountForFormat(4, 'A4_6'), 4);
  assert.equal(snapPrintCountForFormat(6, 'A4_6'), 8);
  assert.equal(snapPrintCountForFormat(8, 'A4_6'), 8);
  assert.equal(snapPrintCountForFormat(12, 'A4_6'), 12);
  assert.equal(snapPrintCountForFormat(16, 'A4_6'), 16);
  assert.equal(snapPrintCountForFormat(24, 'A4_6'), 24);
  assert.equal(snapPrintCountForFormat(90, 'A4_6'), 60);
  assert.equal(snapPrintCountForFormat(5, 'THERMAL_58'), 5);
});

test('buildReprintSlotPlan packs damaged old lot with fresh sequential lots (GABUNG_BARU) or leaves blank white slots (SLOT_TERPILIH) on 4-card A4', () => {
  assert.deepEqual(parseReprintLotCodes('mtl005, mtl002\nMTL005'), ['MTL005', 'MTL002']);

  const freshPool = ['MTL007', 'MTL008', 'MTL009', 'MTL010'];

  // Option A: GABUNG_BARU packs MTL005 in slot 1 + MTL007..MTL009 in slots 2..4 (zero waste on 4-card A4!)
  const mergedPlan = buildReprintSlotPlan({
    mode: 'GABUNG_BARU',
    reprintLots: ['MTL005'],
    generatedFreshLots: freshPool,
    requestedCount: 4,
    paperFormat: 'A4_6',
  });
  assert.deepEqual(mergedPlan.slots, [
    'MTL005',
    'MTL007',
    'MTL008',
    'MTL009',
  ]);
  assert.deepEqual(mergedPlan.freshLotsToLock, ['MTL007', 'MTL008', 'MTL009']);
  assert.equal(mergedPlan.blankUnusedSlots, false);

  // Option B: SLOT_TERPILIH places MTL005 at exact chosen slot #3 (index 2) and leaves slots 1, 2, 4 blank white
  const sparsePlan = buildReprintSlotPlan({
    mode: 'SLOT_TERPILIH',
    reprintLots: ['MTL005'],
    selectedSlotIndexes: [2],
    generatedFreshLots: freshPool,
    requestedCount: 4,
    paperFormat: 'A4_6',
  });
  assert.deepEqual(sparsePlan.slots, [null, null, 'MTL005', null]);
  assert.deepEqual(sparsePlan.freshLotsToLock, []);
  assert.equal(sparsePlan.blankUnusedSlots, true);
  assert.equal(sparsePlan.pageCount, 1);
});

test('buildSlotAssignedReprintPlan combines different numbers across chosen Slots 1-4 onto ONE single A4 page', () => {
  const freshPool = ['MTL009', 'MTL010', 'MTL011', 'MTL012'];

  // Combine distinct prefixes & numbers in Slot 1 and Slot 3 on 1 sheet (4 slots total)
  const combinedSparse = buildSlotAssignedReprintPlan({
    slotCodes: ['mtl008', '', 'yh41', ''],
    mode: 'SLOT_TERPILIH',
    generatedFreshLots: freshPool,
    requestedCount: 4,
    paperFormat: 'A4_6',
  });
  assert.equal(combinedSparse.pageCount, 1);
  assert.equal(combinedSparse.blankUnusedSlots, true);
  assert.deepEqual(combinedSparse.reprintedLots, ['MTL008', 'YH41']);
  assert.deepEqual(combinedSparse.freshLotsToLock, []);
  assert.deepEqual(combinedSparse.slots, ['MTL008', null, 'YH41', null]);

  // GABUNG_BARU preserves assigned slot positions and fills empty slots with fresh sequential lots
  const combinedWithFresh = buildSlotAssignedReprintPlan({
    slotCodes: ['MTL008', '', 'YH41', ''],
    mode: 'GABUNG_BARU',
    generatedFreshLots: freshPool,
    requestedCount: 4,
    paperFormat: 'A4_6',
  });
  assert.equal(combinedWithFresh.pageCount, 1);
  assert.equal(combinedWithFresh.blankUnusedSlots, false);
  assert.deepEqual(combinedWithFresh.slots, [
    'MTL008',
    'MTL009',
    'YH41',
    'MTL010',
  ]);
  assert.deepEqual(combinedWithFresh.freshLotsToLock, ['MTL009', 'MTL010']);

  // Thermal mode prints all assigned slots sequentially
  const thermalPlan = buildSlotAssignedReprintPlan({
    slotCodes: ['', 'YH41', '', 'BM1'],
    mode: 'SLOT_TERPILIH',
    generatedFreshLots: freshPool,
    requestedCount: 4,
    paperFormat: 'THERMAL_80',
  });
  assert.deepEqual(thermalPlan.slots, ['YH41', 'BM1']);
  assert.equal(thermalPlan.pageCount, 2);
});
