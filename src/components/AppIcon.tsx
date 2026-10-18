import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  Info,
  Landmark,
  Lock,
  ReceiptText,
  Search,
  Send,
  SlidersHorizontal,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

const icons = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
  send: Send,
  history: ReceiptText,
  eye: Eye,
  eyeOff: EyeOff,
  copy: Copy,
  chevron: ChevronRight,
  search: Search,
  empty: Inbox,
  info: Info,
  alert: CircleAlert,
  tools: SlidersHorizontal,
  clock: Clock,
  bank: Landmark,
  check: Check,
  lock: Lock,
  close: X,
  undo: Undo2,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof icons;

/** Decorative icon. The surrounding control keeps the accessible name. */
export function AppIcon({
  name,
  size = 20,
  color,
  wellColor,
  style,
}: {
  name: AppIconName;
  size?: number;
  color: string;
  wellColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const Icon = icons[name];
  const glyph = <Icon size={size} color={color} strokeWidth={2.25} />;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        wellColor
          ? {
              width: size + 20,
              height: size + 20,
              borderRadius: 999,
              backgroundColor: wellColor,
              alignItems: 'center',
              justifyContent: 'center',
            }
          : null,
        style,
      ]}
    >
      {glyph}
    </View>
  );
}
