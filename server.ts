import express, { type Request, type Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
let BRAINS_DIR = path.resolve(process.cwd(), 'data', 'nolan-brains');

try {
  if (!fs.existsSync(BRAINS_DIR)) {
    fs.mkdirSync(BRAINS_DIR, { recursive: true });
  }
} catch {
  BRAINS_DIR = path.join(os.tmpdir(), 'nolan-brains');
  try {
    fs.mkdirSync(BRAINS_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function getGeminiApiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GOOGLE_API_KEY,
  ]
    .map((k) => (k || '').trim())
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function getGeminiClient(apiKeyOverride?: string): GoogleGenAI {
  const keys = getGeminiApiKeys();
  const activeKey = apiKeyOverride || keys[0] || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: activeKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 24/7 Official Multi-Model Cascade (from @google/genai skill):
const NOLAN_24X7_MODEL_CASCADE = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
] as const;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout (${timeoutMs}ms) on ${label}`));
    }, timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function generateWith24x7Fallback(params: {
  contents: string;
  config: Record<string, any>;
  maxTotalWaitMs?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKeys = getGeminiApiKeys();
  const keysToTry = apiKeys.length > 0 ? apiKeys : [undefined];
  const maxTotalWaitMs = params.maxTotalWaitMs ?? 12000;
  const startAll = Date.now();
  let lastError: unknown = null;

  for (const key of keysToTry) {
    const ai = getGeminiClient(key);
    for (let i = 0; i < NOLAN_24X7_MODEL_CASCADE.length; i++) {
      if (Date.now() - startAll >= maxTotalWaitMs) {
        throw lastError || new Error('Exceeded max wait budget, switching to Local Engine.');
      }
      const modelName = NOLAN_24X7_MODEL_CASCADE[i];
      const modelConfig =
        modelName === 'gemini-3.8-flash'
          ? {
              ...params.config,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            }
          : params.config;

      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: params.contents,
            config: modelConfig,
          }),
          6000,
          modelName
        );
        const text = (response.text ?? '').trim();
        if (text) {
          return { text, modelUsed: modelName };
        }
      } catch (err: any) {
        lastError = err;
        continue;
      }
    }
  }

  throw lastError || new Error('All Gemini model pools temporarily busy.');
}

const SERVER_ALL_GRADES = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E+', 'E', 'F+', 'F'];
const SERVER_REGIONS = [
  'muntilan',
  'temanggung',
  'madura',
  'pamekasan',
  'sumenep',
  'sampang',
  'bojonegoro',
  'jember',
  'bondowoso',
  'boyolali',
  'klaten',
  'kendal',
  'weleri',
  'garut',
  'sumedang',
  'majalengka',
  'lombok',
  'banyuwangi',
  'lumajang',
  'probolinggo',
  'pasuruan',
  'malang',
  'blitar',
  'tulungagung',
  'kediri',
  'ngawi',
  'magelang',
  'wonosobo',
];

function humanizeServerText(input: string): string {
  if (!input) return '';
  let text = String(input);

  // Strip code fences and backticks
  text = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, ''));
  text = text.replace(/`([^`]+)`/g, '$1');

  // Strip markdown headings (#, ##, ###)
  text = text.replace(/^\s*#{1,6}\s+/gm, '');

  // Strip bold/italic stars (**text**, *text*, __text__)
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');

  // Remove stray asterisks used as bullets or leftover markers
  text = text.replace(/^\s*\*\s+/gm, '• ');
  text = text.replace(/^\s*-\s+/gm, '• ');
  text = text.replace(/\*\*/g, '');

  // Strip blockquote markers ">"
  text = text.replace(/^\s*>\s?/gm, '');

  // Remove stiff AI openings (blader/humanizer rule)
  text = text.replace(
    /^(Berdasarkan data yang tersedia,?\s*|Tentu saja!?\s*|Tentu,?\s*|Berikut adalah rincian(nya)?:?\s*|Sebagai asisten AI( Anda)?,?\s*)/i,
    ''
  );

  // Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function detectQueriedGradeServer(rawText: string): string | null {
  const clean = rawText.trim();
  const explicitMatch = clean.match(
    /\b(?:tembakau|grade|grd|kelas|stok|bahan|tipe|jenis|yang|seri)\s+([A-Fa-f]\+?)(?:\b|$|\?|\.|,)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const c = explicitMatch[1].toUpperCase();
    if (SERVER_ALL_GRADES.includes(c)) return c;
  }
  const plusMatch = clean.match(/\b([A-Fa-f]\+)(?:\b|$|\?|\.|,)/);
  if (plusMatch && plusMatch[1]) {
    const c = plusMatch[1].toUpperCase();
    if (SERVER_ALL_GRADES.includes(c)) return c;
  }
  const endLetterMatch = clean.match(/\b(?:punya|ada|cari|butuh)\s+([A-Fa-f])(?:\s*\?|$)/i);
  if (endLetterMatch && endLetterMatch[1]) {
    const c = endLetterMatch[1].toUpperCase();
    if (SERVER_ALL_GRADES.includes(c)) return c;
  }
  return null;
}

function detectNavigationServer(rawText: string): { target: string; label: string } | null {
  const q = rawText.toLowerCase().trim();
  const hasNavVerb =
    /\b(buka|ke\s+menu|pindah|tampilkan|lihat|masuk\s+ke|pergi\s+ke|navigasi|bukain|tolong\s+buka|arahkan|ganti\s+ke)\b/i.test(
      q
    );

  if (!hasNavVerb) return null;

  if (/\b(input\s+stok|tambah\s+stok\s+manual|form\s+input|modal\s+input)\b/i.test(q)) {
    return { target: 'input_raw_modal', label: 'Form Input Stok Mentah Baru' };
  }
  if (/\b(simulator|simulasi|hitung\s+cepat)\b/i.test(q)) {
    return { target: 'simulator', label: 'Simulator' };
  }
  if (/\b(kalkulator|racik|racikan|campuran|blending)\b/i.test(q) && !/\b(buatkan|rekomendasi|racikkan)\b/i.test(q)) {
    return { target: 'calculator', label: 'Kalkulator Racikan' };
  }
  if (/\b(stok\s+jadi|eks\s*reject|barang\s+reject|panel\s+2)\b/i.test(q)) {
    return { target: 'inventory_rejected', label: 'Stok Tembakau Jadi (Eks-Reject)' };
  }
  if (/\b(gulungan|sampel\s+gulungan|arsip\s+gulungan)\b/i.test(q)) {
    return { target: 'rolls', label: 'Menu Gulungan (Gudang)' };
  }
  if (/\b(status\s+barang|seri\s+jadi|kiriman\s+pabrik|barang\s+pabrik)\b/i.test(q)) {
    return { target: 'finished', label: 'Menu Status Barang (Pabrik)' };
  }
  if (/\b(riwayat|history|laporan|jurnal)\b/i.test(q)) {
    return { target: 'history', label: 'Menu Riwayat & Laporan' };
  }
  if (/\b(setting|pengaturan|setelan|master\s+data|konfigurasi)\b/i.test(q)) {
    return { target: 'settings', label: 'Menu Pengaturan (Settings)' };
  }
  if (/\b(google\s+sheet|spreadsheet|ekspor\s+sheet)\b/i.test(q)) {
    return { target: 'google_sheets', label: ' Sinkronisasi Google Sheets' };
  }
  if (/\b(backup|cadangkan)\b/i.test(q)) {
    return { target: 'backup', label: 'Menu Backup Data' };
  }
  if (/\b(restore|pulihkan)\b/i.test(q)) {
    return { target: 'restore', label: 'Menu Restore Data' };
  }
  if (/\b(stok\s+gudang|gudang|inventori|bahan\s+mentah|stok\s+mentah)\b/i.test(q)) {
    return { target: 'inventory', label: 'Menu Stok Gudang Mentah' };
  }
  return null;
}

function parseNumberFromIndoServer(raw: string): number | null {
  const clean = raw.toLowerCase().trim();
  const rbMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)/i);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1].replace(',', '.')) * 1000);
  }
  const jtMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/i);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1].replace(',', '.')) * 1000000);
  }
  const plainMatch = clean.replace(/\./g, '').match(/(\d+(?:,\d+)?)/);
  if (plainMatch) {
    return Number(plainMatch[1].replace(',', '.'));
  }
  return null;
}

