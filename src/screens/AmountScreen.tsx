import { useQuery } from '@tanstack/react-query';
import { openScreen } from '../navigation/openScreen';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { TransferQuote } from '../components/TransferQuote';
import { Banner, Button, ScreenIntro, TextField } from '../components/ui';
import { addMinor, parseAmountInput } from '../domain/money';
import { calculateFeeMinor, describeFeeSchedule } from '../domain/policy';
import { validateBalanceCoverage, validateNarration, validateTransferAmount } from '../domain/validation';
import { bankApi, useSession } from '../state/runtime';
import { useTransferDraft } from '../state/transferDraftStore';

export function quoteFor(amountInput: string, availableBalanceMinor: number | null) {
  const parsed = parseAmountInput(amountInput);
  if (!parsed.ok) {
    return { amountMinor: null, feeMinor: null, totalDebitMinor: null, error: amountInput.trim() ? parsed.message : null };
  }
  const amountError = validateTransferAmount(parsed.amountMinor);
  if (amountError) {
    return { amountMinor: parsed.amountMinor, feeMinor: null, totalDebitMinor: null, error: amountError };
  }
  const feeMinor = calculateFeeMinor(parsed.amountMinor);
  const totalDebitMinor = addMinor(parsed.amountMinor, feeMinor);
  const balanceError = availableBalanceMinor === null ? null : validateBalanceCoverage(totalDebitMinor, availableBalanceMinor);
  return { amountMinor: parsed.amountMinor, feeMinor, totalDebitMinor, error: balanceError };
}

export function AmountScreen() {
  const expired = useSession((state) => state.expired);
  const amountInput = useTransferDraft((state) => state.amountInput);
  const narration = useTransferDraft((state) => state.narration);
  const setAmountInput = useTransferDraft((state) => state.setAmountInput);
  const setNarration = useTransferDraft((state) => state.setNarration);
  const account = useQuery({ queryKey: ['account'], queryFn: ({ signal }) => bankApi.getAccount(signal), enabled: !expired });
  const quote = quoteFor(amountInput, account.data?.availableBalanceMinor ?? null);
  const narrationError = validateNarration(narration);

  return (
    <KeyboardScreen>
      <ScreenIntro eyebrow="Step 2 of 3" title="How much?" />
      <TextField
        label="Amount"
        value={amountInput}
        onChangeText={setAmountInput}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0.00"
        error={quote.error}
        hint={`Between the transfer limits. Fees: ${describeFeeSchedule()}.`}
      />
      <TextField
        label="Narration"
        value={narration}
        onChangeText={setNarration}
        error={narrationError}
        hint="Optional note for the recipient"
        maxLength={80}
      />
      <TransferQuote amountMinor={quote.amountMinor} feeMinor={quote.feeMinor} totalDebitMinor={quote.totalDebitMinor} />
      {account.isError ? <Banner message="We couldn't check your balance. You can still review, and the bank will confirm it." /> : null}
      <Button
        label="Review transfer"
        disabled={quote.totalDebitMinor === null || Boolean(quote.error) || Boolean(narrationError)}
        onPress={() => openScreen('/transfer/review')}
      />
    </KeyboardScreen>
  );
}
