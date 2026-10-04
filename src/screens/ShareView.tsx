import { useEffect, useState } from 'react';
import { readShare } from '../cloud/api';
import type { ShareSnapshot } from '../cloud/model';
import { DayTable } from '../components/DayTable';
import { LanguagePicker } from '../components/LanguagePicker';
import { Panel } from '../components/Panel';
import { useI18n, type MessageKey } from '../i18n';

/** Public, read-only page a doctor opens from a share link. No sign-in needed. */
export function ShareView({ token }: { token: string }) {
  const { t, date } = useI18n();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'gone' } | { status: 'ready'; snap: ShareSnapshot }>({
    status: 'loading',
  });

  useEffect(() => {
    let alive = true;
    readShare(token).then((snap) => alive && setState(snap ? { status: 'ready', snap } : { status: 'gone' }));
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pt-8 pb-10">
      <header className="flex items-center justify-between">
        <p className="keep-tracking font-mono text-sm font-semibold tracking-[0.42em]">
          NADI<span className="text-signal">SENSE</span>
        </p>
      </header>
      <h1 className="mt-6 text-2xl font-semibold">{t('share.viewerTitle')}</h1>

      <div className="mt-4 space-y-3">
        {state.status === 'loading' && <p className="text-sm text-muted">{t('history.loading')}</p>}
        {state.status === 'gone' && (
          <Panel label={t('share.viewerTitle')}>
            <p className="font-mono text-sm text-muted">{t('share.invalid')}</p>
          </Panel>
        )}
        {state.status === 'ready' && (
          <>
            <Panel label={t('share.patient')} aside={<span>{t('share.generated', { date: date(state.snap.generatedAt) })}</span>}>
              <p className="text-lg font-semibold">{state.snap.name}</p>
              <p className="mt-0.5 text-sm text-label">
                {[
                  state.snap.age !== null ? t('share.ageYears', { age: state.snap.age }) : null,
                  state.snap.sex !== 'unsaid' ? t(`profile.${state.snap.sex}` as MessageKey) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Panel>
            <Panel label={t('history.days7')}>
              {state.snap.days.length ? (
                <DayTable rows={state.snap.days} />
              ) : (
                <p className="font-mono text-sm text-muted">{t('history.none')}</p>
              )}
            </Panel>
          </>
        )}
        <p className="border-l-2 border-amber pl-3 text-xs text-label">{t('share.disclaimer')}</p>
        <div className="rounded-[3px] border border-line bg-panel p-3">
          <LanguagePicker compact />
        </div>
      </div>
    </div>
  );
}
