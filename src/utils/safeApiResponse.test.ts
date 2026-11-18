import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatScannerClientError,
  parseSafeApiResponseText,
} from './safeApiResponse';

test('parseSafeApiResponseText parses valid JSON 200 payload', () => {
  const res = parseSafeApiResponseText<{ cards: unknown[]; detectedCount: number }>({
    ok: true,
    status: 200,
    rawText: '{"detectedCount":1,"cards":[{"lotNumber":"MTL001"}]}',
  });
  assert.equal(res.ok, true);
  assert.equal(res.data?.detectedCount, 1);
});

test('parseSafeApiResponseText handles Vercel 504 plain-text timeout without throwing', () => {
  const res = parseSafeApiResponseText({
    ok: false,
    status: 504,
    rawText: 'An error occurred with your deployment\nFUNCTION_INVOCATION_TIMEOUT',
  });
  assert.equal(res.ok, false);
  assert.match(res.errorMessage || '', /Timeout/i);
});

test('parseSafeApiResponseText handles 413 Request Entity Too Large HTML/text cleanly', () => {
  const res = parseSafeApiResponseText({
    ok: false,
    status: 413,
    rawText: 'Request Entity Too Large',
  });
  assert.equal(res.ok, false);
  assert.match(res.errorMessage || '', /Ukuran foto terlalu besar/i);
});

test('parseSafeApiResponseText handles HTTP 200 HTML rewrite fallback safely', () => {
  const res = parseSafeApiResponseText({
    ok: true,
    status: 200,
    rawText: '<!doctype html><html><body>SPA Fallback</body></html>',
  });
  assert.equal(res.ok, false);
  assert.match(res.errorMessage || '', /non-JSON/i);
});

test('formatScannerClientError translates Safari expected-pattern error into clear guidance', () => {
  const msg = formatScannerClientError(
    new SyntaxError('The string did not match the expected pattern.'),
    'Fallback'
  );
  assert.match(msg, /Format gambar atau respons server/i);
});

test('parseSafeApiResponseText surfaces sanitized plain-text snippet on HTTP 500', () => {
  const res = parseSafeApiResponseText({
    ok: false,
    status: 500,
    rawText: '<html><body>A server error has occurred: FUNCTION_INVOCATION_FAILED</body></html>',
    fallbackError: 'Gagal memproses foto Kartu Grade di server AI.',
  });
  assert.equal(res.ok, false);
  assert.match(res.errorMessage || '', /HTTP 500: A server error has occurred/);
});

test('parseSafeApiResponseText extracts message field when error key is absent on 500', () => {
  const res = parseSafeApiResponseText({
    ok: false,
    status: 500,
    rawText: '{"message":"Internal server error: invalid payload"}',
    fallbackError: 'Gagal memproses foto Kartu Grade di server AI.',
  });
  assert.equal(res.ok, false);
  assert.equal(res.errorMessage, 'Internal server error: invalid payload');
});
