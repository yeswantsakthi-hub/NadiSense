/** Web config from the Firebase console (Project settings → Your apps). Not secret, but kept out of git. */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Checked without loading Firebase, so the app can start (and run offline) without it. */
export const firebaseConfigured = Object.values(firebaseConfig).every((v) => typeof v === 'string' && v.length > 0);
