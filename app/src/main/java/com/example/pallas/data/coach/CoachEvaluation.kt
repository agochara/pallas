package com.example.pallas.data.coach

/**
 * Live, event-driven Coach evaluation result.
 * Computed dynamically without persisting stale events in a database.
 */
data class CoachEvaluation(
    val insufficientSteps: Boolean = false,
    val missedFast: Boolean = false
) {
    val hasIssues: Boolean get() = insufficientSteps || missedFast
}
