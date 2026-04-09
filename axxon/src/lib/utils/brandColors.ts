// Centralizes persisted brand defaults and theme-aware accent fallbacks for the indigo/cyan foundation.
export const DEFAULT_BRAND_PRIMARY_HEX = '#6366f1';
export const DEFAULT_THEME_ACCENT = 'var(--app-accent)';

export function resolveAccentColor(color?: string | null) {
  return color || DEFAULT_THEME_ACCENT;
}

export function resolvePersistedAccentColor(color?: string | null) {
  return color?.trim() || DEFAULT_BRAND_PRIMARY_HEX;
}
