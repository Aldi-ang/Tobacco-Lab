import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  FactoryMaster,
  TobaccoGrade,
  SerialFactoryStatus,
} from '../types/tobacco';
import {
  NolanBrainMemory,
  NolanRecommendedBlend,
  NolanNavTarget,
  NolanPendingAction,
} from '../types/nolan';
import { formatRupiah, clampRating5 } from './tobaccoMath';

/**
 * blader/humanizer Post-Processor:
 * Strips all robotic markdown symbols (*, **, #, `) and corporate AI filler phrases,
 * leaving clean, natural human Indonesian with friendly emoticons.
 */
export function humanizeNolanText(input: string): string {
  if (!input) return '';
  let text = String(input);

  // 1. Strip markdown headings (#, ##, ###) at start of lines
  text = text.replace(/^\s*#{1,6}\s+/gm, '');

  // 2. Strip bold/italic asterisks (**text**, *text*, __text__) and backticks (`text`)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove any stray孤 asterisks or hashtags used as formatting
  text = text.replace(/\*\*/g, '');
  text = text.replace(/(^|\s)\*(?=\S)/g, '$1');
  text = text.replace(/(?<=\S)\*(\s|$|[.,!?:;])/g, '$1');

  // 3. Replace markdown bullet dashes "- " or "* " at start of line with clean "• "
  text = text.replace(/^\s*[-*]\s+/gm, '• ');

  // 4. Strip stiff AI opening clichés (blader/humanizer rules)
  text = text.replace(
    /^(Tentu saja!?|Baik,? Bos!?|Berdasarkan data (gudang |yang tersedia )?saat ini,?|Berikut adalah rincian(nya)?:?)\s*/i,
    ''
  );

  // 5. Collapse excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

export interface SmartNolanEngineResult {
  handledInstantly: boolean;
  intent:
    | 'NAVIGATION'
    | 'PENDING_ACTION'
    | 'SPECIFIC_GRADE_CHECK'
    | 'SPECIFIC_ITEM_OR_ORIGIN_CHECK'
    | 'SENSORY_OR_PRICE_RANKING'
    | 'STOCK_QUERY'
    | 'PROFIT_STATUS_QUERY'
    | 'BLEND_RECOMMENDATION'
    | 'TEACH_RULE'
    | 'GREETING_HELP'
    | 'OPEN_AI_QUERY';
  replyMarkdown: string;
  recommendedBlend: NolanRecommendedBlend | null;
  newLearnedRule: string | null;
  navigateTo?: NolanNavTarget | null;
  pendingAction?: NolanPendingAction | null;
  executionMs: number;
}

const ALL_GRADES: TobaccoGrade[] = [
  'A+',
  'A',
  'B+',
  'B',
  'C+',
  'C',
  'D+',
  'D',
  'E+',
  'E',
  'F+',
  'F',
];

const KNOWN_INDONESIAN_TOBACCO_REGIONS = [
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

export function detectQueriedGrade(rawText: string): TobaccoGrade | null {
  const clean = rawText.trim();
  const explicitMatch = clean.match(
    /\b(?:tembakau|grade|grd|kelas|stok|bahan|tipe|jenis|yang|seri)\s+([A-Fa-f]\+?)(?:\b|$|\?|\.|,)/i
  );
  if (explicitMatch && explicitMatch[1]) {
    const candidate = explicitMatch[1].toUpperCase() as TobaccoGrade;
    if (ALL_GRADES.includes(candidate)) return candidate;
  }

  const plusMatch = clean.match(/\b([A-Fa-f]\+)(?:\b|$|\?|\.|,)/);
  if (plusMatch && plusMatch[1]) {
    const candidate = plusMatch[1].toUpperCase() as TobaccoGrade;
    if (ALL_GRADES.includes(candidate)) return candidate;
  }

  const endLetterMatch = clean.match(/\b(?:punya|ada|cari|butuh)\s+([A-Fa-f])(?:\s*\?|$)/i);
  if (endLetterMatch && endLetterMatch[1]) {
    const candidate = endLetterMatch[1].toUpperCase() as TobaccoGrade;
    if (ALL_GRADES.includes(candidate)) return candidate;
  }

  return null;
}

/**
 * Detects if the user is asking Nolan to navigate/switch segments in the app.
 */
export function detectNavigationIntent(rawText: string): {
  target: NolanNavTarget;
  label: string;
} | null {
  const q = rawText.toLowerCase().trim();
  const hasNavVerb =
    /\b(buka|bukakan|pindah|pergi|masuk|tampilkan|lihat|ke\s+halaman|ke\s+menu|ke\s+tab|ke\s+bagian|navigasi)\b/i.test(
      q
    );

  if (!hasNavVerb) return null;

  // Do not treat "tambahkan stok..." or "ubah..." as pure navigation
  if (/\b(tambah|tambahkan|inputkan|masukkan\s+data|ubah|edit|ganti\s+harga|ganti\s+stok)\b/i.test(q)) {
    return null;
  }

  if (q.includes('simulator')) {
    return { target: 'simulator', label: 'Simulator' };
  }
  if (q.includes('setting') || q.includes('pengaturan') || q.includes('konfigurasi')) {
    return { target: 'settings', label: 'Pengaturan (Settings)' };
  }
  if (q.includes('riwayat') || q.includes('histori') || q.includes('history') || q.includes('log')) {
    return { target: 'history', label: 'Riwayat & Log Aktivitas' };
  }
  if (
    q.includes('gulungan') ||
    q.includes('linting') ||
    q.includes('sampel') ||
    q.includes('status barang') ||
    q.includes('status pabrik')
  ) {
    return { target: 'rolls', label: 'Gulungan & Status Barang Pabrik' };
  }
  if (q.includes('seri jadi') || q.includes('nomor seri') || q.includes('tembakau jadi')) {
    return { target: 'finished', label: 'Seri Tembakau Jadi' };
  }
  if (q.includes('kalkulator') || q.includes('racik') || q.includes('campuran')) {
    return { target: 'calculator', label: 'Kalkulator Racikan' };
  }
  if (q.includes('stok jadi') || q.includes('eks-reject') || q.includes('barang reject')) {
    return { target: 'inventory_rejected', label: 'Stok Tembakau Jadi (Eks-Reject)' };
  }
  if (q.includes('form input') || q.includes('modal input') || q.includes('form tambah stok')) {
    return { target: 'input_raw_modal', label: 'Form Input Stok Mentah' };
  }
  if (q.includes('google sheet') || q.includes('spreadsheet')) {
    return { target: 'google_sheets', label: 'Integrasi Google Sheets' };
  }
  if (q.includes('backup') || q.includes('cadangkan')) {
    return { target: 'backup', label: 'Backup Data' };
  }
  if (q.includes('restore') || q.includes('pulihkan')) {
    return { target: 'restore', label: 'Restore Data' };
  }
  if (q.includes('patch') || q.includes('versi') || q.includes('update')) {
    return { target: 'patch_notes', label: 'Catatan Versi (Patch Notes)' };
  }
  if (q.includes('stok') || q.includes('gudang') || q.includes('inventori') || q.includes('bahan mentah')) {
    return { target: 'inventory', label: 'Stok Gudang Mentah' };
  }

  return null;
}

/**
 * Parses numbers like "85 ribu", "85rb", "85.000", "85000", "50 kg" from natural speech/text.
 */
function parsePriceRpFromText(q: string): number | null {
  const rbMatch = q.match(/(?:harga|hpp|senilai|rp)?\s*(\d+(?:[.,]\d+)?)\s*(?:ribu|rb)\b/i);
  if (rbMatch && rbMatch[1]) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }
  const fullRpMatch = q.match(/(?:harga|hpp|rp)\s*[:=]?\s*(\d{2,3}(?:[.,]\d{3})+|\d{5,7})\b/i);
  if (fullRpMatch && fullRpMatch[1]) {
    const cleaned = parseInt(fullRpMatch[1].replace(/[.,]/g, ''), 10);
    if (!isNaN(cleaned) && cleaned >= 1000) return cleaned;
  }
  return null;
}

function parseWeightKgFromText(q: string): number | null {
  const kgMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)\b/i);
  if (kgMatch && kgMatch[1]) {
    const val = parseFloat(kgMatch[1].replace(',', '.'));
    if (!isNaN(val) && val >= 0) return Number(val.toFixed(1));
  }
  return null;
}

