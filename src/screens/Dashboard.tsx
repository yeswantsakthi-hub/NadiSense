import { EventLog } from '../components/EventLog';
import { Panel } from '../components/Panel';
import { NadiPanel, SessionPanel } from '../components/SessionPanel';
import { StatusBanner } from '../components/StatusBanner';
import { VitalCard } from '../components/VitalCard';
import { WaveformCanvas } from '../components/WaveformCanvas';
import { PPG_RATE_HZ } from '../data/SensorSource';
import { useI18n } from '../i18n';
import { useNow } from '../lib/useNow';
import { imuBuffer, ppgBuffer, useLiveStore } from '../store/liveStore';
import { scenarioKey, useSensorStore } from '../store/sensorStore';

const WINDOW_MS = 5000;
const getMotionBands = () => useLiveStore.getState().motionSegments;

export function Dashboard() {
  const { t, ago } = useI18n();
  const now = useNow();
  const kind = useSensorStore((s) => s.kind);
  const scenario = useSensorStore((s) => s.scenario);
  const { connectedAt, moving, movingSince, streams, temp, battery } = useLiveStore();

  const pending = { text: t('tag.pending'), tone: 'muted' } as const;
  const sourceName = kind === 'mock' ? t('source.demo') : t('source.ring');
  const liveCount = Object.values(streams).filter(Boolean).length;
  const kpis = [
    { label: t('kpi.streams'), value: `${liveCount}/4` },
    {
      label: t('kpi.battery'),
      value: battery === null ? '––' : `${battery}%`,
      tone: battery !== null && battery < 20 ? ('amber' as const) : ('signal' as const),
    },
  ];
  const connected = t('banner.connected', { ago: ago(connectedAt ?? now, now) });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="lg:col-span-2">
        {moving ? (
          <StatusBanner
            status={t('status.movement')}
            tone="amber"
            title={t('banner.moveTitle')}
            subtitle={t('banner.moveSub', { ago: ago(movingSince ?? now, now) })}
            lead={t('banner.moveLead')}
            points={[t('banner.move1'), t('banner.move2'), t('banner.move3')]}
            kpis={kpis}
          />
        ) : (
          <StatusBanner
            status={t('status.live')}
            tone="signal"
            title={t('banner.liveTitle', { source: sourceName })}
            subtitle={
              kind === 'mock'
                ? `${connected} · ${t('banner.scenario', { scenario: t(scenarioKey(scenario)) })}`
                : connected
            }
            lead={t('banner.liveLead')}
            points={[t('banner.live1', { hz: PPG_RATE_HZ }), t('banner.live2'), t('banner.live3')]}
            kpis={kpis}
          />
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <Panel
          flush
          label={t('pulse.title')}
          className="-mx-3 rounded-none border-x-0 sm:mx-0 sm:rounded-[3px] sm:border-x"
          aside={
            <>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-signal" />
                {t('pulse.clean')}
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[1px] border border-amber bg-amber/20" />
                {t('pulse.motion')}
              </span>
            </>
          }
        >
          <WaveformCanvas
            buffer={ppgBuffer}
            windowMs={WINDOW_MS}
            invert
            getBands={getMotionBands}
            excludeBandsFromScale
            label={t('pulse.aria')}
            className="h-60 sm:h-72 lg:h-80"
          />
          <div className="flex items-center justify-between border-t border-line px-3 pt-2">
            <span className="label">{t('pulse.accel')}</span>
            <span className={`font-mono text-[11px] ${moving ? 'text-amber' : 'text-muted'}`}>
              {moving ? t('pulse.moving') : t('pulse.still')}
            </span>
          </div>
          <WaveformCanvas
            buffer={imuBuffer}
            windowMs={WINDOW_MS}
            colorVar="--label"
            minSpan={0.25}
            grid={false}
            getBands={getMotionBands}
            label={t('pulse.accelAria')}
            className="h-14"
          />
          <p className="flex justify-between px-3 py-1.5 font-mono text-[11px] text-muted">
            <span>−{WINDOW_MS / 1000} s</span>
            <span>{t('pulse.now')}</span>
          </p>
        </Panel>

        <section aria-label={t('vitals.aria')} className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          <VitalCard
            label={t('vital.hr')}
            unit="bpm"
            tag={pending}
            detail={t('vital.baseline')}
            footer={t('vital.hrSource')}
            footerAside={t('vital.beatToBeat')}
          />
          <VitalCard
            label={t('vital.spo2')}
            unit="%"
            tag={pending}
            detail={t('vital.baseline')}
            footer={t('vital.spo2Source')}
            footerAside={t('vital.per10s')}
          />
          <VitalCard
            label={t('vital.hrv')}
            unit="ms"
            tag={pending}
            detail={t('vital.rmssdBaseline')}
            footer={t('vital.hrvSource')}
            footerAside="RMSSD"
          />
          <VitalCard
            label={t('vital.resp')}
            unit="/min"
            tag={pending}
            detail={t('vital.baseline')}
            footer={t('vital.respSource')}
            footerAside={t('vital.per30s')}
          />
          <VitalCard
            label={t('vital.temp')}
            value={temp ? temp.celsius.toFixed(1) : undefined}
            unit="°C"
            tag={temp ? { text: t('tag.live'), tone: 'signal' } : pending}
            tone={temp ? 'signal' : 'default'}
            detail={temp ? t('vital.baseline') : t('vital.waiting')}
            footer={t('vital.tempSource')}
            footerAside={t('vital.every60s')}
          />
          <VitalCard
            label={t('vital.signal')}
            value={moving ? t('vital.motion') : streams.ppg ? t('vital.clean') : undefined}
            unit=""
            tag={moving ? { text: t('tag.flagged'), tone: 'amber' } : { text: t('tag.ok'), tone: 'signal' }}
            detail={moving ? t('vital.excluded') : t('vital.usable')}
            footer={t('vital.signalSource')}
            footerAside={t('vital.imuCheck')}
          />
        </section>
      </div>

      <div className="min-w-0 space-y-3">
        <EventLog />
        <SessionPanel sourceTag={kind === 'mock' ? t('tag.demo') : t('tag.ring')} />
        <NadiPanel />
      </div>
    </div>
  );
}