function detectPendingActionServer(params: {
  rawText: string;
  rawTobaccos: any[];
  finishedBatches: any[];
}): any | null {
  const { rawText, rawTobaccos, finishedBatches } = params;
  const q = rawText.toLowerCase().trim();

  // 1. ADD NEW RAW TOBACCO
  const isAddIntent =
    /\b(tambah(?:kan)?|input(?:kan)?|masukkan|catat\s+barang\s+baru|beli\s+tembakau\s+baru|tambah\s+stok\s+baru|tambah\s+item)\b/i.test(
      q
    ) && !/\b(aturan|memori|pengaturan)\b/i.test(q);

  if (isAddIntent) {
    const kgMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
    const grossWeightKg = kgMatch ? Number(kgMatch[1].replace(',', '.')) : 50;

    let pricePerKgPurchase = 85000;
    const priceMatch =
      rawText.match(/harga\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:rb|ribu|jt|juta)?)/i) ||
      rawText.match(/rp\.?\s*(\d+(?:[.,]\d+)?\s*(?:rb|ribu)?)/i) ||
      rawText.match(/(\d+\s*(?:rb|ribu))\s*(?:\/kg|per\s*kg)?/i);
    if (priceMatch && priceMatch[1]) {
      const parsedPrice = parseNumberFromIndoServer(priceMatch[1]);
      if (parsedPrice && parsedPrice >= 1000) {
        pricePerKgPurchase = parsedPrice;
      }
    }

    const gradeMatch = rawText.match(/\bgrade\s+([A-Fa-f]\+?)\b/i);
    const colorGrade = gradeMatch && SERVER_ALL_GRADES.includes(gradeMatch[1].toUpperCase())
      ? gradeMatch[1].toUpperCase()
      : 'D';

    const matchedRegion = SERVER_REGIONS.find((reg) => q.includes(reg));
    const origin = matchedRegion
      ? matchedRegion.charAt(0).toUpperCase() + matchedRegion.slice(1)
      : 'Muntilan';

    let extractedName = rawText
      .replace(
        /^(nolan\s*,?\s*)?(tolong\s+)?(tambah(?:kan)?|input(?:kan)?|masukkan)\s+(tembakau|stok|bahan|barang|item)?\s*(baru)?\s*/i,
        ''
      )
      .split(/\b(?:grade|berat|bruto|netto|harga|sebanyak|seberat|asal|daerah|rp|\d+\s*kg)\b/i)[0]
      .replace(/[,:-]+$/g, '')
      .trim();

    if (!extractedName || extractedName.length < 2) {
      extractedName = `Tembakau ${origin} ${colorGrade}`;
    }

    return {
      id: `act-add-raw-${Date.now()}`,
      type: 'ADD_RAW_TOBACCO',
      title: `Tambah Stok Baru: ${extractedName}`,
      summary: `Menambahkan ${extractedName} (${origin} • Grade ${colorGrade}) seberat ${grossWeightKg} kg dengan harga beli Rp ${pricePerKgPurchase.toLocaleString('id-ID')}/kg ke Gudang Mentah.`,
      status: 'pending',
      newRawTobacco: {
        name: extractedName,
        origin,
        sellerName: 'Petani / Agen Lokal',
        colorGrade,
        grossWeightKg,
        pricePerKgPurchase,
        packagingType: 'Keranjang',
        packagingMassKg: 3,
        taraPercent: 0,
        taraFlatKg: 3,
        powerRating: 3.8,
        impactRating: 3.8,
        bitterRating: 3.5,
        burnRating: 4.5,
        sugarRating: 4.0,
        aromaRating: 4.2,
        characterNotes: 'Diinput melalui perintah Nolan AI',
      },
    };
  }

  // 2. EDIT EXISTING RAW TOBACCO
  const isEditRawIntent =
    /\b(ubah|ganti|edit|update|revisi|koreksi)\b/i.test(q) &&
    (q.includes('harga') || q.includes('stok') || q.includes('sisa') || q.includes('berat') || q.includes('grade'));

  if (isEditRawIntent && rawTobaccos.length > 0) {
    const targetRaw = rawTobaccos.find(
      (t: any) =>
        (t.name && q.includes(String(t.name).toLowerCase())) ||
        (t.origin && q.includes(String(t.origin).toLowerCase()))
    );
    if (targetRaw) {
      const updates: any = {};
      const changeDesc: string[] = [];

      if (q.includes('harga')) {
        const pMatch =
          rawText.match(/(?:jadi|ke|menjadi|harga)\s*(?:rp\.?\s*)?(\d+(?:[.,]\d+)?\s*(?:rb|ribu)?)/i) ||
          rawText.match(/(\d+\s*(?:rb|ribu))/i);
        if (pMatch && pMatch[1]) {
          const val = parseNumberFromIndoServer(pMatch[1]);
          if (val && val >= 1000) {
            updates.pricePerKgPurchase = val;
            changeDesc.push(`Harga Beli → Rp ${val.toLocaleString('id-ID')}/kg`);
          }
        }
      }

      if (q.includes('stok') || q.includes('sisa') || q.includes('berat')) {
        const kgMatch = rawText.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
        if (kgMatch) {
          const valKg = Number(kgMatch[1].replace(',', '.'));
          updates.currentStockNetKg = valKg;
          changeDesc.push(`Sisa Stok Bersih → ${valKg} kg`);
        }
      }

      const gMatch = rawText.match(/\bgrade\s+([A-Fa-f]\+?)\b/i);
      if (gMatch && SERVER_ALL_GRADES.includes(gMatch[1].toUpperCase())) {
        const nextG = gMatch[1].toUpperCase();
        updates.colorGrade = nextG;
        changeDesc.push(`Grade → ${nextG}`);
      }

      if (changeDesc.length > 0) {
        return {
          id: `act-edit-raw-${Date.now()}`,
          type: 'EDIT_RAW_TOBACCO',
          title: `Edit Data Stok: ${targetRaw.name}`,
          summary: `Memperbarui ${targetRaw.name} (${targetRaw.origin}): ${changeDesc.join(' • ')}`,
          status: 'pending',
          editRawTobacco: {
            tobaccoId: targetRaw.id,
            tobaccoName: targetRaw.name,
            updates,
          },
        };
      }
    }
  }

  // 3. UPDATE FACTORY STATUS OF A SERIAL
  const isStatusUpdateIntent =
    /\b(accepted|diterima|acc\b|reject|tolak|ditolak)\b/i.test(q) &&
    /\b(seri|nomor\s+seri|kiriman|status|ubah|jadikan|set|tandai)\b/i.test(q);

  if (isStatusUpdateIntent && finishedBatches.length > 0) {
    const matchedSerial =
      finishedBatches.find(
        (b: any) => b.serialNumber && q.includes(String(b.serialNumber).toLowerCase())
      ) || finishedBatches[0];

    if (matchedSerial) {
      const nextStatus = /\b(reject|tolak|ditolak)\b/i.test(q)
        ? 'REJECTED_STOCK'
        : 'ACCEPTED_CAIR';
      const statusLabel =
        nextStatus === 'ACCEPTED_CAIR'
          ? 'Diterima Pabrik (Accepted)'
          : 'Reject (Masuk Stok Jadi)';

      return {
        id: `act-serial-status-${Date.now()}`,
        type: 'UPDATE_FACTORY_STATUS',
        title: `Ubah Status Seri ${matchedSerial.serialNumber}`,
        summary: `Mengubah status Seri ${matchedSerial.serialNumber} (${matchedSerial.recipeName} • ${matchedSerial.targetFactory}) menjadi ${statusLabel}.`,
        status: 'pending',
        updateSerialStatus: {
          serialId: matchedSerial.id,
          serialNumber: matchedSerial.serialNumber,
          factoryStatus: nextStatus,
        },
      };
    }
  }

  return null;
}

