import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { TransactionRow } from '../components/TransactionRow';
import { Banner, EmptyState, LoadingBlock } from '../components/ui';
import { isValidDateInput, presetDateRange, watToday } from '../domain/dates';
import { customerMessage } from '../domain/errors';
import { TRANSFER_POLICY } from '../domain/policy';
import { describeQueryState } from '../domain/queryState';
import { createDebouncer, singleFlight } from '../domain/staleRequest';
import { applyFilterPatch, emptyFilters, mergeTransactionPages, type TransactionFilters } from '../domain/transactions';
import type { TransactionStatus, TransactionType } from '../domain/types';
import { openScreen } from '../navigation/openScreen';
import { bankApi, queryClient, useSession } from '../state/runtime';
import { colors, space, type as typeScale } from '../theme/tokens';

const refreshHistory = singleFlight(() => queryClient.refetchQueries({ queryKey: ['transactions', 'history'] }));

export function HistoryScreen() {
  const expired = useSession((state) => state.expired);
  const [searchInput, setSearchInput] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [filters, setFilters] = useState<TransactionFilters>(emptyFilters);
  const dateError = dateInputError(fromInput, toInput);

  useEffect(() => {
    const debouncer = createDebouncer(TRANSFER_POLICY.searchDebounceMs);
    debouncer.push(searchInput, (value) => {
      setFilters((current) => applyFilterPatch(current, { search: value }));
    });
    return () => debouncer.cancel();
  }, [searchInput]);

  const query = useInfiniteQuery({
    queryKey: ['transactions', 'history', filters],
    initialPageParam: 1,
    enabled: !expired,
    queryFn: ({ pageParam, signal }) =>
      bankApi.listTransactions({ ...filters, page: pageParam, limit: TRANSFER_POLICY.pageSize }, signal),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
  });

  function applyPreset(preset: '7d' | '30d' | 'all') {
    const range = presetDateRange(preset, watToday(new Date()));
    setFromInput(range.from ?? '');
    setToInput(range.to ?? '');
    setFilters((current) => applyFilterPatch(current, range));
  }

  function changeFrom(value: string) {
    setFromInput(value);
    commitDateFilter(value, toInput, setFilters);
  }

  function changeTo(value: string) {
    setToInput(value);
    commitDateFilter(fromInput, value, setFilters);
  }

  const items = useMemo(() => mergeTransactionPages(query.data?.pages.map((page) => page.items) ?? []), [query.data]);
  const view = describeQueryState({
    data: query.data ? items : undefined,
    isPending: query.isPending,
    isFetching: query.isFetching && !query.isFetchingNextPage,
    isError: query.isError,
    isEmpty: (rows) => rows.length === 0,
  });

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={view.mode === 'error' ? [] : items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionRow transaction={item} onPress={() => openScreen(`/transaction/${item.id}`)} />}
      refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void refreshHistory()} />}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.4}
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            accessibilityLabel="Search by description or reference"
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search description or reference"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            maxFontSizeMultiplier={1.6}
          />
          <ChipRow
            label="Type"
            options={[
              ['all', 'All types'],
              ['credit', 'Money in'],
              ['debit', 'Money out'],
            ]}
            selected={filters.type}
            onSelect={(type) => setFilters((current) => applyFilterPatch(current, { type: type as TransactionFilters['type'] }))}
          />
          <ChipRow
            label="Status"
            options={[
              ['all', 'All statuses'],
              ['pending', 'Pending'],
              ['successful', 'Successful'],
              ['failed', 'Failed'],
              ['reversed', 'Reversed'],
            ]}
            selected={filters.status}
            onSelect={(status) => setFilters((current) => applyFilterPatch(current, { status: status as TransactionFilters['status'] }))}
          />
          <View style={styles.presets}>
            <FilterChip label="All dates" selected={!filters.from && !filters.to} onPress={() => applyPreset('all')} />
            <FilterChip label="7 days" selected={sameRange(filters, '7d')} onPress={() => applyPreset('7d')} />
            <FilterChip label="30 days" selected={sameRange(filters, '30d')} onPress={() => applyPreset('30d')} />
          </View>
          <View style={styles.dates}>
            <DateField label="From" value={fromInput} onChangeText={changeFrom} />
            <DateField label="To" value={toInput} onChangeText={changeTo} />
          </View>
          {dateError ? <Banner message={dateError} /> : null}
          {view.mode === 'refresh-error' ? <Banner message="We couldn't refresh. The transactions already loaded are still shown." /> : null}
        </View>
      }
      ListEmptyComponent={
        view.mode === 'loading' ? (
          <LoadingBlock label="Loading transactions" />
        ) : view.mode === 'error' ? (
          <View style={styles.emptyWrap}>
            <Banner message={customerMessage('UPSTREAM_FAILURE')} />
            <Pressable accessibilityRole="button" accessibilityLabel="Try loading transactions again" onPress={() => void query.refetch()} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : view.mode === 'empty' ? (
          <EmptyState title="No matching transactions" message="This is an empty result, not a failed request. Adjust the search or filters." />
        ) : undefined
      }
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <Text style={styles.footer} accessibilityLabel="Loading more transactions">
            Loading more…
          </Text>
        ) : !query.hasNextPage && items.length > 0 ? (
          <Text style={styles.footer}>End of transactions</Text>
        ) : undefined
      }
    />
  );
}

function dateInputError(from: string, to: string): string | null {
  if (from.length === 10 && !isValidDateInput(from)) {
    return 'Start date must use YYYY-MM-DD';
  }
  if (to.length === 10 && !isValidDateInput(to)) {
    return 'End date must use YYYY-MM-DD';
  }
  if (from.length === 10 && to.length === 10 && from > to) {
    return 'Start date must be on or before the end date';
  }
  return null;
}

function commitDateFilter(
  from: string,
  to: string,
  setFilters: (updater: (current: TransactionFilters) => TransactionFilters) => void,
) {
  if ((from.length > 0 && from.length < 10) || (to.length > 0 && to.length < 10) || dateInputError(from, to)) {
    return;
  }
  setFilters((current) => applyFilterPatch(current, { from: from || null, to: to || null }));
}

function sameRange(filters: TransactionFilters, preset: '7d' | '30d'): boolean {
  const range = presetDateRange(preset, watToday(new Date()));
  return filters.from === range.from && filters.to === range.to;
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  selected: string;
  onSelect: (value: TransactionType | TransactionStatus | 'all') => void;
}) {
  return (
    <View accessibilityLabel={label} style={styles.chips}>
      {options.map(([value, caption]) => (
        <FilterChip key={value} label={caption} selected={selected === value} onPress={() => onSelect(value as TransactionType | TransactionStatus | 'all')} />
      ))}
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

function DateField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={`${label} date`}
        accessibilityHint="Use year month day, for example 2026-10-01"
        value={value}
        onChangeText={onChangeText}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={styles.dateInput}
        maxFontSizeMultiplier={1.4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxl, flexGrow: 1 },
  header: { padding: space.lg, gap: space.md },
  search: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontSize: typeScale.body,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: colors.white },
  dates: { flexDirection: 'row', gap: space.md },
  dateField: { flex: 1, gap: space.xs },
  dateLabel: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '700' },
  dateInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    color: colors.text,
  },
  emptyWrap: { padding: space.lg, gap: space.md },
  retry: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.blue, fontWeight: '800' },
  footer: { textAlign: 'center', color: colors.muted, padding: space.lg },
});
