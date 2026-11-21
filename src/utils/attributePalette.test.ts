import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATURITY_LEVEL_LABELS,
  getAttributeColorStyle,
  getAttributePolarity,
  resolveAttributeToneBand,
} from './attributePalette';

test('Positive traits (power, impact, burn, aroma) map 1..5 from red to green', () => {
  assert.equal(getAttributePolarity('powerRating'), 'positive');
  assert.equal(getAttributePolarity('impactRating'), 'positive');
  assert.equal(getAttributePolarity('burnRating'), 'positive');
  assert.equal(getAttributePolarity('aromaRating'), 'positive');

  assert.equal(resolveAttributeToneBand('positive', 0), 'unset');
  assert.equal(resolveAttributeToneBand('positive', 1), 'red');
  assert.equal(resolveAttributeToneBand('positive', 2), 'orange');
  assert.equal(resolveAttributeToneBand('positive', 3), 'yellow');
  assert.equal(resolveAttributeToneBand('positive', 4), 'lime');
  assert.equal(resolveAttributeToneBand('positive', 5), 'green');
});

test('Negative traits (bitter, heat, sugar) invert gradient 1..5 from green (best) to red (worst)', () => {
  assert.equal(getAttributePolarity('bitterRating'), 'negative');
  assert.equal(getAttributePolarity('heatRating'), 'negative');
  assert.equal(getAttributePolarity('sugarRating'), 'negative');

  assert.equal(resolveAttributeToneBand('negative', 1), 'green');
  assert.equal(resolveAttributeToneBand('negative', 2), 'lime');
  assert.equal(resolveAttributeToneBand('negative', 3), 'yellow');
  assert.equal(resolveAttributeToneBand('negative', 4), 'orange');
  assert.equal(resolveAttributeToneBand('negative', 5), 'red');
});

test('Maturity maps imbon stages 1..5 to red -> orange -> green -> orange -> red', () => {
  assert.equal(getAttributePolarity('maturityRating'), 'maturity');

  assert.equal(MATURITY_LEVEL_LABELS[1], 'Tidak Matang');
  assert.equal(MATURITY_LEVEL_LABELS[2], 'Lumayan Matang');
  assert.equal(MATURITY_LEVEL_LABELS[3], 'Matang');
  assert.equal(MATURITY_LEVEL_LABELS[4], 'Keluwasen');
  assert.equal(MATURITY_LEVEL_LABELS[5], 'Busuk');

  assert.equal(resolveAttributeToneBand('maturity', 1), 'red');
  assert.equal(resolveAttributeToneBand('maturity', 2), 'orange');
  assert.equal(resolveAttributeToneBand('maturity', 3), 'green');
  assert.equal(resolveAttributeToneBand('maturity', 4), 'orange');
  assert.equal(resolveAttributeToneBand('maturity', 5), 'red');

  assert.equal(getAttributeColorStyle('maturity', 3).levelLabel, 'Matang');
  assert.equal(getAttributeColorStyle('maturity', 4).levelLabel, 'Keluwasen');
  assert.equal(getAttributeColorStyle('maturity', 5).levelLabel, 'Busuk');
});
