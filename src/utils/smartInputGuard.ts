export interface SmartInputSuggestion {
  kind: 'multiply_1000' | 'divide_10' | 'warning_only';
  title: string;
  actionLabel?: string;
  suggestedValue?: number;
}

/**
 * Detects common human typing mistakes on tobacco price/kg (missing three zeros
 * like typing "75" instead of "75000", or an accidental extra zero >= 1,000,000).
 */
export function getSmartPriceGuard(pricePerKg: number): SmartInputSuggestion | null {
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return null;

  if (pricePerKg > 0 && pricePerKg < 1000) {
    const fixed = Math.round(pricePerKg * 1000);
    return {
      kind: 'multiply_1000',
      title: `Angka kecil (Rp ${pricePerKg.toLocaleString('id-ID')}/kg). Maksud Anda Rp ${fixed.toLocaleString('id-ID')}/kg?`,
      actionLabel: `Ubah ke Rp ${fixed.toLocaleString('id-ID')}`,
      suggestedValue: fixed,
    };
  }

  if (pricePerKg >= 1_000_000) {
    const divided = Math.round(pricePerKg / 10);
    return {
      kind: 'divide_10',
      title: `Harga Rp ${pricePerKg.toLocaleString('id-ID')}/kg sangat tinggi — cek kelebihan angka 0.`,
      actionLabel: `Koreksi ke Rp ${divided.toLocaleString('id-ID')}`,
      suggestedValue: divided,
    };
  }

  return null;
}

/**
 * Detects likely extra zero on single-lot gross weight (e.g., typing 500 instead of 50 kg).
 */
export function getSmartWeightGuard(grossWeightKg: number): SmartInputSuggestion | null {
  if (!Number.isFinite(grossWeightKg) || grossWeightKg <= 0) return null;

  if (grossWeightKg >= 1000) {
    const divided = Number((grossWeightKg / 10).toFixed(2));
    return {
      kind: 'divide_10',
      title: `Berat ${grossWeightKg} kg terlalu besar untuk 1 karung/keranjang — kelebihan 0?`,
      actionLabel: `Ubah ke ${divided} kg`,
      suggestedValue: divided,
    };
  }

  if (grossWeightKg > 250) {
    return {
      kind: 'warning_only',
      title: `Berat ${grossWeightKg} kg cukup besar untuk 1 lot — pastikan angka benar.`,
    };
  }

  return null;
}
