import { Panel, Tag, type Tone } from '../components/Panel';
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

/** Firmware bring-up: link health, signal quality and BLE-contract checks over the last minute. */
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
      <div className="space-y-3 pt-2">
        <Panel label={t('diag.title')}>
          <p className="text-sm text-muted">{source ? t('diag.waiting') : t('diag.noSource')}</p>
          {!source && (
            <a href="#/connect" className="mt-3 inline-block text-sm text-signal underline underline-offset-4">
              {t('settings.connect')}
            </a>
          )}
        </Panel>
      </div>
    );
  }

  const failing = d.checks.filter((c) => !c.ok).length;
  const n = (v: number | null, unit = '') => (v === null ? '––' : `${v}${unit}`);
  return (
    <div className="space-y-3 pt-2">
      <Panel
        label={t('diag.title')}
        aside={<Tag tone={failing ? 'amber' : 'signal'}>{failing ? t('diag.issues', { n: failing }) : t('diag.allOk')}</Tag>}
      >
        <p className="text-xs text-label">
          {t('diag.window', { s: d.windowS })} · {kind === 'sim' ? t('link.sim') : t('link.ringShort')}
        </p>
        {kind === 'sim' && <p className="mt-1 text-xs text-amber">{t('diag.simNote')}</p>}
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel label={t('diag.link')}>
          <Stats
            rows={[
              [t('diag.packetsPerS'), n(d.packetsPerS)],
              [t('diag.beatsPerMin'), n(d.beatsPerMin)],
              [t('diag.maxGap'), `${d.maxGapMs} ms`, d.maxGapMs > MAX_GAP_MS ? 'amber' : undefined],
              [t('diag.missed'), n(d.missedBeats), d.missedBeats ? 'amber' : undefined],
              [t('diag.bad'), n(bad), bad ? 'amber' : undefined],
            ]}
          />
        </Panel>
        <Panel label={t('diag.signal')}>
          <Stats
            rows={[
              [t('diag.fingerOn'), n(d.fingerOnPct, '%')],
              [t('diag.confidence'), n(d.confidenceAvg)],
              [t('diag.confidenceOk'), n(d.confidenceOkPct, '%')],
              [t('diag.motion'), n(d.motionPct, '%')],
            ]}
          />
          <ConfidenceTrace now={now} />
        </Panel>
        <Panel label={t('diag.power')}>
          <Stats
            rows={[
              [t('diag.battery'), n(d.battery, '%')],
              [t('diag.drain'), d.drainPctPerHour === null ? t('diag.drainWait') : `${d.drainPctPerHour} %/h`],
              [t('diag.clock'), d.clockDriftMs === null ? '––' : `${d.clockDriftMs > 0 ? '+' : ''}${d.clockDriftMs} ms`],
            ]}
          />
        </Panel>
        <Panel label={t('diag.checks')}>
          <ul className="space-y-1.5">
            {d.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[12px]">
                <span aria-hidden className={`mt-[5px] size-1.5 shrink-0 rounded-full ${c.ok ? 'bg-signal' : 'bg-amber'}`} />
                <span className="min-w-0 flex-1">{t(CHECK_TEXT[c.id])}</span>
                <span className={`font-mono ${c.ok ? 'text-signal' : 'text-amber'}`}>{c.ok ? t('diag.pass') : c.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {latest && (
        <Panel label={t('diag.lastPacket')}>
          <p className="font-mono text-[12px] break-all text-fg">{hex(encodeLivePacket(latest))}</p>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
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
              <div key={k} className="flex justify-between gap-2 border-b border-line py-0.5">
                <dt className="text-muted">{k}</dt>
                <dd className="font-mono">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
      <p className="px-1 text-[11px] text-muted">{t('diag.firmware')}</p>
    </div>
  );
}

function Stats({ rows }: { rows: [string, string, Tone?][] }) {
  return (
    <dl className="space-y-1">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 text-[12px]">
          <dt className="text-label">{k}</dt>
          <dd className={`font-mono text-[14px] font-medium ${tone === 'amber' ? 'text-amber' : ''}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Confidence over the last minute; the dashed line is the reading gate (80). */
function ConfidenceTrace({ now }: { now: number }) {
  const { t } = useI18n();
  const pts = packetLog.filter((r) => r.at > now - DIAG_WINDOW_MS);
  const W = 300;
  const H = 60;
  const x = (at: number) => ((at - (now - DIAG_WINDOW_MS)) / DIAG_WINDOW_MS) * W;
  const y = (c: number) => H - (c / 100) * H;
  const d = pts.map((r, i) => `${i ? 'L' : 'M'}${x(r.at).toFixed(1)},${y(r.p.confidence).toFixed(1)}`).join('');
  return (
    <svg role="img" aria-label={t('diag.traceAria')} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-16 w-full rounded-lg bg-panel-2">
      <line x1="0" x2={W} y1={y(80)} y2={y(80)} stroke="var(--amber)" strokeDasharray="4 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--signal)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
