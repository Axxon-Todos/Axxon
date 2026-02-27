// used as a wrapper to pass through core info on endpoints
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    credentials: 'include',
    ...init,
  });
}
