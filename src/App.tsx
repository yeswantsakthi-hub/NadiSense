import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from './auth/authStore';
import { ChartIcon, CheckListIcon, GearIcon, HeartIcon, SparkIcon } from './components/icons';
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
import { Validation } from './screens/Validation';
import { useSensorStore } from './store/sensorStore';

const SCREENS: Record<Route, () => ReactNode> = {
  '/signin': () => <SignIn />,
  '/connect': () => <Connect />,
  '/dashboard': () => <Dashboard />,
  '/validate': () => <Validation />,
  '/ecg': () => <EcgCheck />,
  '/nadi': () => <NadiInsights />,
  '/history': () => <History />,
  '/report': () => <Report />,
  '/settings': () => <Settings />,
};

const NAV: { route: Route; label: MessageKey }[] = [
  { route: '/dashboard', label: 'nav.pulse' },
  { route: '/validate', label: 'nav.validate' },
  { route: '/nadi', label: 'nav.nadi' },
  { route: '/history', label: 'nav.history' },
  { route: '/settings', label: 'nav.settings' },
];

/** Screens that need a live connection; without one we send people to Connect. */
const NEEDS_SOURCE: Route[] = ['/dashboard', '/ecg', '/nadi'];
/** Full-screen pages without the header and tab bar. */
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
        <div key={route} className="screen-in">
          {SCREENS[route]()}
        </div>
      ) : (
        <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
          <AppHeader />
          {/* Re-keyed per route so each screen fades in. */}
          <main key={route} className="screen-in flex-1 px-4 pb-32">
            {SCREENS[route]()}
          </main>
          <TabBar route={route} />
        </div>
      )}
    </>
  );
}

function AppHeader() {
  return (
    <header className="flex h-14 items-center justify-between gap-3 px-4">
      <a href="#/dashboard" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
        <span aria-hidden className="size-2.5 rounded-full bg-signal shadow-[0_0_12px_var(--signal)]" />
        NadiSense
      </a>
      <LinkChip />
    </header>
  );
}

const TAB_ICON: Record<string, (p: { className?: string }) => ReactNode> = {
  '/dashboard': HeartIcon,
  '/validate': CheckListIcon,
  '/nadi': SparkIcon,
  '/history': ChartIcon,
  '/settings': GearIcon,
};

/** Floating icon tab bar, the same on phones and desktops. */
function TabBar({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <ul className="mx-auto flex max-w-xl rounded-[1.75rem] border border-line bg-panel/90 p-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {NAV.map(({ route: r, label }) => {
          const active = isActive(r, route);
          const Icon = TAB_ICON[r]!;
          return (
            <li key={r} className="min-w-0 flex-1">
              <a
                href={`#${r}`}
                aria-current={active ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-[1.4rem] px-0.5 text-center text-[11px] leading-tight font-medium transition-colors [overflow-wrap:anywhere] ${
                  active ? 'bg-panel-2 text-fg' : 'text-muted hover:text-label'
                }`}
              >
                <Icon className={`size-[22px] ${active ? 'text-signal' : ''}`} />
                {t(label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
