import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOLAN_CLOUD_MODEL_CASCADE,
  SCAN_GRADE_CARD_MODEL_CASCADE,
  extractUniqueGeminiApiKeys,
  formatGeminiScanErrorMessage,
  isFatalKeyError,
  looksLikeGoogleApiKey,
  sanitizeApiKey,
  scrubApiKeysFromText,
} from './geminiServerHelpers.ts';

test('sanitizeApiKey strips quotes, whitespace, newlines, and accidental VAR= prefixes', () => {
  assert.equal(sanitizeApiKey('  "AIzaSyTestKey12345678901234567890"  '), 'AIzaSyTestKey12345678901234567890');
  assert.equal(sanitizeApiKey("'AIzaSyTestKey12345678901234567890'"), 'AIzaSyTestKey12345678901234567890');
  assert.equal(
    sanitizeApiKey('GEMINI_API_KEY="AIzaSyTestKey12345678901234567890"\n'),
    'AIzaSyTestKey12345678901234567890'
  );
  assert.equal(sanitizeApiKey('Bearer AIzaSyTestKey12345678901234567890'), 'AIzaSyTestKey12345678901234567890');
  assert.equal(sanitizeApiKey('MY_GEMINI_API_KEY'), '');
  assert.equal(sanitizeApiKey('YOUR_API_KEY'), '');
  assert.equal(sanitizeApiKey('   '), '');
});

test('extractUniqueGeminiApiKeys reads all aliases, sanitizes, and deduplicates', () => {
  const keys = extractUniqueGeminiApiKeys({
    GEMINI_API_KEY: '"AIzaSyPrimaryKey1234567890123456"',
    GOOGLE_API_KEY: 'AIzaSyPrimaryKey1234567890123456',
    GOOGLE_GENERATIVE_AI_API_KEY: 'AIzaSySecondaryKey12345678901234',
    API_KEY: 'MY_GEMINI_API_KEY',
  });
  assert.deepEqual(keys, [
    'AIzaSyPrimaryKey1234567890123456',
    'AIzaSySecondaryKey12345678901234',
  ]);
  assert.equal(looksLikeGoogleApiKey(keys[0]), true);
});

test('model cascades avoid deprecated models and include Vercel-compatible public fallbacks', () => {
  const prohibited = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking',
  ];
  for (const list of [SCAN_GRADE_CARD_MODEL_CASCADE, NOLAN_CLOUD_MODEL_CASCADE]) {
    for (const bad of prohibited) {
      assert.equal((list as readonly string[]).includes(bad), false, `Must not contain ${bad}`);
    }
    assert.equal((list as readonly string[]).includes('gemini-2.5-flash'), true);
    assert.equal((list as readonly string[]).includes('gemini-3.1-flash-lite'), true);
  }
});

test('formatGeminiScanErrorMessage differentiates HTTP referrer blocks, invalid keys, and model permission errors without leaking keys', () => {
  const fakeKey = 'AIzaSySecretKeyLeakCheck999999999999';

  const referrerErr = formatGeminiScanErrorMessage(
    new Error(`{"error":{"code":403,"message":"Requests from referer <empty> are blocked for ${fakeKey}.","status":"PERMISSION_DENIED","reason":"API_KEY_HTTP_REFERRER_BLOCKED"}}`)
  );
  assert.match(referrerErr, /HTTP Referrer/i);
  assert.equal(referrerErr.includes(fakeKey), false);

  const invalidKeyErr = formatGeminiScanErrorMessage(
    new Error(`{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","reason":"API_KEY_INVALID"}}`)
  );
  assert.match(invalidKeyErr, /tidak valid/i);
  assert.equal(isFatalKeyError('API_KEY_INVALID'), true);

  const modelPermErr = formatGeminiScanErrorMessage(
    new Error('{"error":{"code":403,"message":"Permission denied on model gemini-4-hydrogen","status":"PERMISSION_DENIED"}}'),
    ['gemini-3.1-flash-lite: 404 NOT_FOUND', 'gemini-4-hydrogen: 403 PERMISSION_DENIED']
  );
  assert.match(modelPermErr, /Permission denied on model gemini-4-hydrogen/);
  assert.match(modelPermErr, /gemini-3\.1-flash-lite/);

  assert.equal(scrubApiKeysFromText(`key=${fakeKey}`), 'key=[REDACTED_KEY]');
});
