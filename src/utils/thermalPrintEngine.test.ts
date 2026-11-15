import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arrangeDuplexBackSlots,
  buildDynamicPrintPageCss,
  computeCode39TotalUnits,
  encodeCode39Modules,
  encodeMonochromePixelsToEscPos,
  extractLotPrefixCode,
  isThermalPaperFormat,
  THERMAL_PROFILES,
} from './thermalPrintEngine';

test('Thermal paper profiles & dynamic @page CSS select 58mm, 80mm, or A4 accurately', () => {
  assert.equal(THERMAL_PROFILES.THERMAL_58.widthDots, 384);
  assert.equal(THERMAL_PROFILES.THERMAL_80.widthDots, 576);
  assert.equal(isThermalPaperFormat('THERMAL_58'), true);
  assert.equal(isThermalPaperFormat('A4_4'), false);

  assert.match(buildDynamicPrintPageCss('THERMAL_58'), /58mm auto/);
  assert.match(buildDynamicPrintPageCss('THERMAL_80'), /80mm auto/);
  assert.match(buildDynamicPrintPageCss('A4_4'), /A4 portrait/);
});

test('Code 39 barcode encoder & prefix extraction produce valid scannable bar sequences', () => {
  assert.equal(extractLotPrefixCode('LOT-261115-001'), 'LOT-261115');
  assert.equal(extractLotPrefixCode('PANEN-005', 'PANEN-'), 'PANEN');

  const runs = encodeCode39Modules('LOT-261115-001');
  // '*LOT-261115-001*' has 16 chars * 9 elements + 15 inter-char gaps = 159 runs
  assert.equal(runs.length, 159);
  // Every character in Code 39 has 3 wide (3 units) + 6 narrow (1 unit) = 15 units, +15 inter-char spaces
  assert.equal(computeCode39TotalUnits(runs), 16 * 15 + 15);
  assert.equal(runs[0].isBar, true);
  assert.equal(runs[runs.length - 1].isBar, true);
});

test('arrangeDuplexBackSlots mirrors A4 2-column grids accurately for LONG_EDGE and SHORT_EDGE', () => {
  const page4 = ['LOT-1', 'LOT-2', 'LOT-3'];
  const longEdge = arrangeDuplexBackSlots(page4, 4, 'LONG_EDGE');
  assert.deepEqual(longEdge, [
    { lot: 'LOT-2', rotate180: false },
    { lot: 'LOT-1', rotate180: false },
    { lot: null, rotate180: false },
    { lot: 'LOT-3', rotate180: false },
  ]);

  const shortEdge = arrangeDuplexBackSlots(page4, 4, 'SHORT_EDGE');
  assert.deepEqual(shortEdge, [
    { lot: 'LOT-3', rotate180: true },
    { lot: null, rotate180: true },
    { lot: 'LOT-1', rotate180: true },
    { lot: 'LOT-2', rotate180: true },
  ]);
});

test('encodeMonochromePixelsToEscPos builds valid GS v 0 raster command with threshold & cut', () => {
  // 8x2 image: row 0 = alternating black/white (10101010 = 0xAA), row 1 = all white (0x00)
  const pixels = new Uint8ClampedArray(8 * 2 * 4);
  for (let x = 0; x < 8; x++) {
    const black = x % 2 === 0;
    const val = black ? 0 : 255;
    const p0 = x * 4;
    pixels[p0] = val;
    pixels[p0 + 1] = val;
    pixels[p0 + 2] = val;
    pixels[p0 + 3] = 255;

    const p1 = (8 + x) * 4;
    pixels[p1] = 255;
    pixels[p1 + 1] = 255;
    pixels[p1 + 2] = 255;
    pixels[p1 + 3] = 255;
  }

  const cmd = encodeMonochromePixelsToEscPos({
    widthDots: 8,
    heightDots: 2,
    rgbaPixels: pixels,
    feedLines: 3,
    autoCut: true,
  });

  // Header: ESC @ (1B 40) + GS v 0 0 (1D 76 30 00) + xL=1 xH=0 yL=2 yH=0
  assert.deepEqual(Array.from(cmd.slice(0, 10)), [0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, 1, 0, 2, 0]);
  // Raster payload bytes
  assert.equal(cmd[10], 0xaa);
  assert.equal(cmd[11], 0x00);
  // Footer: ESC d 3 + GS V 66 0
  assert.deepEqual(Array.from(cmd.slice(12)), [0x1b, 0x64, 3, 0x1d, 0x56, 0x42, 0x00]);
});
