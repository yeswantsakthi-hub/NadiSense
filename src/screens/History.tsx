import { useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { localDay, rollupByDay } from '../cloud/model';
import { DayTable } from '../components/DayTable';
import { Panel, Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { useI18n } from '../i18n';
import { useSessions } from '../store/db';
import { useSensorStore } from '../store/sensorStore';

type Range = '7' | '30';
const DAY_MS = 86_400_000;

/** Daily history from sessions stored on this phone. Works offline and without an account. */
export function History() {
  const { t } = useI18n();
  const account = useAuthStore((s) => s.account);
  const kind = useSensorStore((s) => s.kind);
  const [range, setRange] = useState<Range>('7');
  // Real-ring and simulated sessions are never mixed.
  const sessions = useSessions(kind === 'sim' ? 'mock' : 'ble');
  const since = localDay(Date.now() - (Number(range) - 1) * DAY_MS);
  const rows = rollupByDay(sessions.filter((s) => s.day >= since));

  return (
    <div className="mx-auto max-w-3xl space-y-3 pt-2">
      <Panel
        label={t('history.title')}
        aside={<Tag tone="label">{kind === 'sim' ? t('link.sim') : t('link.ringShort')}</Tag>}
      >
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
          {rows.length ? <DayTable rows={rows} /> : <p className="text-sm text-muted">{t('history.noneLocal')}</p>}
        </div>
        <p className="mt-3 text-xs text-label">{t('history.onDevice')}</p>
      </Panel>
      {account && (
        <a href="#/report" className="block text-center text-sm text-label underline underline-offset-4 hover:text-fg">
          {t('report.title')} →
        </a>
      )}
    </div>
  );
}
