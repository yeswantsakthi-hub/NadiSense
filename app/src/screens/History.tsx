import { lazy, Suspense, useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { localDay, rollupByDay } from '../cloud/model';
import { DayTable } from '../components/DayTable';
import { ChartIcon } from '../components/icons';
import { Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { sessionTrend } from '../dsp/trends';
import { useI18n } from '../i18n';
import { useSessions } from '../store/db';
import { useSensorStore } from '../store/sensorStore';

type Range = '7' | '30';
const DAY_MS = 86_400_000;
// Charts load on demand so the app starts fast.
const Trends = lazy(() => import('../components/Trends'));

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
  const points = sessionTrend(sessions, new Date(`${since}T00:00:00`).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="w-full max-w-[15rem]">
          <Segmented<Range>
            legend={t('history.title')}
            hideLegend
            value={range}
            options={[
              { value: '7', label: t('history.days7') },
              { value: '30', label: t('history.days30') },
            ]}
            onChange={setRange}
          />
        </div>
        <Tag tone="label">{kind === 'sim' ? t('link.sim') : t('link.ringShort')}</Tag>
      </div>
      {rows.length === 0 ? (
        <section className="surface rounded-2xl px-5 py-10 text-center">
          <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-full bg-white/5 text-label">
            <ChartIcon className="size-6" />
          </span>
          <p className="mx-auto mt-4 max-w-xs text-[15px] text-label">{t('history.noneLocal')}</p>
        </section>
      ) : (
        <>
          {points.length > 0 && (
            <section className="surface rounded-2xl px-5 pt-1 pb-5">
              <Suspense fallback={<div className="mt-5 h-36" />}>
                <Trends points={points} />
              </Suspense>
            </section>
          )}
          <section className="surface rounded-2xl px-5 py-3">
            <DayTable rows={rows} />
          </section>
        </>
      )}
      <p className="px-1 text-[12.5px] text-muted">{t('history.onDevice')}</p>
      {account && (
        <a href="#/report" className="block text-center text-sm text-label underline underline-offset-4 hover:text-fg">
          {t('report.title')} →
        </a>
      )}
    </div>
  );
}
