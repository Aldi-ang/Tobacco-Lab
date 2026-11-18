import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcProfitMarginPct,
  formatExcelIngredientsSummary,
  formatExcelSensoryRow,
  formatExcelTaraSummary,
} from './excelStockView';

test('formatExcelSensoryRow returns all 6 clamped attributes in fixed spreadsheet order', () => {
  const row = formatExcelSensoryRow({
    power: 4,
    impact: 5,
    bitter: 1,
    burn: 3.5,
    sugar: 0,
    aroma: 6.2,
  });

  assert.equal(row.length, 6);
  assert.deepEqual(
    row.map((c) => `${c.code}:${c.formatted}`),
    ['Pwr:4', 'Imp:5', 'Bit:1', 'Brn:3.5', 'Sgr:0', 'Arm:3.1']
  );
});

test('formatExcelTaraSummary handles formula and fallback cleanly', () => {
  assert.equal(
    formatExcelTaraSummary('5% + 2 kg', 4.5, 3),
    '−4.5kg (5% + 2 kg) · Wd 3kg'
  );
  assert.equal(formatExcelTaraSummary(undefined, 2, 1.5), '−2kg · Wadah 1.5kg');
});

test('formatExcelIngredientsSummary formats up to 3 items cleanly', () => {
  assert.equal(formatExcelIngredientsSummary([]), 'Komposisi belum tercatat');
  assert.equal(
    formatExcelIngredientsSummary([
      { tobaccoName: 'Weleri', percentageInBlend: 50 },
      { tobaccoName: 'Muntilan', percentageInBlend: 30 },
      { tobaccoName: 'Garut', percentageInBlend: 15 },
      { tobaccoName: 'Kasturi', percentageInBlend: 5 },
    ]),
    '4 bhn: Weleri 50% · Muntilan 30% · Garut 15% +1 lainnya'
  );
});

test('calcProfitMarginPct avoids division by zero and formats sign', () => {
  assert.equal(calcProfitMarginPct(150000, 1000000), '+15.0%');
  assert.equal(calcProfitMarginPct(-50000, 1000000), '-5.0%');
  assert.equal(calcProfitMarginPct(100000, 0), '0.0%');
});
