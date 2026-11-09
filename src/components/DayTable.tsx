import type { DayRow } from '../cloud/model';
import { useI18n } from '../i18n';

const dash = '––';

/** One row per day: minutes worn, mean heart rate, SpO₂, skin temperature, rhythm flags. */
export function DayTable({ rows }: { rows: DayRow[] }) {
  const { t, date } = useI18n();
  const th = 'label py-2 pr-3 text-right font-semibold';
  const td = 'py-2 pr-3 text-right font-mono';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[340px] text-sm">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={`${th} text-left`}>
              {t('history.day')}
            </th>
            <th scope="col" className={th}>
              {t('history.minutes')}
            </th>
            <th scope="col" className={th}>
              {t('history.hr')}
            </th>
            <th scope="col" className={th}>
              SpO₂
            </th>
            <th scope="col" className={th}>
              {t('history.temp')}
            </th>
            <th scope="col" className={th}>
              {t('vital.rhythm')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.day}>
              <th scope="row" className="py-2 pr-3 text-left font-medium whitespace-nowrap">
                {date(r.day)}
              </th>
              <td className={td}>{r.minutes}</td>
              <td className={td}>{r.hrAvg ?? dash}</td>
              <td className={td}>{r.spo2Avg != null ? `${r.spo2Avg}%` : dash}</td>
              <td className={td}>{r.tempAvg != null ? `${r.tempAvg.toFixed(1)}°` : dash}</td>
              <td className={`${td} ${r.irregular ? 'font-semibold text-alert' : 'text-muted'}`}>
                {r.irregular ? `⚠ ${r.irregular}` : '✓'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
