const oneDecimal = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
});
const gramsFormat = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

/** Italian number with 0-1 decimals, e.g. 290.94 → "290,9". */
export function formatNumber(value: number): string {
  return oneDecimal.format(value);
}

/** Value of a food nutrient in a portion; null in the food table → "–". */
export function formatNutrient(value: number, source: number | null): string {
  return source === null ? "–" : formatNumber(value);
}

export function formatGrams(grams: number): string {
  return gramsFormat.format(grams);
}

/** Accepts "32", "32,5" or "32.5"; null if the text is not a valid amount. */
export function parseGrams(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+([.,]\d*)?$/.test(trimmed)) return null;
  return Number(trimmed.replace(",", "."));
}
