package com.example.pallas.ui.settings

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.example.pallas.data.coach.CoachManager
import com.example.pallas.data.coach.CoachNotificationScheduler
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.theme.EBGaramond
import kotlinx.coroutines.launch
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()
    val syncPrefs = remember { context.getSharedPreferences("pallas_sync", Context.MODE_PRIVATE) }

    // SQL Console State
    var sqlQuery by remember { mutableStateOf("") }
    var sqlResult by remember { mutableStateOf<String?>(null) }
    var isRunningSql by remember { mutableStateOf(false) }
    var showSqlInfoModal by remember { mutableStateOf(false) }

    // Coach Thresholds State
    var stepsThresholdText by remember { mutableStateOf("7000") }
    var stepsDaysText by remember { mutableStateOf("3") }
    var fastingDaysText by remember { mutableStateOf("3") }
    var isSavingCoachConfig by remember { mutableStateOf(false) }
    var notificationsEnabled by remember {
        mutableStateOf(syncPrefs.getBoolean("coach_notifications_enabled", false))
    }
    var notificationHour by remember {
        mutableIntStateOf(syncPrefs.getInt("coach_notification_hour", 15))
    }
    var notificationMinute by remember {
        mutableIntStateOf(syncPrefs.getInt("coach_notification_minute", 0))
    }
    var showTimePicker by remember { mutableStateOf(false) }

    val notifPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            notificationsEnabled = true
            syncPrefs.edit().putBoolean("coach_notifications_enabled", true).apply()
            CoachNotificationScheduler.schedule(context)
            Toast.makeText(context, "Daily reminders enabled for ${formatTime12Hour(notificationHour, notificationMinute)}.", Toast.LENGTH_SHORT).show()
        } else {
            notificationsEnabled = false
            syncPrefs.edit().putBoolean("coach_notifications_enabled", false).apply()
            CoachNotificationScheduler.cancel(context)
            Toast.makeText(context, "Notification permission is required for reminders.", Toast.LENGTH_LONG).show()
        }
    }

    val appVersion = remember {
        try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            "v${pInfo.versionName ?: "1.0"}"
        } catch (e: Exception) {
            "v1.0"
        }
    }

    data class ResetOption(val label: String, val action: suspend () -> Unit)

    // Danger Zone Dialog State
    var confirmDialogAction by remember { mutableStateOf<ResetOption?>(null) }

    // Document Picker for Import
    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            scope.launch {
                try {
                    val inputStream = context.contentResolver.openInputStream(uri)
                    val jsonStr = inputStream?.bufferedReader()?.use { it.readText() } ?: ""
                    if (jsonStr.isNotBlank()) {
                        val success = db.importDatabaseDataJson(jsonStr)
                        if (success) {
                            Toast.makeText(context, "Backup imported and merged successfully.", Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(context, "Invalid backup format.", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Import failed: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        val config = db.getCoachConfig()
        config["steps_threshold"]?.let { stepsThresholdText = it.toString() }
        config["steps_days"]?.let { stepsDaysText = it.toString() }
        config["fasting_days"]?.let { fastingDaysText = it.toString() }
    }

    fun handleExport() {
        scope.launch {
            try {
                val json = db.exportDatabaseDataJson()
                val cacheDir = context.cacheDir
                val file = File(cacheDir, "pallas-backup.json")
                file.writeText(json)

                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/json"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, "Export Pallas Data"))
            } catch (e: Exception) {
                // If FileProvider not declared, fallback to text sharing
                try {
                    val json = db.exportDatabaseDataJson()
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, json)
                    }
                    context.startActivity(Intent.createChooser(intent, "Export Pallas Data"))
                } catch (ex: Exception) {
                    Toast.makeText(context, "Export error: ${ex.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "SETTINGS",
                        fontFamily = EBGaramond,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.surface
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            // -------------------------------------------------------------
            // Section: SQL Console
            // -------------------------------------------------------------
            Text(
                text = "SQL CONSOLE",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    OutlinedTextField(
                        value = sqlQuery,
                        onValueChange = { sqlQuery = it },
                        placeholder = { Text("SELECT * FROM max_lifts;") },
                        minLines = 3,
                        maxLines = 6,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { showSqlInfoModal = true }) {
                                Icon(
                                    imageVector = Icons.Outlined.Info,
                                    contentDescription = "SQL Schema & Examples",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (sqlResult != null) {
                                TextButton(onClick = { sqlResult = null }) {
                                    Text("Clear")
                                }
                            }
                        }

                        Button(
                            onClick = {
                                if (sqlQuery.isNotBlank()) {
                                    isRunningSql = true
                                    scope.launch {
                                        sqlResult = db.executeRawSql(sqlQuery)
                                        isRunningSql = false
                                    }
                                }
                            },
                            enabled = !isRunningSql && sqlQuery.isNotBlank()
                        ) {
                            Text(if (isRunningSql) "RUNNING..." else "RUN SQL")
                        }
                    }

                    sqlResult?.let { result ->
                        Spacer(modifier = Modifier.height(14.dp))
                        Card(
                            shape = MaterialTheme.shapes.small,
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceContainerHighest
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 240.dp)
                        ) {
                            SelectionContainer(
                                modifier = Modifier
                                    .padding(12.dp)
                                    .verticalScroll(rememberScrollState())
                            ) {
                                Text(
                                    text = result,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // -------------------------------------------------------------
            // Section: Coach
            // -------------------------------------------------------------
            Text(
                text = "COACH",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "Thresholds that drive Coach reminders.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 14.dp)
                    )

                    OutlinedTextField(
                        value = stepsThresholdText,
                        onValueChange = { stepsThresholdText = it },
                        label = { Text("Steps threshold") },
                        supportingText = { Text("Daily step goal (e.g. 7000)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = stepsDaysText,
                        onValueChange = { stepsDaysText = it },
                        label = { Text("Steps days") },
                        supportingText = { Text("Consecutive days below goal before intervention") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = fastingDaysText,
                        onValueChange = { fastingDaysText = it },
                        label = { Text("Fasting interval (days)") },
                        supportingText = { Text("Days without a logged fast before intervention") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(18.dp))

                    Button(
                        onClick = {
                            val st = stepsThresholdText.toIntOrNull() ?: 7000
                            val sd = stepsDaysText.toIntOrNull() ?: 3
                            val fd = fastingDaysText.toIntOrNull() ?: 3

                            isSavingCoachConfig = true
                            scope.launch {
                                db.saveCoachConfig(
                                    mapOf(
                                        "steps_threshold" to st,
                                        "steps_days" to sd,
                                        "fasting_days" to fd
                                    )
                                )
                                CoachManager.evaluateAndPublishRules(context)
                                isSavingCoachConfig = false
                                Toast.makeText(context, "Coach thresholds updated.", Toast.LENGTH_SHORT).show()
                            }
                        },
                        enabled = !isSavingCoachConfig,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (isSavingCoachConfig) "SAVING..." else "SAVE THRESHOLDS")
                    }

                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 16.dp),
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f, fill = false).padding(end = 12.dp)) {
                            Text(
                                text = "Daily Reminders",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Sends one notification at the scheduled time if steps or fasting need attention. Never nags on a good day.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Switch(
                            checked = notificationsEnabled,
                            onCheckedChange = { checked ->
                                if (checked) {
                                    val timeStr = formatTime12Hour(notificationHour, notificationMinute)
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                        val hasPerm = ContextCompat.checkSelfPermission(
                                            context,
                                            android.Manifest.permission.POST_NOTIFICATIONS
                                        ) == PackageManager.PERMISSION_GRANTED
                                        if (hasPerm) {
                                            notificationsEnabled = true
                                            syncPrefs.edit().putBoolean("coach_notifications_enabled", true).apply()
                                            CoachNotificationScheduler.schedule(context)
                                            Toast.makeText(context, "Daily reminders enabled for $timeStr.", Toast.LENGTH_SHORT).show()
                                        } else {
                                            notifPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                                        }
                                    } else {
                                        notificationsEnabled = true
                                        syncPrefs.edit().putBoolean("coach_notifications_enabled", true).apply()
                                        CoachNotificationScheduler.schedule(context)
                                        Toast.makeText(context, "Daily reminders enabled for $timeStr.", Toast.LENGTH_SHORT).show()
                                    }
                                } else {
                                    notificationsEnabled = false
                                    syncPrefs.edit().putBoolean("coach_notifications_enabled", false).apply()
                                    CoachNotificationScheduler.cancel(context)
                                    Toast.makeText(context, "Daily reminders disabled.", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }

                    if (notificationsEnabled) {
                        Spacer(modifier = Modifier.height(14.dp))
                        Surface(
                            onClick = { showTimePicker = true },
                            shape = MaterialTheme.shapes.medium,
                            color = MaterialTheme.colorScheme.surfaceContainerHighest,
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
                                        text = "Reminder Time",
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = "Tap to change scheduled time",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                Surface(
                                    shape = MaterialTheme.shapes.small,
                                    color = MaterialTheme.colorScheme.primaryContainer,
                                    modifier = Modifier.padding(start = 8.dp)
                                ) {
                                    Text(
                                        text = formatTime12Hour(notificationHour, notificationMinute),
                                        style = MaterialTheme.typography.labelLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // -------------------------------------------------------------
            // Section: Data Management
            // -------------------------------------------------------------
            Text(
                text = "DATA",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { handleExport() }
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "Export data",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Save a backup of your Pallas data",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { importLauncher.launch("*/*") }
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "Import data",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Merge a Pallas backup with this device",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // -------------------------------------------------------------
            // Section: Reset & Clear
            // -------------------------------------------------------------
            Text(
                text = "RESET & CLEAR",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            val resetItems = listOf(
                ResetOption("Delete strength history") { db.deleteAllLifts() },
                ResetOption("Delete fasting history") { db.deleteAllFasts() },
                ResetOption("Delete weight history") { db.deleteAllWeights() },
                ResetOption("Clear Vade Mecum") { db.clearVadeMecum() },
                ResetOption("Delete everything") { db.deleteEverything() }
            )

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                resetItems.forEach { item ->
                    Card(
                        shape = MaterialTheme.shapes.large,
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceContainer
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                confirmDialogAction = item
                            }
                    ) {
                        Text(
                            text = item.label,
                            style = MaterialTheme.typography.titleMedium,
                            color = if (item.label == "Delete everything") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(18.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // -------------------------------------------------------------
            // Section: About
            // -------------------------------------------------------------
            Text(
                text = "ABOUT",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 10.dp)
            )

            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Pallas",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = appVersion,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }

    // Confirmation Alert Dialog for Deletion
    confirmDialogAction?.let { option ->
        AlertDialog(
            onDismissRequest = { confirmDialogAction = null },
            title = { Text(option.label) },
            text = { Text("Are you sure you want to proceed? This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            option.action()
                            confirmDialogAction = null
                            Toast.makeText(context, "Action completed.", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDialogAction = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Reminder Time Picker Dialog
    if (showTimePicker) {
        val timePickerState = rememberTimePickerState(
            initialHour = notificationHour,
            initialMinute = notificationMinute,
            is24Hour = false
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        notificationHour = timePickerState.hour
                        notificationMinute = timePickerState.minute
                        syncPrefs.edit()
                            .putInt("coach_notification_hour", timePickerState.hour)
                            .putInt("coach_notification_minute", timePickerState.minute)
                            .apply()
                        if (notificationsEnabled) {
                            CoachNotificationScheduler.schedule(context)
                        }
                        showTimePicker = false
                        Toast.makeText(
                            context,
                            "Reminder scheduled for ${formatTime12Hour(timePickerState.hour, timePickerState.minute)}.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                ) {
                    Text("OK")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) {
                    Text("Cancel")
                }
            },
            title = {
                Text(
                    text = "Select Reminder Time",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    TimePicker(state = timePickerState)
                }
            }
        )
    }

    // SQL Schema & Example Queries Modal
    if (showSqlInfoModal) {
        SqlGuideModal(
            onDismiss = { showSqlInfoModal = false },
            onSelectQuery = { query ->
                sqlQuery = query
                showSqlInfoModal = false
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SqlGuideModal(
    onDismiss: () -> Unit,
    onSelectQuery: (String) -> Unit
) {
    val examples = listOf(
        Pair("View all max lifts", "SELECT * FROM max_lifts;"),
        Pair("View all fasts (most recent first)", "SELECT * FROM fasts ORDER BY start_time DESC;"),
        Pair("View body weight log", "SELECT * FROM weights ORDER BY date DESC;"),
        Pair("View Vade Mecum content", "SELECT * FROM vade_mecum;"),
        Pair("View The Study newsletter settings", "SELECT * FROM newsletter_settings;"),
        Pair("Insert lift record", "INSERT OR REPLACE INTO max_lifts (exercise, weight, reps) VALUES ('Squat', 120, 5);"),
        Pair("Insert weight measurement", "INSERT INTO weights (weight, date) VALUES (78.5, '2026-09-27');"),
        Pair("Average fast duration (hours)", "SELECT COUNT(*) as total, ROUND(AVG((strftime('%s', end_time) - strftime('%s', start_time)) / 3600.0), 1) as avg_hours FROM fasts WHERE end_time IS NOT NULL;")
    )

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = "SQL Guide & Schema",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "DATABASE TABLES",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(8.dp))

            val tables = listOf(
                Pair("max_lifts", "exercise TEXT PK, weight REAL, reps INTEGER"),
                Pair("fasts", "id INTEGER PK AUTOINCREMENT, start_time TEXT, end_time TEXT"),
                Pair("weights", "id INTEGER PK AUTOINCREMENT, weight REAL, date TEXT"),
                Pair("vade_mecum", "id INTEGER PK (1), content TEXT, updated_at TEXT"),
                Pair("newsletter_settings", "id INTEGER PK (1), issue_number INTEGER, to_self_text TEXT..."),
                Pair("coach_config", "key TEXT PK, value INTEGER"),
                Pair("coach_steps", "date TEXT PK, steps INTEGER"),
                Pair("coach_events", "id INTEGER PK AUTOINCREMENT, type TEXT, created_at TEXT, resolved INTEGER")
            )

            tables.forEach { (name, desc) ->
                Card(
                    shape = MaterialTheme.shapes.small,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHighest),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(text = name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                        Text(text = desc, fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "EXAMPLE QUERIES (TAP TO INSERT)",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(8.dp))

            examples.forEach { (title, sql) ->
                Card(
                    shape = MaterialTheme.shapes.small,
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHighest),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .clickable { onSelectQuery(sql) }
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(text = title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        Text(text = sql, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

private fun formatTime12Hour(hour: Int, minute: Int): String {
    val period = if (hour < 12) "AM" else "PM"
    val h = when {
        hour == 0 -> 12
        hour > 12 -> hour - 12
        else -> hour
    }
    val m = minute.toString().padStart(2, '0')
    return "$h:$m $period"
}
