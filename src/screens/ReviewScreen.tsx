import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { TransferQuote } from '../components/TransferQuote';
import { Banner, Button, ScreenIntro } from '../components/ui';
import { customerMessage } from '../domain/errors';
import { formatMinor } from '../domain/money';
import type { TransferDraft } from '../domain/transferMachine';
import { isUnresolvedPhase } from '../domain/transferMachine';
import { quoteFor } from './AmountScreen';
import { refreshBankingData, transferController, useTransferIntent } from '../state/runtime';
import { useTransferDraft } from '../state/transferDraftStore';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

export function ReviewScreen() {
  const draft = useTransferDraft();
  const intent = useTransferIntent((state) => state.intent);
  const setIntent = useTransferIntent((state) => state.setIntent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quote = quoteFor(draft.amountInput, null);
  const unresolved = intent ? isUnresolvedPhase(intent.phase) : false;

  async function confirm() {
    if (busy) {
      return;
    }
    if (unresolved && intent) {
      router.replace('/transfer/result');
      return;
    }
    if (!draft.accountName || quote.amountMinor === null || quote.feeMinor === null || quote.totalDebitMinor === null) {
      setError('Go back and complete the transfer details.');
      return;
    }
    const body: TransferDraft = {
      recipientBankCode: draft.bankCode,
      recipientBankName: draft.bankName,
      recipientAccountNumber: draft.accountNumber,
      recipientAccountName: draft.accountName,
      amountMinor: quote.amountMinor,
      feeMinor: quote.feeMinor,
      totalDebitMinor: quote.totalDebitMinor,
      narration: draft.narration.trim() || 'Personal transfer',
      currency: 'NGN',
    };
    setBusy(true);
    setError(null);
    try {
      const next = await transferController.confirm(body);
      setIntent(next);
      if (next.phase === 'successful' || next.phase === 'failed' || next.phase === 'reversed') {
        await refreshBankingData();
      }
      router.replace('/transfer/result');
    } catch {
      setError(customerMessage('UNKNOWN'));
      setBusy(false);
    }
  }

  return (
    <KeyboardScreen>
      <ScreenIntro eyebrow="Step 3 of 3" title="Review" />
      <View style={styles.card}>
        <Text style={styles.label}>Recipient</Text>
        <Text style={styles.value}>{draft.accountName ?? 'Account name not confirmed'}</Text>
        <Text style={styles.meta}>
          {draft.bankName} · {draft.accountNumber}
        </Text>
        <Text style={styles.meta}>Narration: {draft.narration || 'Personal transfer'}</Text>
      </View>
      <TransferQuote amountMinor={quote.amountMinor} feeMinor={quote.feeMinor} totalDebitMinor={quote.totalDebitMinor} />
      <Text style={styles.note}>
        If the network drops after you confirm, Wayve checks this same request instead of sending it again.
      </Text>
      {unresolved ? <Banner tone="info" message="A transfer is already being verified. Continuing will check that transfer and will not create another one." /> : null}
      {error ? <Banner message={error} /> : null}
      <Button label="Edit details" variant="secondary" onPress={() => router.back()} disabled={busy} />
      <Button
        label={unresolved ? 'Check transfer status' : 'Confirm transfer'}
        busy={busy}
        accessibilityHint={unresolved ? 'Looks up the original transfer' : `Sends ${formatMinor(quote.totalDebitMinor ?? 0)} including the fee`}
        onPress={() => void confirm()}
      />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.xs, ...shadow.card },
  label: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 0.4 },
  value: { color: colors.text, fontSize: typeScale.section, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: typeScale.label, lineHeight: 20 },
  note: { color: colors.muted, lineHeight: 22 },
});
