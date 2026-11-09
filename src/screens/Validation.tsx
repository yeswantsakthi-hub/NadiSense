import { useEffect, useRef, useState } from 'react';
import { Field } from '../components/Field';
import { Panel, Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { useI18n, type MessageKey } from '../i18n';
import { duration } from '../lib/format';
import { shareFile } from '../lib/shareFile';
import { useNow } from '../lib/useNow';
import { db, useValidations } from '../store/db';
import { useSensorStore } from '../store/sensorStore';
import {
  DEFAULT_DURATION_S,
  DURATIONS_S,
  isTrustworthy,
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

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const fmt = (v: number | null, digits = 0) => (v === null ? '––' : v.toFixed(digits));
/** "+1.2", "-0.4", "0.0": never "-0". */
const signed = (v: number | null, digits = 1) => {
  if (v === null) return '––';
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? '+' : ''}${(Object.is(r, -0) ? 0 : r).toFixed(digits)}`;
};

/** Stage 3 accuracy testing: ring vs fingertip oximeter and thermometer, stored on the phone. */
export function Validation() {
  const { t } = useI18n();
  const { source, kind } = useSensorStore();
  const sessions = useValidations();
  const [phase, setPhase] = useState<Phase>({ step: 'setup' });
  const [volunteer, setVolunteer] = useState('');
  const [plannedS, setPlannedS] = useState<number>(DEFAULT_DURATION_S);
  const [idError, setIdError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const start = () => {
    if (!source) return;
    if (!validVolunteerId(volunteer)) return setIdError(true);
    setIdError(false);
    setMessage(null);
    const startedAt = Date.now();
    setPhase({
      step: 'running',
      draft: {
        id: `${startedAt}-${volunteer.trim()}`,
        volunteerId: volunteer.trim(),
        startedAt,
        endedAt: null,
        plannedS,
        source: kind,
        samples: [],
      },
    });
  };

  const exportAll = async () => {
    const all = await db.validations.orderBy('startedAt').toArray();
    const r = await shareFile(`nadisense-accuracy-${new Date().toISOString().slice(0, 10)}.csv`, summaryCsv(all));
    if (r !== 'cancelled') setMessage(t('val.exported'));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3 pt-2">
      <h1 className="text-xl font-semibold">{t('val.title')}</h1>

      {phase.step === 'setup' && (
        <Panel label={t('val.new')} aside={kind === 'sim' && source ? <Tag tone="amber">{t('val.simTag')}</Tag> : undefined}>
          <p className="text-sm text-label">{t('val.intro')}</p>
          <div className="mt-3 space-y-3">
            <Field
              label={t('val.volunteer')}
              value={volunteer}
              onChange={(v) => {
                setVolunteer(v);
                setIdError(false);
              }}
              hint={t('val.volunteerHint')}
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={20}
            />
            {idError && (
              <p role="alert" className="text-sm text-alert">
                {t('val.invalidId')}
              </p>
            )}
            <Segmented<string>
              legend={t('val.duration')}
              value={String(plannedS)}
              options={DURATIONS_S.map((s) => ({ value: String(s), label: t('val.minutes', { n: s / 60 }) }))}
              onChange={(v) => setPlannedS(Number(v))}
            />
            {kind === 'sim' && source && <p className="text-xs text-amber">{t('val.simWarning')}</p>}
            {source ? (
              <button
                type="button"
                onClick={start}
                className="h-11 w-full rounded-xl bg-signal font-semibold text-bg hover:bg-signal/85"
              >
                {t('val.start')}
              </button>
            ) : (
              <a
                href="#/connect"
                className="flex h-11 w-full items-center justify-center rounded-xl border border-signal/60 font-semibold"
              >
                {t('val.needRing')}
              </a>
            )}
          </div>
        </Panel>
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
            onClick={() => setPhase({ step: 'setup' })}
            className="h-11 w-full rounded-xl bg-signal font-semibold text-bg hover:bg-signal/85"
          >
            {t('val.newSession')}
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
              className="mb-2 h-10 w-full rounded-xl border border-signal/60 text-sm font-semibold hover:bg-signal/10"
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

/** Records every packet for the planned time; shows a countdown and live usable-sample count. */
function Recorder({ draft, onFinish, onCancel }: { draft: Draft; onFinish(d: Draft): void; onCancel(): void }) {
  const { t } = useI18n();
  const source = useSensorStore((s) => s.source);
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

  const pct = 100 - (100 * left) / (draft.plannedS * 1000);
  return (
    <Panel label={t('val.running')} aside={<Tag tone="signal">{draft.volunteerId}</Tag>}>
      <p className="font-mono text-5xl font-semibold">{duration(left + 999)}</p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={t('val.running')}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg"
      >
        <div className="h-full rounded-full bg-signal" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-label">
        {t('val.samples', { n: count.n, valid: count.n ? Math.round((100 * count.ok) / count.n) : 0 })}
      </p>
      <p className="mt-1 text-xs text-muted">{t('val.hold')}</p>
      {!source && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {t('reading.noData')}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={finish}
          className="h-10 flex-1 rounded-xl border border-line-strong text-sm font-semibold hover:border-fg/60"
        >
          {t('val.stop')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-xl border border-line px-4 text-sm text-label hover:border-line-strong"
        >
          {t('val.cancel')}
        </button>
      </div>
    </Panel>
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
    <Panel label={t('val.refTitle')} aside={<Tag tone="signal">{draft.volunteerId}</Tag>}>
      <p className="text-sm text-label">{t('val.refHint')}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('val.refHr')} value={form.hr} onChange={set('hr')} inputMode="numeric" />
        <Field label={t('val.refSpo2')} value={form.spo2} onChange={set('spo2')} inputMode="numeric" />
        <Field label={t('val.refTemp')} value={form.temp} onChange={set('temp')} inputMode="decimal" />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {t(error)}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={save} className="h-11 flex-1 rounded-xl bg-signal font-semibold text-bg hover:bg-signal/85">
          {t('val.save')}
        </button>
        <button
          type="button"
          onClick={() => window.confirm(t('val.confirmDiscard')) && onDiscard()}
          className="h-11 rounded-xl border border-line px-4 text-sm text-label hover:border-line-strong"
        >
          {t('val.discard')}
        </button>
      </div>
    </Panel>
  );
}

/** Ring mean vs reference, and the difference, for one session. */
function SummaryCard({ session }: { session: ValidationSession }) {
  const { t } = useI18n();
  const s = summarize(session);
  const row = (label: string, c: Comparison, unit: string, digits: number) => (
    <tr>
      <th scope="row" className="py-2 pr-3 text-left font-medium">
        {label}
      </th>
      <td className="py-2 pr-3 text-right font-mono">{fmt(c.ring, digits)}</td>
      <td className="py-2 pr-3 text-right font-mono">{fmt(c.reference, digits)}</td>
      <td className="py-2 text-right font-mono font-semibold">
        {signed(c.diff)} {c.diff !== null ? unit : ''}
      </td>
    </tr>
  );
  return (
    <Panel
      label={t('val.summary')}
      aside={<Tag tone={session.source === 'sim' ? 'amber' : 'signal'}>{session.volunteerId}</Tag>}
      className="border-signal/50"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-sm">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="label py-2 pr-3 text-left">
                {t('val.colMeasure')}
              </th>
              <th scope="col" className="label py-2 pr-3 text-right">
                {t('val.colRing')}
              </th>
              <th scope="col" className="label py-2 pr-3 text-right">
                {t('val.colRef')}
              </th>
              <th scope="col" className="label py-2 text-right">
                {t('val.colDiff')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {row(t('val.hr'), s.hr, 'bpm', 0)}
            {row('SpO₂', s.spo2, '%', 0)}
            {row(t('val.temp'), s.temp, '°C', 1)}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-label">{t('val.valid', { valid: s.validPct, n: s.samples })}</p>
      {s.temp.diff !== null && <p className="mt-1 text-xs text-muted">{t('val.tempNote')}</p>}
      {session.source === 'sim' && <p className="mt-1 text-xs text-amber">{t('val.simWarning')}</p>}
    </Panel>
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
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <span className="font-semibold">{session.volunteerId}</span>
        {session.source === 'sim' && <Tag tone="amber">{t('link.sim')}</Tag>}
        <span className="text-xs text-label">
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
              className="h-9 flex-1 rounded-xl border border-line-strong text-xs font-semibold hover:border-fg/60"
            >
              {t('val.exportSamples')}
            </button>
            <button
              type="button"
              onClick={() => window.confirm(t('val.confirmDelete')) && db.validations.delete(session.id)}
              className="h-9 rounded-xl border border-alert/60 px-3 text-xs font-semibold text-alert hover:bg-alert/10"
            >
              {t('val.delete')}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
