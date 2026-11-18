import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Camera,
  Upload,
  Printer,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  RefreshCw,
  FileCheck2,
  ShieldAlert,
  Image as ImageIcon,
  ScanBarcode,
  Search,
} from 'lucide-react';
import { PackagingMaster, RawTobacco, TobaccoGrade } from '../types/tobacco';
import { TOBACCO_GRADE_ORDER, formatRating5, formatRupiah } from '../utils/tobaccoMath';
import {
  ReviewedScannedGradeCard,
  ScannedGradeCardRawInput,
  buildEditableReviewCardFromExistingStock,
  buildWarehouseMasterDictionary,
  classifyScannedCardsForReview,
  normalizeLotNumber,
} from '../utils/gradeCardEngine';
import { getRawTobaccoMissingFlags } from '../utils/tobaccoCompleteness';
import {
  decodeCode39FromCanvas,
  decodeCode39FromVideoElement,
} from '../utils/code39DecoderEngine';
import {
  GRADER_REGISTRY_STORAGE_KEY,
  GraderRegistryState,
  loadGraderRegistryState,
  registerGraderName,
  saveGraderRegistryState,
} from '../utils/graderRegistryEngine';
import { loadPrintPreferences } from '../utils/printPreferences';
import { getSmartPriceGuard, getSmartWeightGuard } from '../utils/smartInputGuard';
import {
  formatScannerClientError,
  parseSafeApiResponseText,
} from '../utils/safeApiResponse';

interface GradeCardScannerModalProps {
  isOpen: boolean;
  initialTab?: 'scan' | 'print';
  onClose: () => void;
  onOpenPrintPanel?: () => void;
  rawTobaccos: RawTobacco[];
  packagingList: PackagingMaster[];
  onCommitReviewedCards: (cards: ReviewedScannedGradeCard[]) => void;
  onShowToast?: (msg: string) => void;
}

const ATTRIBUTE_FIELDS: {
  key:
    | 'powerRating'
    | 'impactRating'
    | 'bitterRating'
    | 'burnRating'
    | 'sugarRating'
    | 'aromaRating';
  label: string;
  shortLabel: string;
}[] = [
  { key: 'powerRating', label: 'Power', shortLabel: 'PWR' },
  { key: 'impactRating', label: 'Impact', shortLabel: 'IMP' },
  { key: 'bitterRating', label: 'Bitter', shortLabel: 'BIT' },
  { key: 'burnRating', label: 'Burn', shortLabel: 'BRN' },
  { key: 'sugarRating', label: 'Sugar', shortLabel: 'SGR' },
  { key: 'aromaRating', label: 'Aroma', shortLabel: 'ARM' },
];

const UNCERTAIN_FIELD_LABELS: Record<string, string> = {
  lotNumber: 'Kode Lot',
  purchaseDate: 'Tanggal Beli',
  graderName: 'Nama Grader',
  name: 'Nama Tembakau',
  origin: 'Daerah',
  sellerName: 'Penjual',
  colorGrade: 'Grade',
  packagingType: 'Kemasan',
  grossWeightKg: 'Bruto (kg)',
  pricePerKgPurchase: 'Harga/kg',
  powerRating: 'Power',
  impactRating: 'Impact',
  bitterRating: 'Bitter',
  burnRating: 'Burn',
  sugarRating: 'Sugar',
  aromaRating: 'Aroma',
};

function loadImageElementFromDataOrUrl(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Format foto belum didukung browser ini.'));
    el.src = src;
  });
}

function readBlobAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca file gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar dari penyimpanan HP.'));
    reader.readAsDataURL(file);
  });
}

async function loadImageElementFromFile(source: File): Promise<HTMLImageElement> {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const objUrl = URL.createObjectURL(source);
    try {
      return await loadImageElementFromDataOrUrl(objUrl);
    } catch {
      // Fallback to FileReader data URL (helps on iOS standalone / strict Safari blob handling)
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  }
  const dataUrl = await readBlobAsDataUrl(source);
  return await loadImageElementFromDataOrUrl(dataUrl);
}

function encodeCanvasToBoundedJpeg(
  canvas: HTMLCanvasElement,
  initialWidth: number,
  initialHeight: number
): { dataUrl: string; base64: string } {
  const MAX_BASE64_CHARS = 1_200_000;
  let dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  let base64 = (dataUrl.includes('base64,') ? dataUrl.split('base64,').pop() || '' : '').replace(
    /\s+/g,
    ''
  );

  if (base64.length > MAX_BASE64_CHARS) {
    for (const q of [0.68, 0.56]) {
      dataUrl = canvas.toDataURL('image/jpeg', q);
      base64 = (dataUrl.includes('base64,') ? dataUrl.split('base64,').pop() || '' : '').replace(
        /\s+/g,
        ''
      );
      if (base64.length <= MAX_BASE64_CHARS) break;
    }
  }

  if (base64.length > 1_400_000 && Math.max(initialWidth, initialHeight) > 960) {
    const downScale = 960 / Math.max(initialWidth, initialHeight);
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = Math.max(1, Math.round(initialWidth * downScale));
    smallCanvas.height = Math.max(1, Math.round(initialHeight * downScale));
    const sctx = smallCanvas.getContext('2d');
    if (sctx) {
      sctx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
      dataUrl = smallCanvas.toDataURL('image/jpeg', 0.66);
      base64 = (dataUrl.includes('base64,') ? dataUrl.split('base64,').pop() || '' : '').replace(
        /\s+/g,
        ''
      );
    }
  }

  return { dataUrl, base64 };
}

