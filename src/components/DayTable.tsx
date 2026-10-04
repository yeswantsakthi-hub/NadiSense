import type { DayRow } from '../cloud/model';
import { useI18n } from '../i18n';

/** One row per day: sessions, minutes monitored, share flagged for movement, average skin temperature. */
export function DayTable({ rows }: { rows: DayRow[] }) {
  const { t, date } = useI18n();
  const th = 'label py-2 pr-3 text-left font-semibold';
  const td = 'py-2 pr-3 font-mono tabular-nums';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>
              {t('history.day')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('history.sessions')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('history.minutes')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('history.motion')}
            </th>
            <th scope="col" className={`${th} text-right`}>
              {t('history.temp')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.day}>
              <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">
                {date(r.day)}
              </th>
              <td className={`${td} text-right`}>{r.sessions}</td>
              <td className={`${td} text-right`}>{r.minutes}</td>
              <td className={`${td} text-right ${r.motionPct >= 20 ? 'text-amber' : ''}`}>{r.motionPct}%</td>
              <td className={`${td} text-right`}>{r.tempAvg === null ? '––' : `${r.tempAvg.toFixed(1)} °C`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
