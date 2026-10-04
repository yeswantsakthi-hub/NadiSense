import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/** Web config from the Firebase console (Project settings → Your apps). Not secret, but kept out of git. */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every((v) => typeof v === 'string' && v.length > 0);

let auth: Auth | null = null;

/** Firebase Auth, or null while the project isn't configured in .env.local. */
export function firebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null;
  auth ??= getAuth(initializeApp(config));
  return auth;
}
