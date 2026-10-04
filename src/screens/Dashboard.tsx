import { EventLog } from '../components/EventLog';
import { Panel } from '../components/Panel';
import { NadiPanel, SessionPanel } from '../components/SessionPanel';
import { StatusBanner } from '../components/StatusBanner';
import { VitalCard } from '../components/VitalCard';
import { WaveformCanvas } from '../components/WaveformCanvas';
import { PPG_RATE_HZ } from '../data/SensorSource';
import { ago } from '../lib/format';
import { useNow } from '../lib/useNow';
import { imuBuffer, ppgBuffer, useLiveStore } from '../store/liveStore';
import { SCENARIO_LABELS, useSensorStore } from '../store/sensorStore';

const WINDOW_MS = 5000;
const getMotionBands = () => useLiveStore.getState().motionSegments;

const PENDING = { text: 'pending', tone: 'muted' } as const;

export function Dashboard() {
  const now = useNow();
  const kind = useSensorStore((s) => s.kind);
  const scenario = useSensorStore((s) => s.scenario);
  const { connectedAt, moving, movingSince, streams, temp, battery } = useLiveStore();

  const sourceName = kind === 'mock' ? 'Demo ring' : 'NadiSense ring';
  const liveCount = Object.values(streams).filter(Boolean).length;
  const kpis = [
    { label: 'Streams', value: `${liveCount}/4` },
    {
      label: 'Battery',
      value: battery === null ? '––' : `${battery}%`,
      tone: battery !== null && battery < 20 ? ('amber' as const) : ('signal' as const),
    },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="lg:col-span-2">
        {moving ? (
          <StatusBanner
            status="MOVEMENT"
            tone="amber"
            title="Pulse signal disturbed by movement"
            subtitle={`Flagged ${movingSince ? ago(movingSince, now) : 'just now'} · rule: accelerometer variance`}
            lead="Hold your hand still for a few seconds."
            points={[
              'Flagged stretches are shaded on the waveform.',
              'Nothing is measured from a flagged stretch.',
              'Readings resume on their own once you are still.',
            ]}
            kpis={kpis}
          />
        ) : (
          <StatusBanner
            status="LIVE"
            tone="signal"
            title={`${sourceName} — streaming`}
            subtitle={`Connected ${connectedAt ? ago(connectedAt, now) : 'just now'}${
              kind === 'mock' ? ` · ${SCENARIO_LABELS[scenario].toLowerCase()} scenario` : ''
            }`}
            lead="Keep the ring snug and your hand relaxed."
            points={[
              `Pulse waveform streaming at ${PPG_RATE_HZ} Hz from the infrared sensor.`,
              'Movement is caught by the accelerometer and flagged.',
              'Vitals appear here once signal processing is switched on.',
            ]}
            kpis={kpis}
          />
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <Panel
          flush
          label="Live pulse — infrared PPG"
          className="-mx-3 rounded-none border-x-0 sm:mx-0 sm:rounded-[3px] sm:border-x"
          aside={
            <>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-signal" />
                clean
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[1px] border border-amber bg-amber/20" />
                motion
              </span>
            </>
          }
        >
          <WaveformCanvas
            buffer={ppgBuffer}
            windowMs={WINDOW_MS}
            invert
            getBands={getMotionBands}
            excludeBandsFromScale
            label="Live pulse waveform from the ring's infrared sensor. Shaded areas are flagged for movement."
            className="h-60 sm:h-72 lg:h-80"
          />
          <div className="flex items-center justify-between border-t border-line px-3 pt-2">
            <span className="label">Accelerometer · |a|</span>
            <span className={`font-mono text-[11px] ${moving ? 'text-amber' : 'text-muted'}`}>
              {moving ? 'MOVING' : 'STILL'}
            </span>
          </div>
          <WaveformCanvas
            buffer={imuBuffer}
            windowMs={WINDOW_MS}
            colorVar="--label"
            minSpan={0.25}
            grid={false}
            getBands={getMotionBands}
            label="Accelerometer magnitude, used to detect hand movement"
            className="h-14"
          />
          <p className="flex justify-between px-3 py-1.5 font-mono text-[11px] text-muted">
            <span>−{WINDOW_MS / 1000} s</span>
            <span>now</span>
          </p>
        </Panel>

        <section aria-label="Vitals" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <VitalCard
            label="Heart rate"
            unit="bpm"
            tag={PENDING}
            detail="baseline ––"
            footer="from PPG peaks"
            footerAside="beat-to-beat"
          />
          <VitalCard
            label="SpO₂"
            unit="%"
            tag={PENDING}
            detail="baseline ––"
            footer="red / IR ratio"
            footerAside="per 10 s"
          />
          <VitalCard
            label="HRV"
            unit="ms"
            tag={PENDING}
            detail="RMSSD · baseline ––"
            footer="needs 60 s still"
            footerAside="RMSSD"
          />
          <VitalCard
            label="Respiration"
            unit="/min"
            tag={PENDING}
            detail="baseline ––"
            footer="from pulse rhythm"
            footerAside="per 30 s"
          />
          <VitalCard
            label="Skin temp"
            value={temp ? temp.celsius.toFixed(1) : undefined}
            unit="°C"
            tag={temp ? { text: 'live', tone: 'signal' } : PENDING}
            tone={temp ? 'signal' : 'default'}
            detail={temp ? 'baseline ––' : 'waiting for first reading'}
            footer="ring thermistor"
            footerAside="every 60 s"
          />
          <VitalCard
            label="Signal"
            value={moving ? 'Motion' : streams.ppg ? 'Clean' : undefined}
            unit=""
            tag={moving ? { text: 'flagged', tone: 'amber' } : { text: 'ok', tone: 'signal' }}
            detail={moving ? 'segment excluded from vitals' : 'usable for measurement'}
            footer="data quality"
            footerAside="IMU check"
          />
        </section>
      </div>

      <div className="min-w-0 space-y-3">
        <EventLog />
        <SessionPanel sourceName={kind === 'mock' ? 'demo' : 'ring'} />
        <NadiPanel />
      </div>
    </div>
  );
}