// ============================================================================
// DETERMINISTIC 24/7 SMART ENGINE (Self-contained in server.ts for Cloud Run)
// ============================================================================
function buildDeterministicNolanFallback(params: {
  message: string;
  rawTobaccos: any[];
  finishedBatches: any[];
  rollSamples: any[];
  nolanMemory: any;
}) {
  const { message, rawTobaccos = [], finishedBatches = [], rollSamples = [], nolanMemory } = params;
  const rawText = String(message || '').trim();
  const q = rawText.toLowerCase().replace(/\s+/g, ' ');

  const availableRaw = rawTobaccos.filter((t: any) => (Number(t.currentStockNetKg) || 0) > 0);
  const totalRawStockKg = Number(
    availableRaw.reduce((s: number, t: any) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)
  );
  const totalModalGudangRp = Math.round(
    rawTobaccos.reduce((acc: number, t: any) => acc + (Number(t.totalModalAsal) || 0), 0)
  );
  const totalWeightProfitRp = Math.round(
    rawTobaccos.reduce((acc: number, t: any) => acc + (Number(t.purchaseWeightProfitRp) || 0), 0)
  );
  const totalWeightProfitKg = Number(
    rawTobaccos.reduce((acc: number, t: any) => acc + (Number(t.purchaseWeightProfitKg) || 0), 0).toFixed(1)
  );

  const byGrade = new Map<string, { count: number; netKg: number }>();
  const byOrigin = new Map<string, { count: number; netKg: number }>();
  for (const t of availableRaw) {
    const g = String(t.colorGrade || 'D').toUpperCase();
    const curG = byGrade.get(g) || { count: 0, netKg: 0 };
    curG.count += 1;
    curG.netKg = Number((curG.netKg + (Number(t.currentStockNetKg) || 0)).toFixed(1));
    byGrade.set(g, curG);

    const o = String(t.origin || 'Lainnya').trim();
    const curO = byOrigin.get(o) || { count: 0, netKg: 0 };
    curO.count += 1;
    curO.netKg = Number((curO.netKg + (Number(t.currentStockNetKg) || 0)).toFixed(1));
    byOrigin.set(o, curO);
  }

  const availableGradesSummary =
    byGrade.size > 0
      ? Array.from(byGrade.entries())
          .map(([g, info]) => `Grade ${g} (${info.count} bahan • ${info.netKg} kg)`)
          .join(', ')
      : 'Belum ada stok aktif';

  const acceptedSerials = finishedBatches.filter((b: any) => b.factoryStatus === 'ACCEPTED_CAIR');
  const rejectedSerials = finishedBatches.filter((b: any) => b.factoryStatus === 'REJECTED_STOCK');
  const pendingSerials = finishedBatches.filter(
    (b: any) =>
      !b.factoryStatus || b.factoryStatus === 'PENDING' || b.factoryStatus === 'WAITING_FACTORY'
  );

  const totalNotaRp = Math.round(
    finishedBatches
      .filter((b: any) => b.factoryStatus !== 'REJECTED_STOCK')
      .reduce((s: number, b: any) => s + (Number(b.projectedRevenue) || 0), 0)
  );
  const totalProfitRp = Math.round(
    finishedBatches
      .filter((b: any) => b.factoryStatus !== 'REJECTED_STOCK')
      .reduce(
        (s: number, b: any) =>
          s + ((Number(b.projectedRevenue) || 0) - (Number(b.totalProductionCost) || 0)),
        0
      )
  );

  const formatLines = (items: any[], limit = 10) =>
    items.length > 0
      ? items
          .slice(0, limit)
          .map(
            (t: any, idx: number) =>
              `${idx + 1}. 🌿 ${t.name} (Grade ${t.colorGrade} • ${t.origin}) — Sisa ${t.currentStockNetKg} kg | HPP Rp ${(Number(t.realCostPerNetKg) || 0).toLocaleString('id-ID')}/kg`
          )
          .join('\n')
      : 'Belum ada stok tembakau mentah yang aktif (0 kg).';

  // 1. Check autonomous navigation first
  const navIntent = detectNavigationServer(rawText);
  // 2. Check permission-gated add/edit/status action
  const pendingAction = detectPendingActionServer({
    rawText,
    rawTobaccos,
    finishedBatches,
  });

  if (pendingAction) {
    return {
      handledInstantly: true,
      replyMarkdown: humanizeServerText(
        [
          `✍️ Siap Bos, saya sudah siapkan draf perubahan datanya:`,
          ``,
          `📌 ${pendingAction.title}`,
          `${pendingAction.summary}`,
          ``,
          `Silakan klik tombol Izinkan & Terapkan di bawah kalau sudah sesuai, atau bilang "Ya setuju" lewat suara/chat.`,
        ].join('\n')
      ),
      newLearnedRule: '',
      hasRecommendation: false,
      recommendedBlend: null,
      navigateTo: navIntent?.target || null,
      pendingAction,
      learnedRulesCount: (nolanMemory?.learnedRules || []).length,
    };
  }

  if (navIntent) {
    return {
      handledInstantly: true,
      replyMarkdown: humanizeServerText(
        `🧭 Siap Bos! Langsung saya bukakan ${navIntent.label} sekarang.`
      ),
      newLearnedRule: '',
      hasRecommendation: false,
      recommendedBlend: null,
      navigateTo: navIntent.target,
      pendingAction: null,
      learnedRulesCount: (nolanMemory?.learnedRules || []).length,
    };
  }

  const isQuestionText =
    rawText.includes('?') ||
    /^(apakah|apa\b|ada\s+berapa|berapa|mana\b|siapa|kapan|gimana|bagaimana|cek\b|lihat|tampilkan|hitung|cari\b|punya\b|ada\s+tembakau|ada\s+stok|ada\s+grade|ada\s+barang)/i.test(
      rawText
    );

  const hasExplicitTeachingKeyword =
    q.startsWith('ingat') ||
    q.startsWith('catat') ||
    q.startsWith('simpan') ||
    q.startsWith('pelajari') ||
    q.startsWith('tolong ingat') ||
    q.startsWith('tolong catat') ||
    q.includes('aturan baru') ||
    q.includes('jangan pernah') ||
    q.includes('patokan') ||
    q.includes('rumus') ||
    q.includes('maksudku') ||
    q.includes('maksud saya') ||
    q.includes('bukan gitu') ||
    q.includes('sebenarnya') ||
    q.includes('biasanya') ||
    q.includes('harus ') ||
    q.includes('jangan ') ||
    q.includes('wajib ') ||
    q.includes('sebaiknya') ||
    q.includes('kalau untuk') ||
    q.includes('kalau kirim') ||
    q.includes('kalau racik') ||
    q.includes('itu adalah') ||
    q.includes('artinya') ||
    q.includes('fungsinya') ||
    q.includes('dipakai untuk') ||
    q.includes('dipakai buat') ||
    q.includes('cocok untuk') ||
    q.includes('suka yang') ||
    q.includes('tidak suka');

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const wantsBlend =
    q.includes('buatkan racikan') ||
    q.includes('rekomendasi racikan') ||
    q.includes('racikan terbaik') ||
    q.includes('tolong racik') ||
    q.includes('coba racik') ||
    (isQuestionText && (q.includes('racik') || q.includes('campur') || q.includes('blend') || q.includes('komposisi')));

  const isTeachingRule =
    !wantsBlend &&
    (hasExplicitTeachingKeyword || (!isQuestionText && wordCount >= 4 && !q.startsWith('cek ')));

  if (isTeachingRule) {
    const cleanRule = rawText
      .replace(/^(tolong\s+)?(ingat|catat|simpan(\s+ke\s+memori)?|pelajari)\s*(bahwa|kalau|:)?\s*/i, '')
      .trim();
    const savedRule = cleanRule.length > 3 ? cleanRule : rawText;

    return {
      handledInstantly: true,
      replyMarkdown: humanizeServerText(
        [
          `🧠 Siap Bos, sudah saya pahami dan catat ke Memori A-Brain!`,
          ``,
          `📌 Catatan Baru:`,
          `"${savedRule}"`,
          ``,
          `Patokan ini sudah tersimpan di Memori (${(nolanMemory?.learnedRules?.length || 0) + 1}) dan langsung saya pakai setiap kali mengecek stok atau menyiapkan racikan. Ada lagi yang mau ditambahkan, Bos?`,
        ].join('\n')
      ),
      newLearnedRule: savedRule.slice(0, 220),
      hasRecommendation: false,
      recommendedBlend: null,
      navigateTo: null,
      pendingAction: null,
      learnedRulesCount: (nolanMemory?.learnedRules?.length || 0) + 1,
    };
  }

  const queriedGrade = detectQueriedGradeServer(rawText);

  let hasRecommendation = false;
  let recommendedBlend: any = null;

  if (wantsBlend && availableRaw.length > 0) {
    const sortedByStock = [...availableRaw].sort(
      (a, b) => (Number(b.currentStockNetKg) || 0) - (Number(a.currentStockNetKg) || 0)
    );
    const chosen = sortedByStock.slice(0, Math.min(3, sortedByStock.length));
    const ingredients = chosen.map((t, idx) => {
      const targetShareKg = idx === 0 ? 25 : idx === 1 ? 15 : 10;
      const usedNetKg = Math.min(targetShareKg, Number(t.currentStockNetKg) || 10);
      return {
        tobaccoId: t.id,
        tobaccoName: t.name,
        usedNetKg: Number(usedNetKg.toFixed(1)),
        reason: `Grade ${t.colorGrade} (${t.origin}) • HPP Rp ${(Number(t.realCostPerNetKg) || 0).toLocaleString('id-ID')}/kg`,
      };
    });

    const totalKg = ingredients.reduce((s, i) => s + i.usedNetKg, 0);
    const avgCost =
      totalKg > 0
        ? Math.round(
            ingredients.reduce((s, i) => {
              const found = availableRaw.find((r) => r.id === i.tobaccoId);
              return s + i.usedNetKg * (Number(found?.realCostPerNetKg) || 0);
            }, 0) / totalKg
          )
        : 75000;

    hasRecommendation = true;
    recommendedBlend = {
      recipeName: 'Racikan Optimal Stok Gudang',
      targetFactory: rollSamples[0]?.targetFactory || 'CELLO MUNTILAN',
      targetGrade: queriedGrade || chosen[0]?.colorGrade || 'D',
      targetPricePerKg: Math.max(85000, Math.round(avgCost * 1.32)),
      reasoning:
        'Komposisi dihitung otomatis dari stok aktif dengan keseimbangan HPP dan karakter rasa.',
      ingredients,
    };
  }

  // Direct specific grade check (e.g. "apakah kita punya tembakau F?")
  if (queriedGrade && !wantsBlend) {
    const exactActive = availableRaw.filter(
      (t: any) => String(t.colorGrade || '').toUpperCase() === queriedGrade
    );
    const baseLetter = queriedGrade.replace('+', '');
    const familyVariant = queriedGrade.endsWith('+') ? baseLetter : `${baseLetter}+`;
    const familyActive = availableRaw.filter(
      (t: any) => String(t.colorGrade || '').toUpperCase() === familyVariant
    );

    if (exactActive.length > 0) {
      const sumKg = Number(
        exactActive.reduce((s: number, t: any) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)
      );
      return {
        handledInstantly: true,
        replyMarkdown: humanizeServerText(
          [
            `✅ Ada, Bos! Di gudang saat ini ada ${exactActive.length} bahan tembakau Grade ${queriedGrade} dengan total sisa ${sumKg} kg:`,
            ``,
            formatLines(exactActive, 10),
          ].join('\n')
        ),
        newLearnedRule: '',
        hasRecommendation: false,
        recommendedBlend: null,
        navigateTo: null,
        pendingAction: null,
        learnedRulesCount: (nolanMemory?.learnedRules || []).length,
      };
    }

    return {
      handledInstantly: true,
      replyMarkdown: humanizeServerText(
        [
          `❌ Kosong, Bos. Saat ini di gudang belum ada stok tembakau Grade ${queriedGrade} (0 kg).`,
          familyActive.length > 0
            ? `\n💡 Tapi kita masih punya varian dekatnya yaitu Grade ${familyVariant} sebanyak ${familyActive.length} bahan (${familyActive.reduce((s: number, t: any) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)} kg):\n${formatLines(familyActive, 5)}`
            : '',
          ``,
          `📦 Stok yang ready di gudang sekarang (${availableRaw.length} bahan • ${totalRawStockKg} kg):`,
          `• ${availableGradesSummary}`,
          ``,
          formatLines(availableRaw, 6),
        ]
          .filter(Boolean)
          .join('\n')
      ),
      newLearnedRule: '',
      hasRecommendation: false,
      recommendedBlend: null,
      navigateTo: null,
      pendingAction: null,
      learnedRulesCount: (nolanMemory?.learnedRules || []).length,
    };
  }

  // Specific tobacco name or origin check
  const matchedSpecific = rawTobaccos.filter(
    (t: any) =>
      (t.name && q.includes(String(t.name).toLowerCase())) ||
      (t.origin && String(t.origin).length >= 3 && q.includes(String(t.origin).toLowerCase())) ||
      (t.sellerName &&
        String(t.sellerName).length >= 3 &&
        q.includes(String(t.sellerName).toLowerCase()))
  );
  if (matchedSpecific.length > 0 && !wantsBlend) {
    const activeMatched = matchedSpecific.filter((t: any) => (Number(t.currentStockNetKg) || 0) > 0);
    const sumKg = Number(
      activeMatched.reduce((s: number, t: any) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)
    );
    return {
      handledInstantly: true,
      replyMarkdown: humanizeServerText(
        [
          activeMatched.length > 0
            ? `✅ Ada, Bos! Kita punya ${activeMatched.length} bahan aktif dengan total sisa ${sumKg} kg:`
            : `⚠️ Datanya tercatat (${matchedSpecific.length} bahan), tapi sisa stoknya sudah habis (0 kg):`,
          ``,
          formatLines(matchedSpecific, 10),
        ].join('\n')
      ),
      newLearnedRule: '',
      hasRecommendation: false,
      recommendedBlend: null,
      navigateTo: null,
      pendingAction: null,
      learnedRulesCount: (nolanMemory?.learnedRules || []).length,
    };
  }

  const mentionedMissingRegion = SERVER_REGIONS.find((reg) => q.includes(reg));
  if (mentionedMissingRegion && !wantsBlend) {
    const regionPretty =
      mentionedMissingRegion.charAt(0).toUpperCase() + mentionedMissingRegion.slice(1);
    const availableOrigins = Array.from(byOrigin.keys()).join(', ') || 'Belum ada';
    return {
      handledInstantly: true,
      replyMarkdown: humanizeServerText(
        [
          `❌ Belum ada, Bos. Stok tembakau dari daerah ${regionPretty} saat ini sedang kosong (0 bahan).`,
          ``,
          `📍 Daerah yang ready sekarang: ${availableOrigins} (${availableRaw.length} bahan • ${totalRawStockKg} kg):`,
          formatLines(availableRaw, 6),
        ].join('\n')
      ),
      newLearnedRule: '',
      hasRecommendation: false,
      recommendedBlend: null,
      navigateTo: null,
      pendingAction: null,
      learnedRulesCount: (nolanMemory?.learnedRules || []).length,
    };
  }

  const isDirectWarehouseOrBlendQuery =
    isTeachingRule ||
    wantsBlend ||
    q.includes('berapa') ||
    q.includes('barang') ||
    q.includes('stok') ||
    q.includes('gudang') ||
    q.includes('sisa') ||
    q.includes('profit') ||
    q.includes('untung') ||
    q.includes('modal') ||
    q.includes('pabrik') ||
    q.includes('accepted') ||
    q.includes('reject');

  const replyMarkdown = humanizeServerText(
    [
      `📦 Saat ini ada ${availableRaw.length + rejectedSerials.length} barang siap pakai di gudang (total sisa bersih ${totalRawStockKg} kg):`,
      ``,
      `• 🌿 Stok Mentah Aktif: ${availableRaw.length} jenis (${totalRawStockKg} kg) — ${availableGradesSummary}`,
      `• 📦 Stok Jadi Eks-Reject: ${rejectedSerials.length} seri`,
      `• 💰 Modal Inventori: Rp ${totalModalGudangRp.toLocaleString('id-ID')} (Weight Profit +${totalWeightProfitKg} kg / +Rp ${totalWeightProfitRp.toLocaleString('id-ID')})`,
      ``,
      `📋 Rincian Bahan Mentah Ready:`,
      formatLines(availableRaw, 10),
      ``,
      `🏭 Status Seri Jadi & Gulungan (${finishedBatches.length} Seri • ${rollSamples.length} Gulungan):`,
      `• ✅ Diterima Pabrik: ${acceptedSerials.length} seri`,
      `• ⏳ Menunggu Pabrik: ${pendingSerials.length} seri`,
      `• ↩️ Reject di Gudang: ${rejectedSerials.length} seri`,
      `• 💵 Nilai Nota Aktif: Rp ${totalNotaRp.toLocaleString('id-ID')} (Estimasi Profit +Rp ${totalProfitRp.toLocaleString('id-ID')})`,
      wantsBlend && hasRecommendation
        ? `\n⚖️ Saya juga sudah siapkan draf komposisi racikan di bawah. Silakan cek dulu dan klik Izinkan & Terapkan ke Kalkulator kalau sudah cocok ya, Bos.`
        : ``,
    ]
      .filter(Boolean)
      .join('\n')
  );

  return {
    handledInstantly: isDirectWarehouseOrBlendQuery,
    replyMarkdown,
    newLearnedRule: isTeachingRule ? message.slice(0, 140) : '',
    hasRecommendation,
    recommendedBlend,
    navigateTo: null,
    pendingAction: null,
    learnedRulesCount: (nolanMemory?.learnedRules || []).length,
  };
}

