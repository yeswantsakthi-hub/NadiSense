import type { MessageKey } from '../i18n';

/** Firebase Auth error codes → user-facing message keys. Unknown codes get a generic message. */
const CODES: Record<string, MessageKey> = {
  'auth/invalid-credential': 'err.invalidCredential',
  'auth/wrong-password': 'err.invalidCredential',
  'auth/user-not-found': 'err.invalidCredential',
  'auth/invalid-login-credentials': 'err.invalidCredential',
  'auth/email-already-in-use': 'err.emailInUse',
  'auth/weak-password': 'err.weakPassword',
  'auth/invalid-email': 'err.invalidEmail',
  'auth/missing-email': 'err.invalidEmail',
  'auth/too-many-requests': 'err.tooMany',
  'auth/network-request-failed': 'err.network',
};

export function authErrorKey(error: unknown): MessageKey {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return CODES[code] ?? 'err.generic';
}

export const MIN_PASSWORD = 8;

/** Checks done before calling Firebase, so people get instant, translated feedback. */
export function validateSignUp(name: string, password: string, confirm: string): MessageKey | null {
  if (!name.trim()) return 'err.nameRequired';
  if (password.length < MIN_PASSWORD) return 'err.passwordShort';
  if (password !== confirm) return 'err.passwordMismatch';
  return null;
}
