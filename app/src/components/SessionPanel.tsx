import { useI18n } from '../i18n';
import { LINK_TIMEOUT_MS } from '../ring/contract';
import { duration } from '../lib/format';
import { useNow } from '../lib/useNow';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';
import { Panel, Tag } from './Panel';

/** Session length and the health of the link to the ring. */
export function SessionPanel() {
  const { t } = useI18n();
  const now = useNow();
  const kind = useSensorStore((s) => s.kind);
  const { connectedAt, lastPacketAt, packets } = useLiveStore();
  const fresh = lastPacketAt !== null && now - lastPacketAt <= LINK_TIMEOUT_MS;

  return (
    <Panel label={t('session.title')} aside={<Tag tone="label">{kind === 'sim' ? t('tag.demo') : t('tag.ring')}</Tag>}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {connectedAt ? duration(now - connectedAt) : '0:00'}
        </span>
        <span className="text-xs text-muted">{t('session.streamed')}</span>
      </p>
      <dl className="mt-3 divide-y divide-line text-sm">
        <div className="flex justify-between py-1.5">
          <dt className="text-label">{t('session.packets')}</dt>
          <dd className="font-mono tabular-nums">{packets}</dd>
        </div>
        <div className="flex justify-between py-1.5">
          <dt className="text-label">{t('session.lastPacket')}</dt>
          <dd className={`font-mono tabular-nums ${fresh ? 'text-signal' : 'text-amber'}`}>
            {lastPacketAt === null ? '––' : `${((now - lastPacketAt) / 1000).toFixed(1)} s`}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