function sanitizeAccountKey(accountEmail?: string | null): string {
  const raw = (accountEmail || 'default_local_user').trim().toLowerCase();
  return raw.replace(/[^a-z0-9_-]/g, '_') || 'default_local_user';
}

function getBrainFilePath(accountEmail?: string | null): string {
  return path.join(BRAINS_DIR, `${sanitizeAccountKey(accountEmail)}.json`);
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

function resolveGitHubToken(req: Request): { token: string | null; method: 'oauth' | 'env_token' | 'none' } {
  dotenv.config({ override: true });
  const headerToken = req.headers['x-github-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return { token: headerToken.trim(), method: 'oauth' };
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.nolan_gh_token && cookies.nolan_gh_token.trim()) {
    return { token: cookies.nolan_gh_token.trim(), method: 'oauth' };
  }
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    return { token: process.env.GITHUB_TOKEN.trim(), method: 'env_token' };
  }
  return { token: null, method: 'none' };
}

function normalizeGitHubRepo(input?: string | null, fallbackUsername?: string): string {
  const raw = (input || '').trim();
  if (!raw) return fallbackUsername ? `${fallbackUsername}/A-Brain` : '';
  const cleaned = raw
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const repoPart = parts[1];
    // If user accidentally pasted Tobacco-Lab repo link into ABRAIN_REPO, automatically route to their A-Brain repo
    if (repoPart.toLowerCase() === 'tobacco-lab') {
      return `${parts[0]}/A-Brain`;
    }
    return `${parts[0]}/${parts[1]}`;
  }
  return cleaned;
}

