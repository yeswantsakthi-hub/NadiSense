import type { ReactNode } from 'react';
import { BeatStrip } from '../components/BeatStrip';
import { EventLog } from '../components/EventLog';
import { ChartIcon, CheckListIcon, GearIcon, HeartIcon, InfoIcon, SparkIcon, BluetoothIcon, ChevronIcon } from '../components/icons';
import { Tag } from '../components/Panel';
import { SessionPanel } from '../components/SessionPanel';
import { temperatureBaseline, temperatureDrift } from '../dsp/baseline';
import { analyseRhythm, RHYTHM_WINDOW_MS, type RhythmResult } from '../dsp/rhythm';
import { useI18n, type MessageKey } from '../i18n';
import { clockTime } from '../lib/format';
import { useNow } from '../lib/useNow';
import { FINGER_ON } from '../ring/contract';
import { readingState, type ReadingState } from '../ring/readings';
import { useSessions, useValidations } from '../store/db';
import { beatLog, useLiveStore, type EventLevel } from '../store/liveStore';
import { scenarioKey, useSensorStore } from '../store/sensorStore';
import { nextVolunteerId } from '../validation/model';

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

const signedDeg = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)} °C`;

/** Home, laid out like an Indian super app: brand band, live card, services, banners, activity. */
export function Dashboard() {
  const { t } = useI18n();
  const now = useNow(500);
  const { kind, scenario } = useSensorStore();
  const { latest, lastPacketAt } = useLiveStore();
  const state = readingState(latest, lastPacketAt, now);
  const ok = state === 'ok';
  const fingerOn = latest?.fingerStatus === FINGER_ON && state !== 'no-data';
  const rhythm = analyseRhythm(beatLog, now);

  const sessions = useSessions(kind === 'sim' ? 'mock' : 'ble');
  const baseline = temperatureBaseline(sessions);
  const temp = fingerOn ? (latest?.skinTempC ?? null) : null;
  const drift = temp !== null && baseline.status === 'ready' ? temperatureDrift(temp, baseline.celsius) : null;
  const stateText = ok ? null : t(STATE_TEXT[state]);

  return (
    <div className="pb-4">
      {/* Brand band continues from the header; the live card overlaps it. */}
      <section className="-mx-4 bg-signal px-4 pt-2 pb-16 text-brand-ink">
        <h1 className="text-[22px] font-bold">{t(greetingKey(new Date(now).getHours()))}</h1>
        <p className="mt-0.5 text-sm text-white/80">
          {kind === 'sim' ? t('home.sim', { scenario: t(scenarioKey(scenario)) }) : t('home.live')}
        </p>
      </section>

      <section
        aria-label={t('vital.hr')}
        className="relative -mt-12 rounded-2xl border border-line bg-panel shadow-[0_4px_16px_rgba(16,24,40,0.08)]"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-label">
              <HeartIcon key={ok ? latest?.beatSeq : 'idle'} className={`size-[18px] text-hr ${ok ? 'beat-pop' : ''}`} />
              {t('vital.hr')}
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className={`font-mono text-[44px] leading-none font-bold ${ok ? 'text-fg' : 'text-line-strong'}`}>
                {ok && latest?.hrBpm ? latest.hrBpm : '--'}
              </span>
              <span className="text-sm font-medium text-muted">bpm</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-right">
            <dt className="text-xs text-muted">{t('vital.spo2')}</dt>
            <dt className="text-xs text-muted">{t('vital.temp')}</dt>
            <dd className="font-mono text-lg font-bold text-spo2">{ok && latest?.spo2Pct ? `${latest.spo2Pct}%` : '--'}</dd>
            <dd className="font-mono text-lg font-bold text-temp">
              {drift !== null ? signedDeg(drift) : temp !== null ? `${temp.toFixed(1)}°` : '--'}
            </dd>
          </dl>
        </div>

        {stateText ? (
          <p
            role="status"
            className={`mx-4 mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
              state === 'hold' ? 'bg-amber/10 text-amber' : 'bg-panel-2 text-label'
            }`}
          >
            {stateText}
          </p>
        ) : null}

        <BeatStrip label={t('pulse.aria')} colorVar="--hr" className="mt-2 h-20" />
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
          <span>{t('pulse.beatTiming')}</span>
          <span>
            {fingerOn && latest ? t('home.signal', { pct: latest.confidence }) : ''}
            {drift === null && baseline.status === 'building' && temp !== null
              ? ` · ${t('home.baselineProgress', { n: baseline.sessions })}`
              : ''}
          </span>
        </div>
      </section>

      <Services />

      <RhythmBanner rhythm={rhythm} />
      <ValidationBanner />

      <RecentActivity />

      <details className="group mt-3 rounded-2xl border border-line bg-panel">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium text-label [&::-webkit-details-marker]:hidden">
          {t('home.details')}
          <ChevronIcon className="size-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <SessionPanel />
          <EventLog />
        </div>
      </details>

      <p className="mt-4 text-center text-[11px] text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}

/** Icon grid of everything the app can do; v2 items carry a "Soon" badge. */
function Services() {
  const { t } = useI18n();
  const items: { href: string; label: string; icon: (p: { className?: string }) => ReactNode; tint: string; soon?: boolean }[] = [
    { href: '#/validate', label: t('nav.validate'), icon: CheckListIcon, tint: 'bg-signal/10 text-signal' },
    { href: '#/history', label: t('nav.history'), icon: ChartIcon, tint: 'bg-spo2/10 text-spo2' },
    { href: '#/report', label: t('svc.doctor'), icon: HeartIcon, tint: 'bg-hr/10 text-hr' },
    { href: '#/settings', label: t('svc.ring'), icon: BluetoothIcon, tint: 'bg-temp/10 text-temp' },
    { href: '#/nadi', label: t('nav.nadi'), icon: SparkIcon, tint: 'bg-rhythm/10 text-rhythm', soon: true },
    { href: '#/ecg', label: t('svc.ecg'), icon: HeartIcon, tint: 'bg-hr/10 text-hr', soon: true },
    { href: '#/settings', label: t('lang.label'), icon: InfoIcon, tint: 'bg-spo2/10 text-spo2' },
    { href: '#/settings', label: t('nav.settings'), icon: GearIcon, tint: 'bg-panel-2 text-label' },
  ];
  return (
    <section aria-labelledby="services-title" className="mt-4 rounded-2xl border border-line bg-panel px-3 pt-4 pb-3">
      <h2 id="services-title" className="px-1 text-[15px] font-semibold">
        {t('home.services')}
      </h2>
      <ul className="mt-3 grid grid-cols-4 gap-y-4">
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href} className="group flex flex-col items-center gap-1.5 rounded-xl px-1 py-1 text-center">
              <span className={`relative grid size-12 place-items-center rounded-2xl ${it.tint} transition group-hover:scale-105`}>
                <it.icon className="size-6" />
                {it.soon && (
                  <span className="absolute -top-1.5 -right-2 rounded-full bg-amber px-1.5 py-px text-[9px] font-bold text-white">
                    {t('svc.soon')}
                  </span>
                )}
              </span>
              <span className="text-[11.5px] leading-tight font-medium text-fg [overflow-wrap:anywhere]">{it.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Rhythm screen as a banner card: progress while measuring, then the result with the disclaimer. */
function RhythmBanner({ rhythm }: { rhythm: RhythmResult }) {
  const { t } = useI18n();
  const irregular = rhythm.status === 'irregular';
  const collecting = rhythm.status === 'collecting';
  return (
    <section
      aria-label={t('vital.rhythm')}
      aria-live="polite"
      className={`mt-3 rounded-2xl border p-4 ${irregular ? 'border-alert/40 bg-alert/5' : 'border-rhythm/20 bg-rhythm/5'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{t('vital.rhythm')}</h2>
        {collecting ? (
          <Tag>{t('tag.pending')}</Tag>
        ) : (
          <Tag tone={irregular ? 'alert' : 'signal'}>{irregular ? t('rhythm.tagIrregular') : t('rhythm.tagRegular')}</Tag>
        )}
      </div>
      {collecting ? (
        <>
          <p className="mt-1 text-sm text-label">
            {t('insight.collecting', {
              secs: Math.max(5, Math.round(((1 - rhythm.progress) * RHYTHM_WINDOW_MS) / 1000)),
            })}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rhythm.progress * 100)}
            aria-label={t('vital.rhythm')}
            className="mt-3 h-2 overflow-hidden rounded-full bg-white"
          >
            <div className="h-full rounded-full bg-rhythm transition-[width]" style={{ width: `${rhythm.progress * 100}%` }} />
          </div>
        </>
      ) : (
        <>
          <p className={`mt-1 text-base font-semibold ${irregular ? 'text-alert' : 'text-fg'}`}>
            {irregular ? t('rhythm.irregular') : t('rhythm.regular')}
          </p>
          <p className="mt-0.5 font-mono text-xs text-label">{t('rhythm.metrics', { rmssd: rhythm.rmssdMs, pnn50: rhythm.pnn50 })}</p>
        </>
      )}
      <p className="mt-3 text-[11px] text-muted">
        {t('rhythm.window')} · {t('app.disclaimer')}
      </p>
    </section>
  );
}

