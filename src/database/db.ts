import * as SQLite from 'expo-sqlite';

export type ExerciseType = 'weighted' | 'bodyweight';

export type ExerciseItem = {
  name: string;
  type: ExerciseType;
  is_custom: number;
};

export type Exercise = string;

export const DEFAULT_EXERCISES: { name: string; type: ExerciseType }[] = [
  { name: 'Deadlift', type: 'weighted' },
  { name: 'Clean', type: 'weighted' },
  { name: 'Press', type: 'weighted' },
  { name: 'Squat', type: 'weighted' },
  { name: 'Chins', type: 'bodyweight' },
  { name: 'Pullups', type: 'bodyweight' },
  { name: 'Bench Press', type: 'weighted' },
];

export const EXERCISES: Exercise[] = DEFAULT_EXERCISES.map((e) => e.name);

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

export type WeightEntry = {
  id: number;
  weight: number;
  date: string; // YYYY-MM-DD
};

export type NewsletterState = {
  id: number;
  issue_number: number;
  to_self_text: string;
  last_issue_date: string | null;
  archive_quote_1: string | null;
  archive_quote_2: string | null;
};

export type CoachEvent = {
  id: number;
  type: string;
  created_at: string;
  resolved: number;
};

export type CoachConfig = {
  key: string;
  value: number;
};

export type CoachStep = {
  date: string;
  steps: number;
};

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('pallas.db');

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

    CREATE TABLE IF NOT EXISTS weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight REAL NOT NULL,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vade_mecum (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO vade_mecum (id, content, updated_at)
    VALUES (1, '', datetime('now'));

    CREATE TABLE IF NOT EXISTS newsletter_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      issue_number INTEGER NOT NULL DEFAULT 33,
      to_self_text TEXT NOT NULL DEFAULT '',
      last_issue_date TEXT,
      archive_quote_1 TEXT,
      archive_quote_2 TEXT
    );

    INSERT OR IGNORE INTO newsletter_settings (id, issue_number, to_self_text)
    VALUES (1, 33, '');

    CREATE TABLE IF NOT EXISTS coach_config (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_threshold', 7000);
    INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_days', 3);
    INSERT OR IGNORE INTO coach_config (key, value) VALUES ('fasting_days', 3);
    INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_backfilled', 0);
    INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_bg_v2', 0);

    CREATE TABLE IF NOT EXISTS coach_steps (
      date TEXT PRIMARY KEY,
      steps INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coach_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exercises (
      name TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'weighted',
      is_custom INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Deadlift', 'weighted', 0);
    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Clean', 'weighted', 0);
    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Press', 'weighted', 0);
    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Squat', 'weighted', 0);
    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Chins', 'bodyweight', 0);
    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Pullups', 'bodyweight', 0);
    INSERT OR IGNORE INTO exercises (name, type, is_custom) VALUES ('Bench Press', 'weighted', 0);

    -- Migration: Clean & Press -> Clean and Press
    INSERT OR IGNORE INTO max_lifts (exercise, weight, reps)
      SELECT 'Clean', weight, reps FROM max_lifts WHERE exercise = 'Clean & Press';
    INSERT OR IGNORE INTO max_lifts (exercise, weight, reps)
      SELECT 'Press', weight, reps FROM max_lifts WHERE exercise = 'Clean & Press';
    DELETE FROM max_lifts WHERE exercise = 'Clean & Press';
    DELETE FROM exercises WHERE name = 'Clean & Press';
  `);

  // Safe migration for existing weight tables with recorded_at column
  const weightCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(weights);`);
  const hasRecordedAt = weightCols.some((c) => c.name === 'recorded_at');
  const hasDate = weightCols.some((c) => c.name === 'date');

  if (hasRecordedAt && !hasDate) {
    await db.withTransactionAsync(async () => {
      await db!.execAsync(`
        CREATE TABLE weights_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          weight REAL NOT NULL,
          date TEXT NOT NULL
        );
        INSERT INTO weights_new (id, weight, date)
        SELECT id, weight, substr(recorded_at, 1, 10) FROM weights;
        DROP TABLE weights;
        ALTER TABLE weights_new RENAME TO weights;
      `);
    });
  }
}

function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized yet');
  return db;
}

// ---------- Lifts ----------

