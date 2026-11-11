import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from './auth/authStore';
import { ChartIcon, CheckListIcon, GearIcon, HeartIcon, SparkIcon } from './components/icons';
import { LinkChip } from './components/LinkChip';
import { Wordmark } from './components/Logo';
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
import { useSensorStore } from './store/sensorStore';
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
        <div className="flex min-h-dvh flex-col">
          <AppHeader route={route} />
          {/* The live screen uses the full width; other screens sit in a readable column. */}
          <main key={route} className="screen-in mx-auto w-full max-w-[1280px] flex-1 px-4 pt-5 pb-28 lg:px-6 lg:pt-6 lg:pb-10">
            {route === '/dashboard' ? (
              SCREENS[route]()
            ) : (
              <div className="mx-auto max-w-3xl">
                <PageTitle route={route} />
                {SCREENS[route]()}
              </div>
            )}
          </main>
          <TabBar route={route} />
        </div>
      )}
    </>
  );
}

/** Large page title for screens that don't draw their own. */
const TITLES: Partial<Record<Route, MessageKey>> = {
  '/history': 'nav.history',
  '/settings': 'nav.settings',
  '/accuracy': 'acc.title',
  '/diagnostics': 'diag.title',
  '/report': 'report.title',
};

function PageTitle({ route }: { route: Route }) {
  const { t } = useI18n();
  const key = TITLES[route];
  if (!key) return null;
  return <h1 className="mb-4 text-[28px] leading-tight font-semibold tracking-[-0.02em]">{t(key)}</h1>;
}

function AppHeader({ route }: { route: Route }) {
  const { t } = useI18n();
  const now = useNow();
  return (
    <header className="sticky top-0 z-20 -mx-0 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-6 px-4 lg:h-16 lg:px-6">
        <a href="#/dashboard" aria-label="NadiSense" className="shrink-0">
          <Wordmark />
        </a>
        <nav aria-label={t('nav.main')} className="hidden lg:block">
          <ul className="flex gap-1">
            {NAV.map(({ route: r, label }) => {
              const active = isActive(r, route);
              return (
                <li key={r}>
                  <a
                    href={`#${r}`}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                      active ? 'bg-white/[0.06] text-fg' : 'text-label hover:text-fg'
                    }`}
                  >
                    {t(label)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LinkChip />
          <time className="hidden font-mono text-[12px] text-muted sm:inline">{clockTime(now)}</time>
        </div>
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

/** Phone navigation: standard bottom bar; the active tab is saffron. */
function TabBar({ route }: { route: Route }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[#0d0f12]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
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
                className={`flex h-16 flex-col items-center justify-center gap-1 px-0.5 text-center text-[11px] leading-tight font-medium transition-colors [overflow-wrap:anywhere] ${
                  active ? 'text-brand' : 'text-muted hover:text-label'
                }`}
              >
                <Icon className="size-[22px]" />
                {t(label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
