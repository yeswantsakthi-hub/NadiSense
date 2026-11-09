import { useI18n, type MessageKey } from '../i18n';
import { LINK_TIMEOUT_MS } from '../ring/contract';
import { useNow } from '../lib/useNow';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

/** Header chip on the brand bar: is the ring (or simulator) connected and sending, and its battery. */
export function LinkChip() {
  const { t } = useI18n();
  const now = useNow();
  const { kind, status, source } = useSensorStore();
  const { latest, lastPacketAt } = useLiveStore();

  const silent = status === 'connected' && (lastPacketAt === null || now - lastPacketAt > LINK_TIMEOUT_MS);
  const [key, dot]: [MessageKey, string] = !source
    ? ['link.offline', 'bg-white/50']
    : status === 'reconnecting' || status === 'connecting'
      ? [status === 'connecting' ? 'link.connecting' : 'link.reconnecting', 'bg-amber-300']
      : silent
        ? ['link.noData', 'bg-amber-300']
        : ['link.connected', 'bg-emerald-300'];

  return (
    <a
      href="#/settings"
      className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white hover:bg-white/25"
    >
      <span aria-hidden className={`size-2 rounded-full ${dot} ${key === 'link.connected' ? 'live-dot' : ''}`} />
      {kind === 'sim' && source ? t('link.sim') : t(key)}
      {source && latest && (
        <span className="font-mono text-white/80">
          · {latest.batteryPct}%
        </span>
      )}
    </a>
  );
}
