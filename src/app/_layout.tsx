import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '../components/OfflineBanner';
import { SessionScreen } from '../screens/SessionScreen';
import { colors } from '../theme/tokens';
import { queryClient, transferController, useSession, useTransferIntent } from '../state/runtime';

export default function RootLayout() {
  const expired = useSession((state) => state.expired);
  const setIntent = useTransferIntent((state) => state.setIntent);

  useEffect(() => {
    if (expired) {
      return;
    }
    void transferController.resume().then((intent) => {
      if (intent) {
        setIntent(intent);
      }
    });
  }, [expired, setIntent]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {expired ? (
          <SessionScreen />
        ) : (
          <View style={styles.shell}>
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.blue,
                headerTitleStyle: { fontWeight: '800', fontSize: 17 },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
              <Stack.Screen name="transactions" options={{ title: 'Transactions' }} />
              <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction' }} />
              <Stack.Screen name="transfer/recipient" options={{ title: 'Recipient' }} />
              <Stack.Screen name="transfer/amount" options={{ title: 'Amount' }} />
              <Stack.Screen name="transfer/review" options={{ title: 'Review' }} />
              <Stack.Screen
                name="transfer/result"
                options={{ title: 'Receipt', headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }}
              />
              <Stack.Screen name="tools" options={{ title: 'Assessment tools' }} />
            </Stack>
          </View>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
});
