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
  /** Only possible while Firebase isn't configured, so the app stays usable during setup. */
  continueAsGuest(): void;
}

const toAccount = (u: User): Account => ({ uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' });

/** Firebase sends reset emails in the app's current language. */
function syncEmailLanguage(): void {
  const auth = firebaseAuth();
  if (auth) auth.languageCode = useI18nStore.getState().lang;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: firebaseConfigured ? 'loading' : 'unconfigured',
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
    const auth = firebaseAuth();
    if (auth) await firebaseSignOut(auth);
    else set({ status: 'unconfigured', account: null });
  },

  continueAsGuest() {
    if (!firebaseConfigured) set({ status: 'guest' });
  },
}));

const auth = firebaseAuth();
if (auth) {
  onAuthStateChanged(auth, (user) => {
    useAuthStore.setState(user ? { status: 'signedIn', account: toAccount(user) } : { status: 'signedOut', account: null });
  });
}
