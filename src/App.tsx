import { useEffect, useState, type ReactNode } from 'react';
import { SessionMonitor } from './components/SessionMonitor';
import { clockTime } from './lib/format';
import type { Route } from './lib/route';
import { useNow } from './lib/useNow';
import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { EcgCheck } from './screens/EcgCheck';
import { History } from './screens/History';
import { NadiInsights } from './screens/NadiInsights';
import { Report } from './screens/Report';
import { Settings } from './screens/Settings';
import { SCENARIO_LABELS, useSensorStore } from './store/sensorStore';

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

function isActive(navRoute: Route, route: Route): boolean {
  return navRoute === route || (navRoute === '/history' && route === '/report');
}

export default function App() {
  const route = useRoute();
  const shell = route !== '/connect';

  useEffect(() => {
    if (window.location.hash.slice(1) !== route) window.history.replaceState(null, '', `#${route}`);
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <>
      <SessionMonitor />
      {shell ? (
        <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col">
          <AppHeader route={route} />
          <main className="flex-1 px-3 pb-24 lg:px-4 lg:pb-6">{SCREENS[route]()}</main>
          <BottomNav route={route} />
        </div>
      ) : (
        SCREENS[route]()
      )}
    </>
  );
}

function AppHeader({ route }: { route: Route }) {
  const now = useNow();
  const { kind, scenario, status } = useSensorStore();
  const context =
    status !== 'connected' ? 'No ring connected' : kind === 'mock' ? `Demo ring · ${SCENARIO_LABELS[scenario]}` : 'NadiSense ring';

  return (
    <header className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-4 px-3 lg:h-14 lg:px-4">
      <div className="min-w-0">
        <p className="hidden truncate text-[11px] text-label sm:block lg:hidden">{context}</p>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex gap-5">
            {NAV.map(({ route: r, label }) => {
              const active = isActive(r, route);
              return (
                <li key={r}>
                  <a
                    href={`#${r}`}
                    aria-current={active ? 'page' : undefined}
                    className={`label !text-[11px] transition-colors ${
                      active ? (r === '/nadi' ? '!text-turmeric' : '!text-fg') : '!text-muted hover:!text-fg'
                    }`}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <a href="#/dashboard" className="font-mono text-sm font-semibold tracking-[0.42em] text-fg lg:text-base">
        NADISENSE
      </a>
      <div className="flex items-center justify-end gap-4 text-[11px] text-label">
        <span className="hidden truncate lg:inline">{context}</span>
        <time className="font-mono text-muted tabular-nums">{clockTime(now)}</time>
      </div>
    </header>
  );
}

function BottomNav({ route }: { route: Route }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-[600px]">
        {NAV.map(({ route: r, label }) => {
          const active = isActive(r, route);
          return (
            <li key={r} className="flex-1">
              <a
                href={`#${r}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 items-center justify-center text-[11px] font-semibold tracking-[0.1em] uppercase ${
                  active ? 'text-fg' : 'text-muted'
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
  );
}
