package com.example.pallas.data.db

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class LiftRecord(
    val exercise: String,
    val weight: Double,
    val reps: Int
)

data class ExerciseItem(
    val name: String,
    val type: String, // "weighted" or "bodyweight"
    val isCustom: Boolean
)

data class Fast(
    val id: Long,
    val startTime: Long,
    val endTime: Long?
)

data class WeightEntry(
    val id: Long,
    val weight: Double,
    val date: String // YYYY-MM-DD
)

data class NewsletterState(
    val id: Long = 1,
    val issueNumber: Int = 33,
    val toSelfText: String = "",
    val lastIssueDate: String? = null,
    val archiveQuote1: String? = null,
    val archiveQuote2: String? = null
)

data class CoachEvent(
    val id: Long,
    val type: String,
    val createdAt: String,
    val resolved: Int
)

data class CoachStep(
    val date: String,
    val steps: Int
)

class PallasDatabase(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        const val DATABASE_NAME = "pallas.db"
        const val DATABASE_VERSION = 2

        @Volatile
        private var instance: PallasDatabase? = null

        fun getInstance(context: Context): PallasDatabase {
            return instance ?: synchronized(this) {
                instance ?: PallasDatabase(context.applicationContext).also { instance = it }
            }
        }

        private fun getIsoNow(): String {
            val df = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            df.timeZone = TimeZone.getTimeZone("UTC")
            return df.format(Date())
        }

        private fun seedCoachConfig(db: SQLiteDatabase) {
            db.execSQL("INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_threshold', 7000);")
            db.execSQL("INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_days', 3);")
            db.execSQL("INSERT OR IGNORE INTO coach_config (key, value) VALUES ('fasting_days', 3);")
            db.execSQL("INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_backfilled', 0);")
            db.execSQL("INSERT OR IGNORE INTO coach_config (key, value) VALUES ('steps_bg_v2', 0);")
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS max_lifts (
                exercise TEXT PRIMARY KEY,
                weight REAL NOT NULL,
                reps INTEGER NOT NULL
            );
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS fasts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT NOT NULL,
                end_time TEXT
            );
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS weights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                weight REAL NOT NULL,
                date TEXT NOT NULL
            );
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS vade_mecum (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            );
        """.trimIndent())

        db.execSQL("""
            INSERT OR IGNORE INTO vade_mecum (id, content, updated_at)
            VALUES (1, '', datetime('now'));
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS newsletter_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                issue_number INTEGER NOT NULL DEFAULT 33,
                to_self_text TEXT NOT NULL DEFAULT '',
                last_issue_date TEXT,
                archive_quote_1 TEXT,
                archive_quote_2 TEXT
            );
        """.trimIndent())

        db.execSQL("""
            INSERT OR IGNORE INTO newsletter_settings (id, issue_number, to_self_text)
            VALUES (1, 33, '');
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS coach_config (
                key TEXT PRIMARY KEY,
                value INTEGER NOT NULL
            );
        """.trimIndent())

        seedCoachConfig(db)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS coach_steps (
                date TEXT PRIMARY KEY,
                steps INTEGER NOT NULL
            );
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS coach_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                resolved INTEGER NOT NULL DEFAULT 0
            );
        """.trimIndent())

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS exercises (
                name TEXT PRIMARY KEY,
                type TEXT NOT NULL DEFAULT 'weighted',
                is_custom INTEGER NOT NULL DEFAULT 0
            );
        """.trimIndent())

        val defaultExercises = listOf(
            Pair("Deadlift", "weighted"),
            Pair("Clean", "weighted"),
            Pair("Press", "weighted"),
            Pair("Squat", "weighted"),
            Pair("Chins", "bodyweight"),
            Pair("Pullups", "bodyweight"),
            Pair("Bench Press", "weighted")
        )
        for ((name, type) in defaultExercises) {
            val cv = ContentValues().apply {
                put("name", name)
                put("type", type)
                put("is_custom", 0)
            }
            db.insertWithOnConflict("exercises", null, cv, SQLiteDatabase.CONFLICT_IGNORE)
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.rawQuery("SELECT id, start_time, end_time FROM fasts", null).use { c ->
                while (c.moveToNext()) {
                    val id = c.getLong(0)
                    val startStr = c.getString(1)
                    val endStr = if (c.isNull(2)) null else c.getString(2)

                    val startMs = parseToEpochMs(startStr)
                    val endMs = endStr?.let { parseToEpochMs(it) }

                    val cv = ContentValues().apply {
                        put("start_time", startMs.toString())
                        if (endMs != null) put("end_time", endMs.toString())
                        else putNull("end_time")
                    }
                    db.update("fasts", cv, "id = ?", arrayOf(id.toString()))
                }
            }
        }
    }

    private fun parseToEpochMs(isoString: String): Long {
        isoString.toLongOrNull()?.let { return it }
        return try {
            java.time.Instant.parse(isoString).toEpochMilli()
        } catch (e: Exception) {
            try {
                val clean = isoString.trim()
                if (!clean.endsWith("Z") && !clean.contains("+") && clean.indexOf("-", startIndex = 10) == -1) {
                    java.time.LocalDateTime.parse(clean.take(19)).atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                } else {
                    java.time.Instant.parse(clean).toEpochMilli()
                }
            } catch (e2: Exception) {
                try {
                    java.time.LocalDate.parse(isoString.take(10)).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
                } catch (e3: Exception) {
                    System.currentTimeMillis()
                }
            }
        }
    }

    override fun onOpen(db: SQLiteDatabase) {
        super.onOpen(db)
        // Enforce strictly only two exercise types: 'weighted' and 'bodyweight'
        db.execSQL("UPDATE exercises SET type = 'weighted' WHERE type NOT IN ('weighted', 'bodyweight');")
    }

    // -------------------------------------------------------------
    // Max Lifts & Exercises
    // -------------------------------------------------------------

    suspend fun getAllMaxLifts(): List<LiftRecord> = withContext(Dispatchers.IO) {
        val list = mutableListOf<LiftRecord>()
        readableDatabase.rawQuery("SELECT exercise, weight, reps FROM max_lifts ORDER BY exercise ASC", null).use { c ->
            while (c.moveToNext()) {
                list.add(LiftRecord(c.getString(0), c.getDouble(1), c.getInt(2)))
            }
        }
        list
    }

    suspend fun setLift(exercise: String, weight: Double, reps: Int) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("exercise", exercise)
            put("weight", weight)
            put("reps", reps)
        }
        writableDatabase.insertWithOnConflict("max_lifts", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    suspend fun deleteLift(exercise: String) = withContext(Dispatchers.IO) {
        writableDatabase.delete("max_lifts", "exercise = ?", arrayOf(exercise))
    }

    suspend fun getExercises(): List<ExerciseItem> = withContext(Dispatchers.IO) {
        val list = mutableListOf<ExerciseItem>()
        readableDatabase.rawQuery("SELECT name, type, is_custom FROM exercises ORDER BY is_custom ASC, rowid ASC", null).use { c ->
            while (c.moveToNext()) {
                val rawType = c.getString(1)
                val normalizedType = if (rawType.equals("bodyweight", ignoreCase = true)) "bodyweight" else "weighted"
                list.add(ExerciseItem(c.getString(0), normalizedType, c.getInt(2) == 1))
            }
        }
        list
    }

    suspend fun addCustomExercise(name: String, type: String) = withContext(Dispatchers.IO) {
        val normalizedType = if (type.equals("bodyweight", ignoreCase = true)) "bodyweight" else "weighted"
        val cv = ContentValues().apply {
            put("name", name.trim())
            put("type", normalizedType)
            put("is_custom", 1)
        }
        writableDatabase.insertWithOnConflict("exercises", null, cv, SQLiteDatabase.CONFLICT_IGNORE)
    }

    suspend fun deleteCustomExercise(name: String) = withContext(Dispatchers.IO) {
        writableDatabase.delete("exercises", "name = ? AND is_custom = 1", arrayOf(name))
        writableDatabase.delete("max_lifts", "exercise = ?", arrayOf(name))
    }

    // -------------------------------------------------------------
    // Fasts
    // -------------------------------------------------------------

    suspend fun getActiveFast(): Fast? = withContext(Dispatchers.IO) {
        readableDatabase.rawQuery("SELECT id, start_time, end_time FROM fasts WHERE end_time IS NULL ORDER BY id DESC LIMIT 1", null).use { c ->
            if (c.moveToNext()) {
                val start = c.getString(1)?.toLongOrNull() ?: 0L
                val end = c.getString(2)?.toLongOrNull()
                Fast(c.getLong(0), start, end)
            } else null
        }
    }

    suspend fun startFast(startTime: Long = System.currentTimeMillis()) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("start_time", startTime.toString())
            putNull("end_time")
        }
        writableDatabase.insert("fasts", null, cv)
    }

    suspend fun endFast(id: Long, endTime: Long = System.currentTimeMillis()) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("end_time", endTime.toString())
        }
        writableDatabase.update("fasts", cv, "id = ?", arrayOf(id.toString()))
    }

    suspend fun insertManualFast(startTime: Long, endTime: Long) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("start_time", startTime.toString())
            put("end_time", endTime.toString())
        }
        writableDatabase.insert("fasts", null, cv)
    }

    suspend fun updateFast(id: Long, startTime: Long, endTime: Long?) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("start_time", startTime.toString())
            if (endTime != null) put("end_time", endTime.toString()) else putNull("end_time")
        }
        writableDatabase.update("fasts", cv, "id = ?", arrayOf(id.toString()))
    }

    suspend fun deleteFast(id: Long) = withContext(Dispatchers.IO) {
        writableDatabase.delete("fasts", "id = ?", arrayOf(id.toString()))
    }

    suspend fun getFastHistory(): List<Fast> = withContext(Dispatchers.IO) {
        val list = mutableListOf<Fast>()
        // Note: ORDER BY start_time DESC works differently for strings if they are varying length.
        // Since epoch MS length is constant until year 2286, string comparison is fine.
        readableDatabase.rawQuery("SELECT id, start_time, end_time FROM fasts WHERE end_time IS NOT NULL ORDER BY start_time DESC, id DESC", null).use { c ->
            while (c.moveToNext()) {
                val start = c.getString(1)?.toLongOrNull() ?: 0L
                val end = c.getString(2)?.toLongOrNull()
                list.add(Fast(c.getLong(0), start, end))
            }
        }
        list
    }

    // -------------------------------------------------------------
    // Body Weights
    // -------------------------------------------------------------

    suspend fun getWeights(): List<WeightEntry> = withContext(Dispatchers.IO) {
        val list = mutableListOf<WeightEntry>()
        readableDatabase.rawQuery("SELECT id, weight, date FROM weights ORDER BY date ASC, id ASC", null).use { c ->
            while (c.moveToNext()) {
                list.add(WeightEntry(c.getLong(0), c.getDouble(1), c.getString(2)))
            }
        }
        list
    }

    suspend fun insertWeight(weight: Double, date: String) = withContext(Dispatchers.IO) {
        val cleanDate = if (date.length >= 10) date.substring(0, 10) else date
        val cv = ContentValues().apply {
            put("weight", weight)
            put("date", cleanDate)
        }
        writableDatabase.insert("weights", null, cv)
    }

    suspend fun updateWeight(id: Long, weight: Double, date: String) = withContext(Dispatchers.IO) {
        val cleanDate = if (date.length >= 10) date.substring(0, 10) else date
        val cv = ContentValues().apply {
            put("weight", weight)
            put("date", cleanDate)
        }
        writableDatabase.update("weights", cv, "id = ?", arrayOf(id.toString()))
    }

    suspend fun deleteWeight(id: Long) = withContext(Dispatchers.IO) {
        writableDatabase.delete("weights", "id = ?", arrayOf(id.toString()))
    }

    // -------------------------------------------------------------
    // Vade Mecum
    // -------------------------------------------------------------

    suspend fun getVadeMecum(): String = withContext(Dispatchers.IO) {
        readableDatabase.rawQuery("SELECT content FROM vade_mecum WHERE id = 1", null).use { c ->
            if (c.moveToNext()) c.getString(0) else ""
        }
    }

    suspend fun saveVadeMecum(content: String) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("id", 1)
            put("content", content)
            put("updated_at", getIsoNow())
        }
        writableDatabase.insertWithOnConflict("vade_mecum", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    suspend fun clearVadeMecum() = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("content", "")
            put("updated_at", getIsoNow())
        }
        writableDatabase.update("vade_mecum", cv, "id = 1", null)
    }

    // -------------------------------------------------------------
    // The Study / Newsletter Settings
    // -------------------------------------------------------------

    suspend fun getNewsletterState(): NewsletterState = withContext(Dispatchers.IO) {
        readableDatabase.rawQuery(
            "SELECT id, issue_number, to_self_text, last_issue_date, archive_quote_1, archive_quote_2 FROM newsletter_settings WHERE id = 1",
            null
        ).use { c ->
            if (c.moveToNext()) {
                NewsletterState(
                    id = c.getLong(0),
                    issueNumber = c.getInt(1),
                    toSelfText = c.getString(2) ?: "",
                    lastIssueDate = c.getString(3),
                    archiveQuote1 = c.getString(4),
                    archiveQuote2 = c.getString(5)
                )
            } else {
                NewsletterState()
            }
        }
    }

    suspend fun saveNewsletterSettings(issueNumber: Int? = null, toSelfText: String? = null) = withContext(Dispatchers.IO) {
        val current = getNewsletterState()
        val cv = ContentValues().apply {
            put("issue_number", issueNumber ?: current.issueNumber)
            put("to_self_text", toSelfText ?: current.toSelfText)
        }
        writableDatabase.update("newsletter_settings", cv, "id = 1", null)
    }

    suspend fun saveDailyNewsletterEdition(issueNumber: Int, lastIssueDate: String, quote1: String, quote2: String) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("issue_number", issueNumber)
            put("last_issue_date", lastIssueDate)
            put("archive_quote_1", quote1)
            put("archive_quote_2", quote2)
        }
        writableDatabase.update("newsletter_settings", cv, "id = 1", null)
    }

    // -------------------------------------------------------------
    // Coach Configuration, Steps & Events
    // -------------------------------------------------------------

    suspend fun getCoachConfig(): Map<String, Int> = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, Int>()
        readableDatabase.rawQuery("SELECT key, value FROM coach_config", null).use { c ->
            while (c.moveToNext()) {
                map[c.getString(0)] = c.getInt(1)
            }
        }
        map
    }

    suspend fun saveCoachConfig(config: Map<String, Int>) = withContext(Dispatchers.IO) {
        writableDatabase.beginTransaction()
        try {
            for ((k, v) in config) {
                val cv = ContentValues().apply {
                    put("key", k)
                    put("value", v)
                }
                writableDatabase.insertWithOnConflict("coach_config", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    suspend fun getCoachEvents(): List<CoachEvent> = withContext(Dispatchers.IO) {
        val list = mutableListOf<CoachEvent>()
        readableDatabase.rawQuery("SELECT id, type, created_at, resolved FROM coach_events WHERE resolved = 0 ORDER BY created_at ASC", null).use { c ->
            while (c.moveToNext()) {
                list.add(CoachEvent(c.getLong(0), c.getString(1), c.getString(2), c.getInt(3)))
            }
        }
        list
    }

    suspend fun addCoachEvent(type: String) = withContext(Dispatchers.IO) {
        readableDatabase.rawQuery("SELECT id FROM coach_events WHERE type = ? AND resolved = 0", arrayOf(type)).use { c ->
            if (!c.moveToNext()) {
                val cv = ContentValues().apply {
                    put("type", type)
                    put("created_at", getIsoNow())
                    put("resolved", 0)
                }
                writableDatabase.insert("coach_events", null, cv)
            }
        }
    }

    suspend fun resolveCoachEvent(type: String) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("resolved", 1)
        }
        writableDatabase.update("coach_events", cv, "type = ? AND resolved = 0", arrayOf(type))
    }

    suspend fun getCoachSteps(): List<CoachStep> = withContext(Dispatchers.IO) {
        val list = mutableListOf<CoachStep>()
        readableDatabase.rawQuery("SELECT date, steps FROM coach_steps ORDER BY date ASC", null).use { c ->
            while (c.moveToNext()) {
                list.add(CoachStep(c.getString(0), c.getInt(1)))
            }
        }
        list
    }

    suspend fun updateCoachSteps(date: String, steps: Int) = withContext(Dispatchers.IO) {
        val cv = ContentValues().apply {
            put("date", date)
            put("steps", steps)
        }
        writableDatabase.insertWithOnConflict("coach_steps", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    suspend fun pruneOldSteps() = withContext(Dispatchers.IO) {
        writableDatabase.execSQL("DELETE FROM coach_steps WHERE date < date('now', '-2 years')")
    }

    // -------------------------------------------------------------
    // Raw SQL Console Runner
    // -------------------------------------------------------------

    suspend fun executeRawSql(sql: String): String = withContext(Dispatchers.IO) {
        val trimmed = sql.trim()
        val upper = trimmed.uppercase(Locale.US)
        try {
            if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA") || upper.startsWith("EXPLAIN")) {
                val jsonArray = JSONArray()
                readableDatabase.rawQuery(trimmed, null).use { cursor ->
                    val columnNames = cursor.columnNames
                    while (cursor.moveToNext()) {
                        val rowObj = JSONObject()
                        for (i in columnNames.indices) {
                            val colName = columnNames[i]
                            when (cursor.getType(i)) {
                                Cursor.FIELD_TYPE_NULL -> rowObj.put(colName, JSONObject.NULL)
                                Cursor.FIELD_TYPE_INTEGER -> rowObj.put(colName, cursor.getLong(i))
                                Cursor.FIELD_TYPE_FLOAT -> rowObj.put(colName, cursor.getDouble(i))
                                Cursor.FIELD_TYPE_STRING -> rowObj.put(colName, cursor.getString(i))
                                Cursor.FIELD_TYPE_BLOB -> rowObj.put(colName, "<BLOB>")
                            }
                        }
                        jsonArray.put(rowObj)
                    }
                }
                jsonArray.toString(2)
            } else {
                writableDatabase.execSQL(trimmed)
                "Query executed successfully."
            }
        } catch (e: Exception) {
            "Error: ${e.message}"
        }
    }

    // -------------------------------------------------------------
    // Danger Zone Cleaners
    // -------------------------------------------------------------

    suspend fun deleteAllLifts() = withContext(Dispatchers.IO) {
        writableDatabase.delete("max_lifts", null, null)
    }

    suspend fun deleteAllFasts() = withContext(Dispatchers.IO) {
        writableDatabase.delete("fasts", null, null)
    }

    suspend fun deleteAllWeights() = withContext(Dispatchers.IO) {
        writableDatabase.delete("weights", null, null)
    }

    suspend fun deleteEverything() = withContext(Dispatchers.IO) {
        writableDatabase.beginTransaction()
        try {
            writableDatabase.delete("max_lifts", null, null)
            writableDatabase.delete("fasts", null, null)
            writableDatabase.delete("weights", null, null)
            writableDatabase.delete("coach_steps", null, null)
            writableDatabase.delete("exercises", "is_custom = 1", null)
            writableDatabase.delete("coach_config", null, null)
            seedCoachConfig(writableDatabase)
            writableDatabase.execSQL("UPDATE vade_mecum SET content = '', updated_at = datetime('now') WHERE id = 1")
            writableDatabase.delete("newsletter_settings", null, null)
            writableDatabase.execSQL("INSERT OR IGNORE INTO newsletter_settings (id, issue_number, to_self_text) VALUES (1, 33, '')")
            writableDatabase.delete("coach_events", null, null)
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    // -------------------------------------------------------------
    // Export & Import Backup JSON
    // -------------------------------------------------------------

    suspend fun exportDatabaseDataJson(): String = withContext(Dispatchers.IO) {
        val root = JSONObject()
        root.put("version", 6)
        root.put("exported_at", getIsoNow())

        // Exercises
        val exercisesArr = JSONArray()
        for (e in getExercises()) {
            val obj = JSONObject()
            obj.put("name", e.name)
            obj.put("type", e.type)
            obj.put("is_custom", e.isCustom)
            exercisesArr.put(obj)
        }
        root.put("exercises", exercisesArr)

        // Lifts
        val liftsArr = JSONArray()
        for (l in getAllMaxLifts()) {
            val obj = JSONObject()
            obj.put("exercise", l.exercise)
            obj.put("weight", l.weight)
            obj.put("reps", l.reps)
            liftsArr.put(obj)
        }
        root.put("lifts", liftsArr)

        // Fasts
        val fastsArr = JSONArray()
        for (f in getFastHistory()) {
            val obj = JSONObject()
            obj.put("id", f.id)
            obj.put("start_time", f.startTime)
            obj.put("end_time", f.endTime ?: JSONObject.NULL)
            fastsArr.put(obj)
        }
        root.put("fasts", fastsArr)

        // Weights
        val weightsArr = JSONArray()
        for (w in getWeights()) {
            val obj = JSONObject()
            obj.put("id", w.id)
            obj.put("weight", w.weight)
            obj.put("date", w.date)
            weightsArr.put(obj)
        }
        root.put("weights", weightsArr)

        // Vade Mecum
        root.put("vade_mecum", getVadeMecum())

        // Study
        val study = getNewsletterState()
        val studyObj = JSONObject().apply {
            put("id", study.id)
            put("issue_number", study.issueNumber)
            put("to_self_text", study.toSelfText)
            put("last_issue_date", study.lastIssueDate ?: JSONObject.NULL)
            put("archive_quote_1", study.archiveQuote1 ?: JSONObject.NULL)
            put("archive_quote_2", study.archiveQuote2 ?: JSONObject.NULL)
        }
        root.put("study", studyObj)

        root.toString(2)
    }

    suspend fun importDatabaseDataJson(jsonStr: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val root = JSONObject(jsonStr)
            writableDatabase.beginTransaction()
            try {
                // Exercises
                if (root.has("exercises")) {
                    val exArr = root.getJSONArray("exercises")
                    for (i in 0 until exArr.length()) {
                        val obj = exArr.getJSONObject(i)
                        val name = obj.getString("name")
                        val type = obj.getString("type")
                        val isCustom = obj.optBoolean("is_custom", false)
                        val cv = ContentValues().apply {
                            put("name", name)
                            put("type", type)
                            put("is_custom", if (isCustom) 1 else 0)
                        }
                        writableDatabase.insertWithOnConflict("exercises", null, cv, SQLiteDatabase.CONFLICT_IGNORE)
                    }
                }

                // Lifts
                if (root.has("lifts")) {
                    val liftsArr = root.getJSONArray("lifts")
                    for (i in 0 until liftsArr.length()) {
                        val obj = liftsArr.getJSONObject(i)
                        val ex = obj.getString("exercise")
                        val weight = obj.getDouble("weight")
                        val reps = obj.getInt("reps")

                        var shouldImport = true
                        readableDatabase.rawQuery("SELECT weight, reps FROM max_lifts WHERE exercise = ?", arrayOf(ex)).use { c ->
                            if (c.moveToNext()) {
                                val curWeight = c.getDouble(0)
                                val curReps = c.getInt(1)
                                shouldImport = weight > curWeight || (weight == curWeight && reps > curReps)
                            }
                        }
                        if (shouldImport) {
                            val cv = ContentValues().apply {
                                put("exercise", ex)
                                put("weight", weight)
                                put("reps", reps)
                            }
                            writableDatabase.insertWithOnConflict("max_lifts", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
                        }
                    }
                }

                // Fasts
                if (root.has("fasts")) {
                    val fastsArr = root.getJSONArray("fasts")
                    for (i in 0 until fastsArr.length()) {
                        val obj = fastsArr.getJSONObject(i)
                        val startStr = obj.getString("start_time")
                        val endStr = if (obj.isNull("end_time")) null else obj.getString("end_time")
                        
                        val startMs = parseToEpochMs(startStr)
                        val endMs = endStr?.let { parseToEpochMs(it) }

                        var foundExisting = false
                        readableDatabase.rawQuery("SELECT id, end_time FROM fasts WHERE start_time = ?", arrayOf(startMs.toString())).use { c ->
                            if (c.moveToNext()) {
                                foundExisting = true
                                val existingId = c.getLong(0)
                                val existingEnd = if (c.isNull(1)) null else c.getString(1)
                                if (existingEnd == null && endMs != null) {
                                    val cv = ContentValues().apply { put("end_time", endMs.toString()) }
                                    writableDatabase.update("fasts", cv, "id = ?", arrayOf(existingId.toString()))
                                }
                            }
                        }
                        if (!foundExisting) {
                            val cv = ContentValues().apply {
                                put("start_time", startMs.toString())
                                if (endMs != null) put("end_time", endMs.toString()) else putNull("end_time")
                            }
                            writableDatabase.insert("fasts", null, cv)
                        }
                    }
                }

                // Weights: dedupe by (date, weight)
                if (root.has("weights")) {
                    val weightsArr = root.getJSONArray("weights")
                    for (i in 0 until weightsArr.length()) {
                        val obj = weightsArr.getJSONObject(i)
                        val weight = obj.getDouble("weight")
                        val date = obj.getString("date").take(10)

                        var exists = false
                        readableDatabase.rawQuery(
                            "SELECT id FROM weights WHERE date = ? AND abs(weight - ?) < 0.01",
                            arrayOf(date, weight.toString())
                        ).use { c ->
                            exists = c.moveToNext()
                        }
                        if (!exists && date.isNotEmpty()) {
                            val cv = ContentValues().apply {
                                put("weight", weight)
                                put("date", date)
                            }
                            writableDatabase.insert("weights", null, cv)
                        }
                    }
                }

                // Vade Mecum
                if (root.has("vade_mecum")) {
                    val vm = root.opt("vade_mecum")
                    val content = when (vm) {
                        is String -> vm
                        is JSONObject -> vm.optString("content", "")
                        else -> ""
                    }
                    if (content.isNotEmpty()) {
                        saveVadeMecum(content)
                    }
                }

                // Study
                if (root.has("study") && !root.isNull("study")) {
                    val study = root.getJSONObject("study")
                    val issue = study.optInt("issue_number", 33)
                    val toSelf = study.optString("to_self_text", "")
                    val date = if (study.isNull("last_issue_date")) null else study.optString("last_issue_date")
                    val q1 = if (study.isNull("archive_quote_1")) null else study.optString("archive_quote_1")
                    val q2 = if (study.isNull("archive_quote_2")) null else study.optString("archive_quote_2")

                    val cv = ContentValues().apply {
                        put("issue_number", issue)
                        put("to_self_text", toSelf)
                        if (date != null) put("last_issue_date", date) else putNull("last_issue_date")
                        if (q1 != null) put("archive_quote_1", q1) else putNull("archive_quote_1")
                        if (q2 != null) put("archive_quote_2", q2) else putNull("archive_quote_2")
                    }
                    writableDatabase.update("newsletter_settings", cv, "id = 1", null)
                }

                writableDatabase.setTransactionSuccessful()
                true
            } finally {
                writableDatabase.endTransaction()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
