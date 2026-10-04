package com.example.pallas.ui.askesis

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.EditCalendar
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.data.db.Fast
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.components.ExpressiveChartUtils.drawXAxisLabels
import com.example.pallas.ui.components.ExpressiveChartUtils.drawYAxis
import com.example.pallas.ui.components.MorphPolygonShape
import com.example.pallas.ui.components.MorphingBadge
import com.example.pallas.ui.components.PallasExpressiveShapes
import com.example.pallas.ui.components.bounceClick
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

import com.example.pallas.util.DateFormats

fun parseToEpochMs(isoString: String): Long {
    return try {
        Instant.parse(isoString).toEpochMilli()
    } catch (e: Exception) {
        try {
            val clean = isoString.trim()
            if (!clean.endsWith("Z") && !clean.contains("+") && clean.indexOf("-", startIndex = 10) == -1) {
                LocalDateTime.parse(clean.take(19)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            } else {
                Instant.parse(clean).toEpochMilli()
            }
        } catch (e2: Exception) {
            try {
                LocalDate.parse(isoString.take(10)).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            } catch (e3: Exception) {
                System.currentTimeMillis()
            }
        }
    }
}

fun formatIso(epochMs: Long): String {
    return Instant.ofEpochMilli(epochMs).toString()
}

fun formatDisplayDateTime(ms: Long): String {
    return try {
        val ldt = LocalDateTime.ofInstant(Instant.ofEpochMilli(ms), ZoneId.systemDefault())
        ldt.format(DateFormats.DISPLAY_DATE_TIME)
    } catch (e: Exception) {
        "Unknown"
    }
}

fun formatHM(ms: Long): String {
    val totalMinutes = (ms / 60000).coerceAtLeast(0)
    val h = totalMinutes / 60
    val m = totalMinutes % 60
    return "${h}h ${m}m"
}

fun formatTime12h(hour: Int, minute: Int): String {
    val amPm = if (hour < 12) "AM" else "PM"
    val h = if (hour == 0) 12 else if (hour > 12) hour - 12 else hour
    return String.format(Locale.US, "%d:%02d %s", h, minute, amPm)
}

data class DayFastingSummary(
    val date: LocalDate,
    val label: String,
    val durationHours: Double
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FastingTab() {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()
    val textMeasurer = rememberTextMeasurer(cacheSize = 64)

    var activeFast by remember { mutableStateOf<Fast?>(AskesisCache.activeFast) }
    var allFasts by remember { mutableStateOf<List<Fast>>(AskesisCache.fasts) }
    var weekOffset by remember { mutableIntStateOf(0) }
    var isInitialLoading by remember { mutableStateOf(!AskesisCache.fastsLoaded) }

    var editingFast by remember { mutableStateOf<Fast?>(null) }
    var showManualDialog by remember { mutableStateOf(false) }

    fun loadFasts() {
        scope.launch {
            val af = db.getActiveFast()
            val h = db.getFastHistory()
            activeFast = af
            allFasts = h
            AskesisCache.activeFast = af
            AskesisCache.fasts = h
            AskesisCache.fastsLoaded = true
            isInitialLoading = false
        }
    }

    LaunchedEffect(Unit) {
        loadFasts()
    }

    // Filter Fasting History to ONLY display past 7 days (reactively computed)
    val recent7DaysHistory = remember(allFasts) {
        val sevenDaysAgoEpoch = System.currentTimeMillis() - 7 * 24 * 3600000L
        allFasts.filter {
            val startMs = it.startTime
            startMs >= sevenDaysAgoEpoch
        }.sortedByDescending { it.startTime }
    }

    // Weekly Chart Days Calculation
    val weekDays = remember(weekOffset) {
        val today = LocalDate.now()
        val currentWeekEnd = today.plusWeeks(weekOffset.toLong())
        val startOfWeek = currentWeekEnd.minusDays(6)
        (0..6).map { startOfWeek.plusDays(it.toLong()) }
    }

    val weekStartStr = remember(weekDays) { weekDays.first().format(DateFormats.SHORT_DATE) }
    val weekEndStr = remember(weekDays) { weekDays.last().format(DateFormats.SHORT_DATE) }

    val combinedFasts = remember(allFasts, activeFast) {
        if (activeFast != null) allFasts + activeFast!! else allFasts
    }

    // Map fasts to individual days of the displayed week
    val dailySummaries = remember(combinedFasts, weekDays) {
        weekDays.map { day ->
            val dayStartEpoch = day.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            val dayEndEpoch = day.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

            var totalMs = 0L
            combinedFasts.forEach { fast ->
                val fStart = fast.startTime
                val fEnd = fast.endTime ?: System.currentTimeMillis()
                val overlapStart = maxOf(dayStartEpoch, fStart)
                val overlapEnd = minOf(dayEndEpoch, fEnd)
                if (overlapEnd > overlapStart) {
                    totalMs += (overlapEnd - overlapStart)
                }
            }
            val hours = totalMs / 3600000.0
            DayFastingSummary(
                date = day,
                label = "${day.monthValue}/${day.dayOfMonth}",
                durationHours = hours
            )
        }
    }

    val weeklyAvgMs = remember(dailySummaries) {
        val totalHours = dailySummaries.sumOf { it.durationHours }
        (totalHours / 7.0 * 3600000.0).toLong()
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(
            text = "Fasting",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(16.dp))

        // =========================================================================
        // HERO ACTION AREA
        // =========================================================================
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp, horizontal = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (isInitialLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(36.dp),
                            strokeWidth = 3.dp
                        )
                    }
                } else if (activeFast != null) {
                    // Isolated live timer badge so ONLY this composable recomposes every second
                    FastingLiveBadge(
                        startTimeMs = activeFast!!.startTime
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // Secondary color used for End Fast (not error)
                    Button(
                        onClick = {
                            scope.launch {
                                db.endFast(activeFast!!.id)
                                loadFasts()
                                com.example.pallas.data.coach.CoachManager.evaluateAndPublishRules(context)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondary,
                            contentColor = MaterialTheme.colorScheme.onSecondary
                        ),
                        shape = CircleShape,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .bounceClick()
                    ) {
                        Text("End Fast", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }
                } else {
                    // Revamped inactive state with rich M3 Expressive tonal badge & icon
                    Surface(
                        shape = MorphPolygonShape(PallasExpressiveShapes.FastingMorph, 0.45f),
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        modifier = Modifier.size(110.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Outlined.Timer,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Ready to Fast?",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Spacer(modifier = Modifier.height(22.dp))

                    // Expressive Primary Pill Button: "Start Fast"
                    Button(
                        onClick = {
                            scope.launch {
                                db.startFast()
                                loadFasts()
                                com.example.pallas.data.coach.CoachManager.evaluateAndPublishRules(context)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary
                        ),
                        shape = CircleShape,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .bounceClick()
                    ) {
                        Icon(Icons.Outlined.PlayArrow, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Start Fast", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Expressive Soft Tertiary Tonal Button: "Enter fast manually"
                    FilledTonalButton(
                        onClick = { showManualDialog = true },
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                            contentColor = MaterialTheme.colorScheme.onTertiaryContainer
                        ),
                        shape = CircleShape,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .bounceClick()
                    ) {
                        Icon(Icons.Outlined.EditCalendar, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Enter fast manually", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                    }
                }
            }

        Spacer(modifier = Modifier.height(18.dp))

        // =========================================================================
        // WEEKLY CHART AREA
        // =========================================================================
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 12.dp)
        ) {
                // Header: Daily Average on left, Date range with chevrons on right
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Daily Average",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = formatHM(weeklyAvgMs),
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }

                    // Chevrons and Date Range
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = { weekOffset -= 1 },
                            modifier = Modifier.size(34.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                contentDescription = "Previous Week",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Text(
                            text = "$weekStartStr – $weekEndStr",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 4.dp)
                        )

                        IconButton(
                            onClick = { if (weekOffset < 0) weekOffset += 1 },
                            enabled = weekOffset < 0,
                            modifier = Modifier.size(34.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "Next Week",
                                tint = if (weekOffset < 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.25f)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Fasting Weekly Vertical Bar Chart Canvas
                val primaryBarColor = MaterialTheme.colorScheme.secondary
                val trackLineColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)
                val labelColor = MaterialTheme.colorScheme.onSurfaceVariant
                val onSurfaceColor = MaterialTheme.colorScheme.onSurface
                val labelStyle = MaterialTheme.typography.labelSmall

                AnimatedContent(
                    targetState = dailySummaries,
                    transitionSpec = {
                        (fadeIn(animationSpec = tween(300)) + scaleIn(initialScale = 0.96f, animationSpec = tween(300)))
                            .togetherWith(fadeOut(animationSpec = tween(150)))
                    },
                    label = "FastingChartTransition"
                ) { summaries ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(230.dp)
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val chartLeft = 40.dp.toPx()
                            val chartRight = size.width - 10.dp.toPx()
                            val chartTop = 22.dp.toPx() // room for duration labels on top
                            val chartBottom = size.height - 24.dp.toPx() // room for date labels
                            val chartW = chartRight - chartLeft
                            val chartH = chartBottom - chartTop

                            // 1. Draw Y-Axis (0h, 8h, 16h, 24h)
                            val yTicks = listOf(Pair("0h", 0f), Pair("8h", 8f), Pair("16h", 16f), Pair("24h", 24f))
                            yTicks.forEach { (label, hours) ->
                                val y = chartBottom - (hours / 24f * chartH)
                                val layout = textMeasurer.measure(label, style = labelStyle)
                                drawText(
                                    textLayoutResult = layout,
                                    topLeft = Offset(chartLeft - layout.size.width - 6.dp.toPx(), y - layout.size.height / 2f),
                                    color = labelColor
                                )
                            }

                            // 2. Draw 7 day columns matching Image 2
                            val colCount = summaries.size
                            val slotW = chartW / colCount
                            val barW = 18.dp.toPx()

                            summaries.forEachIndexed { i, summary ->
                                val centerX = chartLeft + (i * slotW) + (slotW / 2f)

                                // Thin vertical track line from top to bottom
                                drawLine(
                                    color = trackLineColor,
                                    start = Offset(centerX, chartTop),
                                    end = Offset(centerX, chartBottom),
                                    strokeWidth = 1.5f
                                )

                                // Duration label at top of column (e.g. "4h", "45m", "0h")
                                val topDurationText = when {
                                    summary.durationHours >= 1.0 -> "${summary.durationHours.toInt()}h"
                                    summary.durationHours > 0.05 -> "${(summary.durationHours * 60).toInt()}m"
                                    else -> "0h"
                                }
                                val topLayout = textMeasurer.measure(
                                    text = topDurationText,
                                    style = labelStyle.copy(fontWeight = FontWeight.Bold)
                                )
                                drawText(
                                    textLayoutResult = topLayout,
                                    topLeft = Offset(centerX - topLayout.size.width / 2f, chartTop - topLayout.size.height - 4.dp.toPx()),
                                    color = onSurfaceColor
                                )

                                // Green filled capsule bar for fasting duration
                                if (summary.durationHours > 0.1) {
                                    val barH = ((summary.durationHours / 24.0).coerceIn(0.0, 1.0).toFloat() * chartH).coerceAtLeast(8f)
                                    val barTop = chartBottom - barH
                                    drawRoundRect(
                                        color = primaryBarColor,
                                        topLeft = Offset(centerX - barW / 2f, barTop),
                                        size = Size(barW, barH),
                                        cornerRadius = CornerRadius(barW / 2f, barW / 2f)
                                    )
                                }

                                // Date label at bottom of column (e.g. "8/31", "9/1")
                                val dateLayout = textMeasurer.measure(
                                    text = summary.label,
                                    style = labelStyle.copy(fontWeight = FontWeight.Medium)
                                )
                                drawText(
                                    textLayoutResult = dateLayout,
                                    topLeft = Offset(centerX - dateLayout.size.width / 2f, chartBottom + 6.dp.toPx()),
                                    color = labelColor
                                )
                            }
                        }
                    }
                }
            }

        Spacer(modifier = Modifier.height(24.dp))

        // =========================================================================
        // CARD 3: FASTING HISTORY (PAST 7 DAYS ONLY)
        // =========================================================================
        Text(
            text = "FASTING HISTORY (PAST 7 DAYS)",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.2.sp,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (recent7DaysHistory.isEmpty()) {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerLow
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(modifier = Modifier.padding(20.dp), contentAlignment = Alignment.Center) {
                    Text(
                        text = "No fasts recorded in the past 7 days.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                recent7DaysHistory.forEach { fast ->
                    val startMs = fast.startTime
                    val endMs = fast.endTime ?: System.currentTimeMillis()
                    val durationMs = (endMs - startMs).coerceAtLeast(0)

                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .bounceClick(scaleDown = 0.97f) { editingFast = fast }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = formatHM(durationMs),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Text(
                                    text = "${formatDisplayDateTime(fast.startTime)} → ${if (fast.endTime != null) formatDisplayDateTime(fast.endTime) else "Active"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }

                            Surface(
                                shape = CircleShape,
                                color = MaterialTheme.colorScheme.surfaceContainerHighest,
                                modifier = Modifier.size(36.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Outlined.Edit,
                                        contentDescription = "Edit Fast",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }

    // Manual Fast Entry Dialog with Proper M3 Date & Time Picker
    if (showManualDialog) {
        M3ManualFastDialog(
            onDismiss = { showManualDialog = false },
            onSave = { startMs, endMs ->
                scope.launch {
                    db.insertManualFast(startMs, endMs)
                    loadFasts()
                    com.example.pallas.data.coach.CoachManager.evaluateAndPublishRules(context)
                    showManualDialog = false
                }
            }
        )
    }

    // Edit Fast Dialog with dedicated delete control
    editingFast?.let { fast ->
        EditFastDialogWithDedicatedDelete(
            fast = fast,
            onDismiss = { editingFast = null },
            onSave = { updatedStart, updatedEnd ->
                scope.launch {
                    db.updateFast(fast.id, updatedStart, updatedEnd)
                    loadFasts()
                    com.example.pallas.data.coach.CoachManager.evaluateAndPublishRules(context)
                    editingFast = null
                }
            },
            onDelete = {
                scope.launch {
                    db.deleteFast(fast.id)
                    loadFasts()
                    com.example.pallas.data.coach.CoachManager.evaluateAndPublishRules(context)
                    editingFast = null
                }
            }
        )
    }
}

/**
 * Isolated live timer badge so ONLY this composable recomposes every second,
 * preventing unnecessary recomposition of the outer FastingTab.
 */
@Composable
fun FastingLiveBadge(startTimeMs: Long) {
    var currentEpochMs by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(startTimeMs) {
        while (true) {
            delay(1000)
            currentEpochMs = System.currentTimeMillis()
        }
    }

    val elapsed = (currentEpochMs - startTimeMs).coerceAtLeast(0)
    val totalSeconds = (elapsed / 1000).coerceAtLeast(0)
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    val formattedHMS = String.format(Locale.US, "%02d:%02d:%02d", h, m, s)

    MorphingBadge(
        size = 190.dp,
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        isPulsing = true
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = "ACTIVE FAST",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                letterSpacing = 1.2.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = formattedHMS,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}

/**
 * Material 3 Expressive Manual Fast Dialog using DatePicker and TimePicker
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun M3ManualFastDialog(
    onDismiss: () -> Unit,
    onSave: (Long, Long) -> Unit
) {
    val now = LocalDateTime.now()
    var startDate by remember { mutableStateOf(now.minusHours(16).toLocalDate()) }
    var startHour by remember { mutableIntStateOf(now.minusHours(16).hour) }
    var startMinute by remember { mutableIntStateOf(0) }

    var endDate by remember { mutableStateOf(now.toLocalDate()) }
    var endHour by remember { mutableIntStateOf(now.hour) }
    var endMinute by remember { mutableIntStateOf(now.minute) }

    var showDatePickerFor by remember { mutableStateOf<String?>(null) }
    var pickingTimeFor by remember { mutableStateOf<String?>(null) } // "start" or "end"

    val startDatePickerState = rememberDatePickerState(
        initialSelectedDateMillis = startDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    )
    val endDatePickerState = rememberDatePickerState(
        initialSelectedDateMillis = endDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log Fast Manually", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                // Start Date & Time
                Text("Start", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedCard(
                        onClick = { showDatePickerFor = "start" },
                        modifier = Modifier.weight(1.3f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Date", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(startDate.format(DateFormats.DISPLAY_DATE), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    OutlinedCard(
                        onClick = { pickingTimeFor = "start" },
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Time", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(formatTime12h(startHour, startMinute), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }

                // End Date & Time
                Text("End", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedCard(
                        onClick = { showDatePickerFor = "end" },
                        modifier = Modifier.weight(1.3f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Date", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(endDate.format(DateFormats.DISPLAY_DATE), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    OutlinedCard(
                        onClick = { pickingTimeFor = "end" },
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Time", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(formatTime12h(endHour, endMinute), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val startLdt = LocalDateTime.of(startDate, LocalTime.of(startHour, startMinute))
                    val rawEndLdt = LocalDateTime.of(endDate, LocalTime.of(endHour, endMinute))
                    // Support overnight fast: infer next day if end time is before or equal to start time on same date
                    val resolvedEndLdt = if (!rawEndLdt.isAfter(startLdt)) {
                        rawEndLdt.plusDays(1)
                    } else rawEndLdt

                    val startMs = startLdt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    val endMs = resolvedEndLdt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    onSave(startMs, endMs)
                }
            ) {
                Text("Save Fast")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )

    // Material 3 DatePickerDialog for Manual Fast
    showDatePickerFor?.let { target ->
        val state = if (target == "start") startDatePickerState else endDatePickerState
        DatePickerDialog(
            onDismissRequest = { showDatePickerFor = null },
            confirmButton = {
                TextButton(
                    onClick = {
                        state.selectedDateMillis?.let { ms ->
                            val parsed = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
                            if (target == "start") startDate = parsed else endDate = parsed
                        }
                        showDatePickerFor = null
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePickerFor = null }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = state)
        }
    }

    // Material 3 TimePickerDialog for Manual Fast (properly keyed on target)
    pickingTimeFor?.let { timeTarget ->
        val timePickerState = rememberTimePickerState(
            initialHour = if (timeTarget == "start") startHour else endHour,
            initialMinute = if (timeTarget == "start") startMinute else endMinute,
            is24Hour = false
        )
        AlertDialog(
            onDismissRequest = { pickingTimeFor = null },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (timeTarget == "start") {
                            startHour = timePickerState.hour
                            startMinute = timePickerState.minute
                        } else {
                            endHour = timePickerState.hour
                            endMinute = timePickerState.minute
                        }
                        pickingTimeFor = null
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { pickingTimeFor = null }) {
                    Text("Cancel")
                }
            },
            text = {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    TimePicker(state = timePickerState)
                }
            }
        )
    }
}

/**
 * Edit Fast Dialog with dedicated, clearly labeled Delete Button and M3 Date & Time Pickers
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditFastDialogWithDedicatedDelete(
    fast: Fast,
    onDismiss: () -> Unit,
    onSave: (Long, Long?) -> Unit,
    onDelete: () -> Unit
) {
    val initialStartEpoch = fast.startTime
    val initialStartLdt = LocalDateTime.ofInstant(Instant.ofEpochMilli(initialStartEpoch), ZoneId.systemDefault())
    var startDate by remember { mutableStateOf(initialStartLdt.toLocalDate()) }
    var startHour by remember { mutableIntStateOf(initialStartLdt.hour) }
    var startMinute by remember { mutableIntStateOf(initialStartLdt.minute) }
    val initialEndEpoch = fast.endTime
    val initialEndLdt = initialEndEpoch?.let { LocalDateTime.ofInstant(Instant.ofEpochMilli(it), ZoneId.systemDefault()) }
    var endDate by remember { mutableStateOf(initialEndLdt?.toLocalDate() ?: LocalDate.now()) }
    var endHour by remember { mutableIntStateOf(initialEndLdt?.hour ?: LocalDateTime.now().hour) }
    var endMinute by remember { mutableIntStateOf(initialEndLdt?.minute ?: LocalDateTime.now().minute) }

    var showDatePickerFor by remember { mutableStateOf<String?>(null) }
    var pickingTimeFor by remember { mutableStateOf<String?>(null) }

    val startDatePickerState = rememberDatePickerState(
        initialSelectedDateMillis = startDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    )
    val endDatePickerState = rememberDatePickerState(
        initialSelectedDateMillis = endDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Fast", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Start Date & Time
                Text(text = "Start", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedCard(
                        onClick = { showDatePickerFor = "start" },
                        modifier = Modifier.weight(1.3f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Date", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(startDate.format(DateFormats.DISPLAY_DATE), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    OutlinedCard(
                        onClick = { pickingTimeFor = "start" },
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Time", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(formatTime12h(startHour, startMinute), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }

                // End Date & Time always shown for history
                Text(text = "End", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedCard(
                        onClick = { showDatePickerFor = "end" },
                        modifier = Modifier.weight(1.3f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Date", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(endDate.format(DateFormats.DISPLAY_DATE), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    OutlinedCard(
                        onClick = { pickingTimeFor = "end" },
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text("Time", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(formatTime12h(endHour, endMinute), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                // Clearly labeled dedicated delete action
                OutlinedButton(
                    onClick = onDelete,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Delete,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Delete Fast")
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val startLdt = LocalDateTime.of(startDate, LocalTime.of(startHour, startMinute))
                    val startMs = startLdt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    val rawEndLdt = LocalDateTime.of(endDate, LocalTime.of(endHour, endMinute))
                    val resolvedEnd = if (!rawEndLdt.isAfter(startLdt)) rawEndLdt.plusDays(1) else rawEndLdt
                    val endMs = resolvedEnd.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    onSave(startMs, endMs)
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )

    // Date Picker Dialog
    showDatePickerFor?.let { target ->
        val state = if (target == "start") startDatePickerState else endDatePickerState
        DatePickerDialog(
            onDismissRequest = { showDatePickerFor = null },
            confirmButton = {
                TextButton(
                    onClick = {
                        state.selectedDateMillis?.let { ms ->
                            val parsed = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
                            if (target == "start") startDate = parsed else endDate = parsed
                        }
                        showDatePickerFor = null
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePickerFor = null }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = state)
        }
    }

    // Time Picker Dialog (properly keyed on target)
    pickingTimeFor?.let { target ->
        val timePickerState = rememberTimePickerState(
            initialHour = if (target == "start") startHour else endHour,
            initialMinute = if (target == "start") startMinute else endMinute,
            is24Hour = false
        )
        AlertDialog(
            onDismissRequest = { pickingTimeFor = null },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (target == "start") {
                            startHour = timePickerState.hour
                            startMinute = timePickerState.minute
                        } else {
                            endHour = timePickerState.hour
                            endMinute = timePickerState.minute
                        }
                        pickingTimeFor = null
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { pickingTimeFor = null }) {
                    Text("Cancel")
                }
            },
            text = {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    TimePicker(state = timePickerState)
                }
            }
        )
    }
}
