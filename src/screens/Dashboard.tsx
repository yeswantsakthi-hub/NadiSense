import { BeatStrip } from '../components/BeatStrip';
import { EventLog } from '../components/EventLog';
import { Tag } from '../components/Panel';
import { SessionPanel } from '../components/SessionPanel';
import { VitalCard } from '../components/VitalCard';
import { temperatureBaseline, temperatureDrift } from '../dsp/baseline';
import { analyseRhythm } from '../dsp/rhythm';
import { useI18n, type MessageKey } from '../i18n';
import { useNow } from '../lib/useNow';
import { FINGER_ON } from '../ring/contract';
import { readingState, type ReadingState } from '../ring/readings';
import { useSessions } from '../store/db';
import { beatLog, useLiveStore } from '../store/liveStore';
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
  const stateText = ok ? null : t(STATE_TEXT[state]);
  const stateTag = ok
    ? ({ text: t('tag.live'), tone: 'signal' } as const)
    : ({ text: stateText!, tone: state === 'hold' ? 'amber' : 'muted' } as const);

  // Skin temperature: shown whenever the ring is on the finger, as drift from this person's baseline.
  const sessions = useSessions(kind === 'sim' ? 'mock' : 'ble');
  const baseline = temperatureBaseline(sessions);
  const fingerOn = latest?.fingerStatus === FINGER_ON && state !== 'no-data';
  const temp = fingerOn ? (latest?.skinTempC ?? null) : null;
  const tempDetail =
    baseline.status === 'building'
      ? t('temp.building', { n: baseline.sessions })
      : temp === null
        ? t('temp.baseline', { base: baseline.celsius.toFixed(1) })
        : t('temp.vsBaseline', {
            drift: formatDrift(temperatureDrift(temp, baseline.celsius)),
            base: baseline.celsius.toFixed(1),
          });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-3">
        <section aria-label={t('vital.hr')} className="-mx-3 border-y border-line bg-panel sm:mx-0 sm:rounded-2xl sm:border-x">
          <header className="flex items-start justify-between gap-3 px-4 pt-4">
            <div>
              <h2 className="label">{t('vital.hr')}</h2>
              <p className="mt-1 flex items-baseline gap-2">
                <span className={`font-mono text-5xl font-semibold ${ok ? '' : 'text-muted/60'}`}>
                  {ok && latest?.hrBpm ? latest.hrBpm : '––'}
                </span>
                <span className="text-sm text-muted">bpm</span>
              </p>
              {stateText && (
                <p role="status" className={`mt-1 text-sm font-semibold ${state === 'hold' ? 'text-amber' : 'text-label'}`}>
                  {stateText}
                </p>
              )}
            </div>
            <Tag tone={stateTag.tone}>{stateTag.text}</Tag>
          </header>
          <BeatStrip label={t('pulse.aria')} className="mt-2 h-36 sm:h-44" />
          <footer className="flex justify-between gap-3 border-t border-line px-4 py-2 text-[11px] text-label">
            <span>{t('pulse.beatTiming')}</span>
            {fingerOn && latest && <span className="font-mono">{t('pulse.confidence', { pct: latest.confidence })}</span>}
          </footer>
        </section>

        <section aria-label={t('vitals.aria')} className="grid grid-cols-2 gap-3">
          <VitalCard
            label={t('vital.spo2')}
            value={ok && latest?.spo2Pct ? String(latest.spo2Pct) : undefined}
            unit="%"
            tag={stateTag}
            detail={ok ? t('vital.spo2Source') : stateText!}
            footer={t('vital.fromRing')}
          />
          <VitalCard
            label={t('vital.temp')}
            value={temp === null ? undefined : temp.toFixed(1)}
            unit="°C"
            tag={
              temp === null
                ? { text: fingerOn ? t('tag.pending') : t('reading.place'), tone: 'muted' }
                : { text: t('tag.live'), tone: 'signal' }
            }
            detail={tempDetail}
            footer={t('vital.tempSource')}
          />
        </section>

        <RhythmCard now={now} />
      </div>

      <div className="min-w-0 space-y-3">
        <SessionPanel />
        <EventLog />
      </div>
    </div>
  );
}

function formatDrift(d: number): string {
  return d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1);
}

/** Irregular-rhythm screen over the last 2 minutes of still, consecutive beats. */
function RhythmCard({ now }: { now: number }) {
  const { t } = useI18n();
  const r = analyseRhythm(beatLog, now);
  const irregular = r.status === 'irregular';

  return (
    <section
      aria-label={t('vital.rhythm')}
      aria-live="polite"
      className={`rounded-2xl border bg-panel p-4 ${irregular ? 'border-alert/70' : 'border-line'}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h2 className="label">{t('vital.rhythm')}</h2>
        {r.status === 'collecting' ? (
          <Tag tone="muted">{t('tag.pending')}</Tag>
        ) : (
          <Tag tone={irregular ? 'alert' : 'signal'}>{irregular ? t('rhythm.tagIrregular') : t('rhythm.tagRegular')}</Tag>
        )}
      </header>

      {r.status === 'collecting' ? (
        <>
          <p className="mt-2 font-semibold">{t('rhythm.collecting')}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(r.progress * 100)}
            aria-label={t('rhythm.collecting')}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg"
          >
            <div className="h-full rounded-full bg-signal transition-[width]" style={{ width: `${r.progress * 100}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-label">{t('rhythm.progress', { pct: Math.round(r.progress * 100) })}</p>
        </>
      ) : (
        <>
          <p className={`mt-2 text-lg font-semibold ${irregular ? 'text-alert' : ''}`}>
            {irregular ? t('rhythm.irregular') : t('rhythm.regular')}
          </p>
          <p className="mt-1 font-mono text-xs text-label">{t('rhythm.metrics', { rmssd: r.rmssdMs, pnn50: r.pnn50 })}</p>
        </>
      )}

      <p className="mt-3 border-t border-line pt-2 text-[11px] text-muted">
        {t('rhythm.window')} · {t('app.disclaimer')}
      </p>
    </section>
  );
}
