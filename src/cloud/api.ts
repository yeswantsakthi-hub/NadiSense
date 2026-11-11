/**
 * Cloud backup and doctor links. Each call loads the Firestore code on first use, so Firebase
 * stays out of the app's start-up download.
 */
import type * as Impl from './firestoreApi';

export type { ShareLink } from './firestoreApi';

const impl = () => import('./firestoreApi');

export const saveProfile: typeof Impl.saveProfile = async (...args: Parameters<typeof Impl.saveProfile>) =>
  (await impl()).saveProfile(...args);
export const saveConsent: typeof Impl.saveConsent = async (...args: Parameters<typeof Impl.saveConsent>) =>
  (await impl()).saveConsent(...args);
export const saveSession: typeof Impl.saveSession = async (...args: Parameters<typeof Impl.saveSession>) =>
  (await impl()).saveSession(...args);
export const listSessions: typeof Impl.listSessions = async (...args: Parameters<typeof Impl.listSessions>) =>
  (await impl()).listSessions(...args);
export const saveRecording: typeof Impl.saveRecording = async (...args: Parameters<typeof Impl.saveRecording>) =>
  (await impl()).saveRecording(...args);
export const createShare: typeof Impl.createShare = async (...args: Parameters<typeof Impl.createShare>) =>
  (await impl()).createShare(...args);
export const listShares: typeof Impl.listShares = async (...args: Parameters<typeof Impl.listShares>) =>
  (await impl()).listShares(...args);
export const revokeShare: typeof Impl.revokeShare = async (...args: Parameters<typeof Impl.revokeShare>) =>
  (await impl()).revokeShare(...args);
export const readShare: typeof Impl.readShare = async (...args: Parameters<typeof Impl.readShare>) =>
  (await impl()).readShare(...args);
export const exportAll: typeof Impl.exportAll = async (...args: Parameters<typeof Impl.exportAll>) =>
  (await impl()).exportAll(...args);
export const deleteCloudData: typeof Impl.deleteCloudData = async (...args: Parameters<typeof Impl.deleteCloudData>) =>
  (await impl()).deleteCloudData(...args);
export const deleteAccount: typeof Impl.deleteAccount = async (...args: Parameters<typeof Impl.deleteAccount>) =>
  (await impl()).deleteAccount(...args);
