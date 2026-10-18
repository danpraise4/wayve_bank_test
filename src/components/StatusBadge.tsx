import { StyleSheet, Text, View } from 'react-native';
import { statusPresentation } from '../domain/status';
import type { TransactionStatus } from '../domain/types';
import { colors, space, type as typeScale } from '../theme/tokens';

const tones = {
  success: { color: colors.success, background: colors.successBg },
  pending: { color: colors.pending, background: colors.pendingBg },
  failed: { color: colors.failed, background: colors.failedBg },
  reversed: { color: colors.reversed, background: colors.reversedBg },
} as const;

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const presentation = statusPresentation(status);
  const tone = tones[presentation.tone];
  return (
    <View
      accessibilityLabel={`${presentation.label}. ${presentation.description}`}
      style={[styles.badge, { backgroundColor: tone.background }]}
    >
      <Text style={[styles.label, { color: tone.color }]} maxFontSizeMultiplier={1.6}>
        {presentation.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: space.md,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: typeScale.caption, fontWeight: '700' },
});
