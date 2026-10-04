import { Panel, Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { isWebBluetoothAvailable } from '../data/BleSource';
import { SCENARIOS } from '../data/mockModel';
import { navigate } from '../lib/route';
import { SCENARIO_LABELS, useSensorStore, type SourceKind } from '../store/sensorStore';

/** One idealised pulse beat, repeated, for the masthead trace. */
const TRACE =
  'M0 70 L40 70 C52 70 54 22 62 22 C70 22 72 54 80 56 C84 57 86 48 92 48 C100 48 104 66 120 70 ' +
  'L160 70 C172 70 174 22 182 22 C190 22 192 54 200 56 C204 57 206 48 212 48 C220 48 224 66 240 70 ' +
  'L280 70 C292 70 294 22 302 22 C310 22 312 54 320 56 C324 57 326 48 332 48 C340 48 344 66 360 70 L400 70';

export function Connect() {
  const { status, error, kind, scenario, connect, setScenario } = useSensorStore();
  const connecting = status === 'connecting';
  const bluetooth = isWebBluetoothAvailable();

  const start = async (k: SourceKind) => {
    if (await connect(k)) navigate('/dashboard');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-10 pb-8">
      <header className="text-center">
        <p lang="hi" className="text-sm font-semibold text-turmeric">
          नाडी
        </p>
        <h1 className="mt-1 font-mono text-2xl font-semibold tracking-[0.42em] pl-[0.42em]">NADISENSE</h1>
        <p className="mt-2 text-sm text-label">Nadi Pariksha from your ring, all day.</p>
      </header>

      <figure aria-hidden className="relative mt-8 overflow-hidden rounded-[3px] border border-line bg-panel">
        <svg viewBox="0 0 400 100" className="block h-28 w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="grid-minor" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0V20H0" fill="none" stroke="var(--grid)" strokeWidth="1" />
            </pattern>
            <linearGradient id="fade" x1="0" x2="1">
              <stop offset="0" stopColor="var(--signal)" stopOpacity="0.15" />
              <stop offset="1" stopColor="var(--signal)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="400" height="100" fill="url(#grid-minor)" />
          <path d={TRACE} fill="none" stroke="url(#fade)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption className="flex justify-between border-t border-line px-3 py-1.5 font-mono text-[10px] text-muted">
          <span>PPG · IR</span>
          <span>awaiting source</span>
        </figcaption>
      </figure>

      <Panel label="Select source" className="mt-3">
        <div className="space-y-3">
          <button
            type="button"
            disabled={connecting}
            onClick={() => start('ble')}
            className="group flex w-full items-center gap-3 rounded-[3px] border border-signal/50 bg-signal/10 p-3 text-left transition-colors hover:bg-signal/15 disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Pair ring</span>
                <Tag tone="signal">bluetooth</Tag>
              </span>
              <span className="mt-0.5 block text-xs text-label">
                {bluetooth ? 'Find your NadiSense ring nearby' : 'Needs Chrome on Android, Windows or macOS'}
              </span>
            </span>
            <span aria-hidden className="font-mono text-signal">
              {connecting && kind === 'ble' ? '···' : '→'}
            </span>
          </button>

          <div className="rounded-[3px] border border-line p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-semibold">Demo data</span>
              <Tag tone="label">no ring needed</Tag>
            </div>
            <Segmented
              legend="Scenario"
              value={scenario}
              options={SCENARIOS.map((s) => ({ value: s, label: SCENARIO_LABELS[s] }))}
              onChange={setScenario}
            />
            <button
              type="button"
              disabled={connecting}
              onClick={() => start('mock')}
              className="mt-3 h-11 w-full rounded-[3px] border border-line-strong font-semibold transition-colors hover:border-fg/60 disabled:opacity-60"
            >
              {connecting && kind === 'mock' ? 'Starting…' : 'Use demo data'}
            </button>
          </div>

          {error && (
            <p role="alert" className="border-l-2 border-alert pl-3 text-sm text-alert">
              {error}
            </p>
          )}
        </div>
      </Panel>

      <p className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-muted">
        A screening companion, not a diagnostic device.
        <br />
        Your data stays on this device.
      </p>
    </div>
  );
}
