import { useEffect, useRef } from 'react';
import { useAuthStore } from '../auth/authStore';
import { saveSession } from '../cloud/api';
import { useCloudStore } from '../cloud/cloudStore';
import { SessionStats } from '../cloud/SessionStats';
import { analyseRhythm } from '../dsp/rhythm';
import { FINGER_ON } from '../ring/contract';
import { readingState } from '../ring/readings';
import type { LinkStatus } from '../ring/RingSource';
import { saveLocalSession } from '../store/db';
import { addBeat, beatLog, useLiveStore } from '../store/liveStore';
import { useSensorStore } from '../store/sensorStore';

const LOW_BATTERY = 15;
const TEMP_SAMPLE_MS = 30_000;
const LOCAL_SAVE_MS = 60_000;
const CLOUD_SAVE_MS = 5 * 60_000;
const announced = new WeakSet<object>();
/** One stats object per source, so StrictMode's effect re-run keeps counting the same session. */
const sessionStats = new WeakMap<object, SessionStats>();

/** Latest 2-minute rhythm result goes into the summary once there is one. */
function withRhythm(stats: SessionStats): SessionStats {
  const r = analyseRhythm(beatLog, Date.now());
  if (r.status !== 'collecting') stats.rhythm({ status: r.status, rmssdMs: r.rmssdMs, pnn50: r.pnn50 });
  return stats;
}

/** Always keep the session on the phone; upload only if signed in with cloud backup on. */
function persist(stats: SessionStats, cloud: boolean): void {
  const summary = withRhythm(stats).summary(Date.now());
  saveLocalSession(summary).catch(() => {
    // Storage full or blocked: the live screens still work.
  });
  if (!cloud || useAuthStore.getState().status !== 'signedIn' || !useCloudStore.getState().consent.summaries) return;
  saveSession(summary).catch(() => {
    // Offline writes are queued by Firestore; anything else is retried at the next save.
  });
}

/**
 * Renders nothing. While a source is connected it turns its live packets into app state:
 * latest reading, beat log, event log (finger, movement, link, battery) and the session summary.
 */
export function SessionMonitor() {
  const source = useSensorStore((s) => s.source);
  const kind = useSensorStore((s) => s.kind);
  const scenario = useSensorStore((s) => s.scenario);
  const scenarioRef = useRef(scenario);

  useEffect(() => {
    if (!source) return;
    const live = useLiveStore.getState();
    if (!announced.has(source)) {
      announced.add(source);
      live.reset();
      if (kind === 'sim') live.log('SYSTEM', 'live', 'ev.connectedDemo', { scenario: scenarioRef.current });
      else live.log('SYSTEM', 'live', 'ev.connectedRing');
    }
    let stats = sessionStats.get(source);
    if (!stats) {
      stats = new SessionStats(kind === 'sim' ? 'mock' : 'ble', kind === 'sim' ? scenarioRef.current : null, Date.now());
      sessionStats.set(source, stats);
    }
    const session = stats;

    let fingerOn: boolean | null = null;
    let moving = false;
    let lowBatteryLogged = false;
    let lastTempAt = 0;

    const offPacket = source.onPacket((p, at) => {
      useLiveStore.setState((s) => ({ latest: p, lastPacketAt: at, packets: s.packets + 1 }));
      const log = useLiveStore.getState().log;

      if (p.rrMs !== null) addBeat({ at, rrMs: p.rrMs, beatSeq: p.beatSeq, motion: p.motion });
      if (readingState(p, at, at) === 'ok') session.reading(p.hrBpm, p.spo2Pct);

      const on = p.fingerStatus === FINGER_ON;
      if (on !== fingerOn) {
        if (fingerOn !== null || !on) log('RING', on ? 'live' : 'alert', on ? 'ev.fingerOn' : 'ev.fingerOff');
        fingerOn = on;
      }

      if (p.motion !== moving) {
        moving = p.motion;
        if (moving) {
          session.motionStart(at);
          log('RING', 'motion', 'ev.movement');
        } else {
          session.motionEnd(at);
          log('RING', 'info', 'ev.still');
        }
      }

      if (p.skinTempC !== null && on && at - lastTempAt >= TEMP_SAMPLE_MS) {
        lastTempAt = at;
        session.temperature(p.skinTempC);
      }

      session.battery(p.batteryPct);
      if (p.batteryPct <= LOW_BATTERY && !lowBatteryLogged) {
        lowBatteryLogged = true;
        log('RING', 'alert', 'ev.lowBattery', { pct: p.batteryPct });
      }
    });

    let previous: LinkStatus = source.status;
    const offStatus = source.onStatus((status) => {
      const log = useLiveStore.getState().log;
      if (status === 'reconnecting') log('SYSTEM', 'alert', 'ev.reconnecting');
      if (status === 'connected' && previous === 'reconnecting') log('SYSTEM', 'live', 'ev.reconnected');
      previous = status;
    });

    const localTimer = setInterval(() => persist(session, false), LOCAL_SAVE_MS);
    const cloudTimer = setInterval(() => persist(session, true), CLOUD_SAVE_MS);

    return () => {
      offPacket();
      offStatus();
      clearInterval(localTimer);
      clearInterval(cloudTimer);
      // React StrictMode re-runs effects in development; only treat a real disconnect as the end.
      if (useSensorStore.getState().source !== source) {
        session.motionEnd(Date.now());
        persist(session, true);
        useLiveStore.getState().log('SYSTEM', 'info', 'ev.disconnected');
      }
    };
  }, [source, kind]);

  useEffect(() => {
    if (scenarioRef.current === scenario) return;
    scenarioRef.current = scenario;
    if (useSensorStore.getState().source && kind === 'sim') {
      useLiveStore.getState().log('SYSTEM', 'info', 'ev.scenario', { scenario });
    }
  }, [scenario, kind]);

  return null;
}
