import { useI18n, type MessageKey } from '../i18n';
import { LINK_TIMEOUT_MS } from '../ring/contract';
import { useNow } from '../lib/useNow';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

/** Header status pill: ring link (live dot) and battery. */
export function LinkChip() {
  const { t } = useI18n();
  const now = useNow();
  const { kind, status, source } = useSensorStore();
  const { latest, lastPacketAt } = useLiveStore();

  const silent = status === 'connected' && (lastPacketAt === null || now - lastPacketAt > LINK_TIMEOUT_MS);
  const [key, dot]: [MessageKey, string] = !source
    ? ['link.offline', 'text-muted']
    : status === 'reconnecting' || status === 'connecting'
      ? [status === 'connecting' ? 'link.connecting' : 'link.reconnecting', 'text-amber']
      : silent
        ? ['link.noData', 'text-amber']
        : ['link.connected', 'text-signal'];
  const live = key === 'link.connected';

  return (
    <a
      href="#/settings"
      className="flex h-8 items-center gap-2 rounded-full bg-white/[0.04] px-3 text-[12px] whitespace-nowrap text-label ring-1 ring-line-strong transition-colors hover:text-fg"
    >
      <span aria-hidden className={`relative flex size-2 ${dot}`}>
        {live && <span className="ping absolute inset-0 rounded-full bg-current" />}
        <span className="relative size-2 rounded-full bg-current" />
      </span>
      <span className="max-w-[9rem] truncate">{kind === 'sim' && source ? t('link.sim') : t(key)}</span>
      {source && latest && (
        <span className="flex items-center gap-1 border-l border-line-strong pl-2 font-mono text-[11px] text-muted">
          <svg aria-hidden viewBox="0 0 22 12" className="h-2.5 w-[18px]">
            <rect x="0.75" y="0.75" width="18" height="10.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <rect x="19.6" y="3.8" width="1.8" height="4.4" rx="0.8" fill="currentColor" />
            <rect
              x="2.5"
              y="2.5"
              width={Math.max(1, 14.5 * (latest.batteryPct / 100))}
              height="7"
              rx="1.2"
              fill={latest.batteryPct <= 15 ? 'var(--amber)' : 'var(--signal)'}
            />
          </svg>
          {latest.batteryPct}%
        </span>
      )}
    </a>
  );
}
