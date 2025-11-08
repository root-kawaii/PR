// ====================================
// components/home/SearchBar.tsx
// ====================================
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
};

export const SearchBar = ({ value, onChangeText }: SearchBarProps) => {
  const router = useRouter();

  const handleSearchPress = () => {
    router.push('/explore');
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress} activeOpacity={0.7}>
        <IconSymbol name="magnifyingglass" size={20} color="#9ca3af" />
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca per città o locale..."
            placeholderTextColor="#9ca3af"
            value={value}
            onChangeText={onChangeText}
            editable={false}
            pointerEvents="none"
          />
        </View>
        <IconSymbol name="mappin" size={20} color="#ec4899" />
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
  searchInputContainer: {
    flex: 1,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
});