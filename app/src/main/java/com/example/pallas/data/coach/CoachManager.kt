package com.example.pallas.data.coach

import android.content.Context
import com.example.pallas.data.content.ContentData
import com.example.pallas.data.db.CoachStep
import com.example.pallas.data.db.Fast
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.askesis.AskesisCache
import com.example.pallas.util.DateFormats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

data class BmiPayload(
    val bmi: Double,
    val weight: Double,
    val height: Double,
    val category: String
)

data class SearchPayload(
    val matches: List<String>,
    val query: String
)

data class CommandResult(
    val text: String,
    val ui: String? = null, // "bmi" | "search"
    val bmiPayload: BmiPayload? = null,
    val searchPayload: SearchPayload? = null
)

object CoachManager {

    suspend fun executeCoachCommand(context: Context? = null, input: String): CommandResult {
        return try {
            val trimmed = input.trim()
            if (!trimmed.startsWith("/")) {
                return CommandResult("Unknown command. Type /help for available commands.")
            }

            val spaceIndex = trimmed.indexOf(' ')
            val command = if (spaceIndex == -1) trimmed.lowercase(Locale.US) else trimmed.substring(0, spaceIndex).lowercase(Locale.US)
            val args = if (spaceIndex == -1) "" else trimmed.substring(spaceIndex + 1).trim()

            when (command) {
                "/help" -> CommandResult(
                    listOf(
                        "Available Coach commands:",
                        "• /1rm <weight>x<reps> — Calculate estimated 1RM (e.g. /1rm 70x5)",
                        "• /bmi <weight> <height> — Calculate BMI (weight in kg, height in cm)",
                        "• /convert <val> <kg|lbs> — Convert between kg and lbs (e.g. /convert 70kg, /convert 150lbs)",
                        "• /search <pattern> — Search quote collection (substring or regex)",
                        "• /hc — Request Health Connect permissions",
                        "• /steps — View today's steps directly from Health Connect",
                        "• /synchc — Manually trigger background sync of steps and fasting rules",
                        "• /help — Show this help menu"
                    ).joinToString("\n")
                )

                "/1rm" -> {
                    if (args.isEmpty()) return CommandResult("Usage: /1rm <weight>x<reps> (e.g. /1rm 70x5 or /1rm 80 5)")
                    val regex = Regex("^([0-9.]+)\\s*(?:[xX*]|\\s+)\\s*([0-9]+)$")
                    val match = regex.find(args) ?: return CommandResult("Usage: /1rm <weight>x<reps> (e.g. /1rm 70x5)")
                    val weight = match.groupValues[1].toDoubleOrNull() ?: return CommandResult("Invalid weight.")
                    val reps = match.groupValues[2].toIntOrNull() ?: return CommandResult("Invalid reps.")
                    if (weight <= 0 || reps <= 0) return CommandResult("Please enter valid positive numbers for weight and reps.")

                    val oneRm = if (reps == 1) weight else weight * (1.0 + reps / 30.0)
                    val formatted = String.format(Locale.US, "%.1f", oneRm)
                    CommandResult("Estimated 1RM for $weight kg × $reps reps is $formatted kg.")
                }

                "/bmi" -> {
                    if (args.isEmpty()) return CommandResult("Usage: /bmi <weight in kg> <height in cm> (e.g. /bmi 75 180)")
                    val parts = args.replace(Regex("kg|cm|,", RegexOption.IGNORE_CASE), " ").trim().split(Regex("\\s+"))
                    if (parts.size < 2) return CommandResult("Usage: /bmi <weight in kg> <height in cm> (e.g. /bmi 75 180)")
                    val weight = parts[0].toDoubleOrNull()
                    val height = parts[1].toDoubleOrNull()
                    if (weight == null || height == null || weight <= 0 || height <= 0) {
                        return CommandResult("Please provide valid positive numbers for weight (kg) and height (cm).")
                    }

                    val heightInMeters = height / 100.0
                    val bmi = weight / (heightInMeters * heightInMeters)
                    val category = when {
                        bmi < 18.5 -> "Underweight"
                        bmi < 25.0 -> "Normal weight"
                        bmi < 30.0 -> "Overweight"
                        else -> "Obese"
                    }

                    val formattedBmi = String.format(Locale.US, "%.1f", bmi)
                    CommandResult(
                        text = "BMI: $formattedBmi ($category) [Weight: $weight kg, Height: $height cm]",
                        ui = "bmi",
                        bmiPayload = BmiPayload(bmi, weight, height, category)
                    )
                }

                "/convert" -> {
                    if (args.isEmpty()) return CommandResult("Usage: /convert <val> <kg|lbs> (e.g. /convert 70kg, /convert 150 lbs)")
                    val clean = args.replace(Regex("\\bto\\b", RegexOption.IGNORE_CASE), "").trim()
                    val match = Regex("^([0-9.]+)\\s*([a-zA-Z]+)?(?:\\s+([a-zA-Z]+))?$").find(clean)
                        ?: return CommandResult("Usage: /convert <val> <kg|lbs> (e.g. /convert 70kg or /convert 150 lbs)")

                    val valNum = match.groupValues[1].toDoubleOrNull() ?: return CommandResult("Please enter a valid positive number.")
                    val unit = (match.groupValues[2].ifEmpty { match.groupValues[3] }).lowercase(Locale.US)

                    val kgToLbsFactor = 2.20462262
                    if (unit.startsWith("lb") || unit == "pounds" || unit == "pound") {
                        val kg = valNum / kgToLbsFactor
                        CommandResult(String.format(Locale.US, "%.1f lbs = %.2f kg", valNum, kg))
                    } else if (unit.startsWith("kg") || unit == "kilo" || unit == "kilogram" || unit == "kilograms") {
                        val lbs = valNum * kgToLbsFactor
                        CommandResult(String.format(Locale.US, "%.1f kg = %.2f lbs", valNum, lbs))
                    } else {
                        val lbs = valNum * kgToLbsFactor
                        val kg = valNum / kgToLbsFactor
                        CommandResult(String.format(Locale.US, "%.1f kg = %.2f lbs | %.1f lbs = %.2f kg", valNum, lbs, valNum, kg))
                    }
                }

                "/search" -> {
                    val matches = try {
                        val slashMatch = Regex("^/(.+)/([gimsuy]*)$").find(args)
                        val pattern = if (slashMatch != null) {
                            val expr = slashMatch.groupValues[1]
                            val flags = slashMatch.groupValues[2]
                            if (flags.contains("i")) Regex(expr, RegexOption.IGNORE_CASE) else Regex(expr)
                        } else {
                            Regex(Regex.escape(args), RegexOption.IGNORE_CASE)
                        }
                        ContentData.myQuotes.filter { pattern.containsMatchIn(it) }
                    } catch (e: Exception) {
                        ContentData.myQuotes.filter { it.contains(args, ignoreCase = true) }
                    }

                    if (matches.isEmpty()) {
                        CommandResult("No quotes found matching \"$args\".")
                    } else {
                        val plural = if (matches.size == 1) "match" else "matches"
                        CommandResult(
                            text = "Found ${matches.size} $plural for \"$args\".",
                            ui = "search",
                            searchPayload = SearchPayload(matches, args)
                        )
                    }
                }

                "/hc" -> {
                    if (context == null) return CommandResult("Context unavailable.")
                    val hc = HealthConnectManager(context)
                    if (!hc.isAvailable) {
                        CommandResult("Health Connect is not available or not installed on this device.")
                    } else if (hc.hasPermissions()) {
                        CommandResult("Health Connect read permissions are already granted.")
                    } else {
                        CommandResult("Health Connect is installed. Permissions can be granted in Health Connect settings or via the Steps tab.")
                    }
                }

                "/steps" -> {
                    if (context == null) return CommandResult("Context unavailable.")
                    val hc = HealthConnectManager(context)
                    if (!hc.isAvailable) {
                        CommandResult("Health Connect is not available on this device.")
                    } else if (!hc.hasPermissions()) {
                        CommandResult("Steps read permission is not granted. Please grant permissions in Health Connect.")
                    } else {
                        val steps = hc.getTodaySteps()
                        if (steps == null) {
                            CommandResult("Error reading from Health Connect. Please check permissions or try again later.")
                        } else {
                            CommandResult("You have taken $steps steps today (live from Health Connect).")
                        }
                    }
                }

                "/synchc" -> {
                    if (context == null) return CommandResult("Context unavailable.")
                    val success = syncStepsFullYear(context)
                    if (success) {
                        CommandResult("Health Connect full 365-day repair sync complete.")
                    } else {
                        CommandResult("Manual sync failed. Health Connect permissions required.")
                    }
                }

                else -> CommandResult("Unknown command \"$command\". Type /help for available commands.")
            }
        } catch (e: Exception) {
            CommandResult("Command execution error: ${e.message ?: "Unknown error"}")
        }
    }

