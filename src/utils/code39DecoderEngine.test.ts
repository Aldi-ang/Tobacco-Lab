import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCode39TotalUnits, encodeCode39Modules } from './thermalPrintEngine';
import { decodeCode39FromRgba } from './code39DecoderEngine';

function renderSyntheticBarcodeRgba(
  codes: string[],
  unitPx = 3,
  reverseHorizontally = false
): { rgba: Uint8ClampedArray; width: number; height: number } {
  const maxBarW = Math.max(
    ...codes.map((c) => computeCode39TotalUnits(encodeCode39Modules(c)) * unitPx)
  );
  const stripWidth = Math.max(460, maxBarW + 80);
  const totalW = codes.length * stripWidth;
  const height = 80;
  const rgba = new Uint8ClampedArray(totalW * height * 4);
  rgba.fill(255); // solid white background + alpha 255

  const drawRect = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < Math.min(height, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(totalW, x0 + w); x++) {
        const px = reverseHorizontally ? totalW - 1 - x : x;
        const idx = (y * totalW + px) * 4;
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 255;
      }
    }
  };

  codes.forEach((code, cIdx) => {
    const runs = encodeCode39Modules(code);
    const totalUnits = computeCode39TotalUnits(runs);
    const barW = totalUnits * unitPx;
    const baseX = cIdx * stripWidth + Math.floor((stripWidth - barW) / 2);

    // Outer frame border (just like printed card & thermal strip)
    drawRect(cIdx * stripWidth + 10, 4, 2, height - 8);
    drawRect((cIdx + 1) * stripWidth - 12, 4, 2, height - 8);

    let cursor = baseX;
    for (const run of runs) {
      const w = run.units * unitPx;
      if (run.isBar) {
        drawRect(cursor, 16, w, 48);
      }
      cursor += w;
    }
  });

  return { rgba, width: totalW, height };
}

test('decodeCode39FromRgba decodes custom thermal barcodes MTL001, MTL002, MTL003 accurately', () => {
  const { rgba, width, height } = renderSyntheticBarcodeRgba(
    ['MTL001', 'MTL002', 'MTL003'],
    3
  );
  const decoded = decodeCode39FromRgba(rgba, width, height);
  assert.equal(decoded.includes('MTL001'), true);
  assert.equal(decoded.includes('MTL002'), true);
  assert.equal(decoded.includes('MTL003'), true);
});

test('decodeCode39FromRgba decodes hyphenated LOT numbers and upside-down 180deg cards', () => {
  const { rgba, width, height } = renderSyntheticBarcodeRgba(
    ['LOT-261115-701'],
    2,
    true // horizontally mirrored / upside-down
  );
  const decoded = decodeCode39FromRgba(rgba, width, height);
  assert.equal(decoded.includes('LOT-261115-701'), true);
});
