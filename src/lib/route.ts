export type Route = '/signin' | '/connect' | '/dashboard' | '/ecg' | '/nadi' | '/history' | '/report' | '/settings';

export function navigate(route: Route): void {
  window.location.hash = route;
}
