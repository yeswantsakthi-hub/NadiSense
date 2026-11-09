import Dexie, { liveQuery, type Table } from 'dexie';
import { useEffect, useState } from 'react';
import type { SessionSummary } from '../cloud/model';
import type { ValidationSession } from '../validation/model';

/** Sessions shorter than this aren't worth keeping (a quick connect/disconnect). */
export const MIN_SESSION_S = 30;

/**
 * On-device database (IndexedDB). Works offline and without an account; the cloud is only an
 * optional backup. `source` is 'ble' for the real ring and 'mock' for the simulator.
 */
class NadiDb extends Dexie {
  sessions!: Table<SessionSummary, string>;
  validations!: Table<ValidationSession, string>;

  constructor() {
    super('nadisense');
    this.version(1).stores({ sessions: 'id, startedAt, day, source' });
    // Stage 3: validation sessions (ring samples + reference readings) for the accuracy table.
    this.version(2).stores({ validations: 'id, startedAt, volunteerId' });
  }
}

export const db = new NadiDb();

export async function saveLocalSession(summary: SessionSummary): Promise<void> {
  if (summary.durationS < MIN_SESSION_S) return;
  await db.sessions.put(summary);
}

/** Re-renders whenever the query's result changes in the database. */
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: () => setValue(initial) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Sessions from one source (ring or simulator), oldest first. */
export function useSessions(source: SessionSummary['source']): SessionSummary[] {
  return useLiveQuery(() => db.sessions.where('source').equals(source).sortBy('startedAt'), [source], []);
}

/** Validation sessions, newest first. */
export function useValidations(): ValidationSession[] {
  return useLiveQuery(() => db.validations.orderBy('startedAt').reverse().toArray(), [], []);
}
