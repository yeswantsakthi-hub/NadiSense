import { useEffect, useState, type ReactNode } from 'react';
import { useSensorStore } from './store/sensorStore';
import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { EcgCheck } from './screens/EcgCheck';
import { NadiInsights } from './screens/NadiInsights';
import { History } from './screens/History';
import { Report } from './screens/Report';
import { Settings } from './screens/Settings';
import type { Route } from './lib/route';

const SCREENS: Record<Route, () => ReactNode> = {
  '/connect': () => <Connect />,
  '/dashboard': () => <Dashboard />,
  '/ecg': () => <EcgCheck />,
  '/nadi': () => <NadiInsights />,
  '/history': () => <History />,
  '/report': () => <Report />,
  '/settings': () => <Settings />,
};

const NAV: { route: Route; label: string }[] = [
  { route: '/dashboard', label: 'Pulse' },
  { route: '/ecg', label: 'ECG' },
  { route: '/nadi', label: 'Nadi' },
  { route: '/history', label: 'History' },
  { route: '/settings', label: 'Settings' },
];

/** Screens that need a live connection; without one we send people to Connect. */
const NEEDS_SOURCE: Route[] = ['/dashboard', '/ecg', '/nadi'];

function readRoute(): Route | null {
  const path = window.location.hash.slice(1);
  return path in SCREENS ? (path as Route) : null;
}

/** Hash routing keeps the app a static bundle that works offline and from any path. */
function useRoute(): Route {
  const connected = useSensorStore((s) => s.status === 'connected');
  const [route, setRoute] = useState<Route | null>(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  if (!route) return connected ? '/dashboard' : '/connect';
  if (!connected && NEEDS_SOURCE.includes(route)) return '/connect';
  return route;
}

export default function App() {
  const route = useRoute();
  const showNav = route !== '/connect';

  useEffect(() => {
    if (window.location.hash.slice(1) !== route) window.history.replaceState(null, '', `#${route}`);
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <main className={`flex-1 ${showNav ? 'pb-20' : ''}`}>{SCREENS[route]()}</main>
      {showNav && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          <ul className="mx-auto flex max-w-[480px]">
            {NAV.map(({ route: r, label }) => {
              const active = r === route || (r === '/history' && route === '/report');
              return (
                <li key={r} className="flex-1">
                  <a
                    href={`#${r}`}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex h-14 items-center justify-center text-sm font-medium ${
                      active ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className={`absolute top-0 h-0.5 w-8 ${r === '/nadi' ? 'bg-turmeric' : 'bg-signal'}`}
                      />
                    )}
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
