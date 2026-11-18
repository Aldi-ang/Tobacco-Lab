import { clampRating5, formatRating5 } from './tobaccoMath';

export interface ExcelSensoryCell {
  code: 'Pwr' | 'Imp' | 'Bit' | 'Brn' | 'Sgr' | 'Arm';
  fullLabel: string;
  value: number;
  formatted: string;
}

export function formatExcelSensoryRow(params: {
  power?: number;
  impact?: number;
  bitter?: number;
  burn?: number;
  sugar?: number;
  aroma?: number;
}): ExcelSensoryCell[] {
  const entries: Array<{
    code: ExcelSensoryCell['code'];
    fullLabel: string;
    raw: number | undefined;
    fallback: number;
  }> = [
    { code: 'Pwr', fullLabel: 'Power', raw: params.power, fallback: 3 },
    { code: 'Imp', fullLabel: 'Impact', raw: params.impact, fallback: 3 },
    { code: 'Bit', fullLabel: 'Bitter', raw: params.bitter, fallback: 3 },
    { code: 'Brn', fullLabel: 'Burn', raw: params.burn, fallback: 4.5 },
    { code: 'Sgr', fullLabel: 'Sugar', raw: params.sugar, fallback: 4.0 },
    { code: 'Arm', fullLabel: 'Aroma', raw: params.aroma, fallback: 4.2 },
  ];

  return entries.map((item) => {
    const val = clampRating5(item.raw ?? item.fallback);
    return {
      code: item.code,
      fullLabel: item.fullLabel,
      value: val,
      formatted: formatRating5(val),
    };
  });
}

export function formatExcelTaraSummary(
  rawFormula: string | undefined,
  deductionKg: number,
  realPkgMassKg: number
): string {
  const safeDeduction = Number.isFinite(deductionKg) ? Number(deductionKg.toFixed(2)) : 0;
  const safeWadah = Number.isFinite(realPkgMassKg) ? Number(realPkgMassKg.toFixed(2)) : 0;
  const cleanFormula = (rawFormula || '').trim();

  if (cleanFormula) {
    return `−${safeDeduction}kg (${cleanFormula}) · Wd ${safeWadah}kg`;
  }
  return `−${safeDeduction}kg · Wadah ${safeWadah}kg`;
}

export function formatExcelIngredientsSummary(
  ingredients: Array<{ tobaccoName?: string; percentageInBlend?: number }> | undefined
): string {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return 'Komposisi belum tercatat';
  }
  const preview = ingredients
    .slice(0, 3)
    .map((ing) => {
      const name = (ing.tobaccoName || 'Bahan').trim();
      const pct = Number.isFinite(Number(ing.percentageInBlend))
        ? `${Number(ing.percentageInBlend)}%`
        : '';
      return pct ? `${name} ${pct}` : name;
    })
    .join(' · ');

  const extra = ingredients.length > 3 ? ` +${ingredients.length - 3} lainnya` : '';
  return `${ingredients.length} bhn: ${preview}${extra}`;
}

export function calcProfitMarginPct(profitRp: number, revenueRp: number): string {
  if (!Number.isFinite(profitRp) || !Number.isFinite(revenueRp) || revenueRp <= 0) {
    return '0.0%';
  }
  const pct = (profitRp / revenueRp) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
