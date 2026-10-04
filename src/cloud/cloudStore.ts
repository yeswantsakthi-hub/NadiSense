import { doc, onSnapshot } from 'firebase/firestore';
import { create } from 'zustand';
import { firestore } from '../auth/firebase';
import { EMPTY_PROFILE, NO_CONSENT, type Consent, type Profile } from './model';

interface CloudState {
  /** False until the user document has been read (or there is no account). */
  loaded: boolean;
  profile: Profile;
  consent: Consent;
}

export const useCloudStore = create<CloudState>(() => ({
  loaded: false,
  profile: EMPTY_PROFILE,
  consent: NO_CONSENT,
}));

/** Mirrors users/{uid} into the store while signed in. Returns the unsubscribe function. */
export function watchUserDoc(uid: string): () => void {
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

export function resetCloudStore(): void {
  useCloudStore.setState({ loaded: false, profile: EMPTY_PROFILE, consent: NO_CONSENT });
}
