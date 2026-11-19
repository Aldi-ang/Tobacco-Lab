/**
 * Pure server-side helpers for Gemini API key sanitization,
 * cross-environment model fallback cascades (AI Studio + Vercel),
 * and accurate, key-scrubbed error diagnostics.
 */

export const NOLAN_CLOUD_MODEL_CASCADE = [
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

export const SCAN_GRADE_CARD_MODEL_CASCADE = [
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

const PLACEHOLDER_KEY_PATTERNS = [
  /^MY_GEMINI_API_KEY$/i,
  /^YOUR_GEMINI_API_KEY$/i,
  /^YOUR_API_KEY$/i,
  /^GEMINI_API_KEY$/i,
  /^REPLACE_ME$/i,
  /^undefined$/i,
  /^null$/i,
];

/**
 * Cleans an API key read from environment variables by removing accidental
 * surrounding quotes, `KEY=` prefixes, `Bearer ` prefixes, or whitespace/newlines
 * introduced when copy-pasting into Vercel / cloud secrets UIs.
 */
export function sanitizeApiKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip accidental VAR_NAME=... paste
  cleaned = cleaned.replace(
    /^(?:GEMINI_API_KEY(?:_\d+)?|GOOGLE_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|API_KEY)\s*=\s*/i,
    ''
  );
  // Strip accidental Authorization prefix
  cleaned = cleaned.replace(/^Bearer\s+/i, '');

  // Unwrap repeated surrounding single/double quotes
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length >= 2)
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Remove any accidental line breaks or spaces inside a pasted key
  cleaned = cleaned.replace(/\s+/g, '');

  if (!cleaned) return '';
  if (PLACEHOLDER_KEY_PATTERNS.some((re) => re.test(cleaned))) return '';

  return cleaned;
}

export function extractUniqueGeminiApiKeys(
  env: Record<string, string | undefined>
): string[] {
  const candidates = [
    env.GEMINI_API_KEY,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY_3,
    env.GOOGLE_API_KEY,
    env.GOOGLE_GENERATIVE_AI_API_KEY,
    env.API_KEY,
  ]
    .map((k) => sanitizeApiKey(k))
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

export function looksLikeGoogleApiKey(key: string): boolean {
  return /^AIza[A-Za-z0-9_-]{20,}$/.test(key);
}

/**
 * Redacts any Google API key substring before logging or displaying diagnostics.
 */
export function scrubApiKeysFromText(text: string): string {
  return String(text || '').replace(/AIza[A-Za-z0-9_-]{10,}/g, '[REDACTED_KEY]');
}

/**
 * Extracts a concise, readable upstream error message from Google GenAI SDK errors
 * (which often embed JSON strings inside `error.message`).
 */
export function extractShortUpstreamReason(rawMsg: string): string {
  const scrubbed = scrubApiKeysFromText(rawMsg).trim();
  if (!scrubbed) return '';

  // Try extracting nested `"message":"..."` from SDK JSON payload
  const jsonMsgMatch = scrubbed.match(/"message"\s*:\s*"([^"]{3,260})"/);
  const statusMatch = scrubbed.match(/"status"\s*:\s*"([A-Z_]{3,40})"/);
  const codeMatch = scrubbed.match(/"code"\s*:\s*(\d{3})/);

  if (jsonMsgMatch?.[1]) {
    const prefix = [codeMatch?.[1], statusMatch?.[1]].filter(Boolean).join(' ');
    return prefix ? `${prefix}: ${jsonMsgMatch[1]}` : jsonMsgMatch[1];
  }

  return scrubbed.length > 220 ? `${scrubbed.slice(0, 217)}...` : scrubbed;
}

export function isFatalKeyError(rawMsg: string): boolean {
  return /API_KEY_INVALID|API key not valid|API_KEY_EXPIRED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|API_KEY_SERVICE_BLOCKED/i.test(
    rawMsg
  );
}

/**
 * Translates Gemini Vision / API failures into accurate, actionable Indonesian messages
 * without masking real upstream reasons as "key belum aktif".
 */
export function formatGeminiScanErrorMessage(
  error: unknown,
  attemptSummaries?: string[]
): string {
  const rawMsg = scrubApiKeysFromText(
    error instanceof Error ? error.message : String(error || '')
  );
  const shortDetail = extractShortUpstreamReason(rawMsg);

  if (/belum terpasang di server ini/i.test(rawMsg)) {
    return rawMsg;
  }

  if (/API_KEY_HTTP_REFERRER_BLOCKED|referer|HTTP referrer/i.test(rawMsg)) {
    return `GEMINI_API_KEY diblokir oleh aturan Website/HTTP Referrer di Google Cloud. Untuk server Vercel, ubah Application Restrictions menjadi "None" pada API Key tersebut. (${shortDetail})`;
  }

  if (/API_KEY_SERVICE_BLOCKED|Generative Language API has not been used|SERVICE_DISABLED/i.test(rawMsg)) {
    return `Generative Language API belum diaktifkan pada project Google Cloud milik API Key ini. Aktifkan "Generative Language API" atau buat key baru langsung dari aistudio.google.com/apikey. (${shortDetail})`;
  }

  if (/API_KEY_INVALID|API key not valid|API_KEY_EXPIRED/i.test(rawMsg)) {
    return `Isi GEMINI_API_KEY ditolak Google sebagai tidak valid/kedaluwarsa. Pastikan key di Vercel Environment Variables disalin utuh tanpa typo dan belum dihapus di Google AI Studio. (${shortDetail})`;
  }

  if (/Unable to process input image/i.test(rawMsg) || (/INVALID_ARGUMENT/i.test(rawMsg) && !/API_KEY/i.test(rawMsg))) {
    return 'Format foto tidak dapat dibaca oleh server AI. Coba ambil ulang foto tegak lurus yang terang atau unggah JPEG/PNG dari galeri.';
  }

  if (/RESOURCE_EXHAUSTED|429|quota/i.test(rawMsg)) {
    return `Kuota / antrean Gemini API sedang penuh sementara (429). Tunggu beberapa detik lalu coba scan ulang. (${shortDetail})`;
  }

  if (/Timeout|Exceeded max wait/i.test(rawMsg)) {
    return 'Server AI melebihi batas waktu membaca foto. Coba dekatkan kamera ke kartu dan pastikan jaringan stabil.';
  }

  if (/PERMISSION_DENIED|NOT_FOUND|403|404/i.test(rawMsg)) {
    const modelsTried =
      attemptSummaries && attemptSummaries.length > 0
        ? ` | Model dicoba: ${attemptSummaries.slice(-3).join('; ')}`
        : '';
    return `Akses model AI ditolak oleh Google untuk GEMINI_API_KEY ini. Pastikan key dibuat dari Google AI Studio (aistudio.google.com/apikey) tanpa pembatasan model/billing yang terblokir. [Detail: ${shortDetail}${modelsTried}]`;
  }

  return shortDetail
    ? `Gagal membaca foto Kartu Grade: ${shortDetail}`
    : 'Gagal memproses foto Kartu Grade dengan Scanner AI.';
}
