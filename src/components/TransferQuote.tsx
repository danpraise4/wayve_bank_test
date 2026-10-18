import { StyleSheet, Text, View } from 'react-native';
import { formatMinor } from '../domain/money';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

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
      <Text style={styles.heading}>Payment summary</Text>
      <QuoteRow label="Amount" value={amountMinor === null ? '—' : formatMinor(amountMinor)} />
      <QuoteRow label="Fee" value={feeMinor === null ? '—' : formatMinor(feeMinor)} />
      <View style={styles.divider} />
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
      <Text style={[styles.value, emphasis && styles.emphasisValue]} maxFontSizeMultiplier={1.4}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  heading: { color: colors.muted, fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, minHeight: 28, alignItems: 'center' },
  label: { color: colors.muted, fontSize: typeScale.body },
  value: { color: colors.text, fontSize: typeScale.body, fontWeight: '700' },
  emphasis: { color: colors.text, fontWeight: '800' },
  emphasisValue: { color: colors.blue, fontWeight: '800', fontSize: typeScale.section },
});
