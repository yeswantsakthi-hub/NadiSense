import { useEffect, useState } from 'react';
import { useAuthStore } from '../auth/authStore';
import { createShare, listShares, revokeShare, type ShareLink } from '../cloud/api';
import { useCloudStore } from '../cloud/cloudStore';
import { Panel } from '../components/Panel';
import { useI18n } from '../i18n';
import { shareUrl } from '../lib/route';

/** Doctor links: create a read-only weekly snapshot, copy its link, revoke it. */
export function Report() {
  const { t, date } = useI18n();
  const account = useAuthStore((s) => s.account);
  const { profile, consent } = useCloudStore();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const refresh = () => listShares().then(setLinks, () => setError(true));
  useEffect(() => {
    if (account) refresh();
  }, [account]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(false);
    try {
      await action();
      await refresh();
    } catch {
      setError(true);
    }
    setBusy(false);
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt(t('share.copy'), shareUrl(token));
    }
  };

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl pt-2">
        <Panel label={t('report.title')}>
          <p className="text-sm text-muted">{t('cloud.guest')}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 pt-2">
      <Panel label={t('report.title')}>
        <p className="text-sm text-muted">{t('share.body')}</p>
        {!consent.summaries && <p className="mt-2 text-xs text-amber">{t('share.needBackup')}</p>}
        <button
          type="button"
          disabled={busy || !consent.summaries}
          onClick={() => run(() => createShare(account.name || account.email, profile))}
          className="mt-3 h-11 w-full rounded-[3px] bg-signal font-semibold text-white hover:bg-signal/85 disabled:opacity-50"
        >
          {busy ? t('auth.wait') : t('share.create')}
        </button>
        {error && (
          <p role="alert" className="mt-3 border-l-2 border-alert pl-3 text-sm text-alert">
            {t('err.generic')}
          </p>
        )}
      </Panel>

      <Panel label={t('share.active')} aside={<span className="font-mono">{links.length}</span>}>
        {links.length === 0 ? (
          <p className="text-sm text-muted">{t('share.none')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {links.map((l) => (
              <li key={l.token} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-fg">{shareUrl(l.token)}</p>
                  <p className="text-[11px] text-label">{t('share.expires', { date: date(l.expiresAt) })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(l.token)}
                  className="h-9 rounded-[3px] border border-line-strong px-3 text-xs font-semibold hover:border-fg/60"
                >
                  {copied === l.token ? t('share.copied') : t('share.copy')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => revokeShare(l.token))}
                  className="h-9 rounded-[3px] border border-alert/60 px-3 text-xs font-semibold text-alert hover:bg-alert/10 disabled:opacity-50"
                >
                  {t('share.revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
