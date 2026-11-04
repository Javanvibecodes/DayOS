export type ThemeColor = 'midnight' | 'paper' | 'forest' | 'aurora';
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemePalette {
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
}

/**
 * Per-theme palettes for both interface modes. Light palettes share the same
 * neutral surfaces (matching `html.light` in index.css) and differ by accent
 * colors, so switching themes visibly changes the accent in light mode.
 */
export const THEME_PALETTES: Record<ThemeColor, { dark: ThemePalette; light: ThemePalette }> = {
  midnight: {
    dark: {
      primary: '#c0c1ff', primaryContainer: '#8083ff', onPrimary: '#1000a9', onPrimaryContainer: '#0d0096',
      secondary: '#ddb7ff', background: '#131315', surface: '#131315',
      surfaceContainerLow: '#1c1b1d', surfaceContainer: '#201f22', surfaceContainerHigh: '#2a2a2c',
      onSurface: '#e5e1e4', onSurfaceVariant: '#c7c4d7', outlineVariant: '#464554',
    },
    light: {
      primary: '#5b5fbe', primaryContainer: '#e0e1ff', onPrimary: '#ffffff', onPrimaryContainer: '#1000a9',
      secondary: '#7d6bd1', background: '#f6f5f9', surface: '#f6f5f9',
      surfaceContainerLow: '#eeedf2', surfaceContainer: '#e8e7ed', surfaceContainerHigh: '#dddce4',
      onSurface: '#1b1b1f', onSurfaceVariant: '#46464f', outlineVariant: '#c7c6d0',
    },
  },
  paper: {
    dark: {
      primary: '#5b5f9f', primaryContainer: '#e0e0ff', onPrimary: '#ffffff', onPrimaryContainer: '#1a1a4e',
      secondary: '#7c4da0', background: '#f6f5f9', surface: '#f6f5f9',
      surfaceContainerLow: '#eeedf2', surfaceContainer: '#e8e7ed', surfaceContainerHigh: '#dddce4',
      onSurface: '#1b1b1f', onSurfaceVariant: '#46464f', outlineVariant: '#c7c6d0',
    },
    light: {
      primary: '#5b5f9f', primaryContainer: '#e0e0ff', onPrimary: '#ffffff', onPrimaryContainer: '#1a1a4e',
      secondary: '#7c4da0', background: '#f6f5f9', surface: '#f6f5f9',
      surfaceContainerLow: '#eeedf2', surfaceContainer: '#e8e7ed', surfaceContainerHigh: '#dddce4',
      onSurface: '#1b1b1f', onSurfaceVariant: '#46464f', outlineVariant: '#c7c6d0',
    },
  },
  forest: {
    dark: {
      primary: '#6dbf8a', primaryContainer: '#1f4d33', onPrimary: '#ffffff', onPrimaryContainer: '#d4f5e0',
      secondary: '#8fd4a8', background: '#0f1612', surface: '#0f1612',
      surfaceContainerLow: '#162019', surfaceContainer: '#1a2720', surfaceContainerHigh: '#22332a',
      onSurface: '#e0ebe4', onSurfaceVariant: '#b0c4b8', outlineVariant: '#3d5248',
    },
    light: {
      primary: '#2e7d4f', primaryContainer: '#d4f5e0', onPrimary: '#ffffff', onPrimaryContainer: '#1f4d33',
      secondary: '#4a9a6b', background: '#f6f5f9', surface: '#f6f5f9',
      surfaceContainerLow: '#eeedf2', surfaceContainer: '#e8e7ed', surfaceContainerHigh: '#dddce4',
      onSurface: '#1b1b1f', onSurfaceVariant: '#46464f', outlineVariant: '#c7c6d0',
    },
  },
  aurora: {
    dark: {
      primary: '#7dd3fc', primaryContainer: '#0e7490', onPrimary: '#082f49', onPrimaryContainer: '#e0f2fe',
      secondary: '#a78bfa', background: '#0c0a14', surface: '#0c0a14',
      surfaceContainerLow: '#14121f', surfaceContainer: '#1a1728', surfaceContainerHigh: '#252136',
      onSurface: '#e8e6f0', onSurfaceVariant: '#c0bcd4', outlineVariant: '#4a4560',
    },
    light: {
      primary: '#0e7490', primaryContainer: '#d3f0fb', onPrimary: '#ffffff', onPrimaryContainer: '#082f49',
      secondary: '#7c5cd6', background: '#f6f5f9', surface: '#f6f5f9',
      surfaceContainerLow: '#eeedf2', surfaceContainer: '#e8e7ed', surfaceContainerHigh: '#dddce4',
      onSurface: '#1b1b1f', onSurfaceVariant: '#46464f', outlineVariant: '#c7c6d0',
    },
  },
};

export function resolveColorMode(mode: ThemeMode | string): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode === 'light' ? 'light' : 'dark';
}

/** Apply a palette as inline CSS custom-property overrides on <html>. */
function applyPalette(p: ThemePalette) {
  const s = document.documentElement.style;
  s.setProperty('--primary', p.primary);
  s.setProperty('--primary-container', p.primaryContainer);
  s.setProperty('--on-primary', p.onPrimary);
  s.setProperty('--on-primary-container', p.onPrimaryContainer);
  s.setProperty('--secondary', p.secondary);
  s.setProperty('--background', p.background);
  s.setProperty('--surface', p.surface);
  s.setProperty('--surface-container-low', p.surfaceContainerLow);
  s.setProperty('--surface-container', p.surfaceContainer);
  s.setProperty('--surface-container-high', p.surfaceContainerHigh);
  s.setProperty('--surface-container-highest', p.surfaceContainerHigh);
  s.setProperty('--on-surface', p.onSurface);
  s.setProperty('--on-background', p.onSurface);
  s.setProperty('--on-surface-variant', p.onSurfaceVariant);
  s.setProperty('--outline-variant', p.outlineVariant);
  document.body.style.backgroundColor = p.background;
  document.body.style.color = p.onSurface;
}

/** Set the light/dark class on <html> and apply the selected theme's palette. */
export function applyAppearance(mode: ThemeMode | string, theme: string) {
  const root = document.documentElement;
  const resolved = resolveColorMode(mode);
  const paletteKey: ThemeColor = theme in THEME_PALETTES ? (theme as ThemeColor) : 'midnight';

  if (resolved === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    applyPalette(THEME_PALETTES[paletteKey].light);
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
    applyPalette(THEME_PALETTES[paletteKey].dark);
  }
}
