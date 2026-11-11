import type { ReactNode } from 'react';
import { BeatStrip } from '../components/BeatStrip';
import { EventLog } from '../components/EventLog';
import { CheckIcon, DropIcon, HeartIcon, ThermoIcon, WaveIcon } from '../components/icons';
import { Panel, Tag, TONE_TEXT, type Tone } from '../components/Panel';
import { temperatureBaseline, temperatureDrift } from '../dsp/baseline';
import { analyseRhythm, NRMSSD_FLAG, PNN50_FLAG, type RhythmResult } from '../dsp/rhythm';
import { useI18n, type MessageKey } from '../i18n';
import { useNow } from '../lib/useNow';
import { FINGER_ON, MIN_CONFIDENCE } from '../ring/contract';
import { readingState, type ReadingState } from '../ring/readings';
import { SimulatedRing, TOUR_STEPS } from '../ring/SimulatedRing';
import { useSessions, useValidations } from '../store/db';
import { beatLog, packetLog, useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';
import { isTrustworthy, summarize } from '../validation/model';

type Status = 'live' | 'hold' | 'place' | 'noData' | 'flag';

const STATUS: Record<Status, { word: MessageKey; title: MessageKey; lead: MessageKey; tone: Tone }> = {
  live: { word: 'c.live', title: 'c.titleLive', lead: 'c.leadLive', tone: 'signal' },
  hold: { word: 'c.hold', title: 'c.titleHold', lead: 'c.leadHold', tone: 'amber' },
  place: { word: 'c.place', title: 'c.titlePlace', lead: 'c.leadPlace', tone: 'muted' },
  noData: { word: 'c.noData', title: 'c.titleNoData', lead: 'c.leadNoData', tone: 'muted' },
  flag: { word: 'c.flag', title: 'rhythm.irregular', lead: 'c.leadFlag', tone: 'alert' },
};

function statusOf(state: ReadingState, rhythm: RhythmResult): Status {
  if (state === 'no-data') return 'noData';
  if (state === 'place') return 'place';
  if (rhythm.status === 'irregular') return 'flag';
  return state === 'hold' ? 'hold' : 'live';
}

const signed = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(digits)}`;

/** Live screen: heart-rate dial and pulse, the reading gate, vitals with trends, and the session. */
export function Dashboard() {
  const { t } = useI18n();
  const now = useNow(500);
  const kind = useSensorStore((s) => s.kind);
  const { latest, lastPacketAt } = useLiveStore();
  const state = readingState(latest, lastPacketAt, now);
  const ok = state === 'ok';
  const fingerOn = latest?.fingerStatus === FINGER_ON && state !== 'no-data';
  const rhythm = analyseRhythm(beatLog, now);
  const status = statusOf(state, rhythm);

  const sessions = useSessions(kind === 'sim' ? 'mock' : 'ble');
  const baseline = temperatureBaseline(sessions);
  const temp = fingerOn ? (latest?.skinTempC ?? null) : null;
  const drift = temp !== null && baseline.status === 'ready' ? temperatureDrift(temp, baseline.celsius) : null;
  const recent = packetLog.filter((r) => r.at > now - 10 * 60_000);

  return (
    <div className="space-y-4">
      <TourStrip rhythm={rhythm} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Hero status={status} now={now} />
          <div className="grid gap-4 sm:grid-cols-3">
            <VitalCard
              icon={DropIcon}
              color="var(--spo2)"
              name={t('vital.spo2')}
              value={ok && latest?.spo2Pct ? `${latest.spo2Pct}` : null}
              unit="%"
              sub={ok ? t('c.nominal') : t(STATUS[status].title, { hr: '' })}
              series={recent.filter((r) => isTrustworthy(r.p) && r.p.spo2Pct !== null).map((r) => r.p.spo2Pct!)}
            />
            <VitalCard
              icon={ThermoIcon}
              color="var(--temp)"
              name={t('vital.temp')}
              value={drift !== null ? signed(drift) : temp !== null ? temp.toFixed(1) : null}
              unit="°C"
              sub={
                drift !== null && baseline.status === 'ready'
                  ? t('c.base', { v: baseline.celsius.toFixed(1) })
                  : baseline.status === 'building'
                    ? t('home.baselineProgress', { n: baseline.sessions })
                    : t('c.titlePlace')
              }
              series={recent.filter((r) => r.p.fingerStatus === FINGER_ON && r.p.skinTempC !== null).map((r) => r.p.skinTempC!)}
            />
            <RhythmCard rhythm={rhythm} />
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <RhythmAnalysis rhythm={rhythm} />
          <EventLog />
          <ValidationContext />
          <p className="px-1 text-[11.5px] leading-relaxed text-muted">{t('app.disclaimer')}</p>
        </aside>
      </div>
    </div>
  );
}

/* ───────────── Hero: dial + pulse + reading gate ───────────── */

const STATUS_RING: Record<Status, string> = {
  live: 'ring-signal/20',
  hold: 'ring-amber/25',
  place: 'ring-line',
  noData: 'ring-line',
  flag: 'ring-alert/45',
};

function Hero({ status, now }: { status: Status; now: number }) {
  const { t, ago } = useI18n();
  const { latest, lastPacketAt } = useLiveStore();
  const s = STATUS[status];
  const ok = status === 'live' || status === 'flag';
  const hr = ok && latest?.hrBpm ? latest.hrBpm : null;
  const fingerOn = latest?.fingerStatus === FINGER_ON && status !== 'noData';
  const gate: { key: MessageKey; pass: boolean }[] = [
    { key: 'c.b1', pass: fingerOn },
    { key: 'c.b2', pass: fingerOn && (latest?.confidence ?? 0) >= MIN_CONFIDENCE },
    { key: 'c.b3', pass: fingerOn && !latest?.motion },
  ];

  return (
    <section aria-label={t('status.aria')} className={`surface relative overflow-hidden rounded-3xl ring-1 ${STATUS_RING[status]}`}>
      {status === 'flag' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_220px_at_20%_0,rgba(255,77,94,0.14),transparent_70%)]" />
      )}
      <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-5 lg:px-6">
        <StatusPill status={status} />
        <p aria-live="polite" className="min-w-0 flex-1 text-[15px] font-medium">
          {status === 'live' && latest?.hrBpm ? t('c.titleLive', { hr: latest.hrBpm }) : t(s.title, { hr: '' })}
        </p>
        <p className="font-mono text-[11.5px] text-muted">{lastPacketAt ? ago(lastPacketAt, now) : '––'}</p>
      </header>

      <div className="relative grid items-center gap-2 px-3 pt-2 pb-5 md:grid-cols-[250px_minmax(0,1fr)] md:gap-5 md:px-5 lg:px-6">
        <Dial hr={hr} beat={latest?.beatSeq ?? 0} dim={!ok} />
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <span className="label truncate">{t('c.chart')}</span>
            <span className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-hr" />
                {t('c.clean')}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-3 rounded-full bg-amber" />
                {t('c.moving')}
              </span>
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl bg-black/35 ring-1 ring-line">
            <BeatStrip label={t('pulse.aria')} colorVar="--hr" className="h-40 lg:h-48" />
          </div>
          <div aria-hidden className="mt-1.5 flex justify-between px-1 font-mono text-[10px] text-muted">
            {[-6, -5, -4, -3, -2, -1, 0].map((n) => (
              <span key={n}>{n === 0 ? t('pulse.now') : `${n}s`}</span>
            ))}
          </div>
        </div>
      </div>

      <footer className="relative grid gap-3 border-t border-line bg-black/20 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-6">
        <div className="min-w-0">
          <p className="label">{t('p.gate')}</p>
          <p className={`mt-1 text-[13.5px] font-medium ${status === 'live' ? 'text-fg' : TONE_TEXT[s.tone === 'muted' ? 'label' : s.tone]}`}>
            {t(s.lead)}
          </p>
          {status === 'flag' && (
            <p className="mt-1 text-[12px] text-label">
              {t('c.bFlag1')} · {t('c.bFlag2')}
            </p>
          )}
        </div>
        <ul className="flex flex-wrap gap-2">
          {gate.map((g) => (
            <li
              key={g.key}
              className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-[12px] ring-1 ${
                g.pass ? 'bg-signal/10 text-fg ring-signal/25' : 'bg-white/[0.03] text-muted ring-line-strong'
              }`}
            >
              <span aria-hidden className={`grid size-[18px] place-items-center rounded-full ${g.pass ? 'bg-signal text-bg' : 'bg-white/10 text-transparent'}`}>
                <CheckIcon className="size-3" />
              </span>
              <span className="sr-only">{g.pass ? '✓' : '✗'}</span>
              {t(g.key)}
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}

