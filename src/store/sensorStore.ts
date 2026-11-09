import { create } from 'zustand';
import { BluetoothRing, RingError } from '../ring/BluetoothRing';
import type { LinkStatus, RingSource, SourceKind } from '../ring/RingSource';
import { SIM_SCENARIOS, SimulatedRing, type SimScenario } from '../ring/SimulatedRing';

export type { SourceKind } from '../ring/RingSource';
export type ConnectionStatus = LinkStatus;

interface SensorState {
  /** "NadiSense ring" by default; "Simulated" for demos without hardware. */
  kind: SourceKind;
  scenario: SimScenario;
  status: LinkStatus;
  /** An i18n key (err.*) or a raw message. */
  error: string | null;
  source: RingSource | null;
  connect(kind?: SourceKind): Promise<boolean>;
  /** Silently reconnect to a ring paired earlier, if the browser allows it. */
  restore(): Promise<boolean>;
  disconnect(): Promise<void>;
  setKind(kind: SourceKind): Promise<void>;
  setScenario(scenario: SimScenario): void;
}

const PREFS_KEY = 'nadisense.source';

function loadPrefs(): { kind: SourceKind; scenario: SimScenario } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;
    // Stage 2 stored 'mock' / 'ble'.
    const kind: SourceKind = raw.kind === 'sim' || raw.kind === 'mock' ? 'sim' : 'ring';
    const scenario = SIM_SCENARIOS.includes(raw.scenario as SimScenario) ? (raw.scenario as SimScenario) : 'normal';
    return { kind, scenario };
  } catch {
    return { kind: 'ring', scenario: 'normal' };
  }
}

function savePrefs(kind: SourceKind, scenario: SimScenario): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ kind, scenario }));
  } catch {
    // storage blocked: preferences just won't persist
  }
}

let stopStatus: (() => void) | null = null;

export const useSensorStore = create<SensorState>((set, get) => {
  const adopt = (source: RingSource) => {
    stopStatus?.();
    stopStatus = source.onStatus((status) => {
      if (get().source === source || status === 'connecting') set({ status });
    });
  };

  return {
    ...loadPrefs(),
    status: 'disconnected',
    error: null,
    source: null,

    async connect(kind = get().kind) {
      if (get().status === 'connecting') return false;
      await get().source?.disconnect();
      const source: RingSource = kind === 'sim' ? new SimulatedRing({ scenario: get().scenario }) : new BluetoothRing();
      set({ kind, status: 'connecting', error: null, source: null });
      savePrefs(kind, get().scenario);
      adopt(source);
      try {
        await source.connect();
        set({ status: source.status, source });
        return true;
      } catch (e) {
        set({ status: 'disconnected', error: e instanceof RingError ? e.key : e instanceof Error ? e.message : String(e) });
        return false;
      }
    },

    async restore() {
      if (get().kind !== 'ring' || get().source || get().status === 'connecting') return false;
      const ring = new BluetoothRing();
      adopt(ring);
      if (await ring.restore()) {
        set({ status: ring.status, source: ring, error: null });
        return true;
      }
      set({ status: 'disconnected' });
      return false;
    },

    async disconnect() {
      const { source } = get();
      set({ status: 'disconnected', source: null, error: null });
      await source?.disconnect();
    },

    async setKind(kind) {
      if (kind === get().kind) return;
      if (get().source) await get().connect(kind);
      else {
        set({ kind, error: null });
        savePrefs(kind, get().scenario);
      }
    },

    setScenario(scenario) {
      set({ scenario });
      savePrefs(get().kind, scenario);
      const { source } = get();
      if (source instanceof SimulatedRing) source.setScenario(scenario);
    },
  };
});

/** Message key for a simulator scenario name. */
export const scenarioKey = (s: SimScenario) => `scenario.${s}` as const;