function buildMarkdownBrainReport(brain: any, accountSummary?: any): string {
  const lines: string[] = [];
  lines.push(`# 🧠 Nolan — Agentic Tobacco Brain (A-Brain Sync)`);
  lines.push(``);
  lines.push(`- **Agent Name:** ${brain.agentName || 'Nolan'}`);
  lines.push(`- **Account:** \`${brain.accountEmail || 'adikaryasukses99@gmail.com'}\``);
  lines.push(`- **Last Updated:** ${brain.lastUpdated || new Date().toISOString()}`);
  lines.push(`- **Repository:** \`${brain.githubRepo || 'A-Brain'}\` (\`${brain.githubBranch || 'main'}\`)`);
  lines.push(``);

  if (accountSummary) {
    lines.push(`## 📊 Live Warehouse & Profit Snapshot`);
    lines.push(`- **Total Raw Tobacco Types:** ${accountSummary.rawCount ?? 0} jenis (${accountSummary.totalRawNetKg ?? 0} kg sisa stok)`);
    lines.push(`- **Total Modal / Inventory Value:** Rp ${(accountSummary.totalModalRp ?? 0).toLocaleString('id-ID')}`);
    lines.push(`- **Weight Profit (Rp):** Rp ${(accountSummary.totalWeightProfitRp ?? 0).toLocaleString('id-ID')}`);
    lines.push(`- **Weight Profit (KG):** ${(accountSummary.totalWeightProfitKg ?? 0).toLocaleString('id-ID')} kg`);
    lines.push(`- **Total Finished Serials:** ${accountSummary.finishedCount ?? 0} seri (Accepted: ${accountSummary.acceptedCount ?? 0}, Rejected: ${accountSummary.rejectedCount ?? 0})`);
    lines.push(`- **Projected Factory Profit (Accepted):** Rp ${(accountSummary.acceptedProfitRp ?? 0).toLocaleString('id-ID')}`);
    lines.push(``);
  }

  lines.push(`## 🎯 Learned Blending Rules & Heuristics (${(brain.learnedRules || []).length})`);
  if (Array.isArray(brain.learnedRules) && brain.learnedRules.length > 0) {
    brain.learnedRules.forEach((rule: string, idx: number) => {
      lines.push(`${idx + 1}. ${rule}`);
    });
  } else {
    lines.push(`_No custom rules recorded yet._`);
  }
  lines.push(``);

  lines.push(`## 🏭 Factory Profiles & Preferences`);
  if (Array.isArray(brain.factoryProfiles) && brain.factoryProfiles.length > 0) {
    brain.factoryProfiles.forEach((fp: any) => {
      lines.push(`### ${fp.factoryName}`);
      lines.push(`- **Accepted / Rejected:** ${fp.acceptedCount ?? 0} Diterima / ${fp.rejectedCount ?? 0} Reject`);
      lines.push(`- **Preferred Grades:** ${(fp.preferredGrades || []).join(', ') || '-'}`);
      lines.push(`- **Avg HPP / Target Price:** Rp ${(fp.avgAcceptedHppPerKg ?? 0).toLocaleString('id-ID')}/kg → Rp ${(fp.avgTargetPricePerKg ?? 0).toLocaleString('id-ID')}/kg`);
      lines.push(`- **Sensory Profile:** ${fp.sensorySweetSpot || '-'}`);
      lines.push(`- **Notes:** ${fp.notes || '-'}`);
      lines.push(``);
    });
  } else {
    lines.push(`_Factory profiles will populate automatically as serials are created and evaluated._`);
    lines.push(``);
  }

  lines.push(`## 📜 Recent Decision & Learning Episodes`);
  if (Array.isArray(brain.decisionEpisodes) && brain.decisionEpisodes.length > 0) {
    brain.decisionEpisodes.slice(0, 30).forEach((ep: any) => {
      lines.push(`- **[${ep.timestamp?.slice(0, 10) || ''}] (${ep.type})** ${ep.summary}`);
      if (ep.learnedTakeaway) {
        lines.push(`  - *Takeaway:* ${ep.learnedTakeaway}`);
      }
    });
  } else {
    lines.push(`_No episodes logged yet._`);
  }
  lines.push(``);
  return lines.join('\n');
}

