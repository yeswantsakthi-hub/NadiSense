import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from './auth/authStore';
import { ChartIcon, CheckListIcon, GearIcon, HeartIcon, SparkIcon } from './components/icons';
import { LinkChip } from './components/LinkChip';
import { SessionMonitor } from './components/SessionMonitor';
import { useDocumentLang, useI18n, type MessageKey } from './i18n';

import { readShareToken, type Route } from './lib/route';

import { Connect } from './screens/Connect';
import { Dashboard } from './screens/Dashboard';
import { Diagnostics } from './screens/Diagnostics';
import { EcgCheck } from './screens/EcgCheck';
import { History } from './screens/History';
import { NadiInsights } from './screens/NadiInsights';
import { Report } from './screens/Report';
import { Settings } from './screens/Settings';
import { ShareView } from './screens/ShareView';
import { SignIn } from './screens/SignIn';
import { Validation } from './screens/Validation';
import { scenarioKey, useSensorStore } from './store/sensorStore';
import { clockTime } from './lib/format';
import { useNow } from './lib/useNow';

// Chart-heavy screens load on demand so the live screens open fast.
const Accuracy = lazy(() => import('./screens/Accuracy').then((m) => ({ default: m.Accuracy })));

const SCREENS: Record<Route, () => ReactNode> = {
  '/signin': () => <SignIn />,
  '/connect': () => <Connect />,
  '/dashboard': () => <Dashboard />,
  '/validate': () => <Validation />,
  '/accuracy': () => (
    <Suspense fallback={null}>
      <Accuracy />
    </Suspense>
  ),
  '/ecg': () => <EcgCheck />,
  '/nadi': () => <NadiInsights />,
  '/history': () => <History />,
  '/report': () => <Report />,
  '/settings': () => <Settings />,
  '/diagnostics': () => <Diagnostics />,
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
  return navRoute === route || (navRoute === '/history' && route === '/report') || (navRoute === '/validate' && route === '/accuracy') || (navRoute === '/settings' && route === '/diagnostics');
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
        <div className="mx-auto flex min-h-dvh max-w-[1320px] flex-col">
          <AppHeader route={route} />
          {/* The console uses the full width; other screens sit in a readable column. */}
          <main key={route} className="screen-in flex-1 px-3 pb-24 lg:px-4 lg:pb-6">
            {route === '/dashboard' ? SCREENS[route]() : <div className="mx-auto max-w-3xl">{SCREENS[route]()}</div>}
          </main>
          <TabBar route={route} />
        </div>
      )}
    </>
  );
}

function AppHeader({ route }: { route: Route }) {
  const { t } = useI18n();
  const now = useNow();
  const { kind, scenario, source } = useSensorStore();
  const context = !source
    ? t('link.offline')
    : kind === 'sim'
      ? t('home.sim', { scenario: t(scenarioKey(scenario)) })
      : t('home.live');
  return (
    <header className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 lg:h-12 lg:px-4">
      <div className="min-w-0">
        <p className="hidden truncate text-[11px] text-muted sm:block lg:hidden">{context}</p>
        <nav aria-label={t('nav.main')} className="hidden lg:block">
          <ul className="flex gap-4">
            {NAV.map(({ route: r, label }) => (
              <li key={r}>
                <a
                  href={`#${r}`}
                  aria-current={isActive(r, route) ? 'page' : undefined}
                  className={`label transition-colors ${isActive(r, route) ? '!text-fg' : '!text-muted hover:!text-fg'}`}
                >
                  {t(label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <a href="#/dashboard" className="keep-tracking text-[13px] font-medium tracking-[0.32em] text-fg lg:text-[15px]">
        NADISENSE
      </a>
      <div className="flex items-center justify-end gap-3">
        <span className="hidden truncate text-[11px] text-muted lg:inline">{context}</span>
        <LinkChip />
        <time className="hidden font-mono text-[11px] text-muted sm:inline">{clockTime(now)}</time>
      </div>
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

/** Phone navigation: dark bar, icon over a small uppercase label. Hidden on desktop (tabs in the header). */
function TabBar({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {NAV.map(({ route: r, label }) => {
          const active = isActive(r, route);
          const Icon = TAB_ICON[r]!;
          return (
            <li key={r} className="min-w-0 flex-1">
              <a
                href={`#${r}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-center text-[10px] leading-tight font-medium tracking-[0.06em] uppercase [overflow-wrap:anywhere] ${
                  active ? 'text-fg' : 'text-muted'
                }`}
              >
                {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 bg-signal" />}
                <Icon className={`size-5 ${active ? 'text-signal' : ''}`} />
                {t(label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
