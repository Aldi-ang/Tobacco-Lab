import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areAllCardsExpanded,
  toggleAllCardsExpanded,
  toggleCardExpanded,
} from './cardExpandState';

test('toggleCardExpanded starts empty, expands one card, and shrinks it cleanly', () => {
  const initial = {};
  const expandedOne = toggleCardExpanded(initial, 'raw-1');
  assert.equal(expandedOne['raw-1'], true);

  const expandedTwo = toggleCardExpanded(expandedOne, 'raw-2');
  assert.equal(expandedTwo['raw-1'], true);
  assert.equal(expandedTwo['raw-2'], true);

  const shrunkOne = toggleCardExpanded(expandedTwo, 'raw-1');
  assert.equal(Boolean(shrunkOne['raw-1']), false);
  assert.equal(shrunkOne['raw-2'], true);
});

test('areAllCardsExpanded returns false for empty list and partial expansion', () => {
  assert.equal(areAllCardsExpanded({}, []), false);
  assert.equal(areAllCardsExpanded({ a: true }, []), false);
  assert.equal(areAllCardsExpanded({ a: true }, ['a', 'b']), false);
  assert.equal(areAllCardsExpanded({ a: true, b: true }, ['a', 'b']), true);
});

test('toggleAllCardsExpanded expands remaining cards when partially expanded, then shrinks all', () => {
  const visible = ['c1', 'c2', 'c3'];
  const partial = { c1: true, hidden: true };

  const allExpanded = toggleAllCardsExpanded(partial, visible);
  assert.equal(allExpanded.c1, true);
  assert.equal(allExpanded.c2, true);
  assert.equal(allExpanded.c3, true);
  assert.equal(allExpanded.hidden, true);

  const allShrunk = toggleAllCardsExpanded(allExpanded, visible);
  assert.equal(Boolean(allShrunk.c1), false);
  assert.equal(Boolean(allShrunk.c2), false);
  assert.equal(Boolean(allShrunk.c3), false);
  assert.equal(allShrunk.hidden, true);
});
