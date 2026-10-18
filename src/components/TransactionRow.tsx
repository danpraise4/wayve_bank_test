import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTimestamp } from '../domain/dates';
import { formatSignedMinor } from '../domain/money';
import type { Transaction } from '../domain/types';
import { colors, space, type as typeScale } from '../theme/tokens';
import { StatusBadge } from './StatusBadge';

export function TransactionRow({ transaction, onPress }: { transaction: Transaction; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${transaction.description}, ${formatSignedMinor(transaction.amountMinor, transaction.type)}, ${transaction.status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text style={styles.description} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {transaction.description}
        </Text>
        <Text style={styles.meta} maxFontSizeMultiplier={1.6}>
          {formatTimestamp(transaction.createdAt)} · {transaction.reference}
        </Text>
      </View>
      <View style={styles.side}>
        <Text style={[styles.amount, transaction.type === 'credit' ? styles.credit : styles.debit]} maxFontSizeMultiplier={1.4}>
          {formatSignedMinor(transaction.amountMinor, transaction.type)}
        </Text>
        <StatusBadge status={transaction.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
  },
  pressed: { backgroundColor: colors.blueSoft },
  copy: { flex: 1, gap: space.xs },
  description: { color: colors.text, fontSize: typeScale.body, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: typeScale.caption },
  side: { alignItems: 'flex-end', gap: space.sm, maxWidth: '46%' },
  amount: { fontSize: typeScale.label, fontWeight: '700' },
  credit: { color: colors.success },
  debit: { color: colors.text },
});
