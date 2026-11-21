import {
  PackagingMaster,
  RawTobacco,
  TaraFormula,
  TobaccoGrade,
} from '../types/tobacco';
import { getRawTobaccoMissingFlags } from './tobaccoCompleteness';
import {
  TOBACCO_GRADE_ORDER,
  calculateRawTobaccoCost,
  clampRating5,
} from './tobaccoMath';
import { parseGradeCardBarcodePayload } from './thermalPrintEngine';
import type { PrintedLotMetadata } from './printBatchLockEngine';

export interface ScannedGradeCardRawInput {
  cardIndex?: number;
  lotNumber?: string;
  barcodePayload?: string;
  purchaseDate?: string;
  graderName?: string;
  name?: string;
  origin?: string;
  sellerName?: string;
  colorGrade?: string;
  packagingType?: string;
  grossWeightKg?: number;
  pricePerKgPurchase?: number;
  powerRating?: number;
  impactRating?: number;
  bitterRating?: number;
  burnRating?: number;
  sugarRating?: number;
  aromaRating?: number;
  maturityRating?: number;
  characterNotes?: string;
  confidenceScore?: number;
  uncertainFields?: string[];
  hasWeightOrPriceFilled?: boolean;
}

export type ScannedCardMatchAction =
  | 'NEW_STOCK'
  | 'UPDATE_MENYUSUL'
  | 'DUPLICATE_COMPLETE'
  | 'BATCH_DUPLICATE';

export interface AutoCorrectionNote {
  field: string;
  from: string;
  to: string;
}

export interface ReviewedScannedGradeCard {
  reviewId: string;
  lotNumber: string;
  purchaseDate: string;
  dateWasAutoDefaulted?: boolean;
  graderName: string;
  graderBoundFromBarcode?: boolean;
  barcodePayload?: string;
  name: string;
  origin: string;
  sellerName: string;
  colorGrade: TobaccoGrade;
  packagingType: string;
  grossWeightKg: number;
  pricePerKgPurchase: number;
  powerRating: number;
  impactRating: number;
  bitterRating: number;
  burnRating: number;
  sugarRating: number;
  aromaRating: number;
  maturityRating: number;
  attributesConfirmed: boolean;
  characterNotes: string;
  confidenceScore: number;
  uncertainFields: string[];
  autoCorrections: AutoCorrectionNote[];
  matchStatus: ScannedCardMatchAction;
  matchedExistingId?: string;
  matchedExistingLot?: string;
  matchedExistingName?: string;
  updateDiffSummary: string[];
  selectedForSave: boolean;
}

export interface WarehouseMasterDictionary {
  sellers: string[];
  graders: string[];
  origins: string[];
  packagings: string[];
  tobaccoNames: string[];
}

const STANDARD_TOBACCO_ORIGINS = [
  'Muntilan',
  'Temanggung',
  'Madura',
  'Pamekasan',
  'Sumenep',
  'Sampang',
  'Bojonegoro',
  'Jember',
  'Bondowoso',
  'Boyolali',
  'Klaten',
  'Kendal',
  'Weleri',
  'Garut',
  'Sumedang',
  'Majalengka',
  'Lombok',
  'Banyuwangi',
  'Lumajang',
  'Probolinggo',
  'Pasuruan',
  'Malang',
  'Blitar',
  'Tulungagung',
  'Kediri',
  'Ngawi',
  'Magelang',
  'Wonosobo',
  'Windusari',
  'Cepogo',
];

export function buildWarehouseMasterDictionary(
  rawTobaccos: RawTobacco[],
  packagingList: PackagingMaster[],
  registeredGraders: string[] = []
): WarehouseMasterDictionary {
  const sellersSet = new Set<string>();
  const gradersSet = new Set<string>();
  const originsSet = new Set<string>(STANDARD_TOBACCO_ORIGINS);
  const namesSet = new Set<string>();
  const pkgSet = new Set<string>();

  for (const g of registeredGraders) {
    if (g && g.trim()) gradersSet.add(g.trim());
  }

  for (const p of packagingList) {
    if (p.name && p.name.trim()) pkgSet.add(p.name.trim());
  }

  for (const t of rawTobaccos) {
    if (t.sellerName && t.sellerName.trim()) sellersSet.add(t.sellerName.trim());
    if (t.graderName && t.graderName.trim()) gradersSet.add(t.graderName.trim());
    if (t.origin && t.origin.trim()) originsSet.add(t.origin.trim());
    if (t.name && t.name.trim()) namesSet.add(t.name.trim());
    if (t.taraFormula?.packagingType && t.taraFormula.packagingType.trim()) {
      pkgSet.add(t.taraFormula.packagingType.trim());
    }
  }

  return {
    sellers: Array.from(sellersSet).slice(0, 120),
    graders: Array.from(gradersSet).slice(0, 80),
    origins: Array.from(originsSet).slice(0, 120),
    packagings: Array.from(pkgSet).slice(0, 40),
    tobaccoNames: Array.from(namesSet).slice(0, 120),
  };
}

