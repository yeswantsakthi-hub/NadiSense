import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/** Web config from the Firebase console (Project settings → Your apps). Not secret, but kept out of git. */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every((v) => typeof v === 'string' && v.length > 0);

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
