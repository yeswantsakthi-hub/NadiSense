import type { ReactNode } from 'react';
import { BeatStrip } from '../components/BeatStrip';
import { EventLog } from '../components/EventLog';
import { HeartIcon, InfoIcon } from '../components/icons';
import { Tag } from '../components/Panel';
import { RingGauge } from '../components/RingGauge';
import { SessionPanel } from '../components/SessionPanel';
import { temperatureBaseline, temperatureDrift } from '../dsp/baseline';
import { analyseRhythm, RHYTHM_WINDOW_MS, type RhythmResult } from '../dsp/rhythm';
import { useI18n, type MessageKey } from '../i18n';
import { useNow } from '../lib/useNow';
import { FINGER_ON } from '../ring/contract';
import { readingState, type ReadingState } from '../ring/readings';
import { useSessions } from '../store/db';
import { beatLog, useLiveStore } from '../store/liveStore';
import { scenarioKey, useSensorStore } from '../store/sensorStore';

const STATE_TEXT: Record<Exclude<ReadingState, 'ok'>, MessageKey> = {
  'no-data': 'reading.noData',
  place: 'reading.place',
  hold: 'reading.hold',
};

function greetingKey(hour: number): MessageKey {
  if (hour < 12) return 'home.morning';
  if (hour < 17) return 'home.afternoon';
  return 'home.evening';
}

