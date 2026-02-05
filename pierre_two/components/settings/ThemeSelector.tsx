import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/context/ThemeContext';
import { ThemeName, themes } from '@/constants/theme';

export const ThemeSelector: React.FC = () => {
  const { themeName, setTheme, availableThemes, themeDisplayNames, theme } = useTheme();

  const handleThemeSelect = (name: ThemeName) => {
    setTheme(name);
  };

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.sectionTitle, { color: theme.textTertiary }]}>
        Tema
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {availableThemes.map((name) => {
          const themeData = themes[name];
          const isSelected = themeName === name;

          return (
            <TouchableOpacity
              key={name}
              style={[
                styles.themeCard,
                {
                  backgroundColor: themeData.cardBackground,
                  borderColor: isSelected ? themeData.primary : themeData.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => handleThemeSelect(name)}
              activeOpacity={0.7}
            >
              {/* Color Preview */}
              <LinearGradient
                colors={themeData.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.colorPreview}
              >
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: themeData.text }]}>
                    <IconSymbol name="checkmark" size={12} color={themeData.primary} />
                  </View>
                )}
              </LinearGradient>

              {/* Color Swatches */}
              <View style={styles.swatchRow}>
                <View style={[styles.swatch, { backgroundColor: themeData.background }]} />
                <View style={[styles.swatch, { backgroundColor: themeData.backgroundElevated }]} />
                <View style={[styles.swatch, { backgroundColor: themeData.backgroundSurface }]} />
                <View style={[styles.swatch, { backgroundColor: themeData.text }]} />
              </View>

              {/* Theme Name */}
              <ThemedText style={[styles.themeName, { color: themeData.text }]}>
                {themeDisplayNames[name]}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  themeCard: {
    width: 100,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  colorPreview: {
    width: 84,
    height: 48,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  themeName: {
    fontSize: 12,
    fontWeight: '600',
  },
});
