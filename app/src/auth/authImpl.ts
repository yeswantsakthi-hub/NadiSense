/**
 * The Firebase half of sign-in. Loaded on demand by authStore, so the app starts (and runs
 * offline) without downloading Firebase when nobody is signed in.
 */
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { resetCloudStore, useCloudStore } from '../cloud/cloudStore';
import { EMPTY_PROFILE, NO_CONSENT, type Consent, type Profile } from '../cloud/model';
import { firebaseAuth, firestore } from './firebase';

export interface FirebaseAccount {
  uid: string;
  email: string;
  name: string;
}

const toAccount = (u: User): FirebaseAccount => ({ uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' });

function auth() {
  const a = firebaseAuth();
  if (!a) throw new Error('unconfigured');
  return a;
}

/** Mirrors users/{uid} into the cloud store while signed in. Returns the unsubscribe function. */
function watchUserDoc(uid: string): () => void {
  const db = firestore();
  if (!db) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const data = snap.data() ?? {};
      useCloudStore.setState({
        loaded: true,
        profile: { ...EMPTY_PROFILE, ...(data.profile as Partial<Profile> | undefined) },
        consent: { ...NO_CONSENT, ...(data.consent as Partial<Consent> | undefined) },
      });
    },
    () => useCloudStore.setState({ loaded: true }),
  );
}

let listening = false;

/** Reports the signed-in account (or null) now and on every change. Safe to call more than once. */
export function listen(onChange: (account: FirebaseAccount | null) => void): void {
  if (listening) return;
  listening = true;
  let stopUserDoc: (() => void) | null = null;
  onAuthStateChanged(auth(), (user) => {
    stopUserDoc?.();
    stopUserDoc = null;
    resetCloudStore();
    if (user) stopUserDoc = watchUserDoc(user.uid);
    onChange(user ? toAccount(user) : null);
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email, password);
}

export async function signUp(name: string, email: string, password: string): Promise<FirebaseAccount> {
  const { user } = await createUserWithEmailAndPassword(auth(), email, password);
  await updateProfile(user, { displayName: name });
  return toAccount(user);
}

/** Firebase sends the reset email in `lang`. */
export async function resetPassword(email: string, lang: string): Promise<void> {
  const a = auth();
  a.languageCode = lang;
  await sendPasswordResetEmail(a, email);
}

export async function signOutIfSignedIn(): Promise<void> {
  const a = firebaseAuth();
  if (a?.currentUser) await signOut(a);
}
