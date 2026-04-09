// ====================================
// components/common/FloatingActionButton.tsx
// ====================================
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';

// Bottom tab bar height constants
const TAB_BAR_HEIGHT = 49; // iOS standard tab bar height
const TAB_BAR_HEIGHT_ANDROID = 56;

type FloatingActionButtonProps = {
  onPress: () => void;
  icon?: IconSymbolName;
};

export const FloatingActionButton = ({ onPress, icon = 'qrcode' }: FloatingActionButtonProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.OS === 'android' ? TAB_BAR_HEIGHT_ANDROID : TAB_BAR_HEIGHT;
  // Position FAB above the tab bar, accounting for safe area
  const bottomOffset = tabBarHeight + insets.bottom - 8;

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: theme.primary, bottom: bottomOffset }]}
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <IconSymbol name={icon} size={24} color={theme.textInverse} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
});
