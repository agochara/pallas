package com.example.pallas.util

import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Shared thread-safe DateTimeFormatter instances across the app.
 */
object DateFormats {
    val ISO_LOCAL_DATE: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    val ISO_LOCAL_DATE_TIME: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME
    val DISPLAY_DATE_TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
    val DISPLAY_DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
    val SHORT_DATE: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)
    val MONTH_YEAR: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US)
    val SHORT_MONTH: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM", Locale.US)
    val FULL_MONTH: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM", Locale.US)
    val TIME_12H: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    val TIME_24H: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.US)
}
