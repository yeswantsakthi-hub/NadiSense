import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { create } from 'zustand';
import { resetCloudStore, watchUserDoc } from '../cloud/cloudStore';
import { useI18nStore, type MessageKey } from '../i18n';
import { useSensorStore } from '../store/sensorStore';
import { authErrorKey } from './authErrors';
import { firebaseAuth, firebaseConfigured } from './firebase';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unconfigured' | 'guest';

export interface Account {
  uid: string;
  email: string;
  name: string;
}

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

const toAccount = (u: User): Account => ({ uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' });

/** Firebase sends reset emails in the app's current language. */
function syncEmailLanguage(): void {
  const auth = firebaseAuth();
  if (auth) auth.languageCode = useI18nStore.getState().lang;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: guestChosen() ? 'guest' : firebaseConfigured ? 'loading' : 'unconfigured',
  account: null,

  async signIn(email, password) {
    const auth = firebaseAuth();
    if (!auth) return 'err.generic';
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return null;
    } catch (e) {
      return authErrorKey(e);
    }
  },

  async signUp(name, email, password) {
    const auth = firebaseAuth();
    if (!auth) return 'err.generic';
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      // onAuthStateChanged fired before the name was set; publish it now.
      set({ status: 'signedIn', account: toAccount(user) });
      return null;
    } catch (e) {
      return authErrorKey(e);
    }
  },

  async resetPassword(email) {
    const auth = firebaseAuth();
    if (!auth) return 'err.generic';
    syncEmailLanguage();
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return null;
    } catch (e) {
      const key = authErrorKey(e);
      // Don't reveal whether an account exists for this email.
      return key === 'err.invalidCredential' ? null : key;
    }
  },

  async signOut() {
    await useSensorStore.getState().disconnect();
    rememberGuest(false);
    const auth = firebaseAuth();
    if (auth?.currentUser) await firebaseSignOut(auth);
    set({ status: auth ? 'signedOut' : 'unconfigured', account: null });
  },

  continueAsGuest() {
    rememberGuest(true);
    set({ status: 'guest', account: null });
  },
}));

const auth = firebaseAuth();
let stopUserDoc: (() => void) | null = null;
if (auth) {
  onAuthStateChanged(auth, (user) => {
    stopUserDoc?.();
    stopUserDoc = null;
    resetCloudStore();
    if (user) stopUserDoc = watchUserDoc(user.uid);
    if (user) useAuthStore.setState({ status: 'signedIn', account: toAccount(user) });
    else useAuthStore.setState({ status: guestChosen() ? 'guest' : 'signedOut', account: null });
  });
}
