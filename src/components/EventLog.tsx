import { SIM_SCENARIOS, type SimScenario } from '../ring/SimulatedRing';
import { useI18n, type Vars } from '../i18n';
import { clockTime } from '../lib/format';
import { useLiveStore, type EventLevel } from '../store/liveStore';
import { scenarioKey } from '../store/sensorStore';
import { Panel, TONE_TEXT, type Tone } from './Panel';

const TONE: Record<EventLevel, Tone> = { live: 'signal', info: 'muted', motion: 'amber', alert: 'alert' };
const DOT: Record<Tone, string> = {
  signal: 'bg-signal',
  amber: 'bg-amber',
  alert: 'bg-alert',
  muted: 'bg-muted',
  label: 'bg-label',
  turmeric: 'bg-turmeric',
};

export function EventLog({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const events = useLiveStore((s) => s.events);

  // Scenario names are stored as ids and translated here, like the rest of the entry.
  const localise = (vars?: Vars): Vars | undefined => {
    const scenario = vars?.scenario;
    if (typeof scenario === 'string' && SIM_SCENARIOS.includes(scenario as SimScenario)) {
      return { ...vars, scenario: t(scenarioKey(scenario as SimScenario)) };
    }
    return vars;
  };

  return (
    <Panel label={t('log.title')} aside={<span className="font-mono tabular-nums">{events.length}</span>} className={className}>
      {events.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t('log.empty')}</p>
      ) : (
        <ol className="relative max-h-80 overflow-y-auto pr-1 lg:max-h-[340px]">
          {events.map((e, i) => {
            const tone = TONE[e.level];
            return (
              <li key={e.id} className="relative flex gap-3 pb-3.5 last:pb-0">
                {i < events.length - 1 && <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-line-strong" />}
                <span aria-hidden className={`relative mt-1.5 size-[11px] shrink-0 rounded-full ring-[3px] ring-panel ${DOT[tone]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium">{e.source === 'SYSTEM' ? t('log.SYSTEM') : e.source}</span>
                    <span className={`font-mono text-[10px] font-medium tracking-[0.08em] uppercase ${TONE_TEXT[tone]}`}>{t(`level.${e.level}`)}</span>
                    <time className="ml-auto font-mono text-[11px] text-muted tabular-nums">{clockTime(e.at)}</time>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-label">{t(e.key, localise(e.vars))}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
