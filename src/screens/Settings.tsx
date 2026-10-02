import { Segmented } from '../components/Segmented';
import { SCENARIOS } from '../data/mockModel';
import { SCENARIO_LABELS, useSensorStore, type SourceKind } from '../store/sensorStore';

const STATUS_LABEL = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Not connected' } as const;

export function Settings() {
  const { kind, scenario, status, error, setKind, setScenario, connect, disconnect } = useSensorStore();

  return (
    <div className="px-4 pt-5">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <section aria-labelledby="source-heading" className="mt-8 space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 id="source-heading" className="text-lg font-semibold">
            Data source
          </h2>
          <span className="text-sm text-muted">{STATUS_LABEL[status]}</span>
        </div>
        <Segmented<SourceKind>
          legend="Source"
          value={kind}
          options={[
            { value: 'mock', label: 'Demo data' },
            { value: 'ble', label: 'Ring (Bluetooth)' },
          ]}
          onChange={setKind}
        />
        {kind === 'mock' && (
          <Segmented
            legend="Demo scenario"
            value={scenario}
            options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABELS[s] }))}
            onChange={setScenario}
          />
        )}
        <button
          type="button"
          disabled={status === 'connecting'}
          onClick={() => (status === 'connected' ? disconnect() : connect())}
          className="h-11 w-full rounded-lg border border-ink/80 font-semibold disabled:opacity-60"
        >
          {status === 'connected' ? 'Disconnect' : 'Connect'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}
      </section>

      <p className="mt-10 border-t border-line pt-4 text-sm text-muted">
        Blood-pressure calibration, units, and data export and deletion arrive in later builds.
      </p>
    </div>
  );
}
