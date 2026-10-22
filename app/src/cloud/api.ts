import { deleteUser } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { firebaseAuth, firestore } from '../auth/firebase';
import {
  MAX_RECORDING_BYTES,
  SHARE_DAYS,
  localDay,
  newShareToken,
  recordingBytes,
  rollupByDay,
  type Consent,
  type Profile,
  type Recording,
  type SessionSummary,
  type ShareSnapshot,
} from './model';

const DAY_MS = 86_400_000;

function context() {
  const db = firestore();
  const uid = firebaseAuth()?.currentUser?.uid;
  if (!db || !uid) throw new Error('not-signed-in');
  return { db, uid, user: doc(db, 'users', uid) };
}

export async function saveProfile(profile: Profile): Promise<void> {
  const { user } = context();
  await setDoc(user, { profile, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveConsent(consent: Consent): Promise<void> {
  const { user } = context();
  await setDoc(user, { consent, updatedAt: serverTimestamp() }, { merge: true });
}

/** Upserts the summary for a session; called periodically and when the session ends. */
export async function saveSession(summary: SessionSummary): Promise<void> {
  const { user } = context();
  await setDoc(doc(user, 'sessions', summary.id), summary);
}

export async function listSessions(days: number, now = Date.now()): Promise<SessionSummary[]> {
  const { user } = context();
  const since = localDay(now - (days - 1) * DAY_MS);
  const snap = await getDocs(query(collection(user, 'sessions'), where('day', '>=', since), orderBy('day', 'desc')));
  return snap.docs.map((d) => d.data() as SessionSummary);
}

export async function saveRecording(recording: Recording): Promise<void> {
  if (recordingBytes(recording) > MAX_RECORDING_BYTES) throw new Error('recording-too-large');
  const { user } = context();
  await setDoc(doc(user, 'recordings', recording.id), recording);
}

export interface ShareLink {
  token: string;
  createdAt: number;
  expiresAt: number;
}

/** Snapshots the last week into a public, unguessable document a doctor can open read-only. */
export async function createShare(name: string, profile: Profile, now = Date.now()): Promise<ShareLink> {
  const { db, uid, user } = context();
  const token = newShareToken();
  const snapshot: ShareSnapshot = {
    name,
    age: profile.age,
    sex: profile.sex,
    generatedAt: now,
    days: rollupByDay(await listSessions(SHARE_DAYS, now)),
  };
  const link: ShareLink = { token, createdAt: now, expiresAt: now + SHARE_DAYS * DAY_MS };
  const batch = writeBatch(db);
  batch.set(doc(db, 'shares', token), {
    ownerUid: uid,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(link.expiresAt),
    snapshot,
  });
  batch.set(doc(user, 'shares', token), link);
  await batch.commit();
  return link;
}

export async function listShares(now = Date.now()): Promise<ShareLink[]> {
  const { user } = context();
  const snap = await getDocs(query(collection(user, 'shares'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as ShareLink).filter((s) => s.expiresAt > now);
}

export async function revokeShare(token: string): Promise<void> {
  const { db, user } = context();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'shares', token));
  batch.delete(doc(user, 'shares', token));
  await batch.commit();
}

/** Public: anyone with the token may read this one document until it expires (enforced by rules). */
export async function readShare(token: string): Promise<ShareSnapshot | null> {
  const db = firestore();
  if (!db || !/^[0-9a-f]{32}$/.test(token)) return null;
  try {
    const snap = await getDoc(doc(db, 'shares', token));
    return snap.exists() ? ((snap.data().snapshot as ShareSnapshot) ?? null) : null;
  } catch {
    return null; // expired, revoked or blocked by rules
  }
}

/** Everything stored for this account, as one JSON-friendly object. */
export async function exportAll(): Promise<Record<string, unknown>> {
  const { user } = context();
  const [profileDoc, sessions, recordings, shares] = await Promise.all([
    getDoc(user),
    getDocs(collection(user, 'sessions')),
    getDocs(collection(user, 'recordings')),
    getDocs(collection(user, 'shares')),
  ]);
  const data = profileDoc.data() ?? {};
  return {
    exportedAt: new Date().toISOString(),
    profile: data.profile ?? null,
    consent: data.consent ?? null,
    sessions: sessions.docs.map((d) => d.data()),
    recordings: recordings.docs.map((d) => d.data()),
    shares: shares.docs.map((d) => d.data()),
  };
}

async function deleteInChunks(refs: DocumentReference[]): Promise<void> {
  const db = firestore();
  if (!db) return;
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/** Removes every reading, recording, share link and the profile from the cloud. */
export async function deleteCloudData(): Promise<void> {
  const { db, user } = context();
  const [sessions, recordings, shares] = await Promise.all([
    getDocs(collection(user, 'sessions')),
    getDocs(collection(user, 'recordings')),
    getDocs(collection(user, 'shares')),
  ]);
  await deleteInChunks([
    ...sessions.docs.map((d) => d.ref),
    ...recordings.docs.map((d) => d.ref),
    ...shares.docs.map((d) => doc(db, 'shares', d.id)),
    ...shares.docs.map((d) => d.ref),
  ]);
  await deleteDoc(user);
}

/** Deletes cloud data, then the login itself. Firebase may ask for a fresh sign-in first. */
export async function deleteAccount(): Promise<void> {
  const current = firebaseAuth()?.currentUser;
  if (!current) throw new Error('not-signed-in');
  await deleteCloudData();
  await deleteUser(current);
}
