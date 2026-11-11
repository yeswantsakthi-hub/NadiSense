import { useEffect, useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { useCloudStore } from '../cloud/cloudStore';
import { ConsentPanel } from '../components/CloudPanels';
import { BluetoothIcon, BoltIcon, PhoneIcon } from '../components/icons';
import { Masthead } from '../components/Masthead';
import { isMessageKey, useI18n, type MessageKey } from '../i18n';
import { navigate } from '../lib/route';
import { SIM_SCENARIOS } from '../ring/SimulatedRing';
import { browserBluetooth } from '../ring/webBluetooth';
import { scenarioKey, useSensorStore, type SourceKind } from '../store/sensorStore';

/** How to fix each pairing problem, shown under the error. */
const FIX: Partial<Record<MessageKey, MessageKey>> = {
  'err.ringNotFound': 'pair.fixNotFound',
  'err.blePermission': 'pair.fixPermission',
  'err.bluetoothOff': 'pair.fixBluetooth',
  'err.ringConnect': 'pair.fixConnect',
  'err.bleUnavailable': 'pair.fixBrowser',
};

/** Guided pairing: three checks, one big button, friendly errors, and a demo option. */
export function Connect() {
  const { t } = useI18n();
  const { status, error, kind, scenario, connect, setScenario } = useSensorStore();
  const account = useAuthStore((s) => s.account);
  const signOut = useAuthStore((s) => s.signOut);
  // Ask once, right after the first sign-in, what may be stored in the cloud.
  const askConsent = useCloudStore((s) => s.loaded && s.consent.decidedAt === null) && account !== null;
  const connecting = status === 'connecting';
  const bluetooth = browserBluetooth() !== undefined;
  const [showDemo, setShowDemo] = useState(false);

  const start = async (k: SourceKind) => {
    if (await connect(k)) navigate('/dashboard');
  };

  // A ring paired earlier can often reconnect without the chooser.
  useEffect(() => {
    useSensorStore
      .getState()
      .restore()
      .then((ok) => ok && navigate('/dashboard'));
  }, []);

  const steps: { icon: typeof BoltIcon; title: MessageKey; hint: MessageKey }[] = [
    { icon: BoltIcon, title: 'pair.step1', hint: 'pair.step1Hint' },
    { icon: BluetoothIcon, title: 'pair.step2', hint: 'pair.step2Hint' },
    { icon: PhoneIcon, title: 'pair.step3', hint: 'pair.step3Hint' },
  ];
  const errorKey = error && isMessageKey(error) ? error : null;
  const fix = errorKey ? FIX[errorKey] : undefined;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8">
      <Masthead
        active={connecting}
        title={connecting && kind === 'ring' ? t('pair.searching') : t('pair.title')}
        subtitle={t('pair.subtitle')}
      />

      <div className="mt-3 surface rounded-2xl px-3.5 pt-1 pb-1">
      <ol className="divide-y divide-line">
        {steps.map(({ icon: Icon, title, hint }, i) => (
          <li key={title} className="flex items-start gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                <span className="sr-only">{i + 1}. </span>
                {t(title)}
              </span>
              <span className="block text-xs leading-relaxed text-muted">{t(hint)}</span>
            </span>
          </li>
        ))}
      </ol>
      </div>

      {askConsent && (
        <div className="mt-4">
          <ConsentPanel firstTime />
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-alert/50 bg-alert/10 px-4 py-3">
          <p className="text-sm font-medium text-alert">{errorKey ? t(errorKey) : error}</p>
          {fix && <p className="mt-1 text-xs leading-relaxed text-label">{t(fix)}</p>}
        </div>
      )}

      <button
        type="button"
        disabled={connecting || !bluetooth}
        onClick={() => start('ring')}
        className="mt-5 h-14 w-full rounded-xl btn-primary text-base font-semibold text-brand-ink transition hover:btn-primary/90 disabled:opacity-50"
      >
        {connecting && kind === 'ring' ? t('pair.searching') : error ? t('pair.retry') : t('connect.pair')}
      </button>
      {!bluetooth && <p className="mt-2 text-center text-xs text-amber">{t('connect.noBluetooth')}</p>}

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {t('pair.or')}
        <span className="h-px flex-1 bg-line" />
      </div>

      {!showDemo ? (
        <button
          type="button"
          onClick={() => setShowDemo(true)}
          className="h-12 w-full rounded-xl bg-white/[0.04] text-sm font-semibold ring-1 ring-line-strong transition hover:bg-white/[0.07]"
        >
          {t('pair.tryDemo')}
        </button>
      ) : (
        <div className="surface rounded-2xl p-4">
          <p className="text-sm font-medium">{t('connect.demo')}</p>
          <p className="mt-0.5 text-xs text-muted">{t('pair.demoHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('connect.scenario')}>
            {SIM_SCENARIOS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === scenario}
                onClick={() => setScenario(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  s === scenario ? 'border border-brand/60 bg-brand/12 text-brand' : 'border border-line text-label hover:text-fg'
                }`}
              >
                {t(scenarioKey(s))}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={connecting}
            onClick={() => start('sim')}
            className="mt-4 h-12 w-full rounded-xl bg-panel-2 text-sm font-semibold transition hover:bg-line-strong disabled:opacity-60"
          >
            {connecting && kind === 'sim' ? t('connect.starting') : t('connect.useDemo')}
          </button>
        </div>
      )}

      <div className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-muted">
        <p>{t('app.disclaimer')}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 text-label underline decoration-line-strong underline-offset-4 hover:text-fg"
        >
          {account ? t('settings.signOut') : t('auth.signIn')}
        </button>
      </div>
    </div>
  );
}
