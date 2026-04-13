// Centralizes persisted brand defaults, org accent swatches, and theme-aware fallbacks for workspace accents.
export const DEFAULT_BRAND_PRIMARY_HEX = '#6366f1';
export const DEFAULT_THEME_ACCENT = 'var(--app-accent)';
export const ORGANIZATION_ACCENT_SWATCHES = [
  '#6366f1',
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#0f766e',
  '#059669',
  '#d97706',
  '#dc2626',
] as const;

export function resolveAccentColor(color?: string | null) {
  return color || DEFAULT_THEME_ACCENT;
}

export function resolvePersistedAccentColor(color?: string | null) {
  return color?.trim() || DEFAULT_BRAND_PRIMARY_HEX;
}
