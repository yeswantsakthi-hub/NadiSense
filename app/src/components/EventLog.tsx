import { SCENARIOS, type Scenario } from '../data/mockModel';
import { useI18n, type Vars } from '../i18n';
import { clockTime } from '../lib/format';
import { useLiveStore, type EventLevel } from '../store/liveStore';
import { scenarioKey } from '../store/sensorStore';
import { Panel, TONE_TEXT, type Tone } from './Panel';

const TONE: Record<EventLevel, Tone> = { live: 'signal', info: 'muted', motion: 'amber', alert: 'alert' };

export function EventLog({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const events = useLiveStore((s) => s.events);

  // Scenario names are stored as ids and translated here, like the rest of the entry.
  const localise = (vars?: Vars): Vars | undefined => {
    const scenario = vars?.scenario;
    if (typeof scenario === 'string' && SCENARIOS.includes(scenario as Scenario)) {
      return { ...vars, scenario: t(scenarioKey(scenario as Scenario)) };
    }
    return vars;
  };

  return (
    <Panel label={t('log.title')} aside={<span className="font-mono tabular-nums">{events.length}</span>} className={className}>
      {events.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t('log.empty')}</p>
      ) : (
        <ol className="max-h-80 divide-y divide-line overflow-y-auto lg:max-h-[340px]">
          {events.map((e) => {
            const tone = TONE[e.level];
            return (
              <li key={e.id} className="py-2 first:pt-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[13px] font-semibold ${e.level === 'info' ? 'text-fg' : TONE_TEXT[tone]}`}>
                    {e.source === 'SYSTEM' ? t('log.SYSTEM') : e.source}
                  </span>
                  <span className={`text-[10px] font-semibold tracking-[0.08em] uppercase ${TONE_TEXT[tone]}`}>
                    {t(`level.${e.level}`)}
                  </span>
                  <time className="ml-auto font-mono text-[11px] text-muted tabular-nums">{clockTime(e.at)}</time>
                </div>
                <p className="mt-0.5 text-xs text-label">{t(e.key, localise(e.vars))}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
