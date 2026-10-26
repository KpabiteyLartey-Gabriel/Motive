import { isGhanaCardNumber, normalizeGhanaCardNumber } from './ghana-card';

describe('Ghana Card number format (GHA-000000000-0)', () => {
  it('accepts the canonical format unchanged', () => {
    expect(normalizeGhanaCardNumber('GHA-123456789-0')).toBe('GHA-123456789-0');
    expect(isGhanaCardNumber('GHA-123456789-0')).toBe(true);
  });

  it('normalizes undashed and lowercase input into the canonical format', () => {
    expect(normalizeGhanaCardNumber('gha1234567890')).toBe('GHA-123456789-0');
    expect(normalizeGhanaCardNumber('1234567890')).toBe('GHA-123456789-0');
    expect(normalizeGhanaCardNumber('  GHA 123456789 0 ')).toBe('GHA-123456789-0');
  });

  it('rejects anything that is not GHA + 10 digits', () => {
    for (const bad of ['GHA-1', 'GHA-TAKEN', 'GHA-12345678-0', 'GHA-123456789-00', 'GHA-12345678A-0', 'XYZ-123456789-0', '', null, 123]) {
      expect(normalizeGhanaCardNumber(bad as any)).toBeNull();
    }
  });
});
