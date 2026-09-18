import {
  getActiveFast,
  getFastHistory,
  getWeights,
  getExercises,
  getAllMaxLifts,
  getCoachEvents,
  LiftRecord,
} from '../database/db';

// Session-level, in-memory read-through cache for the Askesis screens.
//
// Every Askesis tab unmounts when you switch away, so on return each screen
// would otherwise start empty and flicker as SQLite answers. Warming this cache
// at app boot lets each screen seed its initial state synchronously and then
// revalidate in the background, so tab switches paint complete content.

export const ASKESIS_KEYS = {
  activeFast: 'askesis.activeFast',
  fastHistory: 'askesis.fastHistory',
  weights: 'askesis.weights',
  exercises: 'askesis.exercises',
  maxLiftMap: 'askesis.maxLiftMap',
  coachEvents: 'askesis.coachEvents',
} as const;

type Key = (typeof ASKESIS_KEYS)[keyof typeof ASKESIS_KEYS];

const store = new Map<Key, unknown>();
const inflight = new Map<Key, Promise<unknown>>();

export function getCached<T>(key: Key): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: Key, value: T): void {
  store.set(key, value);
}

// Read-through: always fetches fresh data, but coalesces concurrent requests
// for the same key. The result becomes the cached value for the next mount.
export async function loadCached<T>(key: Key, loader: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const request = loader()
    .then((value) => {
      store.set(key, value);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export async function loadMaxLiftMap(): Promise<Record<string, LiftRecord>> {
  const lifts = await getAllMaxLifts();
  const map: Record<string, LiftRecord> = {};
  lifts.forEach((l) => {
    map[l.exercise] = l;
  });
  return map;
}

// Load every Askesis dataset once so the first switch into any tab is instant.
export async function warmAskesisCache(): Promise<void> {
  await Promise.all([
    loadCached(ASKESIS_KEYS.activeFast, getActiveFast),
    loadCached(ASKESIS_KEYS.fastHistory, getFastHistory),
    loadCached(ASKESIS_KEYS.weights, getWeights),
    loadCached(ASKESIS_KEYS.exercises, getExercises),
    loadCached(ASKESIS_KEYS.maxLiftMap, loadMaxLiftMap),
    loadCached(ASKESIS_KEYS.coachEvents, getCoachEvents),
  ]);
}
