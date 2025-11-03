// ====================================
// components/home/SectionHeader.tsx
// ====================================
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

type SectionHeaderProps = {
  icon?: string;
  title: string;
  iconColor?: string;
};

export const SectionHeader = ({ icon, title, iconColor }: SectionHeaderProps) => (
  <View style={styles.sectionHeader}>
    {icon && <IconSymbol name={icon} size={20} color={iconColor || '#ef4444'} />}
    <ThemedText type="subtitle" style={styles.sectionTitle}>
      {title}
    </ThemedText>
  </View>
);

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});