import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TransactionRow } from '../components/TransactionRow';
import { Banner, Button, EmptyState, LoadingBlock } from '../components/ui';
import { firstNameFrom, greetingForDate } from '../domain/dates';
import { customerMessage } from '../domain/errors';
import { formatMinor } from '../domain/money';
import { describeQueryState } from '../domain/queryState';
import { singleFlight } from '../domain/staleRequest';
import { isUnresolvedPhase } from '../domain/transferMachine';
import { openScreen } from '../navigation/openScreen';
import { bankApi, queryClient, useSession, useTransferIntent } from '../state/runtime';
import { usePrivacy } from '../state/privacyStore';
import { colors, space, type as typeScale } from '../theme/tokens';

const refreshOnce = singleFlight(() =>
  Promise.all([
    queryClient.refetchQueries({ queryKey: ['account'] }),
    queryClient.refetchQueries({ queryKey: ['transactions', 'recent'] }),
  ]),
);

export function HomeScreen() {
  const expired = useSession((state) => state.expired);
  const balanceHidden = usePrivacy((state) => state.balanceHidden);
  const toggleBalance = usePrivacy((state) => state.toggleBalance);
  const [privacyReady, setPrivacyReady] = useState(usePrivacy.persist.hasHydrated());
  const intent = useTransferIntent((state) => state.intent);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => usePrivacy.persist.onFinishHydration(() => setPrivacyReady(true)), []);

  const account = useQuery({
    queryKey: ['account'],
    queryFn: ({ signal }) => bankApi.getAccount(signal),
    enabled: !expired,
  });
  const recent = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: ({ signal }) =>
      bankApi.listTransactions({ search: '', type: 'all', status: 'all', from: null, to: null, page: 1, limit: 5 }, signal),
    enabled: !expired,
  });

  const accountView = describeQueryState({
    data: account.data,
    isPending: account.isPending,
    isFetching: account.isFetching,
    isError: account.isError,
  });
  const recentView = describeQueryState({
    data: recent.data?.items,
    isPending: recent.isPending,
    isFetching: recent.isFetching,
    isError: recent.isError,
    isEmpty: (items) => items.length === 0,
  });
  const refreshFailed = accountView.mode === 'refresh-error' || recentView.mode === 'refresh-error';

  async function copyAccountNumber() {
    if (!account.data) {
      return;
    }
    await Clipboard.setStringAsync(account.data.accountNumber, { android: { isSensitive: true } });
    setNotice('Account number copied');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={account.isRefetching || recent.isRefetching} onRefresh={() => void refreshOnce()} tintColor={colors.white} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.brand} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            WAYVE
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open assessment tools" onPress={() => openScreen('/tools')} style={styles.tools}>
            <Text style={styles.toolsText} maxFontSizeMultiplier={1.4}>
              Tools
            </Text>
          </Pressable>
        </View>
        <Text style={styles.greeting} maxFontSizeMultiplier={1.6}>
          {account.data ? greetingForDate(new Date(), firstNameFrom(account.data.accountName)) : 'Welcome'}
        </Text>
        {refreshFailed ? <Banner message={`${customerMessage('UPSTREAM_FAILURE')} Your last balances and transactions are still shown.`} /> : null}
        {notice ? <Banner tone="info" message={notice} /> : null}
        {intent && isUnresolvedPhase(intent.phase) ? (
          <Pressable accessibilityRole="button" accessibilityLabel="View the transfer that is still being verified" onPress={() => openScreen('/transfer/result')} style={styles.pendingCard}>
            <Text style={styles.pendingTitle} maxFontSizeMultiplier={1.6}>
              Transfer still being verified
            </Text>
            <Text style={styles.pendingBody} maxFontSizeMultiplier={1.8}>
              {intent.customerMessage}
            </Text>
          </Pressable>
        ) : null}

        {accountView.mode === 'loading' ? <LoadingBlock label="Loading account" /> : null}
        {accountView.mode === 'error' ? (
          <View style={styles.heroError}>
            <Banner message={customerMessage('UPSTREAM_FAILURE')} />
            <Button label="Try again" onPress={() => void account.refetch()} />
          </View>
        ) : null}
        {account.data ? (
          <View style={styles.accountBlock}>
            <Text style={styles.kicker} maxFontSizeMultiplier={1.4}>
              {account.data.accountName}
            </Text>
            <View style={styles.accountRow}>
              <Text style={styles.accountNumber} accessibilityLabel="Account number" maxFontSizeMultiplier={1.4}>
                {account.data.accountNumber}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Copy account number" onPress={() => void copyAccountNumber()} style={styles.copy}>
                <Text style={styles.copyText}>Copy</Text>
              </Pressable>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.kicker} maxFontSizeMultiplier={1.4}>
                Available balance
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={balanceHidden ? 'Show balance' : 'Hide balance'}
                onPress={toggleBalance}
                style={styles.copy}
              >
                <Text style={styles.copyText}>{balanceHidden ? 'Show' : 'Hide'}</Text>
              </Pressable>
            </View>
            {!privacyReady ? (
              <View style={styles.balanceSkeleton} accessibilityLabel="Loading balance privacy setting" />
            ) : (
              <Text
                accessibilityLabel={balanceHidden ? 'Balance hidden' : `Available balance ${formatMinor(account.data.availableBalanceMinor)}`}
                style={styles.balance}
                maxFontSizeMultiplier={1.3}
              >
                {balanceHidden ? '₦ ••••••' : formatMinor(account.data.availableBalanceMinor)}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Send money" onPress={() => openScreen('/transfer/recipient')} />
        </View>
        <View style={styles.action}>
          <Button label="History" variant="secondary" onPress={() => openScreen('/transactions')} />
        </View>
      </View>

      <Text style={styles.section} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
        Recent transactions
      </Text>
      {recentView.mode === 'loading' ? <LoadingBlock label="Loading recent transactions" /> : null}
      {recentView.mode === 'error' ? (
        <View style={styles.pad}>
          <Banner message="We couldn't load recent transactions." />
          <Button label="Try again" variant="secondary" onPress={() => void recent.refetch()} />
        </View>
      ) : null}
      {recentView.mode === 'empty' ? <EmptyState title="No transactions yet" message="Transfers and credits will show up here." /> : null}
      {recent.data?.items.map((transaction) => (
        <TransactionRow key={transaction.id} transaction={transaction} onPress={() => openScreen(`/transaction/${transaction.id}`)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxl },
  hero: { backgroundColor: colors.blue, padding: space.lg, gap: space.md, paddingTop: space.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.white, fontSize: typeScale.section, fontWeight: '800', letterSpacing: 1.4 },
  tools: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  toolsText: { color: colors.white, fontWeight: '700' },
  greeting: { color: colors.white, fontSize: typeScale.title, fontWeight: '700' },
  heroError: { gap: space.md },
  accountBlock: { gap: space.sm, marginTop: space.sm },
  kicker: { color: '#D6E4F5', fontSize: typeScale.label },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountNumber: { color: colors.white, fontSize: typeScale.body, fontWeight: '700', letterSpacing: 0.6 },
  copy: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
  copyText: { color: colors.white, fontWeight: '700' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  balance: { color: colors.white, fontSize: typeScale.hero, fontWeight: '800' },
  balanceSkeleton: { height: 36, width: 160, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  pendingCard: { backgroundColor: colors.pendingBg, borderRadius: 12, padding: space.md, gap: space.xs },
  pendingTitle: { color: colors.pending, fontWeight: '800' },
  pendingBody: { color: colors.pending, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: space.md, padding: space.lg },
  action: { flex: 1 },
  section: { paddingHorizontal: space.lg, paddingBottom: space.sm, color: colors.text, fontSize: typeScale.section, fontWeight: '800' },
  pad: { padding: space.lg, gap: space.md },
});
