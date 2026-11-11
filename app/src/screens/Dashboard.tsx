import type { ReactNode } from 'react';
import { BeatStrip } from '../components/BeatStrip';
import { EventLog } from '../components/EventLog';
import { Panel, Tag, TONE_TEXT, type Tone } from '../components/Panel';
import { temperatureBaseline, temperatureDrift } from '../dsp/baseline';
import { analyseRhythm, NRMSSD_FLAG, PNN50_FLAG, type RhythmResult } from '../dsp/rhythm';
import { useI18n, type MessageKey } from '../i18n';
import { useNow } from '../lib/useNow';
import { FINGER_ON } from '../ring/contract';
import { readingState, type ReadingState } from '../ring/readings';
import { SimulatedRing, TOUR_STEPS } from '../ring/SimulatedRing';
import { useSessions, useValidations } from '../store/db';
import { beatLog, useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';
import { summarize } from '../validation/model';

type Status = 'live' | 'hold' | 'place' | 'noData' | 'flag';

const STATUS: Record<Status, { word: MessageKey; title: MessageKey; lead: MessageKey; tone: Tone; bullets: MessageKey[] }> = {
  live: { word: 'c.live', title: 'c.titleLive', lead: 'c.leadLive', tone: 'signal', bullets: ['c.b1', 'c.b2', 'c.b3'] },
  hold: { word: 'c.hold', title: 'c.titleHold', lead: 'c.leadHold', tone: 'amber', bullets: ['c.b1', 'c.b2'] },
  place: { word: 'c.place', title: 'c.titlePlace', lead: 'c.leadPlace', tone: 'muted', bullets: ['c.b1'] },
  noData: { word: 'c.noData', title: 'c.titleNoData', lead: 'c.leadNoData', tone: 'muted', bullets: ['c.b1'] },
  flag: { word: 'c.flag', title: 'rhythm.irregular', lead: 'c.leadFlag', tone: 'alert', bullets: ['c.bFlag1', 'c.bFlag2'] },
};

function statusOf(state: ReadingState, rhythm: RhythmResult): Status {
  if (state === 'no-data') return 'noData';
  if (state === 'place') return 'place';
  if (rhythm.status === 'irregular') return 'flag';
  return state === 'hold' ? 'hold' : 'live';
}

const TONE_DOT: Record<Tone, string> = {
  signal: 'bg-signal',
  amber: 'bg-amber',
  alert: 'bg-alert',
  muted: 'bg-muted',
  label: 'bg-label',
  turmeric: 'bg-turmeric',
};

const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

/** Live console: status banner, beat chart, metric cards; event log and analysis on the right. */
export function Dashboard() {
  const { t, ago } = useI18n();
  const now = useNow(500);
  const kind = useSensorStore((s) => s.kind);
  const { latest, lastPacketAt } = useLiveStore();
  const state = readingState(latest, lastPacketAt, now);
  const ok = state === 'ok';
  const fingerOn = latest?.fingerStatus === FINGER_ON && state !== 'no-data';
  const rhythm = analyseRhythm(beatLog, now);
  const status = statusOf(state, rhythm);
  const s = STATUS[status];

  const sessions = useSessions(kind === 'sim' ? 'mock' : 'ble');
  const baseline = temperatureBaseline(sessions);
  const temp = fingerOn ? (latest?.skinTempC ?? null) : null;
  const drift = temp !== null && baseline.status === 'ready' ? temperatureDrift(temp, baseline.celsius) : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
      <TourStrip rhythm={rhythm} />
      {/* Status banner */}
      <section
        aria-label={t('status.aria')}
        aria-live="polite"
        className="grid gap-x-8 gap-y-3 rounded-[3px] border border-line bg-panel px-4 py-4 sm:grid-cols-[minmax(150px,auto)_minmax(0,1fr)] lg:col-span-2 lg:grid-cols-[minmax(190px,auto)_minmax(0,1fr)_auto] lg:items-center lg:px-5"
      >
        <p className={`text-[28px] leading-none font-medium tracking-tight lg:text-[34px] ${TONE_TEXT[s.tone]}`}>{t(s.word)}</p>
        <div className="min-w-0">
          <h1 className="text-[13px] font-semibold">
            {status === 'live' && latest?.hrBpm ? t('c.titleLive', { hr: latest.hrBpm }) : t(s.title, { hr: '' })}
          </h1>
          <p className="mt-0.5 text-[11px] text-label">
            {t('c.sub', { ago: lastPacketAt ? ago(lastPacketAt, now) : '––' })}
          </p>
          <p className="mt-2 text-[13px] font-semibold">{t(s.lead)}</p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-label">
            {s.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden className={`mt-[6px] size-1 shrink-0 rounded-full ${TONE_DOT[s.tone]}`} />
                {t(b)}
              </li>
            ))}
          </ul>
        </div>
        <dl className="flex gap-8 border-t border-line pt-3 sm:col-span-2 lg:col-span-1 lg:border-0 lg:pt-0">
          <Kpi label={t('c.signal')} value={fingerOn && latest ? `${latest.confidence}%` : '––'} tone={ok ? 'signal' : 'amber'} />
          <Kpi label={t('c.link')} value={lastPacketAt && now - lastPacketAt < 4000 ? t('c.live') : '––'} tone="signal" />
        </dl>
      </section>

      {/* Left: chart + cards */}
      <div className="min-w-0 space-y-3">
        <Panel
          flush
          label={t('c.chart')}
          aside={
            <>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-signal" />
                {t('c.clean')}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full border border-amber" />
                {t('c.moving')}
              </span>
            </>
          }
        >
          <div className="px-3.5 pb-3.5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
              <div aria-hidden className="flex flex-col justify-between py-1 text-right font-mono text-[10px] text-muted">
                <span>1.0</span>
                <span>0.5</span>
                <span>0</span>
              </div>
              <div className="rounded-[2px] bg-panel-2">
                <BeatStrip label={t('pulse.aria')} colorVar="--signal" className="h-48 lg:h-64" />
              </div>
              <span />
              <div aria-hidden className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                {[-6, -5, -4, -3, -2, -1, 0].map((n) => (
                  <span key={n}>{n === 0 ? t('pulse.now') : n}</span>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-label">{t('pulse.beatTiming')}</p>
          </div>
        </Panel>

        <section aria-label={t('vital.hr')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            name={t('vital.hr')}
            tag={ok ? { text: t('c.live'), tone: 'signal' } : { text: t(s.word), tone: s.tone === 'alert' ? 'amber' : s.tone }}
            tone={ok ? 'ok' : state === 'hold' ? 'hold' : 'idle'}
            rows={[
              { k: 'HR', v: ok && latest?.hrBpm ? `${latest.hrBpm}` : '––', unit: 'bpm' },
              { k: t('c.signal'), v: fingerOn && latest ? `${latest.confidence}%` : '––' },
            ]}
            footer={ok ? t('c.nominal') : t(s.title, { hr: '' })}
            battery={latest?.batteryPct}
          />
          <MetricCard
            name={t('vital.spo2')}
            tag={ok ? { text: t('c.live'), tone: 'signal' } : { text: t(s.word), tone: s.tone === 'alert' ? 'amber' : s.tone }}
            tone={ok ? 'ok' : state === 'hold' ? 'hold' : 'idle'}
            rows={[{ k: 'SpO₂', v: ok && latest?.spo2Pct ? `${latest.spo2Pct}` : '––', unit: '%' }]}
            footer={ok ? t('c.nominal') : t(s.title, { hr: '' })}
            battery={latest?.batteryPct}
          />
          <MetricCard
            name={t('vital.temp')}
            tag={temp !== null ? { text: t('c.live'), tone: 'signal' } : { text: t('c.place'), tone: 'muted' }}
            tone={temp !== null ? 'ok' : 'idle'}
            rows={[
              {
                k: '°C',
                v: temp !== null ? temp.toFixed(2) : '––',
                pred: baseline.status === 'ready' ? t('c.base', { v: baseline.celsius.toFixed(2) }) : t('home.baselineProgress', { n: baseline.sessions }),
                delta: drift !== null ? `${signed(drift)} °C` : undefined,
              },
            ]}
            footer={temp !== null ? t('c.nominal') : t('c.titlePlace')}
            battery={latest?.batteryPct}
          />
          <MetricCard
            name={t('vital.rhythm')}
            tag={
              rhythm.status === 'collecting'
                ? { text: t('home.measuring'), tone: 'label' }
                : rhythm.status === 'irregular'
                  ? { text: t('c.flag'), tone: 'alert' }
                  : { text: t('rhythm.tagRegular'), tone: 'signal' }
            }
            tone={rhythm.status === 'irregular' ? 'alarm' : rhythm.status === 'regular' ? 'ok' : 'idle'}
            rows={
              rhythm.status === 'collecting'
                ? [
                    { k: 'RMSSD', v: '––' },
                    { k: 'pNN50', v: '––' },
                  ]
                : [
                    { k: 'RMSSD', v: `${rhythm.rmssdMs}`, unit: 'ms' },
                    { k: 'pNN50', v: `${rhythm.pnn50}`, unit: '%', delta: rhythm.pnn50 >= PNN50_FLAG ? `≥ ${PNN50_FLAG}%` : undefined },
                  ]
            }
            footer={
              rhythm.status === 'collecting'
                ? `${t('home.measuring')} ${Math.round(rhythm.progress * 100)}%`
                : rhythm.status === 'irregular'
                  ? t('rhythm.tagIrregular')
                  : t('rhythm.window')
            }
            battery={latest?.batteryPct}
          />
        </section>
      </div>

      {/* Right column */}
      <div className="min-w-0 space-y-3">
        <EventLog />
        <RhythmAnalysis rhythm={rhythm} />
        <ValidationContext />
        <p className="px-1 text-[11px] text-muted">{t('app.disclaimer')}</p>
      </div>
    </div>
  );
}

const TOUR_TEXT: MessageKey[] = ['tour.s1', 'tour.s2', 'tour.s3', 'tour.s4'];

/** Labels the demo tour on screen (for the Stage 3 video): which step is running and what it shows. */
function TourStrip({ rhythm }: { rhythm: RhythmResult }) {
  const { t } = useI18n();
  const source = useSensorStore((s) => s.source);
  useNow(500);
  const tour = source instanceof SimulatedRing ? source.tourStatus() : null;
  if (!tour) return null;
  const last = tour.step === TOUR_STEPS.length;
  return (
    <section aria-label={t('tour.label')} className="rounded-[3px] border border-select/60 bg-select/10 px-4 py-2.5 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Tag tone="label">{t('tour.label')}</Tag>
        <span className="font-mono text-[12px] text-label">{t('tour.step', { n: tour.step, total: TOUR_STEPS.length })}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium">{t(TOUR_TEXT[tour.step - 1]!)}</span>
        {last && rhythm.status === 'collecting' && (
          <span className="font-mono text-[12px] text-label">{Math.round(rhythm.progress * 100)}%</span>
        )}
      </div>
      <ol aria-hidden className="mt-2 grid grid-cols-4 gap-1">
        {TOUR_STEPS.map((_, i) => (
          <li key={i} className={`h-1 rounded-full ${i < tour.step ? 'bg-select' : 'bg-line'}`} />
        ))}
      </ol>
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`mt-1 font-mono text-[20px] font-medium ${TONE_TEXT[tone]}`}>{value}</dd>
    </div>
  );
}

const CARD_BORDER = {
  ok: 'border-signal/50',
  hold: 'border-amber/60',
  alarm: 'border-alert/80',
  idle: 'border-line',
};

/** Like the node cards in the reference: name + tag, value rows with base/delta, status footer, battery. */
function MetricCard(props: {
  name: string;
  tag: { text: string; tone: Tone };
  tone: keyof typeof CARD_BORDER;
  rows: { k: string; v: string; unit?: string; pred?: string; delta?: string }[];
  footer: string;
  battery?: number;
}) {
  return (
    <article
      tabIndex={0}
      className={`flex min-w-0 flex-col rounded-[3px] border bg-panel p-3 transition-colors outline-none hover:border-select focus-visible:border-select ${CARD_BORDER[props.tone]}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <h3 className="text-[13px] font-semibold">{props.name}</h3>
        <Tag tone={props.tag.tone}>{props.tag.text}</Tag>
      </header>
      <dl className="mt-2.5 space-y-1">
        {props.rows.map((r) => (
          <div key={r.k} className="flex items-baseline gap-2">
            <dt className="w-12 shrink-0 truncate text-[11px] text-muted">{r.k}</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
              <span className="font-mono text-[15px] font-medium">
                {r.v}
                {r.unit && r.v !== '––' && <span className="ml-0.5 text-[11px] text-label">{r.unit}</span>}
              </span>
              {r.pred && <span className="text-[10.5px] text-label">{r.pred}</span>}
              {r.delta && <span className="ml-auto font-mono text-[12px] text-amber">{r.delta}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div aria-hidden className="min-h-3 flex-1" />
      <footer className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px] text-label">
        <span className="min-w-0 truncate">{props.footer}</span>
        {props.battery !== undefined && <Battery pct={props.battery} />}
      </footer>
    </article>
  );
}

function Battery({ pct }: { pct: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-muted">
      <svg aria-hidden viewBox="0 0 10 16" className="h-3 w-2">
        <rect x="2.5" y="0" width="5" height="2" fill="currentColor" />
        <rect x="0.75" y="2" width="8.5" height="13.25" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y={3.5 + 10.5 * (1 - pct / 100)} width="6" height={10.5 * (pct / 100)} fill={pct <= 15 ? 'var(--amber)' : 'var(--signal)'} />
      </svg>
      {pct}%
    </span>
  );
}

/** "Model analysis" for the rhythm screen: one big figure, method, and the numbers behind it. */
function RhythmAnalysis({ rhythm }: { rhythm: RhythmResult }) {
  const { t } = useI18n();
  const rows: { name: string; note: string; score: string; flagged: boolean }[] =
    rhythm.status === 'collecting'
      ? [{ name: t('home.measuring'), note: t('rhythm.window'), score: `${Math.round(rhythm.progress * 100)}%`, flagged: false }]
      : [
          { name: 'pNN50', note: `${t('c.rule')} ≥ ${PNN50_FLAG}%`, score: `${rhythm.pnn50}%`, flagged: rhythm.pnn50 >= PNN50_FLAG },
          {
            name: 'RMSSD / RR',
            note: `${t('c.rule')} ≥ ${NRMSSD_FLAG}`,
            score: (rhythm.rmssdMs / rhythm.meanRrMs).toFixed(2),
            flagged: rhythm.rmssdMs / rhythm.meanRrMs >= NRMSSD_FLAG,
          },
        ];
  const big: ReactNode =
    rhythm.status === 'collecting' ? (
      <>
        {Math.round(rhythm.progress * 100)}
        <span className="text-[13px]">%</span>
      </>
    ) : (
      rhythm.rmssdMs
    );
  return (
    <Panel label={t('c.analysis')} aside={<Tag tone="label">{t('c.screening')}</Tag>}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-[26px] font-medium">{big}</span>
        <span className="text-[12px] text-fg">{rhythm.status === 'collecting' ? t('home.measuring') : 'ms RMSSD'}</span>
      </p>
      <p className="text-[11px] text-label">{t('c.method')}</p>
      <h3 className="label mt-3 mb-1">{t('c.factors')}</h3>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-start gap-2 text-[12px]">
            <span aria-hidden className={`mt-[5px] size-1.5 shrink-0 rounded-full ${r.flagged ? 'bg-amber' : 'bg-turmeric'}`} />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{r.name}</span>
              <span className="block text-[11px] text-label">{r.note}</span>
            </span>
            <span className={`font-mono ${r.flagged ? 'text-amber' : 'text-label'}`}>{r.score}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Like the "context" panel in the reference: the latest validation session, if any. */
function ValidationContext() {
  const { t } = useI18n();
  const last = useValidations()[0];
  const s = last ? summarize(last) : null;
  return (
    <Panel label={t('c.validation')}>
      {last && s ? (
        <a href="#/validate" className="block text-[12px] text-label hover:text-fg">
          {t('c.lastVal', { id: last.volunteerId, hr: s.hr.diff ?? '––', spo2: s.spo2.diff ?? '––' })}
        </a>
      ) : (
        <a href="#/validate" className="block text-[12px] text-muted hover:text-fg">
          {t('c.noValidation')}
        </a>
      )}
    </Panel>
  );
}
