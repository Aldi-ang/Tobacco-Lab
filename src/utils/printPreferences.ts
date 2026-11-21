import { DuplexMode, PrintPaperFormat, isThermalPaperFormat } from './thermalPrintEngine';
import { snapPrintCountForFormat } from './printBatchLockEngine';
import { sanitizePrintYear } from './graderRegistryEngine';

export const GRADE_CARD_PRINT_PREFS_KEY = 'tobacco_lab_grade_card_print_prefs_v1';

export interface GradeCardPrintPreferences {
  paperFormat: PrintPaperFormat;
  duplexMode: DuplexMode;
  printCount: number;
  includeThermalBarcode: boolean;
  hasCustomizedBefore: boolean;
  printYear: number;
}

export const DEFAULT_PRINT_PREFERENCES: GradeCardPrintPreferences = {
  paperFormat: 'A4_6',
  duplexMode: 'LONG_EDGE',
  printCount: 6,
  includeThermalBarcode: true,
  hasCustomizedBefore: false,
  printYear: new Date().getFullYear(),
};

const VALID_FORMATS: PrintPaperFormat[] = ['A4_6', 'THERMAL_58', 'THERMAL_80'];
const VALID_DUPLEX: DuplexMode[] = ['OFF', 'LONG_EDGE', 'SHORT_EDGE'];

export function sanitizePrintPreferences(
  raw: (Omit<Partial<GradeCardPrintPreferences>, 'paperFormat'> & { paperFormat?: string }) | null | undefined
): GradeCardPrintPreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PRINT_PREFERENCES };
  }
  const rawFormat = String(raw.paperFormat || '');
  const paperFormat: PrintPaperFormat =
    rawFormat === 'A4_4'
      ? 'A4_6'
      : VALID_FORMATS.includes(rawFormat as PrintPaperFormat)
      ? (rawFormat as PrintPaperFormat)
      : DEFAULT_PRINT_PREFERENCES.paperFormat;

  const duplexMode = VALID_DUPLEX.includes((raw as Partial<GradeCardPrintPreferences>).duplexMode as DuplexMode)
    ? ((raw as Partial<GradeCardPrintPreferences>).duplexMode as DuplexMode)
    : DEFAULT_PRINT_PREFERENCES.duplexMode;

  const parsedCount = Number((raw as Partial<GradeCardPrintPreferences>).printCount);
  const printCount =
    Number.isFinite(parsedCount) && parsedCount >= 1 && parsedCount <= 60
      ? snapPrintCountForFormat(parsedCount, paperFormat)
      : isThermalPaperFormat(paperFormat)
      ? 6
      : DEFAULT_PRINT_PREFERENCES.printCount;

  const includeThermalBarcode =
    typeof (raw as Partial<GradeCardPrintPreferences>).includeThermalBarcode === 'boolean'
      ? Boolean((raw as Partial<GradeCardPrintPreferences>).includeThermalBarcode)
      : DEFAULT_PRINT_PREFERENCES.includeThermalBarcode;

  const hasCustomizedBefore = Boolean((raw as Partial<GradeCardPrintPreferences>).hasCustomizedBefore);
  const printYear = sanitizePrintYear(
    (raw as Partial<GradeCardPrintPreferences>).printYear,
    DEFAULT_PRINT_PREFERENCES.printYear
  );

  return {
    paperFormat,
    duplexMode,
    printCount,
    includeThermalBarcode,
    hasCustomizedBefore,
    printYear,
  };
}

export function loadPrintPreferences(): GradeCardPrintPreferences {
  try {
    const raw = localStorage.getItem(GRADE_CARD_PRINT_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PRINT_PREFERENCES };
    return sanitizePrintPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PRINT_PREFERENCES };
  }
}

export function savePrintPreferences(prefs: GradeCardPrintPreferences): void {
  try {
    localStorage.setItem(
      GRADE_CARD_PRINT_PREFS_KEY,
      JSON.stringify(sanitizePrintPreferences(prefs))
    );
  } catch {
    // ignore storage write failures
  }
}

export function formatPaperSummaryLabel(prefs: GradeCardPrintPreferences): string {
  if (prefs.paperFormat === 'THERMAL_58') {
    return `Thermal 58mm${prefs.includeThermalBarcode ? ' + Barcode' : ''}`;
  }
  if (prefs.paperFormat === 'THERMAL_80') {
    return `Thermal 80mm${prefs.includeThermalBarcode ? ' + Barcode' : ''}`;
  }
  const sides =
    prefs.duplexMode === 'OFF'
      ? '1 Sisi'
      : prefs.duplexMode === 'LONG_EDGE'
      ? '2 Sisi (Long Edge)'
      : '2 Sisi (Short Edge)';
  return `A4 (6/Hal) • ${sides}`;
}