    /**
     * Incremental steps sync on app open / foreground.
     * Remembers the date of the last successful sync and reads from that day to today.
     * Debounced to run at most once every ~10 minutes.
     * Missing days from Health Connect remain unknown (never recorded as 0).
     */
    suspend fun syncStepsIncremental(context: Context, force: Boolean = false): Boolean {
        val prefs = context.getSharedPreferences("pallas_sync", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val lastSyncTs = prefs.getLong("last_foreground_sync_ts", 0L)
        if (!force && (now - lastSyncTs < 10 * 60 * 1000L)) {
            return true
        }

        val hc = HealthConnectManager(context)
        if (!hc.isAvailable || !hc.hasPermissions()) {
            return false
        }

        val db = PallasDatabase.getInstance(context)
        val today = LocalDate.now()
        val lastSyncDateStr = prefs.getString("last_synced_date", null)
        val startDate = if (lastSyncDateStr != null) {
            try {
                LocalDate.parse(lastSyncDateStr)
            } catch (_: Exception) {
                today.minusDays(7)
            }
        } else {
            today.minusDays(7)
        }

        return try {
            val stepMap = hc.getDailyStepsForRange(startDate, today)
            withContext(Dispatchers.IO) {
                for ((d, count) in stepMap) {
                    db.updateCoachSteps(d.format(DateFormats.ISO_LOCAL_DATE), count.toInt())
                }
            }
            prefs.edit()
                .putString("last_synced_date", today.toString())
                .putLong("last_foreground_sync_ts", now)
                .apply()

            AskesisCache.steps = db.getCoachSteps()
            evaluateAndPublishRules(context)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Manual full-year repair sync triggered by the Sync button or /synchc.
     */
    suspend fun syncStepsFullYear(context: Context): Boolean {
        val hc = HealthConnectManager(context)
        if (!hc.isAvailable || !hc.hasPermissions()) {
            return false
        }

        val db = PallasDatabase.getInstance(context)
        val today = LocalDate.now()
        val startDate = today.minusDays(365)

        return try {
            val stepMap = hc.getDailyStepsForRange(startDate, today)
            withContext(Dispatchers.IO) {
                for ((d, count) in stepMap) {
                    db.updateCoachSteps(d.format(DateFormats.ISO_LOCAL_DATE), count.toInt())
                }
            }
            val now = System.currentTimeMillis()
            context.getSharedPreferences("pallas_sync", Context.MODE_PRIVATE).edit()
                .putString("last_synced_date", today.toString())
                .putLong("last_foreground_sync_ts", now)
                .apply()

            AskesisCache.steps = db.getCoachSteps()
            evaluateAndPublishRules(context)
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    /**
     * Stateless event-driven evaluation.
     * Evaluates rules without storing stale events in a database table.
     */
    suspend fun evaluateAndPublishRules(context: Context): CoachEvaluation {
        val db = PallasDatabase.getInstance(context)
        val eval = evaluateRulesFromDb(db)
        AskesisCache.coachEvaluation = eval
        AskesisCache.hasCoachEvents = eval.hasIssues
        return eval
    }

    suspend fun evaluateRulesFromDb(db: PallasDatabase): CoachEvaluation {
        return try {
            val config = db.getCoachConfig()
            val activeFast = db.getActiveFast()
            val pastFasts = db.getFastHistory()
            val allSteps = db.getCoachSteps()
            val today = LocalDate.now()

            val missedFast = evaluateFastingRule(config, activeFast, pastFasts, today)
            val insufficientSteps = evaluateStepsRule(config, allSteps, today)

            CoachEvaluation(
                insufficientSteps = insufficientSteps,
                missedFast = missedFast
            )
        } catch (e: Exception) {
            e.printStackTrace()
            CoachEvaluation()
        }
    }

    private fun evaluateFastingRule(
        config: Map<String, Int>,
        activeFast: Fast?,
        pastFasts: List<Fast>,
        today: LocalDate
    ): Boolean {
        val fastingDays = config["fasting_days"] ?: 3
        if (activeFast != null) {
            return false // Currently fasting
        }
        if (pastFasts.isEmpty()) {
            return true // No past fasts recorded
        }
        val sorted = pastFasts.sortedByDescending { it.endTime ?: it.startTime }
        val lastEnd = sorted.firstOrNull()?.let { it.endTime ?: it.startTime } ?: return true
        val lastDate = Instant.ofEpochMilli(lastEnd).atZone(ZoneId.systemDefault()).toLocalDate()
        val diffDays = java.time.temporal.ChronoUnit.DAYS.between(lastDate, today).toInt().coerceAtLeast(0)
        return diffDays >= fastingDays
    }

    private fun evaluateStepsRule(
        config: Map<String, Int>,
        allSteps: List<CoachStep>,
        today: LocalDate
    ): Boolean {
        val stepThreshold = config["steps_threshold"] ?: 7000
        val stepDays = config["steps_days"] ?: 3
        val stepMap = allSteps.associate { it.date to it.steps }

        val formatter = DateFormats.ISO_LOCAL_DATE
        val todaySteps = stepMap[today.format(formatter)]
        if (todaySteps != null && todaySteps >= stepThreshold) {
            return false // Already met goal today
        }

        // Check past N completed days (1..stepDays)
        // If steps are unknown for any day, do NOT say "gotta walk"
        for (i in 1..stepDays) {
            val dateStr = today.minusDays(i.toLong()).format(formatter)
            val steps = stepMap[dateStr] ?: return false // Unknown day -> do not assume below goal
            if (steps >= stepThreshold) {
                return false // Goal was met on this day, streak is not broken
            }
        }

        return true
    }
}
