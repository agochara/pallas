package com.example.pallas.ui.askesis

import com.example.pallas.data.db.CoachEvent
import com.example.pallas.data.db.CoachStep
import com.example.pallas.data.db.ExerciseItem
import com.example.pallas.data.db.Fast
import com.example.pallas.data.db.LiftRecord
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.data.db.WeightEntry

/**
 * In-memory state cache for Askesis to ensure immediate first-frame rendering
 * and prevent data pop-in or layout jumping during peer tab transitions.
 */
object AskesisCache {
    @Volatile var steps: List<CoachStep> = emptyList()
    @Volatile var stepGoal: Int? = null
    @Volatile var weights: List<WeightEntry> = emptyList()
    @Volatile var fasts: List<Fast> = emptyList()
    @Volatile var activeFast: Fast? = null
    @Volatile var fastsLoaded: Boolean = false
    @Volatile var exercises: List<ExerciseItem> = emptyList()
    @Volatile var lifts: Map<String, LiftRecord> = emptyMap()
    @Volatile var coachEvaluation: com.example.pallas.data.coach.CoachEvaluation = com.example.pallas.data.coach.CoachEvaluation()
    @Volatile var hasCoachEvents: Boolean = false

    suspend fun warm(db: PallasDatabase) {
        try {
            steps = db.getCoachSteps()
            db.getCoachConfig()["steps_threshold"]?.let { stepGoal = it }
            weights = db.getWeights()
            activeFast = db.getActiveFast()
            fasts = db.getFastHistory()
            fastsLoaded = true
            exercises = db.getExercises()
            lifts = db.getAllMaxLifts().associateBy { it.exercise }
            val eval = com.example.pallas.data.coach.CoachManager.evaluateRulesFromDb(db)
            coachEvaluation = eval
            hasCoachEvents = eval.hasIssues
        } catch (_: Exception) {
            // Keep existing or default state if warming encounters an issue
        }
    }
}
