// ====================================
// components/home/SearchBar.tsx
// ====================================
import { View, TextInput, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
};

export const SearchBar = ({ value, onChangeText }: SearchBarProps) => (
  <View style={styles.header}>
    <View style={styles.searchBar}>
      <IconSymbol name="magnifyingglass" size={20} color="#9ca3af" />
      <TextInput
        style={styles.searchInput}
        placeholder="Cerca per città o locale..."
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
      />
      <IconSymbol name="mappin" size={20} color="#ec4899" />
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
});