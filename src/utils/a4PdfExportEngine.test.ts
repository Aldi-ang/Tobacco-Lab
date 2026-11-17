import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfDocumentFromJpegPages } from './a4PdfExportEngine';

test('buildPdfDocumentFromJpegPages produces valid multi-page A4 PDF 1.4 binary', () => {
  const fakeJpeg1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const fakeJpeg2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0xff, 0xd9]);

  const pdfBytes = buildPdfDocumentFromJpegPages([
    { jpegBytes: fakeJpeg1, pixelWidth: 1654, pixelHeight: 2339 },
    { jpegBytes: fakeJpeg2, pixelWidth: 1654, pixelHeight: 2339 },
  ]);

  const text = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(text.startsWith('%PDF-1.4\n'), 'Must start with PDF 1.4 header');
  assert.match(text, /\/Type \/Catalog \/Pages 2 0 R/);
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /xref\n0 9\n/);
  assert.ok(text.trimEnd().endsWith('%%EOF'), 'Must end with %%EOF trailer');
});
