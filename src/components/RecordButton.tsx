import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { saveRecording } from '../cloud/api';
import { useCloudStore } from '../cloud/cloudStore';
import { encodeSamples, type Recording } from '../cloud/model';
import { IMU_RATE_HZ, PPG_RATE_HZ, type ImuSample, type PpgSample } from '../data/SensorSource';
import { useI18n } from '../i18n';
import { useSensorStore } from '../store/sensorStore';

const SECONDS = 30;

/** Records the next 30 s of raw PPG and accelerometer data and saves it to the account. */
export function RecordButton() {
  const { t } = useI18n();
  const source = useSensorStore((s) => s.source);
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const allowed = useCloudStore((s) => s.consent.raw);
  const [left, setLeft] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  if (!signedIn) return null;

  const start = () => {
    if (!source || left !== null) return;
    setMessage(null);
    const startedAt = Date.now();
    const ppg: PpgSample[] = [];
    const imu: ImuSample[] = [];
    const offPpg = source.onPpg((b) => ppg.push(...b));
    const offImu = source.onImu((b) => imu.push(...b));
    setLeft(SECONDS);
    const tick = setInterval(() => setLeft(Math.max(0, SECONDS - Math.floor((Date.now() - startedAt) / 1000))), 250);

    const finish = async (save: boolean) => {
      offPpg();
      offImu();
      clearInterval(tick);
      clearTimeout(timer);
      stop.current = null;
      setLeft(null);
      if (!save) return;
      const id = String(startedAt);
      const ppgRec: Recording = {
        id: `${id}-ppg`,
        kind: 'ppg',
        startedAt,
        rateHz: PPG_RATE_HZ,
        channels: ['red', 'ir'],
        encoding: 'int32le',
        scale: 1,
        n: ppg.length,
        data: { red: encodeSamples(ppg.map((s) => s.red), 'int32le'), ir: encodeSamples(ppg.map((s) => s.ir), 'int32le') },
      };
      // Acceleration stored in milli-g so it fits 16-bit integers.
      const imuRec: Recording = {
        id: `${id}-imu`,
        kind: 'imu',
        startedAt,
        rateHz: IMU_RATE_HZ,
        channels: ['ax', 'ay', 'az'],
        encoding: 'int16le',
        scale: 0.001,
        n: imu.length,
        data: {
          ax: encodeSamples(imu.map((s) => s.ax * 1000), 'int16le'),
          ay: encodeSamples(imu.map((s) => s.ay * 1000), 'int16le'),
          az: encodeSamples(imu.map((s) => s.az * 1000), 'int16le'),
        },
      };
      try {
        await Promise.all([saveRecording(ppgRec), saveRecording(imuRec)]);
        setMessage({ text: t('record.saved'), ok: true });
      } catch {
        setMessage({ text: t('record.failed'), ok: false });
      }
    };
    const timer = setTimeout(() => finish(true), SECONDS * 1000);
    stop.current = () => void finish(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-line px-3 py-2">
      {(message || !allowed) && (
        <span role="status" className={`text-[11px] ${message && !message.ok ? 'text-alert' : 'text-label'}`}>
          {message ? message.text : t('record.needConsent')}
        </span>
      )}
      <button
        type="button"
        disabled={!allowed || !source || left !== null}
        onClick={start}
        className="flex h-8 items-center gap-2 rounded-[3px] border border-signal/60 px-3 text-xs font-semibold text-fg hover:bg-signal/10 disabled:opacity-50"
      >
        <span aria-hidden className={`size-2 rounded-full bg-signal ${left !== null ? 'live-dot' : ''}`} />
        {left !== null ? t('record.recording', { secs: left }) : t('record.button')}
      </button>
    </div>
  );
}