function StatusPill({ status }: { status: Status }) {
  const { t } = useI18n();
  const styles: Record<Status, string> = {
    live: 'bg-signal/12 text-signal ring-signal/30',
    hold: 'bg-amber/12 text-amber ring-amber/30',
    place: 'bg-white/5 text-label ring-line-strong',
    noData: 'bg-white/5 text-label ring-line-strong',
    flag: 'bg-alert text-white ring-alert',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11.5px] font-semibold tracking-[0.08em] uppercase ring-1 ${styles[status]}`}>
      {status === 'flag' ? (
        <span aria-hidden>⚠</span>
      ) : (
        <span aria-hidden className="relative flex size-2">
          {status === 'live' && <span className="ping absolute inset-0 rounded-full bg-current" />}
          <span className="relative size-2 rounded-full bg-current" />
        </span>
      )}
      {t(STATUS[status].word)}
    </span>
  );
}

const DIAL_MIN = 40;
const DIAL_MAX = 180;
const SWEEP = 270;

/** Instrument dial: tick ring lit up to the heart rate, the number in the middle, the heart beating per beat. */
function Dial({ hr, beat, dim }: { hr: number | null; beat: number; dim: boolean }) {
  const { t } = useI18n();
  const size = 240;
  const c = size / 2;
  const ticks = 57;
  const frac = hr === null ? 0 : Math.min(1, Math.max(0, (hr - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)));
  const lit = Math.round(frac * (ticks - 1));
  const angle = (f: number) => ((-SWEEP / 2 + SWEEP * f - 90) * Math.PI) / 180;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[230px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id="dial-lit" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff9a5c" />
            <stop offset="1" stopColor="#ff4d6d" />
          </linearGradient>
          <radialGradient id="dial-face">
            <stop offset="0" stopColor="rgba(255,93,108,0.12)" />
            <stop offset="0.75" stopColor="rgba(255,93,108,0)" />
          </radialGradient>
        </defs>
        {!dim && <circle cx={c} cy={c} r={95} fill="url(#dial-face)" />}
        <circle cx={c} cy={c} r={90} fill="none" stroke="rgba(255,255,255,0.05)" />
        {Array.from({ length: ticks }, (_, i) => {
          const a = angle(i / (ticks - 1));
          const major = i % 8 === 0;
          const on = !dim && hr !== null && i <= lit;
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * (major ? 99 : 102)}
              y1={c + Math.sin(a) * (major ? 99 : 102)}
              x2={c + Math.cos(a) * 112}
              y2={c + Math.sin(a) * 112}
              stroke={on ? 'url(#dial-lit)' : 'rgba(255,255,255,0.13)'}
              strokeWidth={major ? 2.8 : 2}
              strokeLinecap="round"
            />
          );
        })}
        {[40, 80, 120, 160].map((b) => {
          const a = angle((b - DIAL_MIN) / (DIAL_MAX - DIAL_MIN));
          return (
            <text key={b} x={c + Math.cos(a) * 82} y={c + Math.sin(a) * 82 + 3.5} textAnchor="middle" className="fill-muted font-mono" fontSize="10">
              {b}
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <HeartIcon key={dim ? 'dim' : beat} className={`size-[22px] ${dim ? 'text-muted' : 'beat-pop text-hr'}`} />
        <p className={`tabular mt-1 text-[62px] leading-none font-semibold tracking-[-0.035em] ${dim ? 'text-muted/50' : 'text-fg'}`}>{hr ?? '––'}</p>
        <p className="mt-2 font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">bpm</p>
        <span className="sr-only">{t('vital.hr')}</span>
      </div>
    </div>
  );
}

/* ───────────── Vital cards ───────────── */

function VitalCard(props: {
  icon: (p: { className?: string }) => ReactNode;
  color: string;
  name: string;
  value: string | null;
  unit: string;
  sub: string;
  series: number[];
}) {
  const Icon = props.icon;
  return (
    <article className="surface flex min-w-0 flex-col rounded-2xl p-4">
      <header className="flex items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${props.color} 15%, transparent)`, color: props.color }}
        >
          <Icon className="size-[18px]" />
        </span>
        <h3 className="min-w-0 truncate text-[13.5px] font-medium text-label">{props.name}</h3>
      </header>
      <p className="mt-3.5 flex items-baseline gap-1">
        <span className={`tabular text-[34px] leading-none font-semibold tracking-[-0.025em] ${props.value === null ? 'text-muted/50' : ''}`}>
          {props.value ?? '––'}
        </span>
        {props.value !== null && <span className="text-[13px] text-label">{props.unit}</span>}
      </p>
      <p className="mt-1.5 truncate text-[12px] text-muted">{props.sub}</p>
      <Sparkline values={props.series} color={props.color} />
    </article>
  );
}

