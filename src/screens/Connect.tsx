import { Segmented } from '../components/Segmented';
import { isWebBluetoothAvailable } from '../data/BleSource';
import { SCENARIOS } from '../data/mockModel';
import { navigate } from '../lib/route';
import { SCENARIO_LABELS, useSensorStore, type SourceKind } from '../store/sensorStore';

export function Connect() {
  const { status, error, kind, scenario, connect, setScenario } = useSensorStore();
  const connecting = status === 'connecting';
  const bluetooth = isWebBluetoothAvailable();

  const start = async (k: SourceKind) => {
    if (await connect(k)) navigate('/dashboard');
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-14 pb-8">
      <header>
        <p lang="hi" className="text-sm font-semibold text-turmeric">
          नाडी
        </p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">NadiSense</h1>
        <p className="mt-3 max-w-[30ch] text-lg text-muted">Nadi Pariksha from your ring, all day.</p>
      </header>

      <div className="mt-auto space-y-8 pt-12">
        <section aria-labelledby="ring-heading" className="space-y-3">
          <h2 id="ring-heading" className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
            NadiSense ring
          </h2>
          <button
            type="button"
            disabled={connecting}
            onClick={() => start('ble')}
            className="h-12 w-full rounded-lg bg-signal font-semibold text-signal-ink disabled:opacity-60"
          >
            {connecting && kind === 'ble' ? 'Searching…' : 'Pair ring'}
          </button>
          {!bluetooth && (
            <p className="text-sm text-muted">
              This browser has no Bluetooth access. Use Chrome on Android, Windows or macOS.
            </p>
          )}
        </section>

        <section aria-labelledby="demo-heading" className="space-y-3 border-t border-line pt-8">
          <h2 id="demo-heading" className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
            No ring yet
          </h2>
          <Segmented
            legend="Demo scenario"
            value={scenario}
            options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABELS[s] }))}
            onChange={setScenario}
          />
          <button
            type="button"
            disabled={connecting}
            onClick={() => start('mock')}
            className="h-12 w-full rounded-lg border border-ink/80 font-semibold disabled:opacity-60"
          >
            {connecting && kind === 'mock' ? 'Starting…' : 'Use demo data'}
          </button>
        </section>

        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}

        <p className="text-xs leading-relaxed text-muted">
          A screening companion, not a diagnostic device. Your data stays on this phone.
        </p>
      </div>
    </div>
  );
}
