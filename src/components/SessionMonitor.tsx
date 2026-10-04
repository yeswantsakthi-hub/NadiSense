import { useEffect, useRef } from 'react';
import type { ImuSample } from '../data/SensorSource';
import { accelMagnitude, motionScore, nextMotionState } from '../dsp/motion';
import { ecgBuffer, imuBuffer, ppgBuffer, useLiveStore, type StreamId } from '../store/liveStore';
import { SCENARIO_LABELS, useSensorStore } from '../store/sensorStore';

const MOTION_WINDOW_MS = 500;
const MOTION_LEAD_MS = 500;
/** A stream counts as live if a packet arrived this recently (temperature only reports once a minute). */
const STALE_MS: Record<StreamId, number> = { ppg: 2000, imu: 2000, ecg: 2000, temp: 90000 };
const announced = new WeakSet<object>();

/**
 * Renders nothing. While a source is connected it feeds the display buffers and keeps the
 * live store (streams, movement, temperature, battery, event log) up to date for every screen.
 */
export function SessionMonitor() {
  const source = useSensorStore((s) => s.source);
  const kind = useSensorStore((s) => s.kind);
  const scenario = useSensorStore((s) => s.scenario);
  const scenarioRef = useRef(scenario);

  useEffect(() => {
    if (!source) return;
    if (!announced.has(source)) {
      announced.add(source);
      const live = useLiveStore.getState();
      live.reset();
      live.log(
        'SYSTEM',
        'live',
        kind === 'mock'
          ? `Connected to demo ring · ${SCENARIO_LABELS[scenarioRef.current].toLowerCase()} scenario`
          : 'Connected to NadiSense ring',
      );
    }
    ppgBuffer.clear();
    imuBuffer.clear();
    ecgBuffer.clear();

    const seen: Record<StreamId, number> = { ppg: 0, imu: 0, temp: 0, ecg: 0 };
    let imuWindow: ImuSample[] = [];
    let moving = false;
    let ecgActive = false;

    const offPpg = source.onPpg((batch) => {
      seen.ppg = Date.now();
      for (const s of batch) ppgBuffer.push(s.t, s.ir);
    });

    const offImu = source.onImu((batch) => {
      seen.imu = Date.now();
      for (const s of batch) imuBuffer.push(s.t, accelMagnitude(s));
      imuWindow = imuWindow.concat(batch);
      const last = imuWindow[imuWindow.length - 1];
      if (!last) return;
      imuWindow = imuWindow.filter((s) => s.t > last.t - MOTION_WINDOW_MS);

      const next = nextMotionState(moving, motionScore(imuWindow));
      if (next === moving) return;
      moving = next;
      const state = useLiveStore.getState();
      if (moving) {
        // Movement builds up before the score crosses the threshold, so flag a little earlier too.
        const from = imuWindow[0]!.t - MOTION_LEAD_MS;
        useLiveStore.setState({
          moving: true,
          movingSince: Date.now(),
          motionSegments: [...state.motionSegments.filter((g) => g.to === null || g.to > from - 10000), { from, to: null }],
        });
        state.log('IMU', 'motion', 'Movement detected · pulse segment flagged');
      } else {
        const secs = state.movingSince ? Math.max(1, Math.round((Date.now() - state.movingSince) / 1000)) : 0;
        useLiveStore.setState({
          moving: false,
          movingSince: null,
          motionSegments: state.motionSegments.map((g) => (g.to === null ? { ...g, to: last.t } : g)),
        });
        state.log('IMU', 'info', `Hand still again · ${secs} s of signal flagged`);
      }
    });

    const offTemp = source.onTemp((s) => {
      seen.temp = Date.now();
      const previous = useLiveStore.getState().temp;
      useLiveStore.setState({ temp: s });
      // onTemp replays the latest reading to new subscribers; log each reading once.
      if (previous?.t !== s.t) useLiveStore.getState().log('TEMP', 'info', `Skin temperature ${s.celsius.toFixed(2)} °C`);
    });

    const offEcg = source.onEcg((batch) => {
      seen.ecg = Date.now();
      if (!ecgActive) {
        ecgActive = true;
        ecgBuffer.clear();
        useLiveStore.getState().log('ECG', 'live', 'ECG recording started');
      }
      for (const s of batch) ecgBuffer.push(s.t, s.v);
    });

    const readBattery = () =>
      source.battery().then(
        (battery) => useLiveStore.setState({ battery }),
        () => useLiveStore.setState({ battery: null }),
      );
    readBattery();
    const batteryTimer = setInterval(readBattery, 60000);

    const streamTimer = setInterval(() => {
      const now = Date.now();
      const current = useLiveStore.getState().streams;
      const next = {} as Record<StreamId, boolean>;
      let changed = false;
      for (const id of Object.keys(STALE_MS) as StreamId[]) {
        next[id] = seen[id] > 0 && now - seen[id] < STALE_MS[id];
        if (next[id] !== current[id]) changed = true;
      }
      if (ecgActive && !next.ecg) {
        ecgActive = false;
        useLiveStore.getState().log('ECG', 'info', 'ECG recording finished');
      }
      if (changed) useLiveStore.setState({ streams: next });
    }, 1000);

    return () => {
      offPpg();
      offImu();
      offTemp();
      offEcg();
      clearInterval(batteryTimer);
      clearInterval(streamTimer);
      useLiveStore.setState({
        moving: false,
        movingSince: null,
        streams: { ppg: false, imu: false, temp: false, ecg: false },
      });
      // React StrictMode re-runs effects in development; only log a real disconnect.
      if (useSensorStore.getState().source !== source) useLiveStore.getState().log('SYSTEM', 'info', 'Disconnected');
    };
  }, [source, kind]);

  useEffect(() => {
    if (scenarioRef.current === scenario) return;
    scenarioRef.current = scenario;
    if (useSensorStore.getState().status === 'connected' && kind === 'mock') {
      useLiveStore.getState().log('SYSTEM', 'info', `Demo scenario switched to ${SCENARIO_LABELS[scenario].toLowerCase()}`);
    }
  }, [scenario, kind]);

  return null;
}
