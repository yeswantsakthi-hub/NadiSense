import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

import { firebaseConfig as config, firebaseConfigured } from './config';

/**
 * Only loaded on demand (see authStore and cloud/api): people using the app without an account
 * never download Firebase.
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function firebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured) return null;
  app ??= initializeApp(config);
  return app;
}

/** Firebase Auth, or null while the project isn't configured in .env.local. */
export function firebaseAuth(): Auth | null {
  const a = firebaseApp();
  if (!a) return null;
  auth ??= getAuth(a);
  return auth;
}

/** Firestore with an on-device cache, so writes made offline sync later. Null while unconfigured. */
export function firestore(): Firestore | null {
  const a = firebaseApp();
  if (!a) return null;
  db ??= initializeFirestore(a, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  return db;
}
