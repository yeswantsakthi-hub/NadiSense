import { useI18n, type MessageKey } from '../i18n';
import { LINK_TIMEOUT_MS } from '../ring/contract';
import { useNow } from '../lib/useNow';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

/** Header chip: is the ring (or simulator) connected and sending, and its battery. */
export function LinkChip() {
  const { t } = useI18n();
  const now = useNow();
  const { kind, status, source } = useSensorStore();
  const { latest, lastPacketAt } = useLiveStore();

  const silent = status === 'connected' && (lastPacketAt === null || now - lastPacketAt > LINK_TIMEOUT_MS);
  const [key, tone]: [MessageKey, string] = !source
    ? ['link.offline', 'text-muted']
    : status === 'reconnecting' || status === 'connecting'
      ? [status === 'connecting' ? 'link.connecting' : 'link.reconnecting', 'text-amber']
      : silent
        ? ['link.noData', 'text-amber']
        : ['link.connected', 'text-signal'];

  return (
    <a
      href="#/settings"
      className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] whitespace-nowrap hover:border-line-strong"
    >
      <span aria-hidden className={`size-2 rounded-full bg-current ${tone} ${key === 'link.connected' ? 'live-dot' : ''}`} />
      <span className={tone}>{kind === 'sim' && source ? t('link.sim') : t(key)}</span>
      {source && latest && (
        <span className={`font-mono tabular-nums ${latest.batteryPct <= 15 ? 'text-amber' : 'text-muted'}`}>
          {latest.batteryPct}%
        </span>
      )}
    </a>
  );
}
