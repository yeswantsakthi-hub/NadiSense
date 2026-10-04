import { create } from 'zustand';
import { BleSource } from '../data/BleSource';
import { MockSource } from '../data/MockSource';
import { SCENARIOS, type Scenario } from '../data/mockModel';
import type { SensorSource } from '../data/SensorSource';

export type SourceKind = 'mock' | 'ble';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface SensorState {
  kind: SourceKind;
  scenario: Scenario;
  status: ConnectionStatus;
  error: string | null;
  source: SensorSource | null;
  connect(kind?: SourceKind): Promise<boolean>;
  disconnect(): Promise<void>;
  setKind(kind: SourceKind): Promise<void>;
  setScenario(scenario: Scenario): void;
}

const PREFS_KEY = 'nadisense.source';

function loadPrefs(): { kind: SourceKind; scenario: Scenario } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;
    return {
      kind: raw.kind === 'ble' ? 'ble' : 'mock',
      scenario: SCENARIOS.includes(raw.scenario as Scenario) ? (raw.scenario as Scenario) : 'normal',
    };
  } catch {
    return { kind: 'mock', scenario: 'normal' };
  }
}

function savePrefs(kind: SourceKind, scenario: Scenario): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ kind, scenario }));
  } catch {
    // storage blocked: preferences just won't persist
  }
}

export const useSensorStore = create<SensorState>((set, get) => ({
  ...loadPrefs(),
  status: 'disconnected',
  error: null,
  source: null,

  async connect(kind = get().kind) {
    if (get().status === 'connecting') return false;
    await get().source?.disconnect();
    const source: SensorSource = kind === 'mock' ? new MockSource({ scenario: get().scenario }) : new BleSource();
    set({ kind, status: 'connecting', error: null, source: null });
    savePrefs(kind, get().scenario);
    try {
      await source.connect();
      set({ status: 'connected', source });
      return true;
    } catch (e) {
      set({ status: 'disconnected', error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  async disconnect() {
    const { source } = get();
    set({ status: 'disconnected', source: null, error: null });
    await source?.disconnect();
  },

  async setKind(kind) {
    if (kind === get().kind) return;
    if (get().status === 'connected') await get().connect(kind);
    else {
      set({ kind, error: null });
      savePrefs(kind, get().scenario);
    }
  },

  setScenario(scenario) {
    set({ scenario });
    savePrefs(get().kind, scenario);
    const { source } = get();
    if (source instanceof MockSource) source.setScenario(scenario);
  },
}));

/** Message key for a scenario name. */
export const scenarioKey = (s: Scenario) => `scenario.${s}` as const;