export async function setLift(
  exercise: Exercise,
  weight: number,
  reps: number,
): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO max_lifts
      (exercise, weight, reps)
     VALUES (?, ?, ?)`,
    [exercise, weight, reps]
  );
}

export async function deleteLift(exercise: Exercise): Promise<void> {
  await getDb().runAsync(
    `DELETE FROM max_lifts WHERE exercise = ?`,
    [exercise]
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

export async function getAllMaxLifts(): Promise<LiftRecord[]> {
  return await getDb().getAllAsync<LiftRecord>(`SELECT * FROM max_lifts`);
}

export async function getExercises(): Promise<ExerciseItem[]> {
  return await getDb().getAllAsync<ExerciseItem>(
    `SELECT * FROM exercises ORDER BY is_custom ASC, rowid ASC`
  );
}

export async function addCustomExercise(name: string, type: ExerciseType): Promise<void> {
  await getDb().runAsync(
    `INSERT OR REPLACE INTO exercises (name, type, is_custom) VALUES (?, ?, 1)`,
    [name.trim(), type]
  );
}

export async function deleteCustomExercise(name: string): Promise<void> {
  await getDb().runAsync(`DELETE FROM exercises WHERE name = ? AND is_custom = 1`, [name]);
  await getDb().runAsync(`DELETE FROM max_lifts WHERE exercise = ?`, [name]);
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

// ---------- Body Weight ----------

export async function getWeights(): Promise<WeightEntry[]> {
  return getDb().getAllAsync<WeightEntry>(
    `SELECT * FROM weights
     ORDER BY date ASC, id ASC`
  );
}

export async function insertWeight(
  weight: number,
  date: string
): Promise<void> {
  const cleanDate = date.slice(0, 10);
  await getDb().runAsync(
    `INSERT INTO weights (weight, date)
     VALUES (?, ?)`,
    [weight, cleanDate]
  );
}

export async function updateWeight(
  id: number,
  weight: number,
  date: string
): Promise<void> {
  const cleanDate = date.slice(0, 10);
  await getDb().runAsync(
    `UPDATE weights
     SET weight = ?, date = ?
     WHERE id = ?`,
    [weight, cleanDate, id]
  );
}

export async function deleteWeight(id: number): Promise<void> {
  await getDb().runAsync(`DELETE FROM weights WHERE id = ?`, [id]);
}

export async function deleteAllWeights(): Promise<void> {
  await getDb().runAsync('DELETE FROM weights');
}

// ---------- Vade Mecum ----------

export async function getVadeMecum(): Promise<string> {
  const row = await getDb().getFirstAsync<{ content: string }>(
    `SELECT content FROM vade_mecum WHERE id = 1`
  );
  if (row) return row.content;

  await getDb().runAsync(
    `INSERT OR IGNORE INTO vade_mecum (id, content, updated_at)
     VALUES (1, '', ?)`,
    [new Date().toISOString()]
  );
  return '';
}

export async function saveVadeMecum(content: string): Promise<void> {
  await getDb().runAsync(
    `INSERT INTO vade_mecum (id, content, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       updated_at = excluded.updated_at`,
    [content, new Date().toISOString()]
  );
}

export async function clearVadeMecum(): Promise<void> {
  await getDb().runAsync(
    `UPDATE vade_mecum SET content = '', updated_at = ? WHERE id = 1`,
    [new Date().toISOString()]
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

  const weights = await getDb().getAllAsync<WeightEntry>(
    `SELECT * FROM weights
     ORDER BY date ASC, id ASC`
  );

  const vadeMecum = await getDb().getFirstAsync<{ content: string; updated_at: string }>(
    `SELECT content, updated_at FROM vade_mecum WHERE id = 1`
  );

  const study = await getDb().getFirstAsync<NewsletterState>(
    `SELECT * FROM newsletter_settings WHERE id = 1`
  );

  return {
    version: 6,
    exported_at: new Date().toISOString(),
    lifts,
    fasts,
    weights,
    vade_mecum: vadeMecum?.content ?? '',
    study: study ?? null,
  };
}

// ---------- Import ----------

export async function importDatabaseData(data: {
  lifts: LiftRecord[];
  fasts: Fast[];
  weights?: WeightEntry[];
  vade_mecum?: string | { content: string; updated_at?: string };
  study?: NewsletterState | null;
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
           VALUES (?, ?, ?)`,
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

    // Merge weight measurements by ID / date.
    if (Array.isArray(data.weights)) {
      for (const w of data.weights) {
        const existing = await database.getFirstAsync<{ id: number }>(
          `SELECT id FROM weights WHERE id = ?`,
          [w.id]
        );

        const dateVal = ((w as any).date ?? (w as any).recorded_at ?? '').slice(0, 10);
        if (!existing && dateVal) {
          await database.runAsync(
            `INSERT INTO weights
              (id, weight, date)
             VALUES (?, ?, ?)`,
            [w.id, w.weight, dateVal]
          );
        }
      }
    }

    // Merge Vade Mecum continuous notepad if provided.
    if (typeof data.vade_mecum === 'string') {
      if (data.vade_mecum.length > 0) {
        await database.runAsync(
          `INSERT INTO vade_mecum (id, content, updated_at)
           VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             content = excluded.content,
             updated_at = excluded.updated_at`,
          [data.vade_mecum, new Date().toISOString()]
        );
      }
    } else if (data.vade_mecum && typeof data.vade_mecum === 'object' && typeof (data.vade_mecum as any).content === 'string') {
      await database.runAsync(
        `INSERT INTO vade_mecum (id, content, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           content = excluded.content,
           updated_at = excluded.updated_at`,
        [(data.vade_mecum as any).content, (data.vade_mecum as any).updated_at || new Date().toISOString()]
      );
    }

    // Import study / newsletter state if provided.
    if (data.study) {
      await database.runAsync(
        `INSERT OR REPLACE INTO newsletter_settings
          (id, issue_number, to_self_text, last_issue_date, archive_quote_1, archive_quote_2)
         VALUES (1, ?, ?, ?, ?, ?)`,
        [
          data.study.issue_number || 33,
          data.study.to_self_text ?? '',
          data.study.last_issue_date ?? null,
          data.study.archive_quote_1 ?? null,
          data.study.archive_quote_2 ?? null,
        ]
      );
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
    await getDb().runAsync('DELETE FROM weights');
    await getDb().runAsync(
      `UPDATE vade_mecum SET content = '', updated_at = ? WHERE id = 1`,
      [new Date().toISOString()]
    );
    await getDb().runAsync('DELETE FROM newsletter_settings');
    await getDb().runAsync(
      `INSERT OR IGNORE INTO newsletter_settings (id, issue_number, to_self_text) VALUES (1, 33, '')`
    );
  });
}

