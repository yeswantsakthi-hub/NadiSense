import { useEffect, useRef, useState } from 'react';
import { Field } from '../components/Field';
import { Panel, Tag } from '../components/Panel';
import { RingGauge } from '../components/RingGauge';
import { useI18n, type MessageKey } from '../i18n';
import { duration } from '../lib/format';
import { shareFile } from '../lib/shareFile';
import { useNow } from '../lib/useNow';
import { shownVitals } from '../ring/readings';
import { db, useValidations } from '../store/db';
import { useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';
import {
  DEFAULT_DURATION_S,
  DURATIONS_S,
  TOLERANCE,
  agreement,
  isTrustworthy,
  nextVolunteerId,
  samplesCsv,
  summarize,
  summaryCsv,
  validReference,
  validVolunteerId,
  type Comparison,
  type Reference,
  type ValidationSample,
  type ValidationSession,
} from '../validation/model';

type Draft = Omit<ValidationSession, 'reference' | 'endedAt'> & { endedAt: number | null };
type Phase = { step: 'setup' } | { step: 'running'; draft: Draft } | { step: 'reference'; draft: Draft } | { step: 'done'; id: string };
const STEP_INDEX: Record<Phase['step'], number> = { setup: 0, running: 1, reference: 2, done: 3 };
const STEP_KEYS: MessageKey[] = ['val.step1', 'val.step2', 'val.step3', 'val.step4'];

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const fmt = (v: number | null, digits = 0) => (v === null ? '––' : v.toFixed(digits));
/** "+1.2", "-0.4", "0.0": never "-0". */
const signed = (v: number | null, digits = 1) => {
  if (v === null) return '––';
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? '+' : ''}${(Object.is(r, -0) ? 0 : r).toFixed(digits)}`;
};

/** Stage 3 accuracy testing, built for running many volunteers in a row. */
export function Validation() {
  const { t } = useI18n();
  const { source, kind } = useSensorStore();
  const sessions = useValidations();
  const [phase, setPhase] = useState<Phase>({ step: 'setup' });
  const [volunteer, setVolunteer] = useState('');
  const [touched, setTouched] = useState(false);
  const [plannedS, setPlannedS] = useState<number>(DEFAULT_DURATION_S);
  const [idError, setIdError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Suggest the next code after the last saved session (V01 → V02), until the person types.
  const suggested = nextVolunteerId(sessions[0]?.volunteerId ?? null);
  const code = touched ? volunteer : suggested;

  const start = () => {
    if (!source) return;
    if (!validVolunteerId(code)) return setIdError(true);
    setIdError(false);
    setMessage(null);
    const startedAt = Date.now();
    setPhase({
      step: 'running',
      draft: {
        id: `${startedAt}-${code.trim()}`,
        volunteerId: code.trim(),
        startedAt,
        endedAt: null,
        plannedS,
        source: kind,
        samples: [],
      },
    });
  };

  const nextVolunteer = () => {
    setTouched(false);
    setPhase({ step: 'setup' });
  };

  const exportAll = async () => {
    const all = await db.validations.orderBy('startedAt').toArray();
    const r = await shareFile(`nadisense-accuracy-${new Date().toISOString().slice(0, 10)}.csv`, summaryCsv(all));
    if (r !== 'cancelled') setMessage(t('val.exported'));
  };

  return (
    <div className="space-y-4 pt-2">
      <header>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{t('val.title')}</h1>
        <p className="mt-0.5 text-sm text-label">{t('val.subtitle')}</p>
      </header>

      <Stepper current={STEP_INDEX[phase.step]} />

      {phase.step === 'setup' && (
        <section className="rounded-[3px] border border-line bg-panel p-5">
          {kind === 'sim' && source && (
            <p className="mb-3 rounded-[3px] bg-amber/10 px-3 py-2 text-xs text-amber">{t('val.simWarning')}</p>
          )}
          <Field
            label={t('val.volunteer')}
            value={code}
            onChange={(v) => {
              setTouched(true);
              setVolunteer(v);
              setIdError(false);
            }}
            hint={t('val.volunteerHint')}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={20}
          />
          {idError && (
            <p role="alert" className="mt-2 text-sm text-alert">
              {t('val.invalidId')}
            </p>
          )}

          <p className="label mt-4 mb-2">{t('val.duration')}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('val.duration')}>
            {DURATIONS_S.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === plannedS}
                onClick={() => setPlannedS(s)}
                className={`rounded-[2px] px-4 py-2 text-sm font-medium transition ${
                  s === plannedS ? 'border border-signal bg-signal/15 text-signal' : 'border border-line text-label hover:text-fg'
                }`}
              >
                {t('val.minutes', { n: s / 60 })}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted">{t('val.intro')}</p>

          {source ? (
            <button
              type="button"
              onClick={start}
              className="mt-5 h-14 w-full rounded-[3px] bg-signal text-base font-semibold text-brand-ink transition hover:bg-signal/90"
            >
              {t('val.startFor', { id: code.trim() || '––' })}
            </button>
          ) : (
            <a
              href="#/connect"
              className="mt-5 flex h-14 w-full items-center justify-center rounded-[3px] border border-signal/60 font-semibold"
            >
              {t('val.needRing')}
            </a>
          )}
        </section>
      )}

      {phase.step === 'running' && (
        <Recorder
          draft={phase.draft}
          onFinish={(draft) => setPhase({ step: 'reference', draft })}
          onCancel={() => setPhase({ step: 'setup' })}
        />
      )}

      {phase.step === 'reference' && (
        <ReferenceForm
          draft={phase.draft}
          onSaved={(id) => setPhase({ step: 'done', id })}
          onDiscard={() => setPhase({ step: 'setup' })}
        />
      )}

      {phase.step === 'done' && (
        <>
          {sessions
            .filter((s) => s.id === phase.id)
            .map((s) => (
              <SummaryCard key={s.id} session={s} />
            ))}
          <button
            type="button"
            onClick={nextVolunteer}
            className="h-14 w-full rounded-[3px] bg-signal text-base font-semibold text-brand-ink transition hover:bg-signal/90"
          >
            {t('val.nextVolunteer', { id: nextVolunteerId(sessions[0]?.volunteerId ?? null) })}
          </button>
        </>
      )}

      <Panel label={t('val.past')} aside={<span className="font-mono">{sessions.length}</span>}>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">{t('val.none')}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={exportAll}
              className="mb-3 h-11 w-full rounded-[3px] border border-signal/60 text-sm font-semibold transition hover:bg-signal/10"
            >
              {t('val.exportAll')}
            </button>
            {message && (
              <p role="status" className="mb-2 text-xs text-signal">
                {message}
              </p>
            )}
            <ul className="divide-y divide-line">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const { t } = useI18n();
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={t('val.steps')}>
      {STEP_KEYS.map((key, i) => (
        <li key={key} aria-current={i === current ? 'step' : undefined} className="min-w-0">
          <span className={`block h-1 rounded-full ${i <= current ? 'bg-signal' : 'bg-panel-2'}`} />
          <span className={`mt-1.5 block truncate text-[11px] ${i === current ? 'font-medium text-fg' : 'text-muted'}`}>
            {t(key)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Records every packet for the planned time, inside a countdown ring with the live readings. */
function Recorder({ draft, onFinish, onCancel }: { draft: Draft; onFinish(d: Draft): void; onCancel(): void }) {
  const { t } = useI18n();
  const source = useSensorStore((s) => s.source);
  const { latest, lastPacketAt } = useLiveStore();
  const now = useNow(250);
  const samples = useRef<ValidationSample[]>([]);
  const [count, setCount] = useState({ n: 0, ok: 0 });
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onFinish({ ...draft, endedAt: Date.now(), samples: samples.current });
  };

  useEffect(() => {
    if (!source) return;
    const off = source.onPacket((p, receivedAt) => {
      if (done.current) return;
      samples.current.push({ ...p, receivedAt });
      setCount((c) => ({ n: c.n + 1, ok: c.ok + (isTrustworthy(p) ? 1 : 0) }));
    });
    return off;
  }, [source]);

  const left = Math.max(0, draft.startedAt + draft.plannedS * 1000 - now);
  useEffect(() => {
    if (left === 0) finish();
  });

  const vitals = shownVitals(latest, lastPacketAt, now);
  const usable = count.n ? Math.round((100 * count.ok) / count.n) : 0;
  return (
    <section className="flex flex-col items-center rounded-[3px] border border-line bg-panel px-5 pt-6 pb-5">
      <Tag tone="signal">{draft.volunteerId}</Tag>
      <RingGauge
        value={1 - left / (draft.plannedS * 1000)}
        size={220}
        stroke={12}
        sweep={300}
        label={`${t('val.running')} ${duration(left + 999)}`}
        className="mt-3"
      >
        <span className="font-mono text-6xl leading-none font-bold">{duration(left + 999)}</span>
        <span className="mt-2 text-xs text-label">{t('val.running')}</span>
      </RingGauge>

      <dl className="mt-2 grid w-full grid-cols-3 gap-2 text-center">
        <div className="rounded-[3px] bg-panel-2 py-2">
          <dt className="text-[11px] text-muted">{t('val.hr')}</dt>
          <dd className="font-mono text-lg">{vitals.hrBpm ?? '––'}</dd>
        </div>
        <div className="rounded-[3px] bg-panel-2 py-2">
          <dt className="text-[11px] text-muted">SpO₂</dt>
          <dd className="font-mono text-lg">{vitals.spo2Pct ?? '––'}</dd>
        </div>
        <div className="rounded-[3px] bg-panel-2 py-2">
          <dt className="text-[11px] text-muted">{t('val.usable')}</dt>
          <dd className={`font-mono text-lg ${usable < 60 && count.n > 10 ? 'text-amber' : ''}`}>{usable}%</dd>
        </div>
      </dl>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">{t('val.hold')}</p>
      {!source && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {t('reading.noData')}
        </p>
      )}
      <div className="mt-4 flex w-full gap-2">
        <button
          type="button"
          onClick={finish}
          className="h-12 flex-1 rounded-[3px] bg-panel-2 text-sm font-semibold transition hover:bg-line-strong"
        >
          {t('val.stop')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-[3px] px-5 text-sm text-label transition hover:text-fg"
        >
          {t('val.cancel')}
        </button>
      </div>
    </section>
  );
}

function ReferenceForm({ draft, onSaved, onDiscard }: { draft: Draft; onSaved(id: string): void; onDiscard(): void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ hr: '', spo2: '', temp: '' });
  const [error, setError] = useState<MessageKey | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const reference: Reference = { hrBpm: num(form.hr), spo2Pct: num(form.spo2), tempC: num(form.temp) };
    if (!validReference(reference)) return setError('val.invalidRef');
    try {
      await db.validations.put({ ...draft, endedAt: draft.endedAt ?? Date.now(), reference });
      onSaved(draft.id);
    } catch {
      setError('err.generic');
    }
  };

  return (
    <section className="rounded-[3px] border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('val.refTitle')}</h2>
        <Tag tone="signal">{draft.volunteerId}</Tag>
      </div>
      <p className="mt-1 text-sm text-label">{t('val.refHint')}</p>
      <div className="mt-4 space-y-3">
        <Field label={t('val.refHr')} value={form.hr} onChange={set('hr')} inputMode="numeric" placeholder="72" />
        <Field label={t('val.refSpo2')} value={form.spo2} onChange={set('spo2')} inputMode="numeric" placeholder="98" />
        <Field label={t('val.refTemp')} value={form.temp} onChange={set('temp')} inputMode="decimal" placeholder="36.6" />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-alert">
          {t(error)}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        className="mt-5 h-14 w-full rounded-[3px] bg-signal text-base font-semibold text-brand-ink transition hover:bg-signal/90"
      >
        {t('val.save')}
      </button>
      <button
        type="button"
        onClick={() => window.confirm(t('val.confirmDiscard')) && onDiscard()}
        className="mt-2 h-11 w-full rounded-[3px] text-sm text-label transition hover:text-fg"
      >
        {t('val.discard')}
      </button>
    </section>
  );
}

/** Ring mean vs reference, the difference, and whether it is within the display tolerance. */
function SummaryCard({ session }: { session: ValidationSession }) {
  const { t } = useI18n();
  const s = summarize(session);
  const row = (label: string, c: Comparison, unit: string, digits: number, tolerance: number | null) => {
    const a = tolerance === null ? null : agreement(c, tolerance);
    return (
      <li className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="font-mono text-xs text-label">
            {t('val.ringVsRef', { ring: fmt(c.ring, digits), ref: fmt(c.reference, digits) })}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold">
            {signed(c.diff)} <span className="text-xs text-label">{c.diff !== null ? unit : ''}</span>
          </p>
          {a && (
            <p className={`text-[11px] ${a === 'within' ? 'text-signal' : 'text-amber'}`}>
              {t(a === 'within' ? 'val.within' : 'val.outside', { tol: tolerance!, unit })}
            </p>
          )}
        </div>
      </li>
    );
  };
  return (
    <section className={`rounded-[3px] border bg-panel px-5 pt-4 pb-3 ${session.source === 'sim' ? 'border-amber/40' : 'border-signal/40'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('val.summary')}</h2>
        <Tag tone={session.source === 'sim' ? 'amber' : 'signal'}>{session.volunteerId}</Tag>
      </div>
      <ul className="mt-1 divide-y divide-line">
        {row(t('val.hr'), s.hr, 'bpm', 0, TOLERANCE.hr)}
        {row('SpO₂', s.spo2, '%', 0, TOLERANCE.spo2)}
        {row(t('val.temp'), s.temp, '°C', 1, null)}
      </ul>
      <p className="mt-1 text-xs text-label">{t('val.valid', { valid: s.validPct, n: s.samples })}</p>
      {s.temp.diff !== null && <p className="mt-1 text-[11px] text-muted">{t('val.tempNote')}</p>}
      {session.source === 'sim' && <p className="mt-1 text-[11px] text-amber">{t('val.simWarning')}</p>}
    </section>
  );
}