function normalizeToken(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeLevenshteinDistance(a: string, b: string): number {
  const sa = normalizeToken(a);
  const sb = normalizeToken(b);
  if (sa === sb) return 0;
  if (!sa.length) return sb.length;
  if (!sb.length) return sa.length;

  const prev = new Array<number>(sb.length + 1);
  const curr = new Array<number>(sb.length + 1);
  for (let j = 0; j <= sb.length; j++) prev[j] = j;

  for (let i = 1; i <= sa.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= sb.length; j++) {
      const cost = sa[i - 1] === sb[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= sb.length; j++) prev[j] = curr[j];
  }
  return prev[sb.length];
}

function extractConsonantSkeleton(s: string): string {
  const norm = normalizeToken(s).replace(/\s+/g, '');
  if (!norm) return '';
  // Keep first character + consonants (drops vowels after char 0 so "Mntlian" & "Muntilan" -> "mntln")
  return (
    norm.charAt(0) +
    norm
      .slice(1)
      .replace(/[aeiou]/g, '')
  );
}

const ORIGIN_SHORTHANDS: Record<string, string> = {
  mtl: 'Muntilan',
  mntln: 'Muntilan',
  tmg: 'Temanggung',
  tmgg: 'Temanggung',
  wds: 'Windusari',
  wnds: 'Windusari',
  byl: 'Boyolali',
  mdr: 'Madura',
  pmk: 'Pamekasan',
  bjn: 'Bojonegoro',
  jmb: 'Jember',
  bnd: 'Bondowoso',
  klt: 'Klaten',
  mgl: 'Magelang',
  wns: 'Wonosobo',
};

/**
 * Kamus Master Snapper:
 * Matches messy handwritten OCR strings against known warehouse Master names
 * using exact, abbreviation, consonant-skeleton, and Levenshtein similarity.
 */
export function snapToMasterDictionary(
  rawInput: string,
  candidates: string[]
): { value: string; wasAutoCorrected: boolean } {
  const cleaned = String(rawInput || '').trim();
  if (!cleaned || candidates.length === 0) {
    return { value: cleaned, wasAutoCorrected: false };
  }

  const normInput = normalizeToken(cleaned);
  if (!normInput) return { value: cleaned, wasAutoCorrected: false };

  // 1. Exact case-insensitive match
  for (const cand of candidates) {
    if (normalizeToken(cand) === normInput) {
      return {
        value: cand,
        wasAutoCorrected: cand !== cleaned && cand.toLowerCase() !== cleaned.toLowerCase(),
      };
    }
  }

  // 1b. Known warehouse shorthand code (Mtl -> Muntilan, Tmg -> Temanggung, Wds -> Windusari)
  const compactNorm = normInput.replace(/\s+/g, '');
  const shorthandTarget = ORIGIN_SHORTHANDS[compactNorm];
  if (shorthandTarget) {
    const matchedCand =
      candidates.find((c) => normalizeToken(c) === normalizeToken(shorthandTarget)) ||
      shorthandTarget;
    return { value: matchedCand, wasAutoCorrected: true };
  }

  const inputSkeleton = extractConsonantSkeleton(normInput);

  // 2. Fuzzy similarity match (Levenshtein + Consonant Skeleton)
  let bestCandidate = '';
  let bestScore = 0;

  for (const cand of candidates) {
    const normCand = normalizeToken(cand);
    if (!normCand) continue;

    // Substring containment bonus when length >= 4
    if (normInput.length >= 4 && (normCand.includes(normInput) || normInput.includes(normCand))) {
      const ratio =
        Math.min(normInput.length, normCand.length) / Math.max(normInput.length, normCand.length);
      if (ratio >= 0.65 && ratio > bestScore) {
        bestScore = Math.max(bestScore, 0.85 * ratio + 0.15);
        bestCandidate = cand;
      }
    }

    const maxLen = Math.max(normInput.length, normCand.length);
    const dist = computeLevenshteinDistance(normInput, normCand);
    let similarity = 1 - dist / maxLen;

    // Consonant skeleton bonus for handwritten missing/swapped vowels ("Mntlian" vs "Muntilan")
    const candSkeleton = extractConsonantSkeleton(normCand);
    if (inputSkeleton.length >= 3 && candSkeleton.length >= 3) {
      const skMax = Math.max(inputSkeleton.length, candSkeleton.length);
      const skDist = computeLevenshteinDistance(inputSkeleton, candSkeleton);
      const skSim = 1 - skDist / skMax;
      if (skSim >= 0.8) {
        similarity = Math.max(similarity, skSim * 0.94);
      }
    }

    if (similarity >= 0.72 && similarity > bestScore) {
      bestScore = similarity;
      bestCandidate = cand;
    }
  }

  if (bestCandidate && bestScore >= 0.72) {
    return {
      value: bestCandidate,
      wasAutoCorrected: normalizeToken(bestCandidate) !== normInput,
    };
  }

  return { value: cleaned, wasAutoCorrected: false };
}

export function normalizeScannedGrade(rawGrade?: string): TobaccoGrade {
  const cleaned = String(rawGrade || 'D')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace('0', 'D');
  const found = TOBACCO_GRADE_ORDER.find((g) => g === cleaned);
  if (found) return found;
  const letterOnly = cleaned.charAt(0);
  const fallback = TOBACCO_GRADE_ORDER.find((g) => g === letterOnly);
  return fallback || 'D';
}

export function clampWholeAttribute1to5(val: unknown, fallback = 3): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(5, Math.max(1, Math.round(num)));
}