/** Last-10-minute trend, downsampled; an empty track until there are a few points. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 200;
  const H = 40;
  const step = Math.max(1, Math.floor(values.length / 60));
  const v = values.filter((_, i) => i % step === 0);
  if (v.length < 4) return <div aria-hidden className="mt-3 h-10 rounded-lg bg-white/[0.025]" />;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((y, i) => [(i / (v.length - 1)) * W, H - 4 - ((y - lo) / span) * (H - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-10 w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function RhythmCard({ rhythm }: { rhythm: RhythmResult }) {
  const { t } = useI18n();
  const flagged = rhythm.status === 'irregular';
  const pct = rhythm.status === 'collecting' ? Math.round(rhythm.progress * 100) : 100;
  return (
    <article className={`surface flex min-w-0 flex-col rounded-2xl p-4 ${flagged ? 'ring-1 ring-alert/55' : ''}`}>
      <header className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-rhythm/15 text-rhythm">
          <WaveIcon className="size-[18px]" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-label">{t('vital.rhythm')}</h3>
        {rhythm.status !== 'collecting' && <Tag tone={flagged ? 'alert' : 'signal'}>{flagged ? t('rhythm.tagIrregular') : t('rhythm.tagRegular')}</Tag>}
      </header>
      {rhythm.status === 'collecting' ? (
        <div className="mt-3.5 flex items-center gap-3">
          <ProgressRing pct={pct} />
          <div className="min-w-0">
            <p className="text-[14px] font-medium">{t('home.measuring')}</p>
            <p className="text-[12px] text-muted">{t('rhythm.window')}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3.5 flex items-baseline gap-1">
            <span className={`tabular text-[34px] leading-none font-semibold tracking-[-0.025em] ${flagged ? 'text-alert' : ''}`}>{rhythm.rmssdMs}</span>
            <span className="text-[13px] text-label">ms RMSSD</span>
          </p>
          <p className="mt-1.5 text-[12px] text-muted">pNN50 {rhythm.pnn50}%</p>
        </>
      )}
      <p className="mt-auto pt-3 text-[11px] leading-snug text-muted">{t('app.disclaimer')}</p>
    </article>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 20;
  const len = 2 * Math.PI * r;
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 48 48" className="size-12 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--rhythm)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(len * pct) / 100} ${len}`} />
      </svg>
      <span className="tabular absolute inset-0 grid place-items-center font-mono text-[11px]">{pct}%</span>
    </div>
  );
}

/* ───────────── Tour strip and side column ───────────── */

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
    <section aria-label={t('tour.label')} className="surface rounded-2xl px-4 py-3 ring-1 ring-brand/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="rounded-full bg-brand/15 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-[0.08em] text-brand uppercase">{t('tour.label')}</span>
        <span className="font-mono text-[12px] text-label">{t('tour.step', { n: tour.step, total: TOUR_STEPS.length })}</span>
        <span className="min-w-0 flex-1 text-[13.5px] font-medium">{t(TOUR_TEXT[tour.step - 1]!)}</span>
        {last && rhythm.status === 'collecting' && <span className="font-mono text-[12px] text-label">{Math.round(rhythm.progress * 100)}%</span>}
      </div>
      <ol aria-hidden className="mt-2.5 grid grid-cols-4 gap-1.5">
        {TOUR_STEPS.map((_, i) => (
          <li key={i} className={`h-1 rounded-full ${i < tour.step ? 'bg-brand' : 'bg-white/10'}`} />
        ))}
      </ol>
    </section>
  );
}