/** Resize & compress image client-side cleanly before uploading to AI Vision + extract local Code 39 barcodes */
async function compressImageFileToJpegBase64(
  source: File | HTMLVideoElement,
  purpose: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK'
): Promise<{ dataUrl: string; base64: string; mimeType: string; localBarcodes: string[] }> {
  const MAX_DIM = 1280;

  let width = 0;
  let height = 0;
  let drawSource: CanvasImageSource;
  let bitmapToClose: ImageBitmap | null = null;

  if (source instanceof HTMLVideoElement) {
    if (!source.videoWidth || !source.videoHeight || source.readyState < 2) {
      throw new Error('Kamera masih bersiap, tunggu gambar tampil lalu coba jepret lagi.');
    }
    width = source.videoWidth;
    height = source.videoHeight;
    drawSource = source;
  } else {
    let loadedBitmap: ImageBitmap | null = null;
    if (typeof createImageBitmap === 'function') {
      try {
        loadedBitmap = await createImageBitmap(source);
      } catch {
        loadedBitmap = null;
      }
    }
    if (loadedBitmap && loadedBitmap.width > 0 && loadedBitmap.height > 0) {
      width = loadedBitmap.width;
      height = loadedBitmap.height;
      drawSource = loadedBitmap;
      bitmapToClose = loadedBitmap;
    } else {
      if (loadedBitmap) {
        try {
          loadedBitmap.close();
        } catch {
          // ignore
        }
      }
      const img = await loadImageElementFromFile(source);
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
      if (!width || !height) {
        throw new Error('Ukuran gambar tidak terbaca. Coba pilih foto lain atau ambil foto ulang.');
      }
      drawSource = img;
    }
  }

  try {
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: purpose === 'BARCODE_UPDATE' });
    if (!ctx) throw new Error('Browser canvas tidak tersedia.');

    ctx.drawImage(drawSource, 0, 0, targetW, targetH);

    let localBarcodes: string[] = [];
    if (purpose === 'BARCODE_UPDATE') {
      try {
        localBarcodes = decodeCode39FromCanvas(canvas);
      } catch {
        localBarcodes = [];
      }
    }

    const { dataUrl, base64 } = encodeCanvasToBoundedJpeg(canvas, targetW, targetH);
    if (base64.length < 100) {
      throw new Error(
        'Hasil kompresi gambar kosong. Silakan ambil foto ulang dengan cahaya lebih baik.'
      );
    }

    return { dataUrl, base64, mimeType: 'image/jpeg', localBarcodes };
  } finally {
    if (bitmapToClose) {
      try {
        bitmapToClose.close();
      } catch {
        // ignore
      }
    }
  }
}

