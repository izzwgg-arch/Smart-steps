/**
 * Material Design 3 Theme Configuration
 * 
 * Matches the desktop app's color scheme with Material Design 3 principles
 */

import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Primary color matches desktop app's blue gradient (#0066cc)
export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0066cc',
    primaryContainer: '#e0f2fe',
    secondary: '#004499',
    secondaryContainer: '#bae6fd',
    tertiary: '#00aaff',
    surface: '#ffffff',
    surfaceVariant: '#f8fafc',
    background: '#ffffff',
    error: '#dc2626',
    errorContainer: '#fee2e2',
    onPrimary: '#ffffff',
    onPrimaryContainer: '#0369a1',
    onSecondary: '#ffffff',
    onSecondaryContainer: '#0369a1',
    onSurface: '#1e293b',
    onSurfaceVariant: '#475569',
    onBackground: '#1e293b',
    onError: '#ffffff',
    outline: '#e2e8f0',
    outlineVariant: '#cbd5e1',
    shadow: '#000000',
    text: '#1e293b',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
  },
  // Custom spacing for touch targets (minimum 48dp)
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48, // Minimum touch target size
  },
  // Border radius for cards and components
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
  // Elevation for Material Design shadows
  elevation: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 12,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#0066cc',
    primaryContainer: '#004499',
    secondary: '#00aaff',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    background: '#0f172a',
    error: '#ef4444',
    onPrimary: '#ffffff',
    onSurface: '#f1f5f9',
    onBackground: '#f1f5f9',
  },
};

export default theme;
