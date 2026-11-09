import { useAuthStore } from '../auth/authStore';
import { ConsentPanel, DataPanel, ProfilePanel } from '../components/CloudPanels';
import { LanguagePicker } from '../components/LanguagePicker';
import { Panel, Tag, type Tone } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { SIM_SCENARIOS } from '../ring/SimulatedRing';
import { isMessageKey, useI18n, type MessageKey } from '../i18n';
import { scenarioKey, useSensorStore, type ConnectionStatus, type SourceKind } from '../store/sensorStore';

const STATUS: Record<ConnectionStatus, { key: MessageKey; tone: Tone }> = {
  connected: { key: 'settings.connected', tone: 'signal' },
  connecting: { key: 'settings.connecting', tone: 'label' },
  reconnecting: { key: 'link.reconnecting', tone: 'amber' },
  disconnected: { key: 'settings.offline', tone: 'muted' },
};

export function Settings() {
  const { t } = useI18n();
  const { kind, scenario, status, error, source, setKind, setScenario, connect, disconnect } = useSensorStore();
  const { account, signOut } = useAuthStore();

  return (
    <div className="mx-auto grid max-w-4xl gap-3 pt-2 md:grid-cols-2">
      <div className="space-y-3">
        <Panel label={t('settings.account')}>
          {account ? (
            <>
              <p className="text-xs text-label">{t('settings.signedInAs')}</p>
              <p className="mt-0.5 font-semibold">{account.name || account.email}</p>
              {account.name && <p className="font-mono text-xs text-muted">{account.email}</p>}
            </>
          ) : (
            <p className="text-sm text-muted">{t('settings.noAccount')}</p>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-3 h-10 w-full rounded-xl border border-line-strong text-sm font-semibold transition-colors hover:border-fg/60"
          >
            {account ? t('settings.signOut') : t('auth.signIn')}
          </button>
        </Panel>

        <Panel label={t('lang.label')}>
          <LanguagePicker compact />
        </Panel>

        <Panel label={t('settings.about')} className="border-amber/40">
          <p className="text-sm font-semibold">{t('app.disclaimer')}</p>
          <p className="mt-1 text-xs text-label">{t('settings.aboutBody')}</p>
        </Panel>

        {account ? (
          <>
            <ConsentPanel />
            <DataPanel />
          </>
        ) : (
          <Panel label={t('cloud.title')}>
            <p className="text-sm text-muted">{t('cloud.guest')}</p>
          </Panel>
        )}
      </div>

      <div className="space-y-3">
        {account && <ProfilePanel />}
        <Panel label={t('settings.dataSource')} aside={<Tag tone={STATUS[status].tone}>{t(STATUS[status].key)}</Tag>}>
          <div className="space-y-4">
            <Segmented<SourceKind>
              legend={t('settings.source')}
              value={kind}
              options={[
                { value: 'ring', label: t('settings.ring') },
                { value: 'sim', label: t('settings.demo') },
              ]}
              onChange={setKind}
            />
            {kind === 'sim' && (
              <Segmented
                legend={t('settings.scenario')}
                value={scenario}
                options={SIM_SCENARIOS.map((s) => ({ value: s, label: t(scenarioKey(s)) }))}
                onChange={setScenario}
              />
            )}
            <button
              type="button"
              disabled={status === 'connecting'}
              onClick={() => (source ? disconnect() : connect())}
              className={`h-11 w-full rounded-full border font-semibold transition-colors disabled:opacity-60 ${
                source
                  ? 'border-line-strong hover:border-fg/60'
                  : 'border-signal/60 bg-signal/10 text-fg hover:bg-signal/15'
              }`}
            >
              {source ? t('settings.disconnect') : t('settings.connect')}
            </button>
            {error && (
              <p role="alert" className="border-l-2 border-alert pl-3 text-sm text-alert">
                {isMessageKey(error) ? t(error) : error}
              </p>
            )}
          </div>
        </Panel>

      </div>
    </div>
  );
}
