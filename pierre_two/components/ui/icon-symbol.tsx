// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconSymbolName =
  | 'house.fill'
  | 'paperplane.fill'
  | 'chevron.left.forwardslash.chevron.right'
  | 'chevron.right'
  | 'chevron.left'
  | 'chevron.up'
  | 'chevron.down'
  | 'confirmation-number'
  | 'person'
  | 'ticket.fill'
  | 'exclamationmark.triangle.fill'
  | 'location.fill'
  | 'calendar'
  | 'barcode'
  | 'qrcode'
  | 'xmark'
  | 'checkmark.circle'
  | 'magnifyingglass'
  | 'mappin';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  'confirmation-number': 'confirmation-number',
  'person': 'person',
  'ticket.fill': 'confirmation-number',
  'exclamationmark.triangle.fill': 'warning',
  'location.fill': 'location-on',
  'calendar': 'event',
  'barcode': 'qr-code-2',
  'qrcode': 'qr-code',
  'xmark': 'close',
  'checkmark.circle': 'check-circle',
  'magnifyingglass': 'search',
  'mappin': 'place',
} as const;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
