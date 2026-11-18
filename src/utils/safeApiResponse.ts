export interface ParsedApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  data: T | null;
  errorMessage?: string;
}

/**
 * Safely parses an HTTP API response text without calling native `response.json()`
 * directly on non-JSON error pages (which causes WebKit/iOS Safari to throw the
 * cryptic `"The string did not match the expected pattern."` SyntaxError).
 */
export function parseSafeApiResponseText<T = Record<string, unknown>>(params: {
  ok: boolean;
  status: number;
  rawText: string;
  fallbackError?: string;
}): ParsedApiResponse<T> {
  const { ok, status, rawText, fallbackError = 'Gagal terhubung ke server.' } = params;
  const trimmed = String(rawText || '').trim();

  let parsed: T | null = null;
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed) as T;
    } catch {
      parsed = null;
    }
  }

  if (!ok) {
    const parsedObj =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const serverErr =
      parsedObj && typeof parsedObj.error === 'string' && parsedObj.error.trim()
        ? parsedObj.error.trim()
        : parsedObj && typeof parsedObj.message === 'string' && parsedObj.message.trim()
        ? parsedObj.message.trim()
        : '';

    if (serverErr) {
      return { ok: false, data: parsed, errorMessage: serverErr };
    }
    if (status === 413) {
      return {
        ok: false,
        data: null,
        errorMessage:
          'Ukuran foto terlalu besar untuk dikirim ke server. Coba foto ulang dari jarak sedikit lebih jauh.',
      };
    }
    if (status === 504 || status === 502 || status === 408) {
      return {
        ok: false,
        data: null,
        errorMessage:
          'Server AI terlalu lama merespons (Timeout). Silakan coba scan ulang dalam beberapa detik.',
      };
    }
    const plainSnippet = trimmed
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return {
      ok: false,
      data: null,
      errorMessage: plainSnippet
        ? `${fallbackError} (HTTP ${status}: ${plainSnippet})`
        : `${fallbackError} (HTTP ${status})`,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      data: null,
      errorMessage:
        'Server mengembalikan respons non-JSON (kemungkinan halaman sedang dimuat ulang atau rute API belum aktif).',
    };
  }

  return { ok: true, data: parsed };
}

/**
 * Maps cryptic WebKit/Safari regex/pattern SyntaxErrors into clear user-facing guidance.
 */
export function formatScannerClientError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (!msg) return fallback;
  if (/expected pattern/i.test(msg)) {
    return 'Format gambar atau respons server tidak dikenali browser HP. Coba ambil foto ulang atau gunakan Upload Foto dari Galeri.';
  }
  return msg;
}
