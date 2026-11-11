import { useState } from 'react';
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel, Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { useI18n, type MessageKey } from '../i18n';
import { CHART } from '../lib/chartColors';
import { shareFile } from '../lib/shareFile';
import { useValidations } from '../store/db';
import { metricAccuracy, sessionsFor, type AgreementPoint, type Metric, type MetricAccuracy } from '../validation/accuracy';

const METRICS: { metric: Metric; name: MessageKey; unit: string; digits: number }[] = [
  { metric: 'hr', name: 'vital.hr', unit: 'bpm', digits: 1 },
  { metric: 'spo2', name: 'vital.spo2', unit: '%', digits: 1 },
  { metric: 'temp', name: 'vital.temp', unit: '°C', digits: 2 },
];

type Source = 'ring' | 'sim';

/** Stage 3 accuracy report: Bland–Altman agreement of the ring vs. reference devices, with a PDF export. */
export function Accuracy() {
  const { t } = useI18n();
  const all = useValidations();
  const hasRing = all.some((s) => s.source === 'ring');
  const [picked, setPicked] = useState<Source | null>(null);
  const source: Source = picked ?? (hasRing ? 'ring' : 'sim');
  const sessions = sessionsFor(all, source);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const exportPdf = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { buildAccuracyPdf } = await import('../validation/pdfReport');
      const blob = await buildAccuracyPdf(sessions, source);
      const r = await shareFile(`nadisense-accuracy-${source}-${new Date().toISOString().slice(0, 10)}.pdf`, blob, 'application/pdf');
      if (r !== 'cancelled') setMessage(t('acc.pdfDone'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <Panel label={t('acc.title')} aside={<span className="font-mono">{sessions.length}</span>}>
        <div className="max-w-xs">
          <Segmented<Source>
            legend={t('acc.source')}
            value={source}
            options={[
              { value: 'ring', label: t('acc.ring') },
              { value: 'sim', label: t('acc.sim') },
            ]}
            onChange={setPicked}
          />
        </div>
        {source === 'sim' && <p className="mt-3 text-xs text-amber">{t('acc.simNote')}</p>}
        <p className="mt-3 text-xs leading-relaxed text-label">{t('acc.method')}</p>
        <button
          type="button"
          disabled={busy || sessions.length === 0}
          onClick={exportPdf}
          className="mt-4 h-11 w-full rounded-xl btn-primary text-sm font-semibold text-brand-ink transition hover:btn-primary/90 disabled:opacity-50"
        >
          {t('acc.pdf')}
        </button>
        {message && (
          <p role="status" className="mt-2 text-xs text-signal">
            {message}
          </p>
        )}
      </Panel>

      {METRICS.map((m) => (
        <MetricPanel key={m.metric} {...m} accuracy={metricAccuracy(sessions, m.metric)} />
      ))}

      <a href="#/validate" className="block text-center text-sm text-label underline underline-offset-4 hover:text-fg">
        ← {t('nav.validate')}
      </a>
      <p className="px-1 text-[11px] text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}

function MetricPanel({ metric, name, unit, digits, accuracy: a }: { metric: Metric; name: MessageKey; unit: string; digits: number; accuracy: MetricAccuracy | null }) {
  const { t } = useI18n();
  const f = (v: number | null) => (v === null ? '––' : v.toFixed(digits));
  return (
    <Panel
      label={`${t(name)} · ${unit}`}
      aside={a && <Tag tone={a.withinPct >= 80 ? 'signal' : 'amber'}>{t('acc.within', { tol: `${a.tolerance} ${unit}` })} {a.withinPct}%</Tag>}
    >
      {!a ? (
        <p className="text-sm text-muted">{t('acc.none')}</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 sm:grid-cols-6">
            <Stat k={t('acc.sessions')} v={`${a.n}`} />
            <Stat k={t('acc.bias')} v={f(a.bias)} />
            <Stat k={t('acc.sd')} v={f(a.sd)} />
            <Stat k={t('acc.loa')} v={a.loaLow === null ? '––' : `${f(a.loaLow)} … ${f(a.loaHigh)}`} wide />
            <Stat k={t('acc.mae')} v={f(a.mae)} />
            <Stat k={t(metric === 'spo2' ? 'acc.arms' : 'acc.rmse')} v={f(a.rmse)} />
          </dl>
          {a.sd === null && <p className="mt-2 text-xs text-muted">{t('acc.needTwo')}</p>}
          {metric === 'temp' && <p className="mt-2 text-xs text-label">{t('acc.tempNote')}</p>}
          <BlandAltman a={a} label={t('acc.chartAria', { metric: t(name) })} />
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-label">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-4 bg-signal" />
              {t('acc.bias')}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-0 w-4 border-t border-dashed border-amber" />
              {t('acc.loa')}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-4 bg-signal/15" />
              {t('acc.within', { tol: `${a.tolerance} ${unit}` })}
            </span>
          </p>
        </>
      )}
    </Panel>
  );
}

function niceMax(v: number): number {
  for (const step of [0.2, 0.4, 1, 2, 4, 6, 10, 20, 40]) if (v <= step) return step;
  return Math.ceil(v / 20) * 20;
}

function Stat({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-1' : ''}>
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className="font-mono text-[15px] font-medium">{v}</dd>
    </div>
  );
}

function BlandAltman({ a, label }: { a: MetricAccuracy; label: string }) {
  const { t } = useI18n();
  const extent = Math.max(a.tolerance, ...a.points.map((p) => Math.abs(p.diff)), Math.abs(a.loaLow ?? 0), Math.abs(a.loaHigh ?? 0));
  // Round up to a step that gives tidy ticks at ±max and ±max/2.
  const yMax = niceMax(extent * 1.15);
  return (
    <figure role="img" aria-label={label} className="mt-3 h-56 rounded-lg bg-panel-2 pt-2 pr-2">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 6, right: 8, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} />
          <ReferenceArea y1={-a.tolerance} y2={a.tolerance} fill={CHART.signal} fillOpacity={0.1} stroke="none" />
          <XAxis
            type="number"
            dataKey="mean"
            domain={['dataMin - 2', 'dataMax + 2']}
            tickFormatter={(v: number) => v.toFixed(0)}
            tick={{ fill: CHART.muted, fontSize: 10 }}
            stroke={CHART.line}
            label={{ value: t('acc.xAxis'), position: 'insideBottom', offset: -10, fill: CHART.label, fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="diff"
            domain={[-yMax, yMax]}
            ticks={[-yMax, -yMax / 2, 0, yMax / 2, yMax]}
            tickFormatter={(v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1))}
            width={40}
            tick={{ fill: CHART.muted, fontSize: 10 }}
            stroke={CHART.line}
          />
          <ReferenceLine y={a.bias} stroke={CHART.signal} strokeWidth={1.5} />
          {a.loaLow !== null && <ReferenceLine y={a.loaLow} stroke={CHART.amber} strokeDasharray="4 3" />}
          {a.loaHigh !== null && <ReferenceLine y={a.loaHigh} stroke={CHART.amber} strokeDasharray="4 3" />}
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as AgreementPoint | undefined;
              if (!p) return null;
              return (
                <div className="rounded-xl border border-line-strong bg-panel px-2 py-1 text-[11px]">
                  <p className="font-semibold">{p.volunteerId}</p>
                  <p className="font-mono text-label">
                    {t('acc.ringCol')} {p.ring} · {t('acc.reference')} {p.reference} · {t('acc.diff')} {p.diff > 0 ? '+' : ''}
                    {p.diff}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={a.points} fill={CHART.fg} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </figure>
  );
}
