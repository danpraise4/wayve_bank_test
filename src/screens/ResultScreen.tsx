import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { KeyboardScreen } from '../components/KeyboardScreen';
import { StatusBadge } from '../components/StatusBadge';
import { Banner, Button } from '../components/ui';
import { formatMinor } from '../domain/money';
import { TRANSFER_POLICY } from '../domain/policy';
import { isUnresolvedPhase } from '../domain/transferMachine';
import type { TransactionStatus } from '../domain/types';
import { refreshBankingData, transferController, useTransferIntent } from '../state/runtime';
import { useTransferDraft } from '../state/transferDraftStore';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

export function ResultScreen() {
  const intent = useTransferIntent((state) => state.intent);
  const setIntent = useTransferIntent((state) => state.setIntent);
  const resetDraft = useTransferDraft((state) => state.reset);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!intent || !isUnresolvedPhase(intent.phase)) {
      return;
    }
    const timer = setInterval(() => {
      void transferController.resume().then(async (next) => {
        if (!next) {
          return;
        }
        setIntent(next);
        if (!isUnresolvedPhase(next.phase)) {
          await refreshBankingData();
        }
      });
    }, TRANSFER_POLICY.statusPollMs);
    return () => clearInterval(timer);
  }, [intent, setIntent]);

  if (!intent) {
    return (
      <KeyboardScreen>
        <Banner message="There is no transfer to show." />
        <Button label="Back to home" onPress={() => router.replace('/')} />
      </KeyboardScreen>
    );
  }

  const status = intentStatus(intent.phase);

  async function checkAgain() {
    setBusy(true);
    const next = await transferController.resume();
    if (next) {
      setIntent(next);
      if (!isUnresolvedPhase(next.phase)) {
        await refreshBankingData();
      }
    }
    setBusy(false);
  }

  async function retryOriginal() {
    setBusy(true);
    const next = await transferController.retrySameKey();
    setIntent(next);
    if (!isUnresolvedPhase(next.phase)) {
      await refreshBankingData();
    }
    setBusy(false);
  }

  return (
    <KeyboardScreen>
      <Text style={styles.kicker}>{intent.phase === 'unknown' ? 'In progress' : 'Receipt'}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {intent.phase === 'unknown' ? 'Verifying transfer' : 'Transfer receipt'}
      </Text>
      {status ? <StatusBadge status={status} /> : <Text style={styles.unknown}>Not confirmed yet</Text>}
      <Banner tone={intent.phase === 'failed' ? 'error' : 'info'} message={intent.customerMessage} />
      {notice ? <Banner tone="info" message={notice} /> : null}
      <View style={styles.card}>
        <Row label="Recipient" value={intent.draft.recipientAccountName} />
        <Row label="Bank" value={intent.draft.recipientBankName} />
        <Row label="Account" value={intent.draft.recipientAccountNumber} />
        <Row label="Amount" value={formatMinor(intent.draft.amountMinor)} />
        <Row label="Fee" value={formatMinor(intent.draft.feeMinor)} />
        <Row label="Total debit" value={formatMinor(intent.draft.totalDebitMinor)} />
        <Row label="Reference" value={intent.reference ?? 'Waiting for a reference'} />
      </View>
      {intent.reference ? (
        <Button
          label="Copy reference"
          variant="secondary"
          onPress={() => {
            void Clipboard.setStringAsync(intent.reference ?? '');
            setNotice('Reference copied');
          }}
        />
      ) : null}
      {isUnresolvedPhase(intent.phase) ? <Button label="Check again" busy={busy} onPress={() => void checkAgain()} /> : null}
      {intent.phase === 'unknown' && intent.lookup === 'not_found' ? (
        <Button
          label="Submit the original request"
          variant="secondary"
          busy={busy}
          accessibilityHint="Uses the same idempotency key and does not create a second transfer if the first one arrives late"
          onPress={() => void retryOriginal()}
        />
      ) : null}
      <Button
        label="Done"
        variant="secondary"
        onPress={() => {
          if (!isUnresolvedPhase(intent.phase)) {
            void transferController.clearTerminal();
            setIntent(null);
            resetDraft();
          }
          router.replace('/');
        }}
      />
    </KeyboardScreen>
  );
}

function intentStatus(phase: string): TransactionStatus | null {
  if (phase === 'pending' || phase === 'successful' || phase === 'failed' || phase === 'reversed') {
    return phase;
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.blue, fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: typeScale.title, fontWeight: '800', letterSpacing: -0.4 },
  unknown: { color: colors.pending, fontWeight: '800' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.md, ...shadow.card },
  row: { gap: 2 },
  label: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 0.3 },
  value: { color: colors.text, fontSize: typeScale.body, fontWeight: '700' },
});
