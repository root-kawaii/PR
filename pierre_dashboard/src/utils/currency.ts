const fmt = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Format a raw price string (e.g. "15", "15.50", "15,50 €") as a display string.
 * Returns "Gratis" if the value is empty or null.
 */
export function formatPrice(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'Gratis';
  // Strip anything that's not a digit, comma, or dot before parsing
  const clean = raw.replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? raw : fmt.format(n);
}

/**
 * Convert a numeric input string to the API price string (e.g. "15" → "15.00").
 * Returns undefined if the input is empty (free event).
 */
export function priceToApiString(val: string): string | undefined {
  const n = parseFloat(val.replace(',', '.'));
  return isNaN(n) || val.trim() === '' ? undefined : n.toFixed(2);
}
