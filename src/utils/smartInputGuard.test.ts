import test from 'node:test';
import assert from 'node:assert/strict';
import { getSmartPriceGuard, getSmartWeightGuard } from './smartInputGuard';

test('getSmartPriceGuard ignores zero and normal tobacco prices', () => {
  assert.equal(getSmartPriceGuard(0), null);
  assert.equal(getSmartPriceGuard(-10), null);
  assert.equal(getSmartPriceGuard(45000), null);
  assert.equal(getSmartPriceGuard(135000), null);
});

test('getSmartPriceGuard detects missing 3 zeros (< 1000) and suggests x1000', () => {
  const res = getSmartPriceGuard(75);
  assert.ok(res);
  assert.equal(res.kind, 'multiply_1000');
  assert.equal(res.suggestedValue, 75000);
});

test('getSmartPriceGuard detects extra zero (>= 1,000,000) and suggests /10', () => {
  const res = getSmartPriceGuard(1500000);
  assert.ok(res);
  assert.equal(res.kind, 'divide_10');
  assert.equal(res.suggestedValue, 150000);
});

test('getSmartWeightGuard warns on unusually heavy single-lot gross weight', () => {
  assert.equal(getSmartWeightGuard(0), null);
  assert.equal(getSmartWeightGuard(52.5), null);

  const mid = getSmartWeightGuard(320);
  assert.ok(mid);
  assert.equal(mid.kind, 'warning_only');

  const high = getSmartWeightGuard(1200);
  assert.ok(high);
  assert.equal(high.kind, 'divide_10');
  assert.equal(high.suggestedValue, 120);
});