/** The numbers behind the rhythm screen, as bars against the flag limits. */
function RhythmAnalysis({ rhythm }: { rhythm: RhythmResult }) {
  const { t } = useI18n();
  const rows =
    rhythm.status === 'collecting'
      ? []
      : [
          {
            name: 'pNN50',
            limit: `≥ ${PNN50_FLAG}%`,
            score: `${rhythm.pnn50}%`,
            frac: Math.min(1, rhythm.pnn50 / 100),
            mark: PNN50_FLAG / 100,
            flagged: rhythm.pnn50 >= PNN50_FLAG,
          },
          {
            name: 'RMSSD / RR',
            limit: `≥ ${NRMSSD_FLAG}`,
            score: (rhythm.rmssdMs / rhythm.meanRrMs).toFixed(2),
            frac: Math.min(1, rhythm.rmssdMs / rhythm.meanRrMs / 0.4),
            mark: NRMSSD_FLAG / 0.4,
            flagged: rhythm.rmssdMs / rhythm.meanRrMs >= NRMSSD_FLAG,
          },
        ];
  return (
    <Panel label={t('c.analysis')} aside={<Tag tone="label">{t('c.screening')}</Tag>}>
      <p className="text-[12px] text-muted">{t('c.method')}</p>
      {rows.length === 0 ? (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-rhythm" style={{ width: `${rhythm.status === 'collecting' ? rhythm.progress * 100 : 100}%` }} />
          </div>
          <p className="mt-2 text-[12.5px] text-label">{t('home.measuring')}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3.5">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex items-baseline gap-2 text-[12.5px]">
                <span className="font-medium">{r.name}</span>
                <span className="font-mono text-[11px] text-muted">
                  {t('c.rule')} {r.limit}
                </span>
                <span className={`tabular ml-auto font-mono font-semibold ${r.flagged ? 'text-alert' : 'text-fg'}`}>{r.score}</span>
              </div>
              <div className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                <div className={`h-full rounded-full ${r.flagged ? 'bg-alert' : 'bg-rhythm'}`} style={{ width: `${r.frac * 100}%` }} />
                <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-fg/70" style={{ left: `${r.mark * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** The latest validation session, as a shortcut card. */
function ValidationContext() {
  const { t } = useI18n();
  const last = useValidations()[0];
  const s = last ? summarize(last) : null;
  return (
    <a href="#/validate" className="surface group flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-panel-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
        <CheckIcon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label block">{t('c.validation')}</span>
        <span className="mt-0.5 block truncate text-[13px] text-label group-hover:text-fg">
          {last && s ? t('c.lastVal', { id: last.volunteerId, hr: s.hr.diff ?? '––', spo2: s.spo2.diff ?? '––' }) : t('c.noValidation')}
        </span>
      </span>
      <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-fg">
        →
      </span>
    </a>
  );
}
