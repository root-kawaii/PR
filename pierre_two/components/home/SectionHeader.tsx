// ====================================
// components/home/SectionHeader.tsx
// ====================================
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';

type SectionHeaderProps = {
  icon?: IconSymbolName;
  title: string;
  iconColor?: string;
};

export const SectionHeader = ({ icon, title, iconColor }: SectionHeaderProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      {icon && (
        <IconSymbol
          name={icon}
          size={20}
          color={iconColor || theme.primary}
        />
      )}
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {title}
      </ThemedText>
    </View>
  );
};

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
