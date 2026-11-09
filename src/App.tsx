import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from './auth/authStore';
import { LinkChip } from './components/LinkChip';
import { SessionMonitor } from './components/SessionMonitor';
import { useDocumentLang, useI18n, type MessageKey } from './i18n';

import { readShareToken, type Route } from './lib/route';

import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { EcgCheck } from './screens/EcgCheck';
import { History } from './screens/History';
import { NadiInsights } from './screens/NadiInsights';
import { Report } from './screens/Report';
import { Settings } from './screens/Settings';
import { ShareView } from './screens/ShareView';
import { SignIn } from './screens/SignIn';
import { useSensorStore } from './store/sensorStore';

const SCREENS: Record<Route, () => ReactNode> = {
  '/signin': () => <SignIn />,
  '/connect': () => <Connect />,
  '/dashboard': () => <Dashboard />,
  '/ecg': () => <EcgCheck />,
  '/nadi': () => <NadiInsights />,
  '/history': () => <History />,
  '/report': () => <Report />,
  '/settings': () => <Settings />,
};

const NAV: { route: Route; label: MessageKey }[] = [
  { route: '/dashboard', label: 'nav.pulse' },
  { route: '/ecg', label: 'nav.ecg' },
  { route: '/nadi', label: 'nav.nadi' },
  { route: '/history', label: 'nav.history' },
  { route: '/settings', label: 'nav.settings' },
];

/** Screens that need a live connection; without one we send people to Connect. */
const NEEDS_SOURCE: Route[] = ['/dashboard', '/ecg', '/nadi'];
/** Full-screen pages without the console header and tabs. */
const BARE: Route[] = ['/signin', '/connect'];

function readRoute(): Route | null {
  const path = window.location.hash.slice(1);
  return path in SCREENS ? (path as Route) : null;
}

/** Hash routing keeps the app a static bundle that works offline and from any path. */
function useRoute(): Route {
  const authStatus = useAuthStore((s) => s.status);
  // A ring that is reconnecting still counts: keep the person on their screen.
  const connected = useSensorStore((s) => s.source !== null);
  const [route, setRoute] = useState<Route | null>(readRoute);

  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const home: Route = connected ? '/dashboard' : '/connect';
  if (authStatus !== 'signedIn' && authStatus !== 'guest') return '/signin';
  if (!route || route === '/signin') return home;
  if (!connected && NEEDS_SOURCE.includes(route)) return '/connect';
  return route;
}

function isActive(navRoute: Route, route: Route): boolean {
  return navRoute === route || (navRoute === '/history' && route === '/report');
}

/** Doctor links (#/share/<token>) are public pages outside the sign-in gate. */
function useShareToken(): string | null {
  const [token, setToken] = useState(readShareToken);
  useEffect(() => {
    const onChange = () => setToken(readShareToken());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return token;
}

export default function App() {
  const shareToken = useShareToken();
  useDocumentLang();
  return shareToken ? <ShareView token={shareToken} /> : <MainApp />;
}

function MainApp() {
  const route = useRoute();

  useEffect(() => {
    if (window.location.hash.slice(1) !== route) window.history.replaceState(null, '', `#${route}`);
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <>
      <SessionMonitor />
      {BARE.includes(route) ? (
        SCREENS[route]()
      ) : (
        <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col">
          <AppHeader route={route} />
          <main className="flex-1 px-3 pb-24 lg:px-4 lg:pb-6">{SCREENS[route]()}</main>
          <BottomNav route={route} />
        </div>
      )}
    </>
  );
}

function AppHeader({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <header className="flex h-12 items-center justify-between gap-3 px-3 lg:grid lg:h-14 lg:grid-cols-[1fr_auto_1fr] lg:px-4">
      <div className="hidden min-w-0 lg:block">
        <nav aria-label={t('nav.main')}>
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
                    {t(label)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <a href="#/dashboard" className="keep-tracking font-mono text-sm font-semibold tracking-[0.42em] text-fg lg:text-base">
        NADI<span className="text-signal">SENSE</span>
      </a>
      <div className="flex justify-end">
        <LinkChip />
      </div>
    </header>
  );
}

function BottomNav({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-[600px]">
        {NAV.map(({ route: r, label }) => {
          const active = isActive(r, route);
          return (
            <li key={r} className="min-w-0 flex-1">
              <a
                href={`#${r}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 items-center justify-center px-0.5 text-center text-[11px] leading-tight [overflow-wrap:anywhere] font-semibold tracking-[0.1em] uppercase ${
                  active ? 'text-fg' : 'text-muted'
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className={`absolute top-0 h-0.5 w-8 ${r === '/nadi' ? 'bg-turmeric' : 'bg-signal'}`}
                  />
                )}
                {t(label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
