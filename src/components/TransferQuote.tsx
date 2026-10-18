import { StyleSheet, Text, View } from 'react-native';
import { formatMinor } from '../domain/money';
import { colors, space, type as typeScale } from '../theme/tokens';

export function TransferQuote({
  amountMinor,
  feeMinor,
  totalDebitMinor,
}: {
  amountMinor: number | null;
  feeMinor: number | null;
  totalDebitMinor: number | null;
}) {
  return (
    <View style={styles.card}>
      <QuoteRow label="Amount" value={amountMinor === null ? '—' : formatMinor(amountMinor)} />
      <QuoteRow label="Fee" value={feeMinor === null ? '—' : formatMinor(feeMinor)} />
      <QuoteRow label="Total debit" value={totalDebitMinor === null ? '—' : formatMinor(totalDebitMinor)} emphasis />
    </View>
  );
}

function QuoteRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.label, emphasis && styles.emphasis]} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      <Text style={[styles.value, emphasis && styles.emphasis]} maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, minHeight: 28 },
  label: { color: colors.muted, fontSize: typeScale.body },
  value: { color: colors.text, fontSize: typeScale.body, fontWeight: '600' },
  emphasis: { color: colors.blue, fontWeight: '800' },
});
