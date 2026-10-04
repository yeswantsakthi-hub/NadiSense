import { clockTime } from '../lib/format';
import { useLiveStore, type EventLevel } from '../store/liveStore';
import { Panel, TONE_TEXT, type Tone } from './Panel';

const LEVEL: Record<EventLevel, { tone: Tone; tag: string }> = {
  live: { tone: 'signal', tag: 'live' },
  info: { tone: 'muted', tag: 'info' },
  motion: { tone: 'amber', tag: 'motion' },
  alert: { tone: 'alert', tag: 'alert' },
};

export function EventLog({ className = '' }: { className?: string }) {
  const events = useLiveStore((s) => s.events);
  return (
    <Panel label="Event log" aside={<span className="font-mono tabular-nums">{events.length}</span>} className={className}>
      {events.length === 0 ? (
        <p className="py-2 text-sm text-muted">No events yet.</p>
      ) : (
        <ol className="max-h-80 divide-y divide-line overflow-y-auto lg:max-h-[340px]">
          {events.map((e) => {
            const { tone, tag } = LEVEL[e.level];
            return (
              <li key={e.id} className="py-2 first:pt-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[13px] font-semibold ${e.level === 'info' ? 'text-fg' : TONE_TEXT[tone]}`}>
                    {e.source}
                  </span>
                  <span className={`text-[10px] font-semibold tracking-[0.08em] uppercase ${TONE_TEXT[tone]}`}>{tag}</span>
                  <time className="ml-auto font-mono text-[11px] text-muted tabular-nums">{clockTime(e.at)}</time>
                </div>
                <p className="mt-0.5 text-xs text-label">{e.text}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
