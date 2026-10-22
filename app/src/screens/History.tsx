import { useEffect, useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { listSessions } from '../cloud/api';
import { useCloudStore } from '../cloud/cloudStore';
import { rollupByDay, type DayRow } from '../cloud/model';
import { DayTable } from '../components/DayTable';
import { Panel } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { useI18n } from '../i18n';

type Range = '7' | '30';
type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: DayRow[] };

export function History() {
  const { t } = useI18n();
  const account = useAuthStore((s) => s.account);
  const backupOn = useCloudStore((s) => s.consent.summaries);
  const [range, setRange] = useState<Range>('7');
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!account) return;
    let alive = true;
    setState({ status: 'loading' });
    listSessions(Number(range)).then(
      (sessions) => alive && setState({ status: 'ready', rows: rollupByDay(sessions) }),
      () => alive && setState({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [account, range]);

  return (
    <div className="mx-auto max-w-3xl space-y-3 pt-2">
      <Panel label={t('history.title')}>
        {!account ? (
          <p className="text-sm text-muted">{t('cloud.guest')}</p>
        ) : (
          <>
            <div className="max-w-xs">
              <Segmented<Range>
                legend={t('history.title')}
                value={range}
                options={[
                  { value: '7', label: t('history.days7') },
                  { value: '30', label: t('history.days30') },
                ]}
                onChange={setRange}
              />
            </div>
            <div className="mt-4">
              {state.status === 'loading' && <p className="text-sm text-muted">{t('history.loading')}</p>}
              {state.status === 'error' && (
                <p role="alert" className="text-sm text-alert">
                  {t('history.error')}
                </p>
              )}
              {state.status === 'ready' &&
                (state.rows.length ? (
                  <DayTable rows={state.rows} />
                ) : (
                  <p className="font-mono text-sm text-muted">{t('history.none')}</p>
                ))}
            </div>
            {!backupOn && <p className="mt-3 text-xs text-label">{t('share.needBackup')}</p>}
          </>
        )}
      </Panel>
      {account && (
        <a href="#/report" className="block text-center text-sm text-label underline underline-offset-4 hover:text-fg">
          {t('report.title')} →
        </a>
      )}
    </div>
  );
}
