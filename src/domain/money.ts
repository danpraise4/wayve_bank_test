/**
 * Money is stored as integer minor units. For NGN, 100 minor units = ₦1 (one kobo).
 * Parsing and arithmetic never use binary floating-point.
 */

export type MinorUnits = number & { readonly __brand: 'MinorUnits' };

export function asMinor(value: number): MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Minor units must be a safe integer');
  }
  return value as MinorUnits;
}

export function addMinor(left: number, right: number): MinorUnits {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    throw new RangeError('Minor units must be safe integers');
  }
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError('Minor unit addition overflowed');
  }
  return asMinor(sum);
}

export type AmountParseResult =
  | { ok: true; amountMinor: MinorUnits }
  | { ok: false; message: string };

/**
 * Accepts customer input such as "1,999.99" or "10.1".
 * At most two decimal places are allowed. "10.10" becomes 1010, never a float.
 */
export function parseAmountInput(raw: string): AmountParseResult {
  const trimmed = raw.trim().replace(/\s+/g, '').replace(/₦/g, '').replace(/^NGN/i, '');
  if (!trimmed) {
    return { ok: false, message: 'Enter an amount' };
  }
  if (trimmed.startsWith('-') || trimmed.startsWith('+')) {
    return { ok: false, message: 'Enter an amount greater than zero' };
  }

  const withoutCommas = trimmed.replace(/,/g, '');
  if (!/^\d+(\.\d*)?$/.test(withoutCommas)) {
    return { ok: false, message: 'Enter a valid amount using numbers only' };
  }

  const parts = withoutCommas.split('.');
  const whole = parts[0] ?? '';
  const fraction = parts[1] ?? '';
  if (whole.length === 0) {
    return { ok: false, message: 'Enter a valid amount using numbers only' };
  }
  if (fraction.length > 2) {
    return { ok: false, message: 'Use at most 2 decimal places' };
  }
  if (whole.length > 12) {
    return { ok: false, message: 'Amount is too large' };
  }

  const paddedFraction = `${fraction}00`.slice(0, 2);
  const combined = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, '');
  const amount = Number(combined);
  if (!Number.isSafeInteger(amount)) {
    return { ok: false, message: 'Amount is too large' };
  }

  return { ok: true, amountMinor: asMinor(amount) };
}

export function formatMinor(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    return '—';
  }
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const whole = Math.trunc(absolute / 100);
  const fraction = absolute % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rendered = `₦${grouped}.${String(fraction).padStart(2, '0')}`;
  return negative ? `-${rendered}` : rendered;
}

export function formatSignedMinor(amountMinor: number, type: 'credit' | 'debit'): string {
  const formatted = formatMinor(amountMinor);
  if (type === 'credit') {
    return amountMinor === 0 ? formatted : `+${formatted}`;
  }
  return amountMinor === 0 ? formatted : `-${formatted.replace('-', '')}`;
}
