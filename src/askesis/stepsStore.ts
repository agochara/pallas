import { getCoachSteps, CoachStep } from '../database/db';

// In-memory, session-level cache of the full daily steps history.
//
// SQLite reads are fast but asynchronous, so a screen that mounts with an
// empty array flashes an empty chart until the query resolves. Holding the
// last known history here lets the UI paint instantly (stale-while-revalidate)
// and makes range switching a pure in-memory filter with no DB round-trip.

let stepsCache: CoachStep[] | null = null;
let cacheVersion = 0;
let inflight: Promise<CoachStep[]> | null = null;

export function getCachedSteps(): CoachStep[] | null {
  return stepsCache;
}

export function hasStepsCache(): boolean {
  return stepsCache !== null;
}

export function setCachedSteps(list: CoachStep[]): void {
  stepsCache = list;
  cacheVersion++;
}

// Cheap identity check so consumers can skip re-rendering when a refresh
// returns data that is equivalent to what is already on screen. The rolling
// hash catches changes to interior days (e.g. a backfill filling a gap) that a
// first/last-only check would miss.
export function stepsSignature(list: CoachStep[]): string {
  if (list.length === 0) return '0';
  let hash = 0;
  for (const s of list) {
    hash = (Math.imul(hash, 31) + s.steps + 1) | 0;
  }
  return `${list.length}:${list[0].date}:${list[list.length - 1].date}:${hash}`;
}

export async function loadStepsFromDb(): Promise<CoachStep[]> {
  if (inflight) return inflight;

  const versionAtStart = cacheVersion;
  inflight = (async () => {
    try {
      const list = await getCoachSteps();
      // A sync may have written fresher data while this read was in flight.
      if (versionAtStart === cacheVersion) {
        stepsCache = list;
      }
      return stepsCache ?? list;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
