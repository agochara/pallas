package com.example.pallas.ui.askesis

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.data.db.WeightEntry
import com.example.pallas.ui.components.ExpressiveChartUtils
import com.example.pallas.ui.components.ExpressiveChartUtils.drawXAxisLabels
import com.example.pallas.ui.components.ExpressiveChartUtils.drawYAxis
import com.example.pallas.ui.components.ExpressiveSegmentedSelector
import com.example.pallas.ui.components.bounceClick
import com.example.pallas.ui.components.chartDragScrubber
import com.example.pallas.util.DateFormats
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.roundToInt

enum class WeightTimeRange(val label: String, val days: Int) {
    W("W", 7),
    M("M", 30),
    THREE_M("3M", 90),
    Y("Y", 365)
}

// Cached DateTimeFormatters
private val ISO_DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
private val DISPLAY_DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
private val MONTH_YEAR_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US)
private val SHORT_MONTH_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM", Locale.US)
private val SHORT_MONTH_DAY_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d", Locale.US)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeightTab() {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var weights by remember { mutableStateOf<List<WeightEntry>>(AskesisCache.weights) }
    var selectedRange by remember { mutableStateOf(WeightTimeRange.Y) }
    var rangeOffset by remember { mutableIntStateOf(0) }

    var showLogDialog by remember { mutableStateOf(false) }
    var logSelectedDate by remember { mutableStateOf(LocalDate.now()) }
    val pastOnlySelectableDates = remember {
        object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean {
                val endOfTodayUtc = LocalDate.now().atTime(23, 59, 59).toInstant(ZoneOffset.UTC).toEpochMilli()
                return utcTimeMillis <= endOfTodayUtc
            }
        }
    }
    var editingWeight by remember { mutableStateOf<WeightEntry?>(null) }
    var selectedPointId by remember { mutableStateOf<Long?>(null) }

    // History accordion state - hidden by default
    var isHistoryOpen by remember { mutableStateOf(false) }
    var expandedMonths by remember { mutableStateOf(setOf<String>()) }

    fun loadWeights() {
        scope.launch {
            val fresh = db.getWeights()
            weights = fresh
            AskesisCache.weights = fresh
        }
    }

    LaunchedEffect(Unit) {
        loadWeights()
    }

    // Calculate time window
    val windowDates = remember(selectedRange, rangeOffset) {
        val today = LocalDate.now()
        val daysSpan = selectedRange.days
        val end = today.plusDays((rangeOffset * daysSpan).toLong())
        val start = end.minusDays((daysSpan - 1).toLong())
        Pair(start, end)
    }

    val startStr = windowDates.first.format(ISO_DATE_FORMATTER)
    val endStr = windowDates.second.format(ISO_DATE_FORMATTER)

    val sortedWeights = remember(weights) { weights.sortedBy { it.date } }
    
    val inWindowWeights = remember(sortedWeights, startStr, endStr) {
        sortedWeights.filter { it.date in startStr..endStr }
    }

    val latestWeight = sortedWeights.lastOrNull()
    val firstInWindow = inWindowWeights.firstOrNull()
    val lastInWindow = inWindowWeights.lastOrNull()

    val deltaText = remember(inWindowWeights) {
        if (inWindowWeights.isEmpty()) {
            "No measurements in this period"
        } else if (inWindowWeights.size == 1) {
            "1 measurement recorded (${inWindowWeights[0].weight} kg)"
        } else {
            val delta = (lastInWindow?.weight ?: 0.0) - (firstInWindow?.weight ?: 0.0)
            if (delta < 0) {
                String.format(Locale.US, "%.1f kg lost over period", abs(delta))
            } else if (delta > 0) {
                String.format(Locale.US, "+%.1f kg gained over period", delta)
            } else {
                "No net change over period"
            }
        }
    }

    val windowLabel = remember(windowDates) {
        "${windowDates.first.format(DISPLAY_DATE_FORMATTER)} – ${windowDates.second.format(DISPLAY_DATE_FORMATTER)}"
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        // Screen Title Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Weight",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            FilledTonalButton(
                onClick = {
                    logSelectedDate = LocalDate.now()
                    showLogDialog = true
                },
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                shape = CircleShape
            ) {
                Icon(
                    imageVector = Icons.Outlined.Add,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Log Weight", fontWeight = FontWeight.SemiBold)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Expressive Trend Chart Area
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
        ) {
                // Material 3 Expressive Morphing Range Selector (W, M, 3M, Y)
                ExpressiveSegmentedSelector(
                    items = WeightTimeRange.entries,
                    selectedItem = selectedRange,
                    onItemSelected = { range ->
                        selectedRange = range
                        rangeOffset = 0
                        selectedPointId = null
                    },
                    label = { it.label }
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Date Range Navigation Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = windowLabel,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(
                            onClick = {
                                rangeOffset -= 1
                                selectedPointId = null
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                contentDescription = "Previous Range",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        IconButton(
                            onClick = {
                                if (rangeOffset < 0) {
                                    rangeOffset += 1
                                    selectedPointId = null
                                }
                            },
                            enabled = rangeOffset < 0,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "Next Range",
                                tint = if (rangeOffset < 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.25f)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Delta Summary
                Text(
                    text = deltaText,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )

                latestWeight?.let {
                    Text(
                        text = "Current: ${it.weight} kg (${it.date})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                WeightChart(
                    weights = sortedWeights,
                    range = selectedRange,
                    windowStart = windowDates.first,
                    windowEnd = windowDates.second,
                    selectedId = selectedPointId,
                    onSelect = { selectedPointId = it },
                    description = deltaText,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                )

                // Selected Point Expressive Inspection Pill
                selectedPointId?.let { id ->
                    inWindowWeights.firstOrNull { it.id == id }?.let { point ->
                        Spacer(modifier = Modifier.height(14.dp))
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerHighest
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "Selected Date",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = point.date,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "Measurement",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                    Text(
                                        text = "${point.weight} kg",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    }
                }
            }

        Spacer(modifier = Modifier.height(24.dp))

        // =========================================================================
        // HIERARCHICAL HISTORY SECTION:
        // <Time History Icon> History
        // upon clicking which:
        // Month, Year (5 measurements)
        // Month, Year (7 measurements)
        // ...
        // upon clicking which the measurements are displayed.
        // =========================================================================
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
                .animateContentSize(spring())
        ) {
                // <Time History Icon> History Header Button
                Surface(
                    onClick = { isHistoryOpen = !isHistoryOpen },
                    color = Color.Transparent,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Outlined.History,
                                contentDescription = "History",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "History",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }

                        Icon(
                            imageVector = if (isHistoryOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = if (isHistoryOpen) "Collapse" else "Expand",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (isHistoryOpen) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    val chronologicalWeights = remember(weights) { weights.sortedBy { it.date } }
                    val chronologicalMap = remember(chronologicalWeights) {
                        chronologicalWeights.mapIndexed { idx, e -> e.id to idx }.toMap()
                    }
                    val reversedWeights = remember(weights) { weights.sortedByDescending { it.date } }

                    // Group by Month, Year
                    val monthGroups = remember(reversedWeights) {
                        reversedWeights.groupBy { entry ->
                            try {
                                val d = LocalDate.parse(entry.date)
                                d.format(MONTH_YEAR_FORMATTER)
                            } catch (e: Exception) {
                                entry.date.take(7)
                            }
                        }
                    }

                    if (monthGroups.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No weight history recorded yet",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            monthGroups.forEach { (monthYear, groupEntries) ->
                                val isMonthExpanded = expandedMonths.contains(monthYear)

                                Card(
                                    shape = RoundedCornerShape(18.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surfaceContainer
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .animateContentSize(spring())
                                ) {
                                    Column(modifier = Modifier.fillMaxWidth()) {
                                        // Month, Year (N measurements) Header
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable {
                                                    expandedMonths = if (isMonthExpanded) {
                                                        expandedMonths - monthYear
                                                    } else {
                                                        expandedMonths + monthYear
                                                    }
                                                }
                                                .padding(horizontal = 16.dp, vertical = 14.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(
                                                    text = monthYear,
                                                    style = MaterialTheme.typography.titleMedium,
                                                    fontWeight = FontWeight.SemiBold,
                                                    color = MaterialTheme.colorScheme.onSurface
                                                )
                                                Text(
                                                    text = "(${groupEntries.size} measurements)",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.primary,
                                                    fontWeight = FontWeight.Medium
                                                )
                                            }

                                            Icon(
                                                imageVector = if (isMonthExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                                contentDescription = if (isMonthExpanded) "Collapse Month" else "Expand Month",
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }

                                        // Detailed Measurements when Month is clicked
                                        if (isMonthExpanded) {
                                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f))
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                                verticalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                groupEntries.forEach { entry ->
                                                    val entryIndex = chronologicalMap[entry.id] ?: -1
                                                    val prevEntry = if (entryIndex > 0) chronologicalWeights.getOrNull(entryIndex - 1) else null
                                                    val delta = prevEntry?.let { entry.weight - it.weight }

                                                    Surface(
                                                        shape = RoundedCornerShape(12.dp),
                                                        color = MaterialTheme.colorScheme.surfaceContainerHigh,
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .clickable { editingWeight = entry }
                                                    ) {
                                                        Row(
                                                            modifier = Modifier
                                                                .fillMaxWidth()
                                                                .padding(horizontal = 14.dp, vertical = 10.dp),
                                                            horizontalArrangement = Arrangement.SpaceBetween,
                                                            verticalAlignment = Alignment.CenterVertically
                                                        ) {
                                                            Column {
                                                                Text(
                                                                    text = entry.date,
                                                                    style = MaterialTheme.typography.bodyMedium,
                                                                    fontWeight = FontWeight.Medium,
                                                                    color = MaterialTheme.colorScheme.onSurface
                                                                )
                                                                if (delta != null) {
                                                                    val deltaStr = if (delta > 0) String.format(Locale.US, "+%.1f kg", delta)
                                                                    else String.format(Locale.US, "%.1f kg", delta)
                                                                    val deltaColor = if (delta < 0) MaterialTheme.colorScheme.primary
                                                                    else if (delta > 0) MaterialTheme.colorScheme.tertiary
                                                                    else MaterialTheme.colorScheme.onSurfaceVariant
                                                                    Text(
                                                                        text = deltaStr,
                                                                        style = MaterialTheme.typography.labelSmall,
                                                                        color = deltaColor,
                                                                        fontWeight = FontWeight.SemiBold
                                                                    )
                                                                }
                                                            }

                                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                                Text(
                                                                    text = "${entry.weight} kg",
                                                                    style = MaterialTheme.typography.titleMedium,
                                                                    fontWeight = FontWeight.Bold,
                                                                    color = MaterialTheme.colorScheme.primary
                                                                )
                                                                Spacer(modifier = Modifier.width(10.dp))
                                                                Icon(
                                                                    imageVector = Icons.Outlined.Edit,
                                                                    contentDescription = "Edit",
                                                                    tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                                                    modifier = Modifier.size(18.dp)
                                                                )
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

        Spacer(modifier = Modifier.height(36.dp))
    }

    // Log Weight Dialog
    var showDatePickerForLog by remember { mutableStateOf(false) }
    val logDatePickerState = rememberDatePickerState(
        initialSelectedDateMillis = logSelectedDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
        selectableDates = pastOnlySelectableDates
    )

    if (showLogDialog) {
        var weightInput by remember { mutableStateOf("") }
        val cleanInput = weightInput.replace(',', '.').trim()
        val parsedWeight = cleanInput.toDoubleOrNull()
        val isWeightValid = parsedWeight != null && parsedWeight in 20.0..500.0

        AlertDialog(
            onDismissRequest = { showLogDialog = false },
            title = { Text("Log Weight", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = weightInput,
                        onValueChange = { weightInput = it },
                        label = { Text("Weight (kg)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        isError = weightInput.isNotBlank() && !isWeightValid,
                        supportingText = if (weightInput.isNotBlank() && !isWeightValid) {
                            { Text("Enter a realistic weight (20 - 500 kg)", color = MaterialTheme.colorScheme.error) }
                        } else null,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    // M3 Expressive Date Selection Card
                    OutlinedCard(
                        onClick = { showDatePickerForLog = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Date",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = logSelectedDate.format(DISPLAY_DATE_FORMATTER),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            Icon(
                                imageVector = Icons.Outlined.CalendarToday,
                                contentDescription = "Select Date",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (isWeightValid) {
                            scope.launch {
                                db.insertWeight(parsedWeight!!, logSelectedDate.format(ISO_DATE_FORMATTER))
                                loadWeights()
                                showLogDialog = false
                            }
                        }
                    },
                    enabled = isWeightValid
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (showDatePickerForLog) {
        DatePickerDialog(
            onDismissRequest = { showDatePickerForLog = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        logDatePickerState.selectedDateMillis?.let { ms ->
                            logSelectedDate = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
                        }
                        showDatePickerForLog = false
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDatePickerForLog = false }) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(state = logDatePickerState)
        }
    }

    // Edit Weight Dialog with dedicated, clearly labeled Delete Button and M3 DatePicker
    editingWeight?.let { entry ->
        var showDatePickerForEdit by remember { mutableStateOf(false) }
        var weightInput by remember(entry) { mutableStateOf(entry.weight.toString()) }
        var editSelectedDate by remember(entry) {
            mutableStateOf(
                try { LocalDate.parse(entry.date, ISO_DATE_FORMATTER) } catch (e: Exception) { LocalDate.now() }
            )
        }
        val editDatePickerState = rememberDatePickerState(
            initialSelectedDateMillis = editSelectedDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            selectableDates = pastOnlySelectableDates
        )

        val cleanEdit = weightInput.replace(',', '.').trim()
        val parsedEditWeight = cleanEdit.toDoubleOrNull()
        val isEditWeightValid = parsedEditWeight != null && parsedEditWeight in 20.0..500.0

        AlertDialog(
            onDismissRequest = { editingWeight = null },
            title = { Text("Edit Weight Entry", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = weightInput,
                        onValueChange = { weightInput = it },
                        label = { Text("Weight (kg)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        isError = weightInput.isNotBlank() && !isEditWeightValid,
                        supportingText = if (weightInput.isNotBlank() && !isEditWeightValid) {
                            { Text("Enter a realistic weight (20 - 500 kg)", color = MaterialTheme.colorScheme.error) }
                        } else null,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    // M3 Expressive Date Selection Card
                    OutlinedCard(
                        onClick = { showDatePickerForEdit = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Date",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = editSelectedDate.format(DISPLAY_DATE_FORMATTER),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            Icon(
                                imageVector = Icons.Outlined.CalendarToday,
                                contentDescription = "Select Date",
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    OutlinedButton(
                        onClick = {
                            scope.launch {
                                db.deleteWeight(entry.id)
                                loadWeights()
                                editingWeight = null
                            }
                        },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Delete,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Delete Weight Entry")
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (isEditWeightValid) {
                            scope.launch {
                                db.updateWeight(entry.id, parsedEditWeight!!, editSelectedDate.format(ISO_DATE_FORMATTER))
                                loadWeights()
                                editingWeight = null
                            }
                        }
                    },
                    enabled = isEditWeightValid
                ) {
                    Text("Update")
                }
            },
            dismissButton = {
                TextButton(onClick = { editingWeight = null }) {
                    Text("Cancel")
                }
            }
        )

        if (showDatePickerForEdit) {
            DatePickerDialog(
                onDismissRequest = { showDatePickerForEdit = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            editDatePickerState.selectedDateMillis?.let { ms ->
                                editSelectedDate = Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate()
                            }
                            showDatePickerForEdit = false
                        }
                    ) {
                        Text("OK")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePickerForEdit = false }) {
                        Text("Cancel")
                    }
                }
            ) {
                DatePicker(state = editDatePickerState)
            }
        }
    }
}
