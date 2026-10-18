import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { bankApi, queryClient, useSession } from '../state/runtime';
import { colors, space, type as typeScale } from '../theme/tokens';

export function SessionScreen() {
  const restore = useSession((state) => state.restore);

  return (
    <View style={styles.screen}>
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space.xl, justifyContent: 'center', gap: space.lg },
  title: { color: colors.text, fontSize: typeScale.title, fontWeight: '800' },
  body: { color: colors.muted, fontSize: typeScale.body, lineHeight: 24 },
  noteText: { color: colors.muted, fontSize: typeScale.caption, lineHeight: 18 },
});
