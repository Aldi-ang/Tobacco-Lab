import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GRADER_REGISTRY_STATE,
  normalizeGraderName,
  registerGraderName,
  removeRegisteredGraderName,
  sanitizeGraderRegistryState,
  sanitizePrintYear,
  selectActiveGraderName,
} from './graderRegistryEngine';

test('Grader registry adds, deduplicates case-insensitively, selects, and removes graders cleanly', () => {
  const { nextState: s1, normalizedName: n1 } = registerGraderName(
    DEFAULT_GRADER_REGISTRY_STATE,
    '  Pak   Joko  '
  );
  assert.equal(n1, 'Pak Joko');
  assert.deepEqual(s1.registeredGraders, ['Pak Joko']);
  assert.equal(s1.lastSelectedGrader, 'Pak Joko');

  // Adding duplicate case doesn't duplicate list entry
  const { nextState: s2 } = registerGraderName(s1, 'pak joko');
  assert.deepEqual(s2.registeredGraders, ['Pak Joko']);

  // Adding second grader and selecting blank (manual handwriting)
  const { nextState: s3 } = registerGraderName(s2, 'Mas Budi');
  assert.deepEqual(s3.registeredGraders, ['Pak Joko', 'Mas Budi']);
  assert.equal(s3.lastSelectedGrader, 'Mas Budi');

  const cleared = selectActiveGraderName(s3, '');
  assert.equal(cleared.lastSelectedGrader, '');

  const selected = selectActiveGraderName(cleared, 'Pak Joko');
  assert.equal(selected.lastSelectedGrader, 'Pak Joko');

  const removed = removeRegisteredGraderName(selected, 'Pak Joko');
  assert.deepEqual(removed.registeredGraders, ['Mas Budi']);
  assert.equal(removed.lastSelectedGrader, '');

  assert.deepEqual(sanitizeGraderRegistryState(null), {
    registeredGraders: [],
    lastSelectedGrader: '',
  });
  assert.equal(normalizeGraderName('   Bu   Siti  '), 'Bu Siti');
});

test('sanitizePrintYear normalizes 4-digit & 2-digit years cleanly within 2020..2099', () => {
  assert.equal(sanitizePrintYear(2027, 2026), 2027);
  assert.equal(sanitizePrintYear('2028', 2026), 2028);
  assert.equal(sanitizePrintYear(27, 2026), 2027);
  assert.equal(sanitizePrintYear('abc', 2026), 2026);
  assert.equal(sanitizePrintYear(1999, 2026), 2026);
  assert.equal(sanitizePrintYear(2150, 2026), 2026);
});
