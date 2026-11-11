/**
 * One-page-per-section PDF of the accuracy report, for judges and the Stage 3 submission.
 * English only: the PDF's built-in fonts can't draw Indic scripts. jsPDF is loaded on demand.
 */
import { translate, type MessageKey, type Vars } from '../i18n';
import { metricAccuracy, type Metric, type MetricAccuracy } from './accuracy';
import { summarize, type ValidationSession } from './model';

const en = (key: MessageKey, vars?: Vars) => pdfSafe(translate('en', key, vars));

/** The PDF's standard fonts only cover Latin-1: swap the few symbols the app uses. */
export function pdfSafe(text: string): string {
  return text
    .replace(/₂/g, '2')
    .replace(/[−–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/·/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\xff]/g, '');
}

const METRICS: { metric: Metric; name: MessageKey; unit: string; digits: number }[] = [
  { metric: 'hr', name: 'vital.hr', unit: 'bpm', digits: 1 },
  { metric: 'spo2', name: 'vital.spo2', unit: '%', digits: 1 },
  { metric: 'temp', name: 'vital.temp', unit: 'C', digits: 2 },
];

const fmt = (v: number | null, digits = 1) => (v === null ? '-' : v.toFixed(digits));

export async function buildAccuracyPdf(sessions: readonly ValidationSession[], source: 'ring' | 'sim'): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  let y = M;

  const text = (s: string, x: number, size = 10, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(s, x, y);
  };
  const wrap = (s: string, size = 9, color: [number, number, number] = [80, 80, 80]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, W - 2 * M) as string[];
    doc.text(lines, M, y);
    y += lines.length * size * 0.42 + 1.5;
  };

  text('NadiSense', M, 18, 'bold');
  y += 7;
  text(en('acc.title'), M, 13, 'bold');
  y += 6;
  wrap(en('acc.generated', { date: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', n: sessions.length, source: en(source === 'ring' ? 'acc.ring' : 'acc.sim') }));
  if (source === 'sim') wrap(en('acc.simNote'), 9, [180, 90, 0]);
  wrap(en('acc.method'));
  wrap(en('app.disclaimer'), 9, [160, 40, 30]);
  y += 2;

  for (const m of METRICS) {
    const a = metricAccuracy(sessions, m.metric);
    if (y > 230) {
      doc.addPage();
      y = M;
    }
    doc.setDrawColor(200);
    doc.line(M, y, W - M, y);
    y += 6;
    text(`${en(m.name)} (${m.unit})`, M, 11, 'bold');
    y += 5;
    if (!a) {
      wrap(en('acc.none'));
      continue;
    }
    const stats = [
      `${en('acc.sessions')}: ${a.n}`,
      `${en('acc.bias')}: ${fmt(a.bias, m.digits)}`,
      `${en('acc.sd')}: ${fmt(a.sd, m.digits)}`,
      `${en('acc.loa')}: ${a.loaLow === null ? '-' : `${fmt(a.loaLow, m.digits)} .. ${fmt(a.loaHigh, m.digits)}`}`,
      `${en('acc.mae')}: ${fmt(a.mae, m.digits)}`,
      `${en(m.metric === 'spo2' ? 'acc.arms' : 'acc.rmse')}: ${fmt(a.rmse, m.digits)}`,
      `${en('acc.within', { tol: `${a.tolerance} ${m.unit}` })}: ${a.withinPct}%`,
    ];
    wrap(stats.join('   '), 9, [20, 20, 20]);
    if (a.sd === null) wrap(en('acc.needTwo'));
    if (m.metric === 'temp') wrap(en('acc.tempNote'));
    drawPlot(doc, a, M, y, W - 2 * M, 48);
    y += 56;
  }

  // Per-session table.
  doc.addPage();
  y = M;
  text(en('acc.table'), M, 12, 'bold');
  y += 7;
  const cols = [M, M + 22, M + 52, M + 80, M + 108, M + 140, M + 166];
  const head = [en('acc.volunteer'), 'HR ring/ref', 'HR diff', 'SpO2 ring/ref', 'SpO2 diff', 'Temp diff', en('acc.valid')];
  head.forEach((h, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(60);
    doc.text(pdfSafe(h), cols[i]!, y);
  });
  y += 2;
  doc.line(M, y, W - M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20);
  for (const s of sessions) {
    if (y > 282) {
      doc.addPage();
      y = M;
    }
    const v = summarize(s);
    const row = [
      s.volunteerId,
      `${fmt(v.hr.ring)} / ${fmt(v.hr.reference, 0)}`,
      fmt(v.hr.diff),
      `${fmt(v.spo2.ring)} / ${fmt(v.spo2.reference, 0)}`,
      fmt(v.spo2.diff),
      fmt(v.temp.diff, 2),
      `${v.validPct}%`,
    ];
    row.forEach((c, i) => doc.text(pdfSafe(c), cols[i]!, y));
    y += 5.5;
  }
  return doc.output('blob');
}

type Doc = InstanceType<typeof import('jspdf').jsPDF>;

/** Bland–Altman plot: one dot per session, bias line, 95 % limits (dashed), tolerance band. */
function drawPlot(doc: Doc, a: MetricAccuracy, x: number, y: number, w: number, h: number) {
  const xs = a.points.map((p) => p.mean);
  const ds = a.points.map((p) => p.diff);
  const lines = [a.bias, a.loaLow, a.loaHigh, a.tolerance, -a.tolerance].filter((v): v is number => v !== null);
  let yMax = Math.max(...ds.map(Math.abs), ...lines.map(Math.abs)) * 1.15 || 1;
  yMax = Math.ceil(yMax * 10) / 10;
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  if (xMax - xMin < 1) {
    xMin -= 1;
    xMax += 1;
  }
  const pad = (xMax - xMin) * 0.08;
  xMin -= pad;
  xMax += pad;
  const left = x + 12;
  const plotW = w - 12;
  const px = (v: number) => left + ((v - xMin) / (xMax - xMin)) * plotW;
  const py = (v: number) => y + h / 2 - (v / yMax) * (h / 2);

  doc.setFillColor(232, 245, 235);
  doc.rect(left, py(a.tolerance), plotW, py(-a.tolerance) - py(a.tolerance), 'F');
  doc.setDrawColor(160);
  doc.setLineWidth(0.2);
  doc.rect(left, y, plotW, h);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110);
  for (const v of [yMax, 0, -yMax]) doc.text(v.toFixed(1), x, py(v) + 1);
  doc.text(xMin.toFixed(1), left, y + h + 4);
  doc.text(xMax.toFixed(1), left + plotW, y + h + 4, { align: 'right' });
  doc.text(pdfSafe(translate('en', 'acc.xAxis')), left + plotW / 2, y + h + 4, { align: 'center' });

  doc.setDrawColor(40, 150, 70);
  doc.setLineWidth(0.5);
  doc.line(left, py(a.bias), left + plotW, py(a.bias));
  if (a.loaLow !== null && a.loaHigh !== null) {
    doc.setDrawColor(220, 130, 30);
    doc.setLineDashPattern([1.5, 1], 0);
    doc.line(left, py(a.loaLow), left + plotW, py(a.loaLow));
    doc.line(left, py(a.loaHigh), left + plotW, py(a.loaHigh));
    doc.setLineDashPattern([], 0);
  }
  doc.setFillColor(30, 30, 30);
  for (const p of a.points) doc.circle(px(p.mean), py(p.diff), 0.9, 'F');
}
