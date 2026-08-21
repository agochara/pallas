import * as SQLite from 'expo-sqlite';

export type Exercise =
  | 'Squat'
  | 'Bench Press'
  | 'Deadlift'
  | 'Clean & Press';

export const EXERCISES: Exercise[] = [
  'Squat',
  'Bench Press',
  'Deadlift',
  'Clean & Press',
];

export type LiftRecord = {
  exercise: Exercise;
  weight: number;
  reps: number;
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

    CREATE TABLE IF NOT EXISTS max_lifts (
      exercise TEXT PRIMARY KEY,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL
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
): Promise<void> {
  const current = await getMaxLift(exercise);

  if (
    current &&
    (weight < current.weight ||
      (weight === current.weight && reps <= current.reps))
  ) {
    return;
  }

  await getDb().runAsync(
    `INSERT OR REPLACE INTO max_lifts
      (exercise, weight, reps)
     VALUES (?, ?, ?)`,
    [exercise, weight, reps]
  );
}

export async function getMaxLift(
  exercise: Exercise
): Promise<LiftRecord | null> {
  return getDb().getFirstAsync<LiftRecord>(
    `SELECT * FROM max_lifts WHERE exercise = ?`,
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

// Edit an existing fast's start/end time (used for correcting mistakes).
export async function updateFast(
  id: number,
  startTime: string,
  endTime: string | null
): Promise<void> {
  await getDb().runAsync(
    `UPDATE fasts
     SET start_time = ?, end_time = ?
     WHERE id = ?`,
    [startTime, endTime, id]
  );
}

// Permanently remove a single fast entry.
export async function deleteFast(id: number): Promise<void> {
  await getDb().runAsync(`DELETE FROM fasts WHERE id = ?`, [id]);
}

export async function getFastHistory(): Promise<Fast[]> {
  return getDb().getAllAsync<Fast>(
    `SELECT * FROM fasts
     WHERE end_time IS NOT NULL
     ORDER BY start_time DESC, id DESC`
  );
}

// ---------- Export ----------

export async function exportDatabaseData() {
  const lifts = await getDb().getAllAsync<LiftRecord>(
    `SELECT * FROM max_lifts
     ORDER BY exercise ASC`
  );

  const fasts = await getDb().getAllAsync<Fast>(
    `SELECT * FROM fasts
     ORDER BY start_time ASC, id ASC`
  );

  return {
    version: 3,
    exported_at: new Date().toISOString(),
    lifts,
    fasts,
  };
}

// ---------- Import ----------

export async function importDatabaseData(data: {
  lifts: LiftRecord[];
  fasts: Fast[];
}): Promise<void> {
  const database = getDb();

  await database.withTransactionAsync(async () => {
    // Merge lifts by exercise.
    for (const lift of data.lifts) {
      const current = await database.getFirstAsync<LiftRecord>(
        `SELECT * FROM max_lifts
         WHERE exercise = ?`,
        [lift.exercise]
      );

      const shouldImport =
        !current ||
        lift.weight > current.weight ||
        (lift.weight === current.weight &&
          lift.reps > current.reps);

      if (shouldImport) {
        await database.runAsync(
          `INSERT OR REPLACE INTO max_lifts
            (exercise, weight, reps)
           VALUES (?, ?, ?, ?)`,
          [
            lift.exercise,
            lift.weight,
            lift.reps,
          ]
        );
      }
    }

    // Merge fasting history by ID.
    for (const fast of data.fasts) {
      const existing = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM fasts WHERE id = ?`,
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

// ---------- Delete ----------

export async function deleteAllLifts(): Promise<void> {
  await getDb().runAsync('DELETE FROM max_lifts');
}

export async function deleteAllFasts(): Promise<void> {
  await getDb().runAsync('DELETE FROM fasts');
}

export async function deleteEverything(): Promise<void> {
  await getDb().withTransactionAsync(async () => {
    await getDb().runAsync('DELETE FROM max_lifts');
    await getDb().runAsync('DELETE FROM fasts');
  });
}