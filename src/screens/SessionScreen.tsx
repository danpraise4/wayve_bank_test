import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { Button } from '../components/ui';
import { bankApi, queryClient, useSession } from '../state/runtime';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

export function SessionScreen() {
  const restore = useSession((state) => state.restore);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <AppIcon name="lock" size={22} color={colors.white} wellColor={colors.blue} />
        <Text accessibilityRole="header" style={styles.title}>
          Session expired
        </Text>
        <Text style={styles.body}>
          Your session has expired. Account balances and transaction details have been cleared from this screen. Sign in again to continue.
        </Text>
        <Button
          label="Continue with demo session"
          onPress={() => {
            bankApi.noteSessionRestored();
            queryClient.clear();
            restore();
          }}
        />
        <Text style={styles.noteText}>This assessment uses a mock session. No real credentials are stored.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blueDeep, padding: space.xl, justifyContent: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.xl, gap: space.lg, ...shadow.card },
  title: { color: colors.text, fontSize: typeScale.title, fontWeight: '800', letterSpacing: -0.4 },
  body: { color: colors.muted, fontSize: typeScale.body, lineHeight: 24 },
  noteText: { color: colors.muted, fontSize: typeScale.caption, lineHeight: 18 },
});