/** Shortcut for accuracy testing, with the next volunteer code ready. */
function ValidationBanner() {
  const { t } = useI18n();
  const sessions = useValidations();
  return (
    <a
      href="#/validate"
      className="mt-3 flex items-center gap-3 rounded-2xl border border-temp/25 bg-temp/5 p-4 transition hover:bg-temp/10"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-temp/15 text-temp">
        <CheckListIcon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{t('val.title')}</span>
        <span className="block text-sm text-label">{t('val.nextVolunteer', { id: nextVolunteerId(sessions[0]?.volunteerId ?? null) })}</span>
      </span>
      <ChevronIcon className="size-5 text-muted" />
    </a>
  );
}

const DOT: Record<EventLevel, string> = { live: 'bg-signal', info: 'bg-line-strong', motion: 'bg-amber', alert: 'bg-alert' };

/** Latest events as a transaction-style list. */
function RecentActivity() {
  const { t } = useI18n();
  const events = useLiveStore((s) => s.events).slice(0, 4);
  if (!events.length) return null;
  return (
    <section aria-labelledby="recent-title" className="mt-3 rounded-2xl border border-line bg-panel px-4 pt-4 pb-1">
      <h2 id="recent-title" className="text-[15px] font-semibold">
        {t('home.recent')}
      </h2>
      <ul className="mt-1 divide-y divide-line">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3">
            <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${DOT[e.level]}`} />
            <span className="min-w-0 flex-1 text-sm">{t(e.key, e.vars?.scenario ? { ...e.vars, scenario: t(scenarioKey(e.vars.scenario as never)) } : e.vars)}</span>
            <time className="font-mono text-xs text-muted">{clockTime(e.at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
