import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '../components/StatusBadge';
import { Banner, Button, LoadingBlock } from '../components/ui';
import { formatTimestamp } from '../domain/dates';
import { ApiError, customerMessage } from '../domain/errors';
import { formatMinor, formatSignedMinor } from '../domain/money';
import { describeQueryState } from '../domain/queryState';
import { statusPresentation, statusPollInterval } from '../domain/status';
import { bankApi, useSession } from '../state/runtime';
import { colors, space, type as typeScale } from '../theme/tokens';

export function DetailScreen({ id }: { id: string }) {
  const expired = useSession((state) => state.expired);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const previousStatus = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ['transaction', id],
    queryFn: ({ signal }) => bankApi.getTransaction(id, signal),
    enabled: !expired && id.length > 0,
    refetchInterval: (current) => statusPollInterval(current.state.data?.status),
  });

  useEffect(() => {
    const status = query.data?.status;
    if (!status) {
      return;
    }
    if (previousStatus.current && previousStatus.current !== status) {
      const presentation = statusPresentation(status);
      setAnnouncement(`Status updated to ${presentation.label}. ${presentation.description}.`);
    }
    previousStatus.current = status;
  }, [query.data?.status]);

  const view = describeQueryState({
    data: query.data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
  });
  const errorMessage = query.error instanceof ApiError ? query.error.customerMessage : query.isError ? customerMessage('UNKNOWN') : null;

  async function copyReference() {
    if (!query.data) {
      return;
    }
    await Clipboard.setStringAsync(query.data.reference, { android: { isSensitive: true } });
    setNotice('Reference copied');
  }

  if (view.mode === 'loading') {
    return (
      <View style={styles.pad}>
        <LoadingBlock label="Loading transaction" />
      </View>
    );
  }

  if (view.mode === 'error' || !query.data) {
    return (
      <View style={styles.pad}>
        <Banner message={errorMessage ?? customerMessage('NOT_FOUND')} />
        <Button label="Try again" onPress={() => void query.refetch()} />
      </View>
    );
  }

  const transaction = query.data;
  const presentation = statusPresentation(transaction.status);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {announcement ? <Banner tone="info" message={announcement} /> : null}
      {view.mode === 'refresh-error' ? <Banner message="We couldn't refresh this transaction. The last details are still shown." /> : null}
      {notice ? <Banner tone="info" message={notice} /> : null}
      <Text style={styles.amount} accessibilityLabel={`Amount ${formatSignedMinor(transaction.amountMinor, transaction.type)}`} maxFontSizeMultiplier={1.3}>
        {formatSignedMinor(transaction.amountMinor, transaction.type)}
      </Text>
      <Text style={styles.currency}>{transaction.currency}</Text>
      <StatusBadge status={transaction.status} />
      <Text style={styles.explanation} maxFontSizeMultiplier={1.8}>
        {presentation.description}. {transaction.status === 'pending' ? 'This screen keeps checking until the status is final.' : null}
      </Text>
      <View style={styles.card}>
        <DetailRow label="Description" value={transaction.description} />
        <DetailRow label="Type" value={transaction.type === 'credit' ? 'Credit' : 'Debit'} />
        <DetailRow label="Date and time" value={formatTimestamp(transaction.createdAt)} />
        <DetailRow label="Reference" value={transaction.reference} />
        {transaction.counterparty ? (
          <DetailRow
            label={transaction.counterparty.role === 'recipient' ? 'Recipient' : 'Sender'}
            value={`${transaction.counterparty.accountName}\n${transaction.counterparty.bankName ?? 'Bank'} · ${transaction.counterparty.accountNumber}`}
          />
        ) : null}
        {typeof transaction.feeMinor === 'number' ? <DetailRow label="Fee" value={formatMinor(transaction.feeMinor)} /> : null}
        {transaction.narration ? <DetailRow label="Narration" value={transaction.narration} /> : null}
      </View>
      <Button label="Copy reference" variant="secondary" onPress={() => void copyReference()} />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      <Text style={styles.value} maxFontSizeMultiplier={1.6}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  pad: { padding: space.lg, gap: space.md },
  amount: { fontSize: 36, fontWeight: '800', color: colors.text },
  currency: { color: colors.muted, fontWeight: '700' },
  explanation: { color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.border },
  row: { gap: space.xs },
  label: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700' },
  value: { color: colors.text, fontSize: typeScale.body, lineHeight: 22 },
});
