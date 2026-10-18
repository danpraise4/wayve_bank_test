import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addMinor, formatMinor, formatSignedMinor, parseAmountInput } from './money';
import { calculateFeeMinor } from './policy';
import { validateAccountNumber, validateBalanceCoverage, validateNarration, validateTransferAmount } from './validation';

describe('money parsing', () => {
  it('parses decimal input into integer kobo', () => {
    assert.equal(parseAmountInput('10.10').ok && parseAmountInput('10.10').amountMinor, 1010);
    assert.equal(parseAmountInput('10.1').ok && parseAmountInput('10.1').amountMinor, 1010);
    assert.equal(parseAmountInput('0.01').ok && parseAmountInput('0.01').amountMinor, 1);
    assert.equal(parseAmountInput('1,999.99').ok && parseAmountInput('1,999.99').amountMinor, 199_999);
    assert.equal(parseAmountInput('5000.01').ok && parseAmountInput('5000.01').amountMinor, 500_001);
  });

  it('rejects values that would be unsafe to coerce through floating point', () => {
    const tooManyPlaces = parseAmountInput('1.005');
    assert.equal(tooManyPlaces.ok, false);
    const scientific = parseAmountInput('1e2');
    assert.equal(scientific.ok, false);
    const negative = parseAmountInput('-10.00');
    assert.equal(negative.ok, false);
  });

  it('formats minor units without losing kobo', () => {
    assert.equal(formatMinor(199_999), '₦1,999.99');
    assert.equal(formatMinor(1010), '₦10.10');
    assert.equal(formatMinor(1), '₦0.01');
    assert.equal(formatSignedMinor(250_000, 'debit'), '-₦2,500.00');
    assert.equal(formatSignedMinor(250_000, 'credit'), '+₦2,500.00');
  });
});

describe('fees and total debit', () => {
  it('adds a decimal amount and fee in minor units', () => {
    const parsed = parseAmountInput('1999.99');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    const fee = calculateFeeMinor(parsed.amountMinor);
    const total = addMinor(parsed.amountMinor, fee);
    assert.equal(fee, 1_000);
    assert.equal(total, 200_999);
    assert.equal(formatMinor(total), '₦2,009.99');
  });

  it('selects the next fee tier without float residue', () => {
    const parsed = parseAmountInput('5000.01');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    const fee = calculateFeeMinor(parsed.amountMinor);
    const total = addMinor(parsed.amountMinor, fee);
    assert.equal(fee, 2_500);
    assert.equal(total, 502_501);
    assert.equal(formatMinor(total), '₦5,025.01');
  });

  it('charges ₦50.00 above ₦50,000.00', () => {
    assert.equal(calculateFeeMinor(5_000_001), 5_000);
  });
});

describe('transfer validation', () => {
  it('checks account numbers, limits, narration, and balance coverage', () => {
    assert.equal(validateAccountNumber('1029384756'), null);
    assert.match(validateAccountNumber('12345') ?? '', /10 digits/);
    assert.match(validateAccountNumber('0123456789', '0123456789') ?? '', /own account/);
    assert.equal(validateTransferAmount(10_000), null);
    assert.match(validateTransferAmount(50) ?? '', /greater than zero|minimum/i);
    assert.match(validateTransferAmount(100_000_001) ?? '', /maximum/i);
    assert.match(validateNarration('a'.repeat(81)) ?? '', /80/);
    assert.match(validateBalanceCoverage(20_000, 10_000) ?? '', /available balance/);
    assert.equal(validateBalanceCoverage(10_000, 10_000), null);
  });
});
