import { useAuthStore } from '../auth/authStore';
import { useCloudStore } from '../cloud/cloudStore';
import { ConsentPanel } from '../components/CloudPanels';
import { Masthead } from '../components/Masthead';
import { Panel, Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { isWebBluetoothAvailable } from '../data/BleSource';
import { SCENARIOS } from '../data/mockModel';
import { isMessageKey, useI18n } from '../i18n';
import { navigate } from '../lib/route';
import { scenarioKey, useSensorStore, type SourceKind } from '../store/sensorStore';

export function Connect() {
  const { t } = useI18n();
  const { status, error, kind, scenario, connect, setScenario } = useSensorStore();
  const account = useAuthStore((s) => s.account);
  const signOut = useAuthStore((s) => s.signOut);
  // Ask once, right after the first sign-in, what may be stored in the cloud.
  const askConsent = useCloudStore((s) => s.loaded && s.consent.decidedAt === null) && account !== null;
  const connecting = status === 'connecting';
  const bluetooth = isWebBluetoothAvailable();

  const start = async (k: SourceKind) => {
    if (await connect(k)) navigate('/dashboard');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-10 pb-8">
      <Masthead caption={t('connect.awaiting')} />

      {askConsent && (
        <div className="mt-3">
          <ConsentPanel firstTime />
        </div>
      )}

      <Panel
        label={t('connect.selectSource')}
        aside={account?.name ? <span className="text-label">{t('auth.welcome', { name: account.name })}</span> : undefined}
        className="mt-3"
      >
        <div className="space-y-3">
          <button
            type="button"
            disabled={connecting}
            onClick={() => start('ble')}
            className="group flex w-full items-center gap-3 rounded-[3px] border border-signal/60 bg-signal/10 p-3 text-left transition-colors hover:bg-signal/15 disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{t('connect.pair')}</span>
                <Tag tone="signal">{t('connect.bluetooth')}</Tag>
              </span>
              <span className="mt-0.5 block text-xs text-label">
                {bluetooth ? t('connect.pairHint') : t('connect.noBluetooth')}
              </span>
            </span>
            <span aria-hidden className="font-mono text-signal">
              {connecting && kind === 'ble' ? '···' : '→'}
            </span>
          </button>

          <div className="rounded-[3px] border border-line p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t('connect.demo')}</span>
              <Tag tone="label">{t('connect.noRingNeeded')}</Tag>
            </div>
            <Segmented
              legend={t('connect.scenario')}
              value={scenario}
              options={SCENARIOS.map((s) => ({ value: s, label: t(scenarioKey(s)) }))}
              onChange={setScenario}
            />
            <button
              type="button"
              disabled={connecting}
              onClick={() => start('mock')}
              className="mt-3 h-11 w-full rounded-[3px] border border-line-strong font-semibold transition-colors hover:border-fg/60 disabled:opacity-60"
            >
              {connecting && kind === 'mock' ? t('connect.starting') : t('connect.useDemo')}
            </button>
          </div>

          {error && (
            <p role="alert" className="border-l-2 border-alert pl-3 text-sm text-alert">
              {isMessageKey(error) ? t(error) : error}
            </p>
          )}
        </div>
      </Panel>

      <div className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-muted">
        <p>
          {t('app.disclaimer')}
          <br />
          {t('app.dataLocal')}
        </p>
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
