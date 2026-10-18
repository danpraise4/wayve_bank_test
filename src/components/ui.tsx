import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';
import { AppIcon } from './AppIcon';

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
        variant === 'primary' && shadow.card,
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
      <AppIcon name={tone === 'info' ? 'info' : 'alert'} size={18} color={tone === 'info' ? colors.blue : colors.failed} />
      <Text style={[styles.bannerText, tone === 'info' ? styles.bannerInfoText : styles.bannerErrorText]} maxFontSizeMultiplier={1.8}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.empty}>
      <AppIcon name="empty" size={22} color={colors.blue} wellColor={colors.blueSoft} />
      <Text accessibilityRole="header" style={styles.emptyTitle} maxFontSizeMultiplier={1.6}>
        {title}
      </Text>
      <Text style={[styles.hint, styles.emptyMessage]} maxFontSizeMultiplier={1.8}>
        {message}
      </Text>
    </View>
  );
}

export function LoadingBlock({ label, inset = true }: { label: string; inset?: boolean }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={[styles.loading, !inset && styles.loadingFlush]}>
      <View style={styles.skeletonWide} />
      <View style={styles.skeleton} />
      <View style={[styles.skeleton, styles.skeletonShort]} />
    </View>
  );
}

export function ScreenIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.intro}>
      <Text style={styles.eyebrow} maxFontSizeMultiplier={1.4}>
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" style={styles.introTitle} maxFontSizeMultiplier={1.5}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: { backgroundColor: colors.failed },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonText: { color: colors.white, fontSize: typeScale.body, fontWeight: '700', letterSpacing: 0.2 },
  secondaryText: { color: colors.blue },
  field: { gap: space.sm },
  fieldLabel: { color: colors.text, fontSize: typeScale.label, fontWeight: '700' },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: typeScale.body,
  },
  inputError: { borderColor: colors.failed, backgroundColor: colors.failedBg },
  error: { color: colors.failed, fontSize: typeScale.label, lineHeight: 20 },
  hint: { color: colors.muted, fontSize: typeScale.label, lineHeight: 20 },
  emptyMessage: { textAlign: 'center' },
  banner: { borderRadius: radius.md, padding: space.md, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  bannerError: { backgroundColor: colors.failedBg },
  bannerInfo: { backgroundColor: colors.blueSoft },
  bannerText: { flex: 1, fontSize: typeScale.label, lineHeight: 20 },
  bannerErrorText: { color: colors.failed },
  bannerInfoText: { color: colors.blue },
  empty: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.xl,
    gap: space.sm,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  emptyTitle: { color: colors.text, fontSize: typeScale.section, fontWeight: '800', textAlign: 'center' },
  loading: {
    marginHorizontal: space.lg,
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  loadingFlush: { marginHorizontal: 0 },
  skeletonWide: { height: 14, width: '35%', borderRadius: radius.pill, backgroundColor: '#E7EEF6' },
  skeleton: { height: 18, borderRadius: radius.pill, backgroundColor: '#E7EEF6' },
  skeletonShort: { width: '62%' },
  intro: { gap: space.xs },
  eyebrow: { color: colors.blue, fontSize: typeScale.caption, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  introTitle: { color: colors.text, fontSize: typeScale.title, fontWeight: '800', letterSpacing: -0.4 },
});
