// GH Motive — Shared Validation Rules
// Used by both web and mobile for consistent client-side validation
// Backend always re-validates — these are convenience helpers only

/**
 * Validate a Ghana phone number
 */
export function isValidGhanaPhone(phone) {
  if (!phone) return false;
  const clean = phone.replace(/\D/g, '');
  return (
    /^233[0-9]{9}$/.test(clean) ||
    /^0[0-9]{9}$/.test(clean) ||
    /^[0-9]{9}$/.test(clean)
  );
}

/**
 * Validate password strength
 */
export function isStrongPassword(password) {
  if (!password || password.length < 8) return false;
  return true; // Backend enforces further rules
}

/**
 * Validate vehicle registration number format (Ghana)
 * Example: GR-1234-24
 */
export function isValidVehicleRegistration(reg) {
  if (!reg) return false;
  return /^[A-Z]{2,3}-\d{3,4}-\d{2}$/.test(reg.toUpperCase().trim());
}

/**
 * Validate Ghana Card number format
 * Example: GHA-000000000-0
 */
export function isValidGhanaCard(number) {
  if (!number) return false;
  return /^GHA-\d{9}-\d$/.test(number.toUpperCase().trim());
}

/**
 * Validate email address
 */
export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate amount (must be positive number)
 */
export function isValidAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}
