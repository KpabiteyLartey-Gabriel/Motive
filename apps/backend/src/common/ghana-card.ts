// Ghana Card (National ID) numbers have a fixed format:
//   GHA-XXXXXXXXX-X   — "GHA", 9 digits, then a final check digit.
// Example: GHA-123456789-0
export const GHANA_CARD_PATTERN = /^GHA-\d{9}-\d$/;
export const GHANA_CARD_FORMAT_HINT = 'GHA-000000000-0';
export const GHANA_CARD_FORMAT_MESSAGE = `Enter your National ID in the Ghana Card format ${GHANA_CARD_FORMAT_HINT}.`;

// Accepts the canonical dashed form, or the same characters typed without
// dashes/spaces (e.g. "gha1234567890" or "1234567890"). Returns the canonical
// stored form, or null when the input is not a valid Ghana Card number.
export function normalizeGhanaCardNumber(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const compact = input.trim().toUpperCase().replace(/[\s-]+/g, '');
  const digits = compact.startsWith('GHA') ? compact.slice(3) : compact;
  if (!/^\d{10}$/.test(digits)) return null;
  return `GHA-${digits.slice(0, 9)}-${digits.slice(9)}`;
}

export function isGhanaCardNumber(input: unknown): boolean {
  return typeof input === 'string' && GHANA_CARD_PATTERN.test(input);
}