// ---------- Direct SQL ----------

export async function executeRawSql(sql: string): Promise<string> {
  const database = getDb();
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('EXPLAIN')) {
    const rows = await database.getAllAsync(trimmed);
    return JSON.stringify(rows, null, 2);
  }

  await database.execAsync(trimmed);
  return 'Query executed successfully.';
}

// ---------- Newsletter (The Study) ----------

export async function getNewsletterState(): Promise<NewsletterState> {
  const row = await getDb().getFirstAsync<NewsletterState>(
    `SELECT * FROM newsletter_settings WHERE id = 1`
  );
  if (row) return row;

  await getDb().runAsync(
    `INSERT OR IGNORE INTO newsletter_settings (id, issue_number, to_self_text) VALUES (1, 33, '')`
  );
  return {
    id: 1,
    issue_number: 33,
    to_self_text: '',
    last_issue_date: null,
    archive_quote_1: null,
    archive_quote_2: null,
  };
}

export async function saveNewsletterSettings(settings: {
  issue_number?: number;
  to_self_text?: string;
}): Promise<void> {
  const current = await getNewsletterState();
  const issueNumber = settings.issue_number ?? current.issue_number;
  const toSelf =
    settings.to_self_text !== undefined
      ? settings.to_self_text
      : current.to_self_text;

  await getDb().runAsync(
    `UPDATE newsletter_settings
     SET issue_number = ?, to_self_text = ?
     WHERE id = 1`,
    [issueNumber, toSelf]
  );
}

export async function saveDailyNewsletterEdition(edition: {
  issue_number: number;
  last_issue_date: string;
  archive_quote_1: string;
  archive_quote_2: string;
}): Promise<void> {
  await getDb().runAsync(
    `UPDATE newsletter_settings
     SET issue_number = ?, last_issue_date = ?, archive_quote_1 = ?, archive_quote_2 = ?
     WHERE id = 1`,
    [
      edition.issue_number,
      edition.last_issue_date,
      edition.archive_quote_1,
      edition.archive_quote_2,
    ]
  );
}
// ---------- Coach ----------

export async function getCoachConfig(): Promise<Record<string, number>> {
  const rows = await getDb().getAllAsync<CoachConfig>(`SELECT * FROM coach_config`);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveCoachConfig(
  config: Partial<Record<string, number>>
): Promise<void> {
  const entries = Object.entries(config).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1])
  );
  const database = getDb();
  await database.withTransactionAsync(async () => {
    for (const [key, value] of entries) {
      await database.runAsync(
        `INSERT INTO coach_config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, Math.round(value)]
      );
    }
  });
}

export async function getCoachEvents(): Promise<CoachEvent[]> {
  return await getDb().getAllAsync<CoachEvent>(`SELECT * FROM coach_events WHERE resolved = 0 ORDER BY created_at ASC`);
}

export async function addCoachEvent(type: string): Promise<void> {
  const exists = await getDb().getFirstAsync<{ id: number }>(`SELECT id FROM coach_events WHERE type = ? AND resolved = 0`, [type]);
  if (!exists) {
    await getDb().runAsync(`INSERT INTO coach_events (type, created_at) VALUES (?, ?)`, [type, new Date().toISOString()]);
  }
}

export async function resolveCoachEvent(type: string): Promise<void> {
  // Rather than retaining resolved events, delete them as requested: "delete the event from coach_events rather than retaining historical resolved events"
  await getDb().runAsync(`DELETE FROM coach_events WHERE type = ?`, [type]);
}

export async function getCoachSteps(): Promise<CoachStep[]> {
  return await getDb().getAllAsync<CoachStep>(`SELECT * FROM coach_steps ORDER BY date ASC`);
}

export async function updateCoachSteps(date: string, steps: number): Promise<void> {
  await getDb().runAsync(`INSERT OR REPLACE INTO coach_steps (date, steps) VALUES (?, ?)`, [date, steps]);
}

// Keep a rolling two-year window. This comfortably satisfies the one-year
// history the graph needs while bounding database growth.
export async function pruneOldSteps(): Promise<void> {
  await getDb().runAsync(`DELETE FROM coach_steps WHERE date < date('now', '-2 years')`);
}

export async function deleteCoachStep(date: string): Promise<void> {
  await getDb().runAsync(`DELETE FROM coach_steps WHERE date = ?`, [date]);
}
