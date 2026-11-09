import { BeatStrip } from '../components/BeatStrip';
import { EventLog } from '../components/EventLog';
import { Tag } from '../components/Panel';
import { SessionPanel } from '../components/SessionPanel';
import { VitalCard } from '../components/VitalCard';
import { useI18n, type MessageKey } from '../i18n';
import { readingState, type ReadingState } from '../ring/readings';
import { useNow } from '../lib/useNow';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

const STATE_TEXT: Record<Exclude<ReadingState, 'ok'>, MessageKey> = {
  'no-data': 'reading.noData',
  place: 'reading.place',
  hold: 'reading.hold',
};

export function Dashboard() {
  const { t } = useI18n();
  const now = useNow(500);
  const kind = useSensorStore((s) => s.kind);
  const { latest, lastPacketAt } = useLiveStore();
  const state = readingState(latest, lastPacketAt, now);
  const ok = state === 'ok';
  const pending = { text: t('tag.pending'), tone: 'muted' } as const;
  const stateTag = ok
    ? ({ text: t('tag.live'), tone: 'signal' } as const)
    : ({ text: t(STATE_TEXT[state]), tone: state === 'hold' ? 'amber' : 'muted' } as const);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        <section
          aria-label={t('vital.hr')}
          className="-mx-3 border-y border-line bg-panel sm:mx-0 sm:rounded-[3px] sm:border-x"
        >
          <header className="flex items-start justify-between gap-3 px-3 pt-3">
            <div>
              <h2 className="label">{t('vital.hr')}</h2>
              <p className="mt-1 flex items-baseline gap-2">
                <span className={`font-mono text-5xl font-semibold tabular-nums ${ok ? '' : 'text-muted/60'}`}>
                  {ok && latest?.hrBpm ? latest.hrBpm : '––'}
                </span>
                <span className="text-sm text-muted">bpm</span>
              </p>
              {!ok && (
                <p role="status" className={`mt-1 text-sm font-semibold ${state === 'hold' ? 'text-amber' : 'text-label'}`}>
                  {t(STATE_TEXT[state])}
                </p>
              )}
            </div>
            <Tag tone={stateTag.tone}>{stateTag.text}</Tag>
          </header>
          <BeatStrip label={t('pulse.aria')} className="mt-2 h-36 sm:h-44" />
          <footer className="flex justify-between gap-3 border-t border-line px-3 py-2 text-[11px] text-label">
            <span>{t('pulse.beatTiming')}</span>
            {latest && latest.fingerStatus === 3 && (
              <span className="font-mono tabular-nums">{t('pulse.confidence', { pct: latest.confidence })}</span>
            )}
          </footer>
        </section>

        <section aria-label={t('vitals.aria')} className="grid grid-cols-2 gap-3">
          <VitalCard
            label={t('vital.spo2')}
            value={ok && latest?.spo2Pct ? String(latest.spo2Pct) : undefined}
            unit="%"
            tag={stateTag}
            detail={ok ? t('vital.spo2Source') : t(STATE_TEXT[state as Exclude<ReadingState, 'ok'>] ?? 'reading.noData')}
            footer={t('vital.fromRing')}
          />
          <VitalCard
            label={t('vital.temp')}
            value={latest?.skinTempC != null && latest.fingerStatus === 3 ? latest.skinTempC.toFixed(1) : undefined}
            unit="°C"
            tag={latest?.skinTempC != null && latest.fingerStatus === 3 ? { text: t('tag.live'), tone: 'signal' } : pending}
            detail={t('vital.baseline')}
            footer={t('vital.tempSource')}
          />
          <VitalCard
            label={t('vital.rhythm')}
            unit=""
            tag={pending}
            detail={t('rhythm.collecting')}
            footer={t('vital.fromBeats')}
          />
          <VitalCard
            label={t('vital.source')}
            value={latest ? String(latest.batteryPct) : undefined}
            unit="%"
            tag={{ text: kind === 'sim' ? t('link.sim') : t('link.ringShort'), tone: latest && latest.batteryPct <= 15 ? 'amber' : 'label' }}
            detail={latest?.motion ? t('vital.motion') : t('vital.usable')}
            footer={t('kpi.battery')}
          />
        </section>
      </div>

      <div className="min-w-0 space-y-3">
        <SessionPanel />
        <EventLog />
      </div>
    </div>
  );
}