export function normalizeLotNumber(lot?: string): string {
  return String(lot || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

/**
 * Parses handwritten or ISO scanned purchase dates (e.g. "2026-11-16", "16/11/2026", "16/11", "16-11-26").
 * Automatically defaults to today's ISO date when empty/blank/unrecognized placeholders ("___") exist.
 */
export function normalizeScannedPurchaseDate(
  rawDate: string | undefined,
  fallbackYear: number = new Date().getFullYear(),
  todayIso: string = new Date().toISOString().split('T')[0]
): { isoDate: string; wasAutoDefaulted: boolean } {
  const safeYear =
    Number.isFinite(fallbackYear) && fallbackYear >= 2020 && fallbackYear <= 2099
      ? Math.round(fallbackYear)
      : new Date().getFullYear();
  const cleaned = String(rawDate || '').trim();
  if (!cleaned || /^[_/.\-\s]+$/.test(cleaned)) {
    return { isoDate: todayIso, wasAutoDefaulted: true };
  }

  const isValidYmd = (y: number, m: number, d: number): string | null => {
    if (y < 2020 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() + 1 !== m ||
      probe.getUTCDate() !== d
    ) {
      return null;
    }
    return `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleaned.match(/^(\d{4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})$/);
  if (isoMatch) {
    const valid = isValidYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (valid) return { isoDate: valid, wasAutoDefaulted: false };
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY (allowing spaces around slashes like "18 / 11 / 2026")
  const dmyMatch = cleaned.match(/^(\d{1,2})\s*[-/.]\s*(\d{1,2})(?:\s*[-/.]\s*(\d{2,4}))?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = safeYear;
    if (dmyMatch[3]) {
      const yNum = Number(dmyMatch[3]);
      year = yNum < 100 ? 2000 + yNum : yNum;
    }
    const valid = isValidYmd(year, month, day);
    if (valid) return { isoDate: valid, wasAutoDefaulted: false };
  }

  return { isoDate: todayIso, wasAutoDefaulted: true };
}

/**
 * Generates collision-free sequential Lot numbers for printable Grade Cards
 * based on today's date (`LOT-YYMMDD-001`) and existing inventory lots.
 */
export function generateNextLotBatchNumbers(
  rawTobaccos: RawTobacco[],
  count: number,
  customPrefix?: string,
  previouslyIssuedLots: string[] = [],
  minStartSeq: number = 1
): string[] {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = customPrefix?.trim()
    ? customPrefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
    : `LOT-${yy}${mm}${dd}-`;

  const existingLots = new Set<string>([
    ...rawTobaccos.map((t) => normalizeLotNumber(t.lotNumber)),
    ...previouslyIssuedLots.map((l) => normalizeLotNumber(l)),
  ]);
  let maxSeq = 0;

  for (const norm of existingLots) {
    if (norm.startsWith(prefix)) {
      const suffix = norm.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const parsed = parseInt(suffix, 10);
        if (Number.isFinite(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    }
  }

  const floorSeq =
    Number.isFinite(minStartSeq) && minStartSeq >= 1 ? Math.floor(minStartSeq) : 1;
  const out: string[] = [];
  let seq = Math.max(maxSeq + 1, floorSeq);
  while (out.length < count) {
    const candidate = `${prefix}${String(seq).padStart(3, '0')}`;
    if (!existingLots.has(candidate)) {
      out.push(candidate);
    }
    seq++;
  }
  return out;
}

/**
 * Evaluates scanned card output against Kamus Master Gudang + existing RawTobaccos:
 * - Enforces 2-Tahap Menyusul (rescan same Lot to fill Weight/Price/Missing fields)
 * - Blocks accidental double inputs on already-complete lots (`DUPLICATE_COMPLETE` / `BATCH_DUPLICATE`)
 */
export function classifyScannedCardsForReview(params: {
  scannedCards: ScannedGradeCardRawInput[];
  rawTobaccos: RawTobacco[];
  packagingList: PackagingMaster[];
  defaultPrintYear?: number;
  registeredGraders?: string[];
  todayIsoOverride?: string;
  printedLotMetadata?: Record<string, PrintedLotMetadata>;
  localBarcodes?: string[];
}): ReviewedScannedGradeCard[] {
  const {
    scannedCards,
    rawTobaccos,
    packagingList,
    defaultPrintYear,
    registeredGraders = [],
    todayIsoOverride,
    printedLotMetadata = {},
    localBarcodes = [],
  } = params;
  const master = buildWarehouseMasterDictionary(rawTobaccos, packagingList, registeredGraders);
  const todayIso = todayIsoOverride || new Date().toISOString().split('T')[0];

  const existingByLot = new Map<string, RawTobacco>();
  for (const t of rawTobaccos) {
    const normLot = normalizeLotNumber(t.lotNumber);
    if (normLot) existingByLot.set(normLot, t);
  }

  // Parse all locally decoded Code 39 barcodes (e.g. "MTL001/ALDI") into a fast lot lookup
  const parsedLocalBarcodes = (localBarcodes || [])
    .map((code) => parseGradeCardBarcodePayload(code))
    .filter((p) => Boolean(p.lotNumber));
  const localBarcodeByLot = new Map<string, ReturnType<typeof parseGradeCardBarcodePayload>>();
  for (const hit of parsedLocalBarcodes) {
    const existingHit = localBarcodeByLot.get(hit.lotNumber);
    if (!existingHit || (!existingHit.embeddedGraderName && hit.embeddedGraderName)) {
      localBarcodeByLot.set(hit.lotNumber, hit);
    }
  }

  const seenLotsInCurrentScan = new Set<string>();
  const autoLots = generateNextLotBatchNumbers(rawTobaccos, scannedCards.length);

  return scannedCards.map((raw, idx) => {
    const autoCorrections: AutoCorrectionNote[] = [];

    // Parse barcodePayload (if AI extracted "MTL001/ALDI") and raw.lotNumber (in case "/" landed in lotNumber)
    const parsedFromBarcodeField = parseGradeCardBarcodePayload(raw.barcodePayload || '');
    const parsedFromLotField = parseGradeCardBarcodePayload(raw.lotNumber || '');

    let candidateLot = parsedFromBarcodeField.lotNumber || parsedFromLotField.lotNumber;
    let matchedLocalBarcode = candidateLot ? localBarcodeByLot.get(candidateLot) : undefined;
    // Single-card capture convenience: if exactly 1 card & 1 local Code 39 barcode, correlate directly
    if (!matchedLocalBarcode && scannedCards.length === 1 && parsedLocalBarcodes.length === 1) {
      matchedLocalBarcode = parsedLocalBarcodes[0];
      if (!candidateLot) {
        candidateLot = matchedLocalBarcode.lotNumber;
      }
    }

    const rawLot = normalizeLotNumber(candidateLot);
    const lotNumber = rawLot || autoLots[idx];

    const originSnap = snapToMasterDictionary(raw.origin || '', master.origins);
    if (originSnap.wasAutoCorrected && raw.origin) {
      autoCorrections.push({ field: 'Daerah', from: raw.origin, to: originSnap.value });
    }

    const sellerSnap = snapToMasterDictionary(raw.sellerName || '', master.sellers);
    if (sellerSnap.wasAutoCorrected && raw.sellerName) {
      autoCorrections.push({ field: 'Penjual', from: raw.sellerName, to: sellerSnap.value });
    }

    // Fixed Grader Name Correlation Priority:
    // 1. Local Code 39 barcode payload (e.g. MTL001/ALDI)
    // 2. AI-read barcodePayload / lotNumber with embedded "/GRADER"
    // 3. Local printedLotMetadata registry keyed by Lot Number
    // 4. OCR graderName snapped against Kamus Master Graders
    const embeddedBarcodeGrader =
      matchedLocalBarcode?.embeddedGraderName ||
      parsedFromBarcodeField.embeddedGraderName ||
      parsedFromLotField.embeddedGraderName ||
      '';
    const registryGrader = lotNumber ? printedLotMetadata[lotNumber]?.graderName || '' : '';
    const barcodeDerivedRawGrader = embeddedBarcodeGrader || registryGrader;
    const graderBoundFromBarcode = Boolean(barcodeDerivedRawGrader);
    const resolvedBarcodePayload =
      matchedLocalBarcode?.rawPayload ||
      parsedFromBarcodeField.rawPayload ||
      parsedFromLotField.rawPayload ||
      '';

    const graderSnap = barcodeDerivedRawGrader
      ? snapToMasterDictionary(barcodeDerivedRawGrader, master.graders)
      : snapToMasterDictionary(raw.graderName || '', master.graders);

    if (graderBoundFromBarcode) {
      const rawOcrGrader = String(raw.graderName || '').trim();
      if (rawOcrGrader && normalizeToken(rawOcrGrader) !== normalizeToken(graderSnap.value)) {
        autoCorrections.push({
          field: 'Grader (Barcode)',
          from: rawOcrGrader,
          to: graderSnap.value,
        });
      }
    } else if (graderSnap.wasAutoCorrected && raw.graderName) {
      autoCorrections.push({ field: 'Grader', from: raw.graderName, to: graderSnap.value });
    }

    const pkgSnap = snapToMasterDictionary(raw.packagingType || '', master.packagings);
    if (pkgSnap.wasAutoCorrected && raw.packagingType) {
      autoCorrections.push({
        field: 'Kemasan',
        from: raw.packagingType,
        to: pkgSnap.value,
      });
    }

    const fallbackYear =
      (lotNumber ? printedLotMetadata[lotNumber]?.printYear : undefined) ??
      defaultPrintYear ??
      new Date().getFullYear();

    const parsedDate = normalizeScannedPurchaseDate(
      raw.purchaseDate,
      fallbackYear,
      todayIso
    );

    const finalOrigin = originSnap.value || 'Muntilan';
    const finalGrade = normalizeScannedGrade(raw.colorGrade);
    const finalPkg = pkgSnap.value || packagingList[0]?.name || 'KRJ MUNTILAN';
    const finalName =
      String(raw.name || '').trim() ||
      `Tembakau ${finalOrigin} (${finalGrade})`;

    const grossWeightKg = Math.max(0, Number(raw.grossWeightKg) || 0);
    const pricePerKgPurchase = Math.max(0, Math.round(Number(raw.pricePerKgPurchase) || 0));

    const pwr = clampWholeAttribute1to5(raw.powerRating, 3);
    const imp = clampWholeAttribute1to5(raw.impactRating, 3);
    const bit = clampWholeAttribute1to5(raw.bitterRating, 3);
    const brn = clampWholeAttribute1to5(raw.burnRating, 4);
    const sgr = clampWholeAttribute1to5(raw.sugarRating, 3);
    const arm = clampWholeAttribute1to5(raw.aromaRating, 4);
    const mat = clampWholeAttribute1to5(raw.maturityRating, 3);

    const hasExplicitAttributes =
      Number(raw.powerRating) > 0 ||
      Number(raw.impactRating) > 0 ||
      Number(raw.bitterRating) > 0 ||
      Number(raw.burnRating) > 0 ||
      Number(raw.sugarRating) > 0 ||
      Number(raw.aromaRating) > 0 ||
      Number(raw.maturityRating) > 0;

    const hasExplicitName = String(raw.name || '').trim().length > 0;
    const hasExplicitOrigin = String(raw.origin || '').trim().length > 0;
    const hasExplicitSeller = sellerSnap.value.trim().length > 0;
    const hasExplicitGrader = graderSnap.value.trim().length > 0;
    const hasExplicitDate = !parsedDate.wasAutoDefaulted;
    const hasExplicitPkg = String(raw.packagingType || '').trim().length > 0;
    const hasExplicitGrade = String(raw.colorGrade || '').trim().length > 0;
    const cleanedNotesRaw = String(raw.characterNotes || '').trim();
    const cleanedCharacterNotes =
      cleanedNotesRaw.replace(/[-.,_•·*~`'"!?/\\|]+/g, '').trim().length > 0
        ? cleanedNotesRaw
        : '';
    const hasExplicitNotes = cleanedCharacterNotes.length > 0;

    // Anti-Duplicate & Paper-First Update Detection
    let matchStatus: ScannedCardMatchAction = 'NEW_STOCK';
    let matchedExisting: RawTobacco | undefined;
    const updateDiffSummary: string[] = [];

    if (rawLot && seenLotsInCurrentScan.has(rawLot)) {
      matchStatus = 'BATCH_DUPLICATE';
    } else {
      if (rawLot) seenLotsInCurrentScan.add(rawLot);

      // 1. Primary Match by printed Kode Lot
      if (rawLot && existingByLot.has(rawLot)) {
        matchedExisting = existingByLot.get(rawLot);
      } else {
        // 2. Fuzzy Anti-Dobel Check:
        // Match either (Same Seller + Origin + Name + Grade added today)
        // OR (Same Seller + Origin + Name + Grade + identical Weight & Price across dates)
        const normName = normalizeToken(finalName);
        const normOrig = normalizeToken(finalOrigin);
        const normSeller = normalizeToken(sellerSnap.value);
        matchedExisting = rawTobaccos.find((t) => {
          const sameIdentity =
            normalizeToken(t.name) === normName &&
            normalizeToken(t.origin) === normOrig &&
            normalizeToken(t.sellerName || '') === normSeller &&
            t.colorGrade === finalGrade;
          if (!sameIdentity) return false;
          if ((t.purchaseDate || todayIso) === todayIso) return true;
          return (
            grossWeightKg > 0 &&
            pricePerKgPurchase > 0 &&
            Number(t.grossWeightKg) === grossWeightKg &&
            Math.round(Number(t.pricePerKgPurchase) || 0) === pricePerKgPurchase
          );
        });
      }

      if (matchedExisting) {
        const existingFlags = getRawTobaccoMissingFlags(matchedExisting);
        const existingGross = Number(matchedExisting.grossWeightKg) || 0;
        const existingPrice = Math.round(Number(matchedExisting.pricePerKgPurchase) || 0);
        const existingPkg = matchedExisting.taraFormula?.packagingType || '';
        const existingNotes = String(matchedExisting.characterNotes || '').trim();
        const rawNotesClean = cleanedCharacterNotes;

        if (existingFlags.missingWeight && grossWeightKg > 0) {
          updateDiffSummary.push(`+ Timbangan: ${grossWeightKg} kg`);
        } else if (
          !existingFlags.missingWeight &&
          grossWeightKg > 0 &&
          Math.abs(grossWeightKg - existingGross) >= 0.05
        ) {
          updateDiffSummary.push(`Bruto diubah: ${existingGross} kg → ${grossWeightKg} kg`);
        }

        if (existingFlags.missingPrice && pricePerKgPurchase > 0) {
          updateDiffSummary.push(
            `+ Harga Beli: Rp ${pricePerKgPurchase.toLocaleString('id-ID')}/kg`
          );
        } else if (
          !existingFlags.missingPrice &&
          pricePerKgPurchase > 0 &&
          pricePerKgPurchase !== existingPrice
        ) {
          updateDiffSummary.push(
            `Harga diubah: Rp ${existingPrice.toLocaleString('id-ID')} → Rp ${pricePerKgPurchase.toLocaleString('id-ID')}/kg`
          );
        }

        if (existingFlags.missingSeller && hasExplicitSeller) {
          updateDiffSummary.push(`+ Penjual: ${sellerSnap.value}`);
        } else if (
          !existingFlags.missingSeller &&
          hasExplicitSeller &&
          normalizeToken(sellerSnap.value) !== normalizeToken(matchedExisting.sellerName || '')
        ) {
          updateDiffSummary.push(
            `Penjual diubah: ${matchedExisting.sellerName} → ${sellerSnap.value}`
          );
        }

        if (hasExplicitGrader) {
          const prevGrader = (matchedExisting.graderName || '').trim();
          if (!prevGrader) {
            updateDiffSummary.push(`+ Grader: ${graderSnap.value}`);
          } else if (normalizeToken(graderSnap.value) !== normalizeToken(prevGrader)) {
            updateDiffSummary.push(`Grader diubah: ${prevGrader} → ${graderSnap.value}`);
          }
        }

        if (hasExplicitDate && parsedDate.isoDate !== matchedExisting.purchaseDate) {
          updateDiffSummary.push(
            `Tanggal diubah: ${matchedExisting.purchaseDate} → ${parsedDate.isoDate}`
          );
        }

        if (hasExplicitGrade && finalGrade !== matchedExisting.colorGrade) {
          updateDiffSummary.push(`Grade diubah: ${matchedExisting.colorGrade} → ${finalGrade}`);
        }

        if (
          hasExplicitPkg &&
          normalizeToken(finalPkg) !== normalizeToken(existingPkg)
        ) {
          updateDiffSummary.push(`Kemasan diubah: ${existingPkg || '-'} → ${finalPkg}`);
        }

        if (
          hasExplicitName &&
          normalizeToken(finalName) !== normalizeToken(matchedExisting.name)
        ) {
          updateDiffSummary.push(`Nama diubah: ${matchedExisting.name} → ${finalName}`);
        }

        if (
          hasExplicitOrigin &&
          normalizeToken(finalOrigin) !== normalizeToken(matchedExisting.origin)
        ) {
          updateDiffSummary.push(`Daerah diubah: ${matchedExisting.origin} → ${finalOrigin}`);
        }

        if (existingFlags.missingAttributes && hasExplicitAttributes) {
          updateDiffSummary.push('+ Atribut Terisi');
        } else if (hasExplicitAttributes) {
          const attrDiffs: string[] = [];
          const cmpAttr = (label: string, scannedVal: number, oldVal: unknown) => {
            const oldNum = Math.round(clampRating5(Number(oldVal) || 0));
            if (oldNum > 0 && scannedVal !== oldNum) {
              attrDiffs.push(`${label} ${oldNum}→${scannedVal}`);
            }
          };
          cmpAttr('Power', pwr, matchedExisting.powerRating);
          cmpAttr('Impact', imp, matchedExisting.impactRating);
          cmpAttr('Bitter', bit, matchedExisting.bitterRating);
          cmpAttr('Burn', brn, matchedExisting.burnRating);
          cmpAttr('Sugar', sgr, matchedExisting.sugarRating);
          cmpAttr('Aroma', arm, matchedExisting.aromaRating);
          cmpAttr('Maturity', mat, matchedExisting.maturityRating);
          if (attrDiffs.length > 0) {
            updateDiffSummary.push(`Atribut diubah (${attrDiffs.join(', ')})`);
          }
        }

        const isDefaultExistingNote = existingNotes.startsWith('Input via Scan Kartu Grade');
        if (
          hasExplicitNotes &&
          !rawNotesClean.startsWith('Input via Scan Kartu Grade') &&
          (isDefaultExistingNote || normalizeToken(rawNotesClean) !== normalizeToken(existingNotes))
        ) {
          updateDiffSummary.push(
            existingNotes && !isDefaultExistingNote
              ? `Catatan diubah: "${rawNotesClean}"`
              : `+ Catatan Baru: "${rawNotesClean}"`
          );
        }

        if (updateDiffSummary.length > 0 || existingFlags.isIncomplete) {
          matchStatus = 'UPDATE_MENYUSUL';
          if (updateDiffSummary.length === 0 && existingFlags.isIncomplete) {
            updateDiffSummary.push(
              `Lengkapi data ${existingFlags.missingLabels.join(', ')} yang masih kosong`
            );
          }
        } else {
          matchStatus = 'DUPLICATE_COMPLETE';
        }
      }
    }

    const confidence = Math.min(100, Math.max(10, Math.round(Number(raw.confidenceScore) || 85)));
    const uncertainFields = (
      Array.isArray(raw.uncertainFields)
        ? raw.uncertainFields.map((f) => String(f)).filter(Boolean)
        : []
    ).filter((f) => !(graderBoundFromBarcode && f === 'graderName'));

    // When matching an existing record, fill unprovided fields cleanly from existingRecord so review edits are accurate
    const resolvedName =
      matchedExisting && !hasExplicitName ? matchedExisting.name : finalName;
    const resolvedOrigin =
      matchedExisting && !hasExplicitOrigin ? matchedExisting.origin : finalOrigin;
    const resolvedSeller =
      matchedExisting && !hasExplicitSeller
        ? matchedExisting.sellerName || ''
        : sellerSnap.value;
    const resolvedGrader =
      matchedExisting && !hasExplicitGrader
        ? matchedExisting.graderName || ''
        : graderSnap.value;
    const resolvedDate =
      matchedExisting && !hasExplicitDate
        ? matchedExisting.purchaseDate || todayIso
        : parsedDate.isoDate;
    const resolvedGrade =
      matchedExisting && !hasExplicitGrade ? matchedExisting.colorGrade : finalGrade;
    const resolvedPkg =
      matchedExisting && !hasExplicitPkg
        ? matchedExisting.taraFormula?.packagingType || finalPkg
        : finalPkg;
    const resolvedGross =
      matchedExisting && grossWeightKg <= 0
        ? matchedExisting.grossWeightKg || 0
        : grossWeightKg;
    const resolvedPrice =
      matchedExisting && pricePerKgPurchase <= 0
        ? Math.round(matchedExisting.pricePerKgPurchase || 0)
        : pricePerKgPurchase;
    const resolvedNotes =
      matchedExisting && !hasExplicitNotes
        ? matchedExisting.characterNotes || ''
        : cleanedCharacterNotes;

    return {
      reviewId: `scan-rev-${Date.now()}-${idx}`,
      lotNumber,
      purchaseDate: resolvedDate,
      dateWasAutoDefaulted: !matchedExisting && parsedDate.wasAutoDefaulted,
      graderName: resolvedGrader,
      graderBoundFromBarcode,
      barcodePayload: resolvedBarcodePayload || undefined,
      name: resolvedName,
      origin: resolvedOrigin,
      sellerName: resolvedSeller,
      colorGrade: resolvedGrade,
      packagingType: resolvedPkg,
      grossWeightKg: resolvedGross,
      pricePerKgPurchase: resolvedPrice,
      powerRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.powerRating ?? 3)
          : pwr,
      impactRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.impactRating ?? 3)
          : imp,
      bitterRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.bitterRating ?? 3)
          : bit,
      burnRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.burnRating ?? 4)
          : brn,
      sugarRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.sugarRating ?? 3)
          : sgr,
      aromaRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.aromaRating ?? 4)
          : arm,
      maturityRating:
        matchedExisting && !hasExplicitAttributes
          ? clampRating5(matchedExisting.maturityRating ?? 3)
          : mat,
      attributesConfirmed: hasExplicitAttributes || Boolean(matchedExisting),
      characterNotes: resolvedNotes,
      confidenceScore: confidence,
      uncertainFields,
      autoCorrections,
      matchStatus,
      matchedExistingId: matchedExisting?.id,
      matchedExistingLot: matchedExisting?.lotNumber,
      matchedExistingName: matchedExisting?.name,
      updateDiffSummary,
      selectedForSave: matchStatus === 'NEW_STOCK' || matchStatus === 'UPDATE_MENYUSUL',
    };
  });
}

