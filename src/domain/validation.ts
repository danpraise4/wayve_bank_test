import { formatMinor } from './money';
import { TRANSFER_POLICY } from './policy';

export function validateAccountNumber(value: string, ownAccountNumber?: string): string | null {
  if (!value.trim()) {
    return 'Enter the recipient account number';
  }
  if (!/^\d{10}$/.test(value)) {
    return 'Account numbers must be exactly 10 digits';
  }
  if (ownAccountNumber && value === ownAccountNumber) {
    return 'You cannot transfer to your own account';
  }
  return null;
}

export function validateBankCode(code: string): string | null {
  if (!/^\d{6}$/.test(code)) {
    return 'Select a bank';
  }
  return null;
}

export function validateTransferAmount(amountMinor: number | null): string | null {
  if (amountMinor === null) {
    return 'Enter an amount';
  }
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return 'Enter an amount greater than zero';
  }
  if (amountMinor < TRANSFER_POLICY.minAmountMinor) {
    return `The minimum transfer is ${formatMinor(TRANSFER_POLICY.minAmountMinor)}`;
  }
  if (amountMinor > TRANSFER_POLICY.maxAmountMinor) {
    return `The maximum transfer is ${formatMinor(TRANSFER_POLICY.maxAmountMinor)}`;
  }
  return null;
}

export function validateBalanceCoverage(totalDebitMinor: number, availableBalanceMinor: number): string | null {
  if (!Number.isSafeInteger(totalDebitMinor) || !Number.isSafeInteger(availableBalanceMinor)) {
    return 'We could not check this amount against your balance';
  }
  if (totalDebitMinor > availableBalanceMinor) {
    return 'This amount plus the fee is more than your available balance';
  }
  return null;
}

export function validateNarration(value: string): string | null {
  if (value.length > TRANSFER_POLICY.narrationMaxLength) {
    return `Narration must be ${TRANSFER_POLICY.narrationMaxLength} characters or fewer`;
  }
  return null;
}

export function validateDateRange(from: string | null, to: string | null, isValidDay: (value: string) => boolean): string | null {
  if (from && !isValidDay(from)) {
    return 'Start date must use YYYY-MM-DD';
  }
  if (to && !isValidDay(to)) {
    return 'End date must use YYYY-MM-DD';
  }
  if (from && to && from > to) {
    return 'Start date must be on or before the end date';
  }
  return null;
}
