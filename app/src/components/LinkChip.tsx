import { useI18n, type MessageKey } from '../i18n';
import { LINK_TIMEOUT_MS } from '../ring/contract';
import { useNow } from '../lib/useNow';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

/** Header status: ring link and battery, as quiet grey text with a coloured dot. */
export function LinkChip() {
  const { t } = useI18n();
  const now = useNow();
  const { kind, status, source } = useSensorStore();
  const { latest, lastPacketAt } = useLiveStore();

  const silent = status === 'connected' && (lastPacketAt === null || now - lastPacketAt > LINK_TIMEOUT_MS);
  const [key, dot]: [MessageKey, string] = !source
    ? ['link.offline', 'bg-muted']
    : status === 'reconnecting' || status === 'connecting'
      ? [status === 'connecting' ? 'link.connecting' : 'link.reconnecting', 'bg-amber']
      : silent
        ? ['link.noData', 'bg-amber']
        : ['link.connected', 'bg-signal'];

  return (
    <a href="#/settings" className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted hover:text-fg">
      <span aria-hidden className={`size-1.5 rounded-full ${dot} ${key === 'link.connected' ? 'live-dot' : ''}`} />
      {kind === 'sim' && source ? t('link.sim') : t(key)}
      {source && latest && <span className="font-mono">· {latest.batteryPct}%</span>}
    </a>
  );
}
