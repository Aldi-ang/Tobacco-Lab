import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_APP_VERSION, PATCH_RELEASES } from '../components/PatchNotesModal';

test('CURRENT_APP_VERSION matches the latest PATCH_RELEASES entry cleanly', () => {
  assert.ok(PATCH_RELEASES.length > 0);
  const first = PATCH_RELEASES[0];
  assert.equal(first.version, CURRENT_APP_VERSION);
  assert.equal(first.isLatest, true);
  assert.ok(first.changes.length > 0);

  const latestEntries = PATCH_RELEASES.filter((r) => r.isLatest === true);
  assert.equal(latestEntries.length, 1);

  for (const rel of PATCH_RELEASES) {
    assert.ok(rel.version.startsWith('v'));
    assert.ok(rel.date.trim().length > 0);
    for (const item of rel.changes) {
      assert.ok(item.title.trim().length > 0);
      assert.ok(item.description.trim().length > 0);
    }
  }
});
