export type Route = '/signin' | '/connect' | '/dashboard' | '/ecg' | '/nadi' | '/history' | '/report' | '/settings';

export function navigate(route: Route): void {
  window.location.hash = route;
}

/** Public doctor link for a share token. */
export function shareUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/share/${token}`;
}

/** The token if the current hash is a doctor link (#/share/<token>), else null. */
export function readShareToken(): string | null {
  const match = /^#\/share\/([0-9a-f]{32})$/.exec(window.location.hash);
  return match ? match[1]! : null;
}
