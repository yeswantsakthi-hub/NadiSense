import { Panel, Tag } from '../components/Panel';
import { Segmented } from '../components/Segmented';
import { SCENARIOS } from '../data/mockModel';
import { SCENARIO_LABELS, useSensorStore, type SourceKind } from '../store/sensorStore';

const STATUS = {
  connected: { text: 'connected', tone: 'signal' },
  connecting: { text: 'connecting', tone: 'label' },
  disconnected: { text: 'offline', tone: 'muted' },
} as const;

export function Settings() {
  const { kind, scenario, status, error, setKind, setScenario, connect, disconnect } = useSensorStore();

  return (
    <div className="mx-auto grid max-w-4xl gap-3 pt-2 md:grid-cols-2">
      <Panel label="Data source" aside={<Tag tone={STATUS[status].tone}>{STATUS[status].text}</Tag>}>
        <div className="space-y-4">
          <Segmented<SourceKind>
            legend="Source"
            value={kind}
            options={[
              { value: 'mock', label: 'Demo data' },
              { value: 'ble', label: 'Ring' },
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
            className={`h-11 w-full rounded-[3px] border font-semibold transition-colors disabled:opacity-60 ${
              status === 'connected'
                ? 'border-line-strong hover:border-fg/60'
                : 'border-signal/50 bg-signal/10 text-signal hover:bg-signal/15'
            }`}
          >
            {status === 'connected' ? 'Disconnect' : 'Connect'}
          </button>
          {error && (
            <p role="alert" className="border-l-2 border-alert pl-3 text-sm text-alert">
              {error}
            </p>
          )}
        </div>
      </Panel>

      <div className="space-y-3">
        <Panel label="Blood-pressure calibration" aside={<Tag>later build</Tag>}>
          <p className="font-mono text-sm text-muted">no cuff reading registered</p>
          <p className="mt-1 text-xs text-label">
            Until you enter a cuff reading, blood pressure is shown only as a trend.
          </p>
        </Panel>
        <Panel label="Your data" aside={<Tag>later build</Tag>}>
          <p className="text-xs text-label">
            Everything stays on this device. Export my data and Delete all data arrive with local storage.
          </p>
        </Panel>
      </div>
    </div>
  );
}
