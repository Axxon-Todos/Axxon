// Provides a minimal browser-only redirect helper for client-side external navigation.
export function redirectBrowserTo(url: string) {
  window.location.assign(url);
}
