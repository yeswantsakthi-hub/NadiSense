import { create } from 'zustand';
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

export function resetCloudStore(): void {
  useCloudStore.setState({ loaded: false, profile: EMPTY_PROFILE, consent: NO_CONSENT });
}
