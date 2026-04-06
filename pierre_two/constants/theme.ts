/**
 * Comprehensive Theme System
 *
 * Each theme is a complete color palette that controls all colors throughout the app.
 * Themes use semantic naming for consistent color usage across components.
 */

import { Platform } from 'react-native';

// ============================================================================
// Theme Palette Interface
// ============================================================================

export interface ThemePalette {
  // Brand Colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;

  // Background Layers (from deepest to surface)
  background: string;
  backgroundElevated: string;
  backgroundSurface: string;

  // Text Hierarchy
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;
  borderFocus: string;

  // Status Colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;

  // Interactive States
  overlay: string;
  overlayLight: string;
  ripple: string;

  // Navigation
  tabBackground: string;
  tabIconDefault: string;
  tabIconSelected: string;

  // Gradients (array of colors for LinearGradient)
  gradientPrimary: string[];
  gradientCard: string[];
  gradientOverlay: string[];

  // Special Purpose
  inputBackground: string;
  cardBackground: string;
  modalBackground: string;
  statusBarStyle: 'light' | 'dark';
}

// ============================================================================
// Theme Names
// ============================================================================

export type ThemeName = 'nightclub' | 'ocean' | 'sunset' | 'midnight' | 'daylight';

export const DEFAULT_THEME: ThemeName = 'nightclub';

export const THEME_DISPLAY_NAMES: Record<ThemeName, string> = {
  nightclub: 'Champagne',
  ocean: 'Ocean',
  sunset: 'Sunset',
  midnight: 'Midnight Rose',
  daylight: 'Daylight',
};

// ============================================================================
// Theme Definitions
// ============================================================================

/**
 * Champagne Noir Theme (Default)
 * Warm gold on true black — French luxury, VIP table service.
 */
export const nightclubTheme: ThemePalette = {
  // Brand
  primary: '#C9A84C',
  primaryLight: '#E8C97F',
  primaryDark: '#9A7A2C',
  secondary: '#FF6B9D',
  secondaryLight: '#FFB3D1',

  // Backgrounds
  background: '#080808',
  backgroundElevated: '#111110',
  backgroundSurface: '#1C1A16',

  // Text
  text: '#F5F0E8',
  textSecondary: '#D4CCBB',
  textTertiary: '#9C9080',
  textInverse: '#080808',

  // Borders
  border: '#2C2A25',
  borderLight: '#3D3A32',
  borderFocus: '#C9A84C',

  // Status
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  info: '#3b82f6',
  infoLight: 'rgba(59, 130, 246, 0.15)',

  // Interactive
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.35)',
  ripple: 'rgba(201, 168, 76, 0.25)',

  // Navigation
  tabBackground: '#080808',
  tabIconDefault: '#9C9080',
  tabIconSelected: '#C9A84C',

  // Gradients
  gradientPrimary: ['#C9A84C', '#9A7A2C'],
  gradientCard: ['#1C1A16', '#111110'],
  gradientOverlay: ['transparent', 'rgba(8, 8, 8, 0.88)'],

  // Special
  inputBackground: '#1C1A16',
  cardBackground: '#111110',
  modalBackground: '#111110',
  statusBarStyle: 'light',
};

/**
 * Ocean Theme
 * Cool blue tones for a calm, professional feel
 */
export const oceanTheme: ThemePalette = {
  // Brand
  primary: '#0ea5e9',
  primaryLight: '#38bdf8',
  primaryDark: '#0284c7',
  secondary: '#06b6d4',
  secondaryLight: '#22d3ee',

  // Backgrounds
  background: '#0c1222',
  backgroundElevated: '#152238',
  backgroundSurface: '#1e3a5f',

  // Text
  text: '#ffffff',
  textSecondary: '#cbd5e1',
  textTertiary: '#94a3b8',
  textInverse: '#0c1222',

  // Borders
  border: '#334155',
  borderLight: '#475569',
  borderFocus: '#0ea5e9',

  // Status
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  info: '#38bdf8',
  infoLight: 'rgba(56, 189, 248, 0.15)',

  // Interactive
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  ripple: 'rgba(14, 165, 233, 0.3)',

  // Navigation
  tabBackground: '#0c1222',
  tabIconDefault: '#94a3b8',
  tabIconSelected: '#0ea5e9',

  // Gradients
  gradientPrimary: ['#0ea5e9', '#0284c7'],
  gradientCard: ['#1e3a5f', '#152238'],
  gradientOverlay: ['transparent', 'rgba(12, 18, 34, 0.9)'],

  // Special
  inputBackground: '#1e3a5f',
  cardBackground: '#152238',
  modalBackground: '#152238',
  statusBarStyle: 'light',
};

/**
 * Sunset Theme
 * Warm orange glow for an energetic vibe
 */
export const sunsetTheme: ThemePalette = {
  // Brand
  primary: '#f97316',
  primaryLight: '#fb923c',
  primaryDark: '#ea580c',
  secondary: '#f59e0b',
  secondaryLight: '#fbbf24',

  // Backgrounds
  background: '#1a0f0a',
  backgroundElevated: '#2d1810',
  backgroundSurface: '#422419',

  // Text
  text: '#ffffff',
  textSecondary: '#fcd9bd',
  textTertiary: '#c4a88a',
  textInverse: '#1a0f0a',

  // Borders
  border: '#5c3420',
  borderLight: '#7a4830',
  borderFocus: '#f97316',

  // Status
  success: '#22c55e',
  successLight: 'rgba(34, 197, 94, 0.15)',
  warning: '#fbbf24',
  warningLight: 'rgba(251, 191, 36, 0.15)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  info: '#3b82f6',
  infoLight: 'rgba(59, 130, 246, 0.15)',

  // Interactive
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  ripple: 'rgba(249, 115, 22, 0.3)',

  // Navigation
  tabBackground: '#1a0f0a',
  tabIconDefault: '#c4a88a',
  tabIconSelected: '#f97316',

  // Gradients
  gradientPrimary: ['#f97316', '#ea580c'],
  gradientCard: ['#422419', '#2d1810'],
  gradientOverlay: ['transparent', 'rgba(26, 15, 10, 0.9)'],

  // Special
  inputBackground: '#422419',
  cardBackground: '#2d1810',
  modalBackground: '#2d1810',
  statusBarStyle: 'light',
};

