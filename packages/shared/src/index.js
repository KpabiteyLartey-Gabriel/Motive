// GH Motive — Shared Utilities

/**
 * Format a monetary amount with currency symbol
 */
export function formatCurrency(amount, currency = 'GHS') {
  if (amount === null || amount === undefined) return `${currency} 0.00`;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${currency} ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Format a date to Ghana locale format
 */
export function formatDate(date, options = {}) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format a date-time to Ghana locale format
 */
export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate Work & Pay progress percentage
 */
export function calculateWorkAndPayProgress(totalPaid, totalPayable) {
  if (!totalPayable || totalPayable === 0) return 0;
  return Math.min(100, (totalPaid / totalPayable) * 100);
}

/**
 * Normalize phone number to international format (+233...)
 */
export function normalizeGhanaPhone(phone) {
  if (!phone) return phone;
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('233')) return `+${clean}`;
  if (clean.startsWith('0') && clean.length === 10) return `+233${clean.slice(1)}`;
  if (clean.length === 9) return `+233${clean}`;
  return phone;
}

/**
 * Get user display name
 */
export function getUserDisplayName(user) {
  if (!user) return 'Unknown';
  const parts = [user.firstName, user.otherNames, user.lastName].filter(Boolean);
  return parts.join(' ');
}

/**
 * Check if a date is in the past
 */
export function isOverdue(date) {
  if (!date) return false;
  return new Date(date) < new Date();
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text, maxLength = 80) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