export const GradeCardScannerModal: React.FC<GradeCardScannerModalProps> = ({
  isOpen,
  initialTab = 'scan',
  onClose,
  onOpenPrintPanel,
  rawTobaccos,
  packagingList,
  onCommitReviewedCards,
  onShowToast,
}) => {
  // Camera & Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const barcodePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeScratchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPurpose, setCameraPurpose] = useState<'NEW_STOCK' | 'BARCODE_UPDATE'>('NEW_STOCK');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [barcodeManualQuery, setBarcodeManualQuery] = useState('');
  const barcodeTimerRef = useRef<number | null>(null);

  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [isScanningAI, setIsScanningAI] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [unregisteredBarcodeLot, setUnregisteredBarcodeLot] = useState<string | null>(null);
  const [scanQualityWarning, setScanQualityWarning] = useState<string>('');
  const [scanModelUsed, setScanModelUsed] = useState<string>('');
  const [reviewedCards, setReviewedCards] = useState<ReviewedScannedGradeCard[]>([]);

  // Shared printYear & Grader registry read from storage for AI scan auto-fill + remember on save
  const [printYear, setPrintYear] = useState<number>(() => loadPrintPreferences().printYear);
  const [graderRegistryRaw, setGraderRegistryRaw] = useState<GraderRegistryState>(() =>
    loadGraderRegistryState()
  );

  useEffect(() => {
    if (isOpen) {
      setPrintYear(loadPrintPreferences().printYear);
      setGraderRegistryRaw(loadGraderRegistryState());
      if (initialTab === 'print' && onOpenPrintPanel) {
        onClose();
        onOpenPrintPanel();
      }
    }
  }, [isOpen, initialTab, onOpenPrintPanel, onClose]);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === GRADER_REGISTRY_STORAGE_KEY) {
        setGraderRegistryRaw(loadGraderRegistryState());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persistGraderRegistry = (next: GraderRegistryState) => {
    saveGraderRegistryState(next);
    setGraderRegistryRaw(next);
  };

  const masterDict = useMemo(
    () =>
      buildWarehouseMasterDictionary(
        rawTobaccos,
        packagingList,
        graderRegistryRaw.registeredGraders
      ),
    [rawTobaccos, packagingList, graderRegistryRaw.registeredGraders]
  );

  const stopCamera = () => {
    if (barcodeTimerRef.current !== null) {
      window.clearInterval(barcodeTimerRef.current);
      barcodeTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const findExistingStockByCode = (rawCode: string): RawTobacco | undefined => {
    const cleanCode = normalizeLotNumber(rawCode);
    if (!cleanCode) return undefined;
    return (
      rawTobaccos.find((t) => normalizeLotNumber(t.lotNumber) === cleanCode) ||
      rawTobaccos.find((t) => normalizeLotNumber(t.id) === cleanCode)
    );
  };

  const handleBarcodeLotResolved = (rawCode: string): boolean => {
    const cleanCode = normalizeLotNumber(rawCode);
    if (!cleanCode) {
      setScanError('Masukkan atau arahkan barcode Kode Lot terlebih dahulu.');
      setUnregisteredBarcodeLot(null);
      return false;
    }

    const found = findExistingStockByCode(cleanCode);
    if (!found) {
      stopCamera();
      setUnregisteredBarcodeLot(cleanCode);
      setScanError(
        `Barcode "${cleanCode}" terbaca oleh kamera, tetapi belum ada di stok gudang.`
      );
      return false;
    }

    stopCamera();
    setScanError(null);
    setUnregisteredBarcodeLot(null);
    setCameraError(null);
    setScanQualityWarning('');
    setScanModelUsed('Barcode Scanner');
    setReviewedCards([buildEditableReviewCardFromExistingStock(found)]);
    const missingFlags = getRawTobaccoMissingFlags(found);
    if (!missingFlags.isIncomplete) {
      onShowToast?.(
        `Duplikat Terdeteksi: Lot ${found.lotNumber || cleanCode} ("${found.name}") sudah lengkap di gudang — dibuka di Mode Edit Cepat.`
      );
    } else {
      onShowToast?.(
        `Lot ${found.lotNumber || cleanCode} ("${found.name}") sudah ada (belum lengkap) — siap update & edit info!`
      );
    }
    return true;
  };

  const handleRegisterUnregisteredBarcodeAsNew = (lotCode: string) => {
    const cleanLot = normalizeLotNumber(lotCode);
    const classified = classifyScannedCardsForReview({
      scannedCards: [
        {
          lotNumber: cleanLot,
          name: '',
          origin: '',
          sellerName: '',
          colorGrade: 'D',
          packagingType: packagingList[0]?.name || '',
          grossWeightKg: 0,
          pricePerKgPurchase: 0,
          powerRating: 0,
          impactRating: 0,
          bitterRating: 0,
          burnRating: 0,
          sugarRating: 0,
          aromaRating: 0,
          uncertainFields: ['name', 'origin', 'grossWeightKg', 'pricePerKgPurchase'],
        },
      ],
      rawTobaccos,
      packagingList,
      defaultPrintYear: printYear,
      registeredGraders: graderRegistryRaw.registeredGraders,
    });
    setScanError(null);
    setUnregisteredBarcodeLot(null);
    setScanModelUsed('Barcode Register Baru');
    setReviewedCards(classified);
  };

  // Native BarcodeDetector + Universal Pure-TS Code 39 Pixel Decoder loop (works on Chrome, Android, iOS Safari, Firefox)
  useEffect(() => {
    if (!cameraActive || cameraPurpose !== 'BARCODE_UPDATE') {
      if (barcodeTimerRef.current !== null) {
        window.clearInterval(barcodeTimerRef.current);
        barcodeTimerRef.current = null;
      }
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;
    let detector: any = null;
    if (typeof BarcodeDetectorCtor === 'function') {
      try {
        detector = new BarcodeDetectorCtor({
          formats: ['code_39', 'code_128', 'qr_code'],
        });
      } catch {
        detector = null;
      }
    }

    if (!barcodeScratchCanvasRef.current && typeof document !== 'undefined') {
      barcodeScratchCanvasRef.current = document.createElement('canvas');
    }

    let busy = false;
    barcodeTimerRef.current = window.setInterval(async () => {
      if (busy || !videoRef.current || videoRef.current.readyState < 2) return;
      busy = true;
      try {
        // 1. Try hardware-accelerated browser BarcodeDetector when available
        if (detector) {
          const codes = await detector.detect(videoRef.current);
          if (Array.isArray(codes) && codes.length > 0 && codes[0]?.rawValue) {
            handleBarcodeLotResolved(String(codes[0].rawValue));
            return;
          }
        }
        // 2. Universal pure-TS ISO Code 39 pixel decoder fallback (iOS Safari / Firefox / webcam)
        const localHits = decodeCode39FromVideoElement(
          videoRef.current,
          barcodeScratchCanvasRef.current
        );
        if (localHits.length > 0) {
          handleBarcodeLotResolved(localHits[0]);
        }
      } catch {
        // Ignore single-frame decode errors
      } finally {
        busy = false;
      }
    }, 260);

    return () => {
      if (barcodeTimerRef.current !== null) {
        window.clearInterval(barcodeTimerRef.current);
        barcodeTimerRef.current = null;
      }
    };
  }, [cameraActive, cameraPurpose, rawTobaccos]);

  const startCamera = async (purpose: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK') => {
    setCameraPurpose(purpose);
    setCameraError(null);
    setScanError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        purpose === 'BARCODE_UPDATE'
          ? 'Kamera live tidak tersedia di browser ini. Ketik / tembak scanner USB Kode Lot di kotak bawah, atau pakai Foto Kamera HP / Galeri.'
          : 'Browser tidak mendukung kamera langsung. Gunakan Upload Foto / Kamera HP di bawah.'
      );
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
        const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
        };
        setTorchSupported(Boolean(caps?.torch));
      }
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Kamera gagal dibuka (${err.message}). Gunakan scanner USB/ketik Lot di bawah atau Upload Foto.`
          : 'Kamera gagal dibuka. Gunakan scanner USB/ketik Lot di bawah atau Upload Foto.'
      );
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch {
      onShowToast?.('Lampu senter/flash tidak didukung oleh browser perangkat ini.');
    }
  };

  const runAiVisionScan = async (
    imageData: {
      dataUrl: string;
      base64: string;
      mimeType: string;
      localBarcodes?: string[];
    },
    purpose: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK'
  ) => {
    setCapturedPreviewUrl(imageData.dataUrl);
    setScanError(null);
    setUnregisteredBarcodeLot(null);
    setScanQualityWarning('');
    stopCamera();

    // Fast-path: if Mode 2 (Barcode Update) decoded 1D Code 39 locally on canvas and it matches gudang, resolve immediately!
    const localHits = Array.isArray(imageData.localBarcodes) ? imageData.localBarcodes : [];
    if (purpose === 'BARCODE_UPDATE' && localHits.length > 0) {
      const matchedLocal: ReviewedScannedGradeCard[] = [];
      const seenIds = new Set<string>();
      for (const code of localHits) {
        const existing = findExistingStockByCode(code);
        if (existing && !seenIds.has(existing.id)) {
          seenIds.add(existing.id);
          matchedLocal.push(buildEditableReviewCardFromExistingStock(existing));
        }
      }
      if (matchedLocal.length > 0) {
        setScanModelUsed('Code 39 Barcode Decoder');
        setReviewedCards(matchedLocal);
        onShowToast?.(
          `Stok Sudah Ada (Barcode): ${matchedLocal.map((m) => m.lotNumber).join(', ')} ditemukan di gudang — siap update & edit info.`
        );
        return;
      }
    }

    setIsScanningAI(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 55000);

    try {
      const response = await fetch('/api/scan-grade-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          scanMode: purpose,
          masterContext: {
            sellers: masterDict.sellers.slice(0, 60),
            graders: masterDict.graders.slice(0, 40),
            origins: masterDict.origins.slice(0, 60),
            packagings: masterDict.packagings.slice(0, 30),
            tobaccoNames: masterDict.tobaccoNames.slice(0, 60),
            existingLotNumbers: rawTobaccos.map((t) => t.lotNumber).filter(Boolean).slice(0, 100),
          },
        }),
      });
      window.clearTimeout(timeoutId);

      const rawText = await response.text();
      const parsedResp = parseSafeApiResponseText<{
        cards?: ScannedGradeCardRawInput[];
        imageQualityWarning?: string;
        modelUsed?: string;
        error?: string;
      }>({
        ok: response.ok,
        status: response.status,
        rawText,
        fallbackError: 'Gagal memproses foto Kartu Grade di server AI.',
      });

      if (!parsedResp.ok || !parsedResp.data) {
        throw new Error(parsedResp.errorMessage || `Server error (${response.status})`);
      }

      const payload = parsedResp.data;
      const rawCards: ScannedGradeCardRawInput[] = Array.isArray(payload.cards)
        ? payload.cards
        : [];
      setScanQualityWarning(String(payload.imageQualityWarning || ''));
      setScanModelUsed(String(payload.modelUsed || ''));

      if (rawCards.length === 0) {
        if (localHits.length > 0) {
          const firstMatched = localHits.find((code) => Boolean(findExistingStockByCode(code)));
          if (firstMatched) {
            handleBarcodeLotResolved(firstMatched);
            return;
          }
          setReviewedCards([]);
          setUnregisteredBarcodeLot(normalizeLotNumber(localHits[0]));
          setScanError(
            `Barcode "${localHits.join(', ')}" terbaca oleh kamera, tetapi belum ada di stok gudang.`
          );
          return;
        }
        setReviewedCards([]);
        setScanError(
          payload.imageQualityWarning ||
            'Tidak ada Kartu Grade atau Barcode yang terbaca jelas pada foto ini. Pastikan tulisan/barcode jelas & cahaya cukup.'
        );
        return;
      }

      if (purpose === 'BARCODE_UPDATE') {
        const matchedLots: ReviewedScannedGradeCard[] = [];
        const unmatchedDetectedLots: string[] = [];
        const seenIds = new Set<string>();
        for (const rc of rawCards) {
          const cleanLot = normalizeLotNumber(rc.lotNumber);
          if (!cleanLot) continue;
          const existing = findExistingStockByCode(cleanLot);
          if (existing) {
            if (!seenIds.has(existing.id)) {
              seenIds.add(existing.id);
              const baseEdit = buildEditableReviewCardFromExistingStock(existing);
              const gVal = Number(rc.grossWeightKg) || 0;
              const pVal = Number(rc.pricePerKgPurchase) || 0;
              matchedLots.push({
                ...baseEdit,
                grossWeightKg: gVal > 0 ? gVal : baseEdit.grossWeightKg,
                pricePerKgPurchase: pVal > 0 ? pVal : baseEdit.pricePerKgPurchase,
              });
            }
          } else {
            unmatchedDetectedLots.push(cleanLot);
          }
        }
        if (matchedLots.length > 0) {
          setReviewedCards(matchedLots);
          onShowToast?.(
            `Duplikat / Stok Ditemukan via Barcode (${matchedLots.map((m) => m.lotNumber).join(', ')}) — dibuka di mode Edit Cepat.`
          );
          return;
        }
        const detectedSummary = Array.from(
          new Set([...localHits, ...unmatchedDetectedLots])
        ).join(', ');
        const firstUnregistered = localHits[0] || unmatchedDetectedLots[0] || null;
        setUnregisteredBarcodeLot(firstUnregistered ? normalizeLotNumber(firstUnregistered) : null);
        setReviewedCards([]);
        setScanError(
          detectedSummary
            ? `Barcode "${detectedSummary}" terbaca jelas oleh kamera, tetapi belum terdaftar di stok gudang.`
            : 'Barcode tidak terbaca jelas pada foto ini. Dekatkan kamera ke area garis barcode.'
        );
        return;
      }

      const classified = classifyScannedCardsForReview({
        scannedCards: rawCards,
        rawTobaccos,
        packagingList,
        defaultPrintYear: printYear,
        registeredGraders: graderRegistryRaw.registeredGraders,
      });
      setReviewedCards(classified);

      const dupCards = classified.filter(
        (c) => c.matchStatus === 'DUPLICATE_COMPLETE' || c.matchStatus === 'BATCH_DUPLICATE'
      ).length;
      const updateCards = classified.filter((c) => c.matchStatus === 'UPDATE_MENYUSUL').length;
      const newCards = classified.filter((c) => c.matchStatus === 'NEW_STOCK').length;

      if (dupCards > 0 && updateCards > 0) {
        onShowToast?.(
          `Duplikat terdeteksi (${dupCards} kartu sama persis dilewati), & ${updateCards} kartu lama punya tulisan baru siap diperbarui!`
        );
      } else if (dupCards > 0 && newCards === 0 && updateCards === 0) {
        onShowToast?.(
          `Peringatan Duplikat! ${dupCards} kartu terdeteksi ganda (data sama persis sudah ada di gudang).`
        );
      } else if (dupCards > 0) {
        onShowToast?.(
          `${newCards} stok baru siap simpan • ${dupCards} kartu duplikat otomatis dilewati.`
        );
      } else if (updateCards > 0) {
        onShowToast?.(
          `Lot sudah terdaftar — ditemukan tulisan/info baru di kertas untuk ${updateCards} kartu (siap update stok lama)!`
        );
      } else if (newCards > 0) {
        onShowToast?.(`${newCards} kartu stok baru terbaca & siap dicek sebelum disimpan.`);
      }
    } catch (err) {
      window.clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setScanError(
          'Scanner AI melebihi batas waktu (55 detik). Silakan coba scan ulang atau gunakan jaringan yang lebih stabil.'
        );
      } else {
        setScanError(
          formatScannerClientError(
            err,
            'Gagal terhubung ke Scanner AI. Periksa koneksi internet Anda.'
          )
        );
      }
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleCaptureFromLiveVideo = async () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (!vid.videoWidth || !vid.videoHeight || vid.readyState < 2) {
      onShowToast?.('Kamera masih bersiap, tunggu gambar tampil lalu coba jepret lagi.');
      return;
    }
    try {
      const compressed = await compressImageFileToJpegBase64(vid, cameraPurpose);
      await runAiVisionScan(compressed, cameraPurpose);
    } catch (err) {
      setScanError(formatScannerClientError(err, 'Gagal mengambil gambar kamera.'));
    }
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    purposeOverride: 'NEW_STOCK' | 'BARCODE_UPDATE' = 'NEW_STOCK'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFileToJpegBase64(file, purposeOverride);
      await runAiVisionScan(compressed, purposeOverride);
    } catch (err) {
      setScanError(formatScannerClientError(err, 'Gagal memproses file foto.'));
    }
  };

  const updateReviewedCard = (
    reviewId: string,
    patch: Partial<ReviewedScannedGradeCard>
  ) => {
    setReviewedCards((prev) =>
      prev.map((c) => {
        if (c.reviewId !== reviewId) return c;
        const updated = { ...c, ...patch };
        // Clear uncertain highlight on fields the user explicitly edited
        const editedKeys = Object.keys(patch);
        const remainingUncertain = updated.uncertainFields.filter(
          (f) => !editedKeys.includes(f)
        );
        return {
          ...updated,
          uncertainFields: remainingUncertain,
        };
      })
    );
  };

  const removeReviewedCard = (reviewId: string) => {
    setReviewedCards((prev) => prev.filter((c) => c.reviewId !== reviewId));
  };

  const resetForNextPhoto = () => {
    setCapturedPreviewUrl(null);
    setReviewedCards([]);
    setScanError(null);
    setScanQualityWarning('');
  };

  const selectedToSaveCount = reviewedCards.filter((c) => c.selectedForSave).length;
  const stage2Count = reviewedCards.filter(
    (c) => c.selectedForSave && c.matchStatus === 'UPDATE_MENYUSUL'
  ).length;
  const duplicateBlockedCount = reviewedCards.filter(
    (c) => c.matchStatus === 'DUPLICATE_COMPLETE' || c.matchStatus === 'BATCH_DUPLICATE'
  ).length;

  const handleConfirmCommit = () => {
    const chosen = reviewedCards.filter((c) => c.selectedForSave);
    if (chosen.length === 0) {
      onShowToast?.('Centang minimal 1 kartu untuk disimpan ke gudang.');
      return;
    }
    // Auto-remember any new Grader name entered/scanned during review
    let nextGraderReg = graderRegistryRaw;
    let changedGrader = false;
    for (const c of chosen) {
      const cleanG = (c.graderName || '').trim();
      if (cleanG) {
        const res = registerGraderName(nextGraderReg, cleanG);
        nextGraderReg = res.nextState;
        changedGrader = true;
      }
    }
    if (changedGrader) {
      persistGraderRegistry(nextGraderReg);
    }

    onCommitReviewedCards(chosen);
    resetForNextPhoto();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[92vh] bg-[#070709] border border-zinc-800 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-white"
          >
            {/* Header */}
            <div className="px-4 py-3 sm:px-6 border-b border-zinc-800 bg-black/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0d0f14] border border-amber-500/70 flex items-center justify-center text-amber-300 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                    Scan Kartu Grade &amp; Barcode AI
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenPrintPanel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPrintPanel();
                    }}
                    className="h-9 px-3.5 rounded-xl bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Buka Cetak Kartu</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup Scanner Kartu Grade"
                  className="h-9 w-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] p-4 sm:p-5 space-y-4">
                  {/* Hidden file inputs for native mobile camera, barcode update photo, & gallery */}
                  <input
                    ref={nativeCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileSelected(e, cameraPurpose)}
                    className="hidden"
                  />
                  <input
                    ref={barcodePhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelected(e, 'BARCODE_UPDATE')}
                    className="hidden"
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelected(e, 'NEW_STOCK')}
                    className="hidden"
                  />

                  {/* Capture Section (shown when no reviewed cards yet) */}
                  {reviewedCards.length === 0 && (
                    <div className="space-y-4">
                      {/* Live Camera Frame OR Capture Options */}
                      {cameraActive ? (
                        <div
                          className={`relative rounded-2xl overflow-hidden border-2 bg-black ${
                            cameraPurpose === 'BARCODE_UPDATE'
                              ? 'border-emerald-500/80'
                              : 'border-amber-500/70'
                          }`}
                        >
                          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[50vh] bg-black overflow-hidden">
                            <video
                              ref={videoRef}
                              playsInline
                              muted
                              autoPlay
                              className="w-full h-full object-cover bg-black"
                            />
                          </div>

                          {/* Purpose-Specific Warehouse Framing Overlay */}
                          {cameraPurpose === 'BARCODE_UPDATE' ? (
                            <div className="pointer-events-none absolute inset-x-8 sm:inset-x-16 top-1/2 -translate-y-1/2 h-32 border-2 border-emerald-400/70 rounded-xl bg-emerald-500/5">
                              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[2px] bg-red-500/85 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-black/85 border border-emerald-500/60 text-[10px] font-extrabold text-emerald-300 whitespace-nowrap">
                                Arahkan ke Barcode Belakang Kartu (Auto-Deteksi Lot)
                              </div>
                            </div>
                          ) : (
                            <div className="pointer-events-none absolute inset-5 sm:inset-8 border border-amber-400/30 rounded-xl">
                              <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-[3px] border-l-[3px] border-amber-400 rounded-tl-md" />
                              <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-[3px] border-r-[3px] border-amber-400 rounded-tr-md" />
                              <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-[3px] border-l-[3px] border-amber-400 rounded-bl-md" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-[3px] border-r-[3px] border-amber-400 rounded-br-md" />
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/75 border border-amber-500/50 text-[10px] font-extrabold text-amber-300 whitespace-nowrap">
                                Jajarkan 1 s/d 4 Kartu Stok Baru di Dalam Bingkai
                              </div>
                            </div>
                          )}

                          {/* Camera HUD Controls */}
                          <div className="p-3 bg-black/95 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={toggleTorch}
                                className={`h-10 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                                  torchOn
                                    ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                                }`}
                                title={
                                  torchSupported
                                    ? 'Nyalakan/matikan lampu senter kamera'
                                    : 'Coba nyalakan senter kamera'
                                }
                              >
                                {torchOn ? (
                                  <Zap className="w-4 h-4 fill-current" />
                                ) : (
                                  <ZapOff className="w-4 h-4" />
                                )}
                                <span>{torchOn ? 'Senter ON' : 'Senter'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  stopCamera();
                                  nativeCameraInputRef.current?.click();
                                }}
                                className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Kamera Bawaan</span>
                              </button>

                              <button
                                type="button"
                                onClick={stopCamera}
                                className="h-10 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-bold cursor-pointer"
                              >
                                Tutup Kamera
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={handleCaptureFromLiveVideo}
                              className={`h-11 px-5 rounded-xl font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer border shadow-lg transition-colors ${
                                cameraPurpose === 'BARCODE_UPDATE'
                                  ? 'bg-[#0c1411] hover:bg-emerald-950/50 text-emerald-300 border-emerald-500/80'
                                  : 'bg-[#0d0f14] hover:bg-amber-500/10 text-amber-300 border-amber-500/80'
                              }`}
                            >
                              {cameraPurpose === 'BARCODE_UPDATE' ? (
                                <ScanBarcode className="w-4 h-4" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                              <span>
                                {cameraPurpose === 'BARCODE_UPDATE'
                                  ? 'Jepret & Baca Barcode (AI)'
                                  : 'Jepret & Input Stok Baru'}
                              </span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* OPTION 1: Camera Mode 1 — Input Stok Baru */}
                            <button
                              type="button"
                              onClick={() => startCamera('NEW_STOCK')}
                              disabled={isScanningAI}
                              className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-amber-500/60 hover:border-amber-400 text-left space-y-2 transition-colors duration-150 cursor-pointer"
                            >
                              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-center text-amber-400">
                                <Camera className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black text-white">
                                1. Kamera Stok Baru (Kartu Grade)
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Foto kartu depan (Silang X &amp; tulis tangan) untuk upload stok baru atau update tulisan kertas baru.
                              </p>
                            </button>

                            {/* OPTION 2: Camera Mode 2 — Barcode Scanner for Update & Edit Info */}
                            <button
                              type="button"
                              onClick={() => startCamera('BARCODE_UPDATE')}
                              disabled={isScanningAI}
                              className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-emerald-500/55 hover:border-emerald-400 text-left space-y-2 transition-colors duration-150 cursor-pointer"
                            >
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                                <ScanBarcode className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black text-white">
                                2. Scan Barcode (Update / Edit Info)
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Scan barcode besar di belakang kartu untuk update timbangan, harga, &amp; edit info stok lama.
                              </p>
                            </button>

                            {/* OPTION 3: Gallery Upload */}
                            <button
                              type="button"
                              onClick={() => galleryInputRef.current?.click()}
                              disabled={isScanningAI}
                              className="p-5 rounded-2xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-left space-y-2 transition-colors duration-150 cursor-pointer"
                            >
                              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-200">
                                <Upload className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black text-white">
                                3. Upload Foto dari Galeri
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">
                                Pilih foto dari HP/WhatsApp (bisa berisi 1 atau banyak kartu berjejer).
                              </p>
                            </button>
                          </div>

                          {/* Instant USB Barcode Gun / Upload Foto Barcode / Manual Lot Code Quick Update Bar */}
                          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleBarcodeLotResolved(barcodeManualQuery);
                              }}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-400 shrink-0">
                                <ScanBarcode className="w-4 h-4" />
                                <span>Scanner USB / Input Cepat Kode Lot:</span>
                              </div>
                              <input
                                type="text"
                                value={barcodeManualQuery}
                                onChange={(e) => setBarcodeManualQuery(e.target.value)}
                                placeholder="Tembak barcode USB atau ketik Kode Lot (mis. MTL001 / LOT-261115-701)..."
                                className="flex-1 min-w-[200px] h-9 px-3 rounded-xl bg-black border border-zinc-800 text-xs font-mono text-white focus:outline-hidden focus:border-emerald-500"
                              />
                              <button
                                type="submit"
                                className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <Search className="w-3.5 h-3.5" />
                                <span>Cari &amp; Edit Stok</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => barcodePhotoInputRef.current?.click()}
                                disabled={isScanningAI}
                                className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/45 text-emerald-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Scan Foto Barcode</span>
                              </button>
                            </form>
                          </div>
                        </div>
                      )}

                      {cameraError && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{cameraError}</span>
                        </div>
                      )}

                      {/* Scanning Progress Indicator */}
                      {isScanningAI && (
                        <div className="p-5 rounded-2xl bg-zinc-950 border border-amber-500/60 flex flex-col sm:flex-row items-center gap-4">
                          {capturedPreviewUrl && (
                            <img
                              src={capturedPreviewUrl}
                              alt="Preview Foto Kartu Grade"
                              className="w-28 h-20 object-cover rounded-xl border border-zinc-700 shrink-0"
                            />
                          )}
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-6 h-6 text-amber-400 animate-spin shrink-0" />
                            <div>
                              <div className="text-sm font-black text-white">
                                Membaca Tulisan Tangan &amp; Kotak Silang (X)...
                              </div>
                              <p className="text-xs text-zinc-400">
                                Mencocokkan Kode Lot, Kamus Master Penjual/Daerah, dan cek anti-dobel.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {scanError && !isScanningAI && (
                        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/70 text-xs text-red-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <span>{scanError}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap ml-auto">
                            {unregisteredBarcodeLot && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRegisterUnregisteredBarcodeAsNew(unregisteredBarcodeLot)
                                }
                                className="h-8 px-3 rounded-lg bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 font-black text-xs cursor-pointer transition-colors"
                              >
                                Daftarkan &ldquo;{unregisteredBarcodeLot}&rdquo; Sebagai Stok Baru
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setUnregisteredBarcodeLot(null);
                                resetForNextPhoto();
                              }}
                              className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                            >
                              Coba Foto Ulang
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* REVIEW CEPAT SEBELUM MASUK GUDANG */}
                  {reviewedCards.length > 0 && (
                    <div className="space-y-4">
                      {/* Datalists for fast Kamus Master editing */}
                      <datalist id="scanner-master-sellers">
                        {masterDict.sellers.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                      <datalist id="scanner-master-graders">
                        {masterDict.graders.map((g) => (
                          <option key={g} value={g} />
                        ))}
                      </datalist>
                      <datalist id="scanner-master-origins">
                        {masterDict.origins.map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                      <datalist id="scanner-master-names">
                        {masterDict.tobaccoNames.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>

                      {/* Review Summary Banner */}
                      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {capturedPreviewUrl && (
                            <img
                              src={capturedPreviewUrl}
                              alt="Foto Kartu Discan"
                              className="w-16 h-12 object-cover rounded-lg border border-zinc-700 shrink-0"
                            />
                          )}
                          <div>
                            <div className="text-sm font-black text-white flex items-center gap-2">
                              <FileCheck2 className="w-4 h-4 text-amber-400" />
                              <span>
                                Review Cepat: {reviewedCards.length} Kartu Terdeteksi
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {selectedToSaveCount} dipilih untuk masuk / update gudang
                              {stage2Count > 0 ? ` (${stage2Count} Update Data Lama)` : ''}
                              {duplicateBlockedCount > 0
                                ? ` • ${duplicateBlockedCount} ditandai Dobel (otomatis dilewati)`
                                : ''}
                              {scanModelUsed ? ` • Vision: ${scanModelUsed}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={resetForNextPhoto}
                          className="h-9 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Foto Ulang / Scan Lain</span>
                        </button>
                      </div>

                      {scanQualityWarning && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/50 text-xs text-amber-200 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{scanQualityWarning}</span>
                        </div>
                      )}

                      {/* Cards List */}
                      <div className="space-y-3">
                        {reviewedCards.map((card, index) => {
                          const isDuplicate =
                            card.matchStatus === 'DUPLICATE_COMPLETE' ||
                            card.matchStatus === 'BATCH_DUPLICATE';
                          const isStage2 = card.matchStatus === 'UPDATE_MENYUSUL';
                          const isUncertain = (fieldName: string) =>
                            card.uncertainFields.includes(fieldName);

                          return (
                            <div
                              key={card.reviewId}
                              className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-colors ${
                                isDuplicate
                                  ? 'bg-red-950/20 border-red-500/60'
                                  : isStage2
                                  ? 'bg-amber-950/15 border-amber-500/70'
                                  : 'bg-zinc-950/90 border-zinc-800'
                              }`}
                            >
                              {/* Top Row: Checkbox + Match Badge + Confidence + Remove */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={card.selectedForSave}
                                      onChange={(e) =>
                                        updateReviewedCard(card.reviewId, {
                                          selectedForSave: e.target.checked,
                                        })
                                      }
                                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-black text-white">
                                      Kartu #{index + 1}
                                    </span>
                                  </label>

                                  {card.matchStatus === 'NEW_STOCK' && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 text-[10px] font-black uppercase">
                                      Stok Baru
                                    </span>
                                  )}
                                  {isStage2 && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-black uppercase">
                                      Update Info Kertas ({card.matchedExistingLot || card.lotNumber})
                                    </span>
                                  )}
                                  {card.matchStatus === 'DUPLICATE_COMPLETE' && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500 text-red-300 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3" />
                                      Anti-Dobel: Lot Sudah Ada
                                    </span>
                                  )}
                                  {card.matchStatus === 'BATCH_DUPLICATE' && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500 text-red-300 text-[10px] font-black uppercase inline-flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3" />
                                      Dobel dalam 1 Foto
                                    </span>
                                  )}

                                  <span
                                    className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                                      card.confidenceScore >= 85
                                        ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                        : 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                                    }`}
                                  >
                                    Akurasi {card.confidenceScore}%
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeReviewedCard(card.reviewId)}
                                  aria-label={`Hapus Kartu ${index + 1}`}
                                  className="h-7 px-2 rounded-lg bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-zinc-800 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Buang</span>
                                </button>
                              </div>

                              {/* Duplicate Alert OR Stage 2 / Paper-First Update Diff Info */}
                              {isDuplicate && (
                                <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/50 text-[11px] text-red-200">
                                  Lot <strong>{card.lotNumber}</strong> sudah tercatat sama persis di gudang
                                  {card.matchedExistingName ? ` ("${card.matchedExistingName}")` : ''}.
                                  Otomatis tidak dicentang agar tidak terjadi double input.
                                </div>
                              )}

                              {isStage2 && card.updateDiffSummary.length > 0 && (
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 flex flex-wrap items-center gap-2">
                                  <span className="font-black text-amber-300">
                                    Catatan kertas berubah — update &ldquo;{card.matchedExistingName}&rdquo;:
                                  </span>
                                  {card.updateDiffSummary.map((d, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded bg-black/60 border border-amber-500/40 font-semibold"
                                    >
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Uncertain Fields & Kamus Master Auto-Corrections */}
                              {(card.uncertainFields.length > 0 ||
                                card.autoCorrections.length > 0) && (
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                  {card.uncertainFields.length > 0 && (
                                    <span className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400 text-amber-200 font-bold inline-flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span>
                                        Tulisan Ragu (Wajib Cek):{' '}
                                        {card.uncertainFields
                                          .map((f) => UNCERTAIN_FIELD_LABELS[f] || f)
                                          .join(', ')}
                                      </span>
                                    </span>
                                  )}
                                  {card.autoCorrections.map((ac, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 font-semibold"
                                    >
                                      Kamus {ac.field}: &ldquo;{ac.from}&rdquo; → &ldquo;{ac.to}&rdquo;
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Editable Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Kode Lot{' '}
                                    {isUncertain('lotNumber') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    value={card.lotNumber}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        lotNumber: e.target.value.toUpperCase(),
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('lotNumber')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Nama Tembakau{' '}
                                    {isUncertain('name') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-names"
                                    value={card.name}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, { name: e.target.value })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('name')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Penjual{' '}
                                    {isUncertain('sellerName') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-sellers"
                                    value={card.sellerName}
                                    placeholder="Opsional"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        sellerName: e.target.value,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('sellerName')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Daerah Asal{' '}
                                    {isUncertain('origin') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-origins"
                                    value={card.origin}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, { origin: e.target.value })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('origin')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Nama Grader{' '}
                                    {isUncertain('graderName') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="text"
                                    list="scanner-master-graders"
                                    value={card.graderName}
                                    placeholder="Opsional"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        graderName: e.target.value,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-amber-200 border focus:outline-hidden ${
                                      isUncertain('graderName')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1 flex items-center justify-between gap-1">
                                    <span>
                                      Tgl Beli{' '}
                                      {isUncertain('purchaseDate') && (
                                        <span className="text-amber-400">• Cek!</span>
                                      )}
                                    </span>
                                    {card.dateWasAutoDefaulted && (
                                      <span className="text-[9px] text-emerald-400 font-bold normal-case">
                                        Otomatis Hari Ini
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type="date"
                                    value={card.purchaseDate}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        purchaseDate: e.target.value,
                                        dateWasAutoDefaulted: false,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('purchaseDate')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Grade{' '}
                                    {isUncertain('colorGrade') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <select
                                    value={card.colorGrade}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        colorGrade: e.target.value as TobaccoGrade,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-black text-amber-300 border focus:outline-hidden ${
                                      isUncertain('colorGrade')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  >
                                    {TOBACCO_GRADE_ORDER.map((gr) => (
                                      <option key={gr} value={gr}>
                                        Grade {gr}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Kemasan{' '}
                                    {isUncertain('packagingType') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <select
                                    value={card.packagingType}
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        packagingType: e.target.value,
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-bold text-white border focus:outline-hidden ${
                                      isUncertain('packagingType')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  >
                                    {masterDict.packagings.map((pk) => (
                                      <option key={pk} value={pk}>
                                        {pk}
                                      </option>
                                    ))}
                                    {!masterDict.packagings.includes(card.packagingType) && (
                                      <option value={card.packagingType}>
                                        {card.packagingType}
                                      </option>
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Bruto (kg){' '}
                                    {isUncertain('grossWeightKg') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step={0.1}
                                    value={card.grossWeightKg || ''}
                                    placeholder="0 (Menyusul)"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        grossWeightKg: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('grossWeightKg')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                  {(() => {
                                    const wg = getSmartWeightGuard(card.grossWeightKg);
                                    if (!wg) return null;
                                    return (
                                      <div className="mt-1 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/50 text-[10px] text-amber-200 space-y-1">
                                        <div className="font-semibold leading-snug">{wg.title}</div>
                                        {wg.actionLabel && wg.suggestedValue !== undefined && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateReviewedCard(card.reviewId, {
                                                grossWeightKg: wg.suggestedValue!,
                                              })
                                            }
                                            className="px-2 py-0.5 rounded bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 font-black text-[10px] cursor-pointer transition-colors"
                                          >
                                            {wg.actionLabel}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div>
                                  <label className="block text-[10px] font-extrabold uppercase text-zinc-400 mb-1">
                                    Harga Beli / kg{' '}
                                    {isUncertain('pricePerKgPurchase') && (
                                      <span className="text-amber-400">• Cek!</span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    step={1000}
                                    value={card.pricePerKgPurchase || ''}
                                    placeholder="0 (Menyusul)"
                                    onChange={(e) =>
                                      updateReviewedCard(card.reviewId, {
                                        pricePerKgPurchase: Math.max(
                                          0,
                                          Math.round(Number(e.target.value) || 0)
                                        ),
                                      })
                                    }
                                    className={`w-full h-9 px-2.5 rounded-xl text-xs font-mono font-bold text-white border focus:outline-hidden ${
                                      isUncertain('pricePerKgPurchase')
                                        ? 'bg-amber-500/10 border-amber-400'
                                        : 'bg-black border-zinc-800 focus:border-amber-500'
                                    }`}
                                  />
                                  {card.pricePerKgPurchase > 0 && (
                                    <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                      {formatRupiah(card.pricePerKgPurchase)}
                                    </div>
                                  )}
                                  {(() => {
                                    const pg = getSmartPriceGuard(card.pricePerKgPurchase);
                                    if (!pg) return null;
                                    return (
                                      <div className="mt-1 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/60 text-[10px] text-amber-200 space-y-1">
                                        <div className="font-semibold leading-snug">{pg.title}</div>
                                        {pg.actionLabel && pg.suggestedValue !== undefined && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateReviewedCard(card.reviewId, {
                                                pricePerKgPurchase: pg.suggestedValue!,
                                              })
                                            }
                                            className="px-2 py-0.5 rounded bg-[#0d0f14] hover:bg-amber-500/10 border border-amber-500/80 text-amber-300 font-black text-[10px] cursor-pointer transition-colors"
                                          >
                                            {pg.actionLabel}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Whole-Number Attribute Tap Selectors (0-5 NO DECIMAL) */}
                              <div className="pt-2 border-t border-zinc-800/80">
                                <div className="text-[10px] font-extrabold uppercase text-zinc-400 mb-1.5">
                                  Atribut Karakter (Skala Bulat 0–5)
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                  {ATTRIBUTE_FIELDS.map((attr) => {
                                    const currentVal = card[attr.key];
                                    const fieldUncertain = isUncertain(attr.key);
                                    return (
                                      <div
                                        key={attr.key}
                                        className={`p-2 rounded-xl border ${
                                          fieldUncertain
                                            ? 'bg-amber-500/10 border-amber-400'
                                            : 'bg-black border-zinc-800'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-[10px] font-black mb-1">
                                          <span className="text-zinc-300">{attr.label}</span>
                                          <span className="text-amber-400 font-mono">
                                            {formatRating5(currentVal)}/5
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-6 gap-1">
                                          {[0, 1, 2, 3, 4, 5].map((digit) => (
                                            <button
                                              key={digit}
                                              type="button"
                                              onClick={() =>
                                                updateReviewedCard(card.reviewId, {
                                                  [attr.key]: digit,
                                                  attributesConfirmed: true,
                                                } as Partial<ReviewedScannedGradeCard>)
                                              }
                                              className={`h-6 rounded-md font-mono text-[11px] font-black border cursor-pointer transition-colors ${
                                                currentVal === digit
                                                  ? 'bg-[#0d0f14] text-amber-300 border-amber-500/80'
                                                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                                              }`}
                                            >
                                              {digit}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
            </div>

            {/* Footer Commit Bar (Only on Review Cepat when cards detected) */}
            {reviewedCards.length > 0 && (
              <div className="px-4 py-3 sm:px-6 border-t border-zinc-800 bg-black/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="text-xs text-zinc-300">
                  Siap diproses: <strong className="text-amber-400">{selectedToSaveCount}</strong>{' '}
                  kartu
                  {duplicateBlockedCount > 0 && (
                    <span className="text-red-300 ml-2">
                      ({duplicateBlockedCount} kartu dobel terlindungi)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCommit}
                    disabled={selectedToSaveCount === 0}
                    className="h-10 px-5 rounded-xl bg-[#0d0f14] hover:bg-amber-500/10 disabled:opacity-40 border border-amber-500/80 text-amber-300 font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan &amp; Update ke Gudang ({selectedToSaveCount})</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
