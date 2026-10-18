import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatListWhen } from '../domain/dates';
import { formatSignedMinor } from '../domain/money';
import type { Transaction } from '../domain/types';
import { colors, radius, space, type as typeScale } from '../theme/tokens';
import { AppIcon } from './AppIcon';
import { StatusBadge } from './StatusBadge';

export function TransactionRow({
  transaction,
  onPress,
  isFirst = false,
  isLast = false,
}: {
  transaction: Transaction;
  onPress: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const incoming = transaction.type === 'credit';
  const when = formatListWhen(transaction.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${transaction.description}, ${formatSignedMinor(transaction.amountMinor, transaction.type)}, ${when}, reference ${transaction.reference}, ${transaction.status}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isFirst && styles.first,
        isLast && styles.last,
        isFirst && isLast && styles.only,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        name={incoming ? 'in' : 'out'}
        size={18}
        color={incoming ? colors.success : colors.blue}
        wellColor={incoming ? colors.successBg : colors.blueSoft}
      />
      <View style={styles.copy}>
        <View style={styles.top}>
          <Text style={styles.description} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {transaction.description}
          </Text>
          <Text style={[styles.amount, incoming ? styles.credit : styles.debit]} maxFontSizeMultiplier={1.4}>
            {formatSignedMinor(transaction.amountMinor, transaction.type)}
          </Text>
        </View>
        <View style={styles.middle}>
          <Text style={styles.when} maxFontSizeMultiplier={1.4}>
            {when}
          </Text>
          <StatusBadge status={transaction.status} />
        </View>
        <Text style={styles.reference} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {transaction.reference}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: space.lg,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    backgroundColor: colors.white,
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderBottomWidth: 0, marginBottom: space.md },
  only: { borderRadius: radius.lg },
  pressed: { backgroundColor: colors.blueSoft },
  copy: { flex: 1, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  description: { flex: 1, color: colors.text, fontSize: typeScale.body, fontWeight: '700' },
  amount: { fontSize: typeScale.label, fontWeight: '800' },
  credit: { color: colors.success },
  debit: { color: colors.text },
  middle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  when: { color: colors.muted, fontSize: typeScale.label, fontWeight: '600' },
  reference: { color: colors.muted, fontSize: typeScale.caption, letterSpacing: 0.4 },
});
