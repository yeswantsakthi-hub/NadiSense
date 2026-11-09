import { useEffect, useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { deleteAccount, deleteCloudData, exportAll, saveConsent, saveProfile } from '../cloud/api';
import { useCloudStore } from '../cloud/cloudStore';
import { validateProfile, type Profile, type Sex } from '../cloud/model';
import { useI18n, type MessageKey } from '../i18n';
import { Field, Toggle } from './Field';
import { Panel, Tag } from './Panel';
import { Segmented } from './Segmented';

function Status({ message, tone = 'ok' }: { message: string | null; tone?: 'ok' | 'error' }) {
  if (!message) return null;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`border-l-2 pl-3 text-sm ${tone === 'error' ? 'border-alert text-alert' : 'border-signal text-fg'}`}
    >
      {message}
    </p>
  );
}

/** Explicit, per-type choice of what leaves the phone. */
export function ConsentPanel({ firstTime = false }: { firstTime?: boolean }) {
  const { t } = useI18n();
  const consent = useCloudStore((s) => s.consent);
  const [summaries, setSummaries] = useState(consent.summaries);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSummaries(consent.summaries);
  }, [consent.summaries]);

  const save = async (next: { summaries: boolean; raw: boolean }) => {
    setBusy(true);
    try {
      await saveConsent({ ...next, decidedAt: Date.now() });
      setMessage({ text: t('cloud.saved'), tone: 'ok' });
    } catch {
      setMessage({ text: t('err.generic'), tone: 'error' });
    }
    setBusy(false);
  };

  const onOff = (on: boolean) => <Tag tone={on ? 'signal' : 'muted'}>{on ? t('cloud.on') : t('cloud.off')}</Tag>;

  return (
    <Panel label={t('cloud.title')} className={firstTime ? 'border-signal/50' : ''}>
      <p className="text-sm text-muted">{t('cloud.intro')}</p>
      <div className="mt-2 divide-y divide-line">
        <Toggle
          checked={summaries}
          onChange={setSummaries}
          title={t('cloud.summaries')}
          hint={t('cloud.summariesHint')}
          aside={firstTime ? undefined : onOff(consent.summaries)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save({ summaries, raw: false })}
          className="h-10 flex-1 rounded-xl bg-signal px-3 text-sm font-semibold text-brand-ink hover:bg-signal/85 disabled:opacity-60"
        >
          {t('cloud.save')}
        </button>
        {firstTime && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ summaries: false, raw: false })}
            className="h-10 rounded-xl border border-line-strong px-4 text-sm font-semibold hover:border-fg/60 disabled:opacity-60"
          >
            {t('cloud.notNow')}
          </button>
        )}
      </div>
      <div className="mt-3">
        <Status message={message?.text ?? null} tone={message?.tone} />
      </div>
    </Panel>
  );
}

const SEXES: Sex[] = ['female', 'male', 'other', 'unsaid'];
const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));
const str = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n));

/** Age, sex and body size. Blood-pressure calibration returns with ring v2. */
export function ProfilePanel() {
  const { t, date } = useI18n();
  const profile = useCloudStore((s) => s.profile);
  const [form, setForm] = useState({ age: '', sex: 'unsaid' as Sex, height: '', weight: '' });
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      age: str(profile.age),
      sex: profile.sex,
      height: str(profile.heightCm),
      weight: str(profile.weightKg),
    });
  }, [profile]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const next: Profile = {
      age: num(form.age),
      sex: form.sex,
      heightCm: num(form.height),
      weightKg: num(form.weight),
      // Cuff calibration is entered again with ring v2; keep any earlier reading as it is.
      cuff: profile.cuff,
    };
    if (!validateProfile(next)) {
      setMessage({ text: t('profile.invalid'), tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await saveProfile(next);
      setMessage({ text: t('profile.saved'), tone: 'ok' });
    } catch {
      setMessage({ text: t('err.generic'), tone: 'error' });
    }
    setBusy(false);
  };

  return (
    <Panel label={t('profile.title')}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('profile.age')} value={form.age} onChange={set('age')} inputMode="numeric" />
        <Field label={t('profile.height')} value={form.height} onChange={set('height')} inputMode="decimal" />
        <Field label={t('profile.weight')} value={form.weight} onChange={set('weight')} inputMode="decimal" />
      </div>
      <div className="mt-3">
        <Segmented<Sex>
          legend={t('profile.sex')}
          value={form.sex}
          options={SEXES.map((s) => ({ value: s, label: t(`profile.${s}` as MessageKey) }))}
          onChange={(sex) => setForm((f) => ({ ...f, sex }))}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <h3 className="label">{t('profile.cuff')}</h3>
        <Tag tone="label">{t('v2.tag')}</Tag>
      </div>
      {profile.cuff && (
        <p className="mt-1 font-mono text-xs text-fg">
          {t('profile.cuffLast', { sys: profile.cuff.sys, dia: profile.cuff.dia, date: date(profile.cuff.at) })}
        </p>
      )}
      <p className="mt-1 text-xs text-label">{t('v2.bpWhy')}</p>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="mt-4 h-10 w-full rounded-xl bg-signal text-sm font-semibold text-brand-ink hover:bg-signal/85 disabled:opacity-60"
      >
        {t('profile.save')}
      </button>
      <div className="mt-3">
        <Status message={message?.text ?? null} tone={message?.tone} />
      </div>
    </Panel>
  );
}

/** Export, delete cloud data, delete account. */
export function DataPanel() {
  const { t } = useI18n();
  const signOut = useAuthStore((s) => s.signOut);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, done?: MessageKey) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (done) setMessage({ text: t(done), tone: 'ok' });
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String(e.code) : '';
      setMessage({ text: t(code === 'auth/requires-recent-login' ? 'cloud.reauth' : 'err.generic'), tone: 'error' });
    }
    setBusy(false);
  };

  const download = () =>
    run(async () => {
      const data = await exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `nadisense-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const button = 'h-10 w-full rounded-full border text-sm font-semibold disabled:opacity-60';
  return (
    <Panel label={t('cloud.dataTitle')}>
      <div className="space-y-2">
        <button type="button" disabled={busy} onClick={download} className={`${button} border-line-strong hover:border-fg/60`}>
          {t('cloud.export')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm(t('cloud.confirmDeleteData')) && run(deleteCloudData, 'cloud.deleted')}
          className={`${button} border-alert/60 text-alert hover:bg-alert/10`}
        >
          {t('cloud.deleteData')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            window.confirm(t('cloud.confirmDeleteAccount')) &&
            run(async () => {
              await deleteAccount();
              await signOut();
            })
          }
          className={`${button} border-alert/60 text-alert hover:bg-alert/10`}
        >
          {t('cloud.deleteAccount')}
        </button>
      </div>
      <div className="mt-3">
        <Status message={message?.text ?? null} tone={message?.tone} />
      </div>
    </Panel>
  );
}
