import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../components/AppIcon';
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
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

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
    await Clipboard.setStringAsync(account.data.accountNumber);
    setNotice('Account number copied');
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={account.isRefetching || recent.isRefetching} onRefresh={() => void refreshOnce()} tintColor={colors.white} />}
    >
      <View style={styles.hero}>
        <View style={styles.orb} />
        <View style={styles.heroTop}>
          <Text style={styles.brand} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            WAYVE
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open assessment tools" onPress={() => openScreen('/tools')} style={styles.tools}>
            <AppIcon name="tools" size={16} color={colors.white} />
            <Text style={styles.toolsText} maxFontSizeMultiplier={1.4}>
              Tools
            </Text>
          </Pressable>
        </View>
        <Text style={styles.greeting} maxFontSizeMultiplier={1.5}>
          {account.data ? greetingForDate(new Date(), firstNameFrom(account.data.accountName)) : 'Welcome'}
        </Text>
        <Text style={styles.heroName} maxFontSizeMultiplier={1.4}>
          {account.data?.accountName ?? 'Wayve current account'}
        </Text>
      </View>

      <View style={styles.sheet}>
        {refreshFailed ? <Banner message={`${customerMessage('UPSTREAM_FAILURE')} Your last balances and transactions are still shown.`} /> : null}
        {notice ? <Banner tone="info" message={notice} /> : null}
        {intent && isUnresolvedPhase(intent.phase) ? (
          <Pressable accessibilityRole="button" accessibilityLabel="View the transfer that is still being verified" onPress={() => openScreen('/transfer/result')} style={styles.pendingCard}>
            <AppIcon name="clock" size={18} color={colors.pending} wellColor="#F3E2B8" />
            <View style={styles.pendingCopy}>
              <Text style={styles.pendingTitle} maxFontSizeMultiplier={1.6}>
                Transfer still being verified
              </Text>
              <Text style={styles.pendingBody} maxFontSizeMultiplier={1.8}>
                {intent.customerMessage}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {accountView.mode === 'loading' ? <LoadingBlock label="Loading account" inset={false} /> : null}
        {accountView.mode === 'error' ? (
          <View style={styles.heroError}>
            <Banner message={customerMessage('UPSTREAM_FAILURE')} />
            <Button label="Try again" onPress={() => void account.refetch()} />
          </View>
        ) : null}
        {account.data ? (
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <Text style={styles.kicker} maxFontSizeMultiplier={1.4}>
                Available balance
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={balanceHidden ? 'Show balance' : 'Hide balance'}
                onPress={toggleBalance}
                style={styles.pill}
              >
                <AppIcon name={balanceHidden ? 'eye' : 'eyeOff'} size={16} color={colors.blue} />
                <Text style={styles.pillText}>{balanceHidden ? 'Show' : 'Hide'}</Text>
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
            <View style={styles.accountRow}>
              <View>
                <Text style={styles.accountLabel}>Account number</Text>
                <Text style={styles.accountNumber} accessibilityLabel="Account number" maxFontSizeMultiplier={1.4}>
                  {account.data.accountNumber}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Copy account number" onPress={() => void copyAccountNumber()} style={styles.pill}>
                <AppIcon name="copy" size={16} color={colors.blue} />
                <Text style={styles.pillText}>Copy</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Send money" onPress={() => openScreen('/transfer/recipient')} style={styles.action}>
            <AppIcon name="send" size={20} color={colors.white} wellColor={colors.blue} />
            <Text style={styles.actionLabel}>Send money</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="History" onPress={() => openScreen('/transactions')} style={styles.action}>
            <AppIcon name="history" size={20} color={colors.blue} wellColor={colors.blueSoft} />
            <Text style={styles.actionLabel}>History</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
          Recent
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all transactions" onPress={() => openScreen('/transactions')} style={styles.seeAll}>
          <Text style={styles.seeAllText}>See all</Text>
          <AppIcon name="chevron" size={16} color={colors.blue} />
        </Pressable>
      </View>
      {recentView.mode === 'loading' ? <LoadingBlock label="Loading recent transactions" /> : null}
      {recentView.mode === 'error' ? (
        <View style={styles.pad}>
          <Banner message="We couldn't load recent transactions." />
          <Button label="Try again" variant="secondary" onPress={() => void recent.refetch()} />
        </View>
      ) : null}
      {recentView.mode === 'empty' ? <EmptyState title="No transactions yet" message="Transfers and credits will show up here." /> : null}
      {recent.data?.items.map((transaction, index, list) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          isFirst={index === 0}
          isLast={index === list.length - 1}
          onPress={() => openScreen(`/transaction/${transaction.id}`)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxl },
  hero: { backgroundColor: colors.blueDeep, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: 56, gap: space.sm, overflow: 'hidden' },
  orb: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: colors.blue, right: -70, top: -40 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.white, fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 2.4 },
  tools: { minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', gap: 6 },
  toolsText: { color: colors.white, fontWeight: '700' },
  greeting: { color: colors.white, fontSize: typeScale.title, fontWeight: '800', letterSpacing: -0.4, marginTop: space.md },
  heroName: { color: '#D5E4F5', fontSize: typeScale.body },
  sheet: { marginTop: -36, paddingHorizontal: space.lg, gap: space.md },
  heroError: { gap: space.md },
  balanceCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.sm, ...shadow.card },
  kicker: { color: colors.muted, fontSize: typeScale.label, fontWeight: '700' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balance: { color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -0.8 },
  balanceSkeleton: { height: 40, width: 180, borderRadius: radius.sm, backgroundColor: '#E7EEF6' },
  accountRow: { marginTop: space.sm, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountLabel: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700' },
  accountNumber: { color: colors.text, fontSize: typeScale.body, fontWeight: '800', letterSpacing: 0.8 },
  pill: { minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  pillText: { color: colors.blue, fontWeight: '800' },
  pendingCard: { backgroundColor: colors.pendingBg, borderRadius: radius.md, padding: space.md, gap: space.md, flexDirection: 'row', alignItems: 'flex-start' },
  pendingCopy: { flex: 1, gap: space.xs },
  pendingTitle: { color: colors.pending, fontWeight: '800' },
  pendingBody: { color: colors.pending, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: space.md },
  action: { flex: 1, minHeight: 96, backgroundColor: colors.white, borderRadius: radius.lg, padding: space.md, gap: space.sm, justifyContent: 'center', ...shadow.card },
  actionLabel: { color: colors.text, fontWeight: '800', fontSize: typeScale.label },
  sectionRow: { marginTop: space.lg, paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { color: colors.text, fontSize: typeScale.section, fontWeight: '800' },
  seeAll: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: colors.blue, fontWeight: '800' },
  pad: { padding: space.lg, gap: space.md },
});
