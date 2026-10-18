import { useNetworkState } from 'expo-network';
import { StyleSheet, View } from 'react-native';
import { space } from '../theme/tokens';
import { Banner } from './ui';

/** Shown on every screen when the device reports no connection. */
export function OfflineBanner() {
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <Banner tone="info" message="You're offline. Saved details stay on screen, and new requests will wait." />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.sm },
});
