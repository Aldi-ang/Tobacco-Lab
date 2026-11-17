import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReprintSlotPlan,
  confirmPendingBatchLock,
  createPendingPrintBatch,
  parseReprintLotCodes,
  resolveActiveBatchLots,
  snapPrintCountForFormat,
  unlockLastLockedBatch,
} from './printBatchLockEngine';
import { generateNextLotBatchNumbers } from './gradeCardEngine';

test('Failed PDF/Print does NOT lock numbers; retries stay on exact same pending lots until confirmed', () => {
  const initialIssued = ['MTL001', 'MTL002', 'MTL003', 'MTL004', 'MTL005', 'MTL006'];

  // Next generated batch starts at MTL007..MTL012
  const firstGenerated = generateNextLotBatchNumbers([], 6, 'MTL', initialIssued);
  assert.deepEqual(firstGenerated, ['MTL007', 'MTL008', 'MTL009', 'MTL010', 'MTL011', 'MTL012']);

  // User clicks PDF/Print -> creates pending batch, does NOT modify issuedLots yet!
  const pending = createPendingPrintBatch({
    lots: firstGenerated,
    prefix: 'MTL',
    paperFormat: 'A4_6',
    mode: 'PDF',
    now: 1000,
  });
  assert.ok(pending);

  // Even after repeated failed retries, generatedLots against unchanged initialIssued still yields MTL007..MTL012
  const retryView = resolveActiveBatchLots({
    pendingBatch: pending,
    generatedBatchLots: generateNextLotBatchNumbers([], 6, 'MTL', initialIssued),
    activePrefix: 'MTL',
    requestedCount: 6,
  });
  assert.equal(retryView.isRetryingPending, true);
  assert.deepEqual(retryView.lots, ['MTL007', 'MTL008', 'MTL009', 'MTL010', 'MTL011', 'MTL012']);

  // Only AFTER explicit user confirmation does issuedLots advance to MTL013..MTL018
  const confirmed = confirmPendingBatchLock({
    issuedLots: initialIssued,
    pendingBatch: pending!,
    now: 2000,
  });
  assert.equal(confirmed.nextIssuedLots.length, 12);
  assert.deepEqual(
    generateNextLotBatchNumbers([], 6, 'MTL', confirmed.nextIssuedLots),
    ['MTL013', 'MTL014', 'MTL015', 'MTL016', 'MTL017', 'MTL018']
  );

  // If print/PDF actually jammed on paper after confirmation, unlocking restores MTL007..MTL012!
  const unlocked = unlockLastLockedBatch({
    issuedLots: confirmed.nextIssuedLots,
    lastLockedBatch: confirmed.lastLockedBatch,
    paperFormat: 'A4_6',
    now: 3000,
  });
  assert.deepEqual(unlocked.nextIssuedLots, initialIssued);
  assert.deepEqual(unlocked.restoredPendingBatch?.lots, [
    'MTL007',
    'MTL008',
    'MTL009',
    'MTL010',
    'MTL011',
    'MTL012',
  ]);
  assert.deepEqual(
    generateNextLotBatchNumbers([], 6, 'MTL', unlocked.nextIssuedLots),
    ['MTL007', 'MTL008', 'MTL009', 'MTL010', 'MTL011', 'MTL012']
  );
});

test('snapPrintCountForFormat strictly enforces multiples of 6 [6..60] for A4_6', () => {
  assert.equal(snapPrintCountForFormat(1, 'A4_6'), 6);
  assert.equal(snapPrintCountForFormat(4, 'A4_6'), 6);
  assert.equal(snapPrintCountForFormat(8, 'A4_6'), 6);
  assert.equal(snapPrintCountForFormat(12, 'A4_6'), 12);
  assert.equal(snapPrintCountForFormat(18, 'A4_6'), 18);
  assert.equal(snapPrintCountForFormat(24, 'A4_6'), 24);
  assert.equal(snapPrintCountForFormat(90, 'A4_6'), 60);
  assert.equal(snapPrintCountForFormat(5, 'THERMAL_58'), 5);
});

test('buildReprintSlotPlan packs damaged old lot with fresh sequential lots (GABUNG_BARU) or leaves blank white slots (SLOT_TERPILIH)', () => {
  assert.deepEqual(parseReprintLotCodes('mtl005, mtl002\nMTL005'), ['MTL005', 'MTL002']);

  const freshPool = ['MTL007', 'MTL008', 'MTL009', 'MTL010', 'MTL011', 'MTL012'];

  // Option A: GABUNG_BARU packs MTL005 in slot 1 + MTL007..MTL011 in slots 2..6 (zero waste!)
  const mergedPlan = buildReprintSlotPlan({
    mode: 'GABUNG_BARU',
    reprintLots: ['MTL005'],
    generatedFreshLots: freshPool,
    requestedCount: 6,
    paperFormat: 'A4_6',
  });
  assert.deepEqual(mergedPlan.slots, [
    'MTL005',
    'MTL007',
    'MTL008',
    'MTL009',
    'MTL010',
    'MTL011',
  ]);
  assert.deepEqual(mergedPlan.freshLotsToLock, ['MTL007', 'MTL008', 'MTL009', 'MTL010', 'MTL011']);
  assert.equal(mergedPlan.blankUnusedSlots, false);

  // Option B: SLOT_TERPILIH places MTL005 at exact chosen slot #5 (index 4) and leaves slots 1,2,3,4,6 blank white
  const sparsePlan = buildReprintSlotPlan({
    mode: 'SLOT_TERPILIH',
    reprintLots: ['MTL005'],
    selectedSlotIndexes: [4],
    generatedFreshLots: freshPool,
    requestedCount: 6,
    paperFormat: 'A4_6',
  });
  assert.deepEqual(sparsePlan.slots, [null, null, null, null, 'MTL005', null]);
  assert.deepEqual(sparsePlan.freshLotsToLock, []);
  assert.equal(sparsePlan.blankUnusedSlots, true);
  assert.equal(sparsePlan.pageCount, 1);
});
