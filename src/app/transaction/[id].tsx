import { useLocalSearchParams } from 'expo-router';
import { DetailScreen } from '../../screens/DetailScreen';

export default function TransactionRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  return <DetailScreen id={id} />;
}
