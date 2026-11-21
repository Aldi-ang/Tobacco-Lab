export type AttributePolarity = 'positive' | 'negative' | 'maturity';

export type AttributeRatingKey =
  | 'powerRating'
  | 'impactRating'
  | 'bitterRating'
  | 'burnRating'
  | 'heatRating'
  | 'sugarRating'
  | 'aromaRating'
  | 'maturityRating';

export type AttributeToneBand = 'unset' | 'red' | 'orange' | 'yellow' | 'lime' | 'green';

export interface AttributeColorStyle {
  band: AttributeToneBand;
  levelLabel: string;
  polarityHint: string;
  textClass: string;
  badgeClass: string;
  activeStepClass: string;
  idleStepClass: string;
  barClass: string;
  hex: string;
}

export const MATURITY_LEVEL_LABELS: Record<number, string> = {
  0: 'Belum Diisi',
  1: 'Tidak Matang',
  2: 'Lumayan Matang',
  3: 'Matang',
  4: 'Keluwasen',
  5: 'Busuk',
};

export const ATTRIBUTE_DEFINITIONS: ReadonlyArray<{
  key: AttributeRatingKey;
  code: 'Pwr' | 'Imp' | 'Bit' | 'Brn' | 'Het' | 'Sgr' | 'Arm' | 'Mat';
  shortLabel: string;
  label: string;
  sublabel: string;
  polarity: AttributePolarity;
}> = [
  {
    key: 'powerRating',
    code: 'Pwr',
    shortLabel: 'PWR',
    label: 'Power',
    sublabel: 'Positif (1 Merah → 5 Hijau)',
    polarity: 'positive',
  },
  {
    key: 'impactRating',
    code: 'Imp',
    shortLabel: 'IMP',
    label: 'Impact',
    sublabel: 'Positif (1 Merah → 5 Hijau)',
    polarity: 'positive',
  },
  {
    key: 'bitterRating',
    code: 'Bit',
    shortLabel: 'BIT',
    label: 'Bitter',
    sublabel: 'Negatif (1 Hijau → 5 Merah)',
    polarity: 'negative',
  },
  {
    key: 'burnRating',
    code: 'Brn',
    shortLabel: 'BRN',
    label: 'Burn',
    sublabel: 'Positif (1 Merah → 5 Hijau)',
    polarity: 'positive',
  },
  {
    key: 'heatRating',
    code: 'Het',
    shortLabel: 'HET',
    label: 'Heat',
    sublabel: 'Panas Hisapan (1 Hijau → 5 Merah)',
    polarity: 'negative',
  },
  {
    key: 'sugarRating',
    code: 'Sgr',
    shortLabel: 'SGR',
    label: 'Sugar',
    sublabel: 'Negatif (1 Hijau → 5 Merah)',
    polarity: 'negative',
  },
  {
    key: 'aromaRating',
    code: 'Arm',
    shortLabel: 'ARM',
    label: 'Aroma',
    sublabel: 'Positif (1 Merah → 5 Hijau)',
    polarity: 'positive',
  },
  {
    key: 'maturityRating',
    code: 'Mat',
    shortLabel: 'MAT',
    label: 'Maturity',
    sublabel: 'Imbon: 1 Tdk Matang · 3 Matang · 5 Busuk',
    polarity: 'maturity',
  },
];

export function getAttributePolarity(key: AttributeRatingKey | string): AttributePolarity {
  if (
    key === 'bitterRating' ||
    key === 'heatRating' ||
    key === 'sugarRating' ||
    key === 'bitter' ||
    key === 'heat' ||
    key === 'sugar'
  ) {
    return 'negative';
  }
  if (key === 'maturityRating' || key === 'maturity') return 'maturity';
  return 'positive';
}

export function resolveAttributeToneBand(
  polarity: AttributePolarity,
  rawValue: number
): AttributeToneBand {
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num <= 0) return 'unset';
  const clamped = Math.max(1, Math.min(5, Math.round(num)));

  if (polarity === 'maturity') {
    if (clamped === 1 || clamped === 5) return 'red';
    if (clamped === 2 || clamped === 4) return 'orange';
    return 'green';
  }

  if (polarity === 'negative') {
    // 1 is best (green), 5 is worst (red)
    if (clamped === 1) return 'green';
    if (clamped === 2) return 'lime';
    if (clamped === 3) return 'yellow';
    if (clamped === 4) return 'orange';
    return 'red';
  }

  // Positive: 1 is lowest (red), 5 is highest (green)
  if (clamped === 1) return 'red';
  if (clamped === 2) return 'orange';
  if (clamped === 3) return 'yellow';
  if (clamped === 4) return 'lime';
  return 'green';
}

const TONE_STYLES: Record<
  AttributeToneBand,
  Omit<AttributeColorStyle, 'band' | 'levelLabel' | 'polarityHint'>
