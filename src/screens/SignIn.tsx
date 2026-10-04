import { useId, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { MIN_PASSWORD, validateSignUp } from '../auth/authErrors';
import { useAuthStore } from '../auth/authStore';
import { LanguagePicker } from '../components/LanguagePicker';
import { Masthead } from '../components/Masthead';
import { Panel } from '../components/Panel';
import { useI18n, type MessageKey } from '../i18n';

type Mode = 'signIn' | 'signUp' | 'reset';

export function SignIn() {
  const { t } = useI18n();
  const status = useAuthStore((s) => s.status);
  const { signIn, signUp, resetPassword, continueAsGuest } = useAuthStore();

  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'signUp') {
      const invalid = validateSignUp(name, password, confirm);
      if (invalid) return setError(invalid);
    }
    setBusy(true);
    const result =
      mode === 'signIn'
        ? await signIn(email, password)
        : mode === 'signUp'
          ? await signUp(name, email, password)
          : await resetPassword(email);
    setBusy(false);
    if (result) setError(result);
    else if (mode === 'reset') setNotice(t('auth.resetSent', { email: email.trim() }));
    // On sign-in / sign-up success the auth listener moves the app on.
  };

  const title = mode === 'signIn' ? t('auth.signIn') : mode === 'signUp' ? t('auth.createAccount') : t('auth.resetPassword');
  const submitLabel = mode === 'reset' ? t('auth.sendResetLink') : title;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-10 pb-8">
      <Masthead caption={t('connect.awaiting')} />

      <div className="mt-3 rounded-[3px] border border-line bg-panel p-3">
        <LanguagePicker />
      </div>

      {status === 'unconfigured' ? (
        <Panel label={t('auth.notConfiguredTitle')} className="mt-3 border-amber/40" labelClassName="!text-amber">
          <p className="text-sm text-muted">{t('auth.notConfiguredBody')}</p>
          <button
            type="button"
            onClick={continueAsGuest}
            className="mt-4 h-11 w-full rounded-[3px] border border-line-strong font-semibold transition-colors hover:border-fg/60"
          >
            {t('auth.continueWithout')}
          </button>
        </Panel>
      ) : status === 'loading' ? (
        <p role="status" className="mt-6 text-center text-sm text-muted">
          {t('auth.checking')}
        </p>
      ) : (
        <Panel label={title} className="mt-3">
          <form onSubmit={submit} noValidate className="space-y-3">
            {mode === 'signUp' && (
              <Field label={t('auth.name')} value={name} onChange={setName} autoComplete="name" required />
            )}
            <Field
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              inputMode="email"
              required
            />
            {mode !== 'reset' && (
              <Field
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                hint={mode === 'signUp' ? t('auth.passwordHint') : undefined}
                minLength={mode === 'signUp' ? MIN_PASSWORD : undefined}
                required
              />
            )}
            {mode === 'signUp' && (
              <Field
                label={t('auth.confirmPassword')}
                type="password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                required
              />
            )}

            {error && (
              <p role="alert" className="border-l-2 border-alert pl-3 text-sm text-alert">
                {t(error)}
              </p>
            )}
            {notice && (
              <p role="status" className="border-l-2 border-signal pl-3 text-sm text-fg">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-[3px] bg-signal font-semibold text-white transition-colors hover:bg-signal/85 disabled:opacity-60"
            >
              {busy ? t('auth.wait') : submitLabel}
            </button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2 border-t border-line pt-3 text-sm">
            {mode === 'signIn' && (
              <>
                <LinkButton onClick={() => switchMode('reset')}>{t('auth.forgot')}</LinkButton>
                <LinkButton onClick={() => switchMode('signUp')}>{t('auth.toCreate')}</LinkButton>
              </>
            )}
            {mode === 'signUp' && <LinkButton onClick={() => switchMode('signIn')}>{t('auth.toSignIn')}</LinkButton>}
            {mode === 'reset' && <LinkButton onClick={() => switchMode('signIn')}>{t('auth.back')}</LinkButton>}
          </div>
        </Panel>
      )}

      <p className="mt-4 text-center text-xs leading-relaxed text-label">{t('auth.privacy')}</p>
      <p className="mt-auto pt-6 text-center text-[11px] text-muted">{t('app.disclaimer')}</p>
    </div>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange(value: string): void;
  hint?: string;
}

function Field({ label, value, onChange, hint, ...input }: FieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label mb-1 block">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-[3px] border border-line bg-bg px-3 text-[15px] text-fg placeholder:text-muted focus:border-signal focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function LinkButton({ onClick, children }: { onClick(): void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-label underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg"
    >
      {children}
    </button>
  );
}