/**
 * Midnight Rose Theme
 * Vivid rose-to-violet gradient on deep near-black — energetic, club-forward.
 */
export const midnightTheme: ThemePalette = {
  // Brand
  primary: '#F43F5E',
  primaryLight: '#FB7185',
  primaryDark: '#E11D48',
  secondary: '#A855F7',
  secondaryLight: '#C084FC',

  // Backgrounds
  background: '#07060C',
  backgroundElevated: '#120F1A',
  backgroundSurface: '#1D1829',

  // Text
  text: '#FFF1F5',
  textSecondary: '#DDD0E4',
  textTertiary: '#9A8AA8',
  textInverse: '#07060C',

  // Borders
  border: '#2D2438',
  borderLight: '#42304F',
  borderFocus: '#F43F5E',

  // Status
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  info: '#60a5fa',
  infoLight: 'rgba(96, 165, 250, 0.15)',

  // Interactive
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.35)',
  ripple: 'rgba(244, 63, 94, 0.3)',

  // Navigation
  tabBackground: '#07060C',
  tabIconDefault: '#9A8AA8',
  tabIconSelected: '#F43F5E',

  // Gradients
  gradientPrimary: ['#F43F5E', '#A855F7'],
  gradientCard: ['#1D1829', '#120F1A'],
  gradientOverlay: ['transparent', 'rgba(7, 6, 12, 0.9)'],

  // Special
  inputBackground: '#1D1829',
  cardBackground: '#120F1A',
  modalBackground: '#120F1A',
  statusBarStyle: 'light',
};

/**
 * Daylight Theme
 * Light mode with pink accents - for users who prefer bright interfaces
 */
export const daylightTheme: ThemePalette = {
  // Brand
  primary: '#db2777',
  primaryLight: '#ec4899',
  primaryDark: '#be185d',
  secondary: '#9333ea',
  secondaryLight: '#a855f7',

  // Backgrounds
  background: '#ffffff',
  backgroundElevated: '#f9fafb',
  backgroundSurface: '#f3f4f6',

  // Text
  text: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6b7280',
  textInverse: '#ffffff',

  // Borders
  border: '#e5e7eb',
  borderLight: '#d1d5db',
  borderFocus: '#db2777',

  // Status
  success: '#059669',
  successLight: 'rgba(5, 150, 105, 0.1)',
  warning: '#d97706',
  warningLight: 'rgba(217, 119, 6, 0.1)',
  error: '#dc2626',
  errorLight: 'rgba(220, 38, 38, 0.1)',
  info: '#2563eb',
  infoLight: 'rgba(37, 99, 235, 0.1)',

  // Interactive
  overlay: 'rgba(0, 0, 0, 0.3)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
  ripple: 'rgba(219, 39, 119, 0.2)',

  // Navigation
  tabBackground: '#ffffff',
  tabIconDefault: '#6b7280',
  tabIconSelected: '#db2777',

  // Gradients
  gradientPrimary: ['#db2777', '#be185d'],
  gradientCard: ['#ffffff', '#f9fafb'],
  gradientOverlay: ['transparent', 'rgba(255, 255, 255, 0.9)'],

  // Special
  inputBackground: '#f3f4f6',
  cardBackground: '#ffffff',
  modalBackground: '#ffffff',
  statusBarStyle: 'dark',
};

// ============================================================================
// Theme Map
// ============================================================================

export const themes: Record<ThemeName, ThemePalette> = {
  nightclub: nightclubTheme,
  ocean: oceanTheme,
  sunset: sunsetTheme,
  midnight: midnightTheme,
  daylight: daylightTheme,
};

// ============================================================================
// Helper to get theme by name
// ============================================================================

export function getTheme(themeName: ThemeName): ThemePalette {
  return themes[themeName] || themes[DEFAULT_THEME];
}

// ============================================================================
// Available theme names for iteration
// ============================================================================

export const availableThemes: ThemeName[] = ['nightclub', 'ocean', 'sunset', 'midnight', 'daylight'];

// ============================================================================
// Legacy Colors Export (for backwards compatibility during migration)
// ============================================================================

export const Colors = {
  light: {
    text: daylightTheme.text,
    background: daylightTheme.background,
    tint: daylightTheme.primary,
    icon: daylightTheme.textTertiary,
    tabIconDefault: daylightTheme.tabIconDefault,
    tabIconSelected: daylightTheme.tabIconSelected,
  },
  dark: {
    text: nightclubTheme.text,
    background: nightclubTheme.background,
    tint: nightclubTheme.primary,
    icon: nightclubTheme.textTertiary,
    tabIconDefault: nightclubTheme.tabIconDefault,
    tabIconSelected: nightclubTheme.tabIconSelected,
  },
};

// ============================================================================
// Fonts (unchanged)
// ============================================================================

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
