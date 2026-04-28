import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemePalette,
  ThemeName,
  DEFAULT_THEME,
  themes,
  availableThemes,
  THEME_DISPLAY_NAMES,
} from '../constants/theme';

const THEME_STORAGE_KEY = '@app_theme';

interface ThemeContextType {
  /** Current theme name */
  themeName: ThemeName;
  /** Current theme palette with all colors */
  theme: ThemePalette;
  /** Set the active theme */
  setTheme: (themeName: ThemeName) => Promise<void>;
  /** List of all available theme names */
  availableThemes: ThemeName[];
  /** Display names for themes */
  themeDisplayNames: Record<ThemeName, string>;
  /** Whether theme is still loading from storage */
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && availableThemes.includes(savedTheme as ThemeName)) {
        setThemeName(savedTheme as ThemeName);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setTheme = useCallback(async (newThemeName: ThemeName) => {
    try {
      setThemeName(newThemeName);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newThemeName);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, []);

  const value: ThemeContextType = {
    themeName,
    theme: themes[themeName],
    setTheme,
    availableThemes,
    themeDisplayNames: THEME_DISPLAY_NAMES,
    isLoading,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access the theme context
 * Returns the current theme palette and methods to change themes
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to get a specific color from the current theme
 * Useful for getting single colors without destructuring the whole theme
 */
export function useThemeColor<K extends keyof ThemePalette>(colorKey: K): ThemePalette[K] {
  const { theme } = useTheme();
  return theme[colorKey];
}

/**
 * Hook to get multiple colors from the current theme
 * @param colorKeys Array of color keys to retrieve
 * @returns Object with requested color values
 */
export function useThemeColors<K extends keyof ThemePalette>(
  colorKeys: K[]
): Pick<ThemePalette, K> {
  const { theme } = useTheme();
  return colorKeys.reduce((acc, key) => {
    acc[key] = theme[key];
    return acc;
  }, {} as Pick<ThemePalette, K>);
}
