import * as SQLite from 'expo-sqlite';

export type Exercise = 'Squat' | 'Bench Press' | 'Deadlift' | 'Clean & Press';
export const EXERCISES: Exercise[] = [
  'Squat',
  'Bench Press',
  'Deadlift',
  'Clean & Press',
];

export type LiftRecord = {
  id: number;
  exercise: Exercise;
  weight: number;
  reps: number;
  recorded_at: string;
};

export type Fast = {
  id: number;
  start_time: string;
  end_time: string | null;
};

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('fitlog.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS lift_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT
    );
  `);
}

function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized yet');
  return db;
}

// ---------- Lifts ----------

export async function insertLift(
  exercise: Exercise,
  weight: number,
  reps: number,
  recordedAt: string
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO lift_records
      (exercise, weight, reps, recorded_at)
     VALUES (?, ?, ?, ?)`,
    [exercise, weight, reps, recordedAt]
  );
}

export async function getLatestLift(
  exercise: Exercise
): Promise<LiftRecord | null> {
  const rows = await getDb().getAllAsync<LiftRecord>(
    `SELECT * FROM lift_records
     WHERE exercise = ?
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
    [exercise]
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function getMaxLift(
  exercise: Exercise
): Promise<LiftRecord | null> {
  const rows = await getDb().getAllAsync<LiftRecord>(
    `SELECT * FROM lift_records
     WHERE exercise = ?
     ORDER BY weight DESC, recorded_at DESC, id DESC
     LIMIT 1`,
    [exercise]
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function getAllLatestLifts(): Promise<
  Record<Exercise, LiftRecord | null>
> {
  const entries = await Promise.all(
    EXERCISES.map(async (ex) => [ex, await getLatestLift(ex)] as const)
  );

  return Object.fromEntries(entries) as Record<
    Exercise,
    LiftRecord | null
  >;
}

export async function getLiftHistory(
  exercise: Exercise
): Promise<LiftRecord[]> {
  return getDb().getAllAsync<LiftRecord>(
    `SELECT * FROM lift_records
     WHERE exercise = ?
     ORDER BY recorded_at ASC, id ASC`,
    [exercise]
  );
}

// ---------- Fasts ----------

export async function getActiveFast(): Promise<Fast | null> {
  const rows = await getDb().getAllAsync<Fast>(
    `SELECT * FROM fasts
     WHERE end_time IS NULL
     ORDER BY id DESC
     LIMIT 1`
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function startFast(startTime: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO fasts (start_time, end_time)
     VALUES (?, NULL)`,
    [startTime]
  );
}

export async function endFast(
  id: number,
  endTime: string
): Promise<void> {
  await getDb().runAsync(
    `UPDATE fasts
     SET end_time = ?
     WHERE id = ?`,
    [endTime, id]
  );
}

export async function insertManualFast(
  startTime: string,
  endTime: string
): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO fasts (start_time, end_time)
     VALUES (?, ?)`,
    [startTime, endTime]
  );
}

export async function getFastHistory(): Promise<Fast[]> {
  return getDb().getAllAsync<Fast>(
    `SELECT * FROM fasts
     WHERE end_time IS NOT NULL
     ORDER BY start_time DESC, id DESC`
  );
}

// ---------- Unified history ----------

export type HistoryItem =
  | { type: 'lift'; date: string; lift: LiftRecord }
  | { type: 'fast'; date: string; fast: Fast };

export async function getUnifiedHistory(): Promise<HistoryItem[]> {
  const lifts = await getDb().getAllAsync<LiftRecord>(
    `SELECT * FROM lift_records
     ORDER BY recorded_at DESC`
  );

  const fasts = await getDb().getAllAsync<Fast>(
    `SELECT * FROM fasts
     WHERE end_time IS NOT NULL
     ORDER BY start_time DESC`
  );

  const items: HistoryItem[] = [
    ...lifts.map((lift): HistoryItem => ({
      type: 'lift',
      date: lift.recorded_at,
      lift,
    })),
    ...fasts.map((fast): HistoryItem => ({
      type: 'fast',
      date: fast.start_time,
      fast,
    })),
  ];

  items.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );

  return items;
}

// ---------- Export ----------

export async function exportDatabaseData() {
  const lifts = await getDb().getAllAsync<LiftRecord>(
    `SELECT * FROM lift_records
     ORDER BY recorded_at ASC, id ASC`
  );

  const fasts = await getDb().getAllAsync<Fast>(
    `SELECT * FROM fasts
     ORDER BY start_time ASC, id ASC`
  );

  return {
    version: 2,
    exported_at: new Date().toISOString(),
    lifts,
    fasts,
  };
}

export async function importDatabaseData(data: {
  lifts: LiftRecord[];
  fasts: Fast[];
}): Promise<void> {
  const database = getDb();

  await database.withTransactionAsync(async () => {
    for (const lift of data.lifts) {
      const existing = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM lift_records WHERE id = ?',
        [lift.id]
      );

      if (!existing) {
        await database.runAsync(
          `INSERT INTO lift_records
            (id, exercise, weight, reps, recorded_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            lift.id,
            lift.exercise,
            lift.weight,
            lift.reps,
            lift.recorded_at,
          ]
        );
      }
    }

    for (const fast of data.fasts) {
      const existing = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM fasts WHERE id = ?',
        [fast.id]
      );

      if (!existing) {
        await database.runAsync(
          `INSERT INTO fasts
            (id, start_time, end_time)
           VALUES (?, ?, ?)`,
          [
            fast.id,
            fast.start_time,
            fast.end_time,
          ]
        );
      }
    }
  });
}

export async function deleteAllLifts(): Promise<void> {
  await getDb().runAsync('DELETE FROM lift_records');
}

export async function deleteAllFasts(): Promise<void> {
  await getDb().runAsync('DELETE FROM fasts');
}

export async function deleteEverything(): Promise<void> {
  await getDb().withTransactionAsync(async () => {
    await getDb().runAsync('DELETE FROM lift_records');
    await getDb().runAsync('DELETE FROM fasts');
  });
}