> = {
  unset: {
    textClass: 'text-rose-400',
    badgeClass: 'bg-rose-950/60 text-rose-300 border-rose-500/75',
    activeStepClass: 'bg-rose-950/75 text-rose-200 border-rose-500/90',
    idleStepClass: 'bg-zinc-950 text-zinc-400 hover:text-white border-zinc-800/80',
    barClass: 'bg-rose-500/60',
    hex: '#fb7185',
  },
  red: {
    textClass: 'text-red-400',
    badgeClass: 'bg-red-950/70 text-red-300 border-red-500/85',
    activeStepClass: 'bg-red-500/25 text-red-200 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.28)]',
    idleStepClass: 'bg-zinc-950 text-red-300/70 hover:text-red-200 hover:border-red-500/50 border-zinc-800/80',
    barClass: 'bg-gradient-to-r from-red-600 to-red-400',
    hex: '#ef4444',
  },
  orange: {
    textClass: 'text-orange-400',
    badgeClass: 'bg-orange-950/70 text-orange-300 border-orange-500/85',
    activeStepClass: 'bg-orange-500/25 text-orange-200 border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.26)]',
    idleStepClass: 'bg-zinc-950 text-orange-300/70 hover:text-orange-200 hover:border-orange-500/50 border-zinc-800/80',
    barClass: 'bg-gradient-to-r from-red-500 to-orange-400',
    hex: '#f97316',
  },
  yellow: {
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-950/65 text-amber-200 border-amber-500/85',
    activeStepClass: 'bg-amber-500/25 text-amber-100 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    idleStepClass: 'bg-zinc-950 text-amber-300/70 hover:text-amber-200 hover:border-amber-500/50 border-zinc-800/80',
    barClass: 'bg-gradient-to-r from-orange-500 to-amber-400',
    hex: '#eab308',
  },
  lime: {
    textClass: 'text-lime-400',
    badgeClass: 'bg-lime-950/65 text-lime-200 border-lime-500/85',
    activeStepClass: 'bg-lime-500/25 text-lime-100 border-lime-400 shadow-[0_0_12px_rgba(132,204,22,0.25)]',
    idleStepClass: 'bg-zinc-950 text-lime-300/70 hover:text-lime-200 hover:border-lime-500/50 border-zinc-800/80',
    barClass: 'bg-gradient-to-r from-amber-400 to-lime-400',
    hex: '#84cc16',
  },
  green: {
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-950/70 text-emerald-200 border-emerald-500/85',
    activeStepClass: 'bg-emerald-500/25 text-emerald-100 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.28)]',
    idleStepClass: 'bg-zinc-950 text-emerald-300/70 hover:text-emerald-200 hover:border-emerald-500/50 border-zinc-800/80',
    barClass: 'bg-gradient-to-r from-lime-400 to-emerald-400',
    hex: '#10b981',
  },
};

export function getAttributeColorStyle(
  polarity: AttributePolarity,
  rawValue: number
): AttributeColorStyle {
  const band = resolveAttributeToneBand(polarity, rawValue);
  const clamped = Number.isFinite(Number(rawValue)) && Number(rawValue) > 0
    ? Math.max(1, Math.min(5, Math.round(Number(rawValue))))
    : 0;

  let levelLabel = clamped === 0 ? 'Kosong' : `Level ${clamped}`;
  let polarityHint = '';

  if (polarity === 'maturity') {
    levelLabel = MATURITY_LEVEL_LABELS[clamped] || 'Matang';
    polarityHint =
      clamped === 3
        ? 'Optimal Imbon'
        : clamped === 2 || clamped === 4
          ? 'Perlu Pantau'
          : clamped === 1 || clamped === 5
            ? 'Risiko Tinggi'
            : 'Belum Diisi';
  } else if (polarity === 'negative') {
    polarityHint = 'Negatif (1=Baik)';
    if (clamped === 1) levelLabel = 'Sangat Rendah (Bagus)';
    else if (clamped === 2) levelLabel = 'Rendah (Baik)';
    else if (clamped === 3) levelLabel = 'Sedang';
    else if (clamped === 4) levelLabel = 'Tinggi (Kurang)';
    else if (clamped === 5) levelLabel = 'Sangat Tinggi (Buruk)';
  } else {
    polarityHint = 'Positif (1→5)';
    if (clamped === 1) levelLabel = 'Rendah';
    else if (clamped === 2) levelLabel = 'Cukup';
    else if (clamped === 3) levelLabel = 'Sedang';
    else if (clamped === 4) levelLabel = 'Baik';
    else if (clamped === 5) levelLabel = 'Optimal';
  }

  return {
    band,
    levelLabel,
    polarityHint,
    ...TONE_STYLES[band],
  };
}
