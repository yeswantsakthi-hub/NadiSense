import { useEffect, useMemo, useState } from 'react';
import { WaveformCanvas } from '../components/WaveformCanvas';
import { PPG_RATE_HZ } from '../data/SensorSource';
import { RingBuffer } from '../lib/RingBuffer';
import { SCENARIO_LABELS, useSensorStore } from '../store/sensorStore';

const WINDOW_MS = 5000;

export function Dashboard() {
  const { source, kind, scenario, disconnect } = useSensorStore();
  const buffer = useMemo(() => new RingBuffer(PPG_RATE_HZ * 8), []);
  const [temp, setTemp] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);

  useEffect(() => {
    if (!source) return;
    buffer.clear();
    const offPpg = source.onPpg((samples) => {
      for (const s of samples) buffer.push(s.t, s.ir);
    });
    const offTemp = source.onTemp((s) => setTemp(s.celsius));
    const readBattery = () => source.battery().then(setBattery, () => setBattery(null));
    readBattery();
    const batteryTimer = setInterval(readBattery, 60000);
    return () => {
      offPpg();
      offTemp();
      clearInterval(batteryTimer);
    };
  }, [source, buffer]);

  const sourceLabel = kind === 'mock' ? `Demo · ${SCENARIO_LABELS[scenario]}` : 'Ring';

  return (
    <div className="pt-5">
      <header className="flex items-start justify-between gap-4 px-4">
        <div>
          <h1 className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Live pulse</h1>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            {sourceLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {battery !== null && <span className="tabular-nums">{battery}%</span>}
          <button
            type="button"
            onClick={disconnect}
            className="rounded-md px-2 py-1 font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
          >
            Disconnect
          </button>
        </div>
      </header>

      <figure className="mt-4">
        <WaveformCanvas
          buffer={buffer}
          windowMs={WINDOW_MS}
          invert
          label="Live pulse waveform from the ring's infrared sensor"
          className="h-60"
        />
        <figcaption className="flex justify-between px-4 pt-1 text-xs text-muted">
          <span>Infrared PPG</span>
          <span className="tabular-nums">{WINDOW_MS / 1000} s</span>
        </figcaption>
      </figure>

      <section aria-label="Today's vitals" className="mt-8 px-4">
        <div className="flex items-baseline gap-2">
          <span className="text-7xl leading-none font-semibold tabular-nums">—</span>
          <span className="text-lg text-muted">bpm</span>
        </div>
        <p className="mt-1 text-sm text-muted">Heart rate</p>

        <dl className="mt-6 divide-y divide-line border-y border-line">
          <Vital label="SpO₂" unit="%" />
          <Vital label="HRV (RMSSD)" unit="ms" />
          <Vital label="Respiration" unit="/min" />
          <Vital label="Skin temperature" unit="°C" value={temp?.toFixed(1)} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          Heart rate, SpO₂, HRV and respiration appear once signal processing is switched on.
        </p>
      </section>
    </div>
  );
}

function Vital({ label, unit, value }: { label: string; unit: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">
        {value ?? '—'}
        <span className="ml-1 text-sm font-normal text-muted">{unit}</span>
      </dd>
    </div>
  );
}
