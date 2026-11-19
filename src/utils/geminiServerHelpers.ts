/**
 * Pure server-side helpers for Gemini API key discovery & sanitization,
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
  'gemini-4-hydrogen',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
] as const;

const PLACEHOLDER_KEY_PATTERNS = [
  /^MY_GEMINI_API_KEY$/i,
  /^YOUR_GEMINI_API_KEY$/i,
  /^YOUR_API_KEY$/i,
  /^GEMINI_API_KEY$/i,
  /^REPLACE_ME$/i,
  /^PLACEHOLDER$/i,
  /^undefined$/i,
  /^null$/i,
];

const PRIORITY_ENV_NAMES = [
  'GEMINI_API_KEY',
  'GEMINI_API_KEY_1',
  'GEMINI_API_KEY_2',
  'GEMINI_API_KEY_3',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GOOGLE_GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_GOOGLE_API_KEY',
  'NEXT_PUBLIC_GEMINI_API_KEY',
  'NEXT_PUBLIC_GOOGLE_API_KEY',
  'CAMERA_SCANNER',
  'CAMERA_SCANNER_API_KEY',
  'API_KEY',
] as const;

export function isPlaceholderKeyValue(cleaned: string): boolean {
  if (!cleaned) return false;
  return PLACEHOLDER_KEY_PATTERNS.some((re) => re.test(cleaned));
}

function stripKeyWrappers(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip accidental VAR_NAME=... paste
  cleaned = cleaned.replace(
    /^(?:(?:VITE_|NEXT_PUBLIC_)?(?:GEMINI_API_KEY(?:_\d+)?|GOOGLE_API_KEY|GOOGLE_GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GEMINI_KEY|CAMERA_SCANNER(?:_API_KEY)?|API_KEY))\s*=\s*/i,
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
  return cleaned;
}

/**
 * Cleans an API key read from environment variables by removing accidental
 * surrounding quotes, `KEY=` prefixes, `Bearer ` prefixes, or whitespace/newlines
 * introduced when copy-pasting into Vercel / cloud secrets UIs.
 */
export function sanitizeApiKey(raw?: string | null): string {
  const cleaned = stripKeyWrappers(raw);
  if (!cleaned) return '';
  if (isPlaceholderKeyValue(cleaned)) return '';
  return cleaned;
}

export interface GeminiEnvInspection {
  validKeys: string[];
  matchedEnvNames: string[];
  placeholderEnvNames: string[];
  emptyEnvNames: string[];
  keyLengths: number[];
}

function matchesDynamicGeminiEnvName(trimmedName: string): boolean {
  if (/GEMINI/i.test(trimmedName) && /(?:KEY|TOKEN|SECRET)/i.test(trimmedName)) {
    return true;
  }
  if (/GENAI/i.test(trimmedName) && /(?:KEY|TOKEN|SECRET)/i.test(trimmedName)) {
    return true;
  }
  return false;
}

/**
 * Inspects process.env for all standard and custom Gemini API key variable names
 * (case-insensitive, trimmed), returning sanitized keys plus zero-secret diagnostics
 * so placeholder values or missing Vercel Production variables are clearly identified.
 */
export function inspectGeminiEnv(
  env: Record<string, string | undefined>
): GeminiEnvInspection {
  const validKeys: string[] = [];
  const seenKeys = new Set<string>();
  const matchedEnvNames: string[] = [];
  const placeholderEnvNames: string[] = [];
  const emptyEnvNames: string[] = [];

  const entries = Object.entries(env || {});
  const orderedEntries: Array<[string, string | undefined]> = [];
  const seenEntryNames = new Set<string>();

  // 1. Match priority names first (case-insensitive, trimmed key name)
  for (const targetName of PRIORITY_ENV_NAMES) {
    const upperTarget = targetName.toUpperCase();
    for (const [rawName, val] of entries) {
      if (rawName.trim().toUpperCase() === upperTarget && !seenEntryNames.has(rawName)) {
        seenEntryNames.add(rawName);
        orderedEntries.push([rawName, val]);
      }
    }
  }

  // 2. Match any other custom *GEMINI*KEY* / *GENAI*KEY* env vars
  for (const [rawName, val] of entries) {
    if (seenEntryNames.has(rawName)) continue;
    if (matchesDynamicGeminiEnvName(rawName.trim())) {
      seenEntryNames.add(rawName);
      orderedEntries.push([rawName, val]);
    }
  }

  for (const [rawName, rawVal] of orderedEntries) {
    const label = rawName.trim();
    const unwrapped = stripKeyWrappers(rawVal);
    if (!unwrapped) {
      emptyEnvNames.push(label);
      continue;
    }
    if (isPlaceholderKeyValue(unwrapped)) {
      placeholderEnvNames.push(label);
      continue;
    }
    matchedEnvNames.push(label);
    if (!seenKeys.has(unwrapped)) {
      seenKeys.add(unwrapped);
      validKeys.push(unwrapped);
    }
  }

  return {
    validKeys,
    matchedEnvNames,
    placeholderEnvNames,
    emptyEnvNames,
    keyLengths: validKeys.map((k) => k.length),
  };
}

export function extractUniqueGeminiApiKeys(
  env: Record<string, string | undefined>
): string[] {
  return inspectGeminiEnv(env).validKeys;
}

export function getServerRuntimeLabel(env: Record<string, string | undefined>): string {
  if (env.VERCEL) {
    return `vercel:${env.VERCEL_ENV || 'unknown'}`;
  }
  if (env.K_SERVICE || env.CLOUD_RUN_JOB) {
    return 'cloud-run';
  }
  return 'node';
}

export function buildMissingKeyDiagnosticMessage(
  env: Record<string, string | undefined>
): string {
  const info = inspectGeminiEnv(env);
  const runtime = getServerRuntimeLabel(env);

  if (info.placeholderEnvNames.length > 0) {
    return `Variabel [${info.placeholderEnvNames.join(', ')}] terdeteksi di server (${runtime}), tetapi isinya masih teks placeholder (mis. MY_GEMINI_API_KEY / GEMINI_API_KEY), bukan API Key asli (AIza...) dari Google AI Studio. Ganti nilainya di Environment Variables / Secrets lalu Redeploy.`;
  }

  if (info.emptyEnvNames.length > 0) {
    return `Variabel [${info.emptyEnvNames.join(', ')}] ada di server (${runtime}), tetapi nilainya masih kosong. Isi dengan API Key Gemini asli (AIza...) lalu Redeploy.`;
  }

  if (runtime.startsWith('vercel:')) {
    return `GEMINI_API_KEY belum terpasang di runtime ${runtime}. Buka Vercel → Project Settings → Environment Variables, pastikan GEMINI_API_KEY dicentang untuk Production (dan Preview), klik Save, lalu klik Redeploy pada deployment terbaru.`;
  }

  return `GEMINI_API_KEY belum terpasang di server ini (${runtime}). Nolan tetap bisa jalan mode lokal tanpa key, tetapi Scan Foto AI butuh GEMINI_API_KEY di Secrets / Environment Variables server.`;
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

  if (
    /belum terpasang di (?:server ini|runtime)/i.test(rawMsg) ||
    /masih teks placeholder/i.test(rawMsg) ||
    /nilainya masih kosong/i.test(rawMsg)
  ) {
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
