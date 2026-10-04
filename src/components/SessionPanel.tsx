import { useI18n } from '../i18n';
import { duration } from '../lib/format';
import { useNow } from '../lib/useNow';
import { STREAM_INFO, useLiveStore, type StreamId } from '../store/liveStore';
import { Panel, Tag } from './Panel';

const ORDER: StreamId[] = ['ppg', 'imu', 'temp', 'ecg'];

/** Session length and which ring streams are delivering data right now. */
export function SessionPanel({ sourceTag }: { sourceTag: string }) {
  const { t } = useI18n();
  const now = useNow();
  const connectedAt = useLiveStore((s) => s.connectedAt);
  const streams = useLiveStore((s) => s.streams);

  return (
    <Panel label={t('session.title')} aside={<Tag tone="label">{sourceTag}</Tag>}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {connectedAt ? duration(now - connectedAt) : '0:00'}
        </span>
        <span className="text-xs text-muted">{t('session.streamed')}</span>
      </p>
      <p className="mt-0.5 text-xs text-label">{t('session.clock')}</p>

      <h3 className="label mt-4 mb-1.5">{t('session.streams')}</h3>
      <ul className="divide-y divide-line">
        {ORDER.map((id) => {
          const on = streams[id];
          const info = STREAM_INFO[id];
          return (
            <li key={id} className="flex items-center gap-2.5 py-1.5">
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${on ? 'live-dot bg-signal' : 'border border-muted'}`}
              />
              <span className="w-10 text-[13px] font-semibold">{info.name}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-label">
                {t(info.detail, info.hz ? { hz: info.hz } : undefined)}
              </span>
              <span className={`font-mono text-[11px] font-medium ${on ? 'text-signal' : 'text-muted'}`}>
                {on ? t('stream.live') : t('stream.idle')}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Turmeric-accented holding panel until the Nadi metrics land. */
export function NadiPanel() {
  const { t } = useI18n();
  return (
    <Panel label={t('nadi.title')} labelClassName="!text-turmeric" className="border-turmeric/25">
      <p className="text-sm text-muted">{t('nadi.none')}</p>
      <p className="mt-1 text-xs text-label">{t('nadi.hint')}</p>
    </Panel>
  );
}
