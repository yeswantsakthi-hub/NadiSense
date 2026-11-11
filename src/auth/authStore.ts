import { create } from 'zustand';
import { useI18nStore, type MessageKey } from '../i18n';
import { useSensorStore } from '../store/sensorStore';
import { authErrorKey } from './authErrors';
import type { FirebaseAccount } from './authImpl';
import { firebaseConfigured } from './config';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unconfigured' | 'guest';

export type Account = FirebaseAccount;

interface AuthState {
  status: AuthStatus;
  account: Account | null;
  /** Resolve to null on success, or a message key describing what went wrong. */
  signIn(email: string, password: string): Promise<MessageKey | null>;
  signUp(name: string, email: string, password: string): Promise<MessageKey | null>;
  resetPassword(email: string): Promise<MessageKey | null>;
  signOut(): Promise<void>;
  /** Use the app on this phone only, no account. Remembered, so it opens offline next time. */
  continueAsGuest(): void;
}

const GUEST_KEY = 'nadisense.guest';

function guestChosen(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberGuest(on: boolean): void {
  try {
    if (on) localStorage.setItem(GUEST_KEY, '1');
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // storage blocked: the choice lasts for this visit
  }
}

/**
 * Loads the Firebase half of sign-in on first use and starts following the signed-in account.
 * Guests never call this until they choose to sign in, so they never download Firebase.
 */
async function firebase() {
  const impl = await import('./authImpl');
  impl.listen((account) => {
    if (account) useAuthStore.setState({ status: 'signedIn', account });
    else useAuthStore.setState({ status: guestChosen() ? 'guest' : 'signedOut', account: null });
  });
  return impl;
}

/** Runs a Firebase call, turning failures into a message key. */
async function attempt(run: (impl: Awaited<ReturnType<typeof firebase>>) => Promise<void>): Promise<MessageKey | null> {
  if (!firebaseConfigured) return 'err.generic';
  try {
    await run(await firebase());
    return null;
  } catch (e) {
    return authErrorKey(e);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: guestChosen() ? 'guest' : firebaseConfigured ? 'loading' : 'unconfigured',
  account: null,

  signIn: (email, password) => attempt((f) => f.signIn(email.trim(), password)),

  signUp: (name, email, password) =>
    attempt(async (f) => {
      // The auth listener fired before the name was set; publish it now.
      set({ status: 'signedIn', account: await f.signUp(name.trim(), email.trim(), password) });
    }),

  async resetPassword(email) {
    const key = await attempt((f) => f.resetPassword(email.trim(), useI18nStore.getState().lang));
    // Don't reveal whether an account exists for this email.
    return key === 'err.invalidCredential' ? null : key;
  },

  async signOut() {
    await useSensorStore.getState().disconnect();
    rememberGuest(false);
    if (firebaseConfigured) {
      const f = await firebase().catch(() => null);
      await f?.signOutIfSignedIn();
    }
    set({ status: firebaseConfigured ? 'signedOut' : 'unconfigured', account: null });
  },

  continueAsGuest() {
    rememberGuest(true);
    set({ status: 'guest', account: null });
  },
}));

// Someone who isn't a guest may have a saved sign-in: load Firebase now to restore it.
// Offline with no cached Firebase code, fall back to the sign-in screen.
if (firebaseConfigured && !guestChosen()) {
  firebase().catch(() => useAuthStore.setState({ status: 'signedOut' }));
}
