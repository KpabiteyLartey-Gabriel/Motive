// Ghana Card (National ID) format: GHA-000000000-0
// ("GHA", 9 digits, then a final check digit). Formats while typing.
export function formatGhanaCardInput(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = compact.startsWith('GHA') ? compact.slice(3) : compact.replace(/^[A-Z]+/, '');
  const digits = body.replace(/\D/g, '').slice(0, 10);
  if (!digits) return compact.startsWith('GHA') || /^[A-Z]/.test(compact) ? 'GHA-' : '';
  if (digits.length <= 9) return `GHA-${digits}`;
  return `GHA-${digits.slice(0, 9)}-${digits.slice(9)}`;
}

export const GHANA_CARD_PLACEHOLDER = 'GHA-123456789-0';
export const GHANA_CARD_HINT = 'Format: GHA-000000000-0';
