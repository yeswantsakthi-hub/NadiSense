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
  const [raw, setRaw] = useState(consent.raw);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSummaries(consent.summaries);
    setRaw(consent.raw);
  }, [consent.summaries, consent.raw]);

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
        <Toggle
          checked={raw}
          onChange={setRaw}
          title={t('cloud.raw')}
          hint={t('cloud.rawHint')}
          aside={firstTime ? undefined : onOff(consent.raw)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save({ summaries, raw })}
          className="h-10 flex-1 rounded-[3px] bg-signal px-3 text-sm font-semibold text-white hover:bg-signal/85 disabled:opacity-60"
        >
          {t('cloud.save')}
        </button>
        {firstTime && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ summaries: false, raw: false })}
            className="h-10 rounded-[3px] border border-line-strong px-4 text-sm font-semibold hover:border-fg/60 disabled:opacity-60"
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

/** Age, sex, body size and the blood-pressure cuff calibration. */
export function ProfilePanel() {
  const { t, date } = useI18n();
  const profile = useCloudStore((s) => s.profile);
  const [form, setForm] = useState({ age: '', sex: 'unsaid' as Sex, height: '', weight: '', sys: '', dia: '' });
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      age: str(profile.age),
      sex: profile.sex,
      height: str(profile.heightCm),
      weight: str(profile.weightKg),
      sys: '',
      dia: '',
    });
  }, [profile]);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const sys = num(form.sys);
    const dia = num(form.dia);
    const next: Profile = {
      age: num(form.age),
      sex: form.sex,
      heightCm: num(form.height),
      weightKg: num(form.weight),
      // A new cuff reading replaces the old one; leaving both boxes empty keeps it.
      cuff: sys !== null && dia !== null ? { sys, dia, at: Date.now() } : profile.cuff,
    };
    if (!validateProfile(next) || (sys === null) !== (dia === null)) {
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

      <h3 className="label mt-4">{t('profile.cuff')}</h3>
      {profile.cuff && (
        <p className="mt-1 font-mono text-xs text-fg">
          {t('profile.cuffLast', { sys: profile.cuff.sys, dia: profile.cuff.dia, date: date(profile.cuff.at) })}
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Field label={t('profile.systolic')} value={form.sys} onChange={set('sys')} inputMode="numeric" placeholder="mmHg" />
        <Field label={t('profile.diastolic')} value={form.dia} onChange={set('dia')} inputMode="numeric" placeholder="mmHg" />
      </div>
      <p className="mt-1 text-[11px] text-muted">{t('profile.cuffHint')}</p>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="mt-4 h-10 w-full rounded-[3px] bg-signal text-sm font-semibold text-white hover:bg-signal/85 disabled:opacity-60"
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

  const button = 'h-10 w-full rounded-[3px] border text-sm font-semibold disabled:opacity-60';
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