function SessionRow({ session }: { session: ValidationSession }) {
  const { t, date } = useI18n();
  const [open, setOpen] = useState(false);
  const s = summarize(session);
  const time = new Date(session.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const exportSamples = () =>
    shareFile(`nadisense-${session.volunteerId}-${new Date(session.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, '')}.csv`, samplesCsv(session));

  return (
    <li className="py-2">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 py-1 text-left">
        <span className="font-medium">{session.volunteerId}</span>
        {session.source === 'sim' && <Tag tone="amber">{t('link.sim')}</Tag>}
        <span className="text-xs text-muted">
          {date(session.startedAt)} · {time}
        </span>
        <span className="ml-auto font-mono text-xs text-label">
          HR {signed(s.hr.diff)} · SpO₂ {signed(s.spo2.diff)}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <SummaryCard session={session} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportSamples}
              className="h-10 flex-1 rounded-[3px] bg-panel-2 text-xs font-semibold transition hover:bg-line-strong"
            >
              {t('val.exportSamples')}
            </button>
            <button
              type="button"
              onClick={() => window.confirm(t('val.confirmDelete')) && db.validations.delete(session.id)}
              className="h-10 rounded-[3px] border border-alert/50 px-4 text-xs font-semibold text-alert transition hover:bg-alert/10"
            >
              {t('val.delete')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
