export type Route = '/connect' | '/dashboard' | '/ecg' | '/nadi' | '/history' | '/report' | '/settings';

export function navigate(route: Route): void {
  window.location.hash = route;
}