/**
 * Detects if the user is asking Nolan to ADD a raw tobacco item, EDIT an existing item,
 * or UPDATE factory status (Requires User Permission before execution).
 */
export function detectPendingActionFromText(params: {
  rawText: string;
  rawTobaccos: RawTobacco[];
  finishedBatches: FinishedTobaccoSerial[];
}): NolanPendingAction | null {
  const { rawText, rawTobaccos, finishedBatches } = params;
  const q = rawText.toLowerCase().trim();

  // 1. Detect ADD_RAW_TOBACCO ("tambah stok...", "input tembakau baru...", "masukkan stok baru...")
  const isAddRaw =
    /\b(tambah|tambahkan|input|inputkan|masukkan)\s+(?:stok|tembakau|bahan|barang)\b/i.test(q);

  if (isAddRaw) {
    const grade = detectQueriedGrade(rawText) || 'D';
    const weightKg = parseWeightKgFromText(q) || 50;
    const priceRp = parsePriceRpFromText(q) || 85000;

    const detectedRegion = KNOWN_INDONESIAN_TOBACCO_REGIONS.find((r) => q.includes(r));
    const origin = detectedRegion
      ? detectedRegion.charAt(0).toUpperCase() + detectedRegion.slice(1)
      : 'Muntilan';

    // Extract name after "stok/tembakau/bahan [baru]" up to keywords like "grade/berat/harga/dari"
    let extractedName = `Tembakau ${origin} Grade ${grade}`;
    const nameMatch = rawText.match(
      /(?:tambah|tambahkan|input|inputkan|masukkan)\s+(?:stok|tembakau|bahan|barang)(?:\s+baru)?\s+(?:namanya\s+)?([A-Za-z0-9\s\-+]{3,32}?)(?=\s+(?:grade|grd|berat|netto|bruto|harga|hpp|dari|petani|sebanyak|\d+\s*kg)|$|[,.])/i
    );
    if (nameMatch && nameMatch[1] && nameMatch[1].trim().length >= 3) {
      extractedName = nameMatch[1].trim();
    }

    const sellerMatch = rawText.match(/\b(?:petani|penjual|dari\s+pak|dari\s+bu|pak|bu)\s+([A-Za-z\s]{2,20}?)(?=\s+(?:grade|berat|harga|\d)|$|[,.])/i);
    const sellerName = sellerMatch && sellerMatch[1] ? sellerMatch[1].trim() : undefined;

    return {
      id: `act-add-${Date.now()}`,
      type: 'ADD_RAW_TOBACCO',
      title: `Tambah Stok Mentah: ${extractedName}`,
      summary: `Nama: ${extractedName} • Daerah: ${origin} • Grade: ${grade} • Berat Bersih: ${weightKg} kg • Harga Beli: ${formatRupiah(priceRp)}/kg`,
      status: 'PENDING',
      newTobacco: {
        name: extractedName,
        origin,
        sellerName,
        colorGrade: grade,
        grossWeightKg: weightKg,
        netWeightKg: weightKg,
        pricePerKgPurchase: priceRp,
        powerRating: 3.5,
        impactRating: 3.5,
        bitterRating: 3.0,
        burnRating: 4.5,
        sugarRating: 4.0,
        aromaRating: 4.0,
        characterNotes: 'Diinput melalui perintah Nolan AI',
      },
    };
  }

  // 2. Detect EDIT_RAW_TOBACCO ("ubah harga MTL...", "edit stok...", "ganti sisa berat...")
  const isEditCmd = /\b(ubah|edit|ganti|set|update|koreksi)\b/i.test(q);
  if (isEditCmd) {
    const matchedRaw = rawTobaccos.find(
      (t) => t.name && q.includes(t.name.toLowerCase())
    );
    if (matchedRaw) {
      const newPrice = parsePriceRpFromText(q);
      const newWeight = parseWeightKgFromText(q);
      const newGrade = detectQueriedGrade(rawText);

      const updates: NonNullable<NolanPendingAction['editTobacco']>['updates'] = {};
      const changeDesc: string[] = [];

      if (newPrice !== null) {
        updates.pricePerKgPurchase = newPrice;
        updates.realCostPerNetKg = newPrice;
        changeDesc.push(`Harga/HPP → ${formatRupiah(newPrice)}/kg`);
      }
      if (newWeight !== null) {
        updates.currentStockNetKg = newWeight;
        changeDesc.push(`Sisa Stok → ${newWeight} kg`);
      }
      if (newGrade !== null && (q.includes('grade') || q.includes('kelas'))) {
        updates.colorGrade = newGrade;
        changeDesc.push(`Grade → ${newGrade}`);
      }

      if (changeDesc.length > 0) {
        return {
          id: `act-edit-${Date.now()}`,
          type: 'EDIT_RAW_TOBACCO',
          title: `Edit Data Stok: ${matchedRaw.name}`,
          summary: `${matchedRaw.name} (${matchedRaw.origin}) • ${changeDesc.join(' • ')}`,
          status: 'PENDING',
          editTobacco: {
            tobaccoId: matchedRaw.id,
            tobaccoName: matchedRaw.name,
            updates,
          },
        };
      }
    }

    // 3. Detect UPDATE_FACTORY_STATUS ("ubah status seri ... jadi diterima / reject")
    if (q.includes('seri') || q.includes('status') || q.includes('accepted') || q.includes('diterima') || q.includes('reject')) {
      const targetSerial =
        finishedBatches.find(
          (b) => b.serialNumber && q.includes(b.serialNumber.toLowerCase())
        ) || finishedBatches[0];

      if (targetSerial) {
        let newStatus: SerialFactoryStatus | null = null;
        let statusLabel = '';
        if (q.includes('diterima') || q.includes('accept')) {
          newStatus = 'ACCEPTED_CAIR';
          statusLabel = 'Diterima / Accepted Pabrik';
        } else if (q.includes('reject') || q.includes('tolak')) {
          newStatus = 'REJECTED_STOCK';
          statusLabel = 'Reject (Masuk Stok Jadi)';
        } else if (q.includes('tunggu') || q.includes('pending')) {
          newStatus = 'PENDING';
          statusLabel = 'Menunggu Pabrik';
        }

        if (newStatus) {
          return {
            id: `act-status-${Date.now()}`,
            type: 'UPDATE_FACTORY_STATUS',
            title: `Ubah Status Pabrik Seri #${targetSerial.serialNumber}`,
            summary: `Seri #${targetSerial.serialNumber} (${targetSerial.recipeName}) → ${statusLabel}`,
            status: 'PENDING',
            statusUpdate: {
              serialId: targetSerial.id,
              serialNumber: targetSerial.serialNumber,
              newStatus,
            },
          };
        }
      }
    }
  }

  return null;
}

