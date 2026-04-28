/**
 * Theme color hooks for accessing the app's theme system.
 *
 * Primary hook: useAppTheme() - Returns the full theme context
 * Legacy hook: useThemeColor() - Backwards compatible with old light/dark system
 */

import { Colors, ThemePalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Re-export the new theme hooks from context for convenience
export { useTheme, useThemeColor as useThemeColorKey, useThemeColors } from '@/context/ThemeContext';

/**
 * Legacy hook for backwards compatibility during migration.
 * Uses the old light/dark color scheme system.
 *
 * @deprecated Use useTheme() from ThemeContext instead
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

/**
 * Convenience hook that returns the full theme palette.
 * This is an alias for useTheme().theme for simpler usage.
 *
 * @example
 * const theme = useAppTheme();
 * <View style={{ backgroundColor: theme.background }}>
 *   <Text style={{ color: theme.text }}>Hello</Text>
 * </View>
 */
export { useTheme as useAppTheme } from '@/context/ThemeContext';
