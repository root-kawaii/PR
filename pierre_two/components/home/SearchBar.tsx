// ====================================
// components/home/SearchBar.tsx
// ====================================
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onCalendarPress?: () => void;
};

export const SearchBar = ({ value, onChangeText, onCalendarPress }: SearchBarProps) => {
  const router = useRouter();
  const { theme } = useTheme();

  const handleSearchPress = () => {
    router.push('/explore');
  };

  return (
    <View style={[styles.header, { borderBottomColor: theme.backgroundSurface }]}>
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: theme.backgroundSurface }]}
        onPress={handleSearchPress}
        activeOpacity={0.7}
      >
        <IconSymbol name="magnifyingglass" size={20} color={theme.textTertiary} />
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Cerca per città o locale..."
            placeholderTextColor={theme.textTertiary}
            value={value}
            onChangeText={onChangeText}
            editable={false}
            pointerEvents="none"
          />
        </View>
        <TouchableOpacity onPress={onCalendarPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconSymbol name="calendar" size={20} color={theme.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
});
