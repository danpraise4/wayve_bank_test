import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, space, type as typeScale } from '../theme/tokens';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}) {
  const unavailable = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        unavailable && styles.disabled,
        pressed && !unavailable && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.blue : colors.white} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryText]} maxFontSizeMultiplier={1.6}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        maxFontSizeMultiplier={1.6}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error} maxFontSizeMultiplier={1.8}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Banner({ message, tone = 'error' }: { message: string; tone?: 'error' | 'info' }) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, tone === 'info' ? styles.bannerInfo : styles.bannerError]}
    >
      <Text style={[styles.bannerText, tone === 'info' ? styles.bannerInfoText : styles.bannerErrorText]} maxFontSizeMultiplier={1.8}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.empty}>
      <Text accessibilityRole="header" style={styles.emptyTitle} maxFontSizeMultiplier={1.6}>
        {title}
      </Text>
      <Text style={styles.hint} maxFontSizeMultiplier={1.8}>
        {message}
      </Text>
    </View>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.loading}>
      <View style={styles.skeleton} />
      <View style={[styles.skeleton, styles.skeletonShort]} />
      <ActivityIndicator color={colors.blue} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  danger: { backgroundColor: colors.failed },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  buttonText: { color: colors.white, fontSize: typeScale.body, fontWeight: '700' },
  secondaryText: { color: colors.blue },
  field: { gap: space.sm },
  fieldLabel: { color: colors.text, fontSize: typeScale.label, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: space.lg,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: typeScale.body,
  },
  inputError: { borderColor: colors.failed },
  error: { color: colors.failed, fontSize: typeScale.label },
  hint: { color: colors.muted, fontSize: typeScale.label, lineHeight: 20 },
  banner: { borderRadius: 12, padding: space.md },
  bannerError: { backgroundColor: colors.failedBg },
  bannerInfo: { backgroundColor: colors.blueSoft },
  bannerText: { fontSize: typeScale.label, lineHeight: 20 },
  bannerErrorText: { color: colors.failed },
  bannerInfoText: { color: colors.blue },
  empty: { padding: space.xl, gap: space.sm, alignItems: 'flex-start' },
  emptyTitle: { color: colors.text, fontSize: typeScale.section, fontWeight: '700' },
  loading: { gap: space.md, paddingVertical: space.lg },
  skeleton: { height: 18, borderRadius: 8, backgroundColor: '#E1E8F0' },
  skeletonShort: { width: '55%' },
});
