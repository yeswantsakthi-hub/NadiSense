import type { ReactElement } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { hasData, type TrendPoint } from '../dsp/trends';
import { useI18n } from '../i18n';
import { CHART } from '../lib/chartColors';

const DAY = 86_400_000;

/** Per-session trend charts for History: heart rate, temperature drift and rhythm (RMSSD). */
export default function Trends({ points }: { points: TrendPoint[] }) {
  const { t, lang } = useI18n();
  const day = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' });
  const time = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (points.length < 2) return <p className="mt-4 text-xs text-muted">{t('history.trendMore')}</p>;

  // One tick per local midnight, so a day with several sessions is labelled once.
  const first = new Date(points[0]!.at);
  first.setHours(0, 0, 0, 0);
  const lastAt = points[points.length - 1]!.at;
  const dayTicks: number[] = [];
  for (const d = new Date(first); d.getTime() <= lastAt + DAY; d.setDate(d.getDate() + 1)) dayTicks.push(d.getTime());
  const domainX: [number, number] = [dayTicks[0]!, dayTicks[dayTicks.length - 1]!];
  const hrAxis = niceAxis(points.map((p) => p.hr), 3, 5, 10);
  const driftAxis = niceAxis(points.map((p) => p.driftC), 0.1, 0.5, 0.5, 0.5);

  const axisX = (
    <XAxis
      dataKey="at"
      type="number"
      scale="time"
      domain={domainX}
      ticks={dayTicks}
      interval="preserveStartEnd"
      tickFormatter={(v: number) => day.format(v)}
      tick={{ fill: CHART.muted, fontSize: 10 }}
      stroke={CHART.line}
      minTickGap={24}
    />
  );
  const tip = (unit: string, digits = 0) => (
    <Tooltip
      cursor={{ stroke: CHART.line }}
      content={({ payload }) => {
        const p = payload?.[0];
        if (!p) return null;
        const pt = p.payload as TrendPoint;
        const v = p.value as number;
        return (
          <div className="rounded-xl border border-line-strong bg-panel px-2 py-1 text-[11px]">
            <p className="text-label">{time.format(pt.at)}</p>
            <p className="font-mono">
              {v > 0 && unit === '°C' ? '+' : ''}
              {v.toFixed(digits)} {unit}
              {pt.irregular && <span className="ml-1 text-alert">⚠ {t('rhythm.tagIrregular')}</span>}
            </p>
          </div>
        );
      }}
    />
  );

  return (
    <div className="mt-5 space-y-4">
      {hasData(points, 'hr') && (
        <Chart title={`${t('vital.hr')} · bpm`} label={t('history.trendAria', { metric: t('vital.hr') })}>
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            {axisX}
            <YAxis domain={hrAxis.domain} ticks={hrAxis.ticks} width={34} tick={{ fill: CHART.muted, fontSize: 10 }} stroke={CHART.line} allowDecimals={false} />
            {tip('bpm')}
            <Line dataKey="hr" stroke={CHART.signal} strokeWidth={2} dot={{ r: 2.5, fill: CHART.signal }} connectNulls isAnimationActive={false} />
          </LineChart>
        </Chart>
      )}

      {hasData(points, 'driftC') ? (
        <Chart title={`${t('history.trendDrift')} · °C`} label={t('history.trendAria', { metric: t('history.trendDrift') })}>
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            {axisX}
            <YAxis domain={driftAxis.domain} ticks={driftAxis.ticks} width={34} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: CHART.muted, fontSize: 10 }} stroke={CHART.line} />
            <ReferenceLine y={0} stroke={CHART.label} strokeDasharray="4 3" />
            {tip('°C', 1)}
            <Line dataKey="driftC" stroke={CHART.temp} strokeWidth={2} dot={{ r: 2.5, fill: CHART.temp }} connectNulls isAnimationActive={false} />
          </LineChart>
        </Chart>
      ) : (
        <p className="text-xs text-muted">{t('history.baselineWait')}</p>
      )}

      {hasData(points, 'rmssdMs') && (
        <Chart title={t('history.trendRhythm')} label={t('history.trendAria', { metric: t('history.trendRhythm') })}>
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            {axisX}
            <YAxis width={34} tick={{ fill: CHART.muted, fontSize: 10 }} stroke={CHART.line} allowDecimals={false} />
            {tip('ms')}
            <Line
              dataKey="rmssdMs"
              stroke={CHART.rhythm}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; payload?: TrendPoint; index?: number }) => (
                <circle
                  key={props.index}
                  cx={props.cx}
                  cy={props.cy}
                  r={props.payload?.irregular ? 4 : 2.5}
                  fill={props.payload?.irregular ? CHART.alert : CHART.rhythm}
                />
              )}
            />
          </LineChart>
        </Chart>
      )}
      {points.some((p) => p.irregular) && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-label">
          <span aria-hidden className="size-2 rounded-full bg-alert" />
          {t('history.flaggedDot')}
        </p>
      )}
    </div>
  );
}

/** Axis rounded to `unit` with ticks every `step` (doubled when there would be too many). */
function niceAxis(values: (number | null)[], pad: number, unit: number, step: number, minAbs = 0) {
  const v = values.filter((x): x is number => x !== null);
  let lo = Math.floor((Math.min(...v) - pad) / unit) * unit;
  let hi = Math.ceil((Math.max(...v) + pad) / unit) * unit;
  // Keep zero (no drift) in view with at least ±minAbs around it.
  if (minAbs > 0) {
    lo = Math.min(-minAbs, lo);
    hi = Math.max(minAbs, hi);
  }
  let s = step;
  while ((hi - lo) / s > 5) s *= 2;
  const ticks: number[] = [];
  for (let x = Math.ceil(lo / s) * s; x <= hi + 1e-9; x += s) ticks.push(Math.round(x * 100) / 100);
  return { domain: [lo, hi] as [number, number], ticks };
}

function Chart({ title, label, children }: { title: string; label: string; children: ReactElement }) {
  return (
    <figure>
      <figcaption className="label mb-2">{title}</figcaption>
      <div role="img" aria-label={label} className="h-36 rounded-lg bg-panel-2 pt-2 pr-1">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
