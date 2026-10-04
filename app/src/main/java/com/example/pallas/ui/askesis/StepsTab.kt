package com.example.pallas.ui.askesis

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.health.connect.client.PermissionController
import com.example.pallas.data.coach.HealthConnectManager
import com.example.pallas.data.db.CoachStep
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.components.ExpressiveSegmentedSelector
import com.example.pallas.ui.components.bounceClick
import com.example.pallas.ui.components.chartDragScrubber
import com.example.pallas.util.DateFormats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

enum class StepRange(val label: String, val days: Int) {
    WEEK("W", 7),
    MONTH("M", 30),
    THREE_MONTH("3M", 90),
    YEAR("Y", 365)
}

data class StepBarData(
    val id: String,
    val title: String,
    val tickLabel: String,
    val isDot: Boolean = false,
    val steps: Int,
    val totalStepsInBin: Int = steps,
    val isGoalMet: Boolean = false,
    val isToday: Boolean = false
)

private val ISO_DATE_FORMATTER = DateFormats.ISO_LOCAL_DATE
private val DISPLAY_DATE_FORMATTER = DateFormats.SHORT_DATE
private val SHORT_MONTH_FORMATTER = DateFormats.SHORT_MONTH
private val FULL_MONTH_FORMATTER = DateFormats.FULL_MONTH

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StepsTab() {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val hc = remember { HealthConnectManager(context) }
    val scope = rememberCoroutineScope()
    val textMeasurer = rememberTextMeasurer(cacheSize = 64)
    val snackbarHostState = remember { SnackbarHostState() }

    var selectedRange by remember { mutableStateOf(StepRange.WEEK) }
    var rangeOffset by remember { mutableIntStateOf(0) }
    var stepsList by remember { mutableStateOf<List<CoachStep>>(AskesisCache.steps) }
    var isSyncing by remember { mutableStateOf(false) }
    var selectedIndex by remember { mutableStateOf<Int?>(null) }

    var stepGoal by remember { mutableIntStateOf(AskesisCache.stepGoal ?: 7000) }

    fun loadSteps() {
        scope.launch {
            val fresh = db.getCoachSteps()
            stepsList = fresh
            AskesisCache.steps = fresh
        }
    }

    fun syncFromHealthConnect() {
        scope.launch {
            isSyncing = true
            try {
                if (hc.isAvailable && hc.hasPermissions()) {
                    val success = com.example.pallas.data.coach.CoachManager.syncStepsFullYear(context)
                    if (success) {
                        loadSteps()
                    } else {
                        snackbarHostState.showSnackbar("Health Connect sync failed")
                    }
                } else {
                    snackbarHostState.showSnackbar("Health Connect permissions required")
                }
            } catch (e: Exception) {
                e.printStackTrace()
                snackbarHostState.showSnackbar("Health Connect sync error: ${e.message ?: "Failed"}")
            } finally {
                isSyncing = false
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        if (granted.containsAll(hc.permissions)) {
            syncFromHealthConnect()
        }
    }

    fun onSyncClick() {
        scope.launch {
            if (!hc.isAvailable) return@launch
            if (hc.hasPermissions()) {
                syncFromHealthConnect()
            } else {
                permissionLauncher.launch(hc.permissions)
            }
        }
    }

    LaunchedEffect(Unit) {
        loadSteps()
        scope.launch {
            val config = db.getCoachConfig()
            config["steps_threshold"]?.let {
                stepGoal = it
                AskesisCache.stepGoal = it
            }
        }
    }

    val today = remember { LocalDate.now() }

    // Calculate window bounds and header title matching screenshots
    val (windowTitle, windowStart, windowEnd) = remember(selectedRange, rangeOffset, today) {
        when (selectedRange) {
            StepRange.WEEK -> {
                val end = today.minusWeeks(rangeOffset.toLong())
                val start = end.minusDays(6)
                val title = if (rangeOffset == 0) "This Week"
                else "${start.format(DISPLAY_DATE_FORMATTER)}–${end.format(DISPLAY_DATE_FORMATTER)}"
                Triple(title, start, end)
            }
            StepRange.MONTH -> {
                val end = today.minusDays((rangeOffset * 30).toLong())
                val start = end.minusDays(29)
                val title = "${start.dayOfMonth} ${start.format(SHORT_MONTH_FORMATTER)}–${end.dayOfMonth} ${end.format(SHORT_MONTH_FORMATTER)}"
                Triple(title, start, end)
            }
            StepRange.THREE_MONTH -> {
                val end = today.minusDays((rangeOffset * 90).toLong())
                val start = end.minusDays(89)
                val title = "${start.format(SHORT_MONTH_FORMATTER)}–${end.format(SHORT_MONTH_FORMATTER)}"
                Triple(title, start, end)
            }
            StepRange.YEAR -> {
                val end = today.minusYears(rangeOffset.toLong())
                val start = end.minusMonths(11).withDayOfMonth(1)
                val title = "${start.format(SHORT_MONTH_FORMATTER)} ${start.year}–${end.format(SHORT_MONTH_FORMATTER)} ${end.year}"
                Triple(title, start, end)
            }
        }
    }

    // Build chart bars matching reference layouts
    val chartBars = remember(stepsList, selectedRange, rangeOffset, windowStart, windowEnd, today, stepGoal) {
        val map = stepsList.associate { it.date to it.steps }
        when (selectedRange) {
            StepRange.WEEK -> {
                val list = mutableListOf<StepBarData>()
                for (i in 0..6) {
                    val d = windowStart.plusDays(i.toLong())
                    val daySteps = map[d.format(ISO_DATE_FORMATTER)] ?: 0
                    val dayLetter = d.dayOfWeek.name.take(1) // M, T, W, T, F, S, S
                    list.add(
                        StepBarData(
                            id = d.format(ISO_DATE_FORMATTER),
                            title = "${d.dayOfWeek.name.take(3)}, ${d.format(DISPLAY_DATE_FORMATTER)}",
                            tickLabel = dayLetter,
                            steps = daySteps,
                            totalStepsInBin = daySteps,
                            isGoalMet = daySteps >= stepGoal,
                            isToday = d == today
                        )
                    )
                }
                list
            }
            StepRange.MONTH -> {
                val list = mutableListOf<StepBarData>()
                for (i in 0..29) {
                    val d = windowStart.plusDays(i.toLong())
                    val daySteps = map[d.format(ISO_DATE_FORMATTER)] ?: 0
                    // Match Image 2: labels at day 0, 7, 15, 22, 29; dots at intermediate ticks
                    val (tick, isDot) = when (i) {
                        0, 7, 15, 22, 29 -> Pair(d.dayOfMonth.toString(), false)
                        3, 11, 18, 26 -> Pair("·", true)
                        else -> Pair("", false)
                    }
                    list.add(
                        StepBarData(
                            id = d.format(ISO_DATE_FORMATTER),
                            title = "${d.dayOfWeek.name.take(3)}, ${d.format(DISPLAY_DATE_FORMATTER)}",
                            tickLabel = tick,
                            isDot = isDot,
                            steps = daySteps,
                            totalStepsInBin = daySteps,
                            isGoalMet = daySteps >= stepGoal,
                            isToday = d == today
                        )
                    )
                }
                list
            }
            StepRange.THREE_MONTH -> {
                // 13 weekly buckets across the 90-day quarter
                val list = mutableListOf<StepBarData>()
                for (w in 0..12) {
                    val binStart = windowStart.plusDays((w * 7).toLong())
                    val binEnd = binStart.plusDays(6).coerceAtMost(windowEnd)
                    var total = 0
                    var dayCount = 0
                    var curr = binStart
                    while (!curr.isAfter(binEnd)) {
                        total += map[curr.format(ISO_DATE_FORMATTER)] ?: 0
                        dayCount++
                        curr = curr.plusDays(1)
                    }
                    val avgSteps = if (dayCount > 0) total / dayCount else 0
                    // Match Image 3: Month name on first bucket of that month, dots in between
                    val isMonthStart = (w == 0) || (binStart.month != binStart.minusDays(7).month)
                    val (tick, isDot) = if (isMonthStart) {
                        Pair(binStart.format(FULL_MONTH_FORMATTER), false)
                    } else {
                        Pair("·", true)
                    }
                    list.add(
                        StepBarData(
                            id = binStart.format(ISO_DATE_FORMATTER),
                            title = "${binStart.format(DISPLAY_DATE_FORMATTER)} – ${binEnd.format(DISPLAY_DATE_FORMATTER)}",
                            tickLabel = tick,
                            isDot = isDot,
                            steps = avgSteps,
                            totalStepsInBin = total,
                            isGoalMet = avgSteps >= stepGoal,
                            isToday = false
                        )
                    )
                }
                list
            }
            StepRange.YEAR -> {
                // 12 monthly bars
                val list = mutableListOf<StepBarData>()
                for (m in 0..11) {
                    val monthStart = windowStart.plusMonths(m.toLong()).withDayOfMonth(1)
                    val monthEnd = monthStart.plusMonths(1).minusDays(1).coerceAtMost(windowEnd)
                    var total = 0
                    var dayCount = 0
                    var curr = monthStart
                    while (!curr.isAfter(monthEnd)) {
                        total += map[curr.format(ISO_DATE_FORMATTER)] ?: 0
                        dayCount++
                        curr = curr.plusDays(1)
                    }
                    val avgSteps = if (dayCount > 0) total / dayCount else 0
                    // Match Image 4: Single initial letter of month: O, N, D, J, F, M, A, M, J, J, A, S
                    val monthLetter = monthStart.month.name.take(1)
                    list.add(
                        StepBarData(
                            id = monthStart.format(ISO_DATE_FORMATTER),
                            title = "${monthStart.format(FULL_MONTH_FORMATTER)} ${monthStart.year}",
                            tickLabel = monthLetter,
                            isDot = false,
                            steps = avgSteps,
                            totalStepsInBin = total,
                            isGoalMet = avgSteps >= stepGoal,
                            isToday = false
                        )
                    )
                }
                list
            }
        }
    }

    val totalStepsInWindow = remember(chartBars) { chartBars.sumOf { it.totalStepsInBin } }
    val daysInWindow = remember(selectedRange, windowStart, windowEnd, today) {
        when (selectedRange) {
            StepRange.YEAR -> {
                val endCap = if (today.isBefore(windowEnd)) today else windowEnd
                val days = java.time.temporal.ChronoUnit.DAYS.between(windowStart, endCap).toInt() + 1
                days.coerceAtLeast(1)
            }
            else -> selectedRange.days
        }
    }
    val recordedDaysCount = remember(stepsList, windowStart, windowEnd, today) {
        val dateSet = stepsList.map { it.date }.toSet()
        val endCap = if (today.isBefore(windowEnd)) today else windowEnd
        var count = 0
        var curr = windowStart
        while (!curr.isAfter(endCap)) {
            if (dateSet.contains(curr.format(ISO_DATE_FORMATTER))) {
                count++
            }
            curr = curr.plusDays(1)
        }
        count
    }
    val effectiveDays = when (selectedRange) {
        StepRange.WEEK -> selectedRange.days
        else -> if (recordedDaysCount > 0) recordedDaysCount else daysInWindow
    }
    val avgStepsPerDay = remember(totalStepsInWindow, effectiveDays) {
        if (effectiveDays > 0) totalStepsInWindow / effectiveDays else 0
    }
    val daysGoalMet = remember(stepsList, windowStart, windowEnd, stepGoal) {
        val map = stepsList.associate { it.date to it.steps }
        var count = 0
        var curr = windowStart
        while (!curr.isAfter(windowEnd)) {
            if ((map[curr.format(ISO_DATE_FORMATTER)] ?: 0) >= stepGoal) {
                count++
            }
            curr = curr.plusDays(1)
        }
        count
    }

    val subtitleText = remember(selectedRange, daysGoalMet, totalStepsInWindow) {
        when (selectedRange) {
            StepRange.YEAR -> "You've taken a total of ${NumberFormat.getIntegerInstance().format(totalStepsInWindow)} steps so far this year"
            else -> "You've hit your goal on $daysGoalMet days so far, and took a total of ${NumberFormat.getIntegerInstance().format(totalStepsInWindow)} steps"
        }
    }

    val activeIndex = selectedIndex ?: (chartBars.size - 1).coerceAtLeast(0)
    val selectedBar = chartBars.getOrNull(activeIndex)

    val scrollState = rememberScrollState()

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        // Screen Title Row with Sync Health Button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Steps",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            FilledTonalButton(
                onClick = { onSyncClick() },
                enabled = !isSyncing,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                shape = CircleShape,
                modifier = Modifier.bounceClick()
            ) {
                Icon(
                    imageVector = Icons.Outlined.Refresh,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(if (isSyncing) "Syncing..." else "Sync Health", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Material 3 Expressive Morphing Range Selector (W, M, 3M, Y)
        ExpressiveSegmentedSelector(
            items = StepRange.entries,
            selectedItem = selectedRange,
            onItemSelected = { range ->
                selectedRange = range
                rangeOffset = 0
                selectedIndex = null
            },
            label = { it.label }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Main Expressive Chart Area
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
        ) {
                // Window Navigation Header with Circular Buttons (<, >, ↺)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = windowTitle,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = {
                                rangeOffset++
                                selectedIndex = null
                            },
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                                .bounceClick()
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Previous window",
                                modifier = Modifier.size(18.dp),
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        IconButton(
                            onClick = {
                                if (rangeOffset > 0) {
                                    rangeOffset--
                                    selectedIndex = null
                                }
                            },
                            enabled = rangeOffset > 0,
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(
                                    if (rangeOffset > 0) MaterialTheme.colorScheme.surfaceContainerHigh
                                    else MaterialTheme.colorScheme.surfaceContainerLow.copy(alpha = 0.4f)
                                )
                                .bounceClick()
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = "Next window",
                                modifier = Modifier.size(18.dp),
                                tint = if (rangeOffset > 0) MaterialTheme.colorScheme.onSurface
                                else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                            )
                        }

                        if (rangeOffset > 0) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                onClick = {
                                    rangeOffset = 0
                                    selectedIndex = null
                                },
                                shape = CircleShape,
                                color = MaterialTheme.colorScheme.secondaryContainer,
                                modifier = Modifier.bounceClick()
                            ) {
                                Text(
                                    text = "Today",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Headline Average Steps Row matching screenshots
                Row(
                    verticalAlignment = Alignment.Bottom
                ) {
                    Text(
                        text = NumberFormat.getIntegerInstance().format(avgStepsPerDay),
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "steps per day (avg)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(bottom = 4.dp)
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Subtitle: Goal achievement summary
                Text(
                    text = subtitleText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Canvas Chart Area with Google Health Connect layout
                val density = LocalDensity.current
                val primaryColor = MaterialTheme.colorScheme.primary
                val secondaryColor = MaterialTheme.colorScheme.secondary
                val surfaceVariantColor = MaterialTheme.colorScheme.surfaceContainerHighest
                val outlineColor = MaterialTheme.colorScheme.outlineVariant
                val onSurfaceVariant = MaterialTheme.colorScheme.onSurfaceVariant
                val labelStyle = MaterialTheme.typography.labelSmall
                val rosetteBg = MaterialTheme.colorScheme.onSecondary
                val rosetteCheck = MaterialTheme.colorScheme.secondary

                AnimatedContent(
                    targetState = chartBars,
                    transitionSpec = {
                        (fadeIn(animationSpec = tween(300)) + scaleIn(initialScale = 0.96f, animationSpec = tween(300)))
                            .togetherWith(fadeOut(animationSpec = tween(150)))
                    },
                    label = "StepsChartTransition"
                ) { currentBars ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(240.dp)
                            .chartDragScrubber { offset, totalWidth ->
                                if (currentBars.isNotEmpty()) {
                                    val chartLeft = with(density) { 12.dp.toPx() }
                                    val chartRight = totalWidth - with(density) { 54.dp.toPx() }
                                    val chartW = chartRight - chartLeft
                                    if (chartW > 0) {
                                        val slotW = chartW / currentBars.size
                                        val clampedX = (offset.x - chartLeft).coerceIn(0f, chartW - 0.001f)
                                        val tappedIndex = (clampedX / slotW).toInt().coerceIn(0, currentBars.size - 1)
                                        selectedIndex = tappedIndex
                                    }
                                }
                            }
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            if (currentBars.isEmpty()) return@Canvas

                            val chartLeft = 12.dp.toPx()
                            val chartRight = size.width - 54.dp.toPx()
                            val chartTop = 18.dp.toPx()
                            val chartBottom = size.height - 28.dp.toPx()
                            val chartW = chartRight - chartLeft
                            val chartH = chartBottom - chartTop

                            val maxData = (currentBars.maxOfOrNull { it.steps } ?: 0).coerceAtLeast(stepGoal)
                            val maxStep = (((maxData * 1.25f) / 1000 + 1).toInt() * 1000).coerceAtLeast(10000)

                            // 1. Draw Horizontal Goal Line at target level
                            val goalRatio = (stepGoal.toFloat() / maxStep).coerceIn(0f, 1f)
                            val yGoal = chartBottom - (goalRatio * chartH)
                            drawLine(
                                color = secondaryColor,
                                start = Offset(chartLeft, yGoal),
                                end = Offset(chartRight, yGoal),
                                strokeWidth = 1.5.dp.toPx()
                            )

                            // Draw Goal Label on the right edge in accent color
                            val goalLayout = textMeasurer.measure(
                                text = NumberFormat.getIntegerInstance().format(stepGoal),
                                style = labelStyle.copy(fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            )
                            drawText(
                                textLayoutResult = goalLayout,
                                topLeft = Offset(chartRight + 6.dp.toPx(), yGoal - goalLayout.size.height / 2f),
                                color = secondaryColor
                            )

                            // 2. Draw Right-Aligned Y-Axis Scales (max, intermediate, baseline 0)
                            val divisions = 3
                            for (d in 0..divisions) {
                                val frac = d.toFloat() / divisions
                                val value = (maxStep * frac).toInt()
                                val yTick = chartBottom - (frac * chartH)

                                // Avoid drawing tick label if it collides with the goal label
                                if (kotlin.math.abs(yTick - yGoal) > 16.dp.toPx()) {
                                    val tickLayout = textMeasurer.measure(
                                        text = NumberFormat.getIntegerInstance().format(value),
                                        style = labelStyle.copy(fontSize = 11.sp)
                                    )
                                    drawText(
                                        textLayoutResult = tickLayout,
                                        topLeft = Offset(chartRight + 6.dp.toPx(), yTick - tickLayout.size.height / 2f),
                                        color = onSurfaceVariant
                                    )
                                }
                            }

                            // 3. Draw Baseline
                            drawLine(
                                color = outlineColor.copy(alpha = 0.5f),
                                start = Offset(chartLeft, chartBottom),
                                end = Offset(chartRight, chartBottom),
                                strokeWidth = 1.dp.toPx()
                            )

                            // 4. Render Capsule Bars with Dual-Tone Colors & Rosette Badges
                            val barCount = currentBars.size
                            val slotW = chartW / barCount
                            val barW = when (selectedRange) {
                                StepRange.WEEK -> (slotW * 0.62f).coerceIn(20.dp.toPx(), 42.dp.toPx())
                                StepRange.MONTH -> (slotW * 0.65f).coerceIn(4.dp.toPx(), 10.dp.toPx())
                                StepRange.THREE_MONTH -> (slotW * 0.65f).coerceIn(10.dp.toPx(), 22.dp.toPx())
                                StepRange.YEAR -> (slotW * 0.65f).coerceIn(12.dp.toPx(), 26.dp.toPx())
                            }

                            currentBars.forEachIndexed { i, bar ->
                                val slotCenterX = chartLeft + (i * slotW) + (slotW / 2f)
                                val barRatio = (bar.steps.toFloat() / maxStep).coerceIn(0f, 1f)
                                val barHeight = (barRatio * chartH).coerceAtLeast(barW)
                                val barTop = chartBottom - barHeight
                                val isSelected = i == activeIndex

                                // Dual-tone color matching screenshots:
                                // Above/at goal: bright secondary/mint
                                // Below goal: deep primary/teal tone
                                val barColor = when {
                                    bar.steps == 0 -> surfaceVariantColor
                                    bar.isGoalMet -> secondaryColor
                                    else -> primaryColor.copy(alpha = 0.85f)
                                }

                                // Capsule Shape (pill rounded)
                                drawRoundRect(
                                    color = barColor,
                                    topLeft = Offset(slotCenterX - barW / 2f, barTop),
                                    size = Size(barW, barHeight),
                                    cornerRadius = CornerRadius(barW / 2f, barW / 2f)
                                )

                                // Rosette Starburst Checkmark Badge on goal-hitting bars
                                if (bar.isGoalMet && selectedRange != StepRange.MONTH && (barW >= 8.dp.toPx() || bar.steps >= stepGoal * 1.5)) {
                                    val rosetteRadius = (barW * 0.40f).coerceIn(5.dp.toPx(), 11.dp.toPx())
                                    drawRosetteBadge(
                                        center = Offset(slotCenterX, barTop + barW / 2f),
                                        radius = rosetteRadius,
                                        badgeColor = rosetteBg,
                                        checkColor = rosetteCheck
                                    )
                                }

                                // Selection Highlight
                                if (isSelected) {
                                    drawRoundRect(
                                        color = primaryColor,
                                        topLeft = Offset(slotCenterX - barW / 2f - 2.dp.toPx(), barTop - 2.dp.toPx()),
                                        size = Size(barW + 4.dp.toPx(), barHeight + 4.dp.toPx()),
                                        cornerRadius = CornerRadius((barW + 4.dp.toPx()) / 2f, (barW + 4.dp.toPx()) / 2f),
                                        style = Stroke(width = 2.dp.toPx())
                                    )
                                }

                                // 5. Draw X-Axis Ticks (letters, numbers, or dots)
                                val yBaseline = chartBottom + 6.dp.toPx()
                                if (bar.isDot) {
                                    drawCircle(
                                        color = onSurfaceVariant.copy(alpha = 0.7f),
                                        radius = 2.dp.toPx(),
                                        center = Offset(slotCenterX, yBaseline + 6.dp.toPx())
                                    )
                                } else if (bar.tickLabel.isNotEmpty()) {
                                    val tickLayout = textMeasurer.measure(
                                        text = bar.tickLabel,
                                        style = labelStyle.copy(fontWeight = FontWeight.Medium, fontSize = 11.sp)
                                    )
                                    drawText(
                                        textLayoutResult = tickLayout,
                                        topLeft = Offset(slotCenterX - tickLayout.size.width / 2f, yBaseline),
                                        color = onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }

                // Interactive Scrubber Inspection Card
                if (selectedBar != null) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (selectedBar.isGoalMet) MaterialTheme.colorScheme.secondaryContainer
                            else MaterialTheme.colorScheme.surfaceContainerHigh
                        ),
                        modifier = Modifier.fillMaxWidth()
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
                                    text = selectedBar.title,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (selectedBar.isGoalMet) MaterialTheme.colorScheme.onSecondaryContainer
                                    else MaterialTheme.colorScheme.onSurface
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = if (selectedBar.isGoalMet) "Goal Reached ✓ (Target: ${NumberFormat.getIntegerInstance().format(stepGoal)})"
                                    else "${NumberFormat.getIntegerInstance().format((stepGoal - selectedBar.steps).coerceAtLeast(0))} steps to goal",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (selectedBar.isGoalMet) MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.85f)
                                    else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = NumberFormat.getIntegerInstance().format(selectedBar.steps),
                                    style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (selectedBar.isGoalMet) MaterialTheme.colorScheme.onSecondaryContainer
                                    else MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = if (selectedRange == StepRange.THREE_MONTH || selectedRange == StepRange.YEAR) "avg steps/day" else "steps",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (selectedBar.isGoalMet) MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.75f)
                                    else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }

        Spacer(modifier = Modifier.height(32.dp))
    }

    SnackbarHost(
        hostState = snackbarHostState,
        modifier = Modifier
            .align(Alignment.BottomCenter)
            .padding(bottom = 16.dp)
    )
}
}

/**
 * Draws a scalloped starburst rosette badge with an embedded checkmark at [center].
 */
private fun DrawScope.drawRosetteBadge(
    center: Offset,
    radius: Float,
    badgeColor: Color,
    checkColor: Color
) {
    val path = Path()
    val points = 24
    for (i in 0 until points) {
        val angle = (i.toFloat() / points) * 2f * Math.PI.toFloat()
        val r = if (i % 2 == 0) radius else radius * 0.82f
        val x = center.x + r * cos(angle)
        val y = center.y + r * sin(angle)
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    path.close()
    drawPath(path = path, color = badgeColor)

    // Checkmark stroke inside rosette
    val checkPath = Path().apply {
        moveTo(center.x - radius * 0.38f, center.y)
        lineTo(center.x - radius * 0.05f, center.y + radius * 0.32f)
        lineTo(center.x + radius * 0.42f, center.y - radius * 0.32f)
    }
    drawPath(
        path = checkPath,
        color = checkColor,
        style = Stroke(
            width = (radius * 0.28f).coerceIn(1.5f, 3.5f),
            cap = StrokeCap.Round,
            join = StrokeJoin.Round
        )
    )
}
