// Centralizes persisted brand defaults, org accent swatches, and theme-aware fallbacks for workspace accents.
export const DEFAULT_BRAND_PRIMARY_HEX = '#737373';
export const DEFAULT_THEME_ACCENT = 'var(--app-accent)';
export const ORGANIZATION_ACCENT_SWATCHES = [
  '#272727',
  '#404040',
  '#5a5a5a',
  '#737373',
  '#8c8c8c',
  '#a3a3a3',
  '#bcbcbc',
  '#d4d4d4',
] as const;

export function resolveAccentColor(color?: string | null) {
  return color || DEFAULT_THEME_ACCENT;
}

export function resolvePersistedAccentColor(color?: string | null) {
  return color?.trim() || DEFAULT_BRAND_PRIMARY_HEX;
}