/**
 * O(N) Instant Conversational Warehouse & Blending Intelligence Engine.
 * Produces clean, human-like Indonesian responses (blader/humanizer style) with emoticons and zero raw * or # symbols.
 */
export function runNolanSmartEngine(params: {
  message: string;
  rawTobaccos: RawTobacco[];
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  factoryList: FactoryMaster[];
  nolanMemory: NolanBrainMemory;
}): SmartNolanEngineResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const {
    message,
    rawTobaccos = [],
    finishedBatches = [],
    rollSamples = [],
    factoryList = [],
    nolanMemory,
  } = params;

  const rawText = (message || '').trim();
  const q = rawText.toLowerCase().replace(/\s+/g, ' ');

  const elapsed = () =>
    Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime)
    );

  // ============================================================================
  // 0. CHECK INSTANT NAVIGATION OR PERMISSION-GATED ACTION INTENTS
  // ============================================================================
  const navIntent = detectNavigationIntent(rawText);
  if (navIntent) {
    return {
      handledInstantly: true,
      intent: 'NAVIGATION',
      replyMarkdown: `🧭 Siap Bos, sudah saya bukakan bagian ${navIntent.label}.`,
      recommendedBlend: null,
      newLearnedRule: null,
      navigateTo: navIntent.target,
      pendingAction: null,
      executionMs: elapsed(),
    };
  }

  const pendingAct = detectPendingActionFromText({
    rawText,
    rawTobaccos,
    finishedBatches,
  });
  if (pendingAct) {
    return {
      handledInstantly: true,
      intent: 'PENDING_ACTION',
      replyMarkdown: `✍️ Bos, saya sudah siapkan draf perubahannya di bawah ini:\n\n📌 ${pendingAct.title}\n• ${pendingAct.summary}\n\nSilakan klik tombol Izinkan di bawah atau bilang "Ya setuju" kalau sudah pas.`,
      recommendedBlend: null,
      newLearnedRule: null,
      navigateTo: null,
      pendingAction: pendingAct,
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 1. O(N) SINGLE-PASS WAREHOUSE AGGREGATION
  // ============================================================================
  const activeRaw: RawTobacco[] = [];
  const depletedRaw: RawTobacco[] = [];
  let totalRawNetKg = 0;
  let totalModalGudangRp = 0;
  let totalRemainingInventoryValueRp = 0;
  let totalWeightProfitKg = 0;
  let totalWeightProfitRp = 0;

  const byOrigin = new Map<string, { count: number; netKg: number; items: RawTobacco[] }>();
  const byGrade = new Map<string, { count: number; netKg: number; items: RawTobacco[] }>();

  for (let i = 0; i < rawTobaccos.length; i++) {
    const t = rawTobaccos[i];
    const currentKg = Number(t.currentStockNetKg) || 0;
    const initKg = Number(t.netWeightKg) || 0;
    const hpp = Number(t.realCostPerNetKg) || 0;
    const modal = Number(t.totalModalAsal) || Math.round(initKg * hpp);
    const wpKg = Number(t.purchaseWeightProfitKg) || 0;
    const wpRp = Number(t.purchaseWeightProfitRp) || 0;

    totalModalGudangRp += modal;
    totalWeightProfitKg += wpKg;
    totalWeightProfitRp += wpRp;

    if (currentKg > 0) {
      activeRaw.push(t);
      totalRawNetKg += currentKg;
      totalRemainingInventoryValueRp += Math.round(currentKg * hpp);

      const origKey = (t.origin || 'Lainnya').trim();
      const prevOrig = byOrigin.get(origKey) || { count: 0, netKg: 0, items: [] };
      prevOrig.count += 1;
      prevOrig.netKg = Number((prevOrig.netKg + currentKg).toFixed(1));
      prevOrig.items.push(t);
      byOrigin.set(origKey, prevOrig);

      const gradeKey = (t.colorGrade || 'D').trim().toUpperCase();
      const prevGrade = byGrade.get(gradeKey) || { count: 0, netKg: 0, items: [] };
      prevGrade.count += 1;
      prevGrade.netKg = Number((prevGrade.netKg + currentKg).toFixed(1));
      prevGrade.items.push(t);
      byGrade.set(gradeKey, prevGrade);
    } else {
      depletedRaw.push(t);
    }
  }

  totalRawNetKg = Number(totalRawNetKg.toFixed(1));
  totalWeightProfitKg = Number(totalWeightProfitKg.toFixed(1));

  const acceptedSerials: FinishedTobaccoSerial[] = [];
  const rejectedSerials: FinishedTobaccoSerial[] = [];
  const pendingSerials: FinishedTobaccoSerial[] = [];
  let totalNotaActiveRp = 0;
  let totalProfitActiveRp = 0;
  let totalAcceptedNotaRp = 0;
  let totalAcceptedProfitRp = 0;
  let totalRejectKg = 0;

  for (let i = 0; i < finishedBatches.length; i++) {
    const b = finishedBatches[i];
    const status = b.factoryStatus || 'PENDING';
    const rev = Number(b.projectedRevenue) || 0;
    const cost = Number(b.totalProductionCost) || 0;
    const prof = rev - cost;
    const kg = Number(b.factoryNetBillableKg || b.totalBlendNetKg) || 0;

    if (status === 'ACCEPTED_CAIR') {
      acceptedSerials.push(b);
      totalNotaActiveRp += rev;
      totalProfitActiveRp += prof;
      totalAcceptedNotaRp += rev;
      totalAcceptedProfitRp += prof;
    } else if (status === 'REJECTED_STOCK') {
      rejectedSerials.push(b);
      totalRejectKg += kg;
    } else {
      pendingSerials.push(b);
      totalNotaActiveRp += rev;
      totalProfitActiveRp += prof;
    }
  }
  totalRejectKg = Number(totalRejectKg.toFixed(1));

  const availableGradesSummary =
    byGrade.size > 0
      ? Array.from(byGrade.entries())
          .map(([g, info]) => `Grade ${g} (${info.count} bahan, ${info.netKg} kg)`)
          .join(', ')
      : 'belum ada stok aktif';

  const formatStockLines = (items: RawTobacco[], max = 10) => {
    if (items.length === 0) return '• Belum ada stok tembakau mentah yang aktif.';
    const visible = items.slice(0, max);
    const lines = visible.map(
      (t) =>
        `🌿 ${t.name} (Grade ${t.colorGrade}, ${t.origin}) — sisa ${t.currentStockNetKg} kg, HPP ${formatRupiah(Number(t.realCostPerNetKg) || 0)}/kg`
    );
    if (items.length > max) {
      lines.push(`• ...dan ${items.length - max} bahan lainnya.`);
    }
    return lines.join('\n');
  };

  // ============================================================================
  // 2. INTENT 1: TEACHING A NEW RULE / STATEMENT TO A-BRAIN
  // ============================================================================
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
  const isBlendQuery =
    q.includes('racik') ||
    q.includes('rekomendasi') ||
    q.includes('campur') ||
    q.includes('blend') ||
    q.includes('komposisi') ||
    q.includes('resep') ||
    q.includes('formula');

  const isTeachingRule =
    !isBlendQuery &&
    (hasExplicitTeachingKeyword || (!isQuestionText && wordCount >= 4 && !q.startsWith('cek ')));

  if (isTeachingRule) {
    const cleanRule = rawText
      .replace(
        /^(tolong\s+)?(ingat|catat|simpan(\s+ke\s+memori)?|pelajari)\s*(bahwa|kalau|:)?\s*/i,
        ''
      )
      .trim();
    const ruleToSave = cleanRule.length > 3 ? cleanRule : rawText;

    return {
      handledInstantly: true,
      intent: 'TEACH_RULE',
      replyMarkdown: [
        `🧠 Siap Bos, sudah saya pahami dan catat ke Memori A-Brain!`,
        ``,
        `📌 Catatan baru: "${ruleToSave}"`,
        ``,
        `Patokan ini sudah masuk ke Memori (${(nolanMemory?.learnedRules?.length || 0) + 1} aturan aktif) dan bakal selalu saya pakai waktu hitung racikan atau cek stok berikutnya.`,
      ].join('\n'),
      recommendedBlend: null,
      newLearnedRule: ruleToSave.slice(0, 220),
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 3. INTENT 2: BLEND / RACIKAN RECOMMENDATION (Requires Permission to Apply)
  // ============================================================================
  const queriedGrade = detectQueriedGrade(rawText);

  if (isBlendQuery) {
    if (activeRaw.length === 0) {
      return {
        handledInstantly: true,
        intent: 'BLEND_RECOMMENDATION',
        replyMarkdown: `⚠️ Bos, stok tembakau mentah di gudang sekarang lagi kosong (0 kg). Tambahkan stok dulu lewat tombol + Input Stok di atas ya.`,
        recommendedBlend: null,
        newLearnedRule: null,
        executionMs: elapsed(),
      };
    }

    let candidatePool = [...activeRaw];
    const matchingOrigin = candidatePool.filter(
      (t) => t.origin && q.includes(t.origin.toLowerCase())
    );
    if (matchingOrigin.length > 0) {
      candidatePool = matchingOrigin;
    }

    candidatePool.sort((a, b) => {
      const stockDiff = (Number(b.currentStockNetKg) || 0) - (Number(a.currentStockNetKg) || 0);
      if (Math.abs(stockDiff) > 5) return stockDiff;
      return (Number(a.realCostPerNetKg) || 0) - (Number(b.realCostPerNetKg) || 0);
    });

    const chosen = candidatePool.slice(0, Math.min(3, candidatePool.length));
    const shareRatios =
      chosen.length === 1 ? [1] : chosen.length === 2 ? [0.6, 0.4] : [0.5, 0.3, 0.2];
    const desiredTotalKg =
      parseWeightKgFromText(q) ||
      Math.min(
        50,
        Math.max(
          10,
          Number(chosen.reduce((s, t) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1))
        )
      );

    const rawIngs = chosen.map((t, idx) => {
      const maxAvail = Number(t.currentStockNetKg) || 1;
      const idealKg = Number((desiredTotalKg * shareRatios[idx]).toFixed(1));
      const usedNetKg = Math.max(1, Math.min(maxAvail, idealKg));
      return { tobacco: t, usedNetKg: Number(usedNetKg.toFixed(1)) };
    });

    const totalNetKg = Number(rawIngs.reduce((s, x) => s + x.usedNetKg, 0).toFixed(1));
    const totalCost = rawIngs.reduce(
      (s, x) => s + x.usedNetKg * (Number(x.tobacco.realCostPerNetKg) || 0),
      0
    );
    const projectedHppPerKg = totalNetKg > 0 ? Math.round(totalCost / totalNetKg) : 0;

    const latestAccepted = acceptedSerials[0] || finishedBatches[0];
    const defaultTargetPrice =
      latestAccepted && Number(latestAccepted.factoryTargetPricePerKg) > projectedHppPerKg
        ? Number(latestAccepted.factoryTargetPricePerKg)
        : Math.max(85000, Math.round((projectedHppPerKg * 1.32) / 500) * 500);

    const weightedSensory = (field: keyof RawTobacco, fallback: number) =>
      totalNetKg > 0
        ? Number(
            (
              rawIngs.reduce(
                (s, x) => s + (Number(x.tobacco[field]) || fallback) * x.usedNetKg,
                0
              ) / totalNetKg
            ).toFixed(1)
          )
        : fallback;

    const targetFactoryName =
      factoryList.find((f) => q.includes(f.name.toLowerCase()))?.name ||
      rollSamples[0]?.targetFactory ||
      latestAccepted?.targetFactory ||
      factoryList[0]?.name ||
      'CELLO MUNTILAN';

    const recBlend: NolanRecommendedBlend = {
      recipeName: `Racikan Optimal ${chosen[0]?.origin || 'Gudang'}`,
      targetFactory: targetFactoryName,
      targetGrade: (queriedGrade || chosen[0]?.colorGrade || 'D') as TobaccoGrade,
      targetPricePerKg: defaultTargetPrice,
      totalNetKg,
      projectedHppPerKg,
      projectedProfitPerKg: defaultTargetPrice - projectedHppPerKg,
      estimatedSensory: {
        power: clampRating5(weightedSensory('powerRating', 3.5)),
        impact: clampRating5(weightedSensory('impactRating', 3.5)),
        bitter: clampRating5(weightedSensory('bitterRating', 3.2)),
        burn: clampRating5(weightedSensory('burnRating', 4.5)),
        sugar: clampRating5(weightedSensory('sugarRating', 4.0)),
        aroma: clampRating5(weightedSensory('aromaRating', 4.2)),
      },
      reasoning: `Disusun dari ${activeRaw.length} stok aktif dengan HPP rata-rata ${formatRupiah(projectedHppPerKg)}/kg.`,
      ingredients: rawIngs.map((x) => ({
        tobaccoId: x.tobacco.id,
        tobaccoName: x.tobacco.name,
        origin: x.tobacco.origin,
        usedNetKg: x.usedNetKg,
        percentage:
          totalNetKg > 0 ? Number(((x.usedNetKg / totalNetKg) * 100).toFixed(1)) : 100,
        realCostPerNetKg: Number(x.tobacco.realCostPerNetKg) || 0,
        reason: `Grade ${x.tobacco.colorGrade} (${x.tobacco.origin}), sisa ${x.tobacco.currentStockNetKg} kg`,
      })),
    };

    return {
      handledInstantly: true,
      intent: 'BLEND_RECOMMENDATION',
      replyMarkdown: [
        `⚖️ Bos, ini racikan paling pas dari stok yang ready sekarang untuk ${recBlend.targetFactory}:`,
        ``,
        `🎯 Target Grade ${recBlend.targetGrade} (${recBlend.totalNetKg} kg)`,
        `💰 HPP ${formatRupiah(recBlend.projectedHppPerKg)}/kg → Target Pabrik ${formatRupiah(recBlend.targetPricePerKg)}/kg (Estimasi untung +${formatRupiah(recBlend.projectedProfitPerKg)}/kg)`,
        `🔥 Karakter: Power ${recBlend.estimatedSensory.power}, Impact ${recBlend.estimatedSensory.impact}, Bitter ${recBlend.estimatedSensory.bitter}, Burn ${recBlend.estimatedSensory.burn}, Sugar ${recBlend.estimatedSensory.sugar}, Aroma ${recBlend.estimatedSensory.aroma}`,
        ``,
        `👇 Kalau Bos setuju, klik tombol Terapkan di bawah atau bilang "Ya terapkan" supaya saya masukkan ke Kalkulator Racikan.`,
      ].join('\n'),
      recommendedBlend: recBlend,
      newLearnedRule: null,
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 4. INTENT 3: SPECIFIC GRADE CHECK (e.g. "apakah kita punya tembakau F?")
  // ============================================================================
  if (queriedGrade) {
    const exactActive = activeRaw.filter(
      (t) => (t.colorGrade || '').toUpperCase() === queriedGrade
    );
    const baseLetter = queriedGrade.replace('+', '');
    const familyVariant = queriedGrade.endsWith('+') ? baseLetter : `${baseLetter}+`;
    const familyActive = activeRaw.filter(
      (t) => (t.colorGrade || '').toUpperCase() === familyVariant
    );

    if (exactActive.length > 0) {
      const sumKg = Number(
        exactActive.reduce((s, t) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)
      );
      return {
        handledInstantly: true,
        intent: 'SPECIFIC_GRADE_CHECK',
        replyMarkdown: [
          `✅ Ada Bos! Kita punya ${exactActive.length} bahan Grade ${queriedGrade} dengan total sisa ${sumKg} kg:`,
          ``,
          formatStockLines(exactActive, 10),
        ].join('\n'),
        recommendedBlend: null,
        newLearnedRule: null,
        executionMs: elapsed(),
      };
    }

    return {
      handledInstantly: true,
      intent: 'SPECIFIC_GRADE_CHECK',
      replyMarkdown: [
        `❌ Lagi kosong Bos. Di gudang sekarang tidak ada tembakau Grade ${queriedGrade} (0 kg).`,
        familyActive.length > 0
          ? `\n💡 Tapi kita punya varian dekatnya yaitu Grade ${familyVariant} sebanyak ${familyActive.length} bahan (${familyActive.reduce((s, t) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)} kg):\n${formatStockLines(familyActive, 5)}`
          : '',
        ``,
        `📦 Stok yang ready di gudang sekarang (${activeRaw.length} bahan, total ${totalRawNetKg} kg):`,
        `• ${availableGradesSummary}`,
        ``,
        formatStockLines(activeRaw, 6),
      ]
        .filter(Boolean)
        .join('\n'),
      recommendedBlend: null,
      newLearnedRule: null,
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 5. INTENT 4: SPECIFIC ITEM NAME, FARMER, OR REGION CHECK
  // ============================================================================
  const matchedSpecificRaw = rawTobaccos.filter(
    (t) =>
      (t.name && q.includes(t.name.toLowerCase())) ||
      (t.origin && t.origin.length >= 3 && q.includes(t.origin.toLowerCase())) ||
      (t.sellerName && t.sellerName.length >= 3 && q.includes(t.sellerName.toLowerCase()))
  );

  if (matchedSpecificRaw.length > 0) {
    const matchedActive = matchedSpecificRaw.filter((t) => (Number(t.currentStockNetKg) || 0) > 0);
    const matchedKg = Number(
      matchedActive.reduce((s, t) => s + (Number(t.currentStockNetKg) || 0), 0).toFixed(1)
    );
    return {
      handledInstantly: true,
      intent: 'SPECIFIC_ITEM_OR_ORIGIN_CHECK',
      replyMarkdown: [
        matchedActive.length > 0
          ? `✅ Ada Bos, ini ${matchedActive.length} bahan yang cocok (total sisa ${matchedKg} kg):`
          : `⚠️ Datanya ada (${matchedSpecificRaw.length} bahan), tapi sisa stoknya sudah habis (0 kg):`,
        ``,
        ...matchedSpecificRaw.slice(0, 10).map(
          (t) =>
            `🌿 ${t.name} (Grade ${t.colorGrade}, ${t.origin}${t.sellerName ? `, petani ${t.sellerName}` : ''}) — sisa ${t.currentStockNetKg} kg, HPP ${formatRupiah(Number(t.realCostPerNetKg) || 0)}/kg`
        ),
      ].join('\n'),
      recommendedBlend: null,
      newLearnedRule: null,
      executionMs: elapsed(),
    };
  }

  const mentionedRegion = KNOWN_INDONESIAN_TOBACCO_REGIONS.find((reg) => q.includes(reg));
  if (mentionedRegion) {
    const regionPretty = mentionedRegion.charAt(0).toUpperCase() + mentionedRegion.slice(1);
    const availableOrigins = Array.from(byOrigin.keys()).join(', ') || 'belum ada';
    return {
      handledInstantly: true,
      intent: 'SPECIFIC_ITEM_OR_ORIGIN_CHECK',
      replyMarkdown: [
        `❌ Untuk daerah ${regionPretty} sekarang lagi kosong Bos (0 bahan).`,
        ``,
        `📍 Yang ready di gudang sekarang dari daerah ${availableOrigins} (${activeRaw.length} bahan, total ${totalRawNetKg} kg):`,
        formatStockLines(activeRaw, 6),
      ].join('\n'),
      recommendedBlend: null,
      newLearnedRule: null,
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 6. INTENT 5: PROFIT, MODAL & FACTORY STATUS QUERIES
  // ============================================================================
  const isProfitOrStatusQuery =
    q.includes('profit') ||
    q.includes('untung') ||
    q.includes('cuan') ||
    q.includes('modal') ||
    q.includes('cair') ||
    q.includes('nota') ||
    q.includes('pabrik') ||
    q.includes('accepted') ||
    q.includes('diterima') ||
    q.includes('reject') ||
    q.includes('status');

  if (isProfitOrStatusQuery) {
    return {
      handledInstantly: true,
      intent: 'PROFIT_STATUS_QUERY',
      replyMarkdown: [
        `💰 Ini kondisi modal, profit, dan status barang pabrik kita sekarang Bos:`,
        ``,
        `📦 Gudang Mentah:`,
        `• Total modal pembelian: ${formatRupiah(totalModalGudangRp)}`,
        `• Nilai sisa stok (${totalRawNetKg} kg): ${formatRupiah(totalRemainingInventoryValueRp)}`,
        `• Weight profit pembelian: +${totalWeightProfitKg} kg (+${formatRupiah(totalWeightProfitRp)})`,
        ``,
        `🏭 Status Barang di Pabrik (${finishedBatches.length} seri, ${rollSamples.length} gulungan):`,
        `✅ Diterima / Accepted: ${acceptedSerials.length} seri (Nota ${formatRupiah(totalAcceptedNotaRp)}, profit +${formatRupiah(totalAcceptedProfitRp)})`,
        `⏳ Menunggu Pabrik: ${pendingSerials.length} seri`,
        `❌ Reject (masuk Stok Jadi): ${rejectedSerials.length} seri (${totalRejectKg} kg)`,
        `📈 Estimasi total nota aktif: ${formatRupiah(totalNotaActiveRp)} (estimasi profit +${formatRupiah(totalProfitActiveRp)})`,
      ].join('\n'),
      recommendedBlend: null,
      newLearnedRule: null,
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 7. INTENT 6: GENERAL STOCK & WAREHOUSE COUNT
  // ============================================================================
  const isStockQuery =
    q.includes('berapa') ||
    q.includes('barang') ||
    q.includes('stok') ||
    q.includes('stock') ||
    q.includes('gudang') ||
    q.includes('sisa') ||
    q.includes('punya sekarang') ||
    q.includes('bahan') ||
    q.includes('daftar') ||
    q.includes('jumlah') ||
    q.includes('item');

  if (isStockQuery) {
    const totalPhysicalItemsInWarehouse = activeRaw.length + rejectedSerials.length;

    return {
      handledInstantly: true,
      intent: 'STOCK_QUERY',
      replyMarkdown: [
        `📦 Sekarang kita punya ${totalPhysicalItemsInWarehouse} barang ready di gudang (total sisa bersih ${totalRawNetKg} kg):`,
        ``,
        `• Bahan mentah aktif: ${activeRaw.length} jenis (${totalRawNetKg} kg) — ${availableGradesSummary}`,
        `• Stok jadi eks-reject: ${rejectedSerials.length} seri (${totalRejectKg} kg)`,
        `• Total modal inventori: ${formatRupiah(totalModalGudangRp)} (Weight profit +${totalWeightProfitKg} kg / +${formatRupiah(totalWeightProfitRp)})`,
        ``,
        `📋 Rincian stok mentah yang ready:`,
        formatStockLines(activeRaw, 12),
      ].join('\n'),
      recommendedBlend: null,
      newLearnedRule: null,
      executionMs: elapsed(),
    };
  }

  // ============================================================================
  // 8. OPEN AI QUERY FALLBACK
  // ============================================================================
  return {
    handledInstantly: false,
    intent: 'OPEN_AI_QUERY',
    replyMarkdown: [
      `👋 Bos, ini posisi gudang kita sekarang (${activeRaw.length} bahan aktif, total ${totalRawNetKg} kg):`,
      `• Pilihan grade: ${availableGradesSummary}`,
      ``,
      formatStockLines(activeRaw, 8),
      ``,
      `🏭 Status seri jadi (${finishedBatches.length} seri): ${acceptedSerials.length} diterima pabrik, ${pendingSerials.length} menunggu, ${rejectedSerials.length} reject.`,
    ].join('\n'),
    recommendedBlend: null,
    newLearnedRule: null,
    executionMs: elapsed(),
  };
}