const signedDeg = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)}°`;

export function Dashboard() {
  const { t } = useI18n();
  const now = useNow(500);
  const { kind, scenario } = useSensorStore();
  const { latest, lastPacketAt } = useLiveStore();
  const state = readingState(latest, lastPacketAt, now);
  const ok = state === 'ok';
  const fingerOn = latest?.fingerStatus === FINGER_ON && state !== 'no-data';
  const rhythm = analyseRhythm(beatLog, now);

  // Temperature: drift from this person's own baseline (ring and simulator kept apart).
  const sessions = useSessions(kind === 'sim' ? 'mock' : 'ble');
  const baseline = temperatureBaseline(sessions);
  const temp = fingerOn ? (latest?.skinTempC ?? null) : null;
  const drift = temp !== null && baseline.status === 'ready' ? temperatureDrift(temp, baseline.celsius) : null;

  return (
    <div className="space-y-4 pt-2">
      <header>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{t(greetingKey(new Date(now).getHours()))}</h1>
        <p className="mt-0.5 text-sm text-label">
          {kind === 'sim' ? t('home.sim', { scenario: t(scenarioKey(scenario)) }) : t('home.live')}
        </p>
      </header>

      {/* Hero: live heart rate inside the ring; the arc is the pulse-ox confidence. */}
      <section aria-label={t('vital.hr')} className="flex flex-col items-center pt-2">
        <RingGauge
          value={fingerOn && latest ? latest.confidence / 100 : null}
          color={state === 'hold' ? '--amber' : '--signal'}
          size={264}
          stroke={14}
          sweep={300}
          label={
            ok && latest?.hrBpm
              ? `${t('vital.hr')} ${latest.hrBpm} bpm`
              : t(STATE_TEXT[state as Exclude<ReadingState, 'ok'>] ?? 'reading.noData')
          }
        >
          {ok && latest?.hrBpm ? (
            <>
              <HeartIcon key={latest.beatSeq} className="beat-pop size-7 text-signal" />
              <span className="mt-1 font-mono text-[76px] leading-none font-extralight tracking-tight">{latest.hrBpm}</span>
              <span className="mt-1 text-sm text-label">bpm</span>
            </>
          ) : (
            <>
              <HeartIcon className="size-7 text-muted" />
              <span
                role="status"
                className={`mt-2 max-w-[11rem] text-xl leading-snug font-medium ${state === 'hold' ? 'text-amber' : 'text-fg'}`}
              >
                {t(STATE_TEXT[state as Exclude<ReadingState, 'ok'>] ?? 'reading.noData')}
              </span>
            </>
          )}
        </RingGauge>
        <p className="-mt-3 text-xs text-muted">
          {fingerOn && latest ? t('home.signal', { pct: latest.confidence }) : t('vital.hr')}
        </p>
      </section>

      <div className="-mx-4">
        <BeatStrip label={t('pulse.aria')} className="h-16 opacity-80" />
        <p className="px-4 pt-1 text-center text-[11px] text-muted">{t('pulse.beatTiming')}</p>
      </div>

      <Insight state={state} rhythm={rhythm} />

      <section aria-label={t('vitals.aria')} className="grid grid-cols-3 gap-3">
        <MiniGauge
          title={t('vital.spo2')}
          color="--spo2"
          value={ok && latest?.spo2Pct ? Math.max(0, (latest.spo2Pct - 85) / 15) : null}
          big={ok && latest?.spo2Pct ? `${latest.spo2Pct}` : '––'}
          unit={ok && latest?.spo2Pct ? '%' : ''}
          sub={ok ? t('vital.fromRing') : t(STATE_TEXT[state as Exclude<ReadingState, 'ok'>] ?? 'reading.noData')}
        />
        <MiniGauge
          title={t('vital.temp')}
          color="--temp"
          value={
            temp === null
              ? null
              : drift !== null
                ? Math.max(0.05, Math.min(1, 0.5 + drift / 2))
                : baseline.status === 'building'
                  ? baseline.sessions / 3
                  : null
          }
          big={drift !== null ? signedDeg(drift) : temp !== null ? `${temp.toFixed(1)}°` : '––'}
          sub={
            drift !== null
              ? t('home.vsBaseline')
              : baseline.status === 'building'
                ? t('home.baselineProgress', { n: baseline.sessions })
                : t('reading.place')
          }
        />
        <MiniGauge
          title={t('vital.rhythm')}
          color={rhythm.status === 'irregular' ? '--alert' : '--rhythm'}
          value={rhythm.status === 'collecting' ? rhythm.progress : 1}
          big={rhythm.status === 'collecting' ? `${Math.round(rhythm.progress * 100)}` : rhythm.status === 'regular' ? '✓' : '!'}
          unit={rhythm.status === 'collecting' ? '%' : ''}
          sub={
            rhythm.status === 'collecting'
              ? t('home.measuring')
              : rhythm.status === 'regular'
                ? t('home.steady')
                : t('rhythm.tagIrregular')
          }
        />
      </section>

      <RhythmCard rhythm={rhythm} />

      <details className="group rounded-3xl border border-line bg-panel">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-label [&::-webkit-details-marker]:hidden">
          {t('home.details')}
          <span aria-hidden className="transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <SessionPanel />
          <EventLog />
        </div>
      </details>
    </div>
  );
}

function MiniGauge(props: { title: string; color: string; value: number | null; big: string; unit?: string; sub: string }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-line bg-panel px-2 pt-4 pb-3 text-center">
      <RingGauge value={props.value} color={props.color} size={84} stroke={7} label={`${props.title} ${props.big}${props.unit ?? ''}`}>
        <span className="font-mono text-xl leading-none font-light">
          {props.big}
          {props.unit && <span className="text-xs text-label">{props.unit}</span>}
        </span>
      </RingGauge>
      <p className="mt-2 text-[13px] font-medium">{props.title}</p>
      <p className="text-[11px] leading-snug text-muted">{props.sub}</p>
    </div>
  );
}

/** One plain-language sentence about what is happening right now. */
function Insight({ state, rhythm }: { state: ReadingState; rhythm: RhythmResult }) {
  const { t } = useI18n();
  let text: string;
  let tone = 'text-label';
  if (state !== 'ok') {
    text = t(state === 'no-data' ? 'insight.noData' : state === 'place' ? 'insight.place' : 'insight.hold');
    if (state === 'hold') tone = 'text-amber';
  } else if (rhythm.status === 'collecting') {
    text = t('insight.collecting', { secs: Math.max(5, Math.round(((1 - rhythm.progress) * RHYTHM_WINDOW_MS) / 1000)) });
  } else if (rhythm.status === 'regular') {
    text = t('insight.regular');
  } else {
    text = t('insight.irregular');
    tone = 'text-alert';
  }
  return (
    <div aria-live="polite" className="flex items-start gap-3 rounded-3xl bg-panel-2/70 px-4 py-3.5">
      <InfoIcon className={`mt-0.5 size-5 shrink-0 ${tone}`} />
      <p className={`text-sm leading-relaxed ${tone === 'text-label' ? 'text-fg' : tone}`}>{text}</p>
    </div>
  );
}

/** Rhythm details: result, the two numbers behind it, and the disclaimer. */
function RhythmCard({ rhythm }: { rhythm: RhythmResult }) {
  const { t } = useI18n();
  const irregular = rhythm.status === 'irregular';
  let body: ReactNode;
  if (rhythm.status === 'collecting') {
    body = <p className="text-sm text-label">{t('rhythm.progress', { pct: Math.round(rhythm.progress * 100) })}</p>;
  } else {
    body = (
      <>
        <p className={`text-base font-semibold ${irregular ? 'text-alert' : ''}`}>
          {irregular ? t('rhythm.irregular') : t('rhythm.regular')}
        </p>
        <p className="mt-1 font-mono text-xs text-label">{t('rhythm.metrics', { rmssd: rhythm.rmssdMs, pnn50: rhythm.pnn50 })}</p>
      </>
    );
  }
  return (
    <section
      aria-label={t('vital.rhythm')}
      className={`rounded-3xl border bg-panel px-5 py-4 ${irregular ? 'border-alert/60' : 'border-line'}`}
    >
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="label">{t('vital.rhythm')}</h2>
        {rhythm.status === 'collecting' ? (
          <Tag>{t('tag.pending')}</Tag>
        ) : (
          <Tag tone={irregular ? 'alert' : 'signal'}>{irregular ? t('rhythm.tagIrregular') : t('rhythm.tagRegular')}</Tag>
        )}
      </header>
      {body}
      <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
        {t('rhythm.window')} · {t('app.disclaimer')}
      </p>
    </section>
  );
}
