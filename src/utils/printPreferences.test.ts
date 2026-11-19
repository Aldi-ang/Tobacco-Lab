import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRINT_PREFERENCES,
  formatPaperSummaryLabel,
  sanitizePrintPreferences,
} from './printPreferences';

test('sanitizePrintPreferences returns 4/A4 defaults and migrates legacy A4_4', () => {
  assert.deepEqual(sanitizePrintPreferences(null), DEFAULT_PRINT_PREFERENCES);
  assert.equal(DEFAULT_PRINT_PREFERENCES.paperFormat, 'A4_6');
  assert.equal(DEFAULT_PRINT_PREFERENCES.printCount, 4);

  const migratedLegacy = sanitizePrintPreferences({
    paperFormat: 'A4_4',
    printCount: 8,
    duplexMode: 'LONG_EDGE',
    hasCustomizedBefore: true,
  });
  assert.equal(migratedLegacy.paperFormat, 'A4_6');
  assert.equal(migratedLegacy.printCount, 8);

  assert.deepEqual(
    sanitizePrintPreferences({
      paperFormat: 'INVALID' as any,
      duplexMode: 'BAD' as any,
      printCount: 999,
    }),
    DEFAULT_PRINT_PREFERENCES
  );
});

test('sanitizePrintPreferences snaps A4 card counts to kelipatan 4 and preserves thermal counts', () => {
  assert.equal(sanitizePrintPreferences({ paperFormat: 'A4_6', printCount: 4 }).printCount, 4);
  assert.equal(sanitizePrintPreferences({ paperFormat: 'A4_6', printCount: 6 }).printCount, 8);
  assert.equal(sanitizePrintPreferences({ paperFormat: 'A4_6', printCount: 11 }).printCount, 12);
  assert.equal(sanitizePrintPreferences({ paperFormat: 'A4_6', printCount: 16 }).printCount, 16);
  assert.equal(sanitizePrintPreferences({ paperFormat: 'A4_6', printCount: 24 }).printCount, 24);

  const sanitized = sanitizePrintPreferences({
    paperFormat: 'THERMAL_80',
    duplexMode: 'OFF',
    printCount: 10,
    includeThermalBarcode: false,
    hasCustomizedBefore: true,
  });
  assert.equal(sanitized.paperFormat, 'THERMAL_80');
  assert.equal(sanitized.duplexMode, 'OFF');
  assert.equal(sanitized.printCount, 10);
  assert.equal(sanitized.includeThermalBarcode, false);
  assert.equal(sanitized.hasCustomizedBefore, true);
});

test('formatPaperSummaryLabel produces A4 (4/Hal) summary string and sanitizes printYear', () => {
  assert.equal(
    formatPaperSummaryLabel({
      paperFormat: 'A4_6',
      duplexMode: 'LONG_EDGE',
      printCount: 4,
      includeThermalBarcode: true,
      hasCustomizedBefore: true,
      printYear: 2026,
    }),
    'A4 (4/Hal) • 2 Sisi (Long Edge)'
  );
  assert.equal(
    formatPaperSummaryLabel({
      paperFormat: 'THERMAL_58',
      duplexMode: 'OFF',
      printCount: 4,
      includeThermalBarcode: true,
      hasCustomizedBefore: true,
      printYear: 2026,
    }),
    'Thermal 58mm + Barcode'
  );
  assert.equal(sanitizePrintPreferences({ printYear: 2029 }).printYear, 2029);
});
