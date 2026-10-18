import { asMinor, type MinorUnits } from './money';

export const TRANSFER_POLICY = {
  currency: 'NGN' as const,
  accountNumberLength: 10,
  /** ₦100.00 */
  minAmountMinor: 10_000,
  /** ₦1,000,000.00 */
  maxAmountMinor: 100_000_000,
  clientTimeoutMs: 8_000,
  pageSize: 10,
  narrationMaxLength: 80,
  statusPollMs: 3_000,
  searchDebounceMs: 300,
} as const;

const FEE_TIERS: readonly { maxAmountMinor: number; feeMinor: number }[] = [
  { maxAmountMinor: 500_000, feeMinor: 1_000 },
  { maxAmountMinor: 5_000_000, feeMinor: 2_500 },
  { maxAmountMinor: Number.MAX_SAFE_INTEGER, feeMinor: 5_000 },
];

/** Flat mock fee selected entirely in integer minor units. */
export function calculateFeeMinor(amountMinor: number): MinorUnits {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new RangeError('A fee requires a positive minor-unit amount');
  }
  for (const tier of FEE_TIERS) {
    if (amountMinor <= tier.maxAmountMinor) {
      return asMinor(tier.feeMinor);
    }
  }
  return asMinor(5_000);
}

export function describeFeeSchedule(): string {
  return '₦10.00 up to ₦5,000.00, ₦25.00 up to ₦50,000.00, otherwise ₦50.00';
}
