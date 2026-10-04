import { duration } from '../lib/format';
import { useNow } from '../lib/useNow';
import { STREAM_INFO, useLiveStore, type StreamId } from '../store/liveStore';
import { Panel, Tag } from './Panel';

const ORDER: StreamId[] = ['ppg', 'imu', 'temp', 'ecg'];

/** Session length and which ring streams are delivering data right now. */
export function SessionPanel({ sourceName }: { sourceName: string }) {
  const now = useNow();
  const connectedAt = useLiveStore((s) => s.connectedAt);
  const streams = useLiveStore((s) => s.streams);

  return (
    <Panel label="Session" aside={<Tag tone="label">{sourceName}</Tag>}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums">
          {connectedAt ? duration(now - connectedAt) : '0:00'}
        </span>
        <span className="text-xs text-muted">streamed</span>
      </p>
      <p className="mt-0.5 text-xs text-label">single clock shared by ECG and PPG</p>

      <h3 className="label mt-4 mb-1.5">Streams</h3>
      <ul className="divide-y divide-line">
        {ORDER.map((id) => {
          const on = streams[id];
          return (
            <li key={id} className="flex items-center gap-2.5 py-1.5">
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${on ? 'live-dot bg-signal' : 'border border-muted'}`}
              />
              <span className="w-10 text-[13px] font-semibold">{STREAM_INFO[id].name}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-label">{STREAM_INFO[id].detail}</span>
              <span className={`font-mono text-[11px] font-medium ${on ? 'text-signal' : 'text-muted'}`}>
                {on ? 'LIVE' : 'IDLE'}
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
  return (
    <Panel label="Nadi reading" labelClassName="!text-turmeric" className="border-turmeric/25">
      <p className="text-sm text-muted">No pulse reading registered.</p>
      <p className="mt-1 text-xs text-label">
        Gati (rise time), bala (strength) and rhythm regularity appear after a clean minute of signal.
      </p>
    </Panel>
  );
}