export function buildEditableReviewCardFromExistingStock(
  existingRecord: RawTobacco
): ReviewedScannedGradeCard {
  const pkgType = existingRecord.taraFormula?.packagingType || 'KRJ MUNTILAN';
  const missing: string[] = [];
  if ((existingRecord.grossWeightKg || 0) <= 0) missing.push('Bruto');
  if ((existingRecord.pricePerKgPurchase || 0) <= 0) missing.push('Harga');

  return {
    reviewId: `barcode-edit-${existingRecord.id}-${Date.now()}`,
    lotNumber: existingRecord.lotNumber || existingRecord.id,
    purchaseDate: existingRecord.purchaseDate || new Date().toISOString().split('T')[0],
    dateWasAutoDefaulted: false,
    graderName: existingRecord.graderName || '',
    name: existingRecord.name,
    origin: existingRecord.origin,
    sellerName: existingRecord.sellerName || '',
    colorGrade: existingRecord.colorGrade,
    packagingType: pkgType,
    grossWeightKg: existingRecord.grossWeightKg || 0,
    pricePerKgPurchase: existingRecord.pricePerKgPurchase || 0,
    powerRating: clampRating5(existingRecord.powerRating ?? 0),
    impactRating: clampRating5(existingRecord.impactRating ?? 0),
    bitterRating: clampRating5(existingRecord.bitterRating ?? 0),
    burnRating: clampRating5(existingRecord.burnRating ?? 0),
    sugarRating: clampRating5(existingRecord.sugarRating ?? 0),
    aromaRating: clampRating5(existingRecord.aromaRating ?? 0),
    maturityRating: clampRating5(existingRecord.maturityRating ?? 0),
    attributesConfirmed: true,
    characterNotes: existingRecord.characterNotes || '',
    confidenceScore: 100,
    uncertainFields: [
      ...(existingRecord.grossWeightKg <= 0 ? ['grossWeightKg'] : []),
      ...(existingRecord.pricePerKgPurchase <= 0 ? ['pricePerKgPurchase'] : []),
    ],
    autoCorrections: [],
    matchStatus: 'UPDATE_MENYUSUL',
    matchedExistingId: existingRecord.id,
    matchedExistingLot: existingRecord.lotNumber,
    matchedExistingName: existingRecord.name,
    updateDiffSummary:
      missing.length > 0
        ? [`Barcode ditemukan! Lengkapi ${missing.join(' & ')} atau edit info stok`]
        : ['Barcode sudah ada di gudang (Duplikat / Mode Edit Cepat)'],
    selectedForSave: true,
  };
}