async function upsertGitHubFile(params: {
  token: string;
  repoFullName: string;
  branch: string;
  filePath: string;
  contentString: string;
  commitMessage: string;
}) {
  const { token, repoFullName, branch, filePath, contentString, commitMessage } = params;
  const cleanPath = filePath.replace(/^\/+/, '');
  const apiUrl = `https://api.github.com/repos/${repoFullName}/contents/${cleanPath}`;

  // 1. Check if file already exists to get its SHA
  let existingSha: string | undefined;
  const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TobaccoLab-Nolan-ABrain',
    },
  });

  if (getRes.ok) {
    const existingData = (await getRes.json()) as { sha?: string };
    existingSha = existingData.sha;
  }

  // 2. PUT updated content
  const putBody: Record<string, unknown> = {
    message: commitMessage,
    content: Buffer.from(contentString, 'utf-8').toString('base64'),
    branch,
  };
  if (existingSha) {
    putBody.sha = existingSha;
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'TobaccoLab-Nolan-ABrain',
    },
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub API (${putRes.status}): ${errText}`);
  }

  return await putRes.json();
}

export const app = express();
app.use(express.json({ limit: '10mb' }));

  // ============================================================================
  // 1. LOCAL SERVER BRAIN PERSISTENCE (/api/nolan/brain)
  // ============================================================================
  app.get('/api/nolan/brain', (req: Request, res: Response) => {
    try {
      const accountEmail = (req.query.accountEmail as string) || 'default_local_user';
      const filePath = getBrainFilePath(accountEmail);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        res.json({ found: true, brain: JSON.parse(raw) });
        return;
      }
      res.json({ found: false, brain: null });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to load Nolan brain',
      });
    }
  });

  app.post('/api/nolan/brain', (req: Request, res: Response) => {
    try {
      const { accountEmail, brain } = req.body || {};
      if (!brain) {
        res.status(400).json({ error: 'Missing brain payload' });
        return;
      }
      const filePath = getBrainFilePath(accountEmail || brain.accountEmail);
      fs.writeFileSync(filePath, JSON.stringify(brain, null, 2), 'utf-8');
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to save Nolan brain',
      });
    }
  });

  // ============================================================================
  // 2. GITHUB OAUTH & A-BRAIN REPOSITORY SYNC (/api/github/*)
  // ============================================================================
  app.get('/api/github/status', async (req: Request, res: Response) => {
    const { token, method } = resolveGitHubToken(req);
    const oauthConfigured = Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    );
    const defaultEnvRepo = normalizeGitHubRepo(process.env.ABRAIN_REPO);

    if (!token) {
      res.json({
        connected: false,
        authMethod: 'none',
        oauthConfigured,
        defaultRepo: defaultEnvRepo || undefined,
      });
      return;
    }

    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'TobaccoLab-Nolan-ABrain',
        },
      });

      if (!userRes.ok) {
        res.json({
          connected: false,
          authMethod: 'none',
          oauthConfigured,
          defaultRepo: defaultEnvRepo || undefined,
        });
        return;
      }

      const userData = (await userRes.json()) as { login: string; avatar_url?: string };
      const resolvedRepo =
        normalizeGitHubRepo(process.env.ABRAIN_REPO, userData.login) ||
        `${userData.login}/A-Brain`;
      res.json({
        connected: true,
        authMethod: method,
        username: userData.login,
        avatarUrl: userData.avatar_url,
        defaultRepo: resolvedRepo,
        oauthConfigured,
      });
    } catch {
      res.json({
        connected: false,
        authMethod: 'none',
        oauthConfigured,
      });
    }
  });

  app.get('/api/github/auth/url', (req: Request, res: Response) => {
    dotenv.config({ override: true });
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      res.status(400).json({
        error:
          'GITHUB_CLIENT_ID belum diatur di Settings > Secrets (AI Studio) atau Environment Variables (Vercel).',
      });
      return;
    }

    const origin =
      (req.query.origin as string) ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}`;
    const cleanOrigin = origin.replace(/\/+$/, '');
    const redirectUri = `${cleanOrigin}/auth/github/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
    });

    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  const githubCallbackHandler = async (req: Request, res: Response) => {
    dotenv.config({ override: true });
    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).send('Missing OAuth code parameter.');
      return;
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenData.access_token) {
        res
          .status(400)
          .send(`GitHub OAuth gagal: ${tokenData.error_description || tokenData.error || 'Unknown'}`);
        return;
      }

      const accessToken = tokenData.access_token;
      res.setHeader(
        'Set-Cookie',
        `nolan_gh_token=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000`
      );

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Koneksi GitHub A-Brain Berhasil</title>
          </head>
          <body style="background:#050507;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;padding:24px;border:1px solid #f59e0b;border-radius:16px;background:#09090b;">
              <h3 style="color:#fbbf24;margin:0 0 8px 0;">Nolan Terhubung ke GitHub A-Brain!</h3>
              <p style="color:#a1a1aa;font-size:13px;margin:0;">Jendela ini akan tertutup otomatis...</p>
            </div>
            <script>
              if (window.opener) {
                window.opener.postMessage(
                  { type: 'OAUTH_AUTH_SUCCESS', provider: 'github', token: ${JSON.stringify(accessToken)} },
                  '*'
                );
                setTimeout(() => window.close(), 350);
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      res
        .status(500)
        .send(`OAuth callback error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  app.get(
    [
      '/auth/github/callback',
      '/auth/github/callback/',
      '/api/github/callback',
      '/api/github/callback/',
    ],
    githubCallbackHandler
  );

  app.post('/api/github/logout', (_req: Request, res: Response) => {
    res.setHeader(
      'Set-Cookie',
      'nolan_gh_token=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0'
    );
    res.json({ ok: true });
  });

  // Pull Nolan's memory from user's A-Brain GitHub repository (including Tobacco-Business/ folder)
  app.post('/api/github/abrain/pull', async (req: Request, res: Response) => {
    try {
      const {
        repo,
        branch = 'main',
        filePath = 'Tobacco-Business/nolan-brain.json',
      } = req.body || {};
      const targetRepo = normalizeGitHubRepo(repo || process.env.ABRAIN_REPO, 'Aldi-ang');
      if (!targetRepo || !targetRepo.includes('/')) {
        res.status(400).json({
          error:
            'Masukkan link GitHub (https://github.com/username/A-Brain) atau format "username/A-Brain".',
        });
        return;
      }

      const { token } = resolveGitHubToken(req);
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'TobaccoLab-Nolan-ABrain',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const cleanPath = String(filePath).replace(/^\/+/, '');
      const fileUrl = `https://api.github.com/repos/${targetRepo}/contents/${cleanPath}?ref=${encodeURIComponent(
        branch
      )}`;
      const fileRes = await fetch(fileUrl, { headers });

      // Inspect root directory and Tobacco-Business directory of A-Brain
      const rootUrl = `https://api.github.com/repos/${targetRepo}/contents?ref=${encodeURIComponent(
        branch
      )}`;
      const rootRes = await fetch(rootUrl, { headers });
      let repoFiles: string[] = [];
      if (rootRes.ok) {
        const rootJson = await rootRes.json();
        if (Array.isArray(rootJson)) {
          repoFiles = rootJson.map((item: any) => `${item.name}${item.type === 'dir' ? '/' : ''}`);
        }
      }

      const tbUrl = `https://api.github.com/repos/${targetRepo}/contents/Tobacco-Business?ref=${encodeURIComponent(
        branch
      )}`;
      const tbRes = await fetch(tbUrl, { headers });
      let tobaccoBusinessFiles: string[] = [];
      const extractedNotes: string[] = [];
      if (tbRes.ok) {
        const tbJson = await tbRes.json();
        if (Array.isArray(tbJson)) {
          tobaccoBusinessFiles = tbJson.map(
            (item: any) => `Tobacco-Business/${item.name}${item.type === 'dir' ? '/' : ''}`
          );
          for (const item of tbJson.slice(0, 6)) {
            if (
              item.type === 'file' &&
              typeof item.name === 'string' &&
              item.name.endsWith('.md') &&
              !item.name.includes('nolan-brain')
            ) {
              const mdRes = await fetch(item.url, { headers });
              if (mdRes.ok) {
                const mdData = (await mdRes.json()) as { content?: string };
                if (mdData.content) {
                  const text = Buffer.from(mdData.content, 'base64')
                    .toString('utf-8')
                    .slice(0, 600);
                  extractedNotes.push(`[Catatan A-Brain: ${item.name}] ${text.replace(/\s+/g, ' ').trim()}`);
                }
              }
            }
          }
        }
      }

      if (fileRes.status === 404) {
        res.json({
          found: false,
          repo: targetRepo,
          branch,
          repoFiles: [...tobaccoBusinessFiles, ...repoFiles],
          extractedNotes,
          message: `Repository ${targetRepo} terhubung! Folder Tobacco-Business/ terdeteksi. Klik "Push ke A-Brain" untuk menyimpan memori Nolan ke ${cleanPath}.`,
        });
        return;
      }

      if (!fileRes.ok) {
        const errText = await fileRes.text();
        res.status(fileRes.status).json({
          error: `Gagal membaca ${targetRepo}/${cleanPath}: ${errText}`,
        });
        return;
      }

      const fileData = (await fileRes.json()) as { content?: string; encoding?: string };
      if (!fileData.content) {
        res.json({
          found: false,
          repo: targetRepo,
          repoFiles: [...tobaccoBusinessFiles, ...repoFiles],
          extractedNotes,
        });
        return;
      }

      const decoded = Buffer.from(fileData.content, 'base64').toString('utf-8');
      const parsedBrain = JSON.parse(decoded);

      if (parsedBrain?.accountEmail) {
        fs.writeFileSync(
          getBrainFilePath(parsedBrain.accountEmail),
          JSON.stringify(parsedBrain, null, 2),
          'utf-8'
        );
      }

      res.json({
        found: true,
        repo: targetRepo,
        branch,
        repoFiles: [...tobaccoBusinessFiles, ...repoFiles],
        extractedNotes,
        brain: parsedBrain,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Gagal menarik memori dari GitHub A-Brain',
      });
    }
  });

  // Push / Commit Nolan's memory to user's A-Brain GitHub repository
  app.post('/api/github/abrain/push', async (req: Request, res: Response) => {
    try {
      const {
        repo,
        branch = 'main',
        filePath = 'nolan/tobacco-lab-brain.json',
        brain,
        accountSummary,
        commitMessage,
      } = req.body || {};

      const targetRepo = normalizeGitHubRepo(
        repo || brain?.githubRepo || process.env.ABRAIN_REPO
      );
      if (!targetRepo || !targetRepo.includes('/')) {
        res.status(400).json({
          error:
            'Masukkan link GitHub (https://github.com/username/A-Brain) atau format "username/A-Brain".',
        });
        return;
      }

      const { token } = resolveGitHubToken(req);
      if (!token) {
        res.status(401).json({
          error:
            'Untuk menyimpan (commit/push) ke repository GitHub A-Brain, hubungkan akun GitHub Anda terlebih dahulu atau tambahkan GITHUB_TOKEN di Settings > Secrets.',
        });
        return;
      }

      const syncedBrain = {
        ...brain,
        githubRepo: targetRepo,
        githubBranch: branch,
        githubFilePath: filePath,
        lastSyncedToGithub: new Date().toISOString(),
      };

      // Save locally on server too
      fs.writeFileSync(
        getBrainFilePath(syncedBrain.accountEmail),
        JSON.stringify(syncedBrain, null, 2),
        'utf-8'
      );

      const jsonCommitMsg =
        commitMessage ||
        `🧠 [Nolan A-Brain] Sync tobacco blending memory & decisions (${new Date()
          .toISOString()
          .slice(0, 16)
          .replace('T', ' ')})`;

      // 1. Commit structured JSON brain
      const jsonResult = await upsertGitHubFile({
        token,
        repoFullName: targetRepo,
        branch,
        filePath,
        contentString: JSON.stringify(
          {
            ...syncedBrain,
            latestWarehouseSnapshot: accountSummary || null,
          },
          null,
          2
        ),
        commitMessage: jsonCommitMsg,
      });

      // 2. Commit human-readable Markdown brain log alongside the JSON file
      const mdPath = filePath.replace(/\.json$/i, '') + '.md';
      const markdownContent = buildMarkdownBrainReport(syncedBrain, accountSummary);
      await upsertGitHubFile({
        token,
        repoFullName: targetRepo,
        branch,
        filePath: mdPath,
        contentString: markdownContent,
        commitMessage: `📝 [Nolan A-Brain] Update readable memory log (${mdPath})`,
      });

      res.json({
        ok: true,
        repo: targetRepo,
        branch,
        filePath,
        markdownPath: mdPath,
        lastSyncedToGithub: syncedBrain.lastSyncedToGithub,
        commitUrl: jsonResult?.commit?.html_url || `https://github.com/${targetRepo}`,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Gagal push ke GitHub A-Brain',
      });
    }
  });

  // ============================================================================
  // 3. NOLAN AI AGENT — GEMINI 3.8 FLASH SERVER-SIDE INTELLIGENCE (/api/nolan/chat)
  // ============================================================================
  app.post('/api/nolan/chat', async (req: Request, res: Response) => {
    try {
      const { message, history = [], accountData = {}, nolanMemory = {} } = req.body || {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Pesan untuk Nolan tidak boleh kosong.' });
        return;
      }

      const rawTobaccos = Array.isArray(accountData.rawTobaccos) ? accountData.rawTobaccos : [];
      const finishedBatches = Array.isArray(accountData.finishedBatches)
        ? accountData.finishedBatches
        : [];
      const rollSamples = Array.isArray(accountData.rollSamples) ? accountData.rollSamples : [];
      const factoryList = Array.isArray(accountData.factoryList) ? accountData.factoryList : [];

      // ALWAYS connect to Real Gemini AI first (with 24/7 Multi-Model Failover Cascade).
      // buildDeterministicNolanFallback is only used in catch{} if all cloud AI pools are unreachable.

      // Summarize stock & profit metrics for Nolan's system prompt
      const availableRaw = rawTobaccos.filter((t: any) => (t.currentStockNetKg || 0) > 0);
      const totalModalGudangRp = rawTobaccos.reduce(
        (acc: number, t: any) => acc + (t.totalModalAsal || 0),
        0
      );
      const totalWeightProfitRp = rawTobaccos.reduce(
        (acc: number, t: any) => acc + (t.purchaseWeightProfitRp || 0),
        0
      );
      const totalWeightProfitKg = rawTobaccos.reduce(
        (acc: number, t: any) => acc + (t.purchaseWeightProfitKg || 0),
        0
      );

      const acceptedSerials = finishedBatches.filter(
        (b: any) => b.factoryStatus === 'ACCEPTED_CAIR'
      );
      const rejectedSerials = finishedBatches.filter(
        (b: any) => b.factoryStatus === 'REJECTED_STOCK'
      );
      const waitingSerials = finishedBatches.filter(
        (b: any) => !b.factoryStatus || b.factoryStatus === 'WAITING_FACTORY'
      );

      const paidSerials = acceptedSerials.filter((b: any) => b.paymentStatus === 'CAIR');
      const unpaidSerials = acceptedSerials.filter((b: any) => b.paymentStatus !== 'CAIR');

      const systemInstruction = `
Anda adalah Nolan, partner ahli racikan tembakau dan asisten operasional gudang di aplikasi Tobacco Lab untuk akun ${
        accountData.userEmail || 'Pengguna Lokal'
      }.
Otak dan memori jangka panjang Anda terhubung ke sistem A-Brain di GitHub (${
        nolanMemory.githubRepo || 'A-Brain'
      }).

ATURAN GAYA BICARA WAJIB (BLADER/HUMANIZER SKILL — ZERO AI SLOP & ZERO MARKDOWN SYMBOLS):
1. DILARANG KERAS memakai simbol bintang (* atau **), pagar (# atau ##), atau backtick (\`) di dalam jawaban Anda!
2. Jangan pernah memulai kalimat dengan basa-basi robotik seperti "Berdasarkan data yang tersedia...", "Tentu saja!", "Berikut adalah rinciannya:", atau "Sebagai AI...". Langsung bicara ke inti masalah seperti partner kerja gudang tembakau sungguhan yang akrab, jelas, dan sigap ("Siap Bos...", "Saat ini di gudang...", "Untuk Grade F kebetulan lagi kosong, Bos...").
3. Gunakan emotikon yang relevan (📦, 🌿, ✅, ❌, 💰, ⚖️, 🏭, 🧭, ✍️, 💡) dan baris baru yang rapi sebagai pengganti simbol bintang atau tabel kaku.
4. Hindari daftar bernomor yang penuh tanda **tebal** atau *miring*. Tulis dengan kalimat manusia yang enak dibaca.

KONTROL NAVIGASI OTOMATIS vs IZIN EDIT/TAMBAH DATA:
1. Navigasi Menu Otomatis (TANPA Perlu Izin):
   - Jika pengguna meminta membuka atau melihat halaman/menu tertentu, langsung isi field "navigateTo" dengan salah satu nilai berikut:
     - "inventory" (Stok Gudang Mentah)
     - "inventory_rejected" (Stok Tembakau Jadi / Eks-Reject)
     - "calculator" (Kalkulator Racikan)
     - "rolls" (Menu Gulungan Sampel)
     - "finished" (Menu Status Barang Pabrik)
     - "history" (Menu Riwayat & Laporan)
     - "settings" (Menu Pengaturan)
     - "simulator" (Simulator Hitung Cepat)
     - "input_raw_modal" (Form Input Stok Mentah Baru)
     - "google_sheets" (Sinkronisasi Google Sheets)
     - "backup" (Backup Data)
     - "restore" (Restore Data)
   - Kosongkan "" jika pengguna tidak meminta pindah halaman.
2. Tambah / Edit Data & Racik (WAJIB Minta Izin Pengguna):
   - Jika pengguna meminta Anda meracik ("tolong racikkan...", "buatkan racikan..."), set hasRecommendation = true dan isi recommendedBlend. Katakan di replyMarkdown bahwa draf racikan sudah disiapkan di bawah dan menunggu pengguna menekan tombol Izinkan & Terapkan.
   - Jika pengguna meminta menambahkan stok tembakau mentah baru ("tambahkan tembakau...", "input barang baru..."), mengedit data stok mentah yang ada ("ubah harga...", "ganti sisa stok..."), atau mengubah status seri pabrik ("ubah status seri jadi diterima/reject"), isi objek "pendingAction" agar muncul kartu konfirmasi izin di layar pengguna.

RINGKASAN DATA GUDANG SAAT INI:
- Total Modal Inventori Gudang Mentah: Rp ${totalModalGudangRp.toLocaleString('id-ID')}
- Weight Profit Pembelian: +${totalWeightProfitKg.toFixed(1)} kg (+Rp ${totalWeightProfitRp.toLocaleString('id-ID')})
- Status Seri Jadi: Total ${finishedBatches.length} seri (${acceptedSerials.length} Diterima Pabrik, ${rejectedSerials.length} Reject di Stok Jadi, ${waitingSerials.length} Menunggu Pabrik).

DATA STOK TEMBAKAU MENTAH TERATAS (${availableRaw.length} aktif dari ${rawTobaccos.length} jenis):
${JSON.stringify(
  availableRaw.slice(0, 20).map((t: any) => ({
    tobaccoId: t.id,
    name: t.name,
    origin: t.origin,
    sellerName: t.sellerName,
    grade: t.colorGrade,
    currentStockNetKg: t.currentStockNetKg,
    netWeightKg: t.netWeightKg,
    pricePerKgPurchase: t.pricePerKgPurchase,
    realCostPerNetKg: t.realCostPerNetKg,
    totalModalAsal: t.totalModalAsal,
    sensory: {
      power: t.powerRating,
      impact: t.impactRating,
      bitter: t.bitterRating,
      burn: t.burnRating,
      sugar: t.sugarRating,
      aroma: t.aromaRating,
    },
    notes: t.characterNotes,
  })),
  null,
  2
)}

DATA RIWAYAT SERI JADI & STATUS PABRIK (${finishedBatches.length} seri):
${JSON.stringify(
  finishedBatches.slice(0, 15).map((b: any) => ({
    id: b.id,
    serialNumber: b.serialNumber,
    recipeName: b.recipeName,
    rollNumber: b.rollNumber,
    targetFactory: b.targetFactory,
    grade: b.compositeColorGrade,
    factoryStatus: b.factoryStatus || 'WAITING_FACTORY',
    billableNetKg: b.factoryNetBillableKg,
    hppPerKg: b.hppPerNetKg,
    targetPricePerKg: b.factoryTargetPricePerKg,
    totalNotaRp: b.projectedRevenue,
    profitRp: b.projectedProfit,
  })),
  null,
  2
)}

MEMORI & ATURAN YANG SUDAH DIPELAJARI NOLAN (A-BRAIN MEMORY):
- Aturan Racikan Tersimpan: ${JSON.stringify(nolanMemory.learnedRules || [])}
- Profil Pabrik: ${JSON.stringify(nolanMemory.factoryProfiles || [])}
`.trim();

      const conversationTranscript = Array.isArray(history)
        ? history
            .slice(-8)
            .map((h: any) => `${h.role === 'user' ? 'User' : 'Nolan'}: ${h.text}`)
            .join('\n\n')
        : '';

      const promptContent = conversationTranscript
        ? `Riwayat Percakapan Sebelumnya:\n${conversationTranscript}\n\nPertanyaan / Instruksi Terbaru User:\n${message}`
        : message;

      const deterministicCheck = buildDeterministicNolanFallback({
        message,
        rawTobaccos,
        finishedBatches,
        rollSamples,
        nolanMemory,
      });

      let parsed: any;
      try {
        const result = await generateWith24x7Fallback({
          contents: promptContent,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replyMarkdown: {
                  type: Type.STRING,
                  description:
                    'Jawaban Nolan yang natural, manusiawi (blader/humanizer), menggunakan emotikon, dan TANPA simbol bintang (*) atau pagar (#).',
                },
                newLearnedRule: {
                  type: Type.STRING,
                  description:
                    'Jika user mengajarkan preferensi/aturan baru, tuliskan 1 kalimat aturan pembelajaran untuk disimpan di A-Brain. Kosongkan "" jika tidak ada.',
                },
                navigateTo: {
                  type: Type.STRING,
                  description:
                    'Isi dengan target navigasi (inventory, inventory_rejected, calculator, rolls, finished, history, settings, simulator, input_raw_modal, google_sheets, backup, restore) jika user meminta membuka halaman tersebut. Kosongkan "" jika tidak.',
                },
                hasRecommendation: {
                  type: Type.BOOLEAN,
                  description:
                    'True jika Nolan menyertakan rekomendasi komposisi racikan tembakau.',
                },
                recommendedBlend: {
                  type: Type.OBJECT,
                  properties: {
                    recipeName: { type: Type.STRING },
                    targetFactory: { type: Type.STRING },
                    targetGrade: { type: Type.STRING },
                    targetPricePerKg: { type: Type.NUMBER },
                    reasoning: { type: Type.STRING },
                    ingredients: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          tobaccoId: { type: Type.STRING },
                          tobaccoName: { type: Type.STRING },
                          usedNetKg: { type: Type.NUMBER },
                          reason: { type: Type.STRING },
                        },
                        required: ['tobaccoId', 'tobaccoName', 'usedNetKg'],
                      },
                    },
                  },
                },
              },
              required: ['replyMarkdown', 'hasRecommendation'],
            },
          },
        });
        parsed = JSON.parse(result.text || '{}');
      } catch (cloudErr) {
        console.warn(
          'All Gemini pools busy (503/429), switching seamlessly to Nolan 24/7 Deterministic Engine:',
          cloudErr
        );
        parsed = deterministicCheck;
      }

      // Enrich and validate recommendedBlend against actual available rawTobaccos
      let validatedBlend: any = null;
      const sourceBlend = parsed.recommendedBlend || deterministicCheck.recommendedBlend;
      const shouldBuildBlend =
        Boolean(parsed.hasRecommendation || deterministicCheck.hasRecommendation) &&
        sourceBlend &&
        Array.isArray(sourceBlend.ingredients) &&
        sourceBlend.ingredients.length > 0;

      if (shouldBuildBlend) {
        const enrichedIngs: any[] = [];
        for (const rawIng of sourceBlend.ingredients) {
          const matchedTobacco =
            rawTobaccos.find((t: any) => t.id === rawIng.tobaccoId) ||
            rawTobaccos.find(
              (t: any) =>
                String(t.name || '').toLowerCase() ===
                String(rawIng.tobaccoName || '').toLowerCase()
            );

          if (matchedTobacco && (matchedTobacco.currentStockNetKg || 0) > 0) {
            const safeKg = Math.min(
              Math.max(1, Number(rawIng.usedNetKg) || 10),
              Number(matchedTobacco.currentStockNetKg)
            );
            enrichedIngs.push({
              tobaccoId: matchedTobacco.id,
              tobaccoName: matchedTobacco.name,
              origin: matchedTobacco.origin,
              usedNetKg: Number(safeKg.toFixed(1)),
              percentage: 0,
              realCostPerNetKg: matchedTobacco.realCostPerNetKg || 0,
              reason: humanizeServerText(rawIng.reason || ''),
              powerRating: matchedTobacco.powerRating || 3.5,
              impactRating: matchedTobacco.impactRating || 3.5,
              bitterRating: matchedTobacco.bitterRating || 3.5,
              burnRating: matchedTobacco.burnRating || 4.5,
              sugarRating: matchedTobacco.sugarRating || 4.0,
              aromaRating: matchedTobacco.aromaRating || 4.2,
            });
          }
        }

        if (enrichedIngs.length > 0) {
          const totalNetKg = enrichedIngs.reduce((s, i) => s + i.usedNetKg, 0);
          const totalCost = enrichedIngs.reduce(
            (s, i) => s + i.usedNetKg * i.realCostPerNetKg,
            0
          );
          const projectedHppPerKg = totalNetKg > 0 ? Math.round(totalCost / totalNetKg) : 0;
          const targetPrice =
            Number(sourceBlend.targetPricePerKg) ||
            Math.round(projectedHppPerKg * 1.32);

          const weightedAvg = (key: string) =>
            totalNetKg > 0
              ? Number(
                  (
                    enrichedIngs.reduce((s, i) => s + (Number(i[key]) || 0) * i.usedNetKg, 0) /
                    totalNetKg
                  ).toFixed(1)
                )
              : 0;

          validatedBlend = {
            recipeName: humanizeServerText(sourceBlend.recipeName || 'Racikan Rekomendasi Nolan'),
            targetFactory:
              sourceBlend.targetFactory ||
              availableRaw[0]?.origin ||
              'CELLO MUNTILAN',
            targetGrade: sourceBlend.targetGrade || 'D',
            targetPricePerKg: targetPrice,
            totalNetKg: Number(totalNetKg.toFixed(1)),
            projectedHppPerKg,
            projectedProfitPerKg: targetPrice - projectedHppPerKg,
            estimatedSensory: {
              power: weightedAvg('powerRating'),
              impact: weightedAvg('impactRating'),
              bitter: weightedAvg('bitterRating'),
              burn: weightedAvg('burnRating'),
              sugar: weightedAvg('sugarRating'),
              aroma: weightedAvg('aromaRating'),
            },
            reasoning: humanizeServerText(
              sourceBlend.reasoning ||
                'Komposisi dioptimalkan oleh Nolan berdasarkan sisa stok gudang dan histori penerimaan pabrik.'
            ),
            ingredients: enrichedIngs.map((i) => ({
              tobaccoId: i.tobaccoId,
              tobaccoName: i.tobaccoName,
              origin: i.origin,
              usedNetKg: i.usedNetKg,
              percentage:
                totalNetKg > 0 ? Number(((i.usedNetKg / totalNetKg) * 100).toFixed(1)) : 0,
              realCostPerNetKg: i.realCostPerNetKg,
              reason: i.reason,
            })),
          };
        }
      }

      const finalNavigateTo = deterministicCheck.navigateTo || null;
      const finalPendingAction =
        parsed.pendingAction || deterministicCheck.pendingAction || null;

      res.json({
        reply: humanizeServerText(parsed.replyMarkdown || deterministicCheck.replyMarkdown || 'Siap Bos, ada yang bisa saya bantu?'),
        newLearnedRule:
          parsed.newLearnedRule && String(parsed.newLearnedRule).trim().length > 5
            ? humanizeServerText(String(parsed.newLearnedRule).trim())
            : deterministicCheck.newLearnedRule || null,
        recommendedBlend: validatedBlend,
        navigateTo: finalNavigateTo,
        pendingAction: finalPendingAction,
      });
    } catch (error) {
      console.error('Nolan API fallback error:', error);
      const { message = '', accountData = {}, nolanMemory = {} } = req.body || {};
      const localResult = buildDeterministicNolanFallback({
        message: String(message || 'Cek Stok Gudang'),
        rawTobaccos: Array.isArray(accountData.rawTobaccos) ? accountData.rawTobaccos : [],
        finishedBatches: Array.isArray(accountData.finishedBatches)
          ? accountData.finishedBatches
          : [],
        rollSamples: Array.isArray(accountData.rollSamples) ? accountData.rollSamples : [],
        nolanMemory,
      });
      res.json({
        reply: humanizeServerText(localResult.replyMarkdown),
        newLearnedRule: localResult.newLearnedRule || null,
        recommendedBlend: localResult.recommendedBlend || null,
        navigateTo: localResult.navigateTo || null,
        pendingAction: localResult.pendingAction || null,
      });
    }
  });

  // ============================================================================
  // 4. AUTOMATIC CONTINUOUS LEARNING ENDPOINT (/api/nolan/learn-event)
  // ============================================================================
  app.post('/api/nolan/learn-event', async (req: Request, res: Response) => {
    try {
      const { eventType, eventData, currentMemory } = req.body || {};
      const result = await generateWith24x7Fallback({
        contents: `Analisis keputusan terbaru pengguna di Tobacco Lab berikut dan ekstrak 1 pelajaran/pola singkat (maksimal 20 kata) untuk memori jangka panjang Nolan (A-Brain):
Tipe Event: ${eventType}
Data Keputusan: ${JSON.stringify(eventData)}
Aturan Saat Ini: ${JSON.stringify(currentMemory?.learnedRules || [])}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              learnedTakeaway: {
                type: Type.STRING,
                description:
                  'Kesimpulan singkat 1 kalimat tentang pola racikan, harga, atau preferensi pabrik dari keputusan ini.',
              },
              shouldAddCoreRule: {
                type: Type.BOOLEAN,
                description:
                  'True jika pola ini penting dijadikan aturan permanen di daftar learnedRules Nolan.',
              },
              conciseRule: {
                type: Type.STRING,
                description: 'Aturan baru singkat jika shouldAddCoreRule true.',
              },
            },
            required: ['learnedTakeaway', 'shouldAddCoreRule'],
          },
        },
      });

      const parsed = JSON.parse(result.text || '{}');
      res.json({
        learnedTakeaway:
          parsed.learnedTakeaway || 'Keputusan dicatat ke dalam memori pembelajaran Nolan.',
        newRule: parsed.shouldAddCoreRule && parsed.conciseRule ? parsed.conciseRule : null,
      });
    } catch {
      res.json({
        learnedTakeaway: 'Pola keputusan pengguna berhasil direkam ke histori pembelajaran Nolan.',
        newRule: null,
      });
    }
  });

async function startServer() {
  // ============================================================================
  // 5. VITE DEV MIDDLEWARE / PRODUCTION STATIC ASSETS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tobacco Lab + Nolan (A-Brain) Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
