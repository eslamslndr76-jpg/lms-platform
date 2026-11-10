/**
 * Open-redirect-safe navigation helpers.
 *
 * Protected pages send the visitor to `loginUrl()`, and login/register send
 * them back with `postLoginTarget()`. Only same-origin absolute paths are
 * accepted, so `?next=https://evil.example` or `//evil.example` falls back to
 * the dashboard.
 */

/** `/login?next=<current internal path>` (or plain `/login` on the server). */
export function loginUrl(): string {
  if (typeof window === 'undefined') return '/login';
  const current = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(current)}`;
}

/** The `?next=` target when it is a safe internal path, otherwise `/dashboard`. */
export function postLoginTarget(search: string): string {
  const next = new URLSearchParams(search).get('next');
  if (!next) return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return '/dashboard';
  return next;
}
