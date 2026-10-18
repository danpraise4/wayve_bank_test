import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../components/AppIcon';
import { useScenario } from '../state/runtime';
import { colors, radius, shadow, space, type as typeScale } from '../theme/tokens';

const SCENARIOS: readonly { id: string | null; label: string; detail: string }[] = [
  { id: null, label: 'Normal', detail: 'Successful transfers and ordinary responses.' },
  { id: 'slow', label: 'Slow network', detail: 'Responses wait a few seconds.' },
  { id: 'timeout', label: 'Uncertain transfer', detail: 'The bank accepts the transfer, then the response arrives after the client gives up.' },
  { id: 'pending', label: 'Stay pending', detail: 'The transfer succeeds as a pending, non-final status.' },
  { id: 'reject', label: 'Bank rejection', detail: 'The bank explicitly declines the transfer.' },
  { id: 'insufficient', label: 'Insufficient balance', detail: 'The bank refuses because the balance cannot cover the debit.' },
  { id: 'session-expired', label: 'Session expired', detail: 'The next request ends the session and stops retries.' },
  { id: 'duplicate-page', label: 'Duplicate page row', detail: 'Page 2 repeats the last transaction from page 1.' },
  { id: 'refresh-fail', label: 'Refresh fails', detail: 'Load data first, then enable this and pull to refresh.' },
  { id: 'out-of-order', label: 'Out-of-order search', detail: 'A search for merchant returns after a search for transfer.' },
  { id: 'malformed', label: 'Malformed response', detail: 'Transaction details cannot be read.' },
  { id: 'not-found', label: 'Missing transaction', detail: 'Transaction details return not found.' },
];

export function ToolsScreen() {
  const scenario = useScenario((state) => state.scenario);
  const setScenario = useScenario((state) => state.setScenario);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        These controls only affect the mock API. They are here so the failure scenarios can be demonstrated. Open the transaction named Status watch demo to see a pending payment become successful.
      </Text>
      {SCENARIOS.map((item) => {
        const selected = scenario === item.id;
        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => setScenario(item.id)}
            style={[styles.row, selected && styles.selected]}
          >
            <View style={styles.copy}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.detail}>{item.detail}</Text>
            </View>
            {selected ? <AppIcon name="check" size={18} color={colors.blue} /> : <View style={styles.mark} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  intro: { color: colors.muted, lineHeight: 22, marginBottom: space.sm },
  row: {
    minHeight: 76,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    ...shadow.card,
  },
  selected: { backgroundColor: colors.blueSoft },
  copy: { flex: 1, gap: 4 },
  label: { color: colors.text, fontWeight: '800', fontSize: typeScale.body },
  detail: { color: colors.muted, lineHeight: 20 },
  mark: { width: 18, height: 18 },
});