/**
 * Converts a ReviewedScannedGradeCard into a validated RawTobacco object,
 * cleanly merging Stage-2 & paper-first updated fields when updating an existing record.
 */
export function materializeRawTobaccoFromReview(params: {
  card: ReviewedScannedGradeCard;
  existingRecord?: RawTobacco;
  packagingList: PackagingMaster[];
}): RawTobacco {
  const { card, existingRecord, packagingList } = params;

  const matchedPkg =
    packagingList.find(
      (p) => normalizeToken(p.name) === normalizeToken(card.packagingType)
    ) ||
    packagingList[0] || {
      id: 'pkg-default',
      name: card.packagingType || 'Keranjang',
      packagingMassKg: 3,
      taraPercent: 0,
      taraFlatKg: 3,
      packagingCostRp: 35000,
      pressCostRp: 15000,
    };

  const packagingChanged =
    existingRecord &&
    normalizeToken(existingRecord.taraFormula?.packagingType || '') !==
      normalizeToken(matchedPkg.name);

  const taraFormula: TaraFormula =
    existingRecord?.taraFormula && !packagingChanged
      ? {
          ...existingRecord.taraFormula,
          packagingType: card.packagingType || existingRecord.taraFormula.packagingType,
        }
      : {
          rawFormula: `${matchedPkg.taraPercent}% + ${matchedPkg.taraFlatKg} kg`,
          percent: matchedPkg.taraPercent,
          flatKg: matchedPkg.taraFlatKg,
          pricingBasis: 'NET_WEIGHT',
          packagingType: matchedPkg.name,
          packagingMassKg: matchedPkg.packagingMassKg,
        };

  // Preserve existing filled values only if rescan left them empty/zero
  const effectiveGross =
    card.grossWeightKg > 0 ? card.grossWeightKg : existingRecord?.grossWeightKg || 0;
  const effectivePrice =
    card.pricePerKgPurchase > 0
      ? card.pricePerKgPurchase
      : existingRecord?.pricePerKgPurchase || 0;
  const effectiveSeller =
    card.sellerName.trim() || existingRecord?.sellerName || '';
  const effectiveGrader =
    card.graderName.trim() || existingRecord?.graderName || '';
  const effectiveDate =
    (card.purchaseDate || '').trim() ||
    existingRecord?.purchaseDate ||
    new Date().toISOString().split('T')[0];
  const effectiveNotes =
    card.characterNotes.trim() ||
    existingRecord?.characterNotes ||
    `Input via Scan Kartu Grade (${card.lotNumber})`;

  const calc = calculateRawTobaccoCost({
    grossWeightKg: effectiveGross,
    pricePerKgPurchase: effectivePrice,
    taraFormula,
    additionalCost: existingRecord?.additionalPurchaseCost || 0,
    realPackagingMassKg: taraFormula.packagingMassKg,
    agentFees: existingRecord?.agentFees,
    totalAgentFeePerKg: existingRecord?.totalAgentFeePerKg,
  });

  // Calculate remaining stock safely when updating weight
  const prevNet = existingRecord?.netWeightKg || 0;
  const prevRem = existingRecord?.currentStockNetKg || 0;
  const usedAlready = Math.max(0, prevNet - prevRem);
  const nextCurrentStock = Math.max(0, Number((calc.netWeightKg - usedAlready).toFixed(2)));

  const useScannedAttributes = card.attributesConfirmed || !existingRecord;

  return {
    id: existingRecord?.id || `raw-scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    lotNumber: card.lotNumber || existingRecord?.lotNumber || `LOT-${Date.now()}`,
    name: card.name || existingRecord?.name || `Tembakau ${card.origin}`,
    origin: card.origin || existingRecord?.origin || 'Muntilan',
    sellerName: effectiveSeller,
    ...(effectiveGrader ? { graderName: effectiveGrader } : {}),
    purchaseDate: effectiveDate,
    grossWeightKg: effectiveGross,
    packagingMassKg: calc.realPackagingMassKg,
    taraFormula,
    deductionKg: calc.deductionKg,
    netWeightKg: calc.netWeightKg,
    currentStockNetKg: existingRecord && prevNet > 0 ? nextCurrentStock : calc.netWeightKg,
    pricePerKgPurchase: effectivePrice,
    agentFees: existingRecord?.agentFees,
    totalAgentFeePerKg: calc.totalAgentFeePerKg,
    totalAgentFeeRp: calc.totalAgentFeeRp,
    additionalPurchaseCost: existingRecord?.additionalPurchaseCost || 0,
    totalModalAsal: calc.totalInvoiceCost,
    realCostPerNetKg: Math.round(calc.realCostPerNetKg),
    realNetWeightKg: calc.realNetWeightKg,
    realStockValueRp: calc.realStockValueRp,
    purchaseWeightProfitKg: calc.purchaseWeightProfitKg,
    purchaseWeightProfitRp: calc.purchaseWeightProfitRp,
    effectiveCostPerRealKg: Math.round(calc.effectiveCostPerRealKg),
    powerRating: useScannedAttributes
      ? clampRating5(card.powerRating)
      : clampRating5(existingRecord?.powerRating ?? 3),
    impactRating: useScannedAttributes
      ? clampRating5(card.impactRating)
      : clampRating5(existingRecord?.impactRating ?? 3),
    bitterRating: useScannedAttributes
      ? clampRating5(card.bitterRating)
      : clampRating5(existingRecord?.bitterRating ?? 3),
    burnRating: useScannedAttributes
      ? clampRating5(card.burnRating)
      : clampRating5(existingRecord?.burnRating ?? 4),
    sugarRating: useScannedAttributes
      ? clampRating5(card.sugarRating)
      : clampRating5(existingRecord?.sugarRating ?? 3),
    aromaRating: useScannedAttributes
      ? clampRating5(card.aromaRating)
      : clampRating5(existingRecord?.aromaRating ?? 4),
    maturityRating: useScannedAttributes
      ? clampRating5(card.maturityRating)
      : clampRating5(existingRecord?.maturityRating ?? 3),
    colorGrade: card.colorGrade || existingRecord?.colorGrade || 'D',
    characterNotes: effectiveNotes,
  };
}
