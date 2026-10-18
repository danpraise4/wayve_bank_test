import { StyleSheet, Text, View } from 'react-native';
import { statusPresentation } from '../domain/status';
import type { TransactionStatus } from '../domain/types';
import { colors, radius, space, type as typeScale } from '../theme/tokens';
import { AppIcon, type AppIconName } from './AppIcon';

const tones = {
  success: { color: colors.success, background: colors.successBg, icon: 'check' },
  pending: { color: colors.pending, background: colors.pendingBg, icon: 'clock' },
  failed: { color: colors.failed, background: colors.failedBg, icon: 'close' },
  reversed: { color: colors.reversed, background: colors.reversedBg, icon: 'undo' },
} as const satisfies Record<string, { color: string; background: string; icon: AppIconName }>;

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const presentation = statusPresentation(status);
  const tone = tones[presentation.tone];
  return (
    <View accessibilityLabel={`${presentation.label}. ${presentation.description}`} style={[styles.badge, { backgroundColor: tone.background }]}>
      <AppIcon name={tone.icon} size={12} color={tone.color} />
      <Text style={[styles.label, { color: tone.color }]} maxFontSizeMultiplier={1.6}>
        {presentation.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  label: { fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 0.2 },
});
