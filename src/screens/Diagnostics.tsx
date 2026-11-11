import type { ReactNode } from 'react';
import { CheckIcon } from '../components/icons';
import { useI18n, type MessageKey } from '../i18n';
import { useNow } from '../lib/useNow';
import { FINGER_ON } from '../ring/contract';
import { diagnose, DIAG_WINDOW_MS, hex, MAX_GAP_MS, type CheckId } from '../ring/diagnostics';
import { encodeLivePacket } from '../ring/packets';
import { PacketSource } from '../ring/RingSource';
import { packetLog, useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

const CHECK_TEXT: Record<CheckId, MessageKey> = {
  parse: 'diag.cParse',
  keepalive: 'diag.cKeepalive',
  beats: 'diag.cBeats',
  timestamps: 'diag.cTimestamps',
  keepaliveSeq: 'diag.cKeepaliveSeq',
  ranges: 'diag.cRanges',
};

type Level = 'good' | 'warn';

/**
 * Ring health in plain words: one answer at the top, a short "at a glance" list, the checks,
 * and the engineering numbers folded away under "Technical details".
 */
export function Diagnostics() {
  const { t } = useI18n();
  const now = useNow(1000);
  const source = useSensorStore((s) => s.source);
  const kind = useSensorStore((s) => s.kind);
  const latest = useLiveStore((s) => s.latest);
  const bad = source instanceof PacketSource ? source.badPackets : 0;
  const d = diagnose(packetLog, now, bad);

  if (!source || !d) {
    return (
      <Card>
        <p className="text-[15px] text-label">{source ? t('diag.waiting') : t('diag.noSource')}</p>
        {!source && (
          <a href="#/connect" className="btn-primary mt-4 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold">
            {t('settings.connect')}
          </a>
        )}
      </Card>
    );
  }

  const failing = d.checks.filter((c) => !c.ok).length;
  const quality: { key: MessageKey; level: Level } =
    d.confidenceAvg === null
      ? { key: 'diag.poor', level: 'warn' }
      : d.confidenceAvg >= 85
        ? { key: 'diag.good', level: 'good' }
        : d.confidenceAvg >= 70
          ? { key: 'diag.fair', level: 'warn' }
          : { key: 'diag.poor', level: 'warn' };

  return (
    <div className="space-y-4">
      {/* The answer first. */}
      <Card>
        <div className="flex items-start gap-4">
          <span className={`grid size-12 shrink-0 place-items-center rounded-full ${failing ? 'bg-amber/15 text-amber' : 'bg-signal/15 text-signal'}`}>
            {failing ? <span className="text-[22px] leading-none font-semibold">!</span> : <CheckIcon className="size-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-[19px] leading-snug font-semibold">{failing ? t('diag.problems', { n: failing }) : t('diag.healthy')}</p>
            <p className="mt-1 text-[13.5px] text-label">
              {t('diag.checked', { s: d.windowS, source: kind === 'sim' ? t('link.sim') : t('link.ringShort') })}
            </p>
            {kind === 'sim' && <p className="mt-2 text-[13px] text-muted">{t('diag.simNote')}</p>}
          </div>
        </div>
      </Card>

      <Card title={t('diag.glance')}>
        <Rows>
          <Row k={t('diag.connection')} v={d.maxGapMs > MAX_GAP_MS ? t('diag.gappy') : t('diag.steady')} level={d.maxGapMs > MAX_GAP_MS ? 'warn' : 'good'} />
          <Row k={t('diag.heartbeats')} v={t('diag.perMin', { n: d.beatsPerMin })} level={d.missedBeats ? 'warn' : 'good'} />
          <Row k={t('diag.contact')} v={t('diag.contactPct', { pct: d.fingerOnPct })} level={d.fingerOnPct >= 90 ? 'good' : 'warn'} />
          <Row k={t('diag.quality')} v={`${t(quality.key)}${d.confidenceAvg === null ? '' : ` · ${d.confidenceAvg}`}`} level={quality.level}>
            <ConfidenceTrace now={now} />
          </Row>
          <Row
            k={t('diag.battery')}
            v={`${d.battery ?? '––'}%${d.drainPctPerHour === null ? '' : ` · ${d.drainPctPerHour} %/h`}`}
            level={(d.battery ?? 100) > 15 ? 'good' : 'warn'}
          />
        </Rows>
      </Card>

      <Card title={t('diag.checks')}>
        <Rows>
          {d.checks.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              <StatusIcon level={c.ok ? 'good' : 'warn'} />
              <span className="min-w-0 flex-1 text-[14px]">{t(CHECK_TEXT[c.id])}</span>
              <span className={`text-[13px] font-medium ${c.ok ? 'text-muted' : 'text-amber'}`}>{c.ok ? t('diag.ok') : c.count}</span>
            </li>
          ))}
        </Rows>
      </Card>

      <details className="surface group rounded-2xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          {t('diag.technical')}
          <span aria-hidden className="text-[18px] text-muted transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>
        <div className="space-y-5 px-5 pb-5">
          <Rows>
            <Row k={t('diag.packetsPerS')} v={`${d.packetsPerS}`} />
            <Row k={t('diag.maxGap')} v={`${d.maxGapMs} ms`} />
            <Row k={t('diag.missed')} v={`${d.missedBeats}`} />
            <Row k={t('diag.bad')} v={`${bad}`} />
            <Row k={t('diag.confidenceOk')} v={d.confidenceOkPct === null ? '––' : `${d.confidenceOkPct}%`} />
            <Row k={t('diag.motion')} v={`${d.motionPct}%`} />
            <Row k={t('diag.clock')} v={d.clockDriftMs === null ? '––' : `${d.clockDriftMs > 0 ? '+' : ''}${d.clockDriftMs} ms`} />
            <Row k={t('diag.drain')} v={d.drainPctPerHour === null ? t('diag.drainWait') : `${d.drainPctPerHour} %/h`} />
          </Rows>
          {latest && (
            <div>
              <p className="label">{t('diag.lastPacket')}</p>
              <p className="mt-2 rounded-xl bg-black/30 px-3 py-2.5 font-mono text-[12.5px] break-all text-fg ring-1 ring-line">{hex(encodeLivePacket(latest))}</p>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 text-[13px] sm:grid-cols-2">
                {(
                  [
                    ['timestamp_ms', latest.timestampMs],
                    ['hr', latest.hrBpm ?? 0],
                    ['spo2', latest.spo2Pct ?? 0],
                    ['confidence', latest.confidence],
                    ['finger_status', `${latest.fingerStatus}${latest.fingerStatus === FINGER_ON ? ' (on)' : ''}`],
                    ['temp', latest.skinTempC ?? '––'],
                    ['rr_ms', latest.rrMs ?? 0],
                    ['motion', latest.motion ? 1 : 0],
                    ['battery', latest.batteryPct],
                    ['beat_seq', latest.beatSeq],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line py-1.5">
                    <dt className="font-mono text-muted">{k}</dt>
                    <dd className="tabular font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p className="text-[12.5px] text-muted">{t('diag.firmware')}</p>
        </div>
      </details>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="surface rounded-2xl px-5 py-4">
      {title && <h2 className="mb-1 text-[15px] font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line">{children}</ul>;
}

function Row({ k, v, level, children }: { k: string; v: string; level?: Level; children?: ReactNode }) {
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        {level && <StatusIcon level={level} />}
        <span className="min-w-0 flex-1 text-[14px] text-label">{k}</span>
        <span className="tabular text-right text-[14px] font-medium">{v}</span>
      </div>
      {children}
    </li>
  );
}

function StatusIcon({ level }: { level: Level }) {
  return level === 'good' ? (
    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-signal/15 text-signal">
      <CheckIcon className="size-3.5" />
    </span>
  ) : (
    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-amber/15 text-[12px] font-bold text-amber">
      !
    </span>
  );
}

/** Signal quality over the last minute; the dashed line is the level readings need (80). */
function ConfidenceTrace({ now }: { now: number }) {
  const { t } = useI18n();
  const pts = packetLog.filter((r) => r.at > now - DIAG_WINDOW_MS);
  const W = 300;
  const H = 48;
  const x = (at: number) => ((at - (now - DIAG_WINDOW_MS)) / DIAG_WINDOW_MS) * W;
  const y = (c: number) => H - 2 - (c / 100) * (H - 4);
  const d = pts.map((r, i) => `${i ? 'L' : 'M'}${x(r.at).toFixed(1)},${y(r.p.confidence).toFixed(1)}`).join('');
  return (
    <svg role="img" aria-label={t('diag.traceAria')} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 ml-8 h-12 w-[calc(100%-2rem)]">
      <line x1="0" x2={W} y1={y(80)} y2={y(80)} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--signal)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